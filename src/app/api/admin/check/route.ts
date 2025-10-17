import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';

/**
 * POST /api/admin/check
 * Check if an account is an admin
 */
export async function POST(request: NextRequest) {
  try {
    const { accountAddress } = await request.json();

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
