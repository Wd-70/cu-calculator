import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { UpdateCartInput } from '@/types/cart';

/**
 * GET /api/carts/:id
 * 특정 카트 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await db.connect();
    const { id } = await params;

    const cart = await db.findCartById(id);

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
    console.error('Error fetching cart:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/carts/:id
 * 카트 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await db.connect();
    const { id } = await params;

    const body = await request.json() as UpdateCartInput;

    const updatedData: Partial<UpdateCartInput> = {};
    if (body.name !== undefined) updatedData.name = body.name.trim();
    if (body.emoji !== undefined) updatedData.emoji = body.emoji;
    if (body.description !== undefined) updatedData.description = body.description?.trim();
    if (body.color !== undefined) updatedData.color = body.color;
    if (body.items !== undefined) updatedData.items = body.items;
    if (body.paymentMethod !== undefined) updatedData.paymentMethod = body.paymentMethod;
    if (body.presetId !== undefined) updatedData.presetId = body.presetId;
    if (body.cachedTotalOriginalPrice !== undefined) updatedData.cachedTotalOriginalPrice = body.cachedTotalOriginalPrice;
    if (body.cachedTotalFinalPrice !== undefined) updatedData.cachedTotalFinalPrice = body.cachedTotalFinalPrice;
    if (body.cachedTotalDiscount !== undefined) updatedData.cachedTotalDiscount = body.cachedTotalDiscount;
    if (body.lastCalculatedAt !== undefined) updatedData.lastCalculatedAt = body.lastCalculatedAt;

    const cart = await db.updateCart(id, updatedData);

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
    console.error('Error updating cart:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update cart' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/carts/:id
 * 카트 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await db.connect();
    const { id } = await params;

    const success = await db.deleteCart(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Cart not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cart deleted',
    });
  } catch (error) {
    console.error('Error deleting cart:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete cart' },
      { status: 500 }
    );
  }
}
