'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TestPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  // API 테스트 함수들
  const initDatabase = async () => {
    await apiCall('데이터베이스 초기화', '/api/init', { method: 'POST' });
    // 기본 카트 생성
    await createDefaultCart();
  };

  const createDefaultCart = async () => {
    try {
      // 기존 카트 확인
      const cartsResponse = await fetch('/api/carts');
      const cartsData = await cartsResponse.json();

      if (cartsData.success && cartsData.data.length === 0) {
        // 카트가 없으면 기본 카트 생성
        await apiCall('기본 카트 생성', '/api/carts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '내 장바구니',
            emoji: '🛒',
            color: 'purple',
            items: [],
            isMain: true,
          }),
        });
      } else {
        addResult('기본 카트 확인', {
          message: '카트가 이미 존재합니다.',
          count: cartsData.data?.length || 0
        });
      }
    } catch (error) {
      addResult('기본 카트 생성 오류', { error: String(error) });
    }
  };

  const checkStatus = () => apiCall('상태 확인', '/api/init');
  const getProducts = () => apiCall('상품 목록', '/api/products');
  const getDiscounts = () => apiCall('할인 목록', '/api/discounts');
  const getCarts = () => apiCall('카트 목록', '/api/carts');

  const testCalculation = async () => {
    const products = await fetch('/api/products').then(r => r.json());
    if (!products.success || products.data.length === 0) {
      addResult('계산 테스트', { error: '상품이 없습니다. 먼저 데이터베이스를 초기화하세요.' });
      return;
    }

    const discounts = await fetch('/api/discounts').then(r => r.json());
    if (!discounts.success || discounts.data.length === 0) {
      addResult('계산 테스트', { error: '할인이 없습니다.' });
      return;
    }

    // barcode로 정확한 상품 선택
    const product = products.data.find((p: any) => p.barcode === '8801234567896'); // 도시락 불고기 (3300원)
    if (!product) {
      addResult('계산 테스트', { error: '도시락 불고기 상품을 찾을 수 없습니다.' });
      return;
    }

    const discount1 = discounts.data.find((d: any) => d.name.includes('도시락 20%'));
    const discount2 = discounts.data.find((d: any) => d.name.includes('우주패스'));
    const discount3 = discounts.data.find((d: any) => d.name.includes('1000원 할인'));

    const payload = {
      items: [
        {
          barcode: product.barcode,
          quantity: 1,
          selectedDiscountIds: [
            discount1?._id,
            discount2?._id,
            discount3?._id,
          ].filter(Boolean),
        },
      ],
    };

    apiCall('할인 계산 테스트', '/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const clearResults = () => setResults([]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🧪 테스트 페이지</h1>
              <p className="text-gray-600">API 테스트 및 데이터 관리</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
            >
              ← 메인으로
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 왼쪽: 컨트롤 패널 */}
          <div className="space-y-6">
            {/* 데이터베이스 관리 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">📊 데이터베이스</h2>
              <div className="space-y-3">
                <button
                  onClick={initDatabase}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  🔄 데이터베이스 초기화 (샘플 데이터 생성)
                </button>
                <button
                  onClick={checkStatus}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  ✅ 상태 확인
                </button>
              </div>
            </div>

            {/* 데이터 조회 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">📦 데이터 조회</h2>
              <div className="space-y-3">
                <button
                  onClick={getProducts}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  📋 상품 목록
                </button>
                <button
                  onClick={getDiscounts}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  🏷️ 할인 목록
                </button>
                <button
                  onClick={getCarts}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  🛒 카트 목록
                </button>
              </div>
            </div>

            {/* 할인 계산 테스트 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🧮 할인 계산</h2>
              <div className="space-y-3">
                <button
                  onClick={testCalculation}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  🎯 할인 계산 테스트
                </button>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <strong>테스트 시나리오:</strong><br />
                  도시락 불고기 (3,300원)<br />
                  + 도시락 20% 쿠폰<br />
                  + 우주패스 (1천원당 300원)<br />
                  + 결제행사 1000원 할인
                </div>
              </div>
            </div>

            {/* 결과 제어 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🗑️ 결과 관리</h2>
              <button
                onClick={clearResults}
                className="w-full px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                결과 지우기
              </button>
            </div>
          </div>

          {/* 오른쪽: 결과 패널 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">📝 결과</h2>
              {loading && (
                <div className="flex items-center gap-2 text-blue-500">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">로딩 중...</span>
                </div>
              )}
            </div>

            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {results.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <div className="text-6xl mb-4">🎯</div>
                  <p>테스트를 실행하면 결과가 여기에 표시됩니다</p>
                </div>
              ) : (
                results.map((result, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900">{result.title}</h3>
                      <span className="text-xs text-gray-500">{result.timestamp}</span>
                    </div>
                    <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 빠른 링크 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🔗 빠른 링크</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/"
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-center font-medium transition-colors"
            >
              🏠 메인
            </Link>
            <Link
              href="/products"
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-center font-medium transition-colors"
            >
              🔍 상품 검색
            </Link>
            <Link
              href="/carts"
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-center font-medium transition-colors"
            >
              🛒 장바구니
            </Link>
            <Link
              href="/discounts"
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-center font-medium transition-colors"
            >
              🏷️ 할인 정보
            </Link>
          </div>
        </div>

        {/* 도움말 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">💡 사용 가이드</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>1단계:</strong> "데이터베이스 초기화" 버튼을 눌러 샘플 데이터 생성</li>
            <li><strong>2단계:</strong> "상태 확인"으로 데이터가 제대로 생성되었는지 확인</li>
            <li><strong>3단계:</strong> "상품 목록" 및 "할인 목록"으로 데이터 확인</li>
            <li><strong>4단계:</strong> "할인 계산 테스트"로 v2 엔진 테스트</li>
            <li><strong>참고:</strong> Memory Adapter 사용 중 - 서버 재시작 시 데이터 초기화됨</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
