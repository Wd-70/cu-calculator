import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-lg">
                CU
              </div>
              <div>
                <h1 className="text-gray-900 font-bold text-xl">CU 할인계산기</h1>
                <p className="text-gray-500 text-xs">똑똑한 할인 쇼핑</p>
              </div>
            </div>
            <Link
              href="/cart"
              className="relative p-3 hover:bg-gray-100 rounded-xl transition-all"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF3B3B] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                0
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="container mx-auto px-4 py-8 md:py-16 max-w-6xl">
        {/* 히어로 섹션 */}
        <div className="text-center mb-16 animate-[fadeIn_0.6s_ease-out]">
          <div className="inline-block px-4 py-2 bg-purple-50 rounded-full mb-4">
            <span className="text-[#7C3FBF] font-semibold text-sm">✨ 스마트한 할인 계산의 시작</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
            CU에서
            <br />
            <span className="text-[#7C3FBF]">최대 절약</span>하는 법
          </h2>
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            복잡한 할인 조합도 쉽고 빠르게!<br className="md:hidden" /> 실시간으로 계산해드립니다.
          </p>
        </div>

        {/* 빠른 액션 카드 */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* 바코드 스캔 */}
          <Link
            href="/scan"
            className="group bg-white rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">바코드 스캔</h3>
            <p className="text-gray-600">카메라로 바코드를 스캔하고 즉시 할인 정보를 확인하세요.</p>
            <div className="mt-4 flex items-center text-[#7C3FBF] font-semibold group-hover:gap-2 transition-all">
              <span>시작하기</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* 상품 검색 */}
          <Link
            href="/products"
            className="group bg-white rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-[#00C73C] to-[#00A032] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">상품 검색</h3>
            <p className="text-gray-600">원하는 상품을 검색하고 적용 가능한 할인을 찾아보세요.</p>
            <div className="mt-4 flex items-center text-[#00C73C] font-semibold group-hover:gap-2 transition-all">
              <span>검색하기</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* 할인 정보 */}
          <Link
            href="/discounts"
            className="group bg-white rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF3B3B] to-[#FF8A00] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">할인 정보</h3>
            <p className="text-gray-600">이번 달 진행 중인 모든 할인 행사를 확인하세요.</p>
            <div className="mt-4 flex items-center text-[#FF3B3B] font-semibold group-hover:gap-2 transition-all">
              <span>보러가기</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* 통계 */}
        <div className="bg-gradient-to-br from-purple-50 to-green-50 rounded-3xl p-8 mb-12 shadow-sm">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-[#7C3FBF] mb-2">6</div>
              <div className="text-gray-600">등록된 상품</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-[#00C73C] mb-2">5</div>
              <div className="text-gray-600">활성 할인</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-[#FF3B3B] mb-2">최대 43%</div>
              <div className="text-gray-600">절약 가능</div>
            </div>
          </div>
        </div>

        {/* 기능 설명 */}
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl">
          <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">이런 기능이 있어요</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#7C3FBF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-900 mb-1">복잡한 할인 계산</h4>
                <p className="text-gray-600">1+1, 2+1, 퍼센트, 카드 할인을 한번에 계산합니다.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#00C73C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-900 mb-1">실시간 가격 확인</h4>
                <p className="text-gray-600">장바구니에서 실시간으로 최종 가격을 확인하세요.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#0091FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-900 mb-1">월별 행사 정보</h4>
                <p className="text-gray-600">매달 새로운 할인 행사를 놓치지 마세요.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#FF8A00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-900 mb-1">결제수단별 할인</h4>
                <p className="text-gray-600">카드사별 추가 할인도 자동으로 적용됩니다.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-50 border-t border-gray-200 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© 2025 CU 할인계산기. Made with 💜 for smart shoppers.</p>
        </div>
      </footer>
    </div>
  );
}
