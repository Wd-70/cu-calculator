'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import * as clientDb from '@/lib/clientDb';
import { ICart, ICartItem, CART_COLORS } from '@/types/cart';
import { IDiscountRule, DISCOUNT_CATEGORY_NAMES } from '@/types/discount';
import { IPreset } from '@/types/preset';
import { PaymentMethod, PAYMENT_METHOD_NAMES } from '@/types/payment';
import Toast from '@/components/Toast';
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

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 클라이언트 데이터
      const localCart = clientDb.getCart(id);
      setCart(localCart);
      setSelectedPaymentMethod(localCart?.paymentMethod);

      const localPresets = clientDb.getPresets();
      setPresets(localPresets);

      // 서버 데이터 (할인 목록)
      const discountsRes = await fetch('/api/discounts');
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
    setSelectedDiscountIds(preset.discountIds.map(String));
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/carts" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              {cart.emoji && <span className="text-3xl">{cart.emoji}</span>}
              <div>
                <h1 className="text-xl font-bold text-gray-900">{cart.name || '이름 없는 카트'}</h1>
                {cart.isMain && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">⭐ 메인</span>
                )}
              </div>
            </div>
            <Link
              href="/products"
              className="px-4 py-2 bg-[#7C3FBF] text-white rounded-lg font-semibold hover:bg-[#6B2FAF] transition-colors"
            >
              상품 추가
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
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
              {cart.items.map((item) => (
                <div key={item.barcode} className="border border-gray-200 rounded-xl p-4 relative">
                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleRemoveItem(item.barcode)}
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="flex items-start gap-4 pr-8">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">{item.name}</h3>
                      <p className="text-sm text-gray-500 mb-2">{item.price.toLocaleString()}원</p>
                      {item.category && (
                        <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                          {item.category}
                        </span>
                      )}
                    </div>

                    {/* 수량 조절 */}
                    <div className="flex items-center gap-2">
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
                      <p className="font-bold text-gray-900">{(item.price * item.quantity).toLocaleString()}원</p>
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
            {presets.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">프리셋 선택</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        {preset.discountIds.slice(0, 3).map(discountId => (
                          <span key={String(discountId)} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                            {getDiscountName(String(discountId))}
                          </span>
                        ))}
                        {preset.discountIds.length > 3 && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            +{preset.discountIds.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
