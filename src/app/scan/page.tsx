'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrowserMultiFormatReader } from '@zxing/library';

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    // 컴포넌트 마운트 시 카메라 권한 확인
    checkCameraPermission();

    return () => {
      // 컴포넌트 언마운트 시 스캐너 정리
      stopScanning();
    };
  }, []);

  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
    } catch (err) {
      setHasPermission(false);
      setError('카메라 접근 권한이 필요합니다.');
    }
  };

  const startScanning = async () => {
    try {
      setError(null);
      setScannedCode(null);
      setIsScanning(true);

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      const videoInputDevices = await codeReader.listVideoInputDevices();

      if (videoInputDevices.length === 0) {
        throw new Error('카메라를 찾을 수 없습니다.');
      }

      // 후면 카메라 우선 선택
      const rearCamera = videoInputDevices.find(
        device => device.label.toLowerCase().includes('back') ||
                  device.label.toLowerCase().includes('rear')
      );
      const selectedDeviceId = rearCamera?.deviceId || videoInputDevices[0].deviceId;

      if (videoRef.current) {
        codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, err) => {
            if (result) {
              const barcodeText = result.getText();
              setScannedCode(barcodeText);
              stopScanning();

              // 바코드 스캔 성공 시 상품 검색 페이지로 이동
              router.push(`/products?search=${encodeURIComponent(barcodeText)}`);
            }
            if (err && !(err.name === 'NotFoundException')) {
              console.error('Scan error:', err);
            }
          }
        );
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError(err instanceof Error ? err.message : '카메라를 시작할 수 없습니다.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    setIsScanning(false);
  };

  const handleManualInput = () => {
    const barcode = prompt('바코드 번호를 입력하세요:');
    if (barcode && barcode.trim()) {
      router.push(`/products?search=${encodeURIComponent(barcode.trim())}`);
    }
  };

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
              <h1 className="text-xl font-bold text-gray-900">바코드 스캔</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* 스캐너 영역 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="aspect-[4/3] bg-gray-900 rounded-xl overflow-hidden relative">
            {!isScanning ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <svg className="w-24 h-24 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <p className="text-lg font-medium">스캔을 시작하려면 버튼을 누르세요</p>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {/* 스캔 가이드 라인 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3/4 h-1/3 border-4 border-purple-500 rounded-lg shadow-lg">
                    <div className="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-purple-500"></div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 border-t-4 border-r-4 border-purple-500"></div>
                    <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-4 border-l-4 border-purple-500"></div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-4 border-r-4 border-purple-500"></div>
                  </div>
                </div>
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <p className="text-white text-sm bg-black bg-opacity-50 inline-block px-4 py-2 rounded-full">
                    바코드를 프레임 안에 맞춰주세요
                  </p>
                </div>
              </>
            )}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* 스캔 결과 */}
          {scannedCode && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-green-700 text-sm font-medium mb-1">스캔 완료!</p>
              <p className="text-green-600 text-sm">{scannedCode}</p>
            </div>
          )}

          {/* 컨트롤 버튼 */}
          <div className="mt-6 space-y-3">
            {!isScanning ? (
              <button
                onClick={startScanning}
                disabled={hasPermission === false}
                className="w-full py-4 bg-[#7C3FBF] text-white rounded-xl font-bold text-lg hover:bg-[#6B2FAF] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {hasPermission === false ? '카메라 권한 없음' : '스캔 시작'}
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 transition-colors"
              >
                스캔 중지
              </button>
            )}

            <button
              onClick={handleManualInput}
              className="w-full py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors"
            >
              직접 입력하기
            </button>
          </div>
        </div>

        {/* 안내 사항 */}
        <div className="bg-blue-50 rounded-xl p-4">
          <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            사용 팁
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 바코드를 프레임 안에 수평으로 맞춰주세요</li>
            <li>• 조명이 밝은 곳에서 스캔하면 더 정확합니다</li>
            <li>• 바코드가 손상되었다면 직접 입력을 이용하세요</li>
            <li>• 스캔 후 자동으로 상품 검색 페이지로 이동합니다</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
