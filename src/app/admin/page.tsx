'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCurrentUserAddress } from '@/lib/userAuth';
import Toast from '@/components/Toast';
import ConflictResolutionPanel from '@/components/ConflictResolutionPanel';
import SimpleBarcodeScanner from '@/components/SimpleBarcodeScanner';

interface CrawledProduct {
  name: string;
  price: number;
  imageUrl: string;
  barcode?: string; // 바코드가 없을 수 있음
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

  // 상품의 고유 ID 생성 (바코드가 있으면 바코드, 없으면 이름 사용)
  const getProductId = (product: CrawledProduct) => {
    return product.barcode || `name_${product.name}`;
  };

  const [pagesPerCategory, setPagesPerCategory] = useState(3);
  const [onlyWithBarcode, setOnlyWithBarcode] = useState(false); // 바코드 있는 것만 크롤링
  const [crawlProgress, setCrawlProgress] = useState({
    message: '',
    categoryProgress: { current: 0, total: 7 },
    pageProgress: { current: 0, total: 0 },
    productCount: 0
  });

  // 바코드 없는 상품 관리
  const [productsWithoutBarcode, setProductsWithoutBarcode] = useState<any[]>([]);
  const [loadingWithoutBarcode, setLoadingWithoutBarcode] = useState(false);
  const [loadingMoreWithoutBarcode, setLoadingMoreWithoutBarcode] = useState(false);
  const [totalWithoutBarcode, setTotalWithoutBarcode] = useState(0);
  const [updatingBarcode, setUpdatingBarcode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [newBarcode, setNewBarcode] = useState('');
  const [fixingNullBarcodes, setFixingNullBarcodes] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [updatingCategories, setUpdatingCategories] = useState(false);
  const [maxCategoryUpdates, setMaxCategoryUpdates] = useState(999999); // 전체 업데이트
  const [checkingDetailUrls, setCheckingDetailUrls] = useState(false);
  const [detailUrlStats, setDetailUrlStats] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 이미지 모달
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState('');
  const [imageModalName, setImageModalName] = useState('');

  // 바코드 스캐너
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // 프로모션 크롤링 상태
  const [crawlingPromotions, setCrawlingPromotions] = useState(false);
  const [pagesPerTab, setPagesPerTab] = useState(5);
  const [promotionCrawlProgress, setPromotionCrawlProgress] = useState({
    message: '',
    tabProgress: { current: 0, total: 2 },
    pageProgress: { current: 0, total: 0 },
    productCount: 0,
    promotionCount: 0
  });

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
      // 동적 임포트로 서명 함수 불러오기
      const { signWithTimestamp } = await import('@/lib/userAuth');

      // 서명 생성
      const { signature, timestamp } = await signWithTimestamp({ action: 'check_admin' });

      const response = await fetch('/api/admin/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: address,
          signature,
          timestamp,
        }),
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
      setCrawlProgress({
        message: '크롤링 시작...',
        categoryProgress: { current: 0, total: 7 },
        pageProgress: { current: 0, total: 0 },
        productCount: 0
      });

