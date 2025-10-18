/**
 * CU 할인 계산 엔진 v2
 * 엑셀 분석 결과를 기반으로 구현된 새로운 할인 계산 로직
 */

import {
  IDiscountRuleV2,
  DiscountConfig,
  DiscountCategory,
  DiscountApplicationStep,
  DiscountCalculationResultV2,
  CartCalculationOptionsV2,
  CartCalculationResultV2,
  CartItemCalculationResult,
  DISCOUNT_CATEGORY_ORDER,
} from '@/types/discount';
import { PaymentMethod } from '@/types/payment';

// ============================================================================
// 개별 할인 계산 함수들
// ============================================================================

/**
 * 쿠폰 할인 계산 (정가 기준)
 */
function calculateCouponDiscount(
  originalPrice: number,
  config: Extract<DiscountConfig, { category: 'coupon' }>
): number {
  return Math.floor(originalPrice * (config.percentage / 100));
}

/**
 * 통신사 할인 계산 (정가 기준)
 */
function calculateTelecomDiscount(
  originalPrice: number,
  config: Extract<DiscountConfig, { category: 'telecom' }>
): number {
  if (config.valueType === 'percentage' && config.percentage) {
    // 퍼센트 방식: 20%
    return Math.floor(originalPrice * (config.percentage / 100));
  } else if (
    config.valueType === 'tiered_amount' &&
    config.tierUnit &&
    config.tierAmount
  ) {
    // 구간 방식: 1천원당 300원
    const tiers = Math.floor(originalPrice / config.tierUnit);
    return tiers * config.tierAmount;
  }
  return 0;
}

/**
 * 결제행사 할인 계산 (정가 기준)
 */
function calculatePaymentEventDiscount(
  originalPrice: number,
  config: Extract<DiscountConfig, { category: 'payment_event' }>
): number {
  if (config.valueType === 'percentage' && config.percentage) {
    // 퍼센트 방식: 40%
    return Math.floor(originalPrice * (config.percentage / 100));
  } else if (config.valueType === 'fixed_amount' && config.fixedAmount) {
    // 고정 금액 방식: 1000원
    return Math.min(originalPrice, config.fixedAmount);
  }
  return 0;
}

/**
 * 금액권 차감 (남은 금액 기준)
 */
function calculateVoucherDiscount(
  remainingAmount: number,
  config: Extract<DiscountConfig, { category: 'voucher' }>
): number {
  // 금액권은 남은 금액보다 클 수 없음
  return Math.min(remainingAmount, config.amount);
}

/**
 * 결제 할인(독립형) 계산 (정가 기준!)
 */
function calculatePaymentInstantDiscount(
  originalPrice: number,
  config: Extract<DiscountConfig, { category: 'payment_instant' }>
): number {
  return Math.floor(originalPrice * (config.percentage / 100));
}

/**
 * 결제 할인(누적형) 계산 (누적 할인 후 금액 기준!)
 */
function calculatePaymentCompoundDiscount(
  remainingAmount: number,
  config: Extract<DiscountConfig, { category: 'payment_compound' }>
): number {
  return Math.floor(remainingAmount * (config.percentage / 100));
}

// ============================================================================
// 할인 적용 가능 여부 검증
// ============================================================================

/**
 * 할인이 상품에 적용 가능한지 확인
 */
function isDiscountApplicableToProduct(
  discount: IDiscountRuleV2,
  productBarcode: string,
  productCategory?: string,
  productBrand?: string
): boolean {
  // 전체 상품 대상
  if (
    discount.applicableProducts.length === 0 &&
    discount.applicableCategories.length === 0
  ) {
    return true;
  }

  // 특정 상품 대상 (바코드로 비교)
  if (
    discount.applicableProducts.length > 0 &&
    discount.applicableProducts.includes(productBarcode)
  ) {
    return true;
  }

  // 특정 카테고리 대상
  if (
    productCategory &&
    discount.applicableCategories.length > 0 &&
    discount.applicableCategories.includes(productCategory)
  ) {
    return true;
  }

  // 특정 브랜드 대상
  if (
    productBrand &&
    discount.applicableBrands &&
    discount.applicableBrands.length > 0 &&
    discount.applicableBrands.includes(productBrand)
  ) {
    return true;
  }

  return false;
}

