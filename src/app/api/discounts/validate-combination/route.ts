import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import DiscountRule from '@/lib/models/DiscountRule';
import { validateDiscountCombination, sortDiscountsByOrder } from '@/lib/utils/discountValidator';
import { PaymentMethod } from '@/types/payment';

/**
 * POST /api/discounts/validate-combination
 * Validate if selected discounts can be combined
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { discountIds, paymentMethod } = await request.json();

    if (!discountIds || !Array.isArray(discountIds)) {
      return NextResponse.json(
        { success: false, error: 'Invalid discount IDs' },
        { status: 400 }
      );
    }

    // Fetch discount rules
    const discounts = await DiscountRule.find({
      _id: { $in: discountIds },
    });

    if (discounts.length !== discountIds.length) {
      return NextResponse.json(
        { success: false, error: 'Some discount IDs not found' },
        { status: 404 }
      );
    }

    // Validate combination
    const validation = validateDiscountCombination(
      discounts,
      paymentMethod as PaymentMethod | undefined
    );

    // Get suggested order
    const suggestedOrder = sortDiscountsByOrder(discounts).map((d) =>
      d._id.toString()
    );

    return NextResponse.json({
      success: true,
      isValid: validation.isValid,
      errors: validation.errors,
      suggestedOrder,
    });
  } catch (error) {
    console.error('Error validating discount combination:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate discount combination' },
      { status: 500 }
    );
  }
}