      const response = await fetch('/api/admin/crawl-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress,
          pagesPerCategory,
          onlyWithBarcode
        }),
      });

      if (!response.ok) {
        throw new Error('크롤링 요청이 실패했습니다.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('응답을 읽을 수 없습니다.');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);

              if (message.type === 'progress') {
                setCrawlProgress({
                  message: message.message || '',
                  categoryProgress: message.categoryProgress || { current: 0, total: 7 },
                  pageProgress: message.pageProgress || { current: 0, total: 0 },
                  productCount: message.productCount || 0
                });
              } else if (message.type === 'complete') {
                const products = message.products || [];
                setCrawledProducts(products);
                setSelectedProducts(new Set(products.map((p: CrawledProduct) => getProductId(p))));
                setToast({
                  message: message.message || '크롤링이 완료되었습니다!',
                  type: 'success'
                });
              } else if (message.type === 'error') {
                setToast({
                  message: message.message || '크롤링 중 오류가 발생했습니다.',
                  type: 'error'
                });
              }
            } catch (e) {
              console.error('Failed to parse message:', line, e);
            }
          }
        }
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

      const productsToRegister = crawledProducts.filter(p => selectedProducts.has(getProductId(p)));

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
        const { results } = data;
        setToast({
          message: `등록 완료! 성공: ${results.success}개, 실패: ${results.failed}개, 스킵: ${results.skipped}개`,
          type: results.failed > 0 ? 'info' : 'success'
        });
        // 선택만 해제하고 상품 목록은 유지
        setSelectedProducts(new Set());

        // 실패한 상품이 있으면 콘솔에 출력
        if (results.errors.length > 0) {
          console.warn('등록 실패/스킵된 상품:', results.errors);
        }
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

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProducts.size === crawledProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(crawledProducts.map(p => getProductId(p))));
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

  const loadProductsWithoutBarcode = async (loadMore: boolean = false) => {
    if (!userAddress) {
      setToast({ message: '계정이 필요합니다.', type: 'error' });
      return;
    }

    try {
      if (loadMore) {
        setLoadingMoreWithoutBarcode(true);
      } else {
        setLoadingWithoutBarcode(true);
      }

      const offset = loadMore ? productsWithoutBarcode.length : 0;
      console.log(`📦 바코드 없는 상품 로딩: offset=${offset}, limit=50`);

      const response = await fetch(`/api/admin/products/without-barcode?accountAddress=${userAddress}&limit=50&offset=${offset}`);
      const data = await response.json();

      console.log(`📥 API 응답: 받은 상품 ${data.data?.length || 0}개, 전체 ${data.total}개`);

      if (response.ok && data.success) {
        if (loadMore) {
          // 중복 제거: 이미 존재하는 _id는 추가하지 않음
          const existingIds = new Set(productsWithoutBarcode.map(p => p._id));
          const newProducts = data.data.filter((p: any) => !existingIds.has(p._id));

          console.log(`🔍 중복 확인: 받은 ${data.data.length}개 중 새로운 상품 ${newProducts.length}개`);
          if (newProducts.length < data.data.length) {
            console.warn(`⚠️ 중복된 상품 ${data.data.length - newProducts.length}개 발견!`);
            console.log('중복 상품 ID:', data.data.filter((p: any) => existingIds.has(p._id)).map((p: any) => p._id));
          }

          setProductsWithoutBarcode(prev => [...prev, ...newProducts]);

          // 실제로 추가된 개수 표시
          if (newProducts.length > 0) {
            setToast({
              message: `${newProducts.length}개의 상품을 추가로 불러왔습니다.`,
              type: 'success'
            });
          } else {
            setToast({
              message: '모두 중복된 상품입니다. API 오류일 수 있습니다.',
              type: 'error'
            });
          }
        } else {
          setProductsWithoutBarcode(data.data);
          setToast({
            message: `바코드 없는 상품 ${data.total}개 중 ${Math.min(50, data.total)}개를 불러왔습니다.`,
            type: 'success'
          });
        }
        setTotalWithoutBarcode(data.total);
      } else {
        setToast({
          message: data.error || '상품 조회에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to load products without barcode:', error);
      setToast({
        message: '상품 조회 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      if (loadMore) {
        setLoadingMoreWithoutBarcode(false);
      } else {
        setLoadingWithoutBarcode(false);
      }
    }
  };

  const handleUpdateBarcode = async (productId: string) => {
    if (!userAddress) {
      setToast({ message: '계정이 필요합니다.', type: 'error' });
      return;
    }

    // 8자리(EAN-8), 12자리(UPC-A), 13자리(EAN-13) 바코드 허용
    if (!/^\d{8}$|^\d{12}$|^\d{13}$/.test(newBarcode)) {
      setToast({ message: '바코드는 8, 12, 13자리 숫자여야 합니다.', type: 'error' });
      return;
    }

    try {
      setUpdatingBarcode(true);

      const response = await fetch('/api/admin/products/update-barcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress,
          productId,
          barcode: newBarcode
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToast({
          message: '바코드가 등록되었습니다!',
          type: 'success'
        });
        setEditingProduct(null);
        setNewBarcode('');

        // 등록된 상품을 목록에서 제거하고 총 개수 감소
        setProductsWithoutBarcode(prev => {
          const filtered = prev.filter(p => p._id !== productId);

          // 빈자리를 채우기 위해 다음 상품을 자동으로 로드 (비동기)
          // 현재 로드된 개수가 줄어들었고, 아직 더 불러올 상품이 있다면
          if (filtered.length > 0 && filtered.length < totalWithoutBarcode - 1) {
            // 약간의 지연 후 다음 상품 1개 로드
            setTimeout(() => {
              loadProductsWithoutBarcode(true);
            }, 100);
          }

          return filtered;
        });

        // 총 개수 감소
        setTotalWithoutBarcode(prev => Math.max(0, prev - 1));
      } else {
        setToast({
          message: data.error || '바코드 등록에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to update barcode:', error);
      setToast({
        message: '바코드 등록 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setUpdatingBarcode(false);
    }
  };

  // 바코드 스캔 핸들러
  const handleBarcodeScan = (barcode: string) => {
    // 스캔된 바코드를 입력란에 설정
    setNewBarcode(barcode);
  };

  const handleFixNullBarcodes = async () => {
    if (!userAddress) {
      setToast({ message: '계정이 필요합니다.', type: 'error' });
      return;
    }

    if (!confirm('DB에서 barcode: null인 레코드를 수정하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setFixingNullBarcodes(true);

      const response = await fetch('/api/admin/fix-null-barcodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress
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
          message: data.error || 'DB 수정에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to fix null barcodes:', error);
      setToast({
        message: 'DB 수정 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setFixingNullBarcodes(false);
    }
  };

  const handleReindexBarcodes = async () => {
    if (!userAddress) {
      setToast({ message: '계정이 필요합니다.', type: 'error' });
      return;
    }

    if (!confirm('barcode 인덱스를 재생성하시겠습니까?\n기존 인덱스가 삭제되고 sparse unique 인덱스로 재생성됩니다.')) {
      return;
    }

    try {
      setReindexing(true);

      const response = await fetch('/api/admin/reindex-barcodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress
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
          message: data.error || '인덱스 재생성에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to reindex barcodes:', error);
      setToast({
        message: '인덱스 재생성 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setReindexing(false);
    }
  };

  const handleCrawlPromotions = async () => {
    if (!userAddress) {
      setToast({ message: '계정이 필요합니다.', type: 'error' });
      return;
    }

    try {
      setCrawlingPromotions(true);
      setPromotionCrawlProgress({
        message: '프로모션 크롤링 시작...',
        tabProgress: { current: 0, total: 2 },
        pageProgress: { current: 0, total: 0 },
        productCount: 0,
        promotionCount: 0
      });

      const response = await fetch('/api/admin/crawl-promotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress,
          pagesPerTab
        }),
      });

      if (!response.ok) {
        throw new Error('프로모션 크롤링 요청이 실패했습니다.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('응답을 읽을 수 없습니다.');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);

              if (message.type === 'progress') {
                setPromotionCrawlProgress({
                  message: message.message || '',
                  tabProgress: message.tabProgress || { current: 0, total: 2 },
                  pageProgress: message.pageProgress || { current: 0, total: 0 },
                  productCount: message.productCount || 0,
                  promotionCount: message.promotionCount || 0
                });
              } else if (message.type === 'complete') {
                setToast({
                  message: message.message || '프로모션 크롤링이 완료되었습니다!',
                  type: 'success'
                });
              } else if (message.type === 'error') {
                setToast({
                  message: message.message || '프로모션 크롤링 중 오류가 발생했습니다.',
                  type: 'error'
                });
              }
            } catch (e) {
              console.error('Failed to parse message:', line, e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to crawl promotions:', error);
      setToast({
        message: '프로모션 크롤링 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setCrawlingPromotions(false);
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

          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리별 크롤링 페이지 수
                </label>
                <input
                  type="number"
                  value={pagesPerCategory}
                  onChange={(e) => setPagesPerCategory(parseInt(e.target.value) || 3)}
                  min="1"
                  max="20"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  각 카테고리에서 앞쪽 페이지만 크롤링합니다 (신상품 우선)
                </p>
              </div>

              <button
                onClick={handleCrawl}
                disabled={crawling || !userAddress}
                className="px-6 py-3 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {crawling ? '크롤링 중...' : 'CU 사이트에서 크롤링'}
              </button>
            </div>

            {/* 바코드 필터 옵션 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="onlyWithBarcode"
                checked={onlyWithBarcode}
                onChange={(e) => setOnlyWithBarcode(e.target.checked)}
                className="w-4 h-4 text-[#7C3FBF] border-gray-300 rounded focus:ring-[#7C3FBF]"
              />
              <label htmlFor="onlyWithBarcode" className="text-sm font-medium text-gray-700 cursor-pointer">
                바코드가 있는 상품만 크롤링 (바코드 없는 상품 제외)
              </label>
            </div>
          </div>

          {/* 크롤링 진행 상황 */}
          {crawling && (
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold text-purple-900">{crawlProgress.message}</p>
              </div>

              {/* 카테고리 진행 바 */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-purple-700 mb-1">
                  <span>카테고리 진행</span>
                  <span>{crawlProgress.categoryProgress.current} / {crawlProgress.categoryProgress.total}</span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-600 h-full transition-all duration-300 ease-out"
                    style={{ width: `${(crawlProgress.categoryProgress.current / crawlProgress.categoryProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* 페이지 진행 바 */}
              {crawlProgress.pageProgress.total > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-purple-700 mb-1">
                    <span>현재 카테고리 페이지</span>
                    <span>{crawlProgress.pageProgress.current} / {crawlProgress.pageProgress.total}</span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-purple-400 h-full transition-all duration-300 ease-out"
                      style={{ width: `${(crawlProgress.pageProgress.current / crawlProgress.pageProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* 수집된 상품 수 */}
              <div className="flex items-center justify-between text-xs text-purple-700">
                <span>수집된 상품</span>
                <span className="font-bold text-lg text-purple-900">{crawlProgress.productCount.toLocaleString()}개</span>
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-800 mb-2">
              ℹ️ CU 공식 사이트에서 최신 상품 정보를 가져옵니다.
            </p>
            <ul className="text-xs text-blue-700 space-y-1 ml-4">
              <li>• 7개 카테고리를 모두 순회합니다</li>
              <li>• 각 카테고리에서 지정한 페이지 수만큼만 크롤링합니다</li>
              <li>• 앞쪽 페이지에 신상품이 많으므로, 적은 페이지 수로도 최신 상품을 효율적으로 수집할 수 있습니다</li>
              <li>• 예상 크롤링 상품 수: 약 {pagesPerCategory * 7 * 20}개 (카테고리당 페이지당 약 20개)</li>
            </ul>
          </div>
        </div>

        {/* 프로모션 크롤링 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">행사 상품 크롤링 (1+1, 2+1)</h2>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                탭별 크롤링 페이지 수
              </label>
              <input
                type="number"
                value={pagesPerTab}
                onChange={(e) => setPagesPerTab(parseInt(e.target.value) || 5)}
                min="1"
                max="20"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
              />
              <p className="text-xs text-gray-500 mt-1">
                각 탭(1+1, 2+1)에서 크롤링할 페이지 수
              </p>
            </div>

            <button
              onClick={handleCrawlPromotions}
              disabled={crawlingPromotions || !userAddress}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {crawlingPromotions ? '크롤링 중...' : '행사 상품 크롤링'}
            </button>
          </div>

          {/* 프로모션 크롤링 진행 상황 */}
          {crawlingPromotions && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold text-orange-900">{promotionCrawlProgress.message}</p>
              </div>

              {/* 탭 진행 바 */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-orange-700 mb-1">
                  <span>탭 진행 (1+1, 2+1)</span>
                  <span>{promotionCrawlProgress.tabProgress.current} / {promotionCrawlProgress.tabProgress.total}</span>
                </div>
                <div className="w-full bg-orange-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-orange-600 h-full transition-all duration-300 ease-out"
                    style={{ width: `${(promotionCrawlProgress.tabProgress.current / promotionCrawlProgress.tabProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* 페이지 진행 바 */}
              {promotionCrawlProgress.pageProgress.total > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-orange-700 mb-1">
                    <span>현재 탭 페이지</span>
                    <span>{promotionCrawlProgress.pageProgress.current} / {promotionCrawlProgress.pageProgress.total}</span>
                  </div>
                  <div className="w-full bg-orange-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-orange-400 h-full transition-all duration-300 ease-out"
                      style={{ width: `${(promotionCrawlProgress.pageProgress.current / promotionCrawlProgress.pageProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* 수집 통계 */}
              <div className="grid grid-cols-2 gap-4 text-xs text-orange-700">
                <div className="flex items-center justify-between">
                  <span>수집된 상품</span>
                  <span className="font-bold text-lg text-orange-900">{promotionCrawlProgress.productCount.toLocaleString()}개</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>생성된 프로모션</span>
                  <span className="font-bold text-lg text-orange-900">{promotionCrawlProgress.promotionCount.toLocaleString()}개</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-orange-50 rounded-xl">
            <p className="text-sm text-orange-800 mb-2">
              ℹ️ CU 행사 상품 페이지에서 1+1, 2+1 프로모션 상품을 가져옵니다.
            </p>
            <ul className="text-xs text-orange-700 space-y-1 ml-4">
              <li>• 1+1, 2+1 탭을 모두 크롤링합니다</li>
              <li>• 현재 달 ({new Date().getFullYear()}년 {new Date().getMonth() + 1}월) 프로모션으로 자동 등록됩니다</li>
              <li>• 존재하지 않는 상품은 자동으로 상품 DB에 추가됩니다</li>
              <li>• 프로모션 인덱스도 자동으로 업데이트됩니다</li>
              <li>• 예상 크롤링 상품 수: 약 {pagesPerTab * 2 * 40}개 (탭당 페이지당 약 40개)</li>
            </ul>
          </div>
        </div>

        {/* 바코드 없는 상품 관리 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">바코드 없는 상품 관리</h2>
            <div className="flex gap-2">
              <button
                onClick={handleReindexBarcodes}
                disabled={reindexing || !userAddress}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {reindexing ? '재생성 중...' : '인덱스 재생성'}
              </button>
              <button
                onClick={handleFixNullBarcodes}
                disabled={fixingNullBarcodes || !userAddress}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {fixingNullBarcodes ? '수정 중...' : 'DB 정리'}
              </button>
              <button
                onClick={loadProductsWithoutBarcode}
                disabled={loadingWithoutBarcode || !userAddress}
                className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loadingWithoutBarcode ? '조회 중...' : '바코드 없는 상품 조회'}
              </button>
            </div>
          </div>

          <div className="mb-4 p-4 bg-yellow-50 rounded-xl">
            <p className="text-sm text-yellow-800 mb-2">
              ℹ️ 바코드 없이 등록된 상품들을 확인하고 바코드를 등록할 수 있습니다.
            </p>
            <ul className="text-xs text-yellow-700 space-y-1 ml-4">
              <li>• 크롤링 시 바코드를 추출하지 못한 상품들입니다</li>
              <li>• 바코드를 등록하면 일반 사용자도 해당 상품을 조회할 수 있습니다</li>
              <li>• 바코드는 8자리(EAN-8), 12자리(UPC-A), 13자리(EAN-13) 숫자를 지원합니다</li>
              <li className="text-red-700 font-semibold">⚠️ 바코드 없는 상품 등록 실패 시:</li>
              <li className="text-red-700 ml-4">1️⃣ "인덱스 재생성" 버튼 클릭 (인덱스를 sparse unique로 재생성)</li>
              <li className="text-red-700 ml-4">2️⃣ "DB 정리" 버튼 클릭 (기존 barcode:null 레코드 수정)</li>
            </ul>
          </div>

          {productsWithoutBarcode.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                총 {totalWithoutBarcode.toLocaleString()}개 중 {productsWithoutBarcode.length.toLocaleString()}개 표시
              </p>
              <div className="max-h-[500px] overflow-y-auto space-y-3">
                {productsWithoutBarcode.map((product) => (
                  <div
                    key={product._id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all bg-white"
                  >
                    {/* PC: 가로 레이아웃, 모바일: 세로 레이아웃 */}
                    <div className="flex flex-col md:flex-row">
                      {/* 상품 이미지 */}
                      {product.imageUrl && (
                        <div
                          className="w-full md:w-48 md:h-48 aspect-video md:aspect-square flex-shrink-0 overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageModalUrl(product.imageUrl);
                            setImageModalName(product.name);
                            setImageModalOpen(true);
                          }}
                        >
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/400x200?text=No+Image';
                            }}
                          />
                        </div>
                      )}

                      {/* 상품 정보 */}
                      <div className="flex-1 p-4 space-y-3 min-w-0">
                      <div>
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg leading-tight mb-2">
                          {product.name}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p className="flex items-center gap-2">
                            <span className="font-semibold text-purple-600">₩</span>
                            <span className="font-bold text-gray-900">{product.price?.toLocaleString()}원</span>
                          </p>
                          {product.categoryTags && product.categoryTags.length > 0 && (
                            <p className="text-xs text-gray-500 truncate">
                              {product.categoryTags.map((tag: any) => tag.name).join(' > ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 바코드 등록 영역 */}
                      {editingProduct === product._id ? (
                        <div className="space-y-2 pt-2 border-t border-gray-200">
                          {/* 바코드 입력 + 스캔 버튼 */}
                          <div className="flex gap-2 md:max-w-md">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={newBarcode}
                              onChange={(e) => setNewBarcode(e.target.value.replace(/\D/g, '').slice(0, 13))}
                              placeholder="8/12/13자리"
                              maxLength={13}
                              className="flex-1 min-w-0 px-3 py-3 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base font-mono"
                            />
                            <button
                              onClick={() => setIsScannerOpen(true)}
                              className="w-12 h-12 flex-shrink-0 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center shadow-md active:scale-95"
                              title="바코드 스캔"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                              </svg>
                            </button>
                          </div>

                          {/* 바코드 입력 상태 표시 */}
                          {newBarcode && (
                            <div className="flex items-center gap-2 text-xs">
                              {(newBarcode.length === 8 || newBarcode.length === 12 || newBarcode.length === 13) ? (
                                <>
                                  <span className="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white">
                                    ✓
                                  </span>
                                  <span className="text-green-700 font-medium">
                                    {newBarcode.length}자리 바코드 ({
                                      newBarcode.length === 8 ? 'EAN-8' :
                                      newBarcode.length === 12 ? 'UPC-A' : 'EAN-13'
                                    })
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="flex-shrink-0 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs">
                                    {newBarcode.length}
                                  </span>
                                  <span className="text-orange-700 font-medium">
                                    {newBarcode.length < 8 ? `${8 - newBarcode.length}자리 더 (8자리)` :
                                     newBarcode.length < 12 ? `${12 - newBarcode.length}자리 더 (12자리)` :
                                     `${13 - newBarcode.length}자리 더 (13자리)`}
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                          {/* 등록/취소 버튼 */}
                          <div className="grid grid-cols-2 gap-2 md:max-w-md">
                            <button
                              onClick={() => {
                                setEditingProduct(null);
                                setNewBarcode('');
                              }}
                              className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold active:scale-95"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleUpdateBarcode(product._id)}
                              disabled={updatingBarcode || !(newBarcode.length === 8 || newBarcode.length === 12 || newBarcode.length === 13)}
                              className="px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                            >
                              {updatingBarcode ? '등록 중...' : '✓ 등록'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingProduct(product._id);
                            setNewBarcode('');
                          }}
                          className="w-full md:w-auto md:px-8 py-3 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-lg font-bold hover:shadow-lg transition-all active:scale-95"
                        >
                          📷 바코드 등록
                        </button>
                      )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 더 보기 버튼 */}
              {productsWithoutBarcode.length < totalWithoutBarcode && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => loadProductsWithoutBarcode(true)}
                    disabled={loadingMoreWithoutBarcode}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMoreWithoutBarcode ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        불러오는 중...
                      </span>
                    ) : (
                      `더 보기 (${totalWithoutBarcode - productsWithoutBarcode.length}개 남음)`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {productsWithoutBarcode.length === 0 && !loadingWithoutBarcode && (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>바코드 없는 상품이 없습니다.</p>
              <p className="text-sm mt-2">위 버튼을 클릭하여 조회하세요.</p>
            </div>
          )}
        </div>

        {/* 실시간 카테고리 업데이트 및 충돌 해결 */}
        <ConflictResolutionPanel
          userAddress={userAddress}
          maxProducts={maxCategoryUpdates}
          onToast={(message, type) => setToast({ message, type })}
        />

        {/* 카테고리 업데이트 (기존 방식) - 숨김 처리 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 mt-6 hidden">
          <h2 className="text-xl font-bold text-gray-900 mb-4">카테고리 정보 업데이트 (기존 방식)</h2>

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
                <button
                  onClick={() => {
                    if (confirm('크롤링 결과를 모두 삭제하시겠습니까?')) {
                      setCrawledProducts([]);
                      setSelectedProducts(new Set());
                    }
                  }}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  목록 초기화
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto">
              {crawledProducts.map((product) => {
                const productId = getProductId(product);
                return (
                  <div
                    key={productId}
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${
                      selectedProducts.has(productId)
                        ? 'border-[#7C3FBF] bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleProduct(productId)}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(productId)}
                        onChange={() => toggleProduct(productId)}
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
                        <span className="font-semibold">바코드:</span> {product.barcode || '(바코드 없음)'}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-semibold">카테고리:</span> {product.category}
                      </p>
                    </div>
                  </div>
                );
              })}
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

      {/* 이미지 확대 모달 */}
      {imageModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setImageModalOpen(false)}
        >
          <div
            className="relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setImageModalOpen(false)}
              className="absolute -top-12 right-0 w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
                <h3 className="font-bold text-gray-900">{imageModalName}</h3>
              </div>
              <div className="flex items-center justify-center bg-gray-100" style={{ minHeight: '400px', maxHeight: '70vh' }}>
                <img
                  src={imageModalUrl}
                  alt={imageModalName}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/400x400?text=No+Image';
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 바코드 스캐너 모달 */}
      <SimpleBarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
      />
    </div>
  );
}
