import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import { verifyWithTimestamp } from '@/lib/userAuth';
import { isAdmin } from '@/lib/adminAuth';

// 검증 상태 자동 업데이트 함수
async function updateVerificationStatus(promotionId: string) {
  const promotion = await Promotion.findById(promotionId);

  if (!promotion) return;

  const verifyCount = promotion.verificationCount;
  const disputeCount = promotion.disputeCount;
  const ratio = disputeCount > 0 ? verifyCount / disputeCount : verifyCount;

  let newStatus: 'unverified' | 'pending' | 'verified' | 'disputed';

  if (disputeCount >= 3 || (disputeCount > verifyCount && disputeCount >= 2)) {
    // 이의 제기가 많으면 'disputed'
    newStatus = 'disputed';
  } else if (verifyCount >= 5 && ratio >= 3) {
    // 검증 5개 이상 & 검증:이의 비율 3:1 이상 → 'verified'
    newStatus = 'verified';
  } else if (verifyCount >= 2) {
    // 검증 2개 이상 → 'pending'
    newStatus = 'pending';
  } else {
    // 기본값
    newStatus = 'unverified';
  }

  await Promotion.updateOne(
    { _id: promotionId },
    { $set: { verificationStatus: newStatus } }
  );
}

// POST: 프로모션 검증
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { signature, timestamp, address, adminVerify } = await request.json();

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 401 }
      );
    }

    const isValid = verifyWithTimestamp(
      { action: 'verify_promotion', id: params.id },
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

    // 프로모션 조회
    const promotion = await Promotion.findById(params.id);

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: 'Promotion not found' },
        { status: 404 }
      );
    }

    // 중복 검증 방지
    if (promotion.verifiedBy?.includes(address)) {
      return NextResponse.json(
        { success: false, error: '이미 검증하셨습니다.' },
        { status: 400 }
      );
    }

    // 관리자 직접 검증 (즉시 verified 상태로)
    const isAdminUser = isAdmin(address);
    if (adminVerify && isAdminUser) {
      await Promotion.updateOne(
        { _id: params.id },
        {
          $set: {
            verificationStatus: 'verified',
            lastModifiedBy: address,
          },
          $addToSet: { verifiedBy: address },
          $inc: { verificationCount: 1 },
          $pull: { disputedBy: address },
          $push: {
            modificationHistory: {
              modifiedBy: address,
              modifiedAt: new Date(),
              changes: { type: 'admin_verify' },
              comment: '관리자 직접 검증',
            },
          },
        }
      );

      const updatedPromotion = await Promotion.findById(params.id);

      return NextResponse.json({
        success: true,
        message: '관리자 검증이 완료되었습니다.',
        promotion: updatedPromotion,
      });
    }

    // 일반 사용자 검증
    await Promotion.updateOne(
      { _id: params.id },
      {
        $addToSet: { verifiedBy: address },
        $inc: { verificationCount: 1 },
        $pull: { disputedBy: address },
        $set: { lastModifiedBy: address },
        $push: {
          modificationHistory: {
            modifiedBy: address,
            modifiedAt: new Date(),
            changes: { type: 'verify' },
            comment: '사용자 검증',
          },
        },
      }
    );

    // 검증 상태 자동 업데이트
    await updateVerificationStatus(params.id);

    const updatedPromotion = await Promotion.findById(params.id);

    return NextResponse.json({
      success: true,
      message: '검증이 완료되었습니다.',
      promotion: updatedPromotion,
    });
  } catch (error) {
    console.error('Error verifying promotion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify promotion' },
      { status: 500 }
    );
  }
}
