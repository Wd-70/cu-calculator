'use client';

import { useState } from 'react';
import { signWithTimestamp } from '@/lib/userAuth';

interface ValidationIssue {
  type: 'duplicate' | 'subset' | 'superset';
  promotion1: any;
  promotion2: any;
  description: string;
}

interface PromotionValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string | null;
}

export default function PromotionValidationModal({
  isOpen,
  onClose,
  userAddress,
}: PromotionValidationModalProps) {
  const [targetDate, setTargetDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [validating, setValidating] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [totalPromotions, setTotalPromotions] = useState(0);
  const [validated, setValidated] = useState(false);
  const [rebuildStats, setRebuildStats] = useState<any>(null);

  const handleValidate = async () => {
    if (!userAddress) {
      alert('지갑 연결이 필요합니다.');
      return;
    }

    setValidating(true);
    setValidated(false);
    setRebuildStats(null);

    try {
      const { signature, timestamp } = await signWithTimestamp({
        action: 'validate_promotions',
        targetDate,
      });

      const response = await fetch('/api/admin/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate,
          signature,
          timestamp,
          address: userAddress,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIssues(data.issues);
        setTotalPromotions(data.totalPromotions);
        setValidated(true);
        alert(`검증 완료!\n전체 ${data.totalPromotions}개 프로모션 중 ${data.issues.length}개 문제 발견`);
      } else {
        alert(`오류: ${data.error}`);
      }
    } catch (error) {
      console.error('Validation error:', error);
      alert('검증 중 오류가 발생했습니다.');
    } finally {
      setValidating(false);
    }
  };

  const handleRebuildIndex = async () => {
    if (!userAddress) {
      alert('지갑 연결이 필요합니다.');
      return;
    }

    if (!confirm(`${targetDate} 기준으로 PromotionIndex를 재구축하시겠습니까?\n\n기존 인덱스는 모두 삭제되고 해당 날짜에 활성화된 프로모션만 인덱싱됩니다.`)) {
      return;
    }

    setRebuilding(true);

    try {
      const { signature, timestamp } = await signWithTimestamp({
        action: 'rebuild_promotion_index',
        targetDate,
      });

      const response = await fetch('/api/admin/promotions/rebuild-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate,
          signature,
          timestamp,
          address: userAddress,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRebuildStats(data.stats);
        alert(`PromotionIndex 재구축 완료!\n\n처리된 프로모션: ${data.stats.promotionsProcessed}개\n인덱싱된 바코드: ${data.stats.barcodesIndexed}개`);
      } else {
        alert(`오류: ${data.error}`);
      }
    } catch (error) {
      console.error('Rebuild error:', error);
      alert('인덱스 재구축 중 오류가 발생했습니다.');
    } finally {
      setRebuilding(false);
    }
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'duplicate':
        return '⚠️';
      case 'subset':
        return '⊂';
      case 'superset':
        return '⊃';
      default:
        return '❓';
    }
  };

  const getIssueColor = (type: string) => {
    switch (type) {
      case 'duplicate':
        return 'border-red-300 bg-red-50';
      case 'subset':
        return 'border-yellow-300 bg-yellow-50';
      case 'superset':
        return 'border-blue-300 bg-blue-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const formatDate = (dateStr: string | Date) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">🔍 프로모션 무결성 검증</h2>
              <p className="text-red-100 text-sm">
                중복되거나 포함 관계에 있는 프로모션을 찾아 데이터 무결성을 유지합니다
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 검증 설정 */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">검증 설정</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                기준 날짜 선택
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <div className="text-xs text-gray-500 mt-1">
                💡 선택한 날짜에 활성화된 프로모션들을 검증합니다
              </div>
            </div>

            <button
              onClick={handleValidate}
              disabled={validating || !targetDate}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {validating ? '검증 중...' : '검증 시작'}
            </button>
          </div>

          {/* 검증 결과 */}
          {validated && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-blue-900 mb-1">
                      📊 검증 결과 ({formatDate(targetDate)} 기준)
                    </h4>
                    <p className="text-sm text-blue-700">
                      전체 {totalPromotions}개 프로모션 중 {issues.length}개 문제 발견
                    </p>
                  </div>
                  {issues.length === 0 && (
                    <div className="text-green-600 text-2xl">✅</div>
                  )}
                </div>
              </div>

              {/* 문제 목록 */}
              {issues.length > 0 ? (
                <div className="space-y-3 mb-6">
                  <h4 className="font-bold text-gray-900">발견된 문제:</h4>
                  {issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`border-2 rounded-xl p-4 ${getIssueColor(issue.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">
                          {getIssueIcon(issue.type)}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-2">
                            {issue.description}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-white rounded-lg p-3">
                              <div className="font-medium text-gray-700 mb-1">
                                프로모션 1:
                              </div>
                              <div className="text-gray-900 font-semibold">
                                {issue.promotion1.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {formatDate(issue.promotion1.validFrom)} ~ {formatDate(issue.promotion1.validTo)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                상품 {issue.promotion1.applicableProducts?.length || 0}개
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-3">
                              <div className="font-medium text-gray-700 mb-1">
                                프로모션 2:
                              </div>
                              <div className="text-gray-900 font-semibold">
                                {issue.promotion2.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {formatDate(issue.promotion2.validFrom)} ~ {formatDate(issue.promotion2.validTo)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                상품 {issue.promotion2.applicableProducts?.length || 0}개
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 text-center">
                  <div className="text-4xl mb-2">✨</div>
                  <div className="font-bold text-green-900 mb-1">
                    문제가 발견되지 않았습니다!
                  </div>
                  <div className="text-sm text-green-700">
                    모든 프로모션이 정상적으로 관리되고 있습니다.
                  </div>
                </div>
              )}

              {/* PromotionIndex 재구축 */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <h4 className="font-bold text-orange-900 mb-2">
                  🔧 PromotionIndex 재구축
                </h4>
                <p className="text-sm text-orange-700 mb-4">
                  선택한 날짜({formatDate(targetDate)})를 기준으로 역인덱스를 재구축합니다.
                  기존 인덱스는 모두 삭제되고 해당 날짜에 활성화된 프로모션만 인덱싱됩니다.
                </p>

                {rebuildStats && (
                  <div className="bg-white rounded-lg p-3 mb-4 border border-orange-200">
                    <div className="font-semibold text-green-700 mb-2">✅ 재구축 완료</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>• 처리된 프로모션: {rebuildStats.promotionsProcessed}개</div>
                      <div>• 인덱싱된 바코드: {rebuildStats.barcodesIndexed}개</div>
                      <div>• 기준일: {formatDate(rebuildStats.targetDate)}</div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleRebuildIndex}
                  disabled={rebuilding}
                  className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {rebuilding ? '재구축 중...' : 'PromotionIndex 재구축'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