/**
 * 할인이 현재 유효한지 확인
 */
function isDiscountValid(
  discount: IDiscountRuleV2,
  currentDate: Date
): boolean {
  if (!discount.isActive) return false;

  const validFrom = new Date(discount.validFrom);
  const validTo = new Date(discount.validTo);

  return currentDate >= validFrom && currentDate <= validTo;
}

/**
 * 할인이 결제수단과 호환되는지 확인
 */
function isPaymentMethodCompatible(
  discount: IDiscountRuleV2,
  paymentMethod?: PaymentMethod
): boolean {
  if (!paymentMethod) return true;

  if (
    !discount.requiredPaymentMethods ||
    discount.requiredPaymentMethods.length === 0
  ) {
    return true;
  }

  return discount.requiredPaymentMethods.includes(paymentMethod);
}

// ============================================================================
// 할인 중복 검증
// ============================================================================

/**
 * 두 할인이 함께 사용 가능한지 확인
 */
function canCombineDiscounts(
  discount1: IDiscountRuleV2,
  discount2: IDiscountRuleV2
): { canCombine: boolean; reason?: string } {
  const id1 = discount1._id.toString();
  const id2 = discount2._id.toString();

  // 1. 같은 카테고리는 중복 불가 (기본 규칙)
  if (discount1.config.category === discount2.config.category) {
    return {
      canCombine: false,
      reason: `같은 카테고리의 할인은 중복 적용할 수 없습니다.`,
    };
  }

  // 2. 명시적으로 중복 불가 설정된 경우
  if (
    discount1.cannotCombineWithIds?.some((id) => id.toString() === id2) ||
    discount2.cannotCombineWithIds?.some((id) => id.toString() === id1)
  ) {
    return {
      canCombine: false,
      reason: `이 할인들은 함께 사용할 수 없습니다.`,
    };
  }

  // 3. 카테고리 단위 중복 불가
  if (
    discount1.cannotCombineWithCategories?.includes(
      discount2.config.category
    ) ||
    discount2.cannotCombineWithCategories?.includes(discount1.config.category)
  ) {
    return {
      canCombine: false,
      reason: `이 카테고리의 할인들은 함께 사용할 수 없습니다.`,
    };
  }

  // 4. 금액권 + 독립형 할인 중복 불가
  if (
    (discount1.config.category === 'voucher' &&
      discount2.config.category === 'payment_instant') ||
    (discount1.config.category === 'payment_instant' &&
      discount2.config.category === 'voucher')
  ) {
    return {
      canCombine: false,
      reason: `금액권과 결제 할인(독립형)은 함께 사용할 수 없습니다.`,
    };
  }

  // 5. 통신사 할인 특별 규칙
  if (discount1.config.category === 'telecom') {
    const telecomConfig = discount1.config as Extract<
      DiscountConfig,
      { category: 'telecom' }
    >;
    // KT알뜰이 아닌 경우 멤버십과 중복 불가 (추가 구현 필요)
    if (
      !telecomConfig.canCombineWithMembership &&
      discount2.config.category === 'payment_instant'
    ) {
      const instantConfig = discount2.config as Extract<
        DiscountConfig,
        { category: 'payment_instant' }
      >;
      if (instantConfig.isNaverPlus) {
        return {
          canCombine: false,
          reason: `이 통신사 할인은 네이버플러스 멤버십과 함께 사용할 수 없습니다.`,
        };
      }
    }
  }

  // 6. 결제행사 할인 특별 규칙
  if (discount1.config.category === 'payment_event') {
    const eventConfig = discount1.config as Extract<
      DiscountConfig,
      { category: 'payment_event' }
    >;
    if (
      eventConfig.restrictedProviders &&
      discount2.config.category === 'telecom'
    ) {
      const telecomConfig = discount2.config as Extract<
        DiscountConfig,
        { category: 'telecom' }
      >;
      if (eventConfig.restrictedProviders.includes(telecomConfig.provider)) {
        return {
          canCombine: false,
          reason: `이 결제행사는 ${telecomConfig.provider}와 함께 사용할 수 없습니다.`,
        };
      }
    }
  }

  return { canCombine: true };
}

