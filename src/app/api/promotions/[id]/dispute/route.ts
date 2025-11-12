import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import { verifyWithTimestamp } from '@/lib/userAuth';

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

// POST: 프로모션 이의 제기
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const { signature, timestamp, address, reason } = await request.json();

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 401 }
      );
    }

    const isValid = verifyWithTimestamp(
      { action: 'dispute_promotion', id, reason },
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
    const promotion = await Promotion.findById(id);

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: 'Promotion not found' },
        { status: 404 }
      );
    }

    // 중복 이의 제기 방지
    if (promotion.disputedBy?.includes(address)) {
      return NextResponse.json(
        { success: false, error: '이미 이의를 제기하셨습니다.' },
        { status: 400 }
      );
    }

    // 이의 제기 추가
    await Promotion.updateOne(
      { _id: id },
      {
        $addToSet: { disputedBy: address },
        $inc: { disputeCount: 1 },
        $pull: { verifiedBy: address },
        $set: { lastModifiedBy: address },
        $push: {
          modificationHistory: {
            modifiedBy: address,
            modifiedAt: new Date(),
            changes: { type: 'dispute', reason },
            comment: `이의 제기: ${reason || '사유 없음'}`,
          },
        },
      }
    );

    // 검증 상태 자동 업데이트
    await updateVerificationStatus(id);

    const updatedPromotion = await Promotion.findById(id);

    return NextResponse.json({
      success: true,
      message: '이의 제기가 완료되었습니다.',
      promotion: updatedPromotion,
    });
  } catch (error) {
    console.error('Error disputing promotion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to dispute promotion' },
      { status: 500 }
    );
  }
}
