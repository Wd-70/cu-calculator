import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * POST /api/carts/:id/set-main
 * 메인 카트로 설정
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await db.connect();
    const { id } = await params;

    // 모든 카트의 isMain을 false로 변경
    const allCarts = await db.findCarts({});
    for (const cart of allCarts) {
      if (cart.isMain) {
        await db.updateCart(String(cart._id), { isMain: false });
      }
    }

    // 현재 카트를 메인으로 설정
    const cart = await db.updateCart(id, { isMain: true });

    if (!cart) {
      return NextResponse.json(
        { success: false, error: 'Cart not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cart,
    });
  } catch (error) {
    console.error('Error setting main cart:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set main cart' },
      { status: 500 }
    );
  }
}
