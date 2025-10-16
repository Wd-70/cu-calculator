'use client';

import { useState, useEffect } from 'react';
import { IUserPreset } from '@/types/preset';
import { IDiscountRule } from '@/types/discount';

interface PresetSelectorProps {
  onSelect: (preset: IUserPreset) => void;
  discounts: IDiscountRule[];
  className?: string;
}

export default function PresetSelector({ onSelect, discounts, className = '' }: PresetSelectorProps) {
  const [presets, setPresets] = useState<IUserPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/presets');
      const data = await response.json();
      if (data.success) {
        setPresets(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = async (preset: IUserPreset) => {
    try {
      // 사용 카운트 증가
      await fetch(`/api/presets/${preset._id}/use`, {
        method: 'POST',
      });

      onSelect(preset);
      setShowPresets(false);
    } catch (error) {
      console.error('Failed to increment preset usage:', error);
      // 에러가 나도 프리셋은 적용
      onSelect(preset);
      setShowPresets(false);
    }
  };

  const getDiscountNames = (discountIds: (string | any)[]): string[] => {
    return discountIds
      .map((id) => {
        const discount = discounts.find((d) => String(d._id) === String(id));
        return discount?.name || null;
      })
      .filter((name): name is string => name !== null);
  };

  if (loading) {
    return (
      <div className={`text-center ${className}`}>
        <div className="text-sm text-gray-500">프리셋 로딩 중...</div>
      </div>
    );
  }

  if (presets.length === 0) {
    return null; // 프리셋이 없으면 아예 표시하지 않음
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowPresets(!showPresets)}
        className="w-full px-4 py-3 bg-purple-50 text-[#7C3FBF] rounded-xl font-semibold hover:bg-purple-100 transition-colors flex items-center justify-between"
      >
        <span>💜 내 프리셋 불러오기</span>
        <svg
          className={`w-5 h-5 transition-transform ${showPresets ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showPresets && (
        <>
          {/* 오버레이 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowPresets(false)}
          />

          {/* 프리셋 드롭다운 */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-purple-200 rounded-xl shadow-xl z-20 max-h-96 overflow-y-auto">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                저장된 프리셋 ({presets.length})
              </div>
              {presets.map((preset) => {
                const discountNames = getDiscountNames(preset.selectedDiscountIds);
                return (
                  <button
                    key={String(preset._id)}
                    onClick={() => handleSelectPreset(preset)}
                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {preset.emoji && (
                        <span className="text-2xl">{preset.emoji}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 mb-1">
                          {preset.name}
                        </div>
                        {preset.description && (
                          <div className="text-xs text-gray-600 mb-2">
                            {preset.description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {discountNames.slice(0, 3).map((name, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded"
                            >
                              {name}
                            </span>
                          ))}
                          {discountNames.length > 3 && (
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                              +{discountNames.length - 3}
                            </span>
                          )}
                        </div>
                        {preset.usageCount > 0 && (
                          <div className="text-xs text-gray-500 mt-2">
                            사용 횟수: {preset.usageCount}회
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-gray-200 p-2">
              <a
                href="/settings/presets"
                className="block w-full px-3 py-2 text-center text-sm text-[#7C3FBF] hover:bg-purple-50 rounded-lg font-medium transition-colors"
              >
                프리셋 관리하기 →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
