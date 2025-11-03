'use client';

import { useState, useEffect } from 'react';
import { IDiscountRule } from '@/types/discount';
import { signWithTimestamp, getCurrentUserAddress } from '@/lib/userAuth';
import Toast from './Toast';

interface DiscountJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  discount?: IDiscountRule | null;
  onSave: () => void;
  allDiscounts?: IDiscountRule[];
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function DiscountJsonModal({
  isOpen,
  onClose,
  discount,
  onSave,
  allDiscounts = [],
}: DiscountJsonModalProps) {
  const [selectedDiscount, setSelectedDiscount] = useState<IDiscountRule | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  // 초기 할인 규칙 설정 (props로 받은 discount)
  useEffect(() => {
    if (discount) {
      setSelectedDiscount(discount);
    }
  }, [discount]);

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setToast({ show: false, message: '', type: 'success' });
    }
  }, [isOpen]);

  // 선택된 할인 규칙이 변경되면 JSON 업데이트
  useEffect(() => {
    if (selectedDiscount) {
      // 기존 할인 규칙을 JSON으로 표시 (읽기 전용 필드 제외)
      const cleanDiscount = {
        name: selectedDiscount.name,
        description: selectedDiscount.description,
        config: selectedDiscount.config,
        applicableProducts: selectedDiscount.applicableProducts,
        applicableCategories: selectedDiscount.applicableCategories,
        applicableBrands: selectedDiscount.applicableBrands,
        requiredPaymentMethods: selectedDiscount.requiredPaymentMethods,
        paymentMethodNames: selectedDiscount.paymentMethodNames,
        // 신규 구조 (우선)
        ...(selectedDiscount.combinationRules && { combinationRules: selectedDiscount.combinationRules }),
        ...(selectedDiscount.constraints && { constraints: selectedDiscount.constraints }),
        // 레거시 필드 (하위 호환)
        cannotCombineWithCategories: selectedDiscount.cannotCombineWithCategories,
        cannotCombineWithIds: selectedDiscount.cannotCombineWithIds,
        requiresDiscountId: selectedDiscount.requiresDiscountId,
        minPurchaseAmount: selectedDiscount.minPurchaseAmount,
        minQuantity: selectedDiscount.minQuantity,
        maxDiscountAmount: selectedDiscount.maxDiscountAmount,
        maxDiscountPerItem: selectedDiscount.maxDiscountPerItem,
        eventMonth: selectedDiscount.eventMonth,
        eventName: selectedDiscount.eventName,
        isRecurring: selectedDiscount.isRecurring,
        validFrom: selectedDiscount.validFrom,
        validTo: selectedDiscount.validTo,
        sourceUrl: selectedDiscount.sourceUrl,
        priority: selectedDiscount.priority,
        isActive: selectedDiscount.isActive,
      };
      setJsonText(JSON.stringify(cleanDiscount, null, 2));
    } else {
      // 새 할인 규칙 템플릿
      loadNewTemplate();
    }
  }, [selectedDiscount]);

  const loadNewTemplate = () => {
    setJsonText(JSON.stringify({
      name: "할인 이름",
      description: "할인 설명",
      config: {
        category: "coupon",
        valueType: "percentage",
        percentage: 10
      },
      applicableProducts: [],
      applicableCategories: [],
      applicableBrands: [],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      cannotCombineWithCategories: [],
      cannotCombineWithIds: [],
      minPurchaseAmount: 0,
      minQuantity: 1,
      maxDiscountAmount: 0,
      maxDiscountPerItem: 0,
      eventMonth: "",
      eventName: "",
      isRecurring: false,
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      sourceUrl: "",
      priority: 0,
      isActive: true
    }, null, 2));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // JSON 파싱
      let discountData;
      try {
        discountData = JSON.parse(jsonText);
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

      // 서명 생성
      const signData = selectedDiscount
        ? { action: 'update_discount', id: selectedDiscount._id, ...discountData }
        : { action: 'create_discount', ...discountData };

      const { signature, timestamp } = await signWithTimestamp(signData);

      // API 호출
      const url = selectedDiscount
        ? `/api/discounts/${selectedDiscount._id}`
        : '/api/discounts';

      const method = selectedDiscount ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          discountData,
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
          message: selectedDiscount ? '✅ 할인 규칙이 수정되었습니다!' : '✅ 할인 규칙이 생성되었습니다!',
          type: 'success'
        });
        onSave();
        // 토스트 표시 후 잠시 뒤 모달 닫기
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        setError('오류: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving discount:', error);
      setError('할인 규칙 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDiscount) return;

    if (!confirm(`정말로 "${selectedDiscount.name}" 할인 규칙을 삭제하시겠습니까?`)) return;

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
        action: 'delete_discount',
        id: selectedDiscount._id,
      });

      const response = await fetch(`/api/discounts/${selectedDiscount._id}`, {
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
        // 먼저 목록 갱신
        onSave();

        // 토스트 표시
        setToast({
          show: true,
          message: '🗑️ 할인 규칙이 삭제되었습니다!',
          type: 'success'
        });

        // 약간의 지연 후 선택 해제 (토스트가 보이도록)
        setTimeout(() => {
          setSelectedDiscount(null); // 삭제 후 새 템플릿 로드
        }, 100);
      } else {
        setError('오류: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting discount:', error);
      setError('할인 규칙 삭제 중 오류가 발생했습니다.');
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
        type: 'success'
      });
    } catch (e) {
      setError('❌ JSON 형식이 올바르지 않습니다: ' + (e as Error).message);
    }
  };

  return (
    <>
      {/* 토스트 알림 */}
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
              <h2 className="text-2xl font-bold">
                🔧 할인 규칙 JSON 편집
              </h2>
              <p className="text-purple-100 text-sm mt-1">관리자 전용 - 완전한 객체 데이터 편집</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 할인 규칙 선택 드롭다운 */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold whitespace-nowrap">
              할인 선택:
            </label>
            <select
              value={selectedDiscount?._id?.toString() || ''}
              onChange={(e) => {
                if (e.target.value === '') {
                  setSelectedDiscount(null);
                } else {
                  const found = allDiscounts.find(d => d._id?.toString() === e.target.value);
                  if (found) setSelectedDiscount(found);
                }
              }}
              className="flex-1 px-4 py-2 bg-white text-gray-900 rounded-lg border-2 border-purple-300 focus:border-white focus:ring-2 focus:ring-white font-medium"
            >
              <option value="">➕ 새 할인 규칙 생성</option>
              {allDiscounts.map((d) => (
                <option key={d._id?.toString()} value={d._id?.toString()}>
                  {d.name} ({d.config.category})
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
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">{error}</div>
              </div>
            </div>
          )}

          {/* JSON 편집기 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                JSON 데이터
              </label>
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              도움말
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• 위 JSON 형식으로 할인 규칙의 모든 필드를 편집할 수 있습니다.</p>
              <p>• <code className="bg-blue-100 px-1 rounded">config.category</code>: coupon, telecom, payment_event, voucher, payment_instant, payment_compound, promotion</p>
              <p>• <code className="bg-blue-100 px-1 rounded">config.valueType</code>: percentage, fixed_amount, tiered_amount, voucher_amount, buy_n_get_m</p>
              <p>• 날짜는 ISO 8601 형식으로 입력하세요 (예: "2025-01-01T00:00:00.000Z")</p>
              <p>• "검증" 버튼으로 JSON 문법을 확인하고, "포맷" 버튼으로 정렬할 수 있습니다.</p>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {/* 삭제 버튼 (할인 규칙 선택 시에만) */}
            {selectedDiscount && (
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
              {loading ? '저장 중...' : selectedDiscount ? '🔧 수정하기' : '➕ 생성하기'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}
