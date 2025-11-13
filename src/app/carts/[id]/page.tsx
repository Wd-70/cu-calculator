'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Barcode from 'react-barcode';
import * as clientDb from '@/lib/clientDb';
import { ICart, ICartItem, CART_COLORS } from '@/types/cart';
import { IDiscountRule, DISCOUNT_CATEGORY_NAMES } from '@/types/discount';
import { IPreset } from '@/types/preset';
import { PaymentMethod, PAYMENT_METHOD_NAMES } from '@/types/payment';
import Toast from '@/components/Toast';
import BarcodeScannerModal from '@/components/BarcodeScannerModal';
import { calculateCartOnClient } from '@/lib/clientCalculator';

interface DiscountStep {
  discountId: string;
  name: string;
  amount: number;
  calculationDetails: string;
  afterAmount: number;
  appliedItems?: Array<{
    productName: string;
    price: number;
    quantity: number;
    discountAmount: number;
  }>;
}

interface CalculationResult {
  success: boolean;
  data?: {
    totalOriginalPrice: number;
    totalFinalPrice: number;
    totalDiscount: number;
    totalDiscountRate: number;
    discountSteps: DiscountStep[];
    paymentMethod?: string;
  };
  error?: string;
}

export default function CartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cart, setCart] = useState<ICart | null>(null);
  const [discounts, setDiscounts] = useState<IDiscountRule[]>([]);
  const [presets, setPresets] = useState<IPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [couponUsageLimits, setCouponUsageLimits] = useState<Record<string, number>>({});
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showBarcode, setShowBarcode] = useState(true);
  const [priceChanges, setPriceChanges] = useState<Record<string, { oldPrice: number; newPrice: number }>>({});
  const [scannerModalOpen, setScannerModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  // 장바구니 아이템의 상품 정보 동기화 (비동기)
  useEffect(() => {
    if (!cart || cart.items.length === 0) return;

    const syncProductInfo = async () => {
      const now = new Date();
      const changes: Record<string, { oldPrice: number; newPrice: number }> = {};
      let hasUpdates = false;

      for (const item of cart.items) {
        // 로딩 중이거나 에러 상태인 아이템은 스킵
        if (item.isLoading || item.loadError) continue;

        // 5분 이내에 동기화했으면 스킵
        if (item.lastSyncedAt) {
          const lastSync = new Date(item.lastSyncedAt);
          const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);
          if (minutesSinceSync < 5) continue;
        }

        try {
          const response = await fetch(`/api/products?barcode=${item.barcode}&limit=1`);
          const data = await response.json();

          if (data.success && data.data && data.data.length > 0) {
            const latestProduct = data.data[0];

            // 가격 변경 감지
            if (latestProduct.price !== item.price) {
              changes[item.barcode] = {
                oldPrice: item.price,
                newPrice: latestProduct.price,
              };
            }

            // 이미지, 카테고리 등 자동 업데이트 (가격 제외)
            const updatedItem = {
              ...item,
              imageUrl: latestProduct.imageUrl || item.imageUrl,
              categoryTags: latestProduct.categoryTags || item.categoryTags,
              latestPrice: latestProduct.price,
              priceCheckedAt: now,
              lastSyncedAt: now,
            };

            // 로컬 업데이트
            clientDb.updateCartItem(id, item.barcode, updatedItem);
            hasUpdates = true;
          }
        } catch (error) {
          console.error(`Failed to sync product ${item.barcode}:`, error);
        }
      }

      // 가격 변경 사항이 있으면 상태 업데이트
      if (Object.keys(changes).length > 0) {
        setPriceChanges(changes);
      }

      // 업데이트가 있었으면 장바구니 다시 로드
      if (hasUpdates) {
        const updatedCart = clientDb.getCart(id);
        if (updatedCart) {
          setCart(updatedCart);
        }
      }
    };

    // 백그라운드에서 비동기 실행
    syncProductInfo();
  }, [cart?.items.length, id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 클라이언트 데이터
      const localCart = clientDb.getCart(id);
      setCart(localCart);
      setSelectedPaymentMethod(localCart?.paymentMethod);

      const localPresets = clientDb.getPresets();
      setPresets(localPresets);

      // 서버 데이터 (할인 목록만)
      const discountsRes = await fetch('/api/discounts?excludeExpired=true');
      const discountsData = await discountsRes.json();
      if (discountsData.success) {
        setDiscounts(discountsData.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 실시간 계산
  useEffect(() => {
    if (cart && cart.items.length > 0 && discounts.length > 0) {
      performCalculation();
    } else {
      setCalculationResult(null);
    }
  }, [cart, selectedDiscountIds, selectedPaymentMethod, discounts, couponUsageLimits]);

  const performCalculation = () => {
    if (!cart || cart.items.length === 0) return;

    try {
      setCalculating(true);

      // 클라이언트에서 직접 계산
      const result = calculateCartOnClient({
        cartItems: cart.items,
        selectedDiscountIds: selectedDiscountIds,
        allDiscounts: discounts,
        paymentMethod: selectedPaymentMethod,
        couponUsageLimits: couponUsageLimits,
      });

      // Debug: 계산 결과 확인
      console.log('Client calculation result:', result);

      setCalculationResult(result);

      if (result.success && result.data) {
        // 계산 결과를 카트에 캐시
        clientDb.updateCart(id, {
          cachedTotalOriginalPrice: result.data.totalOriginalPrice,
          cachedTotalFinalPrice: result.data.totalFinalPrice,
          cachedTotalDiscount: result.data.totalDiscount,
          lastCalculatedAt: new Date(),
          paymentMethod: selectedPaymentMethod,
        });
      }
    } catch (error) {
      console.error('Failed to calculate:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleRemoveItem = (barcode: string) => {
    if (!confirm('이 상품을 삭제하시겠습니까?')) return;

    const result = clientDb.removeItemFromCart(id, barcode);
    if (result) {
      setCart(result);
      setToast({ message: '상품이 삭제되었습니다.', type: 'success' });
    }
  };

  const handleUpdateQuantity = (barcode: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    const result = clientDb.updateCartItem(id, barcode, { quantity: newQuantity });
    if (result) {
      setCart(result);
    }
  };

  const handleApplyPreset = (preset: IPreset) => {
    setSelectedDiscountIds(preset.discountIds?.map(String) || []);
    if (preset.paymentMethod) {
      setSelectedPaymentMethod(preset.paymentMethod);
    }
    setToast({ message: `"${preset.name}" 프리셋이 적용되었습니다.`, type: 'success' });
  };

  const handleToggleDiscount = (discountId: string) => {
    if (selectedDiscountIds.includes(discountId)) {
      setSelectedDiscountIds(selectedDiscountIds.filter(id => id !== discountId));
      // 선택 해제 시 한도 정보 제거
      setCouponUsageLimits(prev => {
        const newLimits = { ...prev };
        delete newLimits[discountId];
        return newLimits;
      });
    } else {
      setSelectedDiscountIds([...selectedDiscountIds, discountId]);
      // 구독 할인인 경우 기본 일일 한도 설정
      const discount = discounts.find(d => String(d._id) === discountId);
      if (discount && discount.config.category === 'coupon' && (discount.config as any).isSubscription) {
        const dailyLimit = (discount.config as any).dailyUsageLimit;
        setCouponUsageLimits(prev => ({
          ...prev,
          [discountId]: dailyLimit
        }));
      }
    }
  };

  const getDiscountName = (discountId: string): string => {
    const discount = discounts.find(d => String(d._id) === discountId);
    return discount?.name || '알 수 없는 할인';
  };

  const getDiscountAmount = (discountId: string): number => {
    if (!calculationResult?.success || !calculationResult.data) return 0;

    const step = calculationResult.data.discountSteps.find(s => s.discountId === discountId);
    return step ? step.amount : 0;
  };

  // 스와이프 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || selectedItemIndex === null) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && selectedItemIndex < cart!.items.length - 1) {
      setSelectedItemIndex(selectedItemIndex + 1);
    }
    if (isRightSwipe && selectedItemIndex > 0) {
      setSelectedItemIndex(selectedItemIndex - 1);
    }
  };

  const handlePrevItem = () => {
    if (selectedItemIndex !== null && selectedItemIndex > 0) {
      setSelectedItemIndex(selectedItemIndex - 1);
    }
  };

  const handleNextItem = () => {
    if (selectedItemIndex !== null && cart && selectedItemIndex < cart.items.length - 1) {
      setSelectedItemIndex(selectedItemIndex + 1);
    }
  };

  // 바코드 스캔 핸들러 (즉시 추가 + 백그라운드 로딩)
  const handleBarcodeScan = async (barcode: string): Promise<boolean> => {
    console.log('[handleBarcodeScan] 시작:', barcode);

    try {
      // 1. 즉시 바코드만으로 아이템 추가
      const placeholderItem: ICartItem = {
        barcode,
        quantity: 1,
        name: '상품 정보 로딩 중...',
        price: 0,
        isLoading: true,
      };

      console.log('[handleBarcodeScan] placeholder 추가 시도');
      const updatedCart = clientDb.addItemToCart(id, placeholderItem);

      if (!updatedCart) {
        console.error('[handleBarcodeScan] 장바구니 추가 실패');
        setToast({ message: '장바구니에 추가할 수 없습니다', type: 'error' });
        return false;
      }

      console.log('[handleBarcodeScan] 장바구니 업데이트 성공', updatedCart.items.length, '개 아이템');
      setCart(updatedCart);

      // 2. 백그라운드에서 상품 정보 로드
      setTimeout(() => {
        (async () => {
          try {
            console.log('[백그라운드] API 요청 시작:', barcode);
            const response = await fetch(`/api/products?barcode=${barcode}&limit=1`);
            const data = await response.json();
            console.log('[백그라운드] API 응답:', data);

            if (!data.success || !data.data || data.data.length === 0) {
              // 실패: 에러 상태로 업데이트
              console.log('[백그라운드] 상품 없음, 에러 상태 업데이트');
              clientDb.updateCartItem(id, barcode, {
                isLoading: false,
                loadError: '상품을 찾을 수 없습니다',
                name: '알 수 없는 상품',
              });
            } else {
              // 성공: 실제 정보로 업데이트
              const product = data.data[0];
              console.log('[백그라운드] 상품 정보 업데이트:', product.name);
              clientDb.updateCartItem(id, barcode, {
                productId: product._id,
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrl,
                categoryTags: product.categoryTags,
                brand: product.brand,
                isLoading: false,
                loadError: undefined,
                lastSyncedAt: new Date(),
              });
            }

            // 장바구니 다시 로드
            const newCart = clientDb.getCart(id);
            if (newCart) {
              console.log('[백그라운드] 장바구니 리프레시');
              setCart(newCart);
            }
          } catch (error) {
            console.error('[백그라운드] 에러 발생:', error);
            // 에러 상태로 업데이트
            clientDb.updateCartItem(id, barcode, {
              isLoading: false,
              loadError: '로딩 실패',
              name: '로딩 실패',
            });

            const newCart = clientDb.getCart(id);
            if (newCart) {
              setCart(newCart);
            }
          }
        })();
      }, 100); // 약간의 딜레이로 UI 업데이트 우선

      return true;
    } catch (error) {
      console.error('[handleBarcodeScan] 에러:', error);
      setToast({ message: '상품 추가 중 오류가 발생했습니다', type: 'error' });
      return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-[#7C3FBF] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!cart) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">장바구니를 찾을 수 없습니다</h1>
          <Link href="/carts" className="text-[#7C3FBF] hover:underline">
            장바구니 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const colorScheme = cart.color ? CART_COLORS[cart.color] : CART_COLORS.purple;

  // 카테고리별 할인 그룹화
  const groupedDiscounts = discounts.reduce((acc, discount) => {
    const category = discount.config.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(discount);
    return acc;
  }, {} as Record<string, IDiscountRule[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-3">
            {/* 좌측: 뒤로가기 + 카트 정보 */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <Link href="/carts" className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              {cart.emoji && <span className="text-2xl md:text-3xl flex-shrink-0">{cart.emoji}</span>}
              <div className="min-w-0">
                <h1 className="text-base md:text-xl font-bold text-gray-900 truncate">
                  {cart.name || '이름 없는 카트'}
                </h1>
                {cart.isMain && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded inline-block">⭐ 메인</span>
                )}
              </div>
            </div>

            {/* 우측: 액션 버튼들 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* 모바일: 아이콘만 표시 */}
              <button
                onClick={() => setScannerModalOpen(true)}
                className="md:hidden p-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                title="바코드 스캔"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="7" width="1.5" height="10" fill="currentColor" />
                  <rect x="6" y="7" width="1" height="10" fill="currentColor" />
                  <rect x="8.5" y="7" width="2" height="10" fill="currentColor" />
                  <rect x="12" y="7" width="1" height="10" fill="currentColor" />
                  <rect x="14.5" y="7" width="1.5" height="10" fill="currentColor" />
                  <rect x="17.5" y="7" width="1" height="10" fill="currentColor" />
                  <rect x="19.5" y="7" width="1.5" height="10" fill="currentColor" />
                </svg>
              </button>
              <Link
                href="/products"
                className="md:hidden p-2.5 bg-[#7C3FBF] text-white rounded-lg hover:bg-[#6B2FAF] transition-colors flex items-center justify-center"
                title="상품 추가"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Link>

              {/* PC: 텍스트 포함 */}
              <button
                onClick={() => setScannerModalOpen(true)}
                className="hidden md:flex px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="7" width="1.5" height="10" fill="currentColor" />
                  <rect x="6" y="7" width="1" height="10" fill="currentColor" />
                  <rect x="8.5" y="7" width="2" height="10" fill="currentColor" />
                  <rect x="12" y="7" width="1" height="10" fill="currentColor" />
                  <rect x="14.5" y="7" width="1.5" height="10" fill="currentColor" />
                  <rect x="17.5" y="7" width="1" height="10" fill="currentColor" />
                  <rect x="19.5" y="7" width="1.5" height="10" fill="currentColor" />
                </svg>
                스캔
              </button>
              <Link
                href="/products"
                className="hidden md:flex px-4 py-2 bg-[#7C3FBF] text-white rounded-lg font-semibold hover:bg-[#6B2FAF] transition-colors items-center"
              >
                상품 추가
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* 가격 변경 알림 */}
        {Object.keys(priceChanges).length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-orange-900 mb-2">가격이 변경된 상품이 있습니다</h3>
                <div className="space-y-2 mb-4">
                  {Object.entries(priceChanges).map(([barcode, change]) => {
                    const item = cart?.items.find(i => i.barcode === barcode);
                    if (!item) return null;
                    return (
                      <div key={barcode} className="flex items-center justify-between bg-white rounded-lg p-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-600">
                            <span className="line-through">{change.oldPrice.toLocaleString()}원</span>
                            {' → '}
                            <span className="font-bold text-orange-600">{change.newPrice.toLocaleString()}원</span>
                            {change.newPrice > change.oldPrice ? (
                              <span className="ml-2 text-red-600">▲ {(change.newPrice - change.oldPrice).toLocaleString()}원</span>
                            ) : (
                              <span className="ml-2 text-green-600">▼ {(change.oldPrice - change.newPrice).toLocaleString()}원</span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // 가격 업데이트 적용
                            if (!cart) return;
                            const updatedItem = cart.items.find(i => i.barcode === barcode);
                            if (updatedItem && updatedItem.latestPrice) {
                              clientDb.updateCartItem(id, barcode, {
                                price: updatedItem.latestPrice,
                              });
                              const updatedCart = clientDb.getCart(id);
                              if (updatedCart) {
                                setCart(updatedCart);
                              }
                              // 알림에서 제거
                              setPriceChanges(prev => {
                                const newChanges = { ...prev };
                                delete newChanges[barcode];
                                return newChanges;
                              });
                              setToast({ message: '가격이 업데이트되었습니다.', type: 'success' });
                            }
                          }}
                          className="ml-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
                        >
                          가격 업데이트
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPriceChanges({})}
                  className="text-sm text-orange-700 hover:text-orange-900 underline"
                >
                  모두 무시하고 원래 가격 유지
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 상품 목록 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">담긴 상품</h2>

          {cart.items.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">🛒</div>
              <p className="text-gray-600 mb-4">장바구니가 비어있습니다</p>
              <Link
                href="/products"
                className="inline-block px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors"
              >
                상품 검색하기
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.items.map((item, index) => (
                <div key={item.barcode} className={`border rounded-xl p-3 md:p-4 relative hover:shadow-md transition-shadow ${
                  item.loadError ? 'border-red-300 bg-red-50' : item.isLoading ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}>
                  {/* 로딩/에러 배너 */}
                  {item.isLoading && (
                    <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-xs py-1 px-3 rounded-t-xl flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>상품 정보 로딩 중...</span>
                    </div>
                  )}
                  {item.loadError && (
                    <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs py-1 px-3 rounded-t-xl flex items-center justify-between">
                      <span>⚠️ {item.loadError}</span>
                      <button
                        onClick={() => handleRemoveItem(item.barcode)}
                        className="underline hover:text-red-200"
                      >
                        제거
                      </button>
                    </div>
                  )}

                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleRemoveItem(item.barcode)}
                    className={`absolute ${item.isLoading || item.loadError ? 'top-8' : 'top-2'} right-2 md:right-3 w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10`}
                    title="삭제"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div
                    className={`cursor-pointer ${item.isLoading || item.loadError ? 'pt-6' : ''}`}
                    onClick={() => setSelectedItemIndex(index)}
                  >
                    {/* 모바일: 2단 레이아웃 / PC: 가로 한 줄 레이아웃 */}

                    {/* 모바일 레이아웃 (md 미만) */}
                    <div className="md:hidden">
                      {/* 상단: 이미지 + 상품명 + 카테고리 */}
                      <div className="flex items-center gap-3 pr-7 mb-2">
                        {item.imageUrl && (
                          <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/56x56?text=No+Image';
                              }}
                            />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{item.name || `바코드: ${item.barcode}`}</h3>
                          {item.categoryTags?.[0]?.name && (
                            <span className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                              {item.categoryTags[0].name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 하단: 가격 + 수량 조절 + 소계 */}
                      <div className="flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                        <div className="text-sm text-gray-600 flex-shrink-0">
                          {item.price !== undefined ? `${item.price.toLocaleString()}원` : '-'}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleUpdateQuantity(item.barcode, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold transition-colors text-sm"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.barcode, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold transition-colors text-sm"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-500">소계</p>
                          <p className="font-bold text-gray-900 text-sm">
                            {item.price !== undefined ? `${(item.price * item.quantity).toLocaleString()}원` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* PC 레이아웃 (md 이상) - 기존 스타일 */}
                    <div className="hidden md:flex items-start gap-4 pr-8">
                      {/* 상품 이미지 */}
                      {item.imageUrl && (
                        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/64x64?text=No+Image';
                            }}
                          />
                        </div>
                      )}

                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">{item.name || `바코드: ${item.barcode}`}</h3>
                        <p className="text-sm text-gray-500 mb-2">
                          {item.price !== undefined ? `${item.price.toLocaleString()}원` : '-'}
                        </p>
                        {item.categoryTags?.[0]?.name && (
                          <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                            {item.categoryTags[0].name}
                          </span>
                        )}
                      </div>

                      {/* 수량 조절 */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleUpdateQuantity(item.barcode, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold transition-colors"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-bold">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.barcode, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold transition-colors"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-500">소계</p>
                        <p className="font-bold text-gray-900">
                          {item.price !== undefined ? `${(item.price * item.quantity).toLocaleString()}원` : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.items.length > 0 && (
          <>
            {/* 프리셋 선택 */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">프리셋 선택</h2>

              {presets.length === 0 && discounts.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  사용 가능한 할인이나 프리셋이 없습니다.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 기본 프리셋: 모든 할인 적용 */}
                  {discounts.length > 0 && (
                    <button
                      onClick={() => {
                        const allDiscountIds = discounts.map(d => String(d._id));
                        setSelectedDiscountIds(allDiscountIds);
                        setToast({ message: '🔥 모든 할인이 적용되었습니다. 최대 절약을 확인하세요!', type: 'success' });
                      }}
                      className="p-4 border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl hover:border-orange-500 hover:shadow-lg transition-all text-left"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🔥</span>
                        <span className="font-bold text-gray-900">모든 할인 최대 적용</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        사용 가능한 모든 할인을 적용하여 최대 절약 금액을 확인합니다
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {discounts.slice(0, 3).map(discount => (
                          <span key={String(discount._id)} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                            {DISCOUNT_CATEGORY_NAMES[discount.config.category]}
                          </span>
                        ))}
                        {discounts.length > 3 && (
                          <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded font-semibold">
                            +{discounts.length - 3}개
                          </span>
                        )}
                      </div>
                    </button>
                  )}

                  {/* 사용자 정의 프리셋 */}
                  {presets.map(preset => (
                    <button
                      key={String(preset._id)}
                      onClick={() => handleApplyPreset(preset)}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-[#7C3FBF] hover:bg-purple-50 transition-all text-left"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {preset.emoji && <span className="text-2xl">{preset.emoji}</span>}
                        <span className="font-bold text-gray-900">{preset.name}</span>
                      </div>
                      {preset.description && (
                        <p className="text-sm text-gray-600 mb-2">{preset.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {preset.discountIds?.slice(0, 3).map(discountId => (
                          <span key={String(discountId)} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                            {getDiscountName(String(discountId))}
                          </span>
                        ))}
                        {preset.discountIds && preset.discountIds.length > 3 && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            +{preset.discountIds.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 할인 선택 */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">할인 적용</h2>

              <div className="space-y-4">
                {Object.entries(groupedDiscounts).map(([category, categoryDiscounts]) => (
                  <div key={category}>
                    <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-4 bg-[#7C3FBF] rounded"></span>
                      {DISCOUNT_CATEGORY_NAMES[category as keyof typeof DISCOUNT_CATEGORY_NAMES] || category}
                    </h3>
                    <div className="space-y-2">
                      {categoryDiscounts.map(discount => {
                        const isSelected = selectedDiscountIds.includes(String(discount._id));
                        const discountAmount = getDiscountAmount(String(discount._id));
                        const isCoupon = discount.config.category === 'coupon';
                        const isSubscription = isCoupon && (discount.config as any).isSubscription;
                        const dailyLimit = isSubscription ? (discount.config as any).dailyUsageLimit : null;

                        return (
                          <div key={String(discount._id)} className="space-y-2">
                            <label
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-purple-50 border-2 border-purple-300'
                                  : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleDiscount(String(discount._id))}
                                className="w-5 h-5 text-[#7C3FBF] border-gray-300 rounded focus:ring-[#7C3FBF]"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{discount.name}</div>
                                {discount.description && (
                                  <div className="text-sm text-gray-600">{discount.description}</div>
                                )}
                              </div>
                              {isSelected && discountAmount > 0 && (
                                <div className="text-right">
                                  <div className="text-lg font-bold text-purple-600">
                                    -{discountAmount.toLocaleString()}원
                                  </div>
                                  {calculationResult?.data?.discountSteps && (
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {calculationResult.data.discountSteps
                                        .find(s => s.discountId === String(discount._id))
                                        ?.calculationDetails}
                                    </div>
                                  )}
                                </div>
                              )}
                            </label>

                            {/* 구독 할인일 경우 남은 한도 입력 */}
                            {isSelected && isSubscription && (
                              <div className="ml-10 flex items-center gap-2">
                                <label className="text-sm text-gray-600">오늘 남은 사용 가능 횟수:</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={dailyLimit}
                                  value={couponUsageLimits[String(discount._id)] ?? dailyLimit}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setCouponUsageLimits(prev => ({
                                      ...prev,
                                      [String(discount._id)]: Math.min(Math.max(0, value), dailyLimit)
                                    }));
                                  }}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-sm text-gray-500">/ {dailyLimit}회</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 결제수단 선택 */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">결제수단</h2>
              <select
                value={selectedPaymentMethod || ''}
                onChange={(e) => setSelectedPaymentMethod(e.target.value as PaymentMethod || undefined)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#7C3FBF] transition-colors"
              >
                <option value="">선택 안 함</option>
                {Object.entries(PAYMENT_METHOD_NAMES).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* 최종 계산 결과 */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-lg p-6 border-2 border-purple-200">
              {calculating ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-purple-200 border-t-[#7C3FBF] rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-gray-600">계산 중...</p>
                </div>
              ) : calculationResult?.success && calculationResult.data ? (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900">할인 계산 과정</h2>

                  <div className="space-y-3">
                    {/* 초기 금액 */}
                    <div className="flex justify-between items-center text-lg pb-3 border-b border-gray-200">
                      <span className="text-gray-700 font-medium">총 상품금액</span>
                      <span className="font-bold text-gray-900">
                        {calculationResult.data.totalOriginalPrice.toLocaleString()}원
                      </span>
                    </div>

                    {/* 할인 단계별 표시 */}
                    {calculationResult.data.discountSteps.map((step, idx) => (
                      <div key={idx} className="pl-4 border-l-2 border-purple-300">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex-1">
                            <div className="font-medium text-purple-700">- {step.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{step.calculationDetails}</div>

                            {/* 적용된 상품 목록 표시 */}
                            {step.appliedItems && step.appliedItems.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {step.appliedItems.map((item, itemIdx) => {
                                  const itemOriginalPrice = item.price * item.quantity;
                                  const itemFinalPrice = itemOriginalPrice - item.discountAmount;
                                  return (
                                    <div key={itemIdx} className="text-xs bg-purple-50 px-2 py-1.5 rounded">
                                      <div className="text-gray-700 font-medium mb-0.5">
                                        • {item.productName} ({item.price.toLocaleString()}원) × {item.quantity}개
                                      </div>
                                      <div className="text-gray-600 pl-3">
                                        {itemOriginalPrice.toLocaleString()}원 - {item.discountAmount.toLocaleString()}원 = <span className="text-purple-600 font-medium">{itemFinalPrice.toLocaleString()}원</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* 적용된 상품들의 원가 합계 */}
                                <div className="text-xs bg-purple-100 px-2 py-1.5 rounded">
                                  <div className="text-gray-700 font-medium mb-0.5">
                                    적용 상품 합계
                                  </div>
                                  <div className="text-gray-700 pl-3 font-medium">
                                    {step.appliedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}원 - {step.amount.toLocaleString()}원 = <span className="text-purple-700 font-bold">{(step.appliedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) - step.amount).toLocaleString()}원</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-bold text-purple-600">-{step.amount.toLocaleString()}원</div>
                          </div>
                        </div>
                        <div className="flex justify-end text-sm text-gray-600 mt-1">
                          → {step.afterAmount.toLocaleString()}원
                        </div>
                      </div>
                    ))}

                    {/* 최종 금액 */}
                    <div className="border-t-2 border-purple-400 pt-4 mt-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-2xl font-bold text-[#7C3FBF]">최종 결제금액</span>
                          {calculationResult.data.totalDiscountRate > 0 && (
                            <p className="text-sm text-green-600 font-medium mt-1">
                              총 {calculationResult.data.totalDiscount.toLocaleString()}원 할인 ({(calculationResult.data.totalDiscountRate * 100).toFixed(1)}% 절약!)
                            </p>
                          )}
                        </div>
                        <span className="text-4xl font-bold text-[#7C3FBF]">
                          {calculationResult.data.totalFinalPrice.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : calculationResult?.error ? (
                <div className="text-center py-8">
                  <p className="text-red-600 font-medium mb-2">계산 오류</p>
                  <p className="text-sm text-gray-600">{calculationResult.error}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900">결제 금액</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between text-lg">
                      <span className="text-gray-700">총 상품금액</span>
                      <span className="font-bold text-gray-900">
                        {cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}원
                      </span>
                    </div>
                    <div className="border-t-2 border-purple-300 pt-4 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-[#7C3FBF]">최종 결제금액</span>
                        <span className="text-4xl font-bold text-[#7C3FBF]">
                          {cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedDiscountIds.length === 0 && !selectedPaymentMethod && (
                    <p className="text-sm text-gray-600 text-center mt-4">
                      할인이나 결제수단을 선택하면 자동으로 계산됩니다
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* 상품 상세 모달 */}
      {selectedItemIndex !== null && cart.items[selectedItemIndex] && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedItemIndex(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => setSelectedItemIndex(null)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 이전/다음 버튼 */}
            {selectedItemIndex > 0 && (
              <button
                onClick={handlePrevItem}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white shadow-lg rounded-full hover:bg-gray-50 transition-colors z-10"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {selectedItemIndex < cart.items.length - 1 && (
              <button
                onClick={handleNextItem}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white shadow-lg rounded-full hover:bg-gray-50 transition-colors z-10"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            <div className="p-6">
              {/* 이미지/바코드 전환 영역 */}
              <div
                onClick={() => setShowBarcode(!showBarcode)}
                className="w-full aspect-square mb-6 overflow-hidden rounded-xl bg-gray-100 cursor-pointer relative group"
              >
                {showBarcode ? (
                  // 바코드 표시
                  <div className="w-full h-full flex flex-col items-center justify-center p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-4">바코드를 스캔하세요</p>
                    <Barcode
                      value={cart.items[selectedItemIndex].barcode}
                      width={2}
                      height={80}
                      fontSize={16}
                      background="#f9fafb"
                    />
                    <p className="text-xs text-gray-500 mt-4">탭하여 상품 이미지 보기</p>
                  </div>
                ) : (
                  // 상품 이미지 표시
                  <div className="w-full h-full relative">
                    {cart.items[selectedItemIndex].imageUrl ? (
                      <img
                        src={cart.items[selectedItemIndex].imageUrl}
                        alt={cart.items[selectedItemIndex].name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/400x400?text=No+Image';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                        <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                      <p className="text-xs text-white text-center">탭하여 바코드 보기</p>
                    </div>
                  </div>
                )}

                {/* 전환 인디케이터 */}
                <div className="absolute top-3 right-3 flex gap-1">
                  <div className={`w-2 h-2 rounded-full transition-colors ${showBarcode ? 'bg-purple-600' : 'bg-white/50'}`} />
                  <div className={`w-2 h-2 rounded-full transition-colors ${!showBarcode ? 'bg-purple-600' : 'bg-white/50'}`} />
                </div>
              </div>

              {/* 상품 정보 */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {cart.items[selectedItemIndex].name}
                  </h2>
                  <p className="text-xl font-bold text-purple-600">
                    {cart.items[selectedItemIndex].price.toLocaleString()}원
                  </p>
                </div>

                {/* 바코드 번호 */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">바코드 번호</p>
                  <p className="font-mono font-bold text-gray-900">
                    {cart.items[selectedItemIndex].barcode}
                  </p>
                </div>

                {/* 카테고리 */}
                {cart.items[selectedItemIndex].categoryTags?.[0]?.name && (
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">카테고리</p>
                    <p className="font-semibold text-purple-700">
                      {cart.items[selectedItemIndex].categoryTags[0].name}
                    </p>
                  </div>
                )}

                {/* 카테고리 태그 */}
                {cart.items[selectedItemIndex].categoryTags && cart.items[selectedItemIndex].categoryTags!.length > 0 && (
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-2">카테고리 태그</p>
                    <div className="flex flex-wrap gap-2">
                      {cart.items[selectedItemIndex].categoryTags!.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 수량 조절 */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-3">수량</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleUpdateQuantity(cart.items[selectedItemIndex].barcode, cart.items[selectedItemIndex].quantity - 1)}
                        className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-100 rounded-lg font-bold text-xl transition-colors shadow-sm"
                      >
                        -
                      </button>
                      <span className="w-16 text-center font-bold text-2xl">
                        {cart.items[selectedItemIndex].quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(cart.items[selectedItemIndex].barcode, cart.items[selectedItemIndex].quantity + 1)}
                        className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-100 rounded-lg font-bold text-xl transition-colors shadow-sm"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">소계</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {(cart.items[selectedItemIndex].price * cart.items[selectedItemIndex].quantity).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={() => {
                    handleRemoveItem(cart.items[selectedItemIndex].barcode);
                    setSelectedItemIndex(null);
                  }}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
                >
                  장바구니에서 삭제
                </button>
              </div>

              {/* 인디케이터 */}
              <div className="flex justify-center gap-2 mt-6">
                {cart.items.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === selectedItemIndex
                        ? 'bg-purple-600 w-6'
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              {/* 스와이프 안내 */}
              <p className="text-center text-sm text-gray-500 mt-4">
                좌우로 스와이프하여 다른 상품 보기
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 바코드 스캐너 모달 */}
      <BarcodeScannerModal
        isOpen={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        onScan={handleBarcodeScan}
        cartId={id}
      />

      {/* 토스트 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
