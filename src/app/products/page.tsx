'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import * as clientDb from '@/lib/clientDb';
import { ICart } from '@/types/cart';
import Toast from '@/components/Toast';

interface Product {
  _id: string;
  barcode: string;
  name: string;
  price: number;
  category?: string;
  brand?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [carts, setCarts] = useState<ICart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    fetchProducts();
    loadCarts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCarts = () => {
    const localCarts = clientDb.getCarts();
    setCarts(localCarts);
  };

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedProduct(product);
    setShowCartModal(true);
  };

  const categories = ['전체', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === '전체' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] rounded-xl flex items-center justify-center font-bold text-lg text-white">
                CU
              </div>
              <h1 className="text-xl font-bold text-gray-900">상품 검색</h1>
            </Link>
            <Link href="/carts" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* 검색 및 필터 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          {/* 검색바 */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="상품명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-[#7C3FBF] focus:outline-none transition-colors text-lg"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* 카테고리 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* 결과 수 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-600">
            총 <span className="font-bold text-[#7C3FBF]">{filteredProducts.length}</span>개 상품
          </p>
        </div>

        {/* 상품 목록 */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-[#7C3FBF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 text-lg">검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product._id}
                className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 group relative"
              >
                {/* 상품 이미지 플레이스홀더 */}
                <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-4 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>

                {/* 카테고리 */}
                {product.category && (
                  <span className="inline-block px-3 py-1 bg-purple-100 text-[#7C3FBF] text-xs font-semibold rounded-lg mb-2">
                    {product.category}
                  </span>
                )}

                {/* 상품명 */}
                <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-[#7C3FBF] transition-colors">
                  {product.name}
                </h3>

                {/* 브랜드 */}
                {product.brand && (
                  <p className="text-sm text-gray-500 mb-3">{product.brand}</p>
                )}

                {/* 가격 */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold text-gray-900">
                    {product.price.toLocaleString()}
                    <span className="text-base font-normal text-gray-600">원</span>
                  </span>
                </div>

                {/* 바코드 */}
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <p className="text-xs text-gray-400 font-mono">{product.barcode}</p>
                </div>

                {/* 장바구니 추가 버튼 */}
                <button
                  onClick={(e) => handleAddToCart(product, e)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  장바구니 담기
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 장바구니 선택 모달 */}
      {showCartModal && selectedProduct && (
        <AddToCartModal
          product={selectedProduct}
          carts={carts}
          onClose={() => {
            setShowCartModal(false);
            setSelectedProduct(null);
          }}
          onSuccess={(productName) => {
            loadCarts();
            setShowCartModal(false);
            setSelectedProduct(null);
            setToast({ message: `"${productName}"이(가) 장바구니에 추가되었습니다!`, type: 'success' });
          }}
        />
      )}

      {/* 토스트 알림 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-4 py-3">
            <Link href="/" className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#7C3FBF] transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs font-medium">홈</span>
            </Link>
            <Link href="/products" className="flex flex-col items-center gap-1 text-[#7C3FBF] transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs font-medium">검색</span>
            </Link>
            <Link href="/scan" className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#7C3FBF] transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="text-xs font-medium">스캔</span>
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
}

// 장바구니 추가 모달
function AddToCartModal({
  product,
  carts,
  onClose,
  onSuccess,
}: {
  product: Product;
  carts: ICart[];
  onClose: () => void;
  onSuccess: (productName: string) => void;
}) {
  const [selectedCartId, setSelectedCartId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 메인 카트가 있으면 자동 선택
    const mainCart = carts.find(c => c.isMain);
    if (mainCart) {
      setSelectedCartId(String(mainCart._id));
    } else if (carts.length > 0) {
      setSelectedCartId(String(carts[0]._id));
    }
  }, [carts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCartId) {
      alert('장바구니를 선택해주세요.');
      return;
    }

    if (quantity < 1) {
      alert('수량은 1개 이상이어야 합니다.');
      return;
    }

    try {
      setSaving(true);

      const result = clientDb.addItemToCart(selectedCartId, {
        productId: product._id,
        barcode: product.barcode,
        name: product.name,
        price: product.price,
        quantity,
        category: product.category,
        brand: product.brand,
        selectedDiscountIds: [],
      });

      if (result) {
        onSuccess(product.name);
      } else {
        alert('장바구니 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      alert('장바구니 추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (carts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">장바구니가 없습니다</h2>
          <p className="text-gray-600 mb-6">
            먼저 장바구니를 만들어주세요.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
            <Link
              href="/carts"
              className="flex-1 px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors text-center"
            >
              장바구니 만들기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          {/* 모달 헤더 */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">장바구니에 추가</h2>
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
            {/* 상품 정보 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-bold text-gray-900 mb-1">{product.name}</h3>
              <p className="text-lg font-bold text-[#7C3FBF]">
                {product.price.toLocaleString()}원
              </p>
            </div>

            {/* 장바구니 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                장바구니 선택
              </label>
              <select
                value={selectedCartId}
                onChange={(e) => setSelectedCartId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                required
              >
                {carts.map((cart) => (
                  <option key={String(cart._id)} value={String(cart._id)}>
                    {cart.emoji} {cart.name || '이름 없는 카트'}
                    {cart.isMain ? ' ⭐' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 수량 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                수량
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                  min="1"
                  required
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* 합계 */}
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">합계</span>
                <span className="text-2xl font-bold text-[#7C3FBF]">
                  {(product.price * quantity).toLocaleString()}원
                </span>
              </div>
            </div>
          </div>

          {/* 모달 푸터 */}
          <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving ? '추가 중...' : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
