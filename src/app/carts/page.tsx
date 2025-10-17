'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ICart, CART_COLORS, CartColor } from '@/types/cart';
import { IProduct } from '@/types/product';
import { IDiscountRule } from '@/types/discount';
import * as clientDb from '@/lib/clientDb';

export default function CartsPage() {
  const [carts, setCarts] = useState<ICart[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [discounts, setDiscounts] = useState<IDiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // 클라이언트 저장소 초기화
    clientDb.initializeClientStorage();
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 클라이언트 데이터 (LocalStorage)
      const localCarts = clientDb.getCarts();
      setCarts(localCarts);

      // 서버 데이터 (공통 데이터)
      const [productsRes, discountsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/discounts'),
      ]);

      const productsData = await productsRes.json();
      const discountsData = await discountsRes.json();

      if (productsData.success) setProducts(productsData.data);
      if (discountsData.success) setDiscounts(discountsData.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('이 카트를 삭제하시겠습니까?')) return;

    const success = clientDb.deleteCart(id);
    if (success) {
      setCarts(clientDb.getCarts());
    } else {
      alert('카트 삭제에 실패했습니다.');
    }
  };

  const handleDuplicate = (cart: ICart) => {
    const newCart = clientDb.createCart({
      name: cart.name ? `${cart.name} (복사본)` : undefined,
      emoji: cart.emoji,
      description: cart.description,
      color: cart.color,
      items: cart.items,
      paymentMethod: cart.paymentMethod,
    });

    if (newCart) {
      setCarts(clientDb.getCarts());
    } else {
      alert('카트 복사에 실패했습니다.');
    }
  };

  const handleSetMain = (cartId: string) => {
    const updated = clientDb.setMainCart(cartId);
    if (updated) {
      setCarts(clientDb.getCarts());
    } else {
      alert('메인 카트 설정에 실패했습니다.');
    }
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
                <h1 className="text-gray-900 font-bold text-xl">장바구니 비교</h1>
                <p className="text-gray-500 text-xs">다양한 할인 조합 비교하기</p>
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

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 액션 버튼 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">내 장바구니</h2>
            <p className="text-gray-600 mt-2">
              여러 할인 조합을 만들어 최적의 방법을 찾아보세요
            </p>
          </div>
          <div className="flex gap-3">
            {carts.length >= 2 && (
              <Link
                href="/carts/compare"
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg"
              >
                🔍 카트 비교하기
              </Link>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors shadow-lg"
            >
              + 새 카트 만들기
            </button>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#7C3FBF] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">카트를 불러오는 중...</p>
          </div>
        )}

        {/* 카트 없음 */}
        {!loading && carts.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-2xl">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">카트가 없습니다</h3>
            <p className="text-gray-600 mb-6">
              첫 번째 카트를 만들어 할인 조합을 비교해보세요!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors"
            >
              첫 카트 만들기
            </button>
          </div>
        )}

        {/* 카트 그리드 */}
        {!loading && carts.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {carts.map((cart) => {
              const colorScheme = cart.color ? CART_COLORS[cart.color] : CART_COLORS.purple;
              const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <div
                  key={String(cart._id)}
                  className={`${colorScheme.bg} border-2 ${colorScheme.border} rounded-2xl p-6 hover:shadow-xl transition-all ${
                    cart.isMain ? 'ring-4 ring-yellow-400' : ''
                  }`}
                >
                  {/* 메인 카트 배지 */}
                  {cart.isMain && (
                    <div className="mb-3 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-lg text-sm font-semibold inline-block">
                      ⭐ 메인 카트
                    </div>
                  )}

                  {/* 카트 헤더 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {cart.emoji && (
                        <span className="text-4xl">{cart.emoji}</span>
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {cart.name || '이름 없는 카트'}
                        </h3>
                        {cart.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {cart.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 카트 통계 */}
                  <div className={`${colorScheme.badge} rounded-xl p-4 mb-4`}>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className={`text-2xl font-bold ${colorScheme.text}`}>
                          {cart.items.length}
                        </div>
                        <div className="text-xs text-gray-600">상품 종류</div>
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${colorScheme.text}`}>
                          {itemCount}
                        </div>
                        <div className="text-xs text-gray-600">총 수량</div>
                      </div>
                    </div>
                    {cart.cachedTotalFinalPrice !== undefined && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">예상 결제액:</span>
                          <span className={`text-lg font-bold ${colorScheme.text}`}>
                            {cart.cachedTotalFinalPrice.toLocaleString()}원
                          </span>
                        </div>
                        {cart.cachedTotalDiscount && cart.cachedTotalDiscount > 0 && (
                          <div className="text-xs text-gray-600 text-right mt-1">
                            {cart.cachedTotalDiscount.toLocaleString()}원 절약
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 아이템 미리보기 */}
                  {cart.items.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">담긴 상품:</h4>
                      <div className="space-y-1">
                        {cart.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="text-sm text-gray-600 flex justify-between">
                            <span className="truncate">{item.name}</span>
                            <span className="text-gray-500 ml-2">×{item.quantity}</span>
                          </div>
                        ))}
                        {cart.items.length > 3 && (
                          <div className="text-sm text-gray-500">
                            외 {cart.items.length - 3}개
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Link
                        href={`/carts/${cart._id}`}
                        className={`flex-1 px-4 py-2 ${colorScheme.badge} ${colorScheme.text} rounded-lg font-medium hover:opacity-80 transition-opacity text-center`}
                      >
                        상세보기
                      </Link>
                      <button
                        onClick={() => handleDuplicate(cart)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        title="복사"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleDelete(String(cart._id))}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                    {!cart.isMain && (
                      <button
                        onClick={() => handleSetMain(String(cart._id))}
                        className="w-full px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-medium hover:bg-yellow-200 transition-colors text-sm"
                      >
                        ⭐ 메인 카트로 설정
                      </button>
                    )}
                  </div>

                  {/* 메타 정보 */}
                  <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                    <div>최종 수정: {new Date(cart.updatedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 안내 박스 */}
        {!loading && carts.length > 0 && (
          <div className="mt-12 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">💡 카트 활용 팁</h3>
            <div className="grid md:grid-cols-2 gap-4 text-gray-700">
              <div className="flex gap-3">
                <span className="text-2xl">1️⃣</span>
                <div>
                  <strong>동일한 상품</strong>으로 다양한 할인 조합을 시도해보세요.
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">2️⃣</span>
                <div>
                  <strong>프리셋</strong>을 활용하면 빠르게 할인을 적용할 수 있어요.
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">3️⃣</span>
                <div>
                  <strong>카트 비교</strong> 기능으로 최적의 조합을 찾아보세요!
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">4️⃣</span>
                <div>
                  카트에 <strong>이모지와 색상</strong>을 설정해 쉽게 구분하세요.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 카트 생성 모달 */}
      {showCreateModal && (
        <CartCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setCarts(clientDb.getCarts());
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

// 카트 생성 모달
function CartCreateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  // 랜덤 색상 선택
  const getRandomColor = (): CartColor => {
    const colors = Object.keys(CART_COLORS) as CartColor[];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<CartColor>(getRandomColor());
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      const newCart = clientDb.createCart({
        name: name.trim() || undefined,
        emoji: emoji.trim() || undefined,
        description: description.trim() || undefined,
        color,
        items: [],
      });

      if (newCart) {
        onSuccess();
      } else {
        alert('카트 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create cart:', error);
      alert('카트 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          {/* 모달 헤더 */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">새 카트 만들기</h2>
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
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                카트 이름 (선택사항)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 통신사 할인 조합 (비워두면 자동 생성)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
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
                  placeholder="📱"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  색상
                </label>
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value as CartColor)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                >
                  {Object.keys(CART_COLORS).map((c) => (
                    <option key={c} value={c}>
                      {c}
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
                placeholder="이 카트에 대한 간단한 설명"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF] resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* 모달 푸터 */}
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
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
              {saving ? '생성 중...' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
