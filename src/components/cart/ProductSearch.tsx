'use client';

import { useState, useEffect, useRef } from 'react';
import { IProduct } from '@/types/product';
import { ICartItem } from '@/types/cart';

interface ProductSearchProps {
  onAddItem: (item: ICartItem) => void;
}

export default function ProductSearch({ onAddItem }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      setIsOpen(false);
      return;
    }

    // 디바운스 검색
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.products || []);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('상품 검색 실패:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleAddProduct = (product: IProduct) => {
    const cartItem: ICartItem = {
      productId: product._id,
      barcode: product.barcode,
      name: product.name,
      price: product.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      category: product.category,
      categoryTags: product.categoryTags,
      brand: product.brand,
      selectedDiscountIds: [],
      addedAt: new Date(),
      lastSyncedAt: new Date(),
      latestPrice: product.price,
      priceCheckedAt: new Date(),
    };

    onAddItem(cartItem);
    setQuery('');
    setSearchResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleBarcodeSearch = async (barcode: string) => {
    if (!barcode.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/products/barcode/${barcode}`);
      if (response.ok) {
        const product = await response.json();
        handleAddProduct(product);
      } else {
        alert('바코드를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('바코드 검색 실패:', error);
      alert('바코드 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">상품 추가</h3>

      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.match(/^\d{13}$/)) {
                // 13자리 숫자면 바코드로 간주
                handleBarcodeSearch(query);
              }
            }}
            placeholder="상품명 또는 바코드 입력..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {isOpen && searchResults.length > 0 && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
              {searchResults.map((product) => (
                <button
                  key={String(product._id)}
                  onClick={() => handleAddProduct(product)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-gray-900 truncate">{product.name}</div>
                    <div className="text-sm text-gray-500 truncate">
                      {product.barcode}
                      {product.brand && ` · ${product.brand}`}
                    </div>
                    <div className="text-sm font-semibold text-purple-600 mt-1">
                      {product.price.toLocaleString()}원
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              ))}
            </div>
          </>
        )}

        {isOpen && query.length >= 2 && searchResults.length === 0 && !isSearching && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-4 text-center text-gray-500 text-sm">
            검색 결과가 없습니다.
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        💡 13자리 바코드를 입력하고 Enter를 누르면 바로 추가됩니다.
      </div>
    </div>
  );
}
