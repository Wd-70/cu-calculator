'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCurrentUserAddress } from '@/lib/userAuth';
import { checkIsAdminClient } from '@/lib/adminAuth';

export default function TestPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    setIsCheckingAdmin(true);
    const address = getCurrentUserAddress();
    setAccountAddress(address);

    if (address) {
      const adminStatus = await checkIsAdminClient(address);
      setIsAdmin(adminStatus);
    }
    setIsCheckingAdmin(false);
  };

  const addResult = (title: string, data: any) => {
    setResults((prev) => [
      {
        title,
        data,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  };

  const apiCall = async (title: string, url: string, options?: RequestInit) => {
    setLoading(true);
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      addResult(title, data);
      return data;
    } catch (error) {
      addResult(title, { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // MongoDB 컬렉션 관리 함수들
  const loadCollections = async () => {
    if (!accountAddress) {
      alert('계정을 먼저 생성해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/collection-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress,
          action: 'list',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setCollections(data.collections);
        addResult('컬렉션 목록 조회', data);
      } else {
        addResult('컬렉션 목록 조회 실패', data);
      }
    } catch (error) {
      addResult('컬렉션 목록 조회 실패', { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const restoreProducts = async () => {
    if (!accountAddress) {
      alert('계정을 먼저 생성해주세요.');
      return;
    }

    if (!confirm('products 컬렉션을 products_unupdated에서 복원하시겠습니까?\n기존 products 데이터는 모두 삭제됩니다!')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/collection-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress,
          action: 'restore',
          sourceCollection: 'products_unupdated',
          targetCollection: 'products',
        }),
      });
      const data = await response.json();
      addResult('Products 복원', data);

      if (data.success) {
        await loadCollections();
      }
    } catch (error) {
      addResult('Products 복원 실패', { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const backupProducts = async () => {
    if (!accountAddress) {
      alert('계정을 먼저 생성해주세요.');
      return;
    }

    if (!confirm('현재 products 컬렉션을 products_unupdated로 백업하시겠습니까?\n기존 products_unupdated 데이터는 덮어씌워집니다!')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/collection-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress,
          action: 'copy',
          sourceCollection: 'products',
          targetCollection: 'products_unupdated',
        }),
      });
      const data = await response.json();
      addResult('Products 백업', data);

      if (data.success) {
        await loadCollections();
      }
    } catch (error) {
      addResult('Products 백업 실패', { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const deleteCollection = async (collectionName: string) => {
    if (!accountAddress) {
      alert('계정을 먼저 생성해주세요.');
      return;
    }

    if (!confirm(`컬렉션 '${collectionName}'을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/collection-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress,
          action: 'delete',
          targetCollection: collectionName,
        }),
      });
      const data = await response.json();
      addResult(`컬렉션 삭제: ${collectionName}`, data);

      if (data.success) {
        await loadCollections();
      }
    } catch (error) {
      addResult('컬렉션 삭제 실패', { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const getProducts = () => apiCall('상품 목록', '/api/products');
  const getDiscounts = () => apiCall('할인 목록', '/api/discounts');
  const getPromotions = () => apiCall('프로모션 목록', '/api/promotions');
  const clearResults = () => setResults([]);

  // 로딩 중
  if (isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  // 관리자가 아닌 경우
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">접근 거부</h1>
          <p className="text-gray-600 mb-6">
            이 페이지는 관리자 전용입니다.<br />
            {accountAddress ? (
              <>현재 계정: <code className="text-sm bg-gray-100 px-2 py-1 rounded">{accountAddress.slice(0, 10)}...</code></>
            ) : (
              '계정을 먼저 생성해주세요.'
            )}
          </p>
          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg"
            >
              메인으로 돌아가기
            </Link>
            {!accountAddress && (
              <button
                onClick={() => window.location.reload()}
                className="block w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
              >
                다시 확인
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 관리자 UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🧪 관리자 테스트 페이지</h1>
              <p className="text-gray-600">
                MongoDB 관리 및 API 테스트
              </p>
              <p className="text-sm text-green-600 mt-1">
                ✓ 관리자: {accountAddress?.slice(0, 10)}...{accountAddress?.slice(-8)}
              </p>
            </div>
            <Link
              href="/"
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              ← 메인으로
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 왼쪽: 컨트롤 패널 */}
          <div className="space-y-6">
            {/* MongoDB 컬렉션 백업/복원 */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-yellow-300">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🗄️ MongoDB 백업/복원</h2>

              <div className="space-y-3">
                <button
                  onClick={loadCollections}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-all shadow-md"
                >
                  📋 컬렉션 목록 조회
                </button>
                <button
                  onClick={restoreProducts}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-all shadow-md"
                >
                  ⬅️ products_unupdated → products 복원
                </button>
                <button
                  onClick={backupProducts}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-all shadow-md"
                >
                  ➡️ products → products_unupdated 백업
                </button>
              </div>

              {/* 컬렉션 목록 표시 */}
              {collections.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">현재 컬렉션:</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {collections.map((col) => (
                      <div
                        key={col.name}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{col.name}</span>
                          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            {col.count}개
                          </span>
                        </div>
                        {!['products', 'discountrules', 'promotions', 'promotionindices'].includes(col.name) && (
                          <button
                            onClick={() => deleteCollection(col.name)}
                            disabled={loading}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded font-medium transition-colors"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 text-xs text-gray-700 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <strong className="text-yellow-800">⚠️ 사용법:</strong>
                <ol className="mt-2 space-y-1 ml-4 list-decimal">
                  <li>크롤링 직후 "백업" 버튼으로 products_unupdated에 저장</li>
                  <li>카테고리 업데이트 후 테스트</li>
                  <li>다시 테스트하려면 "복원" 버튼으로 원본 복구</li>
                </ol>
              </div>
            </div>

            {/* 데이터 조회 */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">📊 데이터 조회</h2>
              <div className="space-y-3">
                <button
                  onClick={getProducts}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-all shadow-md"
                >
                  📦 상품 목록
                </button>
                <button
                  onClick={getDiscounts}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-all shadow-md"
                >
                  🏷️ 할인 목록
                </button>
                <button
                  onClick={getPromotions}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-all shadow-md"
                >
                  🎁 프로모션 목록
                </button>
              </div>
            </div>

            {/* 결과 관리 */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🛠️ 결과 관리</h2>
              <button
                onClick={clearResults}
                className="w-full px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-lg font-semibold transition-all shadow-md"
              >
                🗑️ 결과 지우기
              </button>
            </div>
          </div>

          {/* 오른쪽: 결과 패널 */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">📝 실행 결과</h2>
              {loading && (
                <div className="flex items-center gap-2 text-blue-500">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">처리 중...</span>
                </div>
              )}
            </div>

            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {results.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <div className="text-6xl mb-4">🎯</div>
                  <p className="text-lg font-medium">테스트를 실행하면 결과가 여기에 표시됩니다</p>
                  <p className="text-sm mt-2">왼쪽 패널에서 원하는 작업을 선택하세요</p>
                </div>
              ) : (
                results.map((result, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900">{result.title}</h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {result.timestamp}
                      </span>
                    </div>
                    <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto border border-gray-200 font-mono">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 빠른 링크 */}
        <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🔗 빠른 링크</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link
              href="/"
              className="px-4 py-3 bg-gradient-to-r from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300 rounded-lg text-center font-medium transition-all"
            >
              🏠 메인
            </Link>
            <Link
              href="/products"
              className="px-4 py-3 bg-gradient-to-r from-purple-100 to-purple-200 hover:from-purple-200 hover:to-purple-300 rounded-lg text-center font-medium transition-all"
            >
              🔍 상품 검색
            </Link>
            <Link
              href="/promotions"
              className="px-4 py-3 bg-gradient-to-r from-pink-100 to-pink-200 hover:from-pink-200 hover:to-pink-300 rounded-lg text-center font-medium transition-all"
            >
              🎁 프로모션
            </Link>
            <Link
              href="/discounts"
              className="px-4 py-3 bg-gradient-to-r from-orange-100 to-orange-200 hover:from-orange-200 hover:to-orange-300 rounded-lg text-center font-medium transition-all"
            >
              🏷️ 할인 정보
            </Link>
            <Link
              href="/admin"
              className="px-4 py-3 bg-gradient-to-r from-red-100 to-red-200 hover:from-red-200 hover:to-red-300 rounded-lg text-center font-medium transition-all"
            >
              ⚙️ 관리자
            </Link>
          </div>
        </div>

        {/* 도움말 */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            <span className="text-xl">💡</span>
            <span>관리자 가이드</span>
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <strong className="block mb-2">📦 상품 데이터 백업/복원:</strong>
              <ol className="ml-4 space-y-1 list-decimal">
                <li>크롤링 직후 즉시 백업</li>
                <li>카테고리 업데이트 테스트</li>
                <li>필요 시 복원하여 재사용</li>
              </ol>
            </div>
            <div>
              <strong className="block mb-2">🎁 프로모션 관리:</strong>
              <ol className="ml-4 space-y-1 list-decimal">
                <li>크롤링으로 개별 프로모션 생성</li>
                <li>병합 후보 찾기로 그룹화</li>
                <li>수동 병합으로 통합 프로모션 생성</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
