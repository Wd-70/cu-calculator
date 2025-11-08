'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import * as clientDb from '@/lib/clientDb';

export default function Home() {
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    const updateCartCount = () => {
      const count = clientDb.getMainCartItemCount();
      setCartItemCount(count);
    };

    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    window.addEventListener('focus', updateCartCount);

    return () => {
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener('focus', updateCartCount);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-12 h-12 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-lg">
                CU
              </div>
              <div>
                <h1 className="text-gray-900 font-bold text-xl">CU 할인계산기</h1>
                <p className="text-gray-500 text-xs">똑똑한 할인 쇼핑</p>
              </div>
            </Link>
            <Link
              href="/carts"
              className="relative p-3 hover:bg-gray-100 rounded-xl transition-all"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[#FF3B3B] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="container mx-auto px-4 py-8 md:py-16 max-w-6xl">
        {/* 히어로 섹션 */}
        <div className="text-center mb-16 animate-[fadeIn_0.6s_ease-out]">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full mb-6 shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-gray-700 font-semibold text-sm">AI 최적화 할인 계산</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            CU에서 쓴 돈,
            <br />
            <span className="bg-gradient-to-r from-[#7C3FBF] to-[#FF3B3B] bg-clip-text text-transparent">
              최대한 아껴드립니다
            </span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            1+1, 2+1, 쿠폰, 카드할인, 통신사할인까지<br />
            복잡한 할인 조합을 자동으로 계산하고 최적의 조합을 찾아드립니다
          </p>

          {/* CTA 버튼 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/carts"
              className="group px-8 py-4 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all hover:scale-105"
            >
              <span className="flex items-center gap-2">
                🛒 장바구니로 시작하기
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
            <Link
              href="/discounts"
              className="px-8 py-4 bg-white text-gray-700 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 border-2 border-gray-200"
            >
              💰 할인 정보 둘러보기
            </Link>
          </div>
        </div>

        {/* 핵심 가치 제안 */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">자동 최적화</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              수백 가지 할인 조합 중 최대 절약 방법을 자동으로 찾아드립니다
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">멀티 카트 비교</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              여러 할인 조합을 동시에 비교하고 가장 저렴한 방법을 선택하세요
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">실시간 계산</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              장바구니에 상품을 담는 즉시 실시간으로 최종 가격을 확인할 수 있습니다
            </p>
          </div>
        </div>

        {/* 주요 기능 카드 */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">주요 기능</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 장바구니 */}
            <Link
              href="/carts"
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-[#7C3FBF] transition-colors">
                    스마트 장바구니
                  </h4>
                  <p className="text-gray-600 mb-4">
                    상품을 추가하고 할인을 적용하면 자동으로 최적의 조합을 계산합니다
                  </p>
                  <div className="flex items-center text-[#7C3FBF] font-semibold group-hover:gap-2 transition-all">
                    <span>시작하기</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

            {/* 상품 검색 */}
            <Link
              href="/products"
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#00C73C] to-[#00A032] rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-[#00C73C] transition-colors">
                    상품 검색
                  </h4>
                  <p className="text-gray-600 mb-4">
                    원하는 상품을 검색하고 적용 가능한 모든 할인 정보를 확인하세요
                  </p>
                  <div className="flex items-center text-[#00C73C] font-semibold group-hover:gap-2 transition-all">
                    <span>검색하기</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

            {/* 할인 정보 */}
            <Link
              href="/discounts"
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#FF3B3B] to-[#FF8A00] rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-[#FF3B3B] transition-colors">
                    할인 & 프로모션
                  </h4>
                  <p className="text-gray-600 mb-4">
                    이번 달 진행 중인 모든 할인, 프로모션 정보를 한눈에 확인하세요
                  </p>
                  <div className="flex items-center text-[#FF3B3B] font-semibold group-hover:gap-2 transition-all">
                    <span>보러가기</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

            {/* 프리셋 */}
            <Link
              href="/settings/presets"
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#0091FF] to-[#0070CC] rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-[#0091FF] transition-colors">
                    내 프리셋
                  </h4>
                  <p className="text-gray-600 mb-4">
                    자주 사용하는 할인 조합을 프리셋으로 저장하고 빠르게 적용하세요
                  </p>
                  <div className="flex items-center text-[#0091FF] font-semibold group-hover:gap-2 transition-all">
                    <span>설정하기</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* 특징 */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#7C3FBF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h4 className="font-bold text-lg text-gray-900 mb-2">크라우드소싱</h4>
            <p className="text-gray-600 text-sm">
              사용자가 함께 만드는 할인 정보 데이터베이스
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#0091FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h4 className="font-bold text-lg text-gray-900 mb-2">익명 계정 시스템</h4>
            <p className="text-gray-600 text-sm">
              별도 가입 없이 암호화 서명으로 안전하게 인증
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#00C73C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="font-bold text-lg text-gray-900 mb-2">최적화 알고리즘</h4>
            <p className="text-gray-600 text-sm">
              수백 가지 조합 중 최대 절약 자동 계산
            </p>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-gray-200 mt-20 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* 메인 링크 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div>
                <h5 className="font-bold text-gray-900 mb-3 text-sm">할인</h5>
                <div className="space-y-2">
                  <Link href="/discounts" className="block text-gray-600 hover:text-[#7C3FBF] transition-colors text-sm">
                    할인 정보
                  </Link>
                  <Link href="/discounts/promotions" className="block text-gray-600 hover:text-[#7C3FBF] transition-colors text-sm">
                    프로모션
                  </Link>
                </div>
              </div>

              <div>
                <h5 className="font-bold text-gray-900 mb-3 text-sm">장바구니</h5>
                <div className="space-y-2">
                  <Link href="/carts" className="block text-gray-600 hover:text-[#7C3FBF] transition-colors text-sm">
                    내 장바구니
                  </Link>
                </div>
              </div>

              <div>
                <h5 className="font-bold text-gray-900 mb-3 text-sm">상품</h5>
                <div className="space-y-2">
                  <Link href="/products" className="block text-gray-600 hover:text-[#7C3FBF] transition-colors text-sm">
                    상품 검색
                  </Link>
                </div>
              </div>

              <div>
                <h5 className="font-bold text-gray-900 mb-3 text-sm">설정</h5>
                <div className="space-y-2">
                  <Link href="/settings/presets" className="block text-gray-600 hover:text-[#7C3FBF] transition-colors text-sm">
                    프리셋 관리
                  </Link>
                  <Link href="/settings/account" className="block text-gray-600 hover:text-[#7C3FBF] transition-colors text-sm">
                    계정 관리
                  </Link>
                </div>
              </div>
            </div>

            {/* 구분선 */}
            <div className="border-t border-gray-200 mb-6"></div>

            {/* 저작권 및 개발자 정보 */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
              <p>© 2025 CU 할인계산기. All rights reserved.</p>
              <p className="flex items-center gap-2">
                Developed by <span className="font-semibold text-gray-700">Wd-70</span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
