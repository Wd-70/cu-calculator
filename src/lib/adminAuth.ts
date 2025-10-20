/**
 * Admin Authentication Utility
 *
 * 환경 변수에 등록된 관리자 계정 목록을 관리합니다.
 */

/**
 * 관리자 계정 목록을 가져옵니다.
 * 환경 변수 ADMIN_ACCOUNTS에서 쉼표로 구분된 계정 주소들을 읽습니다.
 */
export function getAdminAccounts(): string[] {
  const adminAccountsStr = process.env.ADMIN_ACCOUNTS || '';

  if (!adminAccountsStr.trim()) {
    return [];
  }

  // 쉼표로 구분하고, 공백 제거 후 소문자로 변환
  return adminAccountsStr
    .split(',')
    .map(account => account.trim().toLowerCase())
    .filter(account => account.length > 0);
}

/**
 * 주어진 계정이 관리자인지 확인합니다.
 *
 * @param accountAddress - 확인할 계정 주소
 * @returns 관리자 여부
 */
export function isAdmin(accountAddress: string | null | undefined): boolean {
  if (!accountAddress) {
    return false;
  }

  const adminAccounts = getAdminAccounts();
  const normalizedAddress = accountAddress.trim().toLowerCase();

  return adminAccounts.includes(normalizedAddress);
}

/**
 * 클라이언트 측에서 사용할 관리자 확인 함수
 * (환경 변수를 클라이언트에서 직접 읽을 수 없으므로 API를 통해 확인해야 함)
 * 서명을 통해 계정 소유권을 증명합니다.
 */
export async function checkIsAdminClient(accountAddress: string | null | undefined): Promise<boolean> {
  if (!accountAddress) {
    return false;
  }

  try {
    // 동적 임포트로 클라이언트 전용 함수 불러오기
    const { signWithTimestamp } = await import('@/lib/userAuth');

    // 서명 생성
    const { signature, timestamp } = await signWithTimestamp({ action: 'check_admin' });

    const response = await fetch('/api/admin/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountAddress,
        signature,
        timestamp,
      }),
    });

    const data = await response.json();
    return data.isAdmin || false;
  } catch (error) {
    console.error('Failed to check admin status:', error);
    return false;
  }
}
