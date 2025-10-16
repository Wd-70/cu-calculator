'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IDiscountRule, DISCOUNT_CATEGORY_NAMES } from '@/types/discount';

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<IDiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/discounts');
      const data = await response.json();
      if (data.success) {
        setDiscounts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch discounts:', error);
    } finally {
      setLoading(false);
    }
  };

  // 카테고리별 필터링
  const filteredDiscounts = selectedCategory === 'all'
    ? discounts
    : discounts.filter(d => d.config.category === selectedCategory);

  // 카테고리별 그룹화
  const groupedDiscounts = filteredDiscounts.reduce((acc, discount) => {
    const category = discount.config.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(discount);
    return acc;
  }, {} as Record<string, IDiscountRule[]>);

  // 카테고리 색상 매핑
  const categoryColors: Record<string, { bg: string; text: string; badge: string }> = {
    coupon: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
    telecom: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
    payment_event: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100' },
    voucher: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100' },
    payment_instant: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100' },
    payment_compound: { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100' },
  };

  // 할인 값 표시 함수
  const getDiscountValue = (discount: IDiscountRule): string => {
    const config = discount.config;

    switch (config.category) {
      case 'coupon':
        if (config.isSubscription) {
          return `${config.percentage}% 할인`;
        }
        return `${config.percentage}% 할인`;
      case 'telecom':
        if (config.valueType === 'percentage') {
          return `${config.percentage}% 할인`;
        }
        return `${config.tierUnit}원당 ${config.tierAmount}원 할인`;
      case 'payment_event':
        if (config.valueType === 'percentage') {
          return `${config.percentage}% 할인`;
        }
        return `${config.fixedAmount?.toLocaleString()}원 할인`;
      case 'voucher':
        return `${config.amount.toLocaleString()}원권`;
      case 'payment_instant':
      case 'payment_compound':
        return `${config.percentage}% 할인`;
      default:
        return '할인';
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="w-12 h-12 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-lg">
                CU
              </Link>
              <div>
                <h1 className="text-gray-900 font-bold text-xl">할인 정보</h1>
                <p className="text-gray-500 text-xs">진행 중인 모든 할인</p>
              </div>
            </div>
            <Link
              href="/"
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              ← 홈으로
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* 히어로 섹션 */}
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-2 bg-red-50 rounded-full mb-4">
            <span className="text-[#FF3B3B] font-semibold text-sm">🔥 이번 달 할인 행사</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            지금 사용 가능한
            <br />
            <span className="text-[#FF3B3B]">모든 할인</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            CU에서 진행 중인 6가지 카테고리의 할인을 확인하고 최대로 절약하세요!
          </p>
        </div>

        {/* 카테고리 필터 */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-6 py-3 rounded-full font-semibold transition-all ${
                selectedCategory === 'all'
                  ? 'bg-gray-900 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전체 ({discounts.length})
            </button>
            {Object.entries(DISCOUNT_CATEGORY_NAMES).map(([key, name]) => {
              const count = discounts.filter(d => d.config.category === key).length;
              if (count === 0) return null;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-6 py-3 rounded-full font-semibold transition-all whitespace-nowrap ${
                    selectedCategory === key
                      ? `${categoryColors[key].badge} ${categoryColors[key].text} shadow-lg`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#7C3FBF] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">할인 정보를 불러오는 중...</p>
          </div>
        )}

        {/* 할인 없음 */}
        {!loading && discounts.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">등록된 할인이 없습니다</h3>
            <p className="text-gray-600 mb-6">테스트 페이지에서 샘플 데이터를 생성해보세요.</p>
            <Link
              href="/test"
              className="inline-block px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors"
            >
              테스트 페이지로 이동
            </Link>
          </div>
        )}

        {/* 할인 목록 */}
        {!loading && filteredDiscounts.length > 0 && (
          <div className="space-y-12">
            {Object.entries(groupedDiscounts).map(([category, categoryDiscounts]) => {
              const colors = categoryColors[category];
              const categoryName = DISCOUNT_CATEGORY_NAMES[category as keyof typeof DISCOUNT_CATEGORY_NAMES];

              return (
                <div key={category}>
                  {/* 카테고리 헤더 */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`px-4 py-2 ${colors.badge} rounded-xl`}>
                      <span className={`${colors.text} font-bold text-lg`}>
                        {categoryName}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-gray-200"></div>
                  </div>

                  {/* 할인 카드 그리드 */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoryDiscounts.map((discount) => (
                      <div
                        key={String(discount._id)}
                        className={`${colors.bg} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1`}
                      >
                        {/* 할인 타이틀 */}
                        <div className="mb-4">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {discount.name}
                          </h3>
                          {discount.description && (
                            <p className="text-sm text-gray-600">
                              {discount.description}
                            </p>
                          )}
                        </div>

                        {/* 할인 값 */}
                        <div className={`${colors.badge} rounded-xl px-4 py-3 mb-4`}>
                          <div className={`text-2xl font-bold ${colors.text}`}>
                            {getDiscountValue(discount)}
                          </div>
                        </div>

                        {/* 추가 정보 */}
                        <div className="space-y-2 text-sm">
                          {/* 구독 정보 */}
                          {discount.config.category === 'coupon' && discount.config.isSubscription && (
                            <>
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500">구독료:</span>
                                <span className="text-gray-700 font-medium">
                                  월 {discount.config.subscriptionCost?.toLocaleString()}원
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500">사용제한:</span>
                                <span className="text-gray-700 font-medium">
                                  하루 {discount.config.dailyUsageLimit}회 / 월 {discount.config.totalUsageLimit}회
                                </span>
                              </div>
                            </>
                          )}

                          {/* 적용 카테고리 */}
                          {discount.applicableCategories.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-500">대상:</span>
                              <span className="text-gray-700 font-medium">
                                {discount.applicableCategories.join(', ')}
                              </span>
                            </div>
                          )}

                          {/* 최소 구매 금액 */}
                          {discount.minPurchaseAmount && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-500">최소:</span>
                              <span className="text-gray-700 font-medium">
                                {discount.minPurchaseAmount.toLocaleString()}원 이상
                              </span>
                            </div>
                          )}

                          {/* 결제수단 */}
                          {discount.paymentMethodNames.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-500">결제:</span>
                              <span className="text-gray-700 font-medium">
                                {discount.paymentMethodNames.join(', ')}
                              </span>
                            </div>
                          )}

                          {/* 유효기간 */}
                          <div className="flex items-start gap-2 text-xs text-gray-500">
                            <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>
                              {new Date(discount.validFrom).toLocaleDateString()} ~ {new Date(discount.validTo).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 필터링 결과 없음 */}
        {!loading && discounts.length > 0 && filteredDiscounts.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">해당 카테고리에 할인이 없습니다</h3>
            <p className="text-gray-600">다른 카테고리를 선택해보세요.</p>
          </div>
        )}

        {/* 안내 박스 */}
        {!loading && discounts.length > 0 && (
          <div className="mt-12 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">💡 할인 활용 팁</h3>
            <div className="grid md:grid-cols-2 gap-4 text-gray-700">
              <div className="flex gap-3">
                <span className="text-2xl">1️⃣</span>
                <div>
                  <strong>구독</strong>은 정가 기준으로 계산되어 가장 먼저 적용됩니다.
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">2️⃣</span>
                <div>
                  <strong>통신사 할인</strong>과 멤버십 할인은 조합 가능 여부를 확인하세요.
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">3️⃣</span>
                <div>
                  <strong>금액권</strong>과 <strong>즉시할인 카드</strong>는 함께 사용할 수 없습니다.
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">4️⃣</span>
                <div>
                  최대 할인을 위해 장바구니에서 다양한 조합을 시도해보세요!
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-50 border-t border-gray-200 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© 2025 CU 할인계산기. Made with 💜 for smart shoppers.</p>
        </div>
      </footer>
    </div>
  );
}
