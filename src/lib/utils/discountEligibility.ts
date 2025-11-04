/**
 * 할인 적용 가능 여부 체크 유틸리티
 * 프리셋의 결제수단, 구독 정보를 기반으로 할인 규칙 적용 가능 여부 판단
 */

import { IDiscountRule, getCombinationRules } from '@/types/discount';
import { IPreset, PaymentMethodInfo, UserSubscription } from '@/types/preset';
import { PaymentMethod } from '@/types/payment';

/**
 * 할인 적용 가능 여부 체크 결과
 */
export interface DiscountEligibilityResult {
  isEligible: boolean;
  reason?: string; // 적용 불가 시 사유
  warnings?: string[]; // 경고 메시지
}

/**
 * 결제수단 제약 체크
 */
export function checkPaymentMethodConstraint(
  discount: IDiscountRule,
  preset: IPreset
): DiscountEligibilityResult {
  // 할인에 결제수단 제약이 없으면 통과
  if (!discount.requiredPaymentMethods || discount.requiredPaymentMethods.length === 0) {
    return { isEligible: true };
  }

  // 프리셋에 결제수단이 하나도 없으면 실패
  if (!preset.paymentMethods || preset.paymentMethods.length === 0) {
    return {
      isEligible: false,
      reason: '등록된 결제수단이 없습니다.',
    };
  }

  // 프리셋의 결제수단 중 할인 요구사항을 만족하는 것이 있는지 확인
  const hasMatchingPaymentMethod = preset.paymentMethods.some((pm) =>
    discount.requiredPaymentMethods.includes(pm.method)
  );

  if (!hasMatchingPaymentMethod) {
    return {
      isEligible: false,
      reason: `필요한 결제수단: ${discount.paymentMethodNames?.join(', ') || discount.requiredPaymentMethods.join(', ')}`,
    };
  }

  return { isEligible: true };
}

/**
 * QR 스캐너 요구사항 체크
 */
export function checkQRRequirement(
  discount: IDiscountRule,
  preset: IPreset
): DiscountEligibilityResult {
  // 결제행사 할인에서 QR 필요 여부 확인
  if (discount.config.category === 'payment_event' && discount.config.requiresQR) {
    if (!preset.hasQRScanner) {
      return {
        isEligible: false,
        reason: '포켓CU 앱의 QR 스캐너가 필요합니다.',
      };
    }
  }

  return { isEligible: true };
}

/**
 * 구독/멤버십 요구사항 체크
 */
