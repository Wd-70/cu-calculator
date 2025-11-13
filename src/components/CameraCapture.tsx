'use client';

import { useState, useRef, useEffect } from 'react';

interface CameraCaptureProps {
  onCapture: (blob: Blob, filename: string) => Promise<void>;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 후면 카메라 우선
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('카메라 접근 권한이 필요합니다.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // 캔버스 크기를 비디오 크기에 맞춤
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 비디오 프레임을 캔버스에 그리기
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
      }

      // 캔버스를 Blob으로 변환
      canvas.toBlob(async (blob) => {
        if (blob) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `photo_${timestamp}.jpg`;

          await onCapture(blob, filename);
          stopCamera();
          onClose();
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Capture error:', err);
      setError('사진 촬영 중 오류가 발생했습니다.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ height: '100dvh' }}>
      {/* 헤더 */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-bold">📷 POS 화면 촬영</h2>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="text-white hover:bg-gray-700 rounded-full p-2 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 카메라 뷰 */}
      <div className="flex-1 relative bg-black overflow-hidden" style={{ minHeight: 0 }}>
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-white text-center p-8">
            <div>
              <p className="text-xl mb-4">⚠️</p>
              <p>{error}</p>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />

            {/* 가이드 오버레이 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 border-2 border-yellow-400 border-dashed rounded-lg">
                <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-yellow-400 text-xs px-2 py-1 rounded">
                  POS 화면을 프레임 안에 맞춰주세요
                </div>
              </div>
            </div>
          </>
        )}

        {/* 숨겨진 캔버스 */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* 촬영 버튼 */}
      <div className="bg-gray-900 p-4 pb-6 flex-shrink-0 safe-area-bottom">
        <button
          onClick={capturePhoto}
          disabled={capturing || !!error}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95 touch-manipulation"
        >
          {capturing ? '촬영 중...' : '📸 촬영하기'}
        </button>
        <p className="text-center text-gray-400 text-xs mt-2">
          촬영된 사진은 자동으로 저장됩니다
        </p>
      </div>
    </div>
  );
}