/**
 * 선택된 할인들의 조합이 유효한지 검증
 */
function validateDiscountCombination(
  discounts: IDiscountRuleV2[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 각 할인 쌍에 대해 조합 가능 여부 확인
  for (let i = 0; i < discounts.length; i++) {
    for (let j = i + 1; j < discounts.length; j++) {
      const result = canCombineDiscounts(discounts[i], discounts[j]);
      if (!result.canCombine) {
        errors.push(
          `'${discounts[i].name}'과 '${discounts[j].name}': ${result.reason}`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// 메인 할인 계산 함수
// ============================================================================

/**
 * 단일 상품(수량 포함)에 대한 할인 계산
 */
export function calculateDiscountForItem(
  originalPrice: number, // 단가 × 수량
  unitPrice: number, // 단가
  quantity: number,
  discounts: IDiscountRuleV2[],
  productBarcode: string, // 상품 바코드
  productCategory?: string,
  productBrand?: string,
  paymentMethod?: PaymentMethod,
  currentDate: Date = new Date()
): DiscountCalculationResultV2 {
  const steps: DiscountApplicationStep[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. 필터링: 유효하고 적용 가능한 할인만 선택
  const applicableDiscounts = discounts.filter((discount) => {
    // 활성화 및 날짜 체크
    if (!isDiscountValid(discount, currentDate)) {
      warnings.push(
        `'${discount.name}' 할인은 현재 사용할 수 없습니다. (유효기간 확인)`
      );
      return false;
    }

    // 결제수단 체크
    if (!isPaymentMethodCompatible(discount, paymentMethod)) {
      warnings.push(
        `'${discount.name}' 할인은 선택한 결제수단으로 사용할 수 없습니다.`
      );
      return false;
    }

    // 상품 적용 대상 체크
    if (
      !isDiscountApplicableToProduct(
        discount,
        productBarcode,
        productCategory,
        productBrand
      )
    ) {
      warnings.push(`'${discount.name}' 할인은 이 상품에 적용할 수 없습니다.`);
      return false;
    }

    return true;
  });

  if (applicableDiscounts.length === 0) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      totalDiscount: 0,
      discountRate: 0,
      steps: [],
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // 2. 조합 검증
  const validation = validateDiscountCombination(applicableDiscounts);
  if (!validation.isValid) {
    errors.push(...validation.errors);
  }

  // 3. 카테고리별로 정렬 (적용 순서대로)
  const sortedDiscounts = [...applicableDiscounts].sort((a, b) => {
    const orderA = DISCOUNT_CATEGORY_ORDER[a.config.category];
    const orderB = DISCOUNT_CATEGORY_ORDER[b.config.category];

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 같은 카테고리 내에서는 priority로 정렬
    return (a.priority || 0) - (b.priority || 0);
  });

  // 4. 각 할인 계산 (엑셀 로직 따름)
  let currentAmount = originalPrice;

  // 정가 기준 할인액들을 먼저 계산
  const couponAmount = sortedDiscounts
    .filter((d) => d.config.category === 'coupon')
    .reduce((sum, d) => {
      return (
        sum +
        calculateCouponDiscount(
          originalPrice,
          d.config as Extract<DiscountConfig, { category: 'coupon' }>
        )
      );
    }, 0);

  const telecomAmount = sortedDiscounts
    .filter((d) => d.config.category === 'telecom')
    .reduce((sum, d) => {
      return (
        sum +
        calculateTelecomDiscount(
          originalPrice,
          d.config as Extract<DiscountConfig, { category: 'telecom' }>
        )
      );
    }, 0);

  const paymentEventAmount = sortedDiscounts
    .filter((d) => d.config.category === 'payment_event')
    .reduce((sum, d) => {
      return (
        sum +
        calculatePaymentEventDiscount(
          originalPrice,
          d.config as Extract<DiscountConfig, { category: 'payment_event' }>
        )
      );
    }, 0);

  const paymentInstantAmount = sortedDiscounts
    .filter((d) => d.config.category === 'payment_instant')
    .reduce((sum, d) => {
      return (
        sum +
        calculatePaymentInstantDiscount(
          originalPrice,
          d.config as Extract<DiscountConfig, { category: 'payment_instant' }>
        )
      );
    }, 0);

  // 5. 순차적으로 차감
  // 5-1. 쿠폰 할인
  if (couponAmount > 0) {
    currentAmount -= couponAmount;
    sortedDiscounts
      .filter((d) => d.config.category === 'coupon')
      .forEach((d) => {
        const amount = calculateCouponDiscount(
          originalPrice,
          d.config as Extract<DiscountConfig, { category: 'coupon' }>
        );
        steps.push({
          category: 'coupon',
          discountId: d._id,
          discountName: d.name,
          baseAmount: originalPrice,
          isOriginalPriceBased: true,
          discountAmount: amount,
          amountAfterDiscount: originalPrice - couponAmount,
          calculationDetails: `${(d.config as any).percentage}% 할인`,
        });
      });
  }

  // 5-2. 통신사 할인
  if (telecomAmount > 0) {
    currentAmount -= telecomAmount;
    sortedDiscounts
      .filter((d) => d.config.category === 'telecom')
      .forEach((d) => {
        const amount = calculateTelecomDiscount(
          originalPrice,
          d.config as Extract<DiscountConfig, { category: 'telecom' }>
        );
        const config = d.config as Extract<
          DiscountConfig,
          { category: 'telecom' }
        >;
        const detail =
          config.valueType === 'percentage'
            ? `${config.percentage}% 할인`
            : `${config.tierUnit}원당 ${config.tierAmount}원 할인`;

        steps.push({
          category: 'telecom',
          discountId: d._id,
          discountName: d.name,
          baseAmount: originalPrice,
          isOriginalPriceBased: true,
          discountAmount: amount,
          amountAfterDiscount: currentAmount,
          calculationDetails: detail,
        });
      });
  }

  // 5-3. 결제행사 할인
  if (paymentEventAmount > 0) {
    currentAmount -= paymentEventAmount;
    sortedDiscounts
      .filter((d) => d.config.category === 'payment_event')
      .forEach((d) => {
        const amount = calculatePaymentEventDiscount(
          originalPrice,
          d.config as Extract<DiscountConfig, { category: 'payment_event' }>
        );
        const config = d.config as Extract<
          DiscountConfig,
          { category: 'payment_event' }
        >;
        const detail =
          config.valueType === 'percentage'
            ? `${config.percentage}% 할인`
            : `${config.fixedAmount}원 할인`;

        steps.push({
          category: 'payment_event',
          discountId: d._id,
          discountName: d.name,
          baseAmount: originalPrice,
          isOriginalPriceBased: true,
          discountAmount: amount,
          amountAfterDiscount: currentAmount,
          calculationDetails: detail,
        });
      });
  }

  // 5-4. 금액권 (남은 금액 기준)
  const voucherDiscounts = sortedDiscounts.filter(
    (d) => d.config.category === 'voucher'
  );
  if (voucherDiscounts.length > 0) {
    for (const d of voucherDiscounts) {
      const amount = calculateVoucherDiscount(
        currentAmount,
        d.config as Extract<DiscountConfig, { category: 'voucher' }>
      );
      currentAmount -= amount;

      steps.push({
        category: 'voucher',
        discountId: d._id,
        discountName: d.name,
        baseAmount: currentAmount + amount,
        isOriginalPriceBased: false,
        discountAmount: amount,
        amountAfterDiscount: currentAmount,
        calculationDetails: `${(d.config as any).amount}원 차감`,
      });
    }
  }

  // 5-5. 결제 할인(독립형) - 정가 기준
  if (paymentInstantAmount > 0) {
    currentAmount -= paymentInstantAmount;
    sortedDiscounts
      .filter((d) => d.config.category === 'payment_instant')
      .forEach((d) => {
        const amount = calculatePaymentInstantDiscount(
          originalPrice,
          d.config as Extract<DiscountConfig, { category: 'payment_instant' }>
        );
        steps.push({
          category: 'payment_instant',
          discountId: d._id,
          discountName: d.name,
          baseAmount: originalPrice,
          isOriginalPriceBased: true,
          discountAmount: amount,
          amountAfterDiscount: currentAmount,
          calculationDetails: `${(d.config as any).percentage}% 할인 (정가 기준)`,
        });
      });
  }

  // 5-6. 결제 할인(누적형) - 누적 할인 후 금액 기준
  const compoundDiscounts = sortedDiscounts.filter(
    (d) => d.config.category === 'payment_compound'
  );
  if (compoundDiscounts.length > 0) {
    for (const d of compoundDiscounts) {
      const amount = calculatePaymentCompoundDiscount(
        currentAmount,
        d.config as Extract<DiscountConfig, { category: 'payment_compound' }>
      );
      currentAmount -= amount;

      steps.push({
        category: 'payment_compound',
        discountId: d._id,
        discountName: d.name,
        baseAmount: currentAmount + amount,
        isOriginalPriceBased: false,
        discountAmount: amount,
        amountAfterDiscount: currentAmount,
        calculationDetails: `${(d.config as any).percentage}% 할인 (누적 금액 기준)`,
      });
    }
  }

  // 6. 최종 결과
  const finalPrice = Math.max(0, currentAmount);
  const totalDiscount = originalPrice - finalPrice;
  const discountRate = originalPrice > 0 ? totalDiscount / originalPrice : 0;

  return {
    originalPrice,
    finalPrice,
    totalDiscount,
    discountRate,
    steps,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * 장바구니 전체 계산
 */
export function calculateCart(
  options: CartCalculationOptionsV2
): CartCalculationResultV2 {
  const { items, discountSelections, paymentMethod, currentDate } = options;

  const itemResults: CartItemCalculationResult[] = [];
  const allWarnings: string[] = [];
  const allErrors: string[] = [];

  for (const item of items) {
    const productId = item.productId.toString();
    const productBarcode = item.productBarcode;

    // 이 상품에 대한 할인 선택 찾기
    const selection = discountSelections.find(
      (s) => s.productId.toString() === productId
    );

    const discounts = selection?.selectedDiscounts || [];

    // 상품 총액 (단가 × 수량)
    const itemOriginalPrice = item.unitPrice * item.quantity;

    // 할인 계산
    const calculation = calculateDiscountForItem(
      itemOriginalPrice,
      item.unitPrice,
      item.quantity,
      discounts,
      productBarcode, // 바코드 사용
      item.productCategory,
      item.productBrand,
      paymentMethod,
      currentDate
    );

    itemResults.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      itemOriginalPrice: calculation.originalPrice,
      itemFinalPrice: calculation.finalPrice,
      itemTotalDiscount: calculation.totalDiscount,
      itemDiscountRate: calculation.discountRate,
      calculation,
    });

    // 경고 및 에러 수집
    if (calculation.warnings) {
      allWarnings.push(...calculation.warnings);
    }
    if (calculation.errors) {
      allErrors.push(...calculation.errors);
    }
  }

  // 전체 합계 계산
  const totalOriginalPrice = itemResults.reduce(
    (sum, item) => sum + item.itemOriginalPrice,
    0
  );
  const totalFinalPrice = itemResults.reduce(
    (sum, item) => sum + item.itemFinalPrice,
    0
  );
  const totalDiscount = totalOriginalPrice - totalFinalPrice;
  const totalDiscountRate =
    totalOriginalPrice > 0 ? totalDiscount / totalOriginalPrice : 0;

  return {
    items: itemResults,
    totalOriginalPrice,
    totalFinalPrice,
    totalDiscount,
    totalDiscountRate,
    paymentMethod,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
    errors: allErrors.length > 0 ? allErrors : undefined,
  };
}
