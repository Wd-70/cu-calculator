'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DiscountRulesTab from '@/components/tabs/DiscountRulesTab';
import PromotionsTab from '@/components/tabs/PromotionsTab';

type TabType = 'discounts' | 'promotions';

export default function DiscountsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('discounts');

  // URL 쿼리 파라미터에서 탭 선택 가져오기
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'promotions') {
      setActiveTab('promotions');
    } else {
      setActiveTab('discounts');
    }
  }, [searchParams]);

  // 탭 변경 시 URL 업데이트
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/discounts?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="w-12 h-12 bg-gradient-to-br from-[#7C3FBF] to-[#9B5FD9] rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-lg">
                CU
              </Link>
              <div>
                <h1 className="text-gray-900 font-bold text-xl">할인 & 프로모션</h1>
                <p className="text-gray-500 text-xs">진행 중인 모든 혜택 확인</p>
              </div>
            </div>
            <Link
              href="/"
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              ← 홈으로
            </Link>
          </div>

          {/* 탭 네비게이션 */}
          <div className="mt-4 flex gap-2 border-b border-gray-200">
            <button
              onClick={() => handleTabChange('discounts')}
              className={`px-6 py-3 font-semibold transition-all relative ${
                activeTab === 'discounts'
                  ? 'text-[#7C3FBF] border-b-2 border-[#7C3FBF]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              💳 할인 규칙
              {activeTab === 'discounts' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7C3FBF]"></div>
              )}
            </button>
            <button
              onClick={() => handleTabChange('promotions')}
              className={`px-6 py-3 font-semibold transition-all relative ${
                activeTab === 'promotions'
                  ? 'text-[#FF3B3B] border-b-2 border-[#FF3B3B]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🎁 프로모션
              {activeTab === 'promotions' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF3B3B]"></div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 탭 콘텐츠 */}
      <main>
        {activeTab === 'discounts' && <DiscountRulesTab />}
        {activeTab === 'promotions' && <PromotionsTab />}
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
