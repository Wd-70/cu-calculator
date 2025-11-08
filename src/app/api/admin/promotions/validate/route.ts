import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import { verifyWithTimestamp } from '@/lib/userAuth';
import { isAdmin } from '@/lib/adminAuth';

interface ValidationIssue {
  type: 'duplicate' | 'subset' | 'superset';
  promotion1: any;
  promotion2: any;
  description: string;
}

export async function POST(request: NextRequest) {
  try {
    const { targetDate, signature, timestamp, address } = await request.json();

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    const isValid = verifyWithTimestamp(
      {
        action: 'validate_promotions',
        targetDate,
      },
      signature,
      timestamp,
      address
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 서명입니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!isAdmin(address)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await connectDB();

    // 특정 날짜에 활성화된 프로모션 조회
    const date = new Date(targetDate);
    const promotions = await Promotion.find({
      validFrom: { $lte: date },
      validTo: { $gte: date },
    }).lean();

    console.log(`검증 대상: ${promotions.length}개 프로모션 (${targetDate})`);

    // 프로모션 타입별로 그룹화
    const groupedByType: { [key: string]: any[] } = {};
    for (const promo of promotions) {
      const key = `${promo.promotionType}_${promo.buyQuantity}_${promo.getQuantity}`;
      if (!groupedByType[key]) {
        groupedByType[key] = [];
      }
      groupedByType[key].push(promo);
    }

    // 중복 및 포함 관계 검증
    const issues: ValidationIssue[] = [];

    for (const [typeKey, promos] of Object.entries(groupedByType)) {
      for (let i = 0; i < promos.length; i++) {
        for (let j = i + 1; j < promos.length; j++) {
          const promo1 = promos[i];
          const promo2 = promos[j];

          const products1 = new Set(promo1.applicableProducts || []);
          const products2 = new Set(promo2.applicableProducts || []);

          // 완전히 동일한 경우
          if (products1.size === products2.size &&
              [...products1].every(p => products2.has(p))) {
            issues.push({
              type: 'duplicate',
              promotion1: promo1,
              promotion2: promo2,
              description: `완전히 동일한 상품 목록 (${products1.size}개)`,
            });
            continue;
          }

          // promo1이 promo2를 포함하는 경우
          const products2InPromo1 = [...products2].filter(p => products1.has(p));
          if (products2InPromo1.length === products2.size && products1.size > products2.size) {
            issues.push({
              type: 'superset',
              promotion1: promo1,
              promotion2: promo2,
              description: `"${promo1.name}"이(가) "${promo2.name}"를 완전히 포함 (${promo1.applicableProducts.length}개 ⊃ ${promo2.applicableProducts.length}개)`,
            });
            continue;
          }

          // promo2가 promo1을 포함하는 경우
          const products1InPromo2 = [...products1].filter(p => products2.has(p));
          if (products1InPromo2.length === products1.size && products2.size > products1.size) {
            issues.push({
              type: 'subset',
              promotion1: promo1,
              promotion2: promo2,
              description: `"${promo1.name}"이(가) "${promo2.name}"에 완전히 포함됨 (${promo1.applicableProducts.length}개 ⊂ ${promo2.applicableProducts.length}개)`,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      targetDate,
      totalPromotions: promotions.length,
      issues,
      message: `${issues.length}개의 문제가 발견되었습니다.`,
    });

  } catch (error) {
    console.error('Promotion validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate promotions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
