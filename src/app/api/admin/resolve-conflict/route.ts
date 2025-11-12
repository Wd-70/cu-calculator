import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';

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
    await connectDB();

    const { name, price, imageUrl, categoryTags, promotionTags } = selectedData;

    // 상품 정보 업데이트
    const updated = await db.updateProduct(productId, {
      name,
      price,
      imageUrl,
      categoryTags, // 모든 카테고리 태그 저장
      detailUrls: [] // 업데이트 완료 후 제거
    });

    if (!updated) {
      return NextResponse.json(
        { error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 프로모션 처리 - Promotion 컬렉션에 생성
    for (const promotionTag of promotionTags) {
      const now = new Date();

      // 프로모션 타입 파싱 (예: "2+1" -> buyQuantity: 2, getQuantity: 1)
      const match = promotionTag.match(/^(\d+)\+(\d+)$/);
      if (!match) {
        console.warn(`잘못된 프로모션 형식: ${promotionTag}`);
        continue;
      }

      const buyQuantity = parseInt(match[1]);
      const getQuantity = parseInt(match[2]);

      // 이미 존재하는 프로모션 확인
      const existingPromotions = await Promotion.find({
        promotionType: promotionTag as any,
        status: 'active',
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: now },
        applicableProducts: updated.barcode
      });

      if (existingPromotions.length > 0) {
        console.log(`프로모션이 이미 존재함: ${existingPromotions[0].name}`);
        continue;
      }

      // 비슷한 프로모션 찾기 (기간 동기화용)
      const similarPromotions = await Promotion.find({
        promotionType: promotionTag as any,
        status: 'active',
        isActive: true,
        isCrawled: true,
        needsVerification: true,
        'applicableProducts.0': { $exists: true },
        validFrom: { $lte: now },
        validTo: { $gte: now }
      }).limit(1);

      // 기본 기간: 현재 달의 첫 날부터 마지막 날까지
      let validFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      let validTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // 비슷한 프로모션이 있으면 동일한 기간 사용
      if (similarPromotions.length > 0) {
        validFrom = similarPromotions[0].validFrom;
        validTo = similarPromotions[0].validTo;
      }

      // 새 프로모션 생성
      const newPromotion = await Promotion.create({
        name: `${updated.name} ${promotionTag}`,
        description: `${updated.name} 상품의 ${promotionTag} 프로모션 (크롤링 자동생성)`,
        promotionType: promotionTag as any,
        buyQuantity,
        getQuantity,
        applicableType: 'products',
        applicableProducts: [updated.barcode],
        giftSelectionType: 'same',
        giftConstraints: {
          mustBeSameProduct: true
        },
        validFrom,
        validTo,
        status: 'active',
        isActive: true,
        priority: 0,
        createdBy: accountAddress,
        lastModifiedBy: accountAddress,
        modificationHistory: [{
          modifiedBy: accountAddress,
          modifiedAt: now,
          changes: { type: 'conflict_resolution' },
          comment: '충돌 해결 중 프로모션 생성'
        }],
        verificationStatus: 'unverified',
        verificationCount: 0,
        disputeCount: 0,
        verifiedBy: [],
        disputedBy: [],
        isCrawled: true,
        crawledAt: now,
        needsVerification: true
      });

      // PromotionIndex 업데이트
      await PromotionIndex.updateOne(
        { barcode: updated.barcode },
        {
          $addToSet: { promotionIds: newPromotion._id },
          $set: { lastUpdated: now }
        },
        { upsert: true }
      );

      console.log(`✅ 프로모션 생성됨: ${newPromotion.name}`);
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
