'use client';

import { useEffect, useState } from 'react';
import { hasAccount, createAccount } from '@/lib/userAuth';

/**
 * 사용자 계정 초기화 컴포넌트
 * 첫 사용 시 자동으로 계정 생성
 */
export default function UserInitializer() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // 이미 계정이 있는지 확인
        if (!hasAccount()) {
          console.log('🔑 First time user detected. Creating account...');
          const { address } = await createAccount();
          console.log('✅ Account created:', address);
        } else {
          console.log('✅ Existing account found');
        }
      } catch (error) {
        console.error('❌ Failed to initialize user:', error);
      } finally {
        setInitialized(true);
      }
    };

    initializeUser();
  }, []);

  // 이 컴포넌트는 UI를 렌더링하지 않음
  return null;
}
