/**
 * API Helper Functions
 *
 * API 라우트에서 사용할 수 있는 편의 함수들
 */

import { getDatabase } from './index';

// 싱글톤 DB 인스턴스
let dbInstance = getDatabase();

/**
 * API 라우트에서 사용할 데이터베이스 인스턴스를 가져옵니다.
 * 자동으로 연결을 시도합니다.
 */
export async function getDB() {
  if (!dbInstance.isConnected()) {
    await dbInstance.connect();
  }
  return dbInstance;
}

/**
 * 사용자 식별자를 요청 헤더에서 추출합니다.
 */
export function getUserIdentifier(request: Request): string {
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for') ||
    headers.get('x-real-ip') ||
    'anonymous'
  );
}
