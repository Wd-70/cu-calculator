'use client';

import { useEffect, useState } from 'react';
import { IProduct } from '@/types/product';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  searchResults: IProduct[];
  isSearching: boolean;
  onSelectProduct: (product: IProduct) => void;
  totalCount?: number;
}

export default function ProductSearchModal({
  isOpen,
  onClose,
  searchQuery,
  searchResults,
  isSearching,
  onSelectProduct,
  totalCount,
}: ProductSearchModalProps) {
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // 모달 열릴 때 스크롤 방지 및 추가된 상품 목록 초기화
  useEffect(() => {
    console.log('모달 상태 변경:', isOpen, '검색어:', searchQuery, '결과 수:', searchResults.length);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setAddedProducts(new Set()); // 모달이 열릴 때 추가된 상품 목록 초기화
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, searchQuery, searchResults]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      {/* 모달 배경 클릭 시 닫기 */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">상품 검색 결과</h2>
            <p className="text-sm text-gray-600 mt-1">
              "{searchQuery}" 검색 결과 {totalCount !== undefined && totalCount > searchResults.length
                ? `전체 ${totalCount}개 중 ${searchResults.length}개 표시`
                : `${searchResults.length}개`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/50 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 검색 결과 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600">검색 중...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">검색 결과가 없습니다</h3>
              <p className="text-sm text-gray-500">다른 검색어로 시도해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {searchResults.map((product) => {
                const isAdded = addedProducts.has(String(product._id));
                return (
                  <button
                    key={String(product._id)}
                    onClick={() => {
                      onSelectProduct(product);
                      setAddedProducts(prev => new Set(prev).add(String(product._id)));
                    }}
                    disabled={isAdded}
                    className={`flex items-center gap-4 p-4 border-2 rounded-xl transition-all group ${
                      isAdded
                        ? 'bg-green-50 border-green-400 cursor-default'
                        : 'bg-white border-gray-200 hover:border-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    {/* 상품 이미지 */}
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    {/* 상품 정보 */}
                    <div className="flex-1 text-left min-w-0">
                      <h3 className={`font-semibold mb-1 line-clamp-2 transition-colors ${
                        isAdded ? 'text-green-700' : 'text-gray-900 group-hover:text-purple-700'
                      }`}>
                        {product.name}
                      </h3>
                      <div className="text-sm text-gray-500 mb-2 font-mono">
                        {product.barcode}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-lg font-bold ${
                          isAdded ? 'text-green-600' : 'text-purple-600'
                        }`}>
                          {product.price.toLocaleString()}원
                        </div>
                        {product.brand && (
                          <div className="text-sm text-gray-500">
                            {product.brand}
                          </div>
                        )}
                        {product.category && (
                          <div className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            {product.category}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 추가 아이콘 또는 체크 아이콘 */}
                    <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                      isAdded
                        ? 'bg-green-500 text-white'
                        : 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white'
                    }`}>
                      {isAdded ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>상품을 클릭하여 장바구니에 추가 · 여러 개 선택 가능</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
