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
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onRefresh?: () => void;
}

export default function PromotionValidationModal({
  isOpen,
  onClose,
  userAddress,
  onShowToast,
  onRefresh,
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
  const [processingIssue, setProcessingIssue] = useState<number | null>(null);
  const [selectedPromotions, setSelectedPromotions] = useState<Map<number, '1' | '2'>>(new Map());

  const handleValidate = async () => {
    if (!userAddress) {
      onShowToast('지갑 연결이 필요합니다.', 'error');
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
        setSelectedPromotions(new Map()); // 선택 초기화
        if (data.issues.length === 0) {
          onShowToast(`✅ 검증 완료! 전체 ${data.totalPromotions}개 프로모션 - 문제 없음`, 'success');
        } else {
          onShowToast(`⚠️ 검증 완료! 전체 ${data.totalPromotions}개 프로모션 중 ${data.issues.length}개 문제 발견`, 'info');
        }
      } else {
        onShowToast(`오류: ${data.error}`, 'error');
      }
    } catch (error) {
      console.error('Validation error:', error);
      onShowToast('검증 중 오류가 발생했습니다.', 'error');
    } finally {
      setValidating(false);
    }
  };

  const handleFixIssue = async (issueIndex: number) => {
    if (!userAddress) {
      onShowToast('지갑 연결이 필요합니다.', 'error');
      return;
    }

    const selected = selectedPromotions.get(issueIndex);
    if (!selected) {
      onShowToast('프로모션을 선택해주세요.', 'error');
      return;
    }

    const issue = issues[issueIndex];
    const selectedPromo = selected === '1' ? issue.promotion1 : issue.promotion2;
    const otherPromo = selected === '1' ? issue.promotion2 : issue.promotion1;

    setProcessingIssue(issueIndex);

    try {
      // 로직 결정
      let action: 'delete' | 'modify' = 'delete';
      let targetPromo = selectedPromo;
      let newProducts: string[] = [];

      if (issue.type === 'duplicate') {
        // 중복: 선택한 것 삭제
        action = 'delete';
      } else if (issue.type === 'subset') {
        // promotion1이 promotion2에 포함됨
        if (selected === '1') {
          // promotion1 선택 → 삭제
          action = 'delete';
        } else {
          // promotion2 선택 → promotion2에서 promotion1의 상품들 제거
          action = 'modify';
          const products1Set = new Set(issue.promotion1.applicableProducts);
          newProducts = issue.promotion2.applicableProducts.filter((p: string) => !products1Set.has(p));
        }
      } else if (issue.type === 'superset') {
        // promotion1이 promotion2를 포함
        if (selected === '1') {
          // promotion1 선택 → promotion1에서 promotion2의 상품들 제거
          action = 'modify';
          const products2Set = new Set(issue.promotion2.applicableProducts);
          newProducts = issue.promotion1.applicableProducts.filter((p: string) => !products2Set.has(p));
        } else {
          // promotion2 선택 → 삭제
          action = 'delete';
        }
      }

      if (action === 'delete') {
        // 삭제
        if (!confirm(`"${targetPromo.name}" 프로모션을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
          setProcessingIssue(null);
          return;
        }

        const { signature, timestamp } = await signWithTimestamp({
          action: 'delete_promotion',
          promotionId: targetPromo._id,
        });

        const response = await fetch(`/api/promotions/${targetPromo._id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature,
            timestamp,
            address: userAddress,
          }),
        });

        const data = await response.json();

        if (data.success) {
          onShowToast(`✅ "${targetPromo.name}" 프로모션이 삭제되었습니다.`, 'success');

          // 삭제된 프로모션이 포함된 모든 issues 제거
          setIssues(prevIssues =>
            prevIssues.filter(issue =>
              issue.promotion1._id !== targetPromo._id &&
              issue.promotion2._id !== targetPromo._id
            )
          );
        } else {
          onShowToast(`오류: ${data.error}`, 'error');
          setProcessingIssue(null);
          return;
        }
      } else {
        // 수정
        if (!confirm(`"${targetPromo.name}" 프로모션에서 "${otherPromo.name}"의 상품들을 제거하시겠습니까?\n\n제거 후 ${newProducts.length}개 상품이 남습니다.`)) {
          setProcessingIssue(null);
          return;
        }

        const { signature, timestamp } = await signWithTimestamp({
          action: 'edit_promotion',
          promotionId: targetPromo._id,
          updates: { applicableProducts: newProducts },
          comment: `무결성 검증: ${otherPromo.name}과(와) 중복되는 상품 제거`,
        });

        const response = await fetch(`/api/promotions/${targetPromo._id}/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: { applicableProducts: newProducts },
            comment: `무결성 검증: ${otherPromo.name}과(와) 중복되는 상품 제거`,
            signature,
            timestamp,
            address: userAddress,
          }),
        });

        const data = await response.json();

        if (data.success) {
          onShowToast(`✅ "${targetPromo.name}" 프로모션이 수정되었습니다. (${newProducts.length}개 상품 남음)`, 'success');

          // DB에서 최신 프로모션 정보 가져오기
          const updatedPromoResponse = await fetch(`/api/promotions/${targetPromo._id}`);
          const updatedPromoData = await updatedPromoResponse.json();

          if (updatedPromoData.success) {
            const updatedPromo = updatedPromoData.promotion;

            // issues에서 수정된 프로모션이 포함된 모든 issue 업데이트
            setIssues(prevIssues =>
              prevIssues.map(issue => {
                if (issue.promotion1._id === targetPromo._id) {
                  return { ...issue, promotion1: updatedPromo };
                } else if (issue.promotion2._id === targetPromo._id) {
                  return { ...issue, promotion2: updatedPromo };
                }
                return issue;
              }).filter(issue => {
                // 수정 후 문제가 해결된 issue는 제거
                const products1 = new Set(issue.promotion1.applicableProducts || []);
                const products2 = new Set(issue.promotion2.applicableProducts || []);

                // 둘 중 하나가 빈 배열이면 제거
                if (products1.size === 0 || products2.size === 0) {
                  return false;
                }

                // 교집합이 없으면 제거
                const intersection = [...products1].filter(p => products2.has(p));
                return intersection.length > 0;
              })
            );
          }
        } else {
          onShowToast(`오류: ${data.error}`, 'error');
          setProcessingIssue(null);
          return;
        }
      }

      // 선택 상태 초기화
      setSelectedPromotions(new Map());

      // 부모 컴포넌트 새로고침
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Fix issue error:', error);
      onShowToast('문제 해결 중 오류가 발생했습니다.', 'error');
    } finally {
      setProcessingIssue(null);
    }
  };

  const handleRebuildIndex = async () => {
    if (!userAddress) {
      onShowToast('지갑 연결이 필요합니다.', 'error');
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
        onShowToast(`✅ PromotionIndex 재구축 완료! 처리: ${data.stats.promotionsProcessed}개, 인덱싱: ${data.stats.barcodesIndexed}개`, 'success');
      } else {
        onShowToast(`오류: ${data.error}`, 'error');
      }
    } catch (error) {
      console.error('Rebuild error:', error);
      onShowToast('인덱스 재구축 중 오류가 발생했습니다.', 'error');
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
                          <div className="font-semibold text-gray-900 mb-3">
                            {issue.description}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                            <button
                              onClick={() => {
                                setSelectedPromotions(prev => {
                                  const newMap = new Map(prev);
                                  if (newMap.get(index) === '1') {
                                    newMap.delete(index);
                                  } else {
                                    newMap.set(index, '1');
                                  }
                                  return newMap;
                                });
                              }}
                              className={`bg-white rounded-lg p-3 border-2 text-left transition-all ${
                                selectedPromotions.get(index) === '1'
                                  ? 'border-purple-500 bg-purple-50 shadow-lg'
                                  : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-medium text-gray-700">
                                  프로모션 1:
                                </div>
                                {selectedPromotions.get(index) === '1' && (
                                  <div className="text-purple-600 text-lg">✓</div>
                                )}
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
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPromotions(prev => {
                                  const newMap = new Map(prev);
                                  if (newMap.get(index) === '2') {
                                    newMap.delete(index);
                                  } else {
                                    newMap.set(index, '2');
                                  }
                                  return newMap;
                                });
                              }}
                              className={`bg-white rounded-lg p-3 border-2 text-left transition-all ${
                                selectedPromotions.get(index) === '2'
                                  ? 'border-purple-500 bg-purple-50 shadow-lg'
                                  : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-medium text-gray-700">
                                  프로모션 2:
                                </div>
                                {selectedPromotions.get(index) === '2' && (
                                  <div className="text-purple-600 text-lg">✓</div>
                                )}
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
                            </button>
                          </div>

                          {/* 문제 해결 버튼 */}
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border border-purple-200">
                            <div className="text-xs font-medium text-gray-700 mb-2">
                              💡 위에서 처리할 프로모션을 선택하세요
                            </div>
                            <button
                              onClick={() => handleFixIssue(index)}
                              disabled={processingIssue === index || !selectedPromotions.has(index)}
                              className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                            >
                              {processingIssue === index ? '처리 중...' : '문제 해결'}
                            </button>
                            <div className="text-xs text-gray-600 mt-2">
                              {issue.type === 'duplicate' && '→ 선택한 프로모션이 삭제됩니다'}
                              {issue.type === 'subset' && selectedPromotions.get(index) === '1' && '→ 프로모션 1이 삭제됩니다 (2에 포함됨)'}
                              {issue.type === 'subset' && selectedPromotions.get(index) === '2' && '→ 프로모션 2에서 1의 상품들이 제거됩니다'}
                              {issue.type === 'superset' && selectedPromotions.get(index) === '1' && '→ 프로모션 1에서 2의 상품들이 제거됩니다'}
                              {issue.type === 'superset' && selectedPromotions.get(index) === '2' && '→ 프로모션 2가 삭제됩니다 (1에 포함됨)'}
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
