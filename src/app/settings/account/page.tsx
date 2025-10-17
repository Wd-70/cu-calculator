'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  createAccount,
  loadAccount,
  getPrivateKey,
  restoreAccount,
  deleteAccount,
  getCurrentUserAddress
} from '@/lib/userAuth';
import Toast from '@/components/Toast';

export default function AccountSettingsPage() {
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreKeyInput, setRestoreKeyInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    checkAccount();
  }, []);

  const checkAccount = async () => {
    setLoading(true);
    try {
      const account = await loadAccount();
      if (account) {
        setUserAddress(account.address);
      }
    } catch (error) {
      console.error('Failed to check account:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (userAddress) {
      if (!confirm('이미 계정이 있습니다. 새 계정을 만들면 기존 계정은 삭제됩니다. 계속하시겠습니까?')) {
        return;
      }
    }

    try {
      setLoading(true);
      const { address, privateKey: newPrivateKey } = await createAccount();
      setUserAddress(address);
      setToast({
        message: '계정이 생성되었습니다! 비밀키를 안전한 곳에 백업해주세요.',
        type: 'success'
      });

      // 자동으로 비밀키 표시
      setPrivateKey(newPrivateKey);
      setShowPrivateKey(true);
    } catch (error) {
      console.error('Failed to create account:', error);
      setToast({
        message: '계정 생성에 실패했습니다.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShowPrivateKey = async () => {
    if (showPrivateKey) {
      setShowPrivateKey(false);
      setPrivateKey(null);
      return;
    }

    if (!confirm('비밀키를 확인하시겠습니까? 타인에게 공유하지 마세요.')) {
      return;
    }

    try {
      const key = await getPrivateKey();
      if (key) {
        setPrivateKey(key);
        setShowPrivateKey(true);
      } else {
        setToast({ message: '비밀키를 불러올 수 없습니다.', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to get private key:', error);
      setToast({ message: '비밀키를 불러오는데 실패했습니다.', type: 'error' });
    }
  };

  const handleCopyPrivateKey = () => {
    if (privateKey) {
      navigator.clipboard.writeText(privateKey);
      setToast({ message: '비밀키가 클립보드에 복사되었습니다.', type: 'success' });
    }
  };

  const handleCopyAddress = () => {
    if (userAddress) {
      navigator.clipboard.writeText(userAddress);
      setToast({ message: '주소가 클립보드에 복사되었습니다.', type: 'success' });
    }
  };

  const handleRestoreAccount = async () => {
    if (!restoreKeyInput.trim()) {
      setToast({ message: '비밀키를 입력해주세요.', type: 'error' });
      return;
    }

    try {
      setRestoring(true);
      const { address } = await restoreAccount(restoreKeyInput.trim());
      setUserAddress(address);

      // 비밀키가 표시되어 있었다면 새 비밀키로 갱신
      if (showPrivateKey) {
        setPrivateKey(null);
        setShowPrivateKey(false);
      }

      setShowRestoreModal(false);
      setRestoreKeyInput('');
      setToast({ message: '계정이 복구되었습니다!', type: 'success' });
    } catch (error) {
      console.error('Failed to restore account:', error);
      setToast({
        message: '계정 복구에 실패했습니다. 올바른 비밀키인지 확인해주세요.',
        type: 'error'
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!confirm('계정을 삭제하시겠습니까? 비밀키를 백업하지 않았다면 복구할 수 없습니다.')) {
      return;
    }

    try {
      deleteAccount();
      setUserAddress(null);
      setPrivateKey(null);
      setShowPrivateKey(false);
      setToast({ message: '계정이 삭제되었습니다.', type: 'info' });
    } catch (error) {
      console.error('Failed to delete account:', error);
      setToast({ message: '계정 삭제에 실패했습니다.', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-[#7C3FBF] rounded-full animate-spin"></div>
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
              <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">계정 관리</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {!userAddress ? (
          // 계정 없음
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-[#7C3FBF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">계정이 없습니다</h2>
              <p className="text-gray-600">
                상품 등록 등의 기능을 사용하려면 계정이 필요합니다.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCreateAccount}
                className="w-full py-4 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all"
              >
                새 계정 만들기
              </button>

              <button
                onClick={() => setShowRestoreModal(true)}
                className="w-full py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors"
              >
                비밀키로 계정 복구
              </button>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-xl">
              <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                계정 정보
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 계정은 상품 등록/수정 등 데이터 기여 시 사용됩니다</li>
                <li>• 장바구니와 프리셋은 브라우저에만 저장됩니다</li>
                <li>• 비밀키는 브라우저에 암호화되어 저장됩니다</li>
                <li>• 다른 기기에서 같은 계정을 사용하려면 비밀키를 백업하세요</li>
              </ul>
            </div>
          </div>
        ) : (
          // 계정 있음
          <div className="space-y-6">
            {/* 계정 정보 */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                내 계정
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">공개 주소</label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm break-all">
                      {userAddress}
                    </div>
                    <button
                      onClick={handleCopyAddress}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                      title="복사"
                    >
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">이 주소는 공개적으로 공유할 수 있습니다</p>
                </div>
              </div>
            </div>

            {/* 비밀키 관리 */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">비밀키 관리</h2>

              {!showPrivateKey ? (
                <button
                  onClick={handleShowPrivateKey}
                  className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  비밀키 확인하기
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <p className="text-yellow-800 text-sm">
                      ⚠️ 비밀키는 타인에게 공유하지 마세요. 안전한 곳에 보관하시기 바랍니다.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">비밀키</label>
                      <button
                        onClick={handleCopyPrivateKey}
                        className="text-sm text-[#7C3FBF] hover:text-[#6B2FAF] font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        복사
                      </button>
                    </div>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs break-all max-h-32 overflow-y-auto">
                      {privateKey}
                    </div>
                  </div>

                  <button
                    onClick={handleShowPrivateKey}
                    className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    숨기기
                  </button>
                </div>
              )}

              <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                <h4 className="font-bold text-blue-900 text-sm mb-2">계정 용도</h4>
                <ul className="text-blue-800 text-xs space-y-1">
                  <li>• 상품 등록/수정 시 기여자 식별에 사용됩니다</li>
                  <li>• 장바구니와 프리셋은 브라우저에만 저장됩니다</li>
                  <li>• 비밀키를 백업하면 다른 기기에서도 사용할 수 있습니다</li>
                </ul>
              </div>
            </div>

            {/* 계정 작업 */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">계정 작업</h2>

              <div className="space-y-3">
                <button
                  onClick={() => setShowRestoreModal(true)}
                  className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  다른 비밀키로 계정 복구
                </button>

                <button
                  onClick={handleDeleteAccount}
                  className="w-full py-3 border-2 border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors"
                >
                  계정 삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 계정 복구 모달 */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">계정 복구</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀키를 입력하세요
              </label>
              <textarea
                value={restoreKeyInput}
                onChange={(e) => setRestoreKeyInput(e.target.value)}
                placeholder="비밀키 입력..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF] font-mono text-sm"
                rows={4}
              />
            </div>

            <div className="p-3 bg-yellow-50 rounded-xl mb-4">
              <p className="text-yellow-800 text-xs">
                현재 계정 정보는 새 계정으로 대체됩니다.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setRestoreKeyInput('');
                }}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                disabled={restoring}
              >
                취소
              </button>
              <button
                onClick={handleRestoreAccount}
                className="flex-1 py-3 bg-[#7C3FBF] text-white rounded-xl font-semibold hover:bg-[#6B2FAF] transition-colors disabled:opacity-50"
                disabled={restoring}
              >
                {restoring ? '복구 중...' : '복구하기'}
              </button>
            </div>
          </div>
        </div>
      )}

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
