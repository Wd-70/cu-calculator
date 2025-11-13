'use client';

import { useState, useEffect } from 'react';
import { IDiscountRule, DISCOUNT_CATEGORY_NAMES } from '@/types/discount';
import { signWithTimestamp, getCurrentUserAddress } from '@/lib/userAuth';
import { checkIsAdminClient } from '@/lib/adminAuth';

interface DiscountEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  discount?: IDiscountRule | null;
  onSave: () => void;
}

export default function DiscountEditModal({
  isOpen,
  onClose,
  discount,
  onSave,
}: DiscountEditModalProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<IDiscountRule>>({
    name: '',
    description: '',
    config: {
      category: 'coupon',
      valueType: 'percentage',
      percentage: 10,
    },
    applicableProducts: [],
    applicableCategories: [],
    applicableBrands: [],
    requiredPaymentMethods: [],
    paymentMethodNames: [],
    validFrom: new Date(),
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
    isActive: true,
  });

  useEffect(() => {
    const checkAdmin = async () => {
      const address = getCurrentUserAddress();
      if (address) {
        const adminStatus = await checkIsAdminClient(address);
        setIsAdmin(adminStatus);
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    if (discount) {
      setFormData(discount);
    }
  }, [discount]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const address = getCurrentUserAddress();
      if (!address) {
        alert('계정을 찾을 수 없습니다.');
        return;
      }

      // 서명 생성
      const { signature, timestamp } = await signWithTimestamp({
        action: discount ? 'update_discount' : 'create_discount',
        ...formData,
      });

      // API 호출
      const url = discount
        ? `/api/discounts/${discount._id}`
        : '/api/discounts';

      const method = discount ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          discountData: formData,
          signature,
          timestamp,
          address,
          comment: '할인 규칙 ' + (discount ? '수정' : '생성'),
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(discount ? '할인 규칙이 수정되었습니다!' : '할인 규칙이 생성되었습니다!');
        onSave();
        onClose();
      } else {
        alert('오류: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving discount:', error);
      alert('할인 규칙 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!discount || !isAdmin) return;

    if (!confirm('정말로 이 할인 규칙을 삭제하시겠습니까?')) return;

    setLoading(true);

    try {
      const address = getCurrentUserAddress();
      if (!address) {
        alert('계정을 찾을 수 없습니다.');
        return;
      }

      const { signature, timestamp } = await signWithTimestamp({
        action: 'delete_discount',
        id: discount._id,
      });

      const response = await fetch(`/api/discounts/${discount._id}`, {
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
        alert('할인 규칙이 삭제되었습니다!');
        onSave();
        onClose();
      } else {
        alert('오류: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting discount:', error);
      alert('할인 규칙 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {discount ? '할인 규칙 수정' : '새 할인 규칙 추가'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              할인 이름 *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="예: 네이버플러스 멤버십 10% 할인"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="할인에 대한 추가 설명을 입력하세요"
              rows={3}
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              카테고리 *
            </label>
            <select
              required
              value={formData.config?.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  config: { ...formData.config!, category: e.target.value as any },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {Object.entries(DISCOUNT_CATEGORY_NAMES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* 할인 값 타입 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              할인 타입 *
            </label>
            <select
              required
              value={formData.config?.valueType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  config: { ...formData.config!, valueType: e.target.value as any },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="percentage">퍼센트 할인</option>
              <option value="fixed_amount">정액 할인</option>
              <option value="tiered_amount">구간별 할인</option>
              <option value="voucher_amount">금액권</option>
              <option value="buy_n_get_m">N+M 프로모션</option>
            </select>
          </div>

          {/* 할인 값 */}
          {formData.config?.valueType === 'percentage' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                할인율 (%) *
              </label>
              <input
                type="number"
                required
                min="0"
                max="100"
                value={formData.config.percentage || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config!, percentage: Number(e.target.value) } as any,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          )}

          {formData.config?.valueType === 'fixed_amount' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                할인 금액 (원) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.config.fixedAmount || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    config: { ...formData.config!, fixedAmount: Number(e.target.value) } as any,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          )}

          {/* 유효 기간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                시작일 *
              </label>
              <input
                type="date"
                required
                value={
                  formData.validFrom
                    ? new Date(formData.validFrom).toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) =>
                  setFormData({ ...formData, validFrom: new Date(e.target.value) })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                종료일 *
              </label>
              <input
                type="date"
                required
                value={
                  formData.validTo
                    ? new Date(formData.validTo).toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) =>
                  setFormData({ ...formData, validTo: new Date(e.target.value) })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 활성화 상태 */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="isActive" className="text-sm font-semibold text-gray-700">
              활성화 상태
            </label>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {discount && isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                삭제
              </button>
            )}
            <div className="flex-1"></div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '저장 중...' : discount ? '수정' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
