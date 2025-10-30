'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PromotionsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // 프로모션 페이지는 통합 할인 페이지의 프로모션 탭으로 리다이렉트
    router.replace('/discounts?tab=promotions');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">프로모션 페이지로 이동 중...</p>
      </div>
    </div>
  );
}
