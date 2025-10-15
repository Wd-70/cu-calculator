import { IDiscountRule, DiscountValidationResult } from '@/types/discount';
import { PaymentMethod } from '@/types/payment';

/**
 * Check if a discount is currently valid based on date range
 */
export function isDiscountValid(
  discount: IDiscountRule,
  currentDate: Date = new Date()
): boolean {
  if (!discount.isActive) return false;

  const validFrom = new Date(discount.validFrom);
  const validTo = new Date(discount.validTo);

  return currentDate >= validFrom && currentDate <= validTo;
}

/**
 * Check if a discount is compatible with the payment method
 */
export function isPaymentMethodCompatible(
  discount: IDiscountRule,
  paymentMethod: PaymentMethod
): boolean {
  // If no payment method restrictions, allow all
  if (!discount.requiredPaymentMethods || discount.requiredPaymentMethods.length === 0) {
    return true;
  }

  return discount.requiredPaymentMethods.includes(paymentMethod);
}

/**
 * Validate payment method compatibility for all selected discounts
 */
export function validatePaymentMethodCompatibility(
  selectedDiscounts: IDiscountRule[],
  paymentMethod: PaymentMethod
): DiscountValidationResult {
  const errors: string[] = [];

  for (const discount of selectedDiscounts) {
    if (!isPaymentMethodCompatible(discount, paymentMethod)) {
      const methods = discount.paymentMethodNames.join(', ') || '특정 결제수단';
      errors.push(
        `'${discount.name}' 할인은 ${methods}로만 결제 시 사용 가능합니다.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that selected discounts can be combined with each other
 */
export function validateDiscountCombination(
  selectedDiscounts: IDiscountRule[],
  paymentMethod?: PaymentMethod,
  currentDate: Date = new Date()
): DiscountValidationResult {
  const errors: string[] = [];

  // 0. Validate date ranges
  for (const discount of selectedDiscounts) {
    if (!isDiscountValid(discount, currentDate)) {
      const validFrom = new Date(discount.validFrom).toLocaleDateString('ko-KR');
      const validTo = new Date(discount.validTo).toLocaleDateString('ko-KR');
      errors.push(
        `'${discount.name}' 할인은 ${validFrom} ~ ${validTo} 기간에만 사용 가능합니다.`
      );
    }
  }

  // 1. Validate payment method compatibility
  if (paymentMethod) {
    const paymentValidation = validatePaymentMethodCompatibility(
      selectedDiscounts,
      paymentMethod
    );
    errors.push(...paymentValidation.errors);
  }

  // 2. Check for mutually exclusive discounts (cannotCombineWith)
  for (let i = 0; i < selectedDiscounts.length; i++) {
    for (let j = i + 1; j < selectedDiscounts.length; j++) {
      const discount1 = selectedDiscounts[i];
      const discount2 = selectedDiscounts[j];

      const discount1Id = discount1._id.toString();
      const discount2Id = discount2._id.toString();

      if (
        discount1.cannotCombineWith.some((id) => id.toString() === discount2Id)
      ) {
        errors.push(
          `'${discount1.name}'와 '${discount2.name}'은 함께 적용할 수 없습니다.`
        );
      }
    }
  }

  // 3. Validate prerequisite discounts (requiresPreviousDiscount)
  for (const discount of selectedDiscounts) {
    if (discount.requiresPreviousDiscount) {
      const requiredId = discount.requiresPreviousDiscount.toString();
      const hasPrerequisite = selectedDiscounts.some(
        (d) => d._id.toString() === requiredId
      );

      if (!hasPrerequisite) {
        errors.push(
          `'${discount.name}'을 적용하려면 먼저 다른 할인이 필요합니다.`
        );
      }
    }
  }

  // 4. Validate whitelist combinations (canCombineWith)
  for (const discount of selectedDiscounts) {
    if (discount.canCombineWith.length > 0) {
      const otherDiscounts = selectedDiscounts.filter(
        (d) => d._id.toString() !== discount._id.toString()
      );

      for (const other of otherDiscounts) {
        const otherId = other._id.toString();
        const canCombine = discount.canCombineWith.some(
          (id) => id.toString() === otherId
        );

        if (!canCombine) {
          errors.push(
            `'${discount.name}'은 '${other.name}'과 조합할 수 없습니다.`
          );
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sort discounts by their application order
 */
export function sortDiscountsByOrder(
  discounts: IDiscountRule[]
): IDiscountRule[] {
  return [...discounts].sort((a, b) => {
    // Sort by applicationOrder (lower numbers first)
    if (a.applicationOrder !== b.applicationOrder) {
      return a.applicationOrder - b.applicationOrder;
    }

    // If one requires the other as prerequisite, prerequisite comes first
    if (b.requiresPreviousDiscount?.toString() === a._id.toString()) return -1;
    if (a.requiresPreviousDiscount?.toString() === b._id.toString()) return 1;

    return 0;
  });
}
