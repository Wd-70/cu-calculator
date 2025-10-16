import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/discounts
 * Fetch all discount rules with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    await db.connect();

    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active');
    const category = searchParams.get('category');
    const month = searchParams.get('month');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const paymentMethod = searchParams.get('paymentMethod');

    // Build query filter
    const filter: Record<string, unknown> = {};

    if (active !== null) {
      filter.isActive = active === 'true';
    }

    if (category) {
      filter['config.category'] = category;
    }

    if (month) {
      filter.eventMonth = month;
    }

    // Date range filtering
    // 기본적으로 모든 할인 표시, excludeExpired가 true일 때만 만료된 할인 제외
    const excludeExpired = searchParams.get('excludeExpired') === 'true';
    if (excludeExpired) {
      filter.validTo = { $gte: new Date() };
    }

    if (startDate && endDate) {
      filter.$and = [
        { validFrom: { $lte: new Date(endDate) } },
        { validTo: { $gte: new Date(startDate) } },
      ];
    }

    // Payment method filtering
    if (paymentMethod) {
      filter.$or = [
        { requiredPaymentMethods: { $size: 0 } }, // No restrictions
        { requiredPaymentMethods: paymentMethod },
      ];
    }

    const discounts = await db.findDiscountRules(filter, {
      sort: { 'config.category': 1, priority: 1 },
    });

    return NextResponse.json({
      success: true,
      data: discounts,
    });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/discounts
 * Create a new discount rule (admin only in production)
 */
export async function POST(request: NextRequest) {
  try {
    await db.connect();

    const body = await request.json();

    const discount = await db.createDiscountRule(body);

    return NextResponse.json(
      {
        success: true,
        data: discount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating discount:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create discount' },
      { status: 500 }
    );
  }
}
