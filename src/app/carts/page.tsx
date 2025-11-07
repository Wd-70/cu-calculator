'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ICart, ICartItem } from '@/types/cart';
import { IPreset } from '@/types/preset';
import { IDiscountRule } from '@/types/discount';
import * as clientDb from '@/lib/clientDb';
import { findOptimalDiscountCombination, DiscountCombination } from '@/lib/utils/discountOptimizer';
import { convertPromotionsToDiscountRules } from '@/lib/utils/promotionConverter';
import PresetSelector from '@/components/cart/PresetSelector';
import ProductSearch from '@/components/cart/ProductSearch';
import CartItemList from '@/components/cart/CartItemList';
import DiscountResult from '@/components/cart/DiscountResult';
import AlternativeCombinations from '@/components/cart/AlternativeCombinations';
import ProductDetailModal from '@/components/ProductDetailModal';

export default function CartsPage() {
  // 상태 관리
  const [carts, setCarts] = useState<ICart[]>([]);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<IPreset | null>(null);
  const [availableDiscounts, setAvailableDiscounts] = useState<IDiscountRule[]>([]);
  const [availablePromotions, setAvailablePromotions] = useState<any[]>([]);
  const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(false);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(-1);

  // 할인 계산 결과
  const [isCalculating, setIsCalculating] = useState(false);
  const [optimalCombination, setOptimalCombination] = useState<DiscountCombination | null>(null);
  const [alternatives, setAlternatives] = useState<DiscountCombination[]>([]);
  const [discountMap, setDiscountMap] = useState<Map<string, { name: string; category: string }>>(new Map());

  // 초기 로드
  useEffect(() => {
    clientDb.initializeClientStorage();
    loadCarts();
    loadDiscounts();
    loadPromotions();
  }, []);

  // 카트 로드
  const loadCarts = () => {
    const loadedCarts = clientDb.getCarts();
    setCarts(loadedCarts);

    // 메인 카트 자동 선택
    if (!selectedCartId && loadedCarts.length > 0) {
      const mainCart = loadedCarts.find(c => c.isMain) || loadedCarts[0];
      setSelectedCartId(String(mainCart._id));
    }
  };

  // 할인 규칙 로드 - 만료된 할인 제외
  const loadDiscounts = async () => {
    setIsLoadingDiscounts(true);
    try {
      const response = await fetch('/api/discounts?excludeExpired=true');
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setAvailableDiscounts(data.data);

          // 할인 ID -> 이름 매핑 생성
          const map = new Map<string, { name: string; category: string }>();
          data.data.forEach((discount: IDiscountRule) => {
            map.set(String(discount._id), {
              name: discount.name,
              category: discount.config.category,
            });
          });
          setDiscountMap(map);
        }
      }
    } catch (error) {
      console.error('할인 규칙 로드 실패:', error);
    } finally {
      setIsLoadingDiscounts(false);
    }
  };

  // 프로모션 로드
  const loadPromotions = async () => {
    setIsLoadingPromotions(true);
    console.log('[장바구니] 프로모션 로드 시작...');
    try {
      const response = await fetch('/api/promotions');
      console.log('[장바구니] API 응답 상태:', response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('[장바구니] API 응답 데이터:', data);
        console.log('[장바구니] 전체 프로모션 수:', data.total);

        // API는 data.promotions로 반환 (data.data가 아님)
        if (data.success && Array.isArray(data.promotions)) {
          console.log('[장바구니] 받은 프로모션:', data.promotions.length, '개');

          // 활성화되고 유효한 프로모션만 필터링
          const activePromotions = data.promotions.filter((promo: any) =>
            promo.isActive &&
            promo.status === 'active' &&
            new Date(promo.validFrom) <= new Date() &&
            new Date(promo.validTo) >= new Date()
          );
          console.log('[장바구니] 활성 프로모션:', activePromotions.length, '개');

          setAvailablePromotions(activePromotions);

          // 프로모션도 discountMap에 추가
          setDiscountMap(prev => {
            const newMap = new Map(prev);
            activePromotions.forEach((promo: any) => {
              newMap.set(String(promo._id), {
                name: promo.name,
                category: 'promotion',
              });
            });
            return newMap;
          });

          console.log('프로모션 로드 완료:', activePromotions.length, '개');
        } else {
          console.error('[장바구니] 프로모션 데이터 형식 오류:', {
            success: data.success,
            hasPromotions: !!data.promotions,
            isArray: Array.isArray(data.promotions),
          });
        }
      } else {
        console.error('[장바구니] API 응답 실패:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[장바구니] 프로모션 로드 에러:', error);
    } finally {
      setIsLoadingPromotions(false);
    }
  };

  // 선택된 카트 가져오기
  const selectedCart = carts.find(c => String(c._id) === selectedCartId) || null;

  // 상품 추가 (메인 카트에)
  const handleAddItem = (item: ICartItem) => {
    const mainCart = carts.find(c => c.isMain);
    if (!mainCart) {
      alert('메인 카트가 없습니다. 카트를 생성해주세요.');
      return;
    }

    const updated = clientDb.addItemToCart(String(mainCart._id), item);
    if (updated) {
      loadCarts();
      // 메인 카트를 선택
      setSelectedCartId(String(mainCart._id));
    }
  };

  // 수량 변경
  const handleUpdateQuantity = (barcode: string, quantity: number) => {
    if (!selectedCartId) return;

    const updated = clientDb.updateCartItem(selectedCartId, barcode, { quantity });
    if (updated) {
      loadCarts();
    }
  };

  // 상품 제거
  const handleRemoveItem = (barcode: string) => {
    if (!selectedCartId) return;

    const updated = clientDb.removeItemFromCart(selectedCartId, barcode);
    if (updated) {
      loadCarts();
    }
  };

  // 선택된 상품 가져오기
  const selectedProductForDetail = selectedProductIndex >= 0 && selectedCart
    ? selectedCart.items[selectedProductIndex]
    : null;

  // 상품 클릭 (상세 정보 모달)
  const handleItemClick = (item: ICartItem) => {
    if (!selectedCart) return;
    const index = selectedCart.items.findIndex(i => i.barcode === item.barcode);
    setSelectedProductIndex(index);
  };

  // 다음 상품으로 이동
  const handleNextProduct = () => {
    if (!selectedCart || selectedProductIndex >= selectedCart.items.length - 1) return;
    setSelectedProductIndex(selectedProductIndex + 1);
  };

  // 이전 상품으로 이동
  const handlePreviousProduct = () => {
    if (selectedProductIndex <= 0) return;
    setSelectedProductIndex(selectedProductIndex - 1);
  };

  // 상세 모달 닫기
  const handleCloseDetailModal = () => {
    setSelectedProductIndex(-1);
  };

  // 상세 모달에서 장바구니에 추가
  const handleAddFromDetailModal = (quantity: number) => {
    if (!selectedProductForDetail || !selectedCartId) return;

    const updated = clientDb.updateCartItem(selectedCartId, selectedProductForDetail.barcode, {
      quantity: selectedProductForDetail.quantity + quantity,
    });
    if (updated) {
      loadCarts();
    }
  };

  // 프리셋 변경
  const handlePresetChange = (preset: IPreset | null) => {
    setSelectedPreset(preset);
  };

  // 카트 생성
  const handleCreateCart = () => {
    const name = prompt('카트 이름을 입력하세요:', '새 장바구니');
    if (!name) return;

    const newCart = clientDb.createCart({
      name,
      emoji: '🛒',
      color: 'purple',
      items: [],
      isMain: carts.length === 0, // 첫 카트는 자동으로 메인
    });

    if (newCart) {
      loadCarts();
      setSelectedCartId(String(newCart._id));
    }
  };

  // 카트 삭제
  const handleDeleteCart = (cartId: string) => {
    const cart = carts.find(c => String(c._id) === cartId);
    if (!cart) return;

    if (!confirm(`"${cart.name || '장바구니'}"를 삭제하시겠습니까?`)) return;

    const success = clientDb.deleteCart(cartId);
    if (success) {
      loadCarts();
      if (selectedCartId === cartId) {
        setSelectedCartId(null);
      }
    }
  };

  // 메인 카트 설정
  const handleSetMainCart = (cartId: string) => {
    const updated = clientDb.setMainCart(cartId);
    if (updated) {
      loadCarts();
    }
  };

  // 할인 계산
  const calculateDiscount = useCallback(() => {
    if (!selectedCart || !selectedPreset || selectedCart.items.length === 0) {
      setOptimalCombination(null);
      setAlternatives([]);
      return;
    }

    setIsCalculating(true);
    try {
      console.log('할인 계산 시작...');
      console.log('  - 할인규칙:', availableDiscounts.length, '개');
      console.log('  - 프로모션:', availablePromotions.length, '개');

      // 프로모션을 할인 규칙 형식으로 변환
      const promotionRules = convertPromotionsToDiscountRules(availablePromotions);
      console.log('  - 변환된 프로모션 규칙:', promotionRules.length, '개');

      const result = findOptimalDiscountCombination(
        selectedCart.items,
        availableDiscounts,      // 할인규칙
        promotionRules,          // 프로모션 (IDiscountRule 형식으로 변환)
        selectedPreset,
        {
          maxCombinations: 100,
          includeAlternatives: true,
          maxAlternatives: 5,
        }
      );

      // 최적 조합에 대해서만 verbose=true로 다시 계산하여 상세 로그 출력
      if (result.optimal) {
        console.log('\n========== 최적 조합 상세 계산 ==========');
        console.log('할인 ID:', result.optimal.discountIds);
        console.log('총 할인액:', result.optimal.totalDiscount, '원');
        console.log('할인율:', (result.optimal.totalDiscountRate * 100).toFixed(1), '%');
        console.log('원가:', result.optimal.originalPrice, '원');
        console.log('최종 가격:', result.optimal.finalPrice, '원');

        if (result.optimal.discountBreakdown) {
          console.log('\n[할인 상세 내역]');
          result.optimal.discountBreakdown.forEach((d) => {
            console.log(`  - ${d.discountName} (${d.category}): ${d.amount}원`);
          });
        }

        if (result.optimal.warnings && result.optimal.warnings.length > 0) {
          console.log('\n[경고]');
          result.optimal.warnings.forEach((w) => console.log(`  ⚠️ ${w}`));
        }
        console.log('==========================================\n');
      }

      setOptimalCombination(result.optimal);
      setAlternatives(result.alternatives);
    } catch (error) {
      console.error('할인 계산 실패:', error);
      alert('할인 계산 중 오류가 발생했습니다.');
    } finally {
      setIsCalculating(false);
    }
  }, [selectedCart, selectedPreset, availableDiscounts, availablePromotions]);

  // 장바구니나 프리셋 변경 시 자동 재계산
  // 단, 할인규칙과 프로모션이 모두 로드된 후에만 계산
  useEffect(() => {
    // 데이터가 아직 로딩 중이면 계산하지 않음
    if (isLoadingDiscounts || isLoadingPromotions) {
      console.log('[장바구니] 데이터 로딩 중... 계산 대기');
      return;
    }

    // 장바구니, 프리셋, 상품이 있어야 함
    if (!selectedCart || !selectedPreset || selectedCart.items.length === 0) {
      setOptimalCombination(null);
      setAlternatives([]);
      return;
    }

    // 할인규칙이나 프로모션이 하나라도 있을 때만 계산
    // (둘 다 없으면 데이터가 없는 상태)
    if (availableDiscounts.length > 0 || availablePromotions.length > 0) {
      calculateDiscount();
    } else {
      console.log('[장바구니] 할인규칙과 프로모션이 모두 없어 계산하지 않음');
    }
  }, [
    selectedCart?.items.length,
    selectedPreset,
    availableDiscounts.length,
    availablePromotions.length,
    isLoadingDiscounts,
    isLoadingPromotions,
    calculateDiscount,
  ]);

  // 적용된 할인 정보 변환
  const getAppliedDiscounts = () => {
    if (!optimalCombination) return [];

    // discountBreakdown이 있으면 그것을 사용 (실제 계산된 금액 포함)
    if (optimalCombination.discountBreakdown && optimalCombination.discountBreakdown.length > 0) {
      return optimalCombination.discountBreakdown.map((breakdown) => ({
        discountId: breakdown.discountId,
        discountName: breakdown.discountName,
        discountAmount: breakdown.amount,
        category: breakdown.category,
        steps: breakdown.steps, // 계산 과정 단계 추가
        baseAmount: breakdown.baseAmount, // 기준 금액 추가
        appliedProducts: breakdown.appliedProducts, // 적용된 상품 목록 추가
      }));
    }

    // fallback: discountBreakdown이 없으면 기존 방식 사용
    return optimalCombination.discountIds.map((id) => {
      const discount = discountMap.get(id);
      return {
        discountId: id,
        discountName: discount?.name || 'Unknown',
        discountAmount: 0,
        category: discount?.category || 'coupon',
      };
    });
  };

  const totalOriginalPrice = selectedCart?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="w-12 h-12 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-lg"
              >
                CU
              </Link>
              <div>
                <h1 className="text-gray-900 font-bold text-xl">스마트 장바구니</h1>
                <p className="text-gray-500 text-xs">여러 경우의 수를 저장하고 비교해보세요</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/settings/presets"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                프리셋 관리
              </Link>
              <Link
                href="/"
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
              >
                홈으로
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 왼쪽: 카트 목록 */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">내 장바구니</h3>
                <button
                  onClick={handleCreateCart}
                  className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                  title="새 카트 만들기"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {carts.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <div className="text-4xl mb-2">🛒</div>
                  <p className="text-sm mb-3">카트가 없습니다</p>
                  <button
                    onClick={handleCreateCart}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    첫 카트 만들기
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {carts.map((cart) => (
                    <div
                      key={String(cart._id)}
                      className={`p-4 transition-colors ${
                        selectedCartId === String(cart._id) ? 'bg-purple-50' : ''
                      }`}
                    >
                      <button
                        onClick={() => setSelectedCartId(String(cart._id))}
                        className="w-full text-left hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl flex-shrink-0">{cart.emoji || '🛒'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {cart.name || '장바구니'}
                              {cart.isMain && (
                                <span className="ml-2 text-xs text-purple-600">⭐ 메인</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {cart.items.length}개 상품
                            </div>
                          </div>
                          {selectedCartId === String(cart._id) && (
                            <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>

                      {/* 카트 액션 */}
                      {selectedCartId === String(cart._id) && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                          {!cart.isMain && (
                            <button
                              onClick={() => handleSetMainCart(String(cart._id))}
                              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                            >
                              메인으로 설정
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCart(String(cart._id))}
                            className="ml-auto text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 메인 카트 안내 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              <div className="font-medium mb-1">💡 메인 카트</div>
              <p>상품 검색에서 추가한 상품은 메인 카트에 자동으로 담깁니다.</p>
            </div>
          </div>

          {/* 중앙: 장바구니 관리 */}
          <div className="lg:col-span-6 space-y-6">
            {selectedCart ? (
              <>
                {/* 프리셋 선택 */}
                <PresetSelector
                  selectedPresetId={selectedPreset ? String(selectedPreset._id) : null}
                  onPresetChange={handlePresetChange}
                />

                {/* 상품 추가 (메인 카트에만 표시) */}
                {selectedCart.isMain && (
                  <ProductSearch
                    onAddItem={handleAddItem}
                    cartId={String(selectedCart._id)}
                  />
                )}

                {/* 장바구니 아이템 목록 */}
                <CartItemList
                  items={selectedCart.items}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onItemClick={handleItemClick}
                />
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                <div className="text-6xl mb-4">🛒</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">카트를 선택해주세요</h3>
                <p className="text-sm text-gray-500 mb-4">왼쪽에서 카트를 선택하거나 새로 만들어보세요</p>
                <button
                  onClick={handleCreateCart}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  새 카트 만들기
                </button>
              </div>
            )}
          </div>

          {/* 오른쪽: 할인 계산 결과 */}
          <div className="lg:col-span-3 space-y-6">
            {/* 할인 계산 결과 */}
            <DiscountResult
              isCalculating={isCalculating}
              originalPrice={totalOriginalPrice}
              finalPrice={optimalCombination?.finalPrice || totalOriginalPrice}
              totalDiscount={optimalCombination?.totalDiscount || 0}
              totalDiscountRate={optimalCombination?.totalDiscountRate || 0}
              appliedDiscounts={getAppliedDiscounts()}
              warnings={optimalCombination?.warnings}
              onRecalculate={calculateDiscount}
            />

            {/* 대안 할인 조합 */}
            <AlternativeCombinations
              alternatives={alternatives}
              discountMap={discountMap}
              currentPreset={selectedPreset}
            />

            {/* 도움말 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">💡</div>
                <div className="flex-1 text-sm text-blue-800">
                  <h4 className="font-semibold mb-2">사용 가이드</h4>
                  <ul className="space-y-1.5 text-xs">
                    <li>• 여러 카트를 만들어 다양한 경우를 비교하세요</li>
                    <li>• 프리셋에 결제수단과 구독을 등록하세요</li>
                    <li>• 상품을 추가하면 자동으로 최적 할인을 계산해요</li>
                    <li>• 프로모션(1+1, 2+1) 할인도 자동 적용돼요</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 로딩 오버레이 */}
      {isLoadingDiscounts && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-gray-700">할인 규칙을 불러오는 중...</div>
            </div>
          </div>
        </div>
      )}

      {/* 상품 상세 정보 모달 */}
      {selectedProductForDetail && selectedCart && (
        <ProductDetailModal
          product={{
            _id: selectedProductForDetail.barcode, // barcode를 _id로 사용
            barcode: selectedProductForDetail.barcode,
            name: selectedProductForDetail.name,
            price: selectedProductForDetail.price,
            brand: selectedProductForDetail.brand,
            imageUrl: selectedProductForDetail.imageUrl,
            categoryTags: selectedProductForDetail.category
              ? [{ name: selectedProductForDetail.category, level: 1 }]
              : undefined,
          }}
          onClose={handleCloseDetailModal}
          onAddToCart={handleAddFromDetailModal}
          currentQuantity={selectedProductForDetail.quantity}
          onNext={handleNextProduct}
          onPrevious={handlePreviousProduct}
          hasNext={selectedProductIndex < selectedCart.items.length - 1}
          hasPrevious={selectedProductIndex > 0}
        />
      )}
    </div>
  );
}
