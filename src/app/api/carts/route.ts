import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { CreateCartInput } from '@/types/cart';

/**
 * GET /api/carts
 * 모든 카트 조회
 */
export async function GET(request: NextRequest) {
  try {
    await db.connect();

    const carts = await db.findCarts({}, { sort: { updatedAt: -1 } });

    return NextResponse.json({
      success: true,
      data: carts,
    });
  } catch (error) {
    console.error('Error fetching carts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch carts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/carts
 * 새 카트 생성
 */
export async function POST(request: NextRequest) {
  try {
    await db.connect();

    const body = await request.json() as CreateCartInput;

    // 유효성 검사
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const cart = await db.createCart({
      name: body.name.trim(),
      emoji: body.emoji,
      description: body.description?.trim(),
      color: body.color,
      items: body.items || [],
      paymentMethod: body.paymentMethod,
      presetId: body.presetId,
    });

    return NextResponse.json({
      success: true,
      data: cart,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating cart:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create cart' },
      { status: 500 }
    );
  }
}
