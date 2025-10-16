import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { calculateCart } from '@/lib/utils/discountCalculator';

/**
 * POST /api/carts/compare
 * 여러 카트를 비교
 */
export async function POST(request: NextRequest) {
  try {
    await db.connect();

    const { cartIds } = await request.json() as { cartIds: string[] };

    if (!cartIds || !Array.isArray(cartIds) || cartIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cart IDs are required' },
        { status: 400 }
      );
    }

    // 모든 카트 조회
    const carts = [];
    for (const cartId of cartIds) {
      const cart = await db.findCartById(cartId);
      if (cart) {
        carts.push(cart);
      }
    }

    if (carts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No carts found' },
        { status: 404 }
      );
    }

    // 각 카트 계산
    const comparisons = [];
    let bestCart = null;
    let maxSavings = 0;

    for (const cart of carts) {
      // 카트 아이템을 계산 형식으로 변환
      const calculationItems = cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
        productCategory: item.category,
        productBrand: item.brand,
      }));

      // 할인 선택 준비
      const discountSelections = cart.items.map((item) => ({
        productId: item.productId,
        productBarcode: item.barcode,
        selectedDiscounts: [], // 실제로는 DB에서 할인 규칙을 가져와야 함
      }));

      // 모든 할인 규칙 가져오기
      const allDiscountIds = cart.items.flatMap((item) =>
        item.selectedDiscountIds.map(String)
      );
      const uniqueDiscountIds = [...new Set(allDiscountIds)];
      const discountRules = await db.findDiscountRulesByIds(uniqueDiscountIds);

      // 할인 선택 재구성
      const discountSelectionsWithRules = cart.items.map((item) => {
        const itemDiscounts = discountRules.filter((rule) =>
          item.selectedDiscountIds.map(String).includes(String(rule._id))
        );
        return {
          productId: item.productId,
          productBarcode: item.barcode,
          selectedDiscounts: itemDiscounts,
        };
      });

      // 계산 실행
      const result = calculateCart({
        items: calculationItems,
        discountSelections: discountSelectionsWithRules,
        paymentMethod: cart.paymentMethod,
        currentDate: new Date(),
      });

      const savings = result.totalOriginalPrice - result.totalFinalPrice;

      comparisons.push({
        cart,
        totalOriginalPrice: result.totalOriginalPrice,
        totalFinalPrice: result.totalFinalPrice,
        totalDiscount: result.totalDiscount,
        totalDiscountRate: result.totalDiscountRate,
      });

      // 최고 절약 카트 찾기
      if (savings > maxSavings) {
        maxSavings = savings;
        bestCart = {
          cartId: cart._id,
          cartName: cart.name,
          savings,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        carts: comparisons,
        bestCart,
      },
    });
  } catch (error) {
    console.error('Error comparing carts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compare carts' },
      { status: 500 }
    );
  }
}
