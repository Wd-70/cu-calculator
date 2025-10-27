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
  PaymentMethodRequirement,
  CardIssuerRequirement,
  PaymentMethodException,
} from '@/types/discount';
import { PaymentMethod } from '@/types/payment';
import { PaymentMethodInfo } from '@/types/preset';

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
  let discount = 0;

  if (config.valueType === 'percentage' && config.percentage) {
    // 퍼센트 방식: 20%
    discount = Math.floor(originalPrice * (config.percentage / 100));
  } else if (
    config.valueType === 'tiered_amount' &&
    config.tierUnit &&
    config.tierAmount
  ) {
    // 구간 방식: 1천원당 300원
    const tiers = Math.floor(originalPrice / config.tierUnit);
    discount = tiers * config.tierAmount;
  }

  // 월 최대 할인 금액 제한 적용 (단일 구매 기준)
  if (config.maxDiscountPerMonth && discount > config.maxDiscountPerMonth) {
    discount = config.maxDiscountPerMonth;
  }

  return discount;
}

/**
 * 결제행사 할인 계산
 * @param originalPrice - 정가
 * @param currentAmount - 현재 금액 (이전 할인 적용 후)
 * @param config - 할인 설정
 */
function calculatePaymentEventDiscount(
  originalPrice: number,
  currentAmount: number,
  config: Extract<DiscountConfig, { category: 'payment_event' }>
): number {
  // 기준 금액 결정 (기본값: 정가 기준)
  const baseAmount = config.baseAmountType === 'current_amount'
    ? currentAmount
    : originalPrice;

  if (config.valueType === 'percentage' && config.percentage) {
    // 퍼센트 방식: 40%
    return Math.floor(baseAmount * (config.percentage / 100));
  } else if (config.valueType === 'fixed_amount' && config.fixedAmount) {
    // 고정 금액 방식: 1000원
    return Math.min(baseAmount, config.fixedAmount);
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
 * 할인이 결제수단과 호환되는지 확인 (레거시)
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

/**
 * 결제수단 예외 조건과 사용자 결제정보가 매칭되는지 확인
 */
function matchesPaymentException(
  exception: PaymentMethodException,
  paymentInfo: PaymentMethodInfo
): boolean {
  // 결제수단이 다르면 매칭 안됨
  if (exception.method !== paymentInfo.method) {
    return false;
  }

  // 채널 확인 (지정된 경우)
  if (exception.channel !== undefined) {
    if (exception.channel !== paymentInfo.channel) {
      return false;
    }
  }

  // 카드사 확인 (지정된 경우)
  if (exception.cardIssuer !== undefined) {
    if (exception.cardIssuer !== paymentInfo.cardIssuer) {
      return false;
    }
  }

  // 카드 종류 확인 (지정된 경우)
  if (exception.cardType !== undefined) {
    if (exception.cardType !== paymentInfo.cardType) {
      return false;
    }
  }

  // BC카드 여부 확인 (지정된 경우)
  if (exception.isBCCard !== undefined) {
    if (exception.isBCCard !== paymentInfo.isBCCard) {
      return false;
    }
  }

  return true;
}

/**
 * 카드 발급사 요구사항과 사용자 카드 정보가 호환되는지 확인
 */
function isCardIssuerCompatible(
  requirement: CardIssuerRequirement,
  paymentInfo: PaymentMethodInfo
): { compatible: boolean; reason?: string } {
  // 카드사 확인
  if (paymentInfo.cardIssuer !== requirement.issuer) {
    return { compatible: false, reason: '카드사가 일치하지 않습니다.' };
  }

  // BC카드 요구사항 확인
  if (requirement.requiresBCCard !== undefined) {
    if (requirement.requiresBCCard && !paymentInfo.isBCCard) {
      return { compatible: false, reason: 'BC카드가 필요합니다.' };
    }
    if (!requirement.requiresBCCard && paymentInfo.isBCCard) {
      return { compatible: false, reason: 'BC카드는 제외됩니다.' };
    }
  }

  // 카드 종류 확인
  if (requirement.allowedCardTypes && requirement.allowedCardTypes.length > 0) {
    if (!paymentInfo.cardType) {
      return { compatible: false, reason: '카드 종류 정보가 필요합니다.' };
    }
    if (!requirement.allowedCardTypes.includes(paymentInfo.cardType)) {
      const typeNames: Record<string, string> = {
        personal_credit: '개인 신용카드',
        personal_check: '개인 체크카드',
        corporate: '법인카드',
        prepaid: '선불카드',
        gift: '기프트카드',
      };
      return {
        compatible: false,
        reason: `${typeNames[paymentInfo.cardType] || paymentInfo.cardType}는 이 할인에 사용할 수 없습니다.`,
      };
    }
  }

  // 결제 채널 확인
  if (requirement.allowedChannels && requirement.allowedChannels.length > 0) {
    if (!paymentInfo.channel) {
      return { compatible: false, reason: '결제 채널 정보가 필요합니다.' };
    }
    if (!requirement.allowedChannels.includes(paymentInfo.channel as any)) {
      return { compatible: false, reason: '이 결제 방식은 지원하지 않습니다.' };
    }
  }

  return { compatible: true };
}

/**
 * 할인이 상세한 결제수단 정보와 호환되는지 확인 (신규)
 */
function isPaymentMethodDetailedCompatible(
  discount: IDiscountRuleV2,
  paymentInfo?: PaymentMethodInfo
): { compatible: boolean; reason?: string } {
  // 결제수단 정보가 없으면 통과
  if (!paymentInfo) {
    return { compatible: true };
  }

  // ========================================================================
  // 1단계: 차단 예외 확인 (최우선)
  // ========================================================================
  if (discount.blockedExceptions && discount.blockedExceptions.length > 0) {
    for (const exception of discount.blockedExceptions) {
      if (matchesPaymentException(exception, paymentInfo)) {
        return {
          compatible: false,
          reason: exception.reason || '이 결제 조합은 할인 대상에서 제외됩니다.',
        };
      }
    }
  }

  // ========================================================================
  // 2단계: 허용 예외 확인 (기본 규칙을 덮어씀)
  // ========================================================================
  if (discount.allowedExceptions && discount.allowedExceptions.length > 0) {
    for (const exception of discount.allowedExceptions) {
      if (matchesPaymentException(exception, paymentInfo)) {
        return {
          compatible: true,
          reason: exception.reason,
        };
      }
    }
  }

  // ========================================================================
  // 3단계: 기본 규칙 확인
  // ========================================================================

  // 상세 요구사항이 없으면 레거시 방식으로 확인
  if (!discount.paymentMethodRequirements || discount.paymentMethodRequirements.length === 0) {
    const isCompatible = isPaymentMethodCompatible(discount, paymentInfo.method);
    return {
      compatible: isCompatible,
      reason: isCompatible ? undefined : '지원하지 않는 결제수단입니다.',
    };
  }

  // 복합결제 확인
  const requirement = discount.paymentMethodRequirements.find(
    (req) => req.method === paymentInfo.method
  );

  if (!requirement) {
    return { compatible: false, reason: '지원하지 않는 결제수단입니다.' };
  }

  // 복합결제 제한 확인
  if (requirement.allowMixedPayment === false) {
    // 실제로 복합결제인지 확인하는 로직은 장바구니 레벨에서 처리 필요
    // 여기서는 조건만 표시
  }

  // 카드인 경우 상세 검증
  if (paymentInfo.method === 'card' && requirement.cardRequirements) {
    // 사용자가 선택한 카드가 요구사항 중 하나와 일치하는지 확인
    let matchFound = false;
    let lastReason = '';

    for (const cardReq of requirement.cardRequirements) {
      const result = isCardIssuerCompatible(cardReq, paymentInfo);
      if (result.compatible) {
        matchFound = true;
        break;
      }
      lastReason = result.reason || '';
    }

    if (!matchFound) {
      return {
        compatible: false,
        reason: lastReason || '이 카드는 할인 대상이 아닙니다.',
      };
    }
  }

  // 간편결제인 경우 채널 확인
  if (
    ['samsung_pay', 'naver_pay', 'kakao_pay'].includes(paymentInfo.method) &&
    requirement.allowedChannels
  ) {
    if (!paymentInfo.channel) {
      return { compatible: false, reason: '결제 방법을 선택해주세요.' };
    }
    if (!requirement.allowedChannels.includes(paymentInfo.channel as any)) {
      return {
        compatible: false,
        reason: '이 결제 방법은 할인 대상이 아닙니다.',
      };
    }

    // 간편결제에서 카드를 선택한 경우 카드 검증
    if (paymentInfo.channel === 'card' && requirement.cardRequirements && paymentInfo.cardIssuer) {
      let matchFound = false;
      let lastReason = '';

      for (const cardReq of requirement.cardRequirements) {
        const result = isCardIssuerCompatible(cardReq, paymentInfo);
        if (result.compatible) {
          matchFound = true;
          break;
        }
        lastReason = result.reason || '';
      }

      if (!matchFound) {
        return {
          compatible: false,
          reason: lastReason || '이 카드는 할인 대상이 아닙니다.',
        };
      }
    }
  }

  // 제외된 간편결제 확인
  if (requirement.excludedSimplePayments && requirement.excludedSimplePayments.length > 0) {
    const methodName = paymentInfo.method;
    if (requirement.excludedSimplePayments.includes(methodName)) {
      return { compatible: false, reason: '이 간편결제는 할인 대상에서 제외됩니다.' };
    }
  }

  return { compatible: true };
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

  // payment_event는 baseAmountType에 따라 정가 또는 현재 금액 기준으로 계산
  // current_amount 기준인 경우 순서대로 처리할 때 계산하므로 여기서는 정가 기준만 계산
  const paymentEventAmount = sortedDiscounts
    .filter((d) => {
      const config = d.config as Extract<DiscountConfig, { category: 'payment_event' }>;
      return d.config.category === 'payment_event' &&
             config.baseAmountType !== 'current_amount';
    })
    .reduce((sum, d) => {
      return (
        sum +
        calculatePaymentEventDiscount(
          originalPrice,
          originalPrice, // 정가 기준이므로 originalPrice 전달
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
  // 정가 기준 할인
  if (paymentEventAmount > 0) {
    currentAmount -= paymentEventAmount;
    sortedDiscounts
      .filter((d) => {
        const config = d.config as Extract<DiscountConfig, { category: 'payment_event' }>;
        return d.config.category === 'payment_event' &&
               config.baseAmountType !== 'current_amount';
      })
      .forEach((d) => {
        const amount = calculatePaymentEventDiscount(
          originalPrice,
          originalPrice, // 정가 기준
          d.config as Extract<DiscountConfig, { category: 'payment_event' }>
        );
        const config = d.config as Extract<
          DiscountConfig,
          { category: 'payment_event' }
        >;
        const detail =
          config.valueType === 'percentage'
            ? `${config.percentage}% 할인 (정가 기준)`
            : `${config.fixedAmount}원 할인 (정가 기준)`;

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

  // 현재 금액 기준 할인 (프로모션 적용 후 등)
  const currentAmountBasedPaymentEvents = sortedDiscounts.filter((d) => {
    const config = d.config as Extract<DiscountConfig, { category: 'payment_event' }>;
    return d.config.category === 'payment_event' &&
           config.baseAmountType === 'current_amount';
  });

  if (currentAmountBasedPaymentEvents.length > 0) {
    for (const d of currentAmountBasedPaymentEvents) {
      const beforeAmount = currentAmount;
      const amount = calculatePaymentEventDiscount(
        originalPrice,
        currentAmount, // 현재 금액 기준
        d.config as Extract<DiscountConfig, { category: 'payment_event' }>
      );
      currentAmount -= amount;

      const config = d.config as Extract<
        DiscountConfig,
        { category: 'payment_event' }
      >;
      const detail =
        config.valueType === 'percentage'
          ? `${config.percentage}% 할인 (프로모션 적용 후 기준)`
          : `${config.fixedAmount}원 할인 (프로모션 적용 후 기준)`;

      steps.push({
        category: 'payment_event',
        discountId: d._id,
        discountName: d.name,
        baseAmount: beforeAmount,
        isOriginalPriceBased: false,
        discountAmount: amount,
        amountAfterDiscount: currentAmount,
        calculationDetails: detail,
      });
    }
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

// ============================================================================
// Export utility functions
// ============================================================================

export { isPaymentMethodDetailedCompatible };
