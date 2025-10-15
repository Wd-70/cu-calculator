import { IDiscountRule, DiscountCalculationResult } from '@/types/discount';
import { CartItem, CartCalculation, CartItemResult } from '@/types/cart';
import { PaymentMethod } from '@/types/payment';
import {
  validateDiscountCombination,
  sortDiscountsByOrder,
  isDiscountValid,
  isPaymentMethodCompatible,
} from './discountValidator';

/**
 * Apply a single discount to the current price
 */
function applySingleDiscount(
  currentPrice: number,
  quantity: number,
  unitPrice: number,
  discount: IDiscountRule
): number {
  switch (discount.type) {
    case 'bundle': {
      // 1+1, 2+1, etc.
      if (!discount.requiredQuantity || !discount.freeQuantity) return currentPrice;

      const sets = Math.floor(quantity / discount.requiredQuantity);
      const paidItems = sets * (discount.requiredQuantity - discount.freeQuantity);
      const remainingItems = quantity % discount.requiredQuantity;
      return (paidItems + remainingItems) * unitPrice;
    }

    case 'percentage': {
      // Percentage discount
      if (!discount.discountValue) return currentPrice;

      const percentDiscount = (currentPrice * discount.discountValue) / 100;
      const cappedDiscount = discount.maxDiscount
        ? Math.min(percentDiscount, discount.maxDiscount)
        : percentDiscount;
      return currentPrice - cappedDiscount;
    }

    case 'fixed': {
      // Fixed amount discount
      if (!discount.discountValue) return currentPrice;

      // Check minimum purchase requirement
      if (discount.minPurchase && currentPrice < discount.minPurchase) {
        return currentPrice;
      }

      return Math.max(0, currentPrice - discount.discountValue);
    }

    case 'gift': {
      // Gift promotion (no price discount)
      return currentPrice;
    }

    default:
      return currentPrice;
  }
}

/**
 * Calculate discount for a single cart item with multiple discounts applied sequentially
 */
export function calculateItemDiscountWithCombination(
  item: CartItem,
  discounts: IDiscountRule[],
  paymentMethod?: PaymentMethod,
  currentDate: Date = new Date()
): DiscountCalculationResult {
  const originalPrice = item.product.price * item.quantity;
  let currentPrice = originalPrice;
  const appliedDiscountsDetail: DiscountCalculationResult['appliedDiscounts'] = [];

  // If no discounts, return original price
  if (!discounts || discounts.length === 0) {
    return {
      originalPrice,
      discountedPrice: originalPrice,
      savings: 0,
      appliedDiscounts: [],
    };
  }

  // Validate discount combination
  const validation = validateDiscountCombination(discounts, paymentMethod, currentDate);
  if (!validation.isValid) {
    console.warn('Invalid discount combination:', validation.errors);

    // Filter to only valid discounts
    discounts = discounts.filter(
      (d) =>
        isDiscountValid(d, currentDate) &&
        (!paymentMethod || isPaymentMethodCompatible(d, paymentMethod))
    );

    if (discounts.length === 0) {
      return {
        originalPrice,
        discountedPrice: originalPrice,
        savings: 0,
        appliedDiscounts: [],
        errors: validation.errors,
      };
    }
  }

  // Sort discounts by application order
  const sortedDiscounts = sortDiscountsByOrder(discounts);

  // Apply each discount sequentially
  for (let i = 0; i < sortedDiscounts.length; i++) {
    const discount = sortedDiscounts[i];

    if (!discount.isActive) continue;

    // Check date validity
    if (!isDiscountValid(discount, currentDate)) continue;

    // Check payment method compatibility
    if (paymentMethod && !isPaymentMethodCompatible(discount, paymentMethod)) continue;

    const priceBeforeDiscount = currentPrice;
    currentPrice = applySingleDiscount(
      currentPrice,
      item.quantity,
      item.product.price,
      discount
    );

    const savedAmount = priceBeforeDiscount - currentPrice;

    if (savedAmount > 0) {
      appliedDiscountsDetail.push({
        discount,
        savedAmount,
        appliedOrder: i + 1,
      });
    }
  }

  return {
    originalPrice,
    discountedPrice: currentPrice,
    savings: originalPrice - currentPrice,
    appliedDiscounts: appliedDiscountsDetail,
  };
}

/**
 * Calculate total for entire cart with discounts
 */
export function calculateCartTotal(
  items: CartItem[],
  itemDiscounts: Map<string, IDiscountRule[]>,
  paymentMethod?: PaymentMethod,
  currentDate: Date = new Date()
): CartCalculation {
  const itemResults: CartItemResult[] = items.map((item) => {
    const productId = item.product._id.toString();
    const discounts = itemDiscounts.get(productId) || [];

    const calculation = calculateItemDiscountWithCombination(
      item,
      discounts,
      paymentMethod,
      currentDate
    );

    return {
      product: item.product,
      quantity: item.quantity,
      originalPrice: calculation.originalPrice,
      discountedPrice: calculation.discountedPrice,
      appliedDiscounts: calculation.appliedDiscounts,
      savings: calculation.savings,
    };
  });

  const totalOriginalPrice = itemResults.reduce(
    (sum, item) => sum + item.originalPrice,
    0
  );
  const totalDiscountedPrice = itemResults.reduce(
    (sum, item) => sum + item.discountedPrice,
    0
  );
  const totalSavings = totalOriginalPrice - totalDiscountedPrice;

  const warnings: string[] = [];

  // Check for any discount application issues
  for (const item of itemResults) {
    const productId = item.product._id.toString();
    const requestedDiscounts = itemDiscounts.get(productId) || [];

    if (requestedDiscounts.length > 0 && item.appliedDiscounts.length === 0) {
      warnings.push(
        `'${item.product.name}' 상품에 선택한 할인을 적용할 수 없습니다.`
      );
    }
  }

  return {
    items: itemResults,
    summary: {
      totalOriginalPrice,
      totalDiscountedPrice,
      totalSavings,
      savingsPercentage:
        totalOriginalPrice > 0
          ? (totalSavings / totalOriginalPrice) * 100
          : 0,
    },
    paymentMethod,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
