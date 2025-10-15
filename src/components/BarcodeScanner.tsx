'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
}

export default function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = 'barcode-reader';

  const startScanning = async () => {
    try {
      if (scannerRef.current) {
        await stopScanning();
      }

      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Use rear camera
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
        },
        (decodedText) => {
          // Success callback
          onScan(decodedText);
          stopScanning();
        },
        (errorMessage) => {
          // Error callback - ignore frequent scan failures
          // console.log('Scan error:', errorMessage);
        }
      );

      setIsScanning(true);
      setHasPermission(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Camera access failed';
      setHasPermission(false);
      onError?.(errorMsg);
      console.error('Failed to start scanner:', error);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
    scannerRef.current = null;
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        id={elementId}
        className="w-full max-w-md border-2 border-gray-300 rounded-lg overflow-hidden"
      ></div>

      {hasPermission === false && (
        <div className="text-red-600 text-sm text-center">
          카메라 권한이 필요합니다. 브라우저 설정에서 카메라 접근을 허용해주세요.
        </div>
      )}

      {!isScanning ? (
        <button
          onClick={startScanning}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          바코드 스캔 시작
        </button>
      ) : (
        <button
          onClick={stopScanning}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          스캔 중지
        </button>
      )}

      <div className="text-sm text-gray-600 text-center">
        {isScanning ? '바코드를 카메라에 비춰주세요' : '버튼을 눌러 스캔을 시작하세요'}
      </div>
    </div>
  );
}
