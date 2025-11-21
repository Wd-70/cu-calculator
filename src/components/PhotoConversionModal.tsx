'use client';

import { useState, useEffect, useRef } from 'react';
import CameraCapture from './CameraCapture';
import SimpleBarcodeScanner from './SimpleBarcodeScanner';
import Barcode from 'react-barcode';

interface PendingPhoto {
  promotionId?: string;
  promotionName?: string;
  sessionId?: string;
  sessionName?: string;
  photoCount: number;
  photos: Array<{
    filename: string;
    uploadedAt: string;
  }>;
  createdAt?: string;
  lastUpdated?: string;
}

interface QueueStatus {
  deactivatedItems: {
    [key: string]: {
      deactivatedAt: string;
      deactivatedBy: string;
      reason?: string;
    };
  };
  lastUpdated: string;
}

interface PhotoConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string | null;
}

export default function PhotoConversionModal({
  isOpen,
  onClose,
  userAddress,
}: PhotoConversionModalProps) {
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversionData, setConversionData] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'capture' | 'scan' | 'list' | 'import'>('capture');

  // 배치 파일 관련 상태
  const [batchFiles, setBatchFiles] = useState<any[]>([]);
  const [selectedBatchFile, setSelectedBatchFile] = useState<string>('');
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');

  // 사진 촬영 관련 상태
  const [showCamera, setShowCamera] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // 항목 상태 관리
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PendingPhoto | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);

  // 바코드 스캔 탭 관련 상태
  const [scannedProducts, setScannedProducts] = useState<Array<{barcode: string, name: string, price: number, imageUrl?: string, scannedAt: string, scannedBy: string, isActive: boolean}>>([]);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanSessionId, setScanSessionId] = useState<string>(() => {
    // localStorage에서 저장된 세션 ID 불러오기
    if (typeof window !== 'undefined') {
      return localStorage.getItem('scanSessionId') || '';
    }
    return '';
  });
  const [cameraMode, setCameraMode] = useState<'normal' | 'product'>('normal');
  const [showInactiveProducts, setShowInactiveProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchResultIndex, setSelectedSearchResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      loadPendingPhotos();
      loadBatchFiles();
      loadQueueStatus();
      // 새 세션 ID 생성
      if (!currentSessionId) {
        setCurrentSessionId(generateSessionId());
      }
      // 바코드 스캔 세션 ID 생성
      if (!scanSessionId) {
        const newScanSessionId = generateSessionId();
        setScanSessionId(newScanSessionId);
        localStorage.setItem('scanSessionId', newScanSessionId);
      }
      // 스캔 상품 목록 불러오기
      loadScannedProducts();
    }
  }, [isOpen]);

  // 검색 결과 키보드 네비게이션
  useEffect(() => {
    if (!showSearchResults || searchResults.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSearchResultIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSearchResultIndex((prev) =>
          prev > 0 ? prev - 1 : prev
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchResults[selectedSearchResultIndex]) {
          handleSelectSearchResult(searchResults[selectedSearchResultIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSearchResults(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearchResults, searchResults, selectedSearchResultIndex]);

  // 선택된 검색 결과 항목으로 스크롤
  useEffect(() => {
    if (showSearchResults && searchResultRefs.current[selectedSearchResultIndex]) {
      searchResultRefs.current[selectedSearchResultIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedSearchResultIndex, showSearchResults]);

  // 카메라가 닫힐 때 스크롤 위치 복원
  useEffect(() => {
    if (!showCamera && activeTab === 'scan' && savedScrollPosition.current > 0) {
      // 카메라가 닫혔을 때 스크롤 복원
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedScrollPosition.current;
        }
      }, 50);
    }
  }, [showCamera, activeTab]);

  const generateSessionId = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return `session_${timestamp}`;
  };

  const loadScannedProducts = async () => {
    if (!userAddress) return;

    try {
      const response = await fetch(`/api/admin/photos/scan-products?accountAddress=${userAddress}`);
      const data = await response.json();

      if (data.success && data.products) {
        setScannedProducts(data.products);
      }
    } catch (error) {
      console.error('스캔 상품 불러오기 실패:', error);
    }
  };

  const addScannedProduct = async (product: {barcode: string, name: string, price: number, imageUrl?: string}) => {
    if (!userAddress) return;

    try {
      const response = await fetch('/api/admin/photos/scan-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress: userAddress,
          product,
        }),
      });

      const data = await response.json();
      if (data.success && data.products) {
        setScannedProducts(data.products);
      }
    } catch (error) {
      console.error('스캔 상품 추가 실패:', error);
    }
  };

  const removeScannedProduct = async (barcode: string) => {
    if (!userAddress) return;

    try {
      const response = await fetch(`/api/admin/photos/scan-products?accountAddress=${userAddress}&barcode=${barcode}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success && data.products) {
        setScannedProducts(data.products);
      }
    } catch (error) {
      console.error('스캔 상품 삭제 실패:', error);
    }
  };

  const toggleProductActive = async (barcode: string, isActive: boolean) => {
    if (!userAddress) return;

    try {
      const response = await fetch('/api/admin/photos/scan-products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress: userAddress,
          barcode,
          isActive,
        }),
      });

      const data = await response.json();
      if (data.success && data.products) {
        setScannedProducts(data.products);
      }
    } catch (error) {
      console.error('스캔 상품 활성 토글 실패:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      alert('검색어를 2글자 이상 입력해주세요.');
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/products?name=${encodeURIComponent(searchQuery)}&limit=50`);
      const data = await response.json();

      if (data.success && data.data) {
        setSearchResults(data.data);
        setSelectedSearchResultIndex(0);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        alert('검색 결과가 없습니다.');
      }
    } catch (error) {
      console.error('상품 검색 실패:', error);
      alert('상품 검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = async (product: any) => {
    await addScannedProduct({
      barcode: product.barcode,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl
    });
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);

    // 검색어 입력창으로 포커스 이동
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const loadPendingPhotos = async () => {
    if (!userAddress) return;

    setLoading(true);
    try {
      // 프로모션 기반 사진들
      const promotionResponse = await fetch(`/api/admin/promotions/pending-photos?accountAddress=${userAddress}`);
      const promotionData = await promotionResponse.json();

      // 독립 세션 사진들
      const sessionResponse = await fetch(`/api/admin/photos/list-sessions?accountAddress=${userAddress}`);
      const sessionData = await sessionResponse.json();

      const allPending: PendingPhoto[] = [];

      if (promotionData.success && promotionData.pendingPhotos) {
        allPending.push(...promotionData.pendingPhotos);
      }

      if (sessionData.success && sessionData.sessions) {
        allPending.push(...sessionData.sessions);
      }

      setPendingPhotos(allPending);
    } catch (error) {
      console.error('Error loading pending photos:', error);
      alert('사진 목록 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadBatchFiles = async () => {
    if (!userAddress) return;

    setLoadingBatches(true);
    try {
      const response = await fetch(`/api/admin/promotions/list-conversion-batches?accountAddress=${userAddress}`);
      const data = await response.json();

      if (data.success) {
        setBatchFiles(data.batches || []);
      }
    } catch (error) {
      console.error('Error loading batch files:', error);
    } finally {
      setLoadingBatches(false);
    }
  };

  const loadQueueStatus = async () => {
    if (!userAddress) return;

    try {
      const response = await fetch(`/api/admin/photos/queue-status?accountAddress=${userAddress}`);
      const data = await response.json();

      if (data.success) {
        setQueueStatus(data.status);
      }
    } catch (error) {
      console.error('Error loading queue status:', error);
    }
  };

  const toggleItemStatus = async (itemId: string, currentlyDeactivated: boolean) => {
    if (!userAddress) return;

    try {
      const response = await fetch('/api/admin/photos/queue-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress: userAddress,
          itemId,
          action: currentlyDeactivated ? 'activate' : 'deactivate',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setQueueStatus(data.status);
      }
    } catch (error) {
      console.error('Error toggling item status:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const isItemDeactivated = (itemId: string | undefined): boolean => {
    if (!itemId || !queueStatus) return false;
    return !!queueStatus.deactivatedItems[itemId];
  };

  const getFilteredPhotos = () => {
    if (showDeactivated) {
      return pendingPhotos;
    }
    return pendingPhotos.filter(photo => {
      const itemId = photo.promotionId || photo.sessionId;
      return !isItemDeactivated(itemId);
    });
  };

  const getPhotoPath = (photo: PendingPhoto, filename: string): string => {
    if (photo.promotionId) {
      return `data/promotions/${photo.promotionId}/${filename}`;
    } else {
      return `data/photos/${photo.sessionId}/${filename}`;
    }
  };

  const handleSelectBatchFile = async (filename: string) => {
    if (!userAddress) return;

    setSelectedBatchFile(filename);

    try {
      const response = await fetch(`/api/admin/promotions/read-conversion-batch?accountAddress=${userAddress}&filename=${encodeURIComponent(filename)}`);
      const data = await response.json();

      if (data.success) {
        setConversionData(JSON.stringify(data.data, null, 2));
      } else {
        alert('파일 읽기 실패: ' + data.error);
      }
    } catch (error) {
      console.error('Error reading batch file:', error);
      alert('파일 읽기 중 오류가 발생했습니다.');
    }
  };

  const handlePhotoCapture = async (blob: Blob, filename: string) => {
    if (!userAddress) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', blob, filename);
      formData.append('sessionId', currentSessionId);
      formData.append('sessionName', sessionName || '이름 없는 세션');
      formData.append('accountAddress', userAddress);

      const response = await fetch('/api/admin/photos/upload-standalone', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setCapturedPhotos((prev) => [...prev, filename]);
        setShowCamera(false);
      } else {
        alert('사진 업로드 실패: ' + data.error);
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleStartNewSession = () => {
    setCurrentSessionId(generateSessionId());
    setSessionName('');
    setCapturedPhotos([]);
  };

  const handleFinishCapture = () => {
    setCapturedPhotos([]);
    setCurrentSessionId(generateSessionId());
    setSessionName('');
    setActiveTab('list');
    loadPendingPhotos();
  };

  // 바코드 스캔 탭 핸들러
  const handleBarcodeScan = async (barcode: string) => {
    setShowBarcodeScanner(false);

    try {
      // 상품 정보 조회
      const response = await fetch(`/api/products?barcode=${barcode}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        const product = data.data[0];

        // 상품 추가 (이미 있으면 활성화됨)
        await addScannedProduct({
          barcode: product.barcode,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl
        });
      } else {
        alert('상품을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('상품 조회 실패:', error);
      alert('상품 조회 중 오류가 발생했습니다.');
    }
  };

  const handleRemoveProduct = async (barcode: string) => {
    await removeScannedProduct(barcode);

    // 선택된 상품이 삭제된 경우 선택 해제
    const removedProduct = scannedProducts.find(p => p.barcode === barcode);
    if (removedProduct && selectedProductIndex !== null) {
      const selectedProduct = scannedProducts[selectedProductIndex];
      if (selectedProduct?.barcode === barcode) {
        setSelectedProductIndex(null);
      }
    }
  };

  const handleSelectProduct = (index: number) => {
    setSelectedProductIndex(index);
    // 스캔 세션 ID 생성 (상품별)
    if (!scanSessionId) {
      setScanSessionId(generateSessionId());
    }
  };

  const handleCaptureForProduct = async (blob: Blob, filename: string) => {
    if (!userAddress || selectedProductIndex === null) return;

    const product = scannedProducts[selectedProductIndex];

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', blob, filename);
      formData.append('sessionId', scanSessionId);
      formData.append('sessionName', `${product.name} (${product.barcode})`);
      formData.append('accountAddress', userAddress);
      formData.append('productBarcode', product.barcode);
      formData.append('productName', product.name);

      const response = await fetch('/api/admin/photos/upload-standalone', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // 카메라를 먼저 닫고 (스크롤 복원은 useEffect에서 처리)
        setShowCamera(false);
        // 다음 상품으로 이동하거나 세션 ID 리셋
        setScanSessionId(generateSessionId());

        // alert는 스크롤 복원 후에 표시
        setTimeout(() => {
          alert(`✅ ${product.name} POS 화면이 촬영되었습니다!`);
        }, 100);
      } else {
        alert('사진 업로드 실패: ' + data.error);
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleCopyTaskInfo = () => {
    const filteredPhotos = getFilteredPhotos(); // 활성화된 항목만

    const taskInfo = `
# 프로모션 사진 변환 요청

data/PROMOTION_CONVERSION_GUIDE.md 파일을 읽고, 다음 사진들을 변환해주세요.

## 변환 대기 중인 사진 (${filteredPhotos.length}개)

${filteredPhotos.map((p, idx) => {
  if (p.promotionId) {
    return `
### ${idx + 1}. ${p.promotionName} (프로모션)
- Promotion ID: ${p.promotionId}
- 사진 개수: ${p.photoCount}장
- 사진 위치: data/promotions/${p.promotionId}/
${p.photos.map(photo => `  - ${photo.filename}`).join('\n')}
`;
  } else {
    const productInfo = (p as any).productName && (p as any).productBarcode
      ? `${(p as any).productName} (${(p as any).productBarcode})`
      : p.sessionName;
    return `
### ${idx + 1}. ${productInfo} (독립 촬영)
- Session ID: ${p.sessionId}
- 사진 개수: ${p.photoCount}장
- 사진 위치: data/photos/${p.sessionId}/
${p.photos.map(photo => `  - ${photo.filename}`).join('\n')}
`;
  }
}).join('\n')}

---

위 가이드에 따라 batch_{timestamp}.json 파일을 생성해서 data/promotions/conversion-batches/ 폴더에 저장해주세요.
`.trim();

    navigator.clipboard.writeText(taskInfo);
    alert('✅ 변환 요청 정보가 클립보드에 복사되었습니다!\n\nClaude에게 붙여넣기 해주세요.');
  };

  const handleImport = async () => {
    if (!conversionData.trim()) {
      alert('변환 데이터를 입력해주세요.');
      return;
    }

    if (!userAddress) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const jsonData = JSON.parse(conversionData);

      setImporting(true);
      const response = await fetch('/api/admin/promotions/import-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress: userAddress,
          conversionData: jsonData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const message = `✅ 변환 데이터가 성공적으로 임포트되었습니다!\n\n업데이트된 프로모션: ${data.updatedCount}개\n생성된 할인규칙: ${data.createdDiscountRulesCount || 0}개`;
        alert(message);
        setConversionData('');
        setSelectedBatchFile('');
        setActiveTab('list');
        loadPendingPhotos();
        loadBatchFiles(); // 배치 파일 목록 갱신
        onClose();
      } else {
        alert('❌ 임포트 실패: ' + data.error);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      if (error instanceof SyntaxError) {
        alert('❌ JSON 형식이 올바르지 않습니다.');
      } else {
        alert('❌ 임포트 중 오류가 발생했습니다.');
      }
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  if (showBarcodeScanner) {
    return (
      <SimpleBarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScan}
      />
    );
  }

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={cameraMode === 'product' ? handleCaptureForProduct : handlePhotoCapture}
        onClose={() => {
          setShowCamera(false);
          setCameraMode('normal');
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">📷 사진 관리 & 변환</h2>
              <p className="text-blue-100 text-sm">
                POS 사진 촬영 및 데이터 변환
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="border-b border-gray-200">
          <div className="flex gap-1 p-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('capture')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'capture'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📸 사진 촬영
            </button>
            <button
              onClick={() => setActiveTab('scan')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'scan'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔍 바코드 스캔 ({scannedProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'list'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 변환 대기 ({pendingPhotos.length})
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'import'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📥 데이터 임포트
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
          {/* 사진 촬영 탭 */}
          {activeTab === 'capture' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">💡 사진 촬영 가이드</h3>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• 한 정보에 대해 여러 사진을 촬영할 수 있습니다</li>
                  <li>• 촬영 후 "다음 정보 촬영"으로 새로운 정보를 촬영할 수 있습니다</li>
                  <li>• POS 화면이 잘 보이도록 촬영해주세요</li>
                </ul>
              </div>

              {/* 세션 정보 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  촬영 정보 이름 (선택사항)
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="예: 2+1 아이스크림 행사"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  나중에 구분하기 쉽도록 이름을 입력하세요
                </p>
              </div>

              {/* 촬영된 사진 목록 */}
              {capturedPhotos.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">
                    ✅ 촬영된 사진 ({capturedPhotos.length}장)
                  </h4>
                  <div className="space-y-1">
                    {capturedPhotos.map((filename, idx) => (
                      <div key={idx} className="text-sm text-green-800 font-mono">
                        📷 {filename}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 촬영 버튼 */}
              <button
                onClick={() => setShowCamera(true)}
                disabled={uploading}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {uploading ? '업로드 중...' : '📸 사진 촬영하기'}
              </button>

              {/* 세션 관리 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={handleStartNewSession}
                  disabled={capturedPhotos.length === 0}
                  className="flex-1 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ➡️ 다음 정보 촬영
                </button>
                <button
                  onClick={handleFinishCapture}
                  disabled={capturedPhotos.length === 0}
                  className="flex-1 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ✅ 촬영 완료
                </button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                현재 세션 ID: {currentSessionId}
              </div>
            </div>
          )}

          {/* 바코드 스캔 탭 */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">🔍 바코드 스캔 가이드</h3>
                <ul className="text-purple-800 text-sm space-y-1">
                  <li>• 바코드를 스캔하여 상품 목록을 만듭니다</li>
                  <li>• 상품을 선택하면 바코드가 크게 표시됩니다</li>
                  <li>• POS에서 해당 바코드를 스캔하고 화면을 촬영하세요</li>
                  <li>• 모바일에서 왔다갔다 할 필요 없이 한 화면에서 처리할 수 있습니다</li>
                </ul>
              </div>

              {/* 상품 추가 영역 */}
              <div className="space-y-3">
                {/* 바코드 스캔 버튼 */}
                <button
                  onClick={() => setShowBarcodeScanner(true)}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
                >
                  📷 바코드 스캔하기
                </button>

                {/* 상품명 검색 */}
                <div className="flex gap-2 w-full">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="상품명으로 검색..."
                    className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    disabled={isSearching}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-sm"
                  >
                    {isSearching ? '검색 중...' : '🔍 검색'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 text-center">
                  💡 바코드 스캔 또는 상품명으로 검색하여 추가하세요
                </p>
              </div>

              {/* 상품 목록 */}
              {scannedProducts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">
                      📦 스캔된 상품 목록 ({scannedProducts.filter(p => showInactiveProducts || p.isActive).length}개)
                    </h4>
                    <button
                      onClick={() => setShowInactiveProducts(!showInactiveProducts)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        showInactiveProducts
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-100'
                      }`}
                    >
                      {showInactiveProducts ? '✓ 비활성 항목 표시 중' : '비활성 항목 표시'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {scannedProducts.filter(p => showInactiveProducts || p.isActive).map((product) => {
                      // 원본 배열에서의 인덱스를 찾기
                      const originalIndex = scannedProducts.findIndex(p => p.barcode === product.barcode);

                      return (
                      <div
                        key={product.barcode}
                        className={`p-4 border rounded-lg transition-all ${
                          !product.isActive ? 'opacity-60 bg-gray-50' : ''
                        } ${
                          selectedProductIndex === originalIndex && product.isActive
                            ? 'border-purple-500 bg-purple-50 shadow-md cursor-pointer'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 cursor-pointer'
                        }`}
                        onClick={() => product.isActive && handleSelectProduct(originalIndex)}
                      >
                        <div className="flex items-center gap-4">
                          {/* 상품 이미지 */}
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                          )}

                          {/* 상품 정보 */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-semibold text-gray-900">{product.name}</h5>
                              {!product.isActive && (
                                <span className="px-2 py-0.5 bg-gray-400 text-white text-xs rounded-full">
                                  비활성
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 font-mono">{product.barcode}</p>
                            <p className="text-sm font-bold text-blue-600">{product.price.toLocaleString()}원</p>
                          </div>

                          {/* 활성/비활성 토글 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProductActive(product.barcode, !product.isActive);
                            }}
                            className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                              product.isActive
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-green-500 text-white hover:bg-green-600'
                            }`}
                          >
                            {product.isActive ? '✗ 비활성' : '✓ 활성'}
                          </button>

                          {/* 삭제 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`${product.name}을(를) 완전히 삭제하시겠습니까?`)) {
                                handleRemoveProduct(product.barcode);
                              }
                            }}
                            className="flex-shrink-0 text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* 선택된 상품의 바코드 표시 */}
                        {selectedProductIndex === originalIndex && product.isActive && (
                          <div className="mt-4 p-4 bg-white rounded-lg border-2 border-purple-300">
                            <h6 className="text-sm font-semibold text-purple-900 mb-3 text-center">
                              ⬇️ POS에서 이 바코드를 스캔하세요 ⬇️
                            </h6>
                            <div className="flex flex-col items-center">
                              <BarcodeDisplay barcode={product.barcode} />
                              <p className="text-lg font-mono font-bold text-gray-900 mt-2">{product.barcode}</p>
                            </div>

                            {/* POS 화면 촬영 버튼 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // 스크롤 위치 저장
                                if (scrollContainerRef.current) {
                                  savedScrollPosition.current = scrollContainerRef.current.scrollTop;
                                }
                                setCameraMode('product');
                                setShowCamera(true);
                              }}
                              disabled={uploading}
                              className="w-full mt-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                            >
                              {uploading ? '업로드 중...' : '📸 POS 화면 촬영하기'}
                            </button>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 안내 메시지 */}
              {scannedProducts.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">바코드를 스캔하여 상품을 추가하세요</p>
                  <p className="text-sm mt-2">상품을 추가하면 POS 화면 촬영을 시작할 수 있습니다</p>
                </div>
              )}
            </div>
          )}

          {/* 변환 대기 목록 탭 */}
          {activeTab === 'list' && (
            <div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                  <p className="mt-4 text-gray-600">로딩 중...</p>
                </div>
              ) : pendingPhotos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">변환 대기 중인 사진이 없습니다.</p>
                  <p className="text-gray-400 text-sm mt-2">사진 촬영 탭에서 사진을 촬영해주세요.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-blue-900">📸 변환 대기 중</h3>
                      <button
                        onClick={() => setShowDeactivated(!showDeactivated)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          showDeactivated
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
                        }`}
                      >
                        {showDeactivated ? '✓ 비활성 항목 표시 중' : '비활성 항목 표시'}
                      </button>
                    </div>
                    <p className="text-blue-800 text-sm">
                      총 <strong>{pendingPhotos.length}개</strong> 항목 중{' '}
                      <strong>{getFilteredPhotos().length}개</strong>가 활성화되어 있습니다.
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {getFilteredPhotos().map((photo, idx) => {
                      const itemId = photo.promotionId || photo.sessionId || '';
                      const deactivated = isItemDeactivated(itemId);

                      return (
                        <div
                          key={itemId}
                          className={`p-4 rounded-lg border transition-all ${
                            deactivated
                              ? 'bg-gray-100 border-gray-300 opacity-60'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">
                                  {photo.promotionName || photo.sessionName}
                                </h4>
                                {photo.promotionId ? (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                    프로모션
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs rounded-full">
                                    독립 촬영
                                  </span>
                                )}
                                {deactivated && (
                                  <span className="px-2 py-0.5 bg-gray-400 text-white text-xs rounded-full">
                                    비활성
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 font-mono mt-1">
                                ID: {itemId}
                              </p>
                              <p className="text-sm text-gray-600 mt-2">
                                📷 {photo.photoCount}장의 사진
                              </p>
                              {photo.lastUpdated && (
                                <p className="text-xs text-gray-400 mt-1">
                                  마지막 업데이트: {new Date(photo.lastUpdated).toLocaleString('ko-KR')}
                                </p>
                              )}

                              {/* 사진 미리보기 */}
                              <div className="flex gap-2 mt-3 overflow-x-auto">
                                {photo.photos.slice(0, 3).map((p, photoIdx) => (
                                  <img
                                    key={photoIdx}
                                    src={`/api/admin/photos/view?accountAddress=${userAddress}&path=${encodeURIComponent(getPhotoPath(photo, p.filename))}`}
                                    alt={`Photo ${photoIdx + 1}`}
                                    onClick={() => {
                                      setSelectedPhoto(photo);
                                      setShowPhotoPreview(true);
                                    }}
                                    className="w-20 h-20 object-cover rounded border border-gray-300 cursor-pointer hover:scale-110 transition-transform"
                                  />
                                ))}
                                {photo.photoCount > 3 && (
                                  <div className="w-20 h-20 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-gray-600 text-xs">
                                    +{photo.photoCount - 3}장
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 활성/비활성화 버튼 */}
                            <button
                              onClick={() => toggleItemStatus(itemId, deactivated)}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                deactivated
                                  ? 'bg-green-500 text-white hover:bg-green-600'
                                  : 'bg-red-500 text-white hover:bg-red-600'
                              }`}
                            >
                              {deactivated ? '✓ 활성화' : '✗ 비활성화'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-gray-300 pt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">🔄 변환 작업 순서</h3>
                    <ol className="space-y-2 text-sm text-gray-700">
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-600">1.</span>
                        <span>"변환 요청 복사" 버튼을 클릭하여 작업 정보를 복사합니다.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-600">2.</span>
                        <span>Claude에게 복사한 내용을 붙여넣기합니다.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-600">3.</span>
                        <span>Claude가 생성한 JSON 데이터를 받습니다.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-600">4.</span>
                        <span>"데이터 임포트" 탭에서 JSON을 붙여넣고 임포트합니다.</span>
                      </li>
                    </ol>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 데이터 임포트 탭 */}
          {activeTab === 'import' && (
            <div>
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ 주의사항</h3>
                <ul className="text-yellow-800 text-sm space-y-1">
                  <li>• 임포트 전에 데이터를 검토하세요</li>
                  <li>• 임포트는 되돌릴 수 없습니다</li>
                </ul>
              </div>

              {/* 임포트 모드 선택 */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setImportMode('file')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    importMode === 'file'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📁 파일 선택
                </button>
                <button
                  onClick={() => setImportMode('paste')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    importMode === 'paste'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📋 직접 붙여넣기
                </button>
              </div>

              {/* 파일 선택 모드 */}
              {importMode === 'file' && (
                <div className="space-y-3">
                  {loadingBatches ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                      <p className="mt-2 text-gray-600 text-sm">파일 목록 로딩 중...</p>
                    </div>
                  ) : batchFiles.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">변환 배치 파일이 없습니다.</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Claude가 생성한 JSON 파일을 data/promotions/conversion-batches/ 폴더에 저장하세요.
                      </p>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-semibold text-gray-900">변환 배치 파일 목록</h4>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {batchFiles.map((batch) => (
                          <div
                            key={batch.filename}
                            onClick={() => !batch.isImported && handleSelectBatchFile(batch.filename)}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedBatchFile === batch.filename
                                ? 'border-blue-500 bg-blue-50'
                                : batch.isImported
                                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-mono text-sm text-gray-900">{batch.filename}</p>
                                  {batch.isImported && (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                      ✓ 임포트 완료
                                    </span>
                                  )}
                                  {batch.error && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                      ⚠️ 오류
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                  <span>📊 {batch.conversions}개 변환</span>
                                  <span>📅 {new Date(batch.createdAt).toLocaleString('ko-KR')}</span>
                                  <span>💾 {(batch.fileSize / 1024).toFixed(1)} KB</span>
                                </div>
                                {batch.error && (
                                  <p className="text-xs text-red-600 mt-1">{batch.error}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {selectedBatchFile && conversionData && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm">
                        ✅ <strong>{selectedBatchFile}</strong> 파일이 로드되었습니다.
                      </p>
                      <p className="text-green-700 text-xs mt-1">
                        아래 "데이터 임포트" 버튼을 클릭하여 임포트하세요.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 직접 붙여넣기 모드 */}
              {importMode === 'paste' && (
                <textarea
                  value={conversionData}
                  onChange={(e) => setConversionData(e.target.value)}
                  placeholder='Claude가 생성한 JSON 데이터를 여기에 붙여넣기 하세요.

예시:
{
  "batchId": "batch_2025-10-22_15-30-45",
  "conversions": [
    {
      "sourcePromotionId": "...",
      "action": "update_and_merge",
      ...
    }
  ]
}'
                  className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
                />
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 p-6 flex gap-3">
          {activeTab === 'list' && pendingPhotos.length > 0 && (
            <button
              onClick={handleCopyTaskInfo}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md"
            >
              📋 변환 요청 복사
            </button>
          )}
          {activeTab === 'import' && (
            <button
              onClick={handleImport}
              disabled={importing || !conversionData.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {importing ? '임포트 중...' : '📥 데이터 임포트'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 사진 미리보기 모달 */}
      {showPhotoPreview && selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col m-4">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">
                📷 {selectedPhoto.promotionName || selectedPhoto.sessionName}
              </h3>
              <button
                onClick={() => {
                  setShowPhotoPreview(false);
                  setSelectedPhoto(null);
                }}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPhoto.photos.map((photo, idx) => (
                  <div key={idx} className="border border-gray-300 rounded-lg overflow-hidden">
                    <img
                      src={`/api/admin/photos/view?accountAddress=${userAddress}&path=${encodeURIComponent(getPhotoPath(selectedPhoto, photo.filename))}`}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-auto"
                    />
                    <div className="p-2 bg-gray-50 text-xs text-gray-600 font-mono">
                      {photo.filename}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상품 검색 결과 모달 */}
      {showSearchResults && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col m-4">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">
                🔍 검색 결과: "{searchQuery}"
              </h3>
              <button
                onClick={() => {
                  setShowSearchResults(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {searchResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">검색 결과가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((product, index) => (
                    <div
                      key={product.barcode}
                      ref={(el) => { searchResultRefs.current[index] = el; }}
                      onClick={() => handleSelectSearchResult(product)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        index === selectedSearchResultIndex
                          ? 'border-purple-500 bg-purple-100'
                          : 'border-gray-200 hover:border-purple-500 hover:bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-900">{product.name}</h5>
                          <p className="text-sm text-gray-600 font-mono">{product.barcode}</p>
                          <p className="text-sm font-bold text-blue-600">{product.price.toLocaleString()}원</p>
                        </div>
                        <div className={index === selectedSearchResultIndex ? 'text-purple-700' : 'text-purple-600'}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <p className="text-sm text-gray-600 text-center">
                💡 클릭하거나 방향키(↑↓)로 선택하고 Enter로 추가 · ESC로 닫기
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 바코드 표시 컴포넌트
function BarcodeDisplay({ barcode }: { barcode: string }) {
  return (
    <div className="bg-white p-2 rounded-lg overflow-x-auto">
      <div className="flex justify-center min-w-0">
        <Barcode
          value={barcode}
          width={2}
          height={60}
          fontSize={14}
          margin={5}
          displayValue={true}
        />
      </div>
    </div>
  );
}
