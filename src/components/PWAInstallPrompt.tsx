'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'pwa-install-dismissed';
const DISMISS_COUNT_KEY = 'pwa-dismiss-count';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showDismissOptions, setShowDismissOptions] = useState(false);

  useEffect(() => {
    // iOS 감지
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // 이미 설치된 경우 버튼 숨김
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // localStorage 확인: 사용자가 영구적으로 숨기기를 선택했는지
    const dismissedData = localStorage.getItem(STORAGE_KEY);
    if (dismissedData) {
      const { until } = JSON.parse(dismissedData);
      if (until === 'forever' || new Date().getTime() < new Date(until).getTime()) {
        return; // 아직 숨김 기간
      }
    }

    // iOS에서는 Safari만 PWA 설치 가능하고, 이미 설치되지 않은 경우 버튼 표시
    if (iOS) {
      // @ts-ignore
      const isStandalone = window.navigator.standalone;
      if (!isStandalone) {
        setShowInstallButton(true);
      }
      return;
    }

    // Android/Desktop: beforeinstallprompt 이벤트 캡처
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // iOS는 직접 설치 불가능, 안내 표시
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      return;
    }

    // 설치 프롬프트 표시
    deferredPrompt.prompt();

    // 사용자 선택 대기
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA 설치 완료');
      // 설치 완료 시 영구적으로 숨김
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ until: 'forever' }));
    }

    // 프롬프트는 한 번만 사용 가능
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  const handleClose = () => {
    // 닫은 횟수 확인
    const dismissCount = parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || '0');

    if (dismissCount === 0) {
      // 첫 번째 닫기: 카운트만 증가, 새로고침하면 다시 뜸
      localStorage.setItem(DISMISS_COUNT_KEY, '1');
      setShowInstallButton(false);
    } else {
      // 두 번째 이상 닫기: 옵션 모달 표시
      setShowDismissOptions(true);
    }
  };

  const handleDismissOption = (days: number | 'forever') => {
    if (days === 'forever') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ until: 'forever' }));
    } else {
      const until = new Date();
      until.setDate(until.getDate() + days);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ until: until.toISOString() }));
    }

    setShowDismissOptions(false);
    setShowInstallButton(false);
  };

  if (!showInstallButton) {
    return null;
  }

  return (
    <>
      {/* 설치 버튼 */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
        <div className="bg-[#7C3FBF] text-white rounded-lg shadow-lg p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="font-bold text-sm">앱으로 설치하기</p>
            <p className="text-xs opacity-90">홈 화면에서 빠르게 접속하세요</p>
          </div>
          <button
            onClick={handleInstallClick}
            className="bg-white text-[#7C3FBF] px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            설치
          </button>
          <button
            onClick={handleClose}
            className="text-white hover:opacity-70 transition-opacity"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 닫기 옵션 선택 모달 */}
      {showDismissOptions && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-4"
          onClick={() => setShowDismissOptions(false)}
        >
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">얼마 동안 숨길까요?</h3>
              <button
                onClick={() => setShowDismissOptions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-600 mb-6 text-sm">
              설치 안내를 다시 보려면 원하는 기간을 선택하세요
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleDismissOption(1)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition-colors"
              >
                <p className="font-bold text-gray-900">1일 후 다시 보기</p>
                <p className="text-sm text-gray-600">내일 다시 표시됩니다</p>
              </button>

              <button
                onClick={() => handleDismissOption(7)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition-colors"
              >
                <p className="font-bold text-gray-900">7일 후 다시 보기</p>
                <p className="text-sm text-gray-600">일주일 동안 숨깁니다</p>
              </button>

              <button
                onClick={() => handleDismissOption(30)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition-colors"
              >
                <p className="font-bold text-gray-900">30일 후 다시 보기</p>
                <p className="text-sm text-gray-600">한 달 동안 숨깁니다</p>
              </button>

              <button
                onClick={() => handleDismissOption('forever')}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition-colors"
              >
                <p className="font-bold text-gray-900">다시 보지 않기</p>
                <p className="text-sm text-gray-600">영구적으로 숨깁니다</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS 설치 안내 모달 */}
      {showIOSInstructions && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-4"
          onClick={() => setShowIOSInstructions(false)}
        >
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">앱 설치 방법 (iOS)</h3>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-gray-700">
              <div className="flex items-start gap-3">
                <div className="bg-[#7C3FBF] text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <p>화면 하단의 <strong>공유 버튼 (□↑)</strong>을 탭하세요</p>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-[#7C3FBF] text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <p>아래로 스크롤하여 <strong>"홈 화면에 추가"</strong>를 선택하세요</p>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-[#7C3FBF] text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <p><strong>"추가"</strong>를 탭하면 홈 화면에 아이콘이 생성됩니다</p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="mt-6 w-full bg-[#7C3FBF] text-white py-3 rounded-lg font-bold hover:bg-[#6B35A8] transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
