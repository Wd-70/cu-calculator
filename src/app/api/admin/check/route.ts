import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import { verifyWithTimestamp } from '@/lib/userAuth';

/**
 * POST /api/admin/check
 * Check if an account is an admin (with signature verification)
 */
export async function POST(request: NextRequest) {
  try {
    const { accountAddress, signature, timestamp } = await request.json();

    // 서명이 제공되지 않은 경우 (이전 버전 호환성)
    if (!signature || !timestamp) {
      return NextResponse.json({
        success: true,
        isAdmin: false,
        error: '서명이 필요합니다.',
      });
    }

    // 서명 검증
    const data = { action: 'check_admin' };
    const isValidSignature = verifyWithTimestamp(
      data,
      signature,
      timestamp,
      accountAddress
    );

    if (!isValidSignature) {
      return NextResponse.json({
        success: false,
        isAdmin: false,
        error: '유효하지 않은 서명입니다.',
      }, { status: 401 });
    }

    // 서명이 검증되면 관리자 여부 확인
    const adminStatus = isAdmin(accountAddress);

    return NextResponse.json({
      success: true,
      isAdmin: adminStatus,
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      {
        success: false,
        isAdmin: false,
        error: '관리자 확인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
