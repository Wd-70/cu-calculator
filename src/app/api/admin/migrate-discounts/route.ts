import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';

/**
 * POST /api/admin/migrate-discounts
 * Migrate discount rules from ObjectId to barcode format
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const { accountAddress } = await request.json();

    // 관리자 계정 검증
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await db.connect();

    // 모든 할인 규칙 가져오기
    const discountRules = await db.findDiscountRules({});

    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rule of discountRules) {
      try {
        // applicableProducts를 빈 배열로 초기화
        // (ObjectId를 바코드로 변환할 수 없으므로 초기화)
        await db.updateDiscountRule(rule._id.toString(), {
          applicableProducts: []
        });

        migrated++;
      } catch (error) {
        errors.push(`${rule.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `마이그레이션 완료: ${migrated}개 성공, ${skipped}개 스킵`,
      details: {
        total: discountRules.length,
        migrated,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: '마이그레이션 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
