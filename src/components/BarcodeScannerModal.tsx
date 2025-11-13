'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { normalizeBarcode } from '@/lib/utils/barcodeUtils';
import { IProduct } from '@/types/product';
import { loadAllProducts, findProductByBarcode } from '@/lib/utils/productLoader';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string, product?: IProduct) => Promise<boolean>; // 성공 여부를 반환, 중복 조회 방지를 위해 product 전달
  cartId: string;
}

interface LastScannedProduct {
  barcode: string;
  name: string;
  price: number;
  imageUrl?: string;
  success: boolean;
}

export default function BarcodeScannerModal({ isOpen, onClose, onScan, cartId }: BarcodeScannerModalProps) {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [lastScannedProduct, setLastScannedProduct] = useState<LastScannedProduct | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [laserLinePosition, setLaserLinePosition] = useState<{ top: number; width: number } | null>(null);
  const [barcodeDetected, setBarcodeDetected] = useState(false);
  const [allProducts, setAllProducts] = useState<IProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const elementId = 'continuous-barcode-reader';

  // 버튼을 누른 후에만 바코드 처리
  const shouldProcessBarcodeRef = useRef<boolean>(false);
  const processingBarcodeRef = useRef<boolean>(false);

  const startCamera = async () => {
    try {
      if (scannerRef.current) {
        return; // 이미 시작됨
      }

      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      // 카메라 시작 - 버튼 누른 후에만 바코드 처리
      await scanner.start(
        { facingMode: 'environment' }, // 후면 카메라 사용
        {
          fps: 10,
          qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
            // qrbox를 뷰파인더 중앙에 맞추기
            const minEdgePercentage = 0.7; // 70% 크기
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
            return {
              width: qrboxSize,
              height: Math.floor(qrboxSize * 0.6), // 바코드는 가로가 길기 때문에 세로를 60%로
            };
          },
        },
        async (decodedText) => {
          // 버튼을 누른 후에만 처리
          if (!shouldProcessBarcodeRef.current || processingBarcodeRef.current) {
            return;
          }

          processingBarcodeRef.current = true;
          shouldProcessBarcodeRef.current = false; // 한 번만 처리

          const normalizedBarcode = normalizeBarcode(decodedText);
          setBarcodeDetected(true);

          try {
            // 메모리에서 상품 검색 (즉시 검색)
            const product = findProductByBarcode(allProducts, normalizedBarcode);

            if (!product) {
              setScanFeedback({ type: 'error', message: '상품을 찾을 수 없습니다' });
              if (navigator.vibrate) {
                navigator.vibrate(200);
              }
              setLastScannedProduct({
                barcode: normalizedBarcode,
                name: '알 수 없는 상품',
                price: 0,
                success: false,
              });
              setTimeout(() => {
                setScanFeedback(null);
                setBarcodeDetected(false);
              }, 800);
              setIsScanning(false);
              processingBarcodeRef.current = false;
              return;
            }

            // 장바구니에 추가 (상품 정보를 함께 전달하여 중복 조회 방지)
            const success = await onScan(normalizedBarcode, product);

            // 마지막 스캔 상품 정보 저장
            setLastScannedProduct({
              barcode: product.barcode,
              name: product.name,
              price: product.price,
              imageUrl: product.imageUrl,
              success,
            });

            // 피드백 표시
            if (success) {
              setScanFeedback({ type: 'success', message: '상품이 추가되었습니다!' });
              if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
              }
            } else {
              setScanFeedback({ type: 'error', message: '장바구니에 추가할 수 없습니다' });
              if (navigator.vibrate) {
                navigator.vibrate(200);
              }
            }

            // 피드백 자동 숨김
            setTimeout(() => {
              setScanFeedback(null);
              setBarcodeDetected(false);
            }, 800);

            setIsScanning(false);
            processingBarcodeRef.current = false;

          } catch (error) {
            console.error('Scan error:', error);
            setScanFeedback({ type: 'error', message: '스캔 중 오류가 발생했습니다' });
            setTimeout(() => {
              setScanFeedback(null);
              setBarcodeDetected(false);
            }, 800);
            setIsScanning(false);
            processingBarcodeRef.current = false;
          }
        },
        () => {
          // 스캔 에러 무시
        }
      );

      setIsCameraReady(true);
      setHasPermission(true);

      // qrbox의 크기를 찾아서 레이저 라인 너비 설정 및 video 위치 조정
      setTimeout(() => {
        const videoElement = document.querySelector('#' + elementId + ' video') as HTMLVideoElement;

        if (videoElement) {
          const videoRect = videoElement.getBoundingClientRect();

          // qrbox 크기 계산 (화면 크기의 70%)
          const qrboxWidth = Math.min(videoRect.width, videoRect.height) * 0.7;

          setLaserLinePosition({
            top: 0, // 사용하지 않음 (flex center로 정렬)
            width: qrboxWidth
          });

          // video 영상을 중앙으로 이동 (상단 크롭 문제 해결)
          // videoHeight와 containerHeight를 비교해서 얼마나 이동할지 계산
          const containerHeight = videoElement.parentElement?.clientHeight || 300;
          const videoHeight = videoElement.videoHeight;
          const videoWidth = videoElement.videoWidth;

          if (videoHeight && videoWidth) {
            // 현재 표시되는 video 요소의 실제 높이
            const displayWidth = videoRect.width;
            const aspectRatio = videoHeight / videoWidth;
            const actualVideoHeight = displayWidth * aspectRatio;

            // 크롭되는 부분의 절반만큼 위로 이동 (중앙 정렬)
            const cropAmount = actualVideoHeight - containerHeight;
            if (cropAmount > 0) {
              const translateY = -(cropAmount / 2);
              videoElement.style.transform = `translateY(${translateY}px)`;
            }
          }
        }

      }, 300);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Camera access failed';
      setHasPermission(false);
      console.error('Failed to start camera:', error);
    }
  };

  // 스캔 버튼 클릭 시 바코드 처리 활성화
  const handleScanClick = () => {
    if (isScanning || processingBarcodeRef.current) return;

    setIsScanning(true);
    setScanFeedback(null);

    // 바코드 처리 플래그 활성화 (다음 감지된 바코드를 즉시 처리)
    shouldProcessBarcodeRef.current = true;

    // 10초 타임아웃 설정 (바코드를 감지하지 못하면 실패)
    setTimeout(() => {
      if (shouldProcessBarcodeRef.current && !processingBarcodeRef.current) {
        // 10초 동안 바코드를 감지하지 못함
        shouldProcessBarcodeRef.current = false;
        setScanFeedback({ type: 'error', message: '바코드를 인식하지 못했습니다' });
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }
        setTimeout(() => {
          setScanFeedback(null);
        }, 800);
        setIsScanning(false);
      }
    }, 10000);
  };

  const stopCamera = async () => {
    if (isStoppingRef.current) {
      return; // 이미 중지 중
    }

    isStoppingRef.current = true;

    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        if (scanner.isScanning) {
          await scanner.stop();
        }
        await scanner.clear();
        scannerRef.current = null;
      }
    } catch (error) {
      // 전환 에러는 무시 (정상적인 상태)
      console.log('Camera stop completed with minor transition issue');
    } finally {
      setIsCameraReady(false);
      isStoppingRef.current = false;
    }
  };

  // 모달이 열릴 때 전체 상품 로드
  useEffect(() => {
    if (isOpen) {
      const loadProducts = async () => {
        setIsLoadingProducts(true);
        const products = await loadAllProducts();
        setAllProducts(products);
        setIsLoadingProducts(false);
      };
      loadProducts();
    }
  }, [isOpen]);

  // 모달이 열릴 때 카메라 시작 및 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      // 스크롤 방지
      document.body.style.overflow = 'hidden';

      startCamera();
      setLastScannedProduct(null);
      setScanFeedback(null);

      // 플래그 초기화
      shouldProcessBarcodeRef.current = false;
      processingBarcodeRef.current = false;
    } else {
      // 스크롤 복원
      document.body.style.overflow = '';

      stopCamera();
    }

    return () => {
      if (isOpen) {
        // 스크롤 복원
        document.body.style.overflow = '';
        stopCamera();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* CSS로 qrbox 완전히 숨기기 */}
      <style jsx global>{`
        #${elementId} video {
          object-fit: cover !important;
          transform: translateY(-150px) !important;
          transition: transform 0.3s ease-out;
        }

        /* qrbox 완전히 숨기기 */
        #qr-shaded-region {
          display: none !important;
        }
      `}</style>

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">바코드 스캔</h2>
            <p className="text-xs text-gray-600">연속 스캔 모드</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 카메라 뷰 */}
      <div className="flex-1 flex flex-col items-center p-4 overflow-hidden">
        <div className="w-full max-w-2xl">
          {/* 카메라 영역 - 높이 제한 */}
          <div className="relative">
            <div
              id={elementId}
              className="w-full rounded-xl overflow-hidden shadow-2xl"
              style={{ maxHeight: '300px' }}
            ></div>

            {/* 레이저 라인 - 바코드 감지 시 색깔 변경 */}
            {isCameraReady && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`h-1 transition-all duration-300 ${
                    barcodeDetected ? 'bg-green-500' : 'bg-red-600'
                  }`}
                  style={{
                    width: laserLinePosition ? `${laserLinePosition.width}px` : '70%',
                    boxShadow: barcodeDetected
                      ? '0 0 10px rgba(34, 197, 94, 0.9), 0 0 20px rgba(34, 197, 94, 0.7), 0 0 30px rgba(34, 197, 94, 0.5)'
                      : '0 0 10px rgba(220, 38, 38, 0.9), 0 0 20px rgba(220, 38, 38, 0.7), 0 0 30px rgba(220, 38, 38, 0.5)',
                    background: barcodeDetected
                      ? 'linear-gradient(to bottom, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 1), rgba(34, 197, 94, 0.3))'
                      : 'linear-gradient(to bottom, rgba(220, 38, 38, 0.3), rgba(220, 38, 38, 1), rgba(220, 38, 38, 0.3))'
                  }}
                ></div>
              </div>
            )}
          </div>

          {hasPermission === false && (
            <div className="mt-4 p-4 bg-red-500 text-white rounded-xl text-center">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-bold mb-1">카메라 권한이 필요합니다</p>
              <p className="text-sm">브라우저 설정에서 카메라 접근을 허용해주세요</p>
            </div>
          )}

          {/* 스캔 피드백 */}
          {scanFeedback && (
            <div className={`mt-4 p-4 rounded-xl text-center animate-bounce ${
              scanFeedback.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}>
              <div className="flex items-center justify-center gap-2">
                {scanFeedback.type === 'success' ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <p className="font-bold">{scanFeedback.message}</p>
              </div>
            </div>
          )}

          {/* 상품 로딩 중 */}
          {isLoadingProducts && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl text-center">
              <div className="flex items-center justify-center gap-2 text-blue-700">
                <div className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-medium">상품 정보 로딩 중...</p>
              </div>
            </div>
          )}

          {/* 스캔 버튼 - 상품 로드 완료 후 표시 */}
          {isCameraReady && !scanFeedback && !isLoadingProducts && (
            <div className="mt-4">
              <button
                onClick={handleScanClick}
                disabled={isScanning || allProducts.length === 0}
                className={`w-full py-5 rounded-xl font-bold text-xl transition-all ${
                  isScanning || allProducts.length === 0
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 active:scale-95 shadow-lg'
                }`}
              >
                {isScanning ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    바코드 감지 중...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    스캔하기
                  </span>
                )}
              </button>
              <p className="text-center text-sm text-gray-500 mt-2">
                바코드를 빨간 선에 맞추고 버튼을 누르세요
              </p>
              <p className="text-center text-xs text-gray-400 mt-1">
                {allProducts.length.toLocaleString()}개 상품 로드 완료
              </p>
            </div>
          )}

        </div>
      </div>

      {/* 마지막 스캔 상품 정보 */}
      {lastScannedProduct && (
        <div className="bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-600 rounded"></span>
              {lastScannedProduct.success ? '추가된 상품' : '스캔 실패'}
            </h3>
            <div className={`flex items-center gap-4 p-4 rounded-xl ${
              lastScannedProduct.success
                ? 'bg-green-50 border-2 border-green-200'
                : 'bg-red-50 border-2 border-red-200'
            }`}>
              {/* 상품 이미지 */}
              <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                {lastScannedProduct.imageUrl ? (
                  <img
                    src={lastScannedProduct.imageUrl}
                    alt={lastScannedProduct.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/80x80?text=No+Image';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* 상품 정보 */}
              <div className="flex-1 min-w-0">
                <h4 className={`font-bold text-lg mb-1 ${
                  lastScannedProduct.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {lastScannedProduct.name}
                </h4>
                <p className={`text-xl font-bold mb-1 ${
                  lastScannedProduct.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {lastScannedProduct.price.toLocaleString()}원
                </p>
                <p className="text-xs text-gray-600 font-mono">
                  {lastScannedProduct.barcode}
                </p>
              </div>

              {/* 성공/실패 아이콘 */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                lastScannedProduct.success ? 'bg-green-500' : 'bg-red-500'
              }`}>
                {lastScannedProduct.success ? (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 하단 안내 */}
      <div className="bg-gray-800 text-white px-4 py-3">
        <div className="max-w-2xl mx-auto text-center text-sm">
          <p className="font-semibold mb-1">💡 버튼 스캔 모드</p>
          <p className="text-gray-300 text-xs">
            바코드를 빨간 선에 맞추고 "스캔하기" 버튼을 누르세요.
          </p>
        </div>
      </div>
    </div>
  );
}