export function checkSubscriptionRequirement(
  discount: IDiscountRule,
  preset: IPreset,
  currentDate: Date = new Date()
): DiscountEligibilityResult {
  // 할인 결합 규칙 가져오기
  const rules = getCombinationRules(discount);

  // ========================================================================
  // 1. 이 할인 자체가 구독/멤버십/통신사 할인인 경우
  // → 프리셋에 이 할인이 구독으로 등록되어 있어야 함
  // ========================================================================
  const isSubscriptionBasedDiscount =
    discount.config.category === 'telecom' ||
    (discount.config.category === 'coupon' && discount.name.includes('구독')) ||
    discount.config.category === 'payment_instant' && (discount.config as any).isNaverPlus;

  if (isSubscriptionBasedDiscount) {
    if (!preset.subscriptions || preset.subscriptions.length === 0) {
      return {
        isEligible: false,
        reason: `'${discount.name}' 구독이 프리셋에 등록되지 않았습니다.`,
      };
    }

    // 프리셋의 구독 목록에 이 할인 ID가 있는지 확인
    const subscription = preset.subscriptions.find(
      (sub) => String(sub.discountId) === String(discount._id)
    );

    if (!subscription) {
      return {
        isEligible: false,
        reason: `'${discount.name}' 구독이 프리셋에 등록되지 않았습니다.`,
      };
    }

    if (!subscription.isActive) {
      return {
        isEligible: false,
        reason: `${subscription.name} 구독이 비활성화되어 있습니다.`,
      };
    }

    // 유효 기간 확인
    if (subscription.validFrom && currentDate < subscription.validFrom) {
      return {
        isEligible: false,
        reason: `${subscription.name} 구독이 아직 시작되지 않았습니다.`,
      };
    }

    if (subscription.validTo && currentDate > subscription.validTo) {
      return {
        isEligible: false,
        reason: `${subscription.name} 구독이 만료되었습니다.`,
      };
    }

    // 사용 횟수 제한 확인
    if (
      subscription.dailyUsageRemaining !== undefined &&
      subscription.dailyUsageRemaining <= 0
    ) {
      return {
        isEligible: false,
        reason: `${subscription.name} 오늘의 사용 가능 횟수를 모두 소진했습니다.`,
      };
    }

    if (
      subscription.totalUsageRemaining !== undefined &&
      subscription.totalUsageRemaining <= 0
    ) {
      return {
        isEligible: false,
        reason: `${subscription.name} 전체 사용 가능 횟수를 모두 소진했습니다.`,
      };
    }
  }

  // ========================================================================
  // 2. 할인 규칙에 다른 특정 구독이 필요한 경우
  // ========================================================================
  if (rules.requiresDiscountId) {
    if (!preset.subscriptions || preset.subscriptions.length === 0) {
      return {
        isEligible: false,
        reason: '필요한 구독/멤버십이 등록되지 않았습니다.',
      };
    }

    // 해당 구독이 활성화되어 있는지 확인
    const requiredSubscription = preset.subscriptions.find(
      (sub) => String(sub.discountId) === String(rules.requiresDiscountId)
    );

    if (!requiredSubscription) {
      return {
        isEligible: false,
        reason: '필요한 구독/멤버십이 등록되지 않았습니다.',
      };
    }

    if (!requiredSubscription.isActive) {
      return {
        isEligible: false,
        reason: `${requiredSubscription.name} 구독이 비활성화되어 있습니다.`,
      };
    }

    // 유효 기간 확인
    if (requiredSubscription.validFrom && currentDate < requiredSubscription.validFrom) {
      return {
        isEligible: false,
        reason: `${requiredSubscription.name} 구독이 아직 시작되지 않았습니다.`,
      };
    }

    if (requiredSubscription.validTo && currentDate > requiredSubscription.validTo) {
      return {
        isEligible: false,
        reason: `${requiredSubscription.name} 구독이 만료되었습니다.`,
      };
    }

    // 사용 횟수 제한 확인
    if (
      requiredSubscription.dailyUsageRemaining !== undefined &&
      requiredSubscription.dailyUsageRemaining <= 0
    ) {
      return {
        isEligible: false,
        reason: `${requiredSubscription.name} 오늘의 사용 가능 횟수를 모두 소진했습니다.`,
      };
    }

    if (
      requiredSubscription.totalUsageRemaining !== undefined &&
      requiredSubscription.totalUsageRemaining <= 0
    ) {
      return {
        isEligible: false,
        reason: `${requiredSubscription.name} 전체 사용 가능 횟수를 모두 소진했습니다.`,
      };
    }
  }

  return { isEligible: true };
}

/**
 * 할인 유효 기간 체크
 */
export function checkDiscountValidity(
  discount: IDiscountRule,
  currentDate: Date = new Date()
): DiscountEligibilityResult {
  if (!discount.isActive) {
    return {
      isEligible: false,
      reason: '비활성화된 할인입니다.',
    };
  }

  if (currentDate < discount.validFrom) {
    return {
      isEligible: false,
      reason: '할인 기간이 아직 시작되지 않았습니다.',
    };
  }

  if (currentDate > discount.validTo) {
    return {
      isEligible: false,
      reason: '할인 기간이 만료되었습니다.',
    };
  }

  return { isEligible: true };
}

/**
 * 상품 적용 대상 체크
 */
export function checkProductEligibility(
  discount: IDiscountRule,
  productBarcode: string,
  productCategory?: string,
  productBrand?: string
): DiscountEligibilityResult {
  // 특정 상품 제한이 있는 경우
  if (discount.applicableProducts && discount.applicableProducts.length > 0) {
    if (!discount.applicableProducts.includes(productBarcode)) {
      return {
        isEligible: false,
        reason: '할인 대상 상품이 아닙니다.',
      };
    }
  }

  // 특정 카테고리 제한이 있는 경우
  if (discount.applicableCategories && discount.applicableCategories.length > 0) {
    if (!productCategory || !discount.applicableCategories.includes(productCategory)) {
      return {
        isEligible: false,
        reason: '할인 대상 카테고리가 아닙니다.',
      };
    }
  }

  // 특정 브랜드 제한이 있는 경우
  if (discount.applicableBrands && discount.applicableBrands.length > 0) {
    if (!productBrand || !discount.applicableBrands.includes(productBrand)) {
      return {
        isEligible: false,
        reason: '할인 대상 브랜드가 아닙니다.',
      };
    }
  }

  return { isEligible: true };
}

