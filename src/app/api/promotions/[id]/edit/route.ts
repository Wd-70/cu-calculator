import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import { verifyWithTimestamp } from '@/lib/userAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      updates,
      comment,
      signature,
      timestamp,
      address
    } = body;

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    // 서명 검증
    const isValid = verifyWithTimestamp(
      {
        action: 'edit_promotion',
        promotionId: id,
        updates,
        comment,
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

    await connectDB();

    // 기존 프로모션 조회
    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return NextResponse.json(
        { success: false, error: '프로모션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 변경 사항 계산
    const changes: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (JSON.stringify(promotion[key as keyof typeof promotion]) !== JSON.stringify(value)) {
        changes[key] = {
          before: promotion[key as keyof typeof promotion],
          after: value,
        };
      }
    }

    // 히스토리에 추가
    promotion.modificationHistory.push({
      modifiedBy: address,
      modifiedAt: new Date(),
      changes,
      comment: comment || '수정됨',
    });

    // 업데이트 적용
    Object.assign(promotion, updates);
    promotion.lastModifiedBy = address;

    await promotion.save();

    return NextResponse.json({
      success: true,
      promotion,
      message: '프로모션이 성공적으로 수정되었습니다.',
    });

  } catch (error) {
    console.error('Promotion edit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to edit promotion',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
