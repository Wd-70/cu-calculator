'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCurrentUserAddress } from '@/lib/userAuth';
import Toast from '@/components/Toast';

interface CrawledProduct {
  name: string;
  price: number;
  imageUrl: string;
  barcode: string;
  category: string;
  detailUrl: string;
}

export default function AdminPage() {
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [crawling, setCrawling] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [crawledProducts, setCrawledProducts] = useState<CrawledProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const [maxProducts, setMaxProducts] = useState(50);
  const [updatingCategories, setUpdatingCategories] = useState(false);
  const [maxCategoryUpdates, setMaxCategoryUpdates] = useState(10);
  const [checkingDetailUrls, setCheckingDetailUrls] = useState(false);
  const [detailUrlStats, setDetailUrlStats] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const address = getCurrentUserAddress();
    setUserAddress(address);

    // 관리자 권한 확인
    if (address) {
      checkAdminStatus(address);
    } else {
      setCheckingAdmin(false);
    }
  }, []);

  const checkAdminStatus = async (address: string) => {
    try {
      const response = await fetch('/api/admin/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountAddress: address }),
      });

      const data = await response.json();
      setIsAdmin(data.isAdmin || false);
    } catch (error) {
      console.error('Failed to check admin status:', error);
      setIsAdmin(false);
    } finally {
      setCheckingAdmin(false);
    }
  };


  const handleCrawl = async () => {
    if (!userAddress) {
      setToast({ message: '계정이 필요합니다.', type: 'error' });
      return;
    }

    try {
      setCrawling(true);

      const response = await fetch('/api/admin/crawl-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress,
          maxProducts
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCrawledProducts(data.products || []);
        // 모든 상품 자동 선택
        setSelectedProducts(new Set(data.products.map((p: CrawledProduct) => p.barcode)));
        setToast({
          message: `${data.products.length}개의 상품을 크롤링했습니다!`,
          type: 'success'
        });
      } else {
        setToast({
          message: data.error || '크롤링에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to crawl:', error);
      setToast({
        message: '크롤링 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setCrawling(false);
    }
  };

  const handleBulkRegister = async () => {
    if (!userAddress) {
      setToast({ message: '계정이 필요합니다.', type: 'error' });
      return;
    }

    if (selectedProducts.size === 0) {
      setToast({ message: '등록할 상품을 선택해주세요.', type: 'error' });
      return;
    }

    try {
      setRegistering(true);

      const productsToRegister = crawledProducts.filter(p => selectedProducts.has(p.barcode));

      const response = await fetch('/api/admin/bulk-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress,
          products: productsToRegister,
          createdBy: userAddress
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToast({
          message: data.message,
          type: 'success'
        });
        // 등록 성공한 상품 제거
        setCrawledProducts(prev => prev.filter(p => !selectedProducts.has(p.barcode)));
        setSelectedProducts(new Set());
      } else {
        setToast({
          message: data.error || '일괄 등록에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to register:', error);
      setToast({
        message: '등록 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setRegistering(false);
    }
  };

  const toggleProduct = (barcode: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(barcode)) {
        next.delete(barcode);
      } else {
        next.add(barcode);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProducts.size === crawledProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(crawledProducts.map(p => p.barcode)));
    }
  };

  const handleUpdateCategories = async () => {
    if (!userAddress) {
      setToast({ message: '계정이 필요합니다.', type: 'error' });
      return;
    }

    try {
      setUpdatingCategories(true);

      const response = await fetch('/api/admin/update-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress,
          maxProducts: maxCategoryUpdates
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToast({
          message: data.message,
          type: 'success'
        });
      } else {
        setToast({
          message: data.error || '카테고리 업데이트에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to update categories:', error);
      setToast({
        message: '카테고리 업데이트 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setUpdatingCategories(false);
    }
  };

  const handleCheckDetailUrls = async () => {
    if (!userAddress) {
      setToast({ message: '계정이 필요합니다.', type: 'error' });
      return;
    }

    try {
      setCheckingDetailUrls(true);

      const response = await fetch(`/api/admin/check-detail-urls?accountAddress=${userAddress}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setDetailUrlStats(data.data);
        setToast({
          message: '상태를 확인했습니다.',
          type: 'success'
        });
      } else {
        setToast({
          message: data.error || '상태 확인에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to check detail URLs:', error);
      setToast({
        message: '상태 확인 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setCheckingDetailUrls(false);
    }
  };

  // 로딩 중
  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#7C3FBF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  // 관리자 권한 없음
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">접근 권한 없음</h2>
            {userAddress ? (
              <>
                <p className="text-gray-600 mb-4">관리자 권한이 없는 계정입니다</p>
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <p className="text-xs text-gray-500 mb-1">현재 계정</p>
                  <p className="text-sm font-mono text-gray-700 break-all">{userAddress}</p>
                </div>
              </>
            ) : (
              <p className="text-gray-600 mb-4">계정이 필요합니다</p>
            )}
          </div>

          <div className="space-y-3">
            {!userAddress && (
              <Link
                href="/settings/account"
                className="block w-full py-3 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-bold hover:shadow-lg transition-all text-center"
              >
                계정 만들기
              </Link>
            )}
            <Link
              href="/"
              className="block text-center text-gray-600 hover:text-[#7C3FBF] transition-colors py-2"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">관리자 페이지</h1>
              <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full">ADMIN</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:block text-right">
                <p className="text-xs text-gray-500">관리자 계정</p>
                <p className="text-xs font-mono text-gray-700">{userAddress?.slice(0, 10)}...{userAddress?.slice(-8)}</p>
              </div>
              <Link href="/settings/account" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* 크롤링 설정 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">CU 상품 크롤링</h2>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                최대 크롤링 개수
              </label>
              <input
                type="number"
                value={maxProducts}
                onChange={(e) => setMaxProducts(parseInt(e.target.value) || 50)}
                min="1"
                max="500"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
              />
            </div>

            <button
              onClick={handleCrawl}
              disabled={crawling || !userAddress}
              className="px-6 py-3 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {crawling ? '크롤링 중...' : 'CU 사이트에서 크롤링'}
            </button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-800">
              ℹ️ CU 공식 사이트에서 최신 상품 정보를 가져옵니다. 시간이 다소 소요될 수 있습니다.
            </p>
          </div>
        </div>

        {/* 카테고리 업데이트 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">카테고리 정보 업데이트</h2>

          <div className="flex gap-4 items-end mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                한 번에 업데이트할 상품 수
              </label>
              <input
                type="number"
                value={maxCategoryUpdates}
                onChange={(e) => setMaxCategoryUpdates(parseInt(e.target.value) || 10)}
                min="1"
                max="100"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
              />
            </div>

            <button
              onClick={handleCheckDetailUrls}
              disabled={checkingDetailUrls || !userAddress}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {checkingDetailUrls ? '확인 중...' : 'DetailUrl 상태 확인'}
            </button>

            <button
              onClick={handleUpdateCategories}
              disabled={updatingCategories || !userAddress}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {updatingCategories ? '업데이트 중...' : '카테고리 업데이트'}
            </button>
          </div>

          {detailUrlStats && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl">
              <p className="text-sm font-bold text-blue-900 mb-2">DetailUrl 통계</p>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-xs text-blue-700">전체 상품</p>
                  <p className="text-2xl font-bold text-blue-900">{detailUrlStats.totalProducts.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700">DetailUrl 있음</p>
                  <p className="text-2xl font-bold text-green-900">{detailUrlStats.productsWithDetailUrl.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-red-700">DetailUrl 없음</p>
                  <p className="text-2xl font-bold text-red-900">{detailUrlStats.productsWithoutDetailUrl.toLocaleString()}</p>
                </div>
              </div>
              {detailUrlStats.sampleWithDetailUrl.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-blue-800 mb-1">DetailUrl 있는 샘플:</p>
                  {detailUrlStats.sampleWithDetailUrl.map((p: any, i: number) => (
                    <p key={i} className="text-xs text-blue-700 truncate">
                      • {p.name} ({p.barcode})
                    </p>
                  ))}
                </div>
              )}
              {detailUrlStats.sampleWithoutDetailUrl.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-800 mb-1">DetailUrl 없는 샘플:</p>
                  {detailUrlStats.sampleWithoutDetailUrl.map((p: any, i: number) => (
                    <p key={i} className="text-xs text-red-700 truncate">
                      • {p.name} ({p.barcode})
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-4 bg-orange-50 rounded-xl">
            <p className="text-sm text-orange-800 mb-2">
              ⚠️ 이 기능은 등록된 상품들의 상세 페이지를 방문하여 정확한 카테고리 태그를 가져옵니다.
            </p>
            <ul className="text-sm text-orange-700 space-y-1 ml-4">
              <li>• detailUrl이 저장된 상품만 업데이트됩니다</li>
              <li>• 한 번에 많은 상품을 업데이트하면 시간이 오래 걸립니다 (상품 1개당 약 3초)</li>
              <li>• 10개 업데이트 시 약 30초 소요됩니다</li>
            </ul>
          </div>
        </div>

        {/* 크롤링 결과 */}
        {crawledProducts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                크롤링 결과 ({crawledProducts.length}개)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={toggleAll}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {selectedProducts.size === crawledProducts.length ? '전체 해제' : '전체 선택'}
                </button>
                <button
                  onClick={handleBulkRegister}
                  disabled={registering || selectedProducts.size === 0}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {registering ? '등록 중...' : `선택한 ${selectedProducts.size}개 상품 등록`}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto">
              {crawledProducts.map((product) => (
                <div
                  key={product.barcode}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    selectedProducts.has(product.barcode)
                      ? 'border-[#7C3FBF] bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleProduct(product.barcode)}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.barcode)}
                      onChange={() => toggleProduct(product.barcode)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-sm line-clamp-2">{product.name}</h3>
                    </div>
                  </div>

                  {product.imageUrl && (
                    <div className="w-full aspect-square mb-2 overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/200x200?text=No+Image';
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-1 text-xs">
                    <p className="text-gray-600">
                      <span className="font-semibold">가격:</span> {product.price.toLocaleString()}원
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">바코드:</span> {product.barcode}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">카테고리:</span> {product.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 토스트 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
