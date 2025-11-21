'use client';

import { useState, useEffect, useRef } from 'react';
import { IProduct } from '@/types/product';
import { ICartItem } from '@/types/cart';
import BarcodeScannerModal from '@/components/BarcodeScannerModal';
import ProductSearchModal from './ProductSearchModal';
import { getUnifiedCategory } from '@/lib/constants/categoryMapping';
import { normalizeBarcode } from '@/lib/utils/barcodeUtils';
import * as clientDb from '@/lib/clientDb';

interface ProductSearchProps {
  onAddItem: (item: ICartItem) => void;
  cartId: string;
}

export default function ProductSearch({ onAddItem, cartId }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IProduct[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 수동 검색 함수
  const handleSearch = async () => {
    if (query.length < 2) {
      return;
    }

    // 바코드인 경우 검색하지 않음 (13자리 또는 18자리)
    if (query.match(/^\d{13}$/) || query.match(/^\d{18}$/)) {
      return;
    }

    console.log('검색 시작:', query);
    setIsSearching(true);
    try {
      const response = await fetch(`/api/products?name=${encodeURIComponent(query)}&limit=200`);
      console.log('검색 응답:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('검색 결과:', data);
        console.log(`전체 ${data.total}개 중 ${data.data?.length || 0}개 표시`);
        setSearchResults(data.data || []);
        setTotalCount(data.total || 0);
        setIsSearchModalOpen(true);
      }
    } catch (error) {
      console.error('상품 검색 실패:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddProduct = (product: IProduct) => {
    const cartItem: ICartItem = {
      productId: product._id,
      barcode: product.barcode ?? '',
      name: product.name ?? '알 수 없는 상품',
      price: product.price ?? 0,
      quantity: 1,
      imageUrl: product.imageUrl,
      categoryTags: product.categoryTags,
      brand: product.brand,
      selectedDiscountIds: [],
      addedAt: new Date(),
      lastSyncedAt: new Date(),
      latestPrice: product.price ?? 0,
      priceCheckedAt: new Date(),
    };

    onAddItem(cartItem);
    // 모달을 닫지 않고 계속 사용할 수 있도록 수정
    // setQuery('');
    // setSearchResults([]);
    // setIsSearchModalOpen(false);
    // inputRef.current?.focus();
  };

  const handleBarcodeSearch = async (barcode: string) => {
    if (!barcode.trim()) return;

    // 바코드 정규화 (18자리 -> 13자리)
    const normalizedBarcode = normalizeBarcode(barcode);

    setIsSearching(true);
    try {
      const response = await fetch(`/api/products?barcode=${normalizedBarcode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          handleAddProduct(data.data[0]);
        } else {
          alert('바코드를 찾을 수 없습니다.');
        }
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

  // 바코드 스캐너에서 스캔 시 처리 (즉시 추가 + 백그라운드 로딩)
  const handleScan = async (barcode: string, product?: IProduct): Promise<boolean> => {
    // 바코드 정규화 (18자리 -> 13자리)
    const normalizedBarcode = normalizeBarcode(barcode);
    console.log('[ProductSearch.handleScan] 시작:', normalizedBarcode);

    try {
      // product가 전달되었으면 바로 사용
      if (product) {
        handleAddProduct(product);
        return true;
      }

      // 1. 즉시 placeholder 아이템 추가
      const placeholderItem: ICartItem = {
        barcode: normalizedBarcode,
        quantity: 1,
        name: '상품 정보 로딩 중...',
        price: 0,
        isLoading: true,
      };

      console.log('[ProductSearch.handleScan] placeholder 추가');
      onAddItem(placeholderItem);

      // 2. 백그라운드에서 상품 정보 로드
      setTimeout(() => {
        (async () => {
          try {
            console.log('[ProductSearch 백그라운드] API 요청:', normalizedBarcode);
            const response = await fetch(`/api/products?barcode=${normalizedBarcode}`);
            const data = await response.json();
            console.log('[ProductSearch 백그라운드] API 응답:', data);

            if (!data.success || !data.data || data.data.length === 0) {
              console.log('[ProductSearch 백그라운드] 상품 없음 - 에러 상태로 업데이트');
              // 실패: 에러 상태로 업데이트
              clientDb.updateCartItem(cartId, normalizedBarcode, {
                isLoading: false,
                loadError: '상품을 찾을 수 없습니다',
                name: '알 수 없는 상품',
              });
              // 부모 컴포넌트에 변경사항 알림 (새로고침 트리거)
              window.dispatchEvent(new Event('storage'));
            } else {
              // 성공: 실제 상품 정보로 업데이트
              const product = data.data[0];
              console.log('[ProductSearch 백그라운드] 상품 정보로 교체:', product.name);

              clientDb.updateCartItem(cartId, normalizedBarcode, {
                productId: product._id,
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrl,
                categoryTags: product.categoryTags,
                brand: product.brand,
                isLoading: false,
                loadError: undefined,
                lastSyncedAt: new Date(),
                latestPrice: product.price,
                priceCheckedAt: new Date(),
              });
              // 부모 컴포넌트에 변경사항 알림 (새로고침 트리거)
              window.dispatchEvent(new Event('storage'));
            }
          } catch (error) {
            console.error('[ProductSearch 백그라운드] 에러:', error);
            clientDb.updateCartItem(cartId, normalizedBarcode, {
              isLoading: false,
              loadError: '로딩 실패',
              name: '로딩 실패',
            });
            window.dispatchEvent(new Event('storage'));
          }
        })();
      }, 100);

      return true;
    } catch (error) {
      console.error('[ProductSearch.handleScan] 에러:', error);
      return false;
    }
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">상품 추가</h3>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            스캔
          </button>
        </div>

        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (query.match(/^\d{13}$/) || query.match(/^\d{18}$/)) {
                      // 13자리 또는 18자리 숫자면 바코드로 간주
                      handleBarcodeSearch(query);
                    } else {
                      // 일반 검색
                      handleSearch();
                    }
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
            <button
              onClick={handleSearch}
              disabled={isSearching || query.length < 2}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              검색
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          💡 상품명을 입력하고 검색 버튼을 누르거나 Enter를 누르세요. 바코드는 Enter로 바로 추가됩니다.
        </div>
      </div>

      {/* 상품 검색 결과 모달 */}
      <ProductSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => {
          setIsSearchModalOpen(false);
          setQuery('');
        }}
        searchQuery={query}
        searchResults={searchResults}
        totalCount={totalCount}
        isSearching={isSearching}
        onSelectProduct={handleAddProduct}
      />

      {/* 바코드 스캐너 모달 */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
        cartId={cartId}
      />
    </>
  );
}
