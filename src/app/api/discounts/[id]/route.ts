import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';

/**
 * GET /api/discounts/[id]
 * 특정 할인 규칙 조회 (서명 불필요)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.connect();

    const discount = await db.findDiscountRuleById(params.id);

    if (!discount) {
      return NextResponse.json(
        { success: false, error: 'Discount rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: discount,
    });
  } catch (error) {
    console.error('Error fetching discount:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discount' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/discounts/[id]
 * 할인 규칙 수정 (모든 사용자, 서명 필요)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { discountData, signature, timestamp, address, comment } = body;

    // 1. 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명이 필요합니다.' },
        { status: 401 }
      );
    }

    const { verifyWithTimestamp } = await import('@/lib/userAuth');

    const isValidSignature = verifyWithTimestamp(
      { action: 'update_discount', id: params.id, ...discountData },
      signature,
      timestamp,
      address
    );

    if (!isValidSignature) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 서명입니다.' },
        { status: 401 }
      );
    }

    // 2. DB 연결 및 기존 규칙 조회
    await db.connect();
    const existingRule = await db.findDiscountRuleById(params.id);

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: 'Discount rule not found' },
        { status: 404 }
      );
    }

    // 3. 변경 사항 기록
    const changes = {
      before: existingRule,
      after: discountData,
    };

    // 4. 할인 규칙 업데이트
    const updatedRule = await db.updateDiscountRule(params.id, {
      ...discountData,
      lastModifiedBy: address,
      $push: {
        modificationHistory: {
          modifiedBy: address,
          modifiedAt: new Date(),
          changes,
          comment: comment || '할인 규칙 수정',
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedRule,
    });
  } catch (error) {
    console.error('Error updating discount:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update discount' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/discounts/[id]
 * 할인 규칙 삭제 (관리자만, 서명 필요)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { signature, timestamp, address } = body;

    // 1. 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명이 필요합니다.' },
        { status: 401 }
      );
    }

    const { verifyWithTimestamp } = await import('@/lib/userAuth');

    const isValidSignature = verifyWithTimestamp(
      { action: 'delete_discount', id: params.id },
      signature,
      timestamp,
      address
    );

    if (!isValidSignature) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 서명입니다.' },
        { status: 401 }
      );
    }

    // 2. 관리자 권한 확인
    if (!isAdmin(address)) {
      return NextResponse.json(
        { success: false, error: '관리자만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 3. DB 연결 및 삭제
    await db.connect();
    const deleted = await db.deleteDiscountRule(params.id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Discount rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Discount rule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting discount:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete discount' },
      { status: 500 }
    );
  }
}
