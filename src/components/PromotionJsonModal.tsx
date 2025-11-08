'use client';

import { useState, useEffect } from 'react';
import { IPromotion } from '@/lib/models/Promotion';
import { signWithTimestamp, getCurrentUserAddress } from '@/lib/userAuth';
import Toast from './Toast';

interface PromotionJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotion?: IPromotion | null;
  onSave: (updatedPromotion?: IPromotion) => void;
  allPromotions?: IPromotion[];
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function PromotionJsonModal({
  isOpen,
  onClose,
  promotion,
  onSave,
  allPromotions = [],
}: PromotionJsonModalProps) {
  const [selectedPromotion, setSelectedPromotion] = useState<IPromotion | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (promotion) {
      setSelectedPromotion(promotion);
    }
  }, [promotion]);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setToast({ show: false, message: '', type: 'success' });
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedPromotion) {
      const cleanPromotion = {
        name: selectedPromotion.name,
        description: selectedPromotion.description,
        promotionType: selectedPromotion.promotionType,
        buyQuantity: selectedPromotion.buyQuantity,
        getQuantity: selectedPromotion.getQuantity,
        applicableType: selectedPromotion.applicableType,
        applicableProducts: selectedPromotion.applicableProducts,
        applicableCategories: selectedPromotion.applicableCategories,
        applicableBrands: selectedPromotion.applicableBrands,
        giftSelectionType: selectedPromotion.giftSelectionType,
        giftProducts: selectedPromotion.giftProducts,
        giftCategories: selectedPromotion.giftCategories,
        giftBrands: selectedPromotion.giftBrands,
        giftConstraints: selectedPromotion.giftConstraints,
        constraints: selectedPromotion.constraints,
        validFrom: selectedPromotion.validFrom,
        validTo: selectedPromotion.validTo,
        status: selectedPromotion.status,
        isActive: selectedPromotion.isActive,
        priority: selectedPromotion.priority,
        sourceUrl: selectedPromotion.sourceUrl,
      };
      setJsonText(JSON.stringify(cleanPromotion, null, 2));
    } else {
      loadNewTemplate();
    }
  }, [selectedPromotion]);

  const loadNewTemplate = () => {
    const now = new Date();
    const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    setJsonText(
      JSON.stringify(
        {
          name: '프로모션 이름',
          description: '프로모션 설명',
          promotionType: '1+1',
          buyQuantity: 1,
          getQuantity: 1,
          applicableType: 'products',
          applicableProducts: [],
          applicableCategories: [],
          applicableBrands: [],
          giftSelectionType: 'same',
          giftProducts: [],
          giftCategories: [],
          giftBrands: [],
          giftConstraints: {
            maxGiftPrice: 0,
            mustBeCheaperThanPurchased: false,
            mustBeSameProduct: false,
          },
          constraints: {
            maxApplicationsPerCart: 0,
            minPurchaseAmount: 0,
            excludedProducts: [],
          },
          validFrom: now.toISOString(),
          validTo: oneMonthLater.toISOString(),
          status: 'active',
          isActive: true,
          priority: 0,
          sourceUrl: '',
        },
        null,
        2
      )
    );
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let promotionData;
      try {
        promotionData = JSON.parse(jsonText);
      } catch (parseError) {
        setError('JSON 형식이 올바르지 않습니다.');
        setLoading(false);
        return;
      }

      const address = getCurrentUserAddress();
      if (!address) {
        setError('계정을 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      const { signature, timestamp } = await signWithTimestamp({
        action: selectedPromotion ? 'update_promotion' : 'create_promotion',
        id: selectedPromotion?._id,
        ...promotionData,
      });

      const url = selectedPromotion
        ? `/api/promotions/${selectedPromotion._id}`
        : '/api/promotions';

      const method = selectedPromotion ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promotionData,
          signature,
          timestamp,
          address,
          comment: '관리자 JSON 편집',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          show: true,
          message: selectedPromotion
            ? '✅ 프로모션이 수정되었습니다!'
            : '✅ 프로모션이 생성되었습니다!',
          type: 'success',
        });
        // 업데이트된 프로모션 데이터 전달
        onSave(data.promotion);
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        setError('오류: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving promotion:', error);
      setError('프로모션 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPromotion) return;

    if (!confirm(`정말로 "${selectedPromotion.name}" 프로모션을 삭제하시겠습니까?`)) return;

    setLoading(true);
    setError(null);

    try {
      const address = getCurrentUserAddress();
      if (!address) {
        setError('계정을 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      const { signature, timestamp } = await signWithTimestamp({
        action: 'delete_promotion',
        promotionId: selectedPromotion._id,
      });

      const response = await fetch(`/api/promotions/${selectedPromotion._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          timestamp,
          address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSave();
        setToast({
          show: true,
          message: '🗑️ 프로모션이 삭제되었습니다!',
          type: 'success',
        });
        setTimeout(() => {
          setSelectedPromotion(null);
        }, 100);
      } else {
        setError('오류: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting promotion:', error);
      setError('프로모션 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError('JSON 형식이 올바르지 않아 포맷할 수 없습니다.');
    }
  };

  const handleValidate = () => {
    try {
      JSON.parse(jsonText);
      setError(null);
      setToast({
        show: true,
        message: '✅ JSON 형식이 올바릅니다!',
        type: 'success',
      });
    } catch (e) {
      setError('❌ JSON 형식이 올바르지 않습니다: ' + (e as Error).message);
    }
  };

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">🔧 프로모션 JSON 편집</h2>
                <p className="text-purple-100 text-sm mt-1">
                  관리자 전용 - 완전한 객체 데이터 편집
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-purple-200 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* 프로모션 선택 드롭다운 */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold whitespace-nowrap">프로모션 선택:</label>
              <select
                value={selectedPromotion?._id?.toString() || ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setSelectedPromotion(null);
                  } else {
                    const found = allPromotions.find(
                      (p) => p._id?.toString() === e.target.value
                    );
                    if (found) setSelectedPromotion(found);
                  }
                }}
                className="flex-1 px-4 py-2 bg-white text-gray-900 rounded-lg border-2 border-purple-300 focus:border-white focus:ring-2 focus:ring-white font-medium"
              >
                <option value="">➕ 새 프로모션 생성</option>
                {allPromotions.map((p) => (
                  <option key={p._id?.toString()} value={p._id?.toString()}>
                    {p.name} ({p.promotionType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* 에러 메시지 */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">{error}</div>
                </div>
              </div>
            )}

            {/* JSON 편집기 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">JSON 데이터</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleValidate}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    ✓ 검증
                  </button>
                  <button
                    type="button"
                    onClick={handleFormat}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    ⚡ 포맷
                  </button>
                </div>
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setError(null);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                rows={25}
                spellCheck={false}
                style={{
                  tabSize: 2,
                }}
              />
            </div>

            {/* 도움말 */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                도움말
              </h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• 위 JSON 형식으로 프로모션의 모든 필드를 편집할 수 있습니다.</p>
                <p>
                  • <code className="bg-blue-100 px-1 rounded">promotionType</code>: 1+1, 2+1,
                  3+1, custom
                </p>
                <p>
                  • <code className="bg-blue-100 px-1 rounded">applicableType</code>: products,
                  categories, brands
                </p>
                <p>
                  • <code className="bg-blue-100 px-1 rounded">giftSelectionType</code>: same
                  (동일 상품), cross (교차 증정), combo (콤보 증정)
                </p>
                <p>
                  • 날짜는 ISO 8601 형식으로 입력하세요 (예: &quot;2025-01-01T00:00:00.000Z&quot;)
                </p>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              {selectedPromotion && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🗑️ 삭제
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                취소
              </button>

              <div className="flex-1"></div>

              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '저장 중...' : selectedPromotion ? '🔧 수정하기' : '➕ 생성하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
