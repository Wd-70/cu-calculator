'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ICart, ICartItem } from '@/types/cart';
import { IPreset } from '@/types/preset';
import { IDiscountRule } from '@/types/discount';
import * as clientDb from '@/lib/clientDb';
import { findOptimalDiscountCombination, DiscountCombination } from '@/lib/utils/discountOptimizer';
import PresetSelector from '@/components/cart/PresetSelector';
import ProductSearch from '@/components/cart/ProductSearch';
import CartItemList from '@/components/cart/CartItemList';
import DiscountResult from '@/components/cart/DiscountResult';
import AlternativeCombinations from '@/components/cart/AlternativeCombinations';

export default function CartPage() {
  // 상태 관리
  const [cart, setCart] = useState<ICart | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<IPreset | null>(null);
  const [availableDiscounts, setAvailableDiscounts] = useState<IDiscountRule[]>([]);
  const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(false);

  // 할인 계산 결과
  const [isCalculating, setIsCalculating] = useState(false);
  const [optimalCombination, setOptimalCombination] = useState<DiscountCombination | null>(null);
  const [alternatives, setAlternatives] = useState<DiscountCombination[]>([]);
  const [discountMap, setDiscountMap] = useState<Map<string, { name: string; category: string }>>(new Map());

  // 초기 로드
  useEffect(() => {
    clientDb.initializeClientStorage();
    loadCart();
    loadDiscounts();
  }, []);

  // 장바구니 로드 (메인 카트 자동 생성)
  const loadCart = () => {
    const mainCart = clientDb.getOrCreateMainCart();
    setCart(mainCart);
  };

  // 할인 규칙 로드
  const loadDiscounts = async () => {
    setIsLoadingDiscounts(true);
    try {
      const response = await fetch('/api/discounts');
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

  // 장바구니 저장
  const saveCart = (updatedCart: ICart) => {
    const saved = clientDb.updateCart(String(updatedCart._id), {
      items: updatedCart.items,
    });
    if (saved) {
      setCart(saved);
    }
  };

  // 상품 추가
  const handleAddItem = (item: ICartItem) => {
    if (!cart) return;

    const updated = clientDb.addItemToCart(String(cart._id), item);
    if (updated) {
      setCart(updated);
    }
  };

  // 수량 변경
  const handleUpdateQuantity = (barcode: string, quantity: number) => {
    if (!cart) return;

    const updated = clientDb.updateCartItem(String(cart._id), barcode, { quantity });
    if (updated) {
      setCart(updated);
    }
  };

  // 상품 제거
  const handleRemoveItem = (barcode: string) => {
    if (!cart) return;

    const updated = clientDb.removeItemFromCart(String(cart._id), barcode);
    if (updated) {
      setCart(updated);
    }
  };

  // 프리셋 변경
  const handlePresetChange = (preset: IPreset | null) => {
    setSelectedPreset(preset);
  };

  // 할인 계산
  const calculateDiscount = useCallback(() => {
    if (!cart || !selectedPreset || cart.items.length === 0) {
      setOptimalCombination(null);
      setAlternatives([]);
      return;
    }

    setIsCalculating(true);
    try {
      const result = findOptimalDiscountCombination(
        cart.items,
        availableDiscounts,
        selectedPreset,
        {
          maxCombinations: 100,
          includeAlternatives: true,
          maxAlternatives: 5,
        }
      );

      setOptimalCombination(result.optimal);
      setAlternatives(result.alternatives);
    } catch (error) {
      console.error('할인 계산 실패:', error);
      alert('할인 계산 중 오류가 발생했습니다.');
    } finally {
      setIsCalculating(false);
    }
  }, [cart, selectedPreset, availableDiscounts]);

  // 장바구니나 프리셋 변경 시 자동 재계산
  useEffect(() => {
    if (cart && selectedPreset && cart.items.length > 0) {
      calculateDiscount();
    } else {
      setOptimalCombination(null);
      setAlternatives([]);
    }
  }, [cart?.items.length, selectedPreset, calculateDiscount]);

  // 적용된 할인 정보 변환
  const getAppliedDiscounts = () => {
    if (!optimalCombination) return [];

    return optimalCombination.discountIds.map((id) => {
      const discount = discountMap.get(id);
      return {
        discountId: id,
        discountName: discount?.name || 'Unknown',
        discountAmount: 0, // 개별 할인액은 계산 필요 (추후 개선)
        category: discount?.category || 'coupon',
      };
    });
  };

  if (!cart) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <div className="text-gray-600">장바구니를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  const totalOriginalPrice = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
                <p className="text-gray-500 text-xs">최적의 할인 조합을 자동으로 찾아드려요</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 장바구니 관리 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 프리셋 선택 */}
            <PresetSelector
              selectedPresetId={selectedPreset ? String(selectedPreset._id) : null}
              onPresetChange={handlePresetChange}
            />

            {/* 상품 추가 */}
            <ProductSearch onAddItem={handleAddItem} />

            {/* 장바구니 아이템 목록 */}
            <CartItemList
              items={cart.items}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
            />
          </div>

          {/* 오른쪽: 할인 계산 결과 */}
          <div className="lg:col-span-1 space-y-6">
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
            />

            {/* 도움말 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">💡</div>
                <div className="flex-1 text-sm text-blue-800">
                  <h4 className="font-semibold mb-2">사용 가이드</h4>
                  <ul className="space-y-1.5 text-xs">
                    <li>• 프리셋에 결제수단과 구독을 등록하세요</li>
                    <li>• 상품을 추가하면 자동으로 최적 할인을 계산해요</li>
                    <li>• 프로모션(1+1, 2+1) 할인도 자동 적용돼요</li>
                    <li>• 대안 조합에서 다른 할인 방법을 확인하세요</li>
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
    </div>
  );
}
