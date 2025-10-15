import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import DiscountRule from '@/lib/models/DiscountRule';
import { calculateCartTotal } from '@/lib/utils/discountCalculator';
import { CartItem } from '@/types/cart';
import { PaymentMethod } from '@/types/payment';
import { IDiscountRule } from '@/types/discount';

interface CalculateRequestItem {
  productId?: string;
  barcode?: string;
  quantity: number;
  selectedDiscountIds?: string[];
}

/**
 * POST /api/calculate
 * Calculate cart total with discounts
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { items, paymentMethod } = await request.json() as {
      items: CalculateRequestItem[];
      paymentMethod?: PaymentMethod;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid items' },
        { status: 400 }
      );
    }

    // Fetch all products
    const productIds = items
      .map((item) => item.productId)
      .filter(Boolean);
    const barcodes = items
      .map((item) => item.barcode)
      .filter(Boolean);

    const products = await Product.find({
      $or: [
        { _id: { $in: productIds } },
        { barcode: { $in: barcodes } },
      ],
    });

    if (products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No products found' },
        { status: 404 }
      );
    }

    // Map products to cart items
    const cartItems: CartItem[] = items
      .map((item) => {
        const product = products.find(
          (p) =>
            p._id.toString() === item.productId ||
            p.barcode === item.barcode
        );

        if (!product) return null;

        return {
          product,
          quantity: item.quantity,
          selectedDiscountIds: item.selectedDiscountIds,
        };
      })
      .filter((item): item is CartItem => item !== null);

    // Fetch all discount rules mentioned in the request
    const allDiscountIds = items
      .flatMap((item) => item.selectedDiscountIds || [])
      .filter(Boolean);

    const discountRules = await DiscountRule.find({
      _id: { $in: allDiscountIds },
    });

    // Build discount map: productId -> discount rules
    const itemDiscounts = new Map<string, IDiscountRule[]>();

    for (const item of items) {
      const product = products.find(
        (p) =>
          p._id.toString() === item.productId ||
          p.barcode === item.barcode
      );

      if (!product || !item.selectedDiscountIds) continue;

      const productDiscounts = discountRules.filter((d) =>
        item.selectedDiscountIds!.includes(d._id.toString())
      );

      itemDiscounts.set(product._id.toString(), productDiscounts);
    }

    // Calculate cart total
    const result = calculateCartTotal(
      cartItems,
      itemDiscounts,
      paymentMethod
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error calculating cart:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate cart' },
      { status: 500 }
    );
  }
}
