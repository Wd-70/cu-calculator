import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';

/**
 * POST /api/admin/resolve-conflict
 * Resolve product information conflict
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const {
      accountAddress,
      productId,
      selectedData
    } = await request.json();

    // 관리자 계정 검증
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!productId || !selectedData) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    await db.connect();

    const { name, price, imageUrl, categoryTags, promotionTags } = selectedData;

    // 대표 카테고리 선택 (level 0인 메인 카테고리)
    const category = categoryTags.length > 0
      ? (categoryTags.find((tag: any) => tag.level === 0)?.name || categoryTags[0].name)
      : undefined;

    // 상품 정보 업데이트
    const updated = await db.updateProduct(productId, {
      name,
      price,
      imageUrl,
      category, // 대표 카테고리
      categoryTags, // 모든 카테고리 태그 저장
      detailUrls: [] // 업데이트 완료 후 제거
    });

    if (!updated) {
      return NextResponse.json(
        { error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 프로모션 처리
    for (const promotionTag of promotionTags) {
      const now = new Date();
      const discountRules = await db.findDiscountRules({
        name: { $regex: promotionTag, $options: 'i' },
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: now }
      });

      if (discountRules.length > 0) {
        const discountRule = discountRules.sort((a: any, b: any) => {
          const aStart = new Date(a.validFrom).getTime();
          const bStart = new Date(b.validFrom).getTime();
          const nowTime = now.getTime();
          return Math.abs(nowTime - bStart) - Math.abs(nowTime - aStart);
        })[0];

        const isAlreadyIncluded = discountRule.applicableProducts.some(
          (id: any) => id.toString() === productId
        );

        if (!isAlreadyIncluded) {
          discountRule.applicableProducts.push(updated._id);
          await db.updateDiscountRule(discountRule._id.toString(), {
            applicableProducts: discountRule.applicableProducts
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '충돌이 해결되었습니다.',
      product: updated
    });

  } catch (error) {
    console.error('Error resolving conflict:', error);
    return NextResponse.json(
      {
        error: '충돌 해결 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
