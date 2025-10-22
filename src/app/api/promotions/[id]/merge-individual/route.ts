import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';
import { verifyWithTimestamp } from '@/lib/userAuth';

// POST: 개별 프로모션 병합 (다른 프로모션들을 현재 프로모션에 병합하거나 새 바코드 추가)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { targetPromotionIds, newProducts, giftProducts, signature, timestamp, address } =
      await request.json();

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 401 }
      );
    }

    const isValid = verifyWithTimestamp(
      {
        action: 'merge_individual_promotion',
        sourcePromotionId: params.id,
        targetPromotionIds,
        newProducts,
        giftProducts,
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

    // 소스 프로모션 조회
    const sourcePromotion = await Promotion.findById(params.id);
    if (!sourcePromotion) {
      return NextResponse.json(
        { success: false, error: '프로모션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const mergedBarcodes: string[] = [...(sourcePromotion.applicableProducts || [])];
    const mergedPromotionIds: string[] = [];
    let giftBarcodes: string[] = [];
    let shouldSwitchToCross = false;

    // 1. 타겟 프로모션들의 바코드 수집
    if (targetPromotionIds && targetPromotionIds.length > 0) {
      const targetPromotions = await Promotion.find({
        _id: { $in: targetPromotionIds },
      });

      for (const targetPromotion of targetPromotions) {
        if (targetPromotion.applicableProducts) {
          mergedBarcodes.push(...targetPromotion.applicableProducts);
        }
        mergedPromotionIds.push(targetPromotion._id.toString());

        // 타겟 프로모션 상태 변경
        await Promotion.updateOne(
          { _id: targetPromotion._id },
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
                changes: {
                  type: 'merged',
                  mergedInto: sourcePromotion._id,
                },
                comment: `프로모션 "${sourcePromotion.name}"에 병합됨`,
              },
            },
          }
        );
      }
    }

    // 2. 새 바코드 추가
    if (newProducts && newProducts.length > 0) {
      mergedBarcodes.push(...newProducts);
    }

    // 3. 증정 상품 처리
    if (giftProducts && giftProducts.length > 0) {
      giftBarcodes = giftProducts;
      shouldSwitchToCross = true;
    }

    // 중복 제거
    const uniqueBarcodes = [...new Set(mergedBarcodes)];
    const uniqueGiftBarcodes = giftBarcodes.length > 0 ? [...new Set(giftBarcodes)] : [];

    // 4. 소스 프로모션 업데이트
    const updateData: any = {
      applicableProducts: uniqueBarcodes,
      lastModifiedBy: address,
    };

    // 증정 상품이 있으면 교차 증정으로 전환
    if (shouldSwitchToCross) {
      updateData.giftSelectionType = 'cross';
      updateData.giftProducts = uniqueGiftBarcodes;
    }

    await Promotion.updateOne(
      { _id: params.id },
      {
        $set: updateData,
        $push: {
          modificationHistory: {
            modifiedBy: address,
            modifiedAt: new Date(),
            changes: {
              type: 'merge_individual',
              addedPromotions: mergedPromotionIds.length,
              addedBarcodes: newProducts?.length || 0,
              addedGiftBarcodes: giftBarcodes.length,
              totalBarcodes: uniqueBarcodes.length,
              switchedToCross: shouldSwitchToCross,
            },
            comment: `${mergedPromotionIds.length}개 프로모션 + ${newProducts?.length || 0}개 바코드 병합${shouldSwitchToCross ? ' + 교차 증정으로 전환' : ''}`,
          },
        },
      }
    );

    // 4. PromotionIndex 업데이트
    for (const barcode of uniqueBarcodes) {
      await PromotionIndex.updateOne(
        { barcode },
        {
          $addToSet: { promotionIds: sourcePromotion._id },
          $set: { lastUpdated: new Date() },
        },
        { upsert: true }
      );

      // 타겟 프로모션들의 인덱스에서 제거
      if (mergedPromotionIds.length > 0) {
        await PromotionIndex.updateOne(
          { barcode },
          {
            $pull: { promotionIds: { $in: mergedPromotionIds } },
          }
        );
      }
    }

    // 5. 증정 상품 인덱스 업데이트
    if (uniqueGiftBarcodes.length > 0) {
      for (const barcode of uniqueGiftBarcodes) {
        await PromotionIndex.updateOne(
          { barcode },
          {
            $addToSet: { promotionIds: sourcePromotion._id },
            $set: { lastUpdated: new Date() },
          },
          { upsert: true }
        );
      }
    }

    // 6. 업데이트된 프로모션 조회
    const updatedPromotion = await Promotion.findById(params.id);

    return NextResponse.json({
      success: true,
      promotion: updatedPromotion,
      mergedCount: mergedPromotionIds.length,
      addedBarcodesCount: newProducts?.length || 0,
      addedGiftBarcodesCount: giftBarcodes.length,
      totalBarcodes: uniqueBarcodes.length,
      switchedToCross: shouldSwitchToCross,
    });
  } catch (error) {
    console.error('Error merging individual promotion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to merge promotion' },
      { status: 500 }
    );
  }
}
