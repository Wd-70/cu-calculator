import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import DiscountRule from '@/lib/models/DiscountRule';

/**
 * GET /api/discounts
 * Fetch all discount rules with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active');
    const type = searchParams.get('type');
    const month = searchParams.get('month');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const paymentMethod = searchParams.get('paymentMethod');
    const includeExpired = searchParams.get('includeExpired') === 'true';

    // Build query
    const query: Record<string, unknown> = {};

    if (active !== null) {
      query.isActive = active === 'true';
    }

    if (type) {
      query.type = type;
    }

    if (month) {
      query.eventMonth = month;
    }

    // Date range filtering
    if (!includeExpired) {
      query.validTo = { $gte: new Date() };
    }

    if (startDate && endDate) {
      query.$and = [
        { validFrom: { $lte: new Date(endDate) } },
        { validTo: { $gte: new Date(startDate) } },
      ];
    }

    // Payment method filtering
    if (paymentMethod) {
      query.$or = [
        { requiredPaymentMethods: { $size: 0 } }, // No restrictions
        { requiredPaymentMethods: paymentMethod },
      ];
    }

    const discounts = await DiscountRule.find(query).sort({ applicationOrder: 1 });

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
    await connectDB();

    const body = await request.json();

    const discount = await DiscountRule.create(body);

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
