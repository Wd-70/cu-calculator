'use client';

import { useState } from 'react';
import { IDiscountRule, DiscountApplicationStep } from '@/types/discount';

interface DiscountResultProps {
  isCalculating: boolean;
  originalPrice: number;
  finalPrice: number;
  totalDiscount: number;
  totalDiscountRate: number;
  appliedDiscounts: {
    discountId: string;
    discountName: string;
    discountAmount: number;
    category: string;
    steps?: DiscountApplicationStep[]; // 상세 계산 과정
    baseAmount?: number; // 기준 금액
  }[];
  warnings?: string[];
  onRecalculate?: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  promotion: { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700' },
  subscription: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  payment_method: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
  telecom: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  membership: { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  card_benefit: { bg: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
  coupon: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
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

export default function DiscountResult({
  isCalculating,
  originalPrice,
  finalPrice,
  totalDiscount,
  totalDiscountRate,
  appliedDiscounts,
  warnings,
  onRecalculate,
}: DiscountResultProps) {
  const [expandedDiscountIndex, setExpandedDiscountIndex] = useState<number | null>(null);

  if (isCalculating) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-600">최적의 할인 조합을 찾는 중...</div>
        </div>
      </div>
    );
  }

  if (originalPrice === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">💰</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">할인 계산 결과</h3>
        <p className="text-sm text-gray-500">상품을 추가하고 프리셋을 선택하면<br />최적의 할인이 자동으로 계산됩니다.</p>
      </div>
    );
  }

  const savings = totalDiscount;
  const savingsRate = (totalDiscountRate * 100).toFixed(1);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div className="p-4 bg-white/50 border-b border-purple-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">할인 계산 결과</h3>
        {onRecalculate && (
          <button
            onClick={onRecalculate}
            className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            재계산
          </button>
        )}
      </div>

      {/* 가격 정보 */}
      <div className="p-6">
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">원가</span>
            <span className="font-medium text-gray-900">{originalPrice.toLocaleString()}원</span>
          </div>

          {savings > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">할인</span>
              <span className="font-medium text-red-600">-{savings.toLocaleString()}원</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t-2 border-purple-300">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">최종 금액</div>
              <div className="text-3xl font-bold text-purple-600">
                {finalPrice.toLocaleString()}
                <span className="text-lg ml-1">원</span>
              </div>
            </div>
            {savings > 0 && (
              <div className="text-right">
                <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                  {savingsRate}% 절약
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {savings.toLocaleString()}원 할인
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 적용된 할인 목록 */}
      {appliedDiscounts.length > 0 && (
        <div className="px-6 pb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">적용된 할인</h4>
          <div className="space-y-2">
            {appliedDiscounts.map((discount, index) => {
              const colorScheme = CATEGORY_COLORS[discount.category] || CATEGORY_COLORS.coupon;
              const categoryName = CATEGORY_NAMES[discount.category] || '기타';
              const isExpanded = expandedDiscountIndex === index;

              return (
                <div
                  key={`${discount.discountId}-${index}`}
                  className={`${colorScheme.bg} border border-${discount.category === 'promotion' ? 'pink' : discount.category === 'subscription' ? 'blue' : 'purple'}-200 rounded-lg overflow-hidden transition-all`}
                >
                  {/* 할인 헤더 (클릭 가능) */}
                  <div
                    onClick={() => setExpandedDiscountIndex(isExpanded ? null : index)}
                    className="p-3 cursor-pointer hover:bg-opacity-70 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${colorScheme.badge} font-medium`}>
                            {categoryName}
                          </span>
                          <span className={`text-sm font-medium ${colorScheme.text} truncate`}>
                            {discount.discountName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`text-sm font-semibold ${colorScheme.text}`}>
                          -{discount.discountAmount.toLocaleString()}원
                        </div>
                        <svg
                          className={`w-4 h-4 ${colorScheme.text} transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 할인 상세 내용 (펼쳐지는 부분) */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-gray-200 bg-white bg-opacity-50">
                      <div className="space-y-3 mt-3">
                        {/* 기준 금액 정보 */}
                        {discount.baseAmount !== undefined && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="text-xs text-gray-600 mb-1">기준 금액</div>
                            <div className="text-lg font-bold text-gray-900">
                              {discount.baseAmount.toLocaleString()}원
                            </div>
                          </div>
                        )}

                        {/* 계산 과정 - 상품별 그룹화 */}
                        {discount.steps && discount.steps.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-700 mb-2">
                              계산 상세 ({discount.steps.length}개 상품)
                            </h5>
                            <div className="space-y-2">
                              {discount.steps.map((step, stepIndex) => (
                                <div key={stepIndex} className="bg-white rounded-lg p-3 border border-gray-200 text-xs">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900 mb-1">
                                        상품 #{stepIndex + 1}
                                      </div>
                                      {step.calculationDetails && (
                                        <div className="text-gray-600 text-xs">
                                          {step.calculationDetails}
                                        </div>
                                      )}
                                    </div>
                                    <span className="font-semibold text-red-600">
                                      -{step.discountAmount.toLocaleString()}원
                                    </span>
                                  </div>

                                  {step.baseAmount !== undefined && (
                                    <div className="text-gray-500 space-y-1 bg-gray-50 rounded p-2 mt-2">
                                      <div className="flex justify-between">
                                        <span>기준 금액:</span>
                                        <span className="font-medium">{step.baseAmount.toLocaleString()}원</span>
                                      </div>
                                      {step.amountAfterDiscount !== undefined && (
                                        <div className="flex justify-between">
                                          <span>할인 후:</span>
                                          <span className="font-medium">{step.amountAfterDiscount.toLocaleString()}원</span>
                                        </div>
                                      )}
                                      {step.isOriginalPriceBased !== undefined && (
                                        <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200">
                                          <span>계산 방식:</span>
                                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                            step.isOriginalPriceBased
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-green-100 text-green-700'
                                          }`}>
                                            {step.isOriginalPriceBased ? '원가 기준' : '프로모션 적용 후'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* 상품별 합계 설명 */}
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                              💡 각 상품에 개별 적용된 할인을 모두 합산한 금액입니다
                            </div>
                          </div>
                        )}

                        {/* 할인 요약 */}
                        <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-3 border border-red-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">총 할인 금액</span>
                            <span className="text-base font-bold text-red-600">
                              -{discount.discountAmount.toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 경고 메시지 */}
      {warnings && warnings.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h5 className="text-sm font-semibold text-yellow-900 mb-1">주의사항</h5>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 할인 없음 안내 */}
      {appliedDiscounts.length === 0 && originalPrice > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">💡</div>
            <p className="text-sm text-gray-600">
              적용 가능한 할인이 없습니다.<br />
              프리셋에 결제수단이나 구독을 등록해보세요!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
