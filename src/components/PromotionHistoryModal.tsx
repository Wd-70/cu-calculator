'use client';

import { useState, useEffect } from 'react';

interface HistoryEntry {
  modifiedBy: string;
  modifiedAt: Date;
  changes: any;
  comment: string;
}

interface PromotionHistoryModalProps {
  promotionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PromotionHistoryModal({
  promotionId,
  isOpen,
  onClose,
}: PromotionHistoryModalProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [createdBy, setCreatedBy] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && promotionId) {
      loadHistory();
    }
  }, [isOpen, promotionId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/promotions/${promotionId}/history`);
      const data = await response.json();

      if (data.success) {
        setHistory(data.history);
        setCreatedBy(data.createdBy);
        setCreatedAt(data.createdAt);
      } else {
        alert('히스토리 로드 실패: ' + data.error);
      }
    } catch (error) {
      console.error('History load error:', error);
      alert('히스토리 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatAddress = (address: string) => {
    if (address.length > 12) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasValidChanges = (changes: any) => {
    if (!changes || Object.keys(changes).length === 0) {
      return false;
    }

    const validChanges = Object.entries(changes).filter(([key, value]: [string, any]) => {
      const before = value.before;
      const after = value.after;

      // 배열인 경우 길이가 0이면 값이 없는 것으로 간주
      if (Array.isArray(before) && before.length === 0 &&
          Array.isArray(after) && after.length === 0) {
        return false;
      }

      // 둘 다 null/undefined이면 표시하지 않음
      if ((before === null || before === undefined) &&
          (after === null || after === undefined)) {
        return false;
      }

      return true;
    });

    return validChanges.length > 0;
  };

  const renderChanges = (changes: any) => {
    if (!changes || Object.keys(changes).length === 0) {
      return <div className="text-gray-500 text-sm">변경 사항 없음</div>;
    }

    // 값이 있는 변경사항만 필터링
    const validChanges = Object.entries(changes).filter(([key, value]: [string, any]) => {
      const before = value.before;
      const after = value.after;

      // 배열인 경우 길이가 0이면 값이 없는 것으로 간주
      if (Array.isArray(before) && before.length === 0 &&
          Array.isArray(after) && after.length === 0) {
        return false;
      }

      // 둘 다 null/undefined이면 표시하지 않음
      if ((before === null || before === undefined) &&
          (after === null || after === undefined)) {
        return false;
      }

      return true;
    });

    if (validChanges.length === 0) {
      return <div className="text-gray-500 text-sm">변경 사항 없음</div>;
    }

    return (
      <div className="space-y-2">
        {validChanges.map(([key, value]: [string, any]) => (
          <div key={key} className="bg-gray-50 rounded p-3">
            <div className="font-semibold text-gray-700 text-sm mb-1">
              {getFieldLabel(key)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-red-600 font-medium mb-1">이전:</div>
                <div className="bg-red-50 p-2 rounded">
                  {formatValue(value.before)}
                </div>
              </div>
              <div>
                <div className="text-green-600 font-medium mb-1">이후:</div>
                <div className="bg-green-50 p-2 rounded">
                  {formatValue(value.after)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getFieldLabel = (key: string) => {
    const labels: { [key: string]: string } = {
      name: '프로모션 이름',
      description: '설명',
      promotionType: '프로모션 타입',
      buyQuantity: '구매 수량',
      getQuantity: '증정 수량',
      giftSelectionType: '증정 방식',
      applicableProducts: '구매 상품',
      giftProducts: '증정 상품',
      validFrom: '시작일',
      validTo: '종료일',
    };
    return labels[key] || key;
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '없음';
    if (Array.isArray(value)) {
      if (value.length === 0) return '빈 배열';
      return (
        <div className="space-y-1">
          {value.map((item, index) => (
            <div key={index} className="font-mono text-xs">• {item}</div>
          ))}
        </div>
      );
    }
    if (typeof value === 'object') {
      return <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>;
    }
    if (typeof value === 'boolean') return value ? '예' : '아니오';
    return String(value);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">📜 수정 히스토리</h2>
              <p className="text-indigo-100 text-sm">
                모든 수정 내역이 기록됩니다
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
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">로딩 중...</p>
            </div>
          ) : (
            <>
              {/* 생성 정보 */}
              {createdBy && createdAt && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🌱</span>
                    <span className="font-bold text-green-900">생성</span>
                  </div>
                  <div className="text-sm text-green-700">
                    <div>작성자: <span className="font-mono">{formatAddress(createdBy)}</span></div>
                    <div>작성일: {formatDate(createdAt)}</div>
                  </div>
                </div>
              )}

              {/* 히스토리 목록 */}
              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  아직 수정 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((entry, index) => (
                    <div
                      key={index}
                      className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900">
                              {formatAddress(entry.modifiedBy)}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                              #{history.length - index}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(entry.modifiedAt)}
                          </div>
                        </div>
                        {hasValidChanges(entry.changes) && (
                          <button
                            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                          >
                            {expandedIndex === index ? '접기 ▲' : '상세 ▼'}
                          </button>
                        )}
                      </div>

                      {/* 코멘트 */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                        <div className="text-xs font-semibold text-yellow-800 mb-1">
                          수정 이유:
                        </div>
                        <div className="text-sm text-yellow-900">
                          {entry.comment || '(코멘트 없음)'}
                        </div>
                      </div>

                      {/* 변경 사항 */}
                      {expandedIndex === index && (
                        <div className="border-t border-gray-200 pt-3">
                          <div className="text-xs font-semibold text-gray-700 mb-2">
                            변경 사항:
                          </div>
                          {renderChanges(entry.changes)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
