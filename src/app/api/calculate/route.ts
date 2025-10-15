import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { calculateCart } from '@/lib/utils/discountCalculator';
import { PaymentMethod } from '@/types/payment';
import { CartItemDiscounts } from '@/types/discount';

interface CalculateRequestItem {
  productId?: string;
  barcode?: string;
  quantity: number;
  selectedDiscountIds?: string[];
}

/**
 * POST /api/calculate
 * Calculate cart total with discounts (v2 - 엑셀 로직 기반)
 */
export async function POST(request: NextRequest) {
  try {
    await db.connect();

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
    const products = [];
    for (const item of items) {
      let product = null;

      if (item.barcode) {
        product = await db.findProductByBarcode(item.barcode);
      } else if (item.productId) {
        product = await db.findProductById(item.productId);
      }

      if (product) {
        products.push(product);
      }
    }

    if (products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No products found' },
        { status: 404 }
      );
    }

    // Fetch all discount rules mentioned in the request
    const allDiscountIds = items
      .flatMap((item) => item.selectedDiscountIds || [])
      .filter(Boolean) as string[];

    const discountRules = await db.findDiscountRulesByIds(allDiscountIds);

    // Build discount selections: productId -> discount rules
    const discountSelections: CartItemDiscounts[] = [];

    for (const item of items) {
      const product = products.find(
        (p) =>
          String(p._id) === item.productId ||
          p.barcode === item.barcode
      );

      if (!product || !item.selectedDiscountIds) continue;

      const productDiscounts = discountRules.filter((d) =>
        item.selectedDiscountIds!.includes(String(d._id))
      );

      if (productDiscounts.length > 0) {
        discountSelections.push({
          productId: product._id,
          productBarcode: product.barcode,
          selectedDiscounts: productDiscounts,
        });
      }
    }

    // Build cart items for calculation
    const cartItems = items
      .map((item) => {
        const product = products.find(
          (p) =>
            String(p._id) === item.productId ||
            p.barcode === item.barcode
        );

        if (!product) return null;

        return {
          productId: product._id,
          quantity: item.quantity,
          unitPrice: product.price,
          productCategory: product.category,
          productBrand: product.brand,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Calculate cart total using v2 engine
    const result = calculateCart({
      items: cartItems,
      discountSelections,
      paymentMethod,
      currentDate: new Date(),
    });

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