/**
 * 최소 구매 조건 체크 (장바구니 전체 기준)
 */
export function checkMinimumPurchase(
  discount: IDiscountRule,
  totalAmount: number,
  totalQuantity: number
): DiscountEligibilityResult {
  const warnings: string[] = [];

  if (discount.minPurchaseAmount && totalAmount < discount.minPurchaseAmount) {
    return {
      isEligible: false,
      reason: `최소 구매 금액 ${discount.minPurchaseAmount.toLocaleString()}원 미만입니다.`,
    };
  }

  if (discount.minQuantity && totalQuantity < discount.minQuantity) {
    return {
      isEligible: false,
      reason: `최소 구매 수량 ${discount.minQuantity}개 미만입니다.`,
    };
  }

  return { isEligible: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * 종합 할인 적용 가능 여부 체크
 */
export function checkDiscountEligibility(
  discount: IDiscountRule,
  preset: IPreset,
  options?: {
    productBarcode?: string;
    productCategory?: string;
    productBrand?: string;
    totalAmount?: number;
    totalQuantity?: number;
    currentDate?: Date;
  }
): DiscountEligibilityResult {
  const currentDate = options?.currentDate || new Date();
  const warnings: string[] = [];

  // 1. 할인 유효성 체크
  const validityCheck = checkDiscountValidity(discount, currentDate);
  if (!validityCheck.isEligible) {
    return validityCheck;
  }

  // 2. 결제수단 체크
  const paymentCheck = checkPaymentMethodConstraint(discount, preset);
  if (!paymentCheck.isEligible) {
    return paymentCheck;
  }

  // 3. QR 스캐너 요구사항 체크
  const qrCheck = checkQRRequirement(discount, preset);
  if (!qrCheck.isEligible) {
    return qrCheck;
  }

  // 4. 구독/멤버십 요구사항 체크
  const subscriptionCheck = checkSubscriptionRequirement(discount, preset, currentDate);
  if (!subscriptionCheck.isEligible) {
    return subscriptionCheck;
  }

  // 5. 상품 적용 대상 체크 (옵션)
  if (options?.productBarcode) {
    const productCheck = checkProductEligibility(
      discount,
      options.productBarcode,
      options.productCategory,
      options.productBrand
    );
    if (!productCheck.isEligible) {
      return productCheck;
    }
  }

  // 6. 최소 구매 조건 체크 (옵션)
  if (options?.totalAmount !== undefined || options?.totalQuantity !== undefined) {
    const minPurchaseCheck = checkMinimumPurchase(
      discount,
      options.totalAmount || 0,
      options.totalQuantity || 0
    );
    if (!minPurchaseCheck.isEligible) {
      return minPurchaseCheck;
    }
    if (minPurchaseCheck.warnings) {
      warnings.push(...minPurchaseCheck.warnings);
    }
  }

  return {
    isEligible: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 여러 할인 규칙 중 프리셋으로 적용 가능한 것들만 필터링
 */
export function filterEligibleDiscounts(
  discounts: IDiscountRule[],
  preset: IPreset,
  options?: {
    productBarcode?: string;
    productCategory?: string;
    productBrand?: string;
    totalAmount?: number;
    totalQuantity?: number;
    currentDate?: Date;
  }
): IDiscountRule[] {
  return discounts.filter((discount) => {
    const result = checkDiscountEligibility(discount, preset, options);
    return result.isEligible;
  });
}

/**
 * 할인별 적용 가능 여부를 맵으로 반환
 */
export function getDiscountEligibilityMap(
  discounts: IDiscountRule[],
  preset: IPreset,
  options?: {
    productBarcode?: string;
    productCategory?: string;
    productBrand?: string;
    totalAmount?: number;
    totalQuantity?: number;
    currentDate?: Date;
  }
): Map<string, DiscountEligibilityResult> {
  const map = new Map<string, DiscountEligibilityResult>();

  for (const discount of discounts) {
    const result = checkDiscountEligibility(discount, preset, options);
    map.set(String(discount._id), result);
  }

  return map;
}
