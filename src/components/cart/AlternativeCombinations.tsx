'use client';

import { useState } from 'react';
import { DiscountCombination } from '@/lib/utils/discountOptimizer';
import { IPreset } from '@/types/preset';

interface AlternativeCombinationsProps {
  alternatives: DiscountCombination[];
  discountMap: Map<string, { name: string; category: string }>;
  currentPreset?: IPreset | null;
  onSelectCombination?: (combination: DiscountCombination) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  promotion: 'bg-pink-100 text-pink-700',
  subscription: 'bg-blue-100 text-blue-700',
  payment_method: 'bg-green-100 text-green-700',
  telecom: 'bg-purple-100 text-purple-700',
  membership: 'bg-yellow-100 text-yellow-700',
  card_benefit: 'bg-indigo-100 text-indigo-700',
  coupon: 'bg-orange-100 text-orange-700',
};

const CATEGORY_NAMES: Record<string, string> = {
  promotion: '프로모션',
  subscription: '구독',
  payment_method: '결제수단',
  telecom: '통신사',
  membership: '멤버십',
  card_benefit: '카드',
  coupon: '쿠폰',
};

export default function AlternativeCombinations({
  alternatives,
  discountMap,
  currentPreset,
  onSelectCombination,
}: AlternativeCombinationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (alternatives.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700">
            대안 할인 조합 ({alternatives.length}개)
          </h3>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="space-y-3">
            {alternatives.map((combination, index) => {
              const savingsRate = (combination.totalDiscountRate * 100).toFixed(1);
              const discounts = combination.discountIds.map(id => discountMap.get(id)).filter(Boolean);

              return (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 mb-1">
                        조합 {index + 1}
                      </div>
                      <div className="text-xs text-gray-500">
                        {discounts.length}개 할인 적용
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-purple-600">
                        {combination.finalPrice.toLocaleString()}원
                      </div>
                      <div className="text-xs text-gray-500">
                        -{combination.totalDiscount.toLocaleString()}원 ({savingsRate}%)
                      </div>
                    </div>
                  </div>

                  {/* 할인 목록 */}
                  {discounts.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {discounts.map((discount, idx) => {
                        if (!discount) return null;
                        const colorClass = CATEGORY_COLORS[discount.category] || CATEGORY_COLORS.coupon;
                        const categoryName = CATEGORY_NAMES[discount.category] || '기타';

                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded font-medium ${colorClass}`}>
                              {categoryName}
                            </span>
                            <span className="text-gray-700 truncate">{discount.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 필요한 조건 표시 - 사용자가 가지고 있지 않은 결제수단/구독만 표시 */}
                  {combination.discountBreakdown && combination.discountBreakdown.length > 0 && (
                    (() => {
                      const requirements: string[] = [];

                      // 현재 프리셋의 결제수단/구독 확인
                      const hasPaymentMethod = currentPreset?.paymentMethods && currentPreset.paymentMethods.length > 0;
                      const currentPaymentMethods = new Set(currentPreset?.paymentMethods?.map(pm => pm.type) || []);
                      const currentSubscriptions = new Set(currentPreset?.subscriptions || []);

                      combination.discountBreakdown.forEach((breakdown) => {
                        // 프로모션은 제외 (조건만 맞으면 자동 적용)
                        if (breakdown.category === 'promotion') {
                          return;
                        }

                        // 구독 - 현재 가지고 있지 않은 것만
                        if (breakdown.category === 'subscription') {
                          const reqText = `구독: ${breakdown.discountName}`;
                          // TODO: discountId나 이름으로 매칭 필요 (현재는 모두 표시)
                          if (!requirements.includes(reqText)) {
                            requirements.push(reqText);
                          }
                        }
                        // 결제수단 - 현재 가지고 있지 않은 것만
                        else if (breakdown.category === 'payment_method') {
                          const reqText = `결제수단: ${breakdown.discountName}`;
                          // TODO: 결제수단 타입 매칭 필요 (현재는 모두 표시)
                          if (!requirements.includes(reqText)) {
                            requirements.push(reqText);
                          }
                        }
                        // 카드 혜택
                        else if (breakdown.category === 'card_benefit') {
                          const reqText = `카드: ${breakdown.discountName}`;
                          if (!requirements.includes(reqText)) {
                            requirements.push(reqText);
                          }
                        }
                        // 통신사
                        else if (breakdown.category === 'telecom') {
                          const reqText = `통신사: ${breakdown.discountName}`;
                          if (!requirements.includes(reqText)) {
                            requirements.push(reqText);
                          }
                        }
                        // 멤버십
                        else if (breakdown.category === 'membership') {
                          const reqText = `멤버십: ${breakdown.discountName}`;
                          if (!requirements.includes(reqText)) {
                            requirements.push(reqText);
                          }
                        }
                      });

                      if (requirements.length > 0) {
                        return (
                          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                            <div className="font-medium text-blue-900 mb-1">✅ 필요한 조건</div>
                            <ul className="text-blue-700 space-y-0.5">
                              {requirements.map((req, idx) => (
                                <li key={idx}>• {req}</li>
                              ))}
                            </ul>
                            <div className="mt-1 pt-1 border-t border-blue-300 text-blue-600">
                              💡 프리셋에 등록하면 이 조합을 사용할 수 있습니다
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}

                  {/* 선택 버튼 */}
                  {onSelectCombination && (
                    <button
                      onClick={() => onSelectCombination(combination)}
                      className="w-full py-2 px-4 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                    >
                      이 조합 적용하기
                    </button>
                  )}

                  {/* 가격 비교 */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>원가 {combination.originalPrice.toLocaleString()}원</span>
                    <span className="text-red-600 font-medium">
                      {combination.totalDiscount > 0 ? `${savingsRate}% 절약` : '할인 없음'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <div className="font-medium mb-1">💡 대안 조합 활용하기</div>
            <p>
              최적 조합 외에도 비슷한 할인 효과를 가진 다른 조합들입니다.
              각 조합에 표시된 "필요한 조건"을 확인하여 추가 결제수단이나 구독을 등록하면 더 많이 절약할 수 있습니다!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
