'use client';

import { useState, useEffect, useMemo } from 'react';
import { IPreset } from '@/types/preset';
import { IDiscountRule } from '@/types/discount';
import * as clientDb from '@/lib/clientDb';

interface PresetSelectorProps {
  selectedPresetId: string | null;
  onPresetChange: (preset: IPreset | null) => void;
  availableDiscounts?: IDiscountRule[];
}

export default function PresetSelector({ selectedPresetId, onPresetChange, availableDiscounts = [] }: PresetSelectorProps) {
  const [presets, setPresets] = useState<IPreset[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // "모든 할인 최대 적용" 특수 프리셋 생성 (메모이제이션)
  const maxDiscountPreset = useMemo((): IPreset | null => {
    if (availableDiscounts.length === 0) return null;

    return {
      _id: '__MAX_DISCOUNT__',
      name: '모든 할인 최대 적용',
      emoji: '🔥',
      description: '사용 가능한 모든 할인을 적용하여 최대 절약 금액을 확인합니다',
      discountIds: availableDiscounts.map(d => d._id),
      paymentMethods: [],
      subscriptions: [],
      isDefault: false,
      hasQRScanner: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }, [availableDiscounts]);

  // 프리셋 목록 로드
  useEffect(() => {
    const loadedPresets = clientDb.getPresets();
    setPresets(loadedPresets);
  }, []);

  // 초기 자동 선택
  useEffect(() => {
    if (selectedPresetId) return; // 이미 선택되어 있으면 스킵

    const loadedPresets = clientDb.getPresets();
    const lastUsedPresetId = clientDb.getLastUsedPresetId();

    if (lastUsedPresetId === '__MAX_DISCOUNT__') {
      // 마지막으로 사용한 것이 "모든 할인 최대 적용" 프리셋
      if (maxDiscountPreset) {
        // maxDiscountPreset이 준비되면 선택
        onPresetChange(maxDiscountPreset);
      }
      // maxDiscountPreset이 아직 null이면 다음 렌더링에서 처리됨
      return;
    }

    if (lastUsedPresetId) {
      // 일반 프리셋
      const lastUsedPreset = clientDb.getPreset(lastUsedPresetId);
      if (lastUsedPreset) {
        onPresetChange(lastUsedPreset);
        return;
      }
    }

    // fallback: 첫 번째 프리셋 선택
    if (loadedPresets.length > 0) {
      onPresetChange(loadedPresets[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDiscountPreset]); // maxDiscountPreset이 생성되면 다시 실행

  const selectedPreset = selectedPresetId === '__MAX_DISCOUNT__'
    ? maxDiscountPreset
    : presets.find(p => String(p._id) === selectedPresetId);

  const handlePresetSelect = (preset: IPreset) => {
    onPresetChange(preset);
    setIsOpen(false);
  };

  const handleClearPreset = () => {
    onPresetChange(null);
    setIsOpen(false);
  };

  if (presets.length === 0 && !maxDiscountPreset) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">⚠️</div>
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-1">프리셋이 없습니다</h3>
            <p className="text-sm text-yellow-700 mb-3">
              할인 계산을 위해 먼저 프리셋을 등록해주세요.
            </p>
            <a
              href="/settings/presets"
              className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
            >
              프리셋 등록하러 가기
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">할인 프리셋</h3>
        {selectedPreset && (
          <button
            onClick={handleClearPreset}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            선택 해제
          </button>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
        >
          {selectedPreset ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-2xl flex-shrink-0">{selectedPreset.emoji || '📋'}</span>
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {selectedPreset.name}
                </div>
                {selectedPreset.description && (
                  <div className="text-xs text-gray-500 truncate">{selectedPreset.description}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-2xl">📋</span>
              <span>프리셋 선택</span>
            </div>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
              {/* 모든 할인 최대 적용 옵션 */}
              {maxDiscountPreset && (
                <button
                  key={String(maxDiscountPreset._id)}
                  onClick={() => handlePresetSelect(maxDiscountPreset)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-orange-50 transition-colors border-b border-orange-100 bg-gradient-to-r from-orange-50 to-red-50 ${
                    String(maxDiscountPreset._id) === selectedPresetId ? 'bg-orange-100' : ''
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{maxDiscountPreset.emoji}</span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-bold text-gray-900 truncate flex items-center gap-2">
                      {maxDiscountPreset.name}
                      <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded font-semibold">
                        추천
                      </span>
                    </div>
                    {maxDiscountPreset.description && (
                      <div className="text-xs text-gray-600 truncate">{maxDiscountPreset.description}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-orange-700 font-medium">
                      <span>전체 할인 {availableDiscounts.length}개 적용</span>
                    </div>
                  </div>
                  {String(maxDiscountPreset._id) === selectedPresetId && (
                    <svg className="w-5 h-5 text-orange-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )}

              {/* 사용자 정의 프리셋 */}
              {presets.map((preset) => (
                <button
                  key={String(preset._id)}
                  onClick={() => handlePresetSelect(preset)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                    String(preset._id) === selectedPresetId ? 'bg-purple-50' : ''
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{preset.emoji || '📋'}</span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {preset.name}
                    </div>
                    {preset.description && (
                      <div className="text-xs text-gray-500 truncate">{preset.description}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      {preset.paymentMethods && preset.paymentMethods.length > 0 && (
                        <span>결제수단 {preset.paymentMethods.length}개</span>
                      )}
                      {preset.subscriptions && preset.subscriptions.length > 0 && (
                        <span>구독 {preset.subscriptions.length}개</span>
                      )}
                    </div>
                  </div>
                  {String(preset._id) === selectedPresetId && (
                    <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedPreset && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {selectedPresetId === '__MAX_DISCOUNT__' ? (
            <div className="text-xs text-orange-700 space-y-1">
              <div className="font-semibold">사용 가능한 모든 할인 {availableDiscounts.length}개가 적용됩니다</div>
              <div className="text-gray-500">최대 절약 금액을 확인할 수 있습니다</div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 space-y-1">
              {selectedPreset.paymentMethods && selectedPreset.paymentMethods.length > 0 && (
                <div>등록된 결제수단: {selectedPreset.paymentMethods.length}개</div>
              )}
              {selectedPreset.subscriptions && selectedPreset.subscriptions.length > 0 && (
                <div>활성 구독: {selectedPreset.subscriptions.filter(s => s.isActive).length}개</div>
              )}
              {selectedPreset.hasQRScanner && (
                <div className="text-purple-600">포켓CU 앱 사용 가능</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
