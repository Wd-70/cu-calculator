'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import * as clientDb from '@/lib/clientDb';
import { ICart } from '@/types/cart';
import Toast from '@/components/Toast';
import ProductDetailModal from '@/components/ProductDetailModal';
import { UNIFIED_CATEGORIES, CATEGORY_MAPPING, getUnifiedCategories, type UnifiedCategory } from '@/lib/constants/categoryMapping';
import { getCurrentUserAddress } from '@/lib/userAuth';
import { checkIsAdminClient } from '@/lib/adminAuth';
import CategoryManagementModal from '@/components/CategoryManagementModal';

interface CategoryTag {
  name: string;
  level: number;
}

interface Product {
  _id: string;
  barcode: string;
  name: string;
  price: number;
  categoryTags?: CategoryTag[];
  brand?: string;
  imageUrl?: string;
}

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [carts, setCarts] = useState<ICart[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<UnifiedCategory>('전체');
  const [originalCategories, setOriginalCategories] = useState<string[]>([]); // DB에서 가져온 원본 카테고리들
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    // 초기 로드
    setProducts([]);
    setHasMore(true);
    fetchProducts(true);
    loadCarts();
    fetchCategories();
    checkUserStatus();

    // URL 파라미터에서 검색어 가져오기
    const searchQuery = searchParams.get('search');
    if (searchQuery) {
      setSearchTerm(searchQuery);
    }
  }, [searchParams]);

  const checkUserStatus = async () => {
    const address = getCurrentUserAddress();
    setUserAddress(address);
    if (address) {
      const adminStatus = await checkIsAdminClient(address);
      setIsAdmin(adminStatus);
    }
  };

  // 검색어나 카테고리가 변경되면 재검색
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setProducts([]);
      setHasMore(true);
      fetchProducts(true);
    }, 300); // 300ms 디바운스

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedCategory]);

  // 무한 스크롤 이벤트 리스너
  useEffect(() => {
    const handleScroll = () => {
      // 페이지 끝에서 300px 이내에 도달하면 로드
      const scrollThreshold = 300;
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;

      if (
        scrollPosition >= pageHeight - scrollThreshold &&
        !loading &&
        !loadingMore &&
        hasMore
      ) {
        fetchProducts(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore, products.length]);

  // 맨 위로 가기 버튼 표시 여부
  useEffect(() => {
    const handleScroll = () => {
      // 200px 이상 스크롤하면 버튼 표시
      setShowScrollTop(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/products/categories');
      const data = await response.json();
      if (data.success) {
        // DB에서 가져온 원본 카테고리 저장
        setOriginalCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async (isInitial: boolean = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const offset = isInitial ? 0 : products.length;
      const limit = 50; // 한 번에 50개씩 로드

      // 검색 파라미터 구성
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (searchTerm) {
        params.append('name', searchTerm);
      }

      if (selectedCategory !== '전체') {
        // "기타" 카테고리는 특수 처리 (모든 카테고리가 미매핑인 상품)
        if (selectedCategory === '기타') {
          params.append('categories', '기타');
        } else {
          // 통합 카테고리를 원본 카테고리들로 변환
          const originalCategoriesForUnified = Object.entries(CATEGORY_MAPPING)
            .filter(([_, unified]) => unified === selectedCategory)
            .map(([original, _]) => original);

          // 변환된 원본 카테고리들을 모두 검색 조건에 추가
          if (originalCategoriesForUnified.length > 0) {
            originalCategoriesForUnified.forEach(cat => {
              params.append('categories', cat); // 복수형으로 변경
            });
          } else {
            // 매핑된 카테고리가 없으면 존재하지 않는 더미 카테고리로 검색 (빈 결과 반환)
            params.append('categories', '__EMPTY_CATEGORY__');
          }
        }
      }

      const response = await fetch(`/api/products?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        if (isInitial) {
          setProducts(data.data);
        } else {
          // 중복 제거: 기존 products와 새로 받은 data를 합친 후 _id 기준으로 중복 제거
          setProducts(prev => {
            const existingIds = new Set(prev.map(p => p._id));
            const newProducts = data.data.filter((p: Product) => !existingIds.has(p._id));
            return [...prev, ...newProducts];
          });
        }
        setTotal(data.total);
        setHasMore(data.data.length === limit); // 50개 미만이면 더 이상 없음
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadCarts = () => {
    const localCarts = clientDb.getCarts();
    setCarts(localCarts);
    // 메인 카트의 아이템 개수 업데이트
    const count = clientDb.getMainCartItemCount();
    setCartItemCount(count);
  };

  // 카드 클릭 시 상세 모달 열기
  const handleCardClick = (product: Product) => {
    setSelectedProduct(product);
    setShowDetailModal(true);
  };

  // 장바구니에 즉시 추가 (메인 카트에)
  const handleQuickAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // 메인 카트를 가져오거나 자동 생성
      const mainCart = clientDb.getOrCreateMainCart();

      const result = clientDb.addItemToCart(String(mainCart._id), {
        productId: product._id,
        barcode: product.barcode,
        name: product.name,
        price: product.price,
        quantity: 1,
        category: product.categoryTags?.[0]?.name,
        categoryTags: product.categoryTags,
        brand: product.brand,
        imageUrl: product.imageUrl,
        selectedDiscountIds: [],
      });

      if (result) {
        loadCarts();
        setToast({ message: `"${product.name}" 1개 추가`, type: 'success' });
      } else {
        setToast({ message: '장바구니 추가에 실패했습니다.', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      setToast({ message: '장바구니 추가에 실패했습니다.', type: 'error' });
    }
  };

  // 장바구니에서 1개 제거
  const handleRemoveFromCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // 메인 카트를 가져오거나 자동 생성
      const mainCart = clientDb.getOrCreateMainCart();

      const cartItem = mainCart.items.find(item => item.productId === product._id);
      if (!cartItem) return;

      if (cartItem.quantity > 1) {
        // 수량 1 감소
        const updatedItems = mainCart.items.map(item =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
        clientDb.updateCart(String(mainCart._id), { items: updatedItems });
      } else {
        // 아이템 제거
        const updatedItems = mainCart.items.filter(item => item.productId !== product._id);
        clientDb.updateCart(String(mainCart._id), { items: updatedItems });
      }

      loadCarts();
      setToast({ message: `"${product.name}" 1개 제거`, type: 'info' });
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      setToast({ message: '장바구니 수정에 실패했습니다.', type: 'error' });
    }
  };

  // 상세 모달에서 장바구니에 추가
  const handleAddFromModal = (quantity: number) => {
    if (!selectedProduct) return;

    try {
      // 메인 카트를 가져오거나 자동 생성
      const mainCart = clientDb.getOrCreateMainCart();

      const result = clientDb.addItemToCart(String(mainCart._id), {
        productId: selectedProduct._id,
        barcode: selectedProduct.barcode,
        name: selectedProduct.name,
        price: selectedProduct.price,
        quantity,
        category: selectedProduct.categoryTags?.[0]?.name,
        categoryTags: selectedProduct.categoryTags,
        brand: selectedProduct.brand,
        imageUrl: selectedProduct.imageUrl,
        selectedDiscountIds: [],
      });

      if (result) {
        loadCarts();
        setToast({ message: `"${selectedProduct.name}" ${quantity}개 추가`, type: 'success' });
      } else {
        setToast({ message: '장바구니 추가에 실패했습니다.', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      setToast({ message: '장바구니 추가에 실패했습니다.', type: 'error' });
    }
  };

  // 장바구니에 담긴 상품의 수량 확인
  const getCartQuantity = (productId: string): number => {
    try {
      const mainCart = clientDb.getMainCart();
      if (!mainCart) return 0;

      const cartItem = mainCart.items.find(item => item.productId === productId);
      return cartItem ? cartItem.quantity : 0;
    } catch (error) {
      return 0;
    }
  };

  // 맨 위로 스크롤
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // '+1 행사상품' 카테고리는 제외 (아직 구현되지 않음)
  const categories = UNIFIED_CATEGORIES.filter(cat => cat !== '+1 행사상품') as UnifiedCategory[];

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
            <Link href="/carts" className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[#FF3B3B] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* 검색 및 필터 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          {/* 검색바 */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="상품명 또는 바코드로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-[#7C3FBF] focus:outline-none transition-colors text-lg"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Link
              href="/scan"
              className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl hover:shadow-lg transition-all flex-shrink-0"
              title="바코드 스캔"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </Link>
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

          {/* 관리자 기능 */}
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
              >
                📂 카테고리 관리
              </button>
            </div>
          )}
        </div>

        {/* 결과 수 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-600">
            총 <span className="font-bold text-[#7C3FBF]">{total.toLocaleString()}</span>개 상품
            {products.length !== total && (
              <span className="text-sm text-gray-500 ml-2">
                (현재 {products.length.toLocaleString()}개 로드됨)
              </span>
            )}
          </p>
        </div>

        {/* 상품 목록 */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-[#7C3FBF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 text-lg mb-2">검색 결과가 없습니다</p>
            {searchTerm && (
              <>
                <p className="text-gray-500 text-sm mb-6">
                  &quot;{searchTerm}&quot; 상품이 등록되지 않았습니다
                </p>
                <Link
                  href={`/products/new?barcode=${encodeURIComponent(searchTerm)}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-bold hover:shadow-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  상품 등록하기
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map((product) => {
              const cartQuantity = getCartQuantity(product._id);
              return (
              <div
                key={product._id}
                onClick={() => handleCardClick(product)}
                className="bg-white rounded-xl p-3 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group relative"
              >
                {/* 상품 이미지 */}
                {product.imageUrl ? (
                  <div className="w-full aspect-square rounded-lg mb-2 overflow-hidden bg-gray-100">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/200x200?text=No+Image';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-2 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}

                {/* 상품명 */}
                <h3 className="font-bold text-sm text-gray-900 mb-1 line-clamp-2 group-hover:text-[#7C3FBF] transition-colors min-h-[2.5rem]">
                  {product.name}
                </h3>

                {/* 가격 */}
                <p className="text-lg font-bold text-gray-900 mb-2">
                  {product.price.toLocaleString()}
                  <span className="text-xs font-normal text-gray-600">원</span>
                </p>

                {/* 장바구니 버튼 */}
                {cartQuantity > 0 ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleRemoveFromCart(product, e)}
                      className="flex-1 px-2 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold transition-all text-sm"
                    >
                      -
                    </button>
                    <div className="flex-1 px-2 py-2 bg-purple-100 text-[#7C3FBF] rounded-lg font-bold text-center text-sm">
                      {cartQuantity}
                    </div>
                    <button
                      onClick={(e) => handleQuickAddToCart(product, e)}
                      className="flex-1 px-2 py-2 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-lg font-bold hover:shadow-lg transition-all text-sm"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleQuickAddToCart(product, e)}
                    className="w-full px-2 py-2 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-1 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    담기
                  </button>
                )}
              </div>
            );
            })}
          </div>
        )}

        {/* 더 로딩 중 표시 */}
        {loadingMore && (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-4 border-[#7C3FBF] border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">더 불러오는 중...</span>
          </div>
        )}

        {/* 모든 상품 로드 완료 */}
        {!loading && !loadingMore && !hasMore && products.length > 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">모든 상품을 불러왔습니다 ({total.toLocaleString()}개)</p>
          </div>
        )}
      </main>

      {/* 상품 상세 모달 */}
      {showDetailModal && selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedProduct(null);
          }}
          onAddToCart={handleAddFromModal}
          currentQuantity={getCartQuantity(selectedProduct._id)}
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

      {/* 카테고리 관리 모달 */}
      <CategoryManagementModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />

      {/* 맨 위로 가기 버튼 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-4 md:bottom-8 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110"
          aria-label="맨 위로 가기"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
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
