'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ICart, CART_COLORS } from '@/types/cart';

interface CartComparison {
  cart: ICart;
  totalOriginalPrice: number;
  totalFinalPrice: number;
  totalDiscount: number;
  totalDiscountRate: number;
}

interface ComparisonResult {
  carts: CartComparison[];
  bestCart?: {
    cartId: string;
    cartName: string;
    savings: number;
  };
}

export default function CompareCartsPage() {
  const [carts, setCarts] = useState<ICart[]>([]);
  const [selectedCartIds, setSelectedCartIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    fetchCarts();
  }, []);

  const fetchCarts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/carts');
      const data = await response.json();
      if (data.success) {
        setCarts(data.data);
        // 기본적으로 모든 카트 선택
        setSelectedCartIds(data.data.map((c: ICart) => String(c._id)));
      }
    } catch (error) {
      console.error('Failed to fetch carts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (selectedCartIds.length < 2) {
      alert('최소 2개의 카트를 선택해주세요.');
      return;
    }

    try {
      setComparing(true);
      const response = await fetch('/api/carts/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartIds: selectedCartIds }),
      });

      const data = await response.json();
      if (data.success) {
        setComparison(data.data);
      } else {
        alert('비교에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to compare carts:', error);
      alert('비교에 실패했습니다.');
    } finally {
      setComparing(false);
    }
  };

  const toggleCart = (cartId: string) => {
    if (selectedCartIds.includes(cartId)) {
      setSelectedCartIds(selectedCartIds.filter((id) => id !== cartId));
    } else {
      setSelectedCartIds([...selectedCartIds, cartId]);
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
                <h1 className="text-gray-900 font-bold text-xl">카트 비교</h1>
                <p className="text-gray-500 text-xs">최적의 할인 조합 찾기</p>
              </div>
            </div>
            <Link
              href="/carts"
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              ← 카트 목록
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 카트 없음 */}
        {!loading && carts.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-2xl">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">비교할 카트가 없습니다</h3>
            <p className="text-gray-600 mb-6">
              최소 2개의 카트를 만들어야 비교할 수 있습니다.
            </p>
            <Link
              href="/carts"
              className="inline-block px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors"
            >
              카트 만들러 가기
            </Link>
          </div>
        )}

        {/* 카트 선택 섹션 */}
        {!loading && carts.length > 0 && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">비교할 카트 선택</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {carts.map((cart) => {
                  const isSelected = selectedCartIds.includes(String(cart._id));
                  const colorScheme = cart.color ? CART_COLORS[cart.color] : CART_COLORS.purple;

                  return (
                    <button
                      key={String(cart._id)}
                      onClick={() => toggleCart(String(cart._id))}
                      className={`${
                        isSelected ? colorScheme.bg : 'bg-gray-50'
                      } border-2 ${
                        isSelected ? colorScheme.border : 'border-gray-200'
                      } rounded-xl p-4 text-left transition-all hover:shadow-lg`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {cart.emoji && <span className="text-2xl">{cart.emoji}</span>}
                          <span className="font-bold text-gray-900">{cart.name}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-5 h-5 text-[#7C3FBF] border-gray-300 rounded"
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        {cart.items.length}개 상품, {cart.items.reduce((sum, item) => sum + item.quantity, 0)}개 수량
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-gray-600">
                  {selectedCartIds.length}개 카트 선택됨
                </p>
                <button
                  onClick={handleCompare}
                  disabled={selectedCartIds.length < 2 || comparing}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {comparing ? '비교 중...' : '비교하기'}
                </button>
              </div>
            </div>

            {/* 비교 결과 */}
            {comparison && (
              <div className="space-y-8">
                {/* 최고 절약 카트 */}
                {comparison.bestCart && (
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-4xl">🏆</span>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">최고 절약 카트</h3>
                        <p className="text-gray-600">가장 많이 절약할 수 있는 조합입니다</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-gray-900">
                          {comparison.bestCart.cartName}
                        </span>
                        <span className="text-2xl font-bold text-orange-600">
                          {comparison.bestCart.savings.toLocaleString()}원 절약
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 상세 비교 */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">상세 비교</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {comparison.carts.map((result, idx) => {
                      const colorScheme = result.cart.color
                        ? CART_COLORS[result.cart.color]
                        : CART_COLORS.purple;
                      const isBest =
                        comparison.bestCart &&
                        String(result.cart._id) === String(comparison.bestCart.cartId);

                      return (
                        <div
                          key={String(result.cart._id)}
                          className={`${colorScheme.bg} border-2 ${colorScheme.border} rounded-2xl p-6 ${
                            isBest ? 'ring-4 ring-yellow-300' : ''
                          }`}
                        >
                          {isBest && (
                            <div className="mb-4 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-lg text-sm font-semibold inline-block">
                              🏆 최고 절약
                            </div>
                          )}

                          {/* 카트 정보 */}
                          <div className="flex items-center gap-3 mb-4">
                            {result.cart.emoji && (
                              <span className="text-3xl">{result.cart.emoji}</span>
                            )}
                            <h4 className="text-xl font-bold text-gray-900">
                              {result.cart.name}
                            </h4>
                          </div>

                          {/* 가격 정보 */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">정가:</span>
                              <span className="text-lg font-semibold text-gray-900">
                                {result.totalOriginalPrice.toLocaleString()}원
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">할인액:</span>
                              <span className="text-lg font-semibold text-red-600">
                                -{result.totalDiscount.toLocaleString()}원
                              </span>
                            </div>

                            <div className={`${colorScheme.badge} rounded-xl p-4`}>
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-700">최종 금액:</span>
                                <span className={`text-2xl font-bold ${colorScheme.text}`}>
                                  {result.totalFinalPrice.toLocaleString()}원
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 text-right mt-1">
                                ({(result.totalDiscountRate * 100).toFixed(1)}% 할인)
                              </div>
                            </div>
                          </div>

                          {/* 카트 상세 */}
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                              {result.cart.items.length}개 상품,{' '}
                              {result.cart.items.reduce((sum, item) => sum + item.quantity, 0)}개 수량
                            </div>
                          </div>

                          {/* 상세보기 버튼 */}
                          <Link
                            href={`/carts/${result.cart._id}`}
                            className={`mt-4 block w-full px-4 py-2 ${colorScheme.badge} ${colorScheme.text} rounded-lg font-medium hover:opacity-80 transition-opacity text-center`}
                          >
                            상세보기
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 비교 차트 (간단한 바 차트) */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">절약 비교</h3>
                  <div className="space-y-4">
                    {comparison.carts
                      .sort((a, b) => b.totalDiscount - a.totalDiscount)
                      .map((result) => {
                        const maxDiscount = Math.max(...comparison.carts.map((c) => c.totalDiscount));
                        const percentage = (result.totalDiscount / maxDiscount) * 100;
                        const colorScheme = result.cart.color
                          ? CART_COLORS[result.cart.color]
                          : CART_COLORS.purple;

                        return (
                          <div key={String(result.cart._id)}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {result.cart.emoji && (
                                  <span className="text-xl">{result.cart.emoji}</span>
                                )}
                                <span className="font-semibold text-gray-900">
                                  {result.cart.name}
                                </span>
                              </div>
                              <span className={`font-bold ${colorScheme.text}`}>
                                {result.totalDiscount.toLocaleString()}원
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                              <div
                                className={`${colorScheme.badge} h-full flex items-center justify-end px-2 transition-all duration-500`}
                                style={{ width: `${percentage}%` }}
                              >
                                <span className="text-xs font-semibold text-gray-700">
                                  {percentage.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
