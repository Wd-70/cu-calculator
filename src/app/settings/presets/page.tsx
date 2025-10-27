'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IPreset, PaymentMethodInfo, UserSubscription } from '@/types/preset';
import { IDiscountRule, DISCOUNT_CATEGORY_NAMES } from '@/types/discount';
import { PAYMENT_METHOD_NAMES } from '@/types/payment';
import * as clientDb from '@/lib/clientDb';

const EMOJI_PRESETS = ['🛒', '🏃', '🍱', '☕', '🌙', '💼', '🎉', '🎯'];

const COLOR_PRESETS = [
  { name: 'purple', label: '보라', bg: 'bg-purple-500', text: 'text-purple-500' },
  { name: 'blue', label: '파랑', bg: 'bg-blue-500', text: 'text-blue-500' },
  { name: 'green', label: '초록', bg: 'bg-green-500', text: 'text-green-500' },
  { name: 'orange', label: '오렌지', bg: 'bg-orange-500', text: 'text-orange-500' },
  { name: 'pink', label: '핑크', bg: 'bg-pink-500', text: 'text-pink-500' },
  { name: 'red', label: '빨강', bg: 'bg-red-500', text: 'text-red-500' },
];

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

      // 서버 데이터 (할인 규칙)
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
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
                <p className="text-gray-500 text-xs">결제수단과 구독을 등록하고 최적 할인을 자동으로 찾아보세요</p>
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

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* 헤더 섹션 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">프리셋 관리</h2>
              <p className="text-gray-600 mt-2">
                결제수단과 구독을 등록하면 장바구니에서 최적의 할인 조합을 자동으로 찾아드립니다
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
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">저장된 프리셋이 없습니다</h3>
            <p className="text-gray-600 mb-6">
              자주 사용하는 결제수단과 구독을 프리셋으로 저장해보세요!
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
          <div className="grid gap-6 md:grid-cols-2">
            {presets.map((preset) => (
              <PresetCard
                key={String(preset._id)}
                preset={preset}
                discounts={discounts}
                onEdit={() => {
                  setEditingPreset(preset);
                  setShowCreateModal(true);
                }}
                onDelete={() => handleDelete(String(preset._id))}
                onSetDefault={() => {
                  clientDb.updatePreset(String(preset._id), { isDefault: true });
                  setPresets(clientDb.getPresets());
                }}
                getDiscountName={getDiscountName}
              />
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

// 프리셋 카드 컴포넌트
function PresetCard({
  preset,
  discounts,
  onEdit,
  onDelete,
  onSetDefault,
  getDiscountName,
}: {
  preset: IPreset;
  discounts: IDiscountRule[];
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  getDiscountName: (id: string) => string;
}) {
  const colorConfig = COLOR_PRESETS.find((c) => c.name === preset.color) || COLOR_PRESETS[0];

  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-[#7C3FBF] transition-all hover:shadow-xl">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {preset.emoji && (
            <span className="text-4xl">{preset.emoji}</span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-gray-900">
                {preset.name}
              </h3>
              <span className={`w-3 h-3 rounded-full ${colorConfig.bg}`}></span>
            </div>
            {preset.description && (
              <p className="text-sm text-gray-600 mt-1">
                {preset.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-[#7C3FBF] hover:bg-purple-50 rounded-lg transition-colors"
            title="수정"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="삭제"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* 기본 프리셋 배지 */}
      {preset.isDefault && (
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          기본 프리셋
        </div>
      )}

      {/* QR 스캐너 */}
      {preset.hasQRScanner && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          포켓CU QR
        </div>
      )}

      {/* 결제수단 */}
      {preset.paymentMethods && preset.paymentMethods.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">결제수단</h4>
          <div className="space-y-2">
            {preset.paymentMethods.map((pm, idx) => {
              const details = [];

              // 채널 정보 (카드/머니/포인트)
              if (pm.channel) {
                const channelNames: Record<string, string> = {
                  card: '카드',
                  money: '머니/포인트',
                };
                details.push(channelNames[pm.channel] || pm.channel);
              }

              // 카드사
              if (pm.cardIssuer) {
                const issuerNames: Record<string, string> = {
                  shinhan: '신한',
                  bc: 'BC',
                  samsung: '삼성',
                  hana: '하나',
                  woori: '우리',
                  kb: 'KB국민',
                  hyundai: '현대',
                  nh: 'NH농협',
                  ibk: 'IBK기업은행',
                  suhyup: '수협',
                };
                details.push(issuerNames[pm.cardIssuer] || pm.cardIssuer);
              }

              // BC카드 여부 (카드사가 BC가 아닌데 BC카드를 사용하는 경우)
              if (pm.isBCCard && pm.cardIssuer !== 'bc') {
                details.push('BC카드');
              }

              // 카드 종류 (기본 신용카드가 아닌 경우만)
              if (pm.cardType && pm.cardType !== 'personal_credit') {
                const typeNames: Record<string, string> = {
                  personal_credit: '개인신용',
                  personal_check: '개인체크',
                  corporate: '법인',
                  prepaid: '선불',
                  gift: '기프트',
                };
                details.push(typeNames[pm.cardType] || pm.cardType);
              }

              return (
                <div
                  key={idx}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    pm.isDefault
                      ? 'bg-blue-500 text-white'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  <div className="font-medium">
                    {pm.nickname || PAYMENT_METHOD_NAMES[pm.method]}
                    {pm.isDefault && ' ⭐'}
                  </div>
                  {details.length > 0 && (
                    <div className={`text-xs mt-1 ${pm.isDefault ? 'text-blue-100' : 'text-blue-600'}`}>
                      {details.join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 구독/멤버십 */}
      {preset.subscriptions && preset.subscriptions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">구독 · 멤버십</h4>
          <div className="space-y-2">
            {preset.subscriptions.map((sub, idx) => (
              <div
                key={idx}
                className={`px-3 py-2 rounded-lg text-sm ${
                  sub.isActive
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <div className="font-medium">{sub.name}</div>
                {sub.dailyUsageRemaining !== undefined && (
                  <div className="text-xs mt-1">
                    오늘 {sub.dailyUsageRemaining}회 남음
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      {!preset.isDefault && (
        <div className="border-t border-gray-200 pt-3 mt-3">
          <button
            onClick={onSetDefault}
            className="w-full px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg font-medium hover:bg-yellow-100 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            기본 프리셋으로 설정
          </button>
        </div>
      )}

      {/* 사용 통계 */}
      <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-200 pt-3 mt-3">
        {preset.usageCount !== undefined && preset.usageCount > 0 && (
          <span>사용 {preset.usageCount}회</span>
        )}
        {preset.lastUsedAt && (
          <span>최근 사용: {new Date(preset.lastUsedAt).toLocaleDateString()}</span>
        )}
      </div>
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
  const [currentTab, setCurrentTab] = useState<'basic' | 'payment' | 'subscription'>('basic');

  // 랜덤 이모지와 색상 선택 (새 프리셋 생성 시에만)
  const getRandomEmoji = () => EMOJI_PRESETS[Math.floor(Math.random() * EMOJI_PRESETS.length)];
  const getRandomColor = () => COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)].name;
  const getDefaultName = () => '내 프리셋';

  // 기본 정보
  const [name, setName] = useState(preset?.name || getDefaultName());
  const [emoji, setEmoji] = useState(preset?.emoji || getRandomEmoji());
  const [color, setColor] = useState(preset?.color || getRandomColor());
  const [description, setDescription] = useState(preset?.description || '');
  const [hasQRScanner, setHasQRScanner] = useState(preset?.hasQRScanner || false);

  // 결제수단 목록
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInfo[]>(
    preset?.paymentMethods || []
  );

  // 구독 목록
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>(
    preset?.subscriptions || []
  );

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('프리셋 이름을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);

      const presetData = {
        name: name.trim(),
        emoji: emoji.trim() || undefined,
        color,
        description: description.trim() || undefined,
        paymentMethods,
        subscriptions,
        hasQRScanner,
      };

      if (preset) {
        clientDb.updatePreset(String(preset._id), presetData);
      } else {
        clientDb.createPreset(presetData);
      }

      onSuccess();
    } catch (error) {
      console.error('Failed to save preset:', error);
      alert('프리셋 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* 모달 헤더 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
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

            {/* 탭 */}
            <div className="flex gap-4 mt-4 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setCurrentTab('basic')}
                className={`pb-3 px-2 font-semibold transition-colors border-b-2 ${
                  currentTab === 'basic'
                    ? 'text-[#7C3FBF] border-[#7C3FBF]'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                기본 정보
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('payment')}
                className={`pb-3 px-2 font-semibold transition-colors border-b-2 ${
                  currentTab === 'payment'
                    ? 'text-[#7C3FBF] border-[#7C3FBF]'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                결제수단 ({paymentMethods.length})
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('subscription')}
                className={`pb-3 px-2 font-semibold transition-colors border-b-2 ${
                  currentTab === 'subscription'
                    ? 'text-[#7C3FBF] border-[#7C3FBF]'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                구독/멤버십 ({subscriptions.length})
              </button>
            </div>
          </div>

          {/* 모달 본문 */}
          <div className="flex-1 overflow-y-auto p-6">
            {currentTab === 'basic' && (
              <BasicInfoTab
                name={name}
                setName={setName}
                emoji={emoji}
                setEmoji={setEmoji}
                color={color}
                setColor={setColor}
                description={description}
                setDescription={setDescription}
                hasQRScanner={hasQRScanner}
                setHasQRScanner={setHasQRScanner}
              />
            )}

            {currentTab === 'payment' && (
              <PaymentMethodsTab
                paymentMethods={paymentMethods}
                setPaymentMethods={setPaymentMethods}
              />
            )}

            {currentTab === 'subscription' && (
              <SubscriptionsTab
                subscriptions={subscriptions}
                setSubscriptions={setSubscriptions}
                discounts={discounts}
              />
            )}
          </div>

          {/* 모달 푸터 */}
          <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
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

// 기본 정보 탭
function BasicInfoTab({
  name,
  setName,
  emoji,
  setEmoji,
  color,
  setColor,
  description,
  setDescription,
  hasQRScanner,
  setHasQRScanner,
}: {
  name: string;
  setName: (v: string) => void;
  emoji: string;
  setEmoji: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  hasQRScanner: boolean;
  setHasQRScanner: (v: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          프리셋 이름 *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 출근길 조합, 점심 도시락"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          이모지
        </label>
        <div className="flex gap-2">
          {EMOJI_PRESETS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`w-12 h-12 text-2xl rounded-xl border-2 transition-all ${
                emoji === e
                  ? 'border-[#7C3FBF] bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {e}
            </button>
          ))}
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="직접 입력"
            className="w-20 px-3 py-2 border border-gray-300 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
            maxLength={2}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          색상
        </label>
        <div className="flex gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setColor(c.name)}
              className={`w-10 h-10 rounded-full ${c.bg} border-2 transition-all ${
                color === c.name
                  ? 'border-gray-900 scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              title={c.label}
            />
          ))}
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
          rows={3}
        />
      </div>

      <div>
        <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={hasQRScanner}
            onChange={(e) => setHasQRScanner(e.target.checked)}
            className="w-5 h-5 text-[#7C3FBF] border-gray-300 rounded focus:ring-[#7C3FBF]"
          />
          <div>
            <div className="font-semibold text-gray-900">포켓CU 앱 사용</div>
            <div className="text-sm text-gray-600">QR 스캐너 기능을 사용할 수 있습니다</div>
          </div>
        </label>
      </div>
    </div>
  );
}

// 결제수단 탭
function PaymentMethodsTab({
  paymentMethods,
  setPaymentMethods,
}: {
  paymentMethods: PaymentMethodInfo[];
  setPaymentMethods: (v: PaymentMethodInfo[]) => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAdd = (pm: PaymentMethodInfo) => {
    setPaymentMethods([...paymentMethods, pm]);
    setShowAddModal(false);
  };

  const handleRemove = (index: number) => {
    setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
  };

  const handleSetDefault = (index: number) => {
    setPaymentMethods(
      paymentMethods.map((pm, i) => ({
        ...pm,
        isDefault: i === index,
      }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          사용 가능한 결제수단을 등록하세요. 자동으로 최적의 할인을 찾아드립니다.
        </p>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#7C3FBF] text-white rounded-lg font-medium hover:bg-[#6B2FAF] transition-colors"
        >
          + 추가
        </button>
      </div>

      {paymentMethods.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-500">등록된 결제수단이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((pm, index) => (
            <div
              key={index}
              className={`p-4 border-2 rounded-xl ${
                pm.isDefault
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {pm.nickname || PAYMENT_METHOD_NAMES[pm.method]}
                    {pm.isDefault && (
                      <span className="ml-2 text-sm text-blue-600">⭐ 기본</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {PAYMENT_METHOD_NAMES[pm.method]}
                    {pm.channel && pm.channel === 'card' && ' · 카드'}
                    {pm.channel && pm.channel === 'money' && ' · 머니/포인트'}
                    {pm.cardIssuer && ` · ${
                      pm.cardIssuer === 'shinhan' ? '신한' :
                      pm.cardIssuer === 'bc' ? 'BC' :
                      pm.cardIssuer === 'samsung' ? '삼성' :
                      pm.cardIssuer === 'hana' ? '하나' :
                      pm.cardIssuer === 'woori' ? '우리' :
                      pm.cardIssuer === 'kb' ? 'KB국민' :
                      pm.cardIssuer === 'hyundai' ? '현대' :
                      pm.cardIssuer === 'nh' ? 'NH농협' :
                      pm.cardIssuer === 'ibk' ? 'IBK기업은행' :
                      pm.cardIssuer === 'suhyup' ? '수협' : pm.cardIssuer
                    }`}
                    {pm.isBCCard && pm.cardIssuer !== 'bc' && ' · BC카드'}
                    {pm.cardType && pm.cardType !== 'personal_credit' && ` · ${pm.cardType === 'personal_check' ? '개인체크' : pm.cardType === 'corporate' ? '법인' : pm.cardType === 'prepaid' ? '선불' : '기프트'}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!pm.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(index)}
                      className="text-xs px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      기본 설정
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddPaymentMethodModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}

// 결제수단 추가 모달
function AddPaymentMethodModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (pm: PaymentMethodInfo) => void;
}) {
  const [method, setMethod] = useState<string>('');
  const [nickname, setNickname] = useState('');
  const [channel, setChannel] = useState<string>('');
  const [cardIssuer, setCardIssuer] = useState<string>('');
  const [cardType, setCardType] = useState<string>('personal_credit'); // 기본값: 개인 신용카드
  const [isBCCard, setIsBCCard] = useState<boolean>(false); // BC카드 여부

  // 일반 카드 선택 (카드사를 별도로 선택)
  const isGeneralCard = method === 'card';

  // 페이 앱 선택 (삼성/네이버/카카오페이)
  const isSamsungPay = method === 'samsung_pay';
  const isNaverPay = method === 'naver_pay';
  const isKakaoPay = method === 'kakao_pay';
  const isPayApp = isSamsungPay || isNaverPay || isKakaoPay;

  const handleSubmit = () => {
    if (!method) {
      alert('결제수단을 선택해주세요.');
      return;
    }

    // 일반 카드 선택 시 카드사 체크
    if (isGeneralCard && !cardIssuer) {
      alert('카드사를 선택해주세요.');
      return;
    }

    // 페이 앱 사용 시 결제 방법 체크
    if (isPayApp && !channel) {
      alert('결제 방법을 선택해주세요.');
      return;
    }

    // 페이 앱에서 카드 선택 시 카드사 체크
    if (isPayApp && channel === 'card' && !cardIssuer) {
      alert('카드사를 선택해주세요.');
      return;
    }

    onAdd({
      method: method as any,
      nickname: nickname.trim() || undefined,
      channel: channel || undefined,
      cardIssuer: (isGeneralCard || (isPayApp && channel === 'card')) ? cardIssuer : undefined,
      cardType: (isGeneralCard || (isPayApp && channel === 'card')) ? cardType : undefined,
      isBCCard: isBCCard || undefined,
      isDefault: false,
    } as any);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-gray-900 mb-4">결제수단 추가</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">결제수단 *</label>
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setChannel('');
                setCardType('personal_credit');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
              required
            >
              <option value="">선택하세요</option>
              {Object.entries(PAYMENT_METHOD_NAMES).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          {/* 일반 카드 선택 시 카드사 선택 */}
          {isGeneralCard && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">카드사 *</label>
                <select
                  value={cardIssuer}
                  onChange={(e) => {
                    const newIssuer = e.target.value;
                    setCardIssuer(newIssuer);
                    // BC카드를 직접 선택하면 isBCCard를 true로 설정
                    if (newIssuer === 'bc') {
                      setIsBCCard(true);
                    } else {
                      setIsBCCard(false);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                >
                  <option value="">선택하세요</option>
                  <option value="shinhan">신한카드</option>
                  <option value="bc">BC카드</option>
                  <option value="samsung">삼성카드</option>
                  <option value="hana">하나카드</option>
                  <option value="woori">우리카드</option>
                  <option value="kb">KB국민카드</option>
                  <option value="hyundai">현대카드</option>
                  <option value="nh">NH농협카드</option>
                  <option value="ibk">IBK기업은행카드</option>
                  <option value="suhyup">수협카드</option>
                </select>
              </div>

              {/* BC카드가 아닌 다른 카드사를 선택했을 때만 BC카드 체크박스 표시 */}
              {cardIssuer && cardIssuer !== 'bc' && (
                <div>
                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={isBCCard}
                      onChange={(e) => setIsBCCard(e.target.checked)}
                      className="w-5 h-5 text-[#7C3FBF] border-gray-300 rounded focus:ring-[#7C3FBF]"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">BC카드</div>
                      <div className="text-xs text-gray-600">이 카드는 BC카드를 함께 발급받았습니다 (예: 하나BC, 우리BC)</div>
                    </div>
                  </label>
                </div>
              )}
            </>
          )}

          {/* 페이 앱 선택 시 (삼성페이, 네이버페이, 카카오페이) */}
          {isPayApp && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">결제 방법 *</label>
              <select
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value);
                  setCardIssuer('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
              >
                <option value="">선택하세요</option>
                <option value="card">등록된 카드</option>
                <option value="money">머니/포인트</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {isSamsungPay && '삼성페이에 등록된 카드 또는 삼성페이 머니'}
                {isNaverPay && '네이버페이에 등록된 카드 또는 네이버페이 포인트'}
                {isKakaoPay && '카카오페이에 등록된 카드 또는 카카오페이 머니'}
              </p>
            </div>
          )}

          {/* 페이 앱에서 카드 선택 시 카드사 선택 */}
          {isPayApp && channel === 'card' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">카드사 *</label>
                <select
                  value={cardIssuer}
                  onChange={(e) => {
                    const newIssuer = e.target.value;
                    setCardIssuer(newIssuer);
                    // BC카드를 직접 선택하면 isBCCard를 true로 설정
                    if (newIssuer === 'bc') {
                      setIsBCCard(true);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                >
                  <option value="">선택하세요</option>
                  <option value="shinhan">신한카드</option>
                  <option value="bc">BC카드</option>
                  <option value="samsung">삼성카드</option>
                  <option value="hana">하나카드</option>
                  <option value="woori">우리카드</option>
                  <option value="kb">KB국민카드</option>
                  <option value="hyundai">현대카드</option>
                  <option value="nh">NH농협카드</option>
                  <option value="ibk">IBK기업은행카드</option>
                  <option value="suhyup">수협카드</option>
                </select>
              </div>

              {/* BC카드가 아닌 다른 카드사를 선택했을 때만 BC카드 체크박스 표시 */}
              {cardIssuer && cardIssuer !== 'bc' && (
                <div>
                  <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={isBCCard}
                      onChange={(e) => setIsBCCard(e.target.checked)}
                      className="w-5 h-5 text-[#7C3FBF] border-gray-300 rounded focus:ring-[#7C3FBF]"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">BC카드</div>
                      <div className="text-xs text-gray-600">이 카드는 BC카드를 함께 발급받았습니다 (예: 하나BC, 우리BC)</div>
                    </div>
                  </label>
                </div>
              )}
            </>
          )}

          {/* 카드 선택 시 카드 종류 선택 */}
          {(isGeneralCard || (isPayApp && channel === 'card')) && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">카드 종류</label>
              <select
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
              >
                <option value="personal_credit">개인 신용카드</option>
                <option value="personal_check">개인 체크카드</option>
                <option value="corporate">법인카드</option>
                <option value="prepaid">선불카드</option>
                <option value="gift">기프트카드</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                일부 할인은 카드 종류에 제한이 있을 수 있습니다
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">별칭</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 주력 카드, 월급날 카드"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
            />
            <p className="text-xs text-gray-500 mt-1">
              미입력 시 자동으로 생성됩니다
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-[#7C3FBF] text-white rounded-lg hover:bg-[#6B2FAF] transition-colors"
            >
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 구독/멤버십 탭
function SubscriptionsTab({
  subscriptions,
  setSubscriptions,
  discounts,
}: {
  subscriptions: UserSubscription[];
  setSubscriptions: (v: UserSubscription[]) => void;
  discounts: IDiscountRule[];
}) {
  const [showAddModal, setShowAddModal] = useState(false);

  const subscriptionDiscounts = discounts.filter(
    (d) => d.config.category === 'coupon' || d.config.category === 'telecom'
  );

  const handleAdd = (sub: UserSubscription) => {
    setSubscriptions([...subscriptions, sub]);
    setShowAddModal(false);
  };

  const handleRemove = (index: number) => {
    setSubscriptions(subscriptions.filter((_, i) => i !== index));
  };

  const handleToggleActive = (index: number) => {
    setSubscriptions(
      subscriptions.map((sub, i) =>
        i === index ? { ...sub, isActive: !sub.isActive } : sub
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          가입한 구독과 멤버십을 등록하세요. 사용 횟수를 추적할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#7C3FBF] text-white rounded-lg font-medium hover:bg-[#6B2FAF] transition-colors"
        >
          + 추가
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-500">등록된 구독/멤버십이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub, index) => (
            <div
              key={index}
              className={`p-4 border-2 rounded-xl ${
                sub.isActive
                  ? 'border-purple-200 bg-purple-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{sub.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {sub.type === 'subscription' && '구독'}
                    {sub.type === 'telecom' && '통신사 할인'}
                    {sub.type === 'membership' && '멤버십'}
                    {sub.type === 'card_benefit' && '카드 혜택'}
                  </div>
                  {sub.dailyUsageRemaining !== undefined && (
                    <div className="text-sm text-gray-600 mt-1">
                      오늘 {sub.dailyUsageRemaining}회 / {sub.dailyUsageLimit}회 남음
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(index)}
                    className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                      sub.isActive
                        ? 'bg-purple-200 text-purple-700 hover:bg-purple-300'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {sub.isActive ? '활성' : '비활성'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddSubscriptionModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
          discounts={subscriptionDiscounts}
        />
      )}
    </div>
  );
}

// 구독/멤버십 추가 모달
function AddSubscriptionModal({
  onClose,
  onAdd,
  discounts,
}: {
  onClose: () => void;
  onAdd: (sub: UserSubscription) => void;
  discounts: IDiscountRule[];
}) {
  const [discountId, setDiscountId] = useState<string>('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'subscription' | 'telecom' | 'membership' | 'card_benefit'>('subscription');
  const [dailyUsageLimit, setDailyUsageLimit] = useState<number | ''>('');

  const handleSubmit = () => {
    if (!discountId) {
      alert('할인 규칙을 선택해주세요.');
      return;
    }

    const selectedDiscount = discounts.find(d => String(d._id) === discountId);

    onAdd({
      discountId,
      type,
      name: name.trim() || selectedDiscount?.name || '구독',
      dailyUsageLimit: dailyUsageLimit ? Number(dailyUsageLimit) : undefined,
      dailyUsageRemaining: dailyUsageLimit ? Number(dailyUsageLimit) : undefined,
      isActive: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-gray-900 mb-4">구독/멤버십 추가</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">할인 규칙 *</label>
            <select
              value={discountId}
              onChange={(e) => {
                setDiscountId(e.target.value);
                const selected = discounts.find(d => String(d._id) === e.target.value);
                if (selected && !name) {
                  setName(selected.name);
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
              required
            >
              <option value="">선택하세요</option>
              {discounts.map((discount) => (
                <option key={String(discount._id)} value={String(discount._id)}>
                  {discount.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="구독 이름"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">타입</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
            >
              <option value="subscription">구독</option>
              <option value="telecom">통신사 할인</option>
              <option value="membership">멤버십</option>
              <option value="card_benefit">카드 혜택</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">일일 사용 횟수</label>
            <input
              type="number"
              value={dailyUsageLimit}
              onChange={(e) => setDailyUsageLimit(e.target.value ? Number(e.target.value) : '')}
              placeholder="제한 없음"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-[#7C3FBF] text-white rounded-lg hover:bg-[#6B2FAF] transition-colors"
            >
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
