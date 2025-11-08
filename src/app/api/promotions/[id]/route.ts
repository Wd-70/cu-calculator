import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';
import { verifyWithTimestamp } from '@/lib/userAuth';
import { isAdmin } from '@/lib/adminAuth';

// GET: 특정 프로모션 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const promotion = await Promotion.findById(id).lean();

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: 'Promotion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      promotion,
    });
  } catch (error) {
    console.error('Error fetching promotion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch promotion' },
      { status: 500 }
    );
  }
}

// PUT: 프로모션 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const { promotionData, signature, timestamp, address, comment } = await request.json();

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 401 }
      );
    }

    const isValid = verifyWithTimestamp(
      { action: 'update_promotion', id, ...promotionData },
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

    // 기존 프로모션 조회
    const existingPromotion = await Promotion.findById(id);

    if (!existingPromotion) {
      return NextResponse.json(
        { success: false, error: 'Promotion not found' },
        { status: 404 }
      );
    }

    // 권한 확인: 관리자만 JSON 편집 가능
    const isAdminUser = isAdmin(address);

    if (!isAdminUser) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 변경 사항 추적
    const changes = {
      before: existingPromotion.toObject(),
      after: promotionData,
    };

    // 프로모션 업데이트
    const updatedPromotion = await Promotion.findByIdAndUpdate(
      id,
      {
        ...promotionData,
        lastModifiedBy: address,
        $push: {
          modificationHistory: {
            modifiedBy: address,
            modifiedAt: new Date(),
            changes,
            comment: comment || '프로모션 수정',
          },
        },
      },
      { new: true }
    );

    // PromotionIndex 업데이트 (바코드가 변경된 경우)
    const oldBarcodes = existingPromotion.applicableProducts || [];
    const newBarcodes = promotionData.applicableProducts || [];

    // 제거된 바코드 처리
    const removedBarcodes = oldBarcodes.filter((b: string) => !newBarcodes.includes(b));
    for (const barcode of removedBarcodes) {
      await PromotionIndex.updateOne(
        { barcode },
        {
          $pull: { promotionIds: id },
          $set: { lastUpdated: new Date() },
        }
      );
    }

    // 추가된 바코드 처리
    const addedBarcodes = newBarcodes.filter((b: string) => !oldBarcodes.includes(b));
    for (const barcode of addedBarcodes) {
      await PromotionIndex.updateOne(
        { barcode },
        {
          $addToSet: { promotionIds: id },
          $set: { lastUpdated: new Date() },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({
      success: true,
      promotion: updatedPromotion,
    });
  } catch (error) {
    console.error('Error updating promotion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update promotion' },
      { status: 500 }
    );
  }
}

// DELETE: 프로모션 삭제 (관리자만)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const { signature, timestamp, address } = await request.json();

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 401 }
      );
    }

    const isValid = verifyWithTimestamp(
      { action: 'delete_promotion', promotionId: id },
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
        { success: false, error: '관리자만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 프로모션 조회
    const promotion = await Promotion.findById(id);

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: 'Promotion not found' },
        { status: 404 }
      );
    }

    // PromotionIndex에서 제거
    if (promotion.applicableProducts && promotion.applicableProducts.length > 0) {
      await PromotionIndex.updateMany(
        { promotionIds: id },
        {
          $pull: { promotionIds: id },
          $set: { lastUpdated: new Date() },
        }
      );
    }

    // 프로모션 삭제 (또는 비활성화)
    await Promotion.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Promotion deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete promotion' },
      { status: 500 }
    );
  }
}
