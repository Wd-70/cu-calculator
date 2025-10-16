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

    // isMain이 true면 다른 카트들의 isMain을 false로 변경
    if (body.isMain) {
      const existingCarts = await db.findCarts({});
      for (const existingCart of existingCarts) {
        if (existingCart.isMain) {
          await db.updateCart(String(existingCart._id), { isMain: false });
        }
      }
    }

    const cart = await db.createCart({
      name: body.name?.trim(),
      emoji: body.emoji,
      description: body.description?.trim(),
      color: body.color,
      items: body.items || [],
      paymentMethod: body.paymentMethod,
      presetId: body.presetId,
      isMain: body.isMain,
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
