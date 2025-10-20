'use client';

import { useEffect, useState } from 'react';
import { hasAccount, createAccount, loadAccount } from '@/lib/userAuth';

/**
 * 사용자 계정 초기화 컴포넌트
 * 첫 사용 시 자동으로 계정 생성 (이더리움 지갑 방식)
 */
export default function UserInitializer() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // 이미 계정이 있는지 확인
        if (!hasAccount()) {
          console.log('🔑 First time user detected. Creating Ethereum wallet...');
          const { address, privateKey } = await createAccount();
          console.log('✅ Ethereum wallet created:', address);
          console.log('⚠️  Private key saved to localStorage. Keep it safe!');
        } else {
          // 기존 계정 유효성 검증
          const account = await loadAccount();
          if (account) {
            console.log('✅ Existing wallet found:', account.address);
          } else {
            // 계정이 손상된 경우 새로 생성
            console.log('⚠️  Invalid account data. Creating new wallet...');
            const { address } = await createAccount();
            console.log('✅ New wallet created:', address);
          }
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
