'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IPreset } from '@/types/preset';
import { IDiscountRule, DISCOUNT_CATEGORY_NAMES } from '@/types/discount';
import { PAYMENT_METHOD_NAMES } from '@/types/payment';
import * as clientDb from '@/lib/clientDb';

export default function PresetsPage() {
  const [presets, setPresets] = useState<IPreset[]>([]);
  const [discounts, setDiscounts] = useState<IDiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<IPreset | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 클라이언트 데이터 (LocalStorage)
      const localPresets = clientDb.getPresets();
      setPresets(localPresets);

      // 서버 데이터 (공통 데이터)
      const discountsRes = await fetch('/api/discounts');
      const discountsData = await discountsRes.json();

      if (discountsData.success) {
        setDiscounts(discountsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('이 프리셋을 삭제하시겠습니까?')) return;

    const success = clientDb.deletePreset(id);
    if (success) {
      setPresets(clientDb.getPresets());
    } else {
      alert('프리셋 삭제에 실패했습니다.');
    }
  };

  const getDiscountName = (discountId: string): string => {
    const discount = discounts.find((d) => String(d._id) === discountId);
    return discount?.name || '알 수 없는 할인';
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
                <h1 className="text-gray-900 font-bold text-xl">내 프리셋</h1>
                <p className="text-gray-500 text-xs">자주 사용하는 할인 조합</p>
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 헤더 섹션 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">프리셋 관리</h2>
              <p className="text-gray-600 mt-2">
                자주 사용하는 할인 조합을 저장하고 빠르게 적용하세요
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors shadow-lg"
            >
              + 새 프리셋
            </button>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#7C3FBF] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">프리셋을 불러오는 중...</p>
          </div>
        )}

        {/* 프리셋 없음 */}
        {!loading && presets.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-2xl">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">저장된 프리셋이 없습니다</h3>
            <p className="text-gray-600 mb-6">
              자주 사용하는 할인 조합을 프리셋으로 저장해보세요!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors"
            >
              첫 프리셋 만들기
            </button>
          </div>
        )}

        {/* 프리셋 목록 */}
        {!loading && presets.length > 0 && (
          <div className="grid gap-6">
            {presets.map((preset) => (
              <div
                key={String(preset._id)}
                className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-[#7C3FBF] transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {preset.emoji && (
                      <span className="text-4xl">{preset.emoji}</span>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {preset.name}
                      </h3>
                      {preset.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {preset.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingPreset(preset);
                        setShowCreateModal(true);
                      }}
                      className="px-4 py-2 text-[#7C3FBF] hover:bg-purple-50 rounded-lg font-medium transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(String(preset._id))}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {/* 선택된 할인 목록 */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700">선택된 할인:</h4>
                  <div className="flex flex-wrap gap-2">
                    {preset.discountIds.map((discountId) => (
                      <span
                        key={String(discountId)}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium"
                      >
                        {getDiscountName(String(discountId))}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 결제수단 */}
                {preset.paymentMethod && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">결제수단:</h4>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                      {PAYMENT_METHOD_NAMES[preset.paymentMethod]}
                    </span>
                  </div>
                )}

                {/* 메타 정보 */}
                <div className="flex items-center gap-4 text-sm text-gray-500 border-t border-gray-200 pt-4">
                  <span>
                    생성일: {new Date(preset.createdAt).toLocaleDateString()}
                  </span>
                  <span>
                    수정일: {new Date(preset.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 프리셋 생성/수정 모달 */}
      {showCreateModal && (
        <PresetModal
          preset={editingPreset}
          discounts={discounts}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPreset(null);
          }}
          onSuccess={() => {
            setPresets(clientDb.getPresets());
            setShowCreateModal(false);
            setEditingPreset(null);
          }}
        />
      )}
    </div>
  );
}

// 프리셋 생성/수정 모달 컴포넌트
function PresetModal({
  preset,
  discounts,
  onClose,
  onSuccess,
}: {
  preset: IPreset | null;
  discounts: IDiscountRule[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(preset?.name || '');
  const [emoji, setEmoji] = useState(preset?.emoji || '');
  const [description, setDescription] = useState(preset?.description || '');
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>(
    preset?.discountIds.map(String) || []
  );
  const [paymentMethod, setPaymentMethod] = useState(preset?.paymentMethod || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('프리셋 이름을 입력해주세요.');
      return;
    }

    if (selectedDiscountIds.length === 0) {
      alert('최소 1개 이상의 할인을 선택해주세요.');
      return;
    }

    try {
      setSaving(true);

      if (preset) {
        // 수정
        clientDb.updatePreset(String(preset._id), {
          name: name.trim(),
          emoji: emoji.trim() || undefined,
          description: description.trim() || undefined,
          discountIds: selectedDiscountIds,
          paymentMethod: paymentMethod || undefined,
        });
      } else {
        // 생성
        clientDb.createPreset({
          name: name.trim(),
          emoji: emoji.trim() || undefined,
          description: description.trim() || undefined,
          discountIds: selectedDiscountIds,
          paymentMethod: paymentMethod || undefined,
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Failed to save preset:', error);
      alert('프리셋 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDiscount = (discountId: string) => {
    if (selectedDiscountIds.includes(discountId)) {
      setSelectedDiscountIds(selectedDiscountIds.filter((id) => id !== discountId));
    } else {
      setSelectedDiscountIds([...selectedDiscountIds, discountId]);
    }
  };

  // 카테고리별 그룹화
  const groupedDiscounts = discounts.reduce((acc, discount) => {
    const category = discount.config.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(discount);
    return acc;
  }, {} as Record<string, IDiscountRule[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* 모달 헤더 */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {preset ? '프리셋 수정' : '새 프리셋 만들기'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 모달 본문 */}
          <div className="p-6 space-y-6">
            {/* 기본 정보 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                프리셋 이름 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 출근길 조합"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  이모지
                </label>
                <input
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="🏃"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  결제수단
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                >
                  <option value="">선택 안 함</option>
                  {Object.entries(PAYMENT_METHOD_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                설명
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="이 프리셋에 대한 간단한 설명"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF] resize-none"
                rows={2}
              />
            </div>

            {/* 할인 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                할인 선택 * (선택: {selectedDiscountIds.length}개)
              </label>
              <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-xl p-4">
                {Object.entries(groupedDiscounts).map(([category, categoryDiscounts]) => (
                  <div key={category}>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">
                      {DISCOUNT_CATEGORY_NAMES[category as keyof typeof DISCOUNT_CATEGORY_NAMES]}
                    </h4>
                    <div className="space-y-2">
                      {categoryDiscounts.map((discount) => (
                        <label
                          key={String(discount._id)}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDiscountIds.includes(String(discount._id))}
                            onChange={() => toggleDiscount(String(discount._id))}
                            className="mt-1 w-5 h-5 text-[#7C3FBF] border-gray-300 rounded focus:ring-[#7C3FBF]"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{discount.name}</div>
                            {discount.description && (
                              <div className="text-sm text-gray-600">{discount.description}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 모달 푸터 */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving ? '저장 중...' : preset ? '수정하기' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
