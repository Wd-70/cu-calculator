import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';
import { verifyWithTimestamp } from '@/lib/userAuth';
import { isAdmin } from '@/lib/adminAuth';

// POST: 프로모션 병합 (관리자만)
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { promotionIds, mergedData, signature, timestamp, address, comment } =
      await request.json();

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 401 }
      );
    }

    const isValid = verifyWithTimestamp(
      { action: 'merge_promotions', promotionIds, ...mergedData },
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
    const isAdminUser = isAdmin(address);

    if (!isAdminUser) {
      return NextResponse.json(
        { success: false, error: '관리자만 프로모션을 병합할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 병합할 프로모션들 조회
    const originalPromotions = await Promotion.find({
      _id: { $in: promotionIds },
    });

    if (originalPromotions.length === 0) {
      return NextResponse.json(
        { success: false, error: '병합할 프로모션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 1. 원본 프로모션들을 비활성화 (merged 상태로)
    await Promotion.updateMany(
      { _id: { $in: promotionIds } },
      {
        $set: {
          status: 'merged',
          isActive: false,
          lastModifiedBy: address,
        },
        $push: {
          modificationHistory: {
            modifiedBy: address,
            modifiedAt: new Date(),
            changes: { merged: true },
            comment: '프로모션 병합으로 비활성화',
          },
        },
      }
    );

    // 2. 모든 바코드 수집
    const allBarcodes = new Set<string>();
    originalPromotions.forEach((p) => {
      (p.applicableProducts || []).forEach((barcode: string) => allBarcodes.add(barcode));
    });

    // 3. 새 프로모션 생성
    const createData: any = {
      ...mergedData,
      mergedFrom: promotionIds,
      mergedAt: new Date(),
      mergedBy: address,
      createdBy: address,
      lastModifiedBy: address,
      needsVerification: false, // 수동 병합이므로 검증됨
      verificationStatus: 'verified', // 관리자가 병합했으므로 즉시 검증됨
      verificationCount: 1,
      disputeCount: 0,
      verifiedBy: [address],
      disputedBy: [],
      modificationHistory: [
        {
          modifiedBy: address,
          modifiedAt: new Date(),
          changes: {
            type: 'merge',
            originalPromotions: promotionIds,
          },
          comment: comment || '프로모션 병합',
        },
      ],
    };

    // 병합 시 mustBeSameProduct 제약 제거 (2개 이상 상품이 병합되면 교차 증정 가능)
    if (createData.applicableProducts && createData.applicableProducts.length > 1) {
      if (createData.giftConstraints?.mustBeSameProduct) {
        createData.giftConstraints.mustBeSameProduct = false;
      }
    }

    const newPromotion = await Promotion.create(createData);

    // 4. PromotionIndex 업데이트
    for (const barcode of allBarcodes) {
      await PromotionIndex.updateOne(
        { barcode },
        {
          $pull: { promotionIds: { $in: promotionIds } }, // 원본 제거
          $addToSet: { promotionIds: newPromotion._id }, // 새 ID 추가
          $set: { lastUpdated: new Date() },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${originalPromotions.length}개의 프로모션이 병합되었습니다.`,
      promotion: newPromotion,
      mergedPromotionIds: promotionIds,
    });
  } catch (error) {
    console.error('Error merging promotions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to merge promotions' },
      { status: 500 }
    );
  }
}
