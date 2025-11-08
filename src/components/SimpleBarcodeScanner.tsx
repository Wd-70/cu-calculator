'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface SimpleBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void; // 바코드 인식 시 호출
}

export default function SimpleBarcodeScanner({ isOpen, onClose, onScan }: SimpleBarcodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const hasScannedRef = useRef(false);
  const elementId = 'simple-barcode-scanner';

  // 카메라 시작
  const startCamera = async () => {
    try {
      if (scannerRef.current) {
        return;
      }

      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
            const minEdgePercentage = 0.7;
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
            return {
              width: qrboxSize,
              height: Math.floor(qrboxSize * 0.6),
            };
          },
        },
        async (decodedText) => {
          // 바코드 인식 - 중복 방지
          if (hasScannedRef.current || isStoppingRef.current) {
            return;
          }

          hasScannedRef.current = true;
          setScannedBarcode(decodedText);

          // 바코드 전달
          onScan(decodedText);

          // 잠시 후 카메라 정지 및 모달 닫기
          setTimeout(async () => {
            await stopCamera();
            onClose();
          }, 500);
        },
        () => {
          // 스캔 에러 무시
        }
      );

      setHasPermission(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Camera access failed';
      setHasPermission(false);
      setErrorMessage('카메라 접근 권한이 필요합니다.');
      console.error('Failed to start camera:', error);
    }
  };

  // 카메라 정지
  const stopCamera = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (error) {
      console.error('Failed to stop camera:', error);
    } finally {
      isStoppingRef.current = false;
      hasScannedRef.current = false;
    }
  };

  // 모달 열릴 때 카메라 시작
  useEffect(() => {
    if (isOpen) {
      hasScannedRef.current = false;
      setScannedBarcode('');
      setErrorMessage('');
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-[70] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">바코드 스캔</h2>
            <p className="text-sm text-purple-100 mt-1">
              바코드를 화면 중앙에 맞춰주세요
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 스캐너 영역 */}
        <div className="relative bg-black">
          {/* 카메라 뷰 */}
          <div id={elementId} className="w-full" style={{ minHeight: '400px' }}></div>

          {/* 스캔 안내 오버레이 */}
          {hasPermission && !scannedBarcode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 max-w-xs">
                  <div className="text-4xl mb-2">📷</div>
                  <p className="text-sm font-medium text-gray-800">
                    바코드를 스캔 영역에 맞춰주세요
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    자동으로 인식됩니다
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 스캔 성공 피드백 */}
          {scannedBarcode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-green-500/30">
              <div className="bg-white rounded-xl p-6 shadow-2xl">
                <div className="text-center">
                  <div className="text-6xl mb-3">✓</div>
                  <p className="text-lg font-bold text-gray-800 mb-1">바코드 인식 완료!</p>
                  <p className="text-sm text-gray-600 font-mono">{scannedBarcode}</p>
                </div>
              </div>
            </div>
          )}

          {/* 권한 오류 */}
          {hasPermission === false && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white p-6">
                <div className="text-6xl mb-4">📷</div>
                <p className="text-lg font-semibold mb-2">카메라 접근 권한이 필요합니다</p>
                <p className="text-sm text-gray-300 mb-4">
                  {errorMessage || '브라우저 설정에서 카메라 권한을 허용해주세요.'}
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="bg-gray-50 p-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              💡 바코드가 인식되면 자동으로 입력됩니다
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
