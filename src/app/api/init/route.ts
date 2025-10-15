import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { seedDatabase } from '@/lib/db/seed-data';

/**
 * POST /api/init
 * 데이터베이스를 초기화하고 샘플 데이터를 추가합니다.
 *
 * 주의: 개발 환경에서만 사용하세요!
 */
export async function POST() {
  try {
    const db = getDatabase();
    await db.connect();

    await seedDatabase(db);

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize database',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/init
 * 현재 데이터베이스 상태를 확인합니다.
 */
export async function GET() {
  try {
    const db = getDatabase();
    await db.connect();

    const productCount = await db.countProducts();
    const discountCount = (await db.findDiscountRules()).length;

    return NextResponse.json({
      success: true,
      data: {
        isConnected: db.isConnected(),
        productCount,
        discountCount,
      },
    });
  } catch (error) {
    console.error('Error checking database:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check database',
      },
      { status: 500 }
    );
  }
}
