/**
 * Database Factory
 *
 * 여기서 사용할 데이터베이스를 선택할 수 있습니다.
 * 환경 변수나 직접 설정으로 쉽게 전환 가능합니다.
 */

import { IDatabase } from './interfaces';
import { MemoryAdapter } from './memory.adapter';
import { MongoDBAdapter } from './mongodb.adapter';

// 데이터베이스 타입
export type DatabaseType = 'memory' | 'mongodb';

// 환경 변수로 데이터베이스 선택 (기본값: memory)
const DB_TYPE = (process.env.NEXT_PUBLIC_DB_TYPE as DatabaseType) || 'memory';

// 싱글톤 인스턴스
let dbInstance: IDatabase | null = null;

/**
 * 데이터베이스 인스턴스를 가져옵니다.
 *
 * 사용 방법:
 * ```typescript
 * const db = getDatabase();
 * await db.connect();
 * const products = await db.findProducts();
 * ```
 */
export function getDatabase(type?: DatabaseType): IDatabase {
  const selectedType = type || DB_TYPE;

  // 이미 생성된 인스턴스가 있으면 반환
  if (dbInstance) {
    return dbInstance;
  }

  // 타입에 따라 어댑터 생성
  switch (selectedType) {
    case 'mongodb':
      console.log('🗄️  Using MongoDB adapter');
      dbInstance = new MongoDBAdapter();
      break;

    case 'memory':
    default:
      console.log('💾 Using Memory adapter');
      dbInstance = new MemoryAdapter();
      break;
  }

  return dbInstance;
}

/**
 * 데이터베이스를 전환합니다.
 * 주의: 이 함수를 호출하면 기존 연결이 끊어집니다.
 */
export async function switchDatabase(type: DatabaseType): Promise<void> {
  if (dbInstance) {
    await dbInstance.disconnect();
    dbInstance = null;
  }

  dbInstance = getDatabase(type);
  await dbInstance.connect();
}

/**
 * 현재 사용 중인 데이터베이스 타입을 반환합니다.
 */
export function getCurrentDatabaseType(): DatabaseType {
  return DB_TYPE;
}

// 기본 export
export default getDatabase();

// 편의 함수들
export { IDatabase, DatabaseType } from './interfaces';
export { MemoryAdapter } from './memory.adapter';
export { MongoDBAdapter } from './mongodb.adapter';
