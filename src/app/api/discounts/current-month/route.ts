import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import DiscountRule from '@/lib/models/DiscountRule';

/**
 * GET /api/discounts/current-month
 * Fetch all active discounts for the current month
 */
export async function GET() {
  try {
    await connectDB();

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const discounts = await DiscountRule.find({
      isActive: true,
      eventMonth: currentMonth,
      validFrom: { $lte: now },
      validTo: { $gte: now },
    }).sort({ applicationOrder: 1 });

    return NextResponse.json({
      success: true,
      data: discounts,
      month: currentMonth,
    });
  } catch (error) {
    console.error('Error fetching current month discounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch current month discounts' },
      { status: 500 }
    );
  }
}
