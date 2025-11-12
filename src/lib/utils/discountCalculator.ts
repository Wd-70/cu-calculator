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
  CartLevelDiscount,
  DISCOUNT_CATEGORY_ORDER,
  PaymentMethodRequirement,
  CardIssuerRequirement,
  PaymentMethodException,
  getConstraints,
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
  config: Extract<DiscountConfig, { category: 'coupon' }>,
  maxDiscountAmount?: number
): number {
  let discount = 0;

  if (config.valueType === 'percentage' && config.percentage) {
    // 퍼센트 방식
    discount = Math.floor(originalPrice * (config.percentage / 100));
  } else if (config.valueType === 'fixed_amount' && config.fixedAmount) {
    // 고정 금액 방식
    discount = Math.min(originalPrice, config.fixedAmount);
  } else if (config.valueType === 'unit_price' && config.unitPrice) {
    // 단품 특가 방식: 정가 - 특가 = 할인액
    discount = Math.max(0, originalPrice - config.unitPrice);
  }

  // 최대 할인 금액 제한 적용
  if (maxDiscountAmount && discount > maxDiscountAmount) {
    discount = maxDiscountAmount;
  }

  return discount;
}

/**
 * 통신사 할인 계산
 * @param baseAmount - 할인 계산 기준 금액 (baseAmountType에 따라 정가 또는 프로모션 적용 후 금액)
 * @param config - 통신사 할인 설정
 * @param maxDiscountAmount - 최대 할인 금액 제한
 */
function calculateTelecomDiscount(
  baseAmount: number,
  config: Extract<DiscountConfig, { category: 'telecom' }>,
  maxDiscountAmount?: number
): number {
  let discount = 0;

  if (config.valueType === 'percentage' && config.percentage) {
    // 퍼센트 방식: 20%
    discount = Math.floor(baseAmount * (config.percentage / 100));
  } else if (
    config.valueType === 'tiered_amount' &&
    config.tierUnit &&
    config.tierAmount
  ) {
    // 구간 방식: 1천원당 300원
    const tiers = Math.floor(baseAmount / config.tierUnit);
    discount = tiers * config.tierAmount;
  }

  // 월 최대 할인 금액 제한 적용 (단일 구매 기준)
  if (config.maxDiscountPerMonth && discount > config.maxDiscountPerMonth) {
    discount = config.maxDiscountPerMonth;
  }

  // 할인 규칙 레벨의 최대 할인 금액 제한 적용
  if (maxDiscountAmount && discount > maxDiscountAmount) {
    discount = maxDiscountAmount;
  }

  return discount;
}

/**
 * 결제행사 할인 계산
 * @param originalPrice - 정가
 * @param currentAmount - 현재 금액 (이전 할인 적용 후)
 * @param config - 할인 설정
 * @param maxDiscountAmount - 최대 할인 금액 제한
 */
function calculatePaymentEventDiscount(
  originalPrice: number,
  currentAmount: number,
  config: Extract<DiscountConfig, { category: 'payment_event' }>,
  maxDiscountAmount?: number
): number {
  // 기준 금액 결정 (기본값: 프로모션 적용 후 기준)
  const baseAmount = config.baseAmountType === 'original_price'
    ? originalPrice
    : currentAmount;  // 기본값을 currentAmount로 변경

  let discount = 0;

  if (config.valueType === 'percentage' && config.percentage) {
    // 퍼센트 방식: 40%
    discount = Math.floor(baseAmount * (config.percentage / 100));
    // 10원 단위로 올림 처리 (실제 영수증 기준)
    discount = Math.ceil(discount / 10) * 10;
  } else if (config.valueType === 'fixed_amount' && config.fixedAmount) {
    // 고정 금액 방식: 1000원
    discount = Math.min(baseAmount, config.fixedAmount);
  }

  // 최대 할인 금액 제한 적용
  if (maxDiscountAmount && discount > maxDiscountAmount) {
    discount = maxDiscountAmount;
  }

  return discount;
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
  config: Extract<DiscountConfig, { category: 'payment_instant' }>,
  maxDiscountAmount?: number
): number {
  let discount = Math.floor(originalPrice * (config.percentage / 100));

  // 최대 할인 금액 제한 적용
  if (maxDiscountAmount && discount > maxDiscountAmount) {
    discount = maxDiscountAmount;
  }

  return discount;
}

/**
 * 결제 할인(누적형) 계산 (누적 할인 후 금액 기준!)
 */
function calculatePaymentCompoundDiscount(
  remainingAmount: number,
  config: Extract<DiscountConfig, { category: 'payment_compound' }>,
  maxDiscountAmount?: number
): number {
  let discount = Math.floor(remainingAmount * (config.percentage / 100));

  // 최대 할인 금액 제한 적용
  if (maxDiscountAmount && discount > maxDiscountAmount) {
    discount = maxDiscountAmount;
  }

  return discount;
}

/**
 * 프로모션 할인 계산 (1+1, 2+1 등)
 * @param unitPrice - 상품 단가
 * @param quantity - 구매 수량
 * @param config - 프로모션 설정
 * @returns 할인 금액
 */
function calculatePromotionDiscount(
  unitPrice: number,
  quantity: number,
  config: Extract<DiscountConfig, { category: 'promotion' }>
): number {
  const { buyQuantity, getQuantity, giftSelectionType } = config;

  // 콤보 프로모션인 경우 0 반환 (장바구니 레벨에서 처리)
  if (giftSelectionType === 'combo') {
    console.log(`  [콤보 프로모션] 장바구니 레벨에서 처리 필요`);
    return 0;
  }

  // Same 프로모션 (같은 상품 증정)
  const setSize = buyQuantity + getQuantity; // 1+1이면 2, 2+1이면 3

  // 프로모션 적용 가능 세트 수
  const setsApplied = Math.floor(quantity / setSize);

  // 무료로 받는 상품 개수
  const freeItems = setsApplied * getQuantity;

  // 할인 금액 = 무료 상품 가격
  return freeItems * unitPrice;
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
  currentDate: Date = new Date(),
  verbose: boolean = false, // 상세 로그 출력 여부
  crossPromotionDiscount: number = 0 // 크로스 프로모션 할인액 (장바구니 레벨에서 계산됨)
): DiscountCalculationResultV2 {
  const steps: DiscountApplicationStep[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. 필터링: 유효하고 적용 가능한 할인만 선택
  const applicableDiscounts = discounts.filter((discount) => {
    if (verbose) {
      console.log(`[할인 검증] ${discount.name} (${discount.config.category})`);
    }

    // 활성화 및 날짜 체크
    if (!isDiscountValid(discount, currentDate)) {
      if (verbose) {
        console.log(`  ❌ 유효하지 않음 (날짜/활성화)`);
      }
      warnings.push(
        `'${discount.name}' 할인은 현재 사용할 수 없습니다. (유효기간 확인)`
      );
      return false;
    }

    // 프로모션은 결제수단 체크 스킵
    if (discount.config.category !== 'promotion') {
      // 결제수단 체크
      if (!isPaymentMethodCompatible(discount, paymentMethod)) {
        if (verbose) {
          console.log(`  ❌ 결제수단 불일치`);
        }
        warnings.push(
          `'${discount.name}' 할인은 선택한 결제수단으로 사용할 수 없습니다.`
        );
        return false;
      }
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
      if (verbose) {
        console.log(`  ❌ 상품 적용 대상 불일치 (바코드: ${productBarcode})`);
      }
      warnings.push(`'${discount.name}' 할인은 이 상품에 적용할 수 없습니다.`);
      return false;
    }

    if (verbose) {
      console.log(`  ✅ 적용 가능`);
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

  // 4-1. 프로모션 할인 (가장 먼저 적용)
  // Same 프로모션 (1+1, 2+1 등)
  const samePromotionAmount = sortedDiscounts
    .filter((d) => d.config.category === 'promotion')
    .reduce((sum, d) => {
      return (
        sum +
        calculatePromotionDiscount(
          unitPrice,
          quantity,
          d.config as Extract<DiscountConfig, { category: 'promotion' }>
        )
      );
    }, 0);

  // 전체 프로모션 할인 = Same 프로모션 + 크로스 프로모션
  const promotionAmount = samePromotionAmount + crossPromotionDiscount;

  // 프로모션 적용 후 금액
  if (promotionAmount > 0) {
    currentAmount -= promotionAmount;

    // Same 프로모션 스텝 추가
    sortedDiscounts
      .filter((d) => d.config.category === 'promotion')
      .forEach((d) => {
        const amount = calculatePromotionDiscount(
          unitPrice,
          quantity,
          d.config as Extract<DiscountConfig, { category: 'promotion' }>
        );
        if (amount > 0) {
          const config = d.config as Extract<DiscountConfig, { category: 'promotion' }>;
          steps.push({
            category: 'promotion',
            discountId: d._id,
            discountName: d.name,
            baseAmount: originalPrice,
            isOriginalPriceBased: true,
            discountAmount: amount,
            amountAfterDiscount: currentAmount,
            calculationDetails: `${config.promotionType} 프로모션`,
          });
        }
      });

    // 크로스 프로모션 스텝 추가 (장바구니 레벨에서 계산된 것)
    if (crossPromotionDiscount > 0) {
      steps.push({
        category: 'promotion',
        discountName: '크로스 프로모션',
        baseAmount: originalPrice,
        isOriginalPriceBased: true,
        discountAmount: crossPromotionDiscount,
        amountAfterDiscount: currentAmount,
        calculationDetails: `크로스 증정 프로모션`,
      });
    }
  }

  // 프로모션 적용 후 금액을 새로운 기준가로 설정
  // 이후 모든 할인은 이 금액을 기준으로 계산됨
  const adjustedBasePrice = currentAmount;

  // 프로모션 적용 후 금액 기준으로 할인액 계산
  const couponAmount = sortedDiscounts
    .filter((d) => d.config.category === 'coupon')
    .reduce((sum, d) => {
      return (
        sum +
        calculateCouponDiscount(
          adjustedBasePrice,
          d.config as Extract<DiscountConfig, { category: 'coupon' }>,
          getConstraints(d).maxDiscountAmount
        )
      );
    }, 0);

  const telecomAmount = sortedDiscounts
    .filter((d) => d.config.category === 'telecom')
    .reduce((sum, d) => {
      const config = d.config as Extract<DiscountConfig, { category: 'telecom' }>;
      // baseAmountType에 따라 기준 금액 결정
      // 기본값은 'after_promotion' (프로모션 적용 후 금액 기준)
      const baseAmount = config.baseAmountType === 'original_price'
        ? originalPrice
        : adjustedBasePrice;

      return (
        sum +
        calculateTelecomDiscount(
          baseAmount,
          config,
          getConstraints(d).maxDiscountAmount
        )
      );
    }, 0);

  // 결제행사 할인 (프로모션 적용 후 금액 기준)
  const paymentEventAmount = sortedDiscounts
    .filter((d) => d.config.category === 'payment_event')
    .reduce((sum, d) => {
      return (
        sum +
        calculatePaymentEventDiscount(
          originalPrice,
          adjustedBasePrice, // 프로모션 적용 후 금액 기준
          d.config as Extract<DiscountConfig, { category: 'payment_event' }>,
          getConstraints(d).maxDiscountAmount
        )
      );
    }, 0);

  // 결제 할인(독립형) (프로모션 적용 후 금액 기준)
  const paymentInstantAmount = sortedDiscounts
    .filter((d) => d.config.category === 'payment_instant')
    .reduce((sum, d) => {
      return (
        sum +
        calculatePaymentInstantDiscount(
          adjustedBasePrice,
          d.config as Extract<DiscountConfig, { category: 'payment_instant' }>,
          getConstraints(d).maxDiscountAmount
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
          adjustedBasePrice,
          d.config as Extract<DiscountConfig, { category: 'coupon' }>,
          getConstraints(d).maxDiscountAmount
        );
        if (amount > 0) {  // 할인액이 있을 때만 step 추가
          steps.push({
            category: 'coupon',
            discountId: d._id,
            discountName: d.name,
            baseAmount: adjustedBasePrice,
            isOriginalPriceBased: promotionAmount > 0 ? false : true,
            discountAmount: amount,
            amountAfterDiscount: adjustedBasePrice - amount,  // 개별 할인액만 차감
            calculationDetails: `${(d.config as any).percentage}% 할인${promotionAmount > 0 ? ' (프로모션 적용 후 기준)' : ''}${getConstraints(d).maxDiscountAmount ? ` (최대 ${getConstraints(d).maxDiscountAmount.toLocaleString()}원)` : ''}`,
          });
        }
      });
  }

  // 5-2. 통신사 할인
  if (telecomAmount > 0) {
    currentAmount -= telecomAmount;
    sortedDiscounts
      .filter((d) => d.config.category === 'telecom')
      .forEach((d) => {
        const config = d.config as Extract<
          DiscountConfig,
          { category: 'telecom' }
        >;

        // baseAmountType에 따라 기준 금액 결정 (기본값: after_promotion)
        const baseAmount = config.baseAmountType === 'original_price'
          ? originalPrice
          : adjustedBasePrice;

        const amount = calculateTelecomDiscount(
          baseAmount,
          config,
          getConstraints(d).maxDiscountAmount
        );
        if (amount > 0) {  // 할인액이 있을 때만 step 추가
          // 기준 금액 설명
          const baseAmountDesc = config.baseAmountType === 'original_price'
            ? '정가 기준'
            : (promotionAmount > 0 ? '프로모션 적용 후 기준' : '');

          const detail =
            config.valueType === 'percentage'
              ? `${config.percentage}% 할인${baseAmountDesc ? ` (${baseAmountDesc})` : ''}`
              : `${config.tierUnit}원당 ${config.tierAmount}원 할인${baseAmountDesc ? ` (${baseAmountDesc})` : ''}`;

          const limitInfo = [];
          if (config.maxDiscountPerMonth) limitInfo.push(`월 최대 ${config.maxDiscountPerMonth.toLocaleString()}원`);
          if (getConstraints(d).maxDiscountAmount) limitInfo.push(`최대 ${getConstraints(d).maxDiscountAmount.toLocaleString()}원`);
          const limitText = limitInfo.length > 0 ? ` (${limitInfo.join(', ')})` : '';

          steps.push({
            category: 'telecom',
            discountId: d._id,
            discountName: d.name,
            baseAmount: baseAmount,
            isOriginalPriceBased: config.baseAmountType === 'original_price' || (promotionAmount === 0),
            discountAmount: amount,
            amountAfterDiscount: baseAmount - amount,  // 개별 할인액만 차감
            calculationDetails: detail + limitText,
          });
        }
      });
  }

  // 5-3. 결제행사 할인
  // 프로모션 적용 후 금액 기준 할인
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
          adjustedBasePrice, // 프로모션 적용 후 기준
          d.config as Extract<DiscountConfig, { category: 'payment_event' }>,
          getConstraints(d).maxDiscountAmount
        );
        if (amount > 0) {  // 할인액이 있을 때만 step 추가
          const config = d.config as Extract<
            DiscountConfig,
            { category: 'payment_event' }
          >;
          const detail =
            config.valueType === 'percentage'
              ? `${config.percentage}% 할인${promotionAmount > 0 ? ' (프로모션 적용 후 기준)' : ''}`
              : `${config.fixedAmount}원 할인${promotionAmount > 0 ? ' (프로모션 적용 후 기준)' : ''}`;

          steps.push({
            category: 'payment_event',
            discountId: d._id,
            discountName: d.name,
            baseAmount: adjustedBasePrice,
            isOriginalPriceBased: promotionAmount > 0 ? false : true,
            discountAmount: amount,
            amountAfterDiscount: adjustedBasePrice - amount,  // 개별 할인액만 차감
            calculationDetails: detail + (getConstraints(d).maxDiscountAmount ? ` (최대 ${getConstraints(d).maxDiscountAmount.toLocaleString()}원)` : ''),
          });
        }
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
        d.config as Extract<DiscountConfig, { category: 'payment_event' }>,
        getConstraints(d).maxDiscountAmount
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
        calculationDetails: detail + (getConstraints(d).maxDiscountAmount ? ` (최대 ${getConstraints(d).maxDiscountAmount.toLocaleString()}원)` : ''),
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

  // 5-5. 결제 할인(독립형) - 프로모션 적용 후 기준
  if (paymentInstantAmount > 0) {
    currentAmount -= paymentInstantAmount;
    sortedDiscounts
      .filter((d) => d.config.category === 'payment_instant')
      .forEach((d) => {
        const amount = calculatePaymentInstantDiscount(
          adjustedBasePrice,
          d.config as Extract<DiscountConfig, { category: 'payment_instant' }>,
          getConstraints(d).maxDiscountAmount
        );
        if (amount > 0) {  // 할인액이 있을 때만 step 추가
          steps.push({
            category: 'payment_instant',
            discountId: d._id,
            discountName: d.name,
            baseAmount: adjustedBasePrice,
            isOriginalPriceBased: promotionAmount > 0 ? false : true,
            discountAmount: amount,
            amountAfterDiscount: adjustedBasePrice - amount,  // 개별 할인액만 차감
            calculationDetails: `${(d.config as any).percentage}% 할인${promotionAmount > 0 ? ' (프로모션 적용 후 기준)' : ''}${getConstraints(d).maxDiscountAmount ? ` (최대 ${getConstraints(d).maxDiscountAmount.toLocaleString()}원)` : ''}`,
          });
        }
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
        d.config as Extract<DiscountConfig, { category: 'payment_compound' }>,
        getConstraints(d).maxDiscountAmount
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
        calculationDetails: `${(d.config as any).percentage}% 할인 (누적 금액 기준)${getConstraints(d).maxDiscountAmount ? ` (최대 ${getConstraints(d).maxDiscountAmount.toLocaleString()}원)` : ''}`,
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
  const { items, discountSelections, paymentMethod, currentDate, verbose = false } = options;

  const itemResults: CartItemCalculationResult[] = [];
  const allWarnings: string[] = [];
  const allErrors: string[] = [];

  // ============================================================================
  // 1단계: 크로스 프로모션을 먼저 찾고 계산 (A 구매 시 B 증정)
  // ============================================================================
  if (verbose) {
    console.log('\n[1단계: 크로스 프로모션 검사 시작]');
  }

  // 모든 선택된 할인에서 크로스 프로모션 찾기
  const crossPromotions: Array<{
    promotion: IDiscountRuleV2;
    buyProduct: typeof items[0];
    giftProduct?: typeof items[0];
  }> = [];

  for (const item of items) {
    const productId = item.productId.toString();
    const selection = discountSelections.find(
      (s) => s.productId.toString() === productId
    );

    if (!selection) continue;

    for (const discount of selection.selectedDiscounts) {
      const config = discount.config;
      if (config.category === 'promotion' && config.giftSelectionType === 'combo') {
        // 콤보 프로모션: 현재 상품이 증정 상품인 경우 스킵
        // (구매 상품에서만 프로모션을 트리거해야 함)
        if (config.giftProducts && config.giftProducts.includes(item.productBarcode)) {
          if (verbose) {
            console.log(`[콤보 프로모션 스킵] ${discount.name} - 증정 상품임 (${item.productBarcode})`);
          }
          continue;
        }

        if (verbose) {
          console.log(`[콤보 프로모션 발견] ${discount.name}`);
          console.log(`  구매 상품: ${item.productBarcode} (${item.quantity}개)`);
        }

        // 증정 상품 찾기
        let giftProduct = null;

        // gift products가 지정된 경우
        if (config.giftProducts && config.giftProducts.length > 0) {
          if (verbose) {
            console.log(`  증정 상품 바코드: ${config.giftProducts.join(', ')}`);
          }

          for (const giftBarcode of config.giftProducts) {
            const foundGift = items.find((i) => i.productBarcode === giftBarcode);
            if (foundGift) {
              giftProduct = foundGift;
              if (verbose) {
                console.log(`  ✅ 증정 상품 발견: ${giftBarcode}`);
              }
              break;
            }
          }
        }

        if (giftProduct) {
          crossPromotions.push({
            promotion: discount,
            buyProduct: item,
            giftProduct,
          });
        } else {
          if (verbose) {
            console.log(`  ❌ 증정 상품이 장바구니에 없음`);
          }
          allWarnings.push(
            `'${discount.name}' 프로모션: 증정 상품을 장바구니에 추가하세요.`
          );
        }
      }
    }
  }

  // 콤보 프로모션 할인액 계산 및 저장 (중복 방지)
  const crossPromotionDiscounts = new Map<string, number>(); // productId -> 할인액
  const appliedCrossPromotions = new Set<string>(); // 이미 적용된 프로모션 추적

  for (const { promotion, buyProduct, giftProduct } of crossPromotions) {
    if (!giftProduct) continue;

    // 중복 적용 방지: promotionId_giftProductId 조합으로 체크
    const promotionKey = `${promotion._id}_${giftProduct.productId}`;
    if (appliedCrossPromotions.has(promotionKey)) {
      console.log(`[콤보 프로모션 스킵] ${promotion.name} - 이미 적용됨`);
      continue;
    }

    const config = promotion.config as Extract<DiscountConfig, { category: 'promotion' }>;
    const { buyQuantity, getQuantity } = config;

    // 구매 상품 수량으로 적용 가능 세트 수 계산
    const setsApplied = Math.floor(buyProduct.quantity / buyQuantity);

    if (setsApplied > 0) {
      // 무료로 받을 수 있는 증정 상품 수량
      const freeGifts = Math.min(setsApplied * getQuantity, giftProduct.quantity);

      // 할인 금액 = 증정 상품 가격 × 무료 수량
      const giftDiscount = giftProduct.unitPrice * freeGifts;

      // 콤보 프로모션 적용 로그는 항상 출력 (디버깅용)
      console.log(`[콤보 프로모션 계산] ${promotion.name}`);
      console.log(`  구매: ${buyProduct.productBarcode} ${buyProduct.quantity}개`);
      console.log(`  증정: ${giftProduct.productBarcode} ${freeGifts}개 무료`);
      console.log(`  할인 금액: ${giftDiscount}원`);

      // 증정 상품의 할인액 저장
      const giftProductId = giftProduct.productId.toString();
      const existingDiscount = crossPromotionDiscounts.get(giftProductId) || 0;
      crossPromotionDiscounts.set(giftProductId, existingDiscount + giftDiscount);

      // 적용 완료 표시
      appliedCrossPromotions.add(promotionKey);
    } else {
      if (verbose) {
        console.log(`  ❌ 구매 수량 부족 (${buyProduct.quantity}개 < ${buyQuantity}개)`);
      }
      allWarnings.push(
        `'${promotion.name}' 프로모션: 구매 상품 ${buyQuantity}개 이상 필요`
      );
    }
  }

  // ============================================================================
  // 2단계: 장바구니 레벨 할인 계산 (통신사 할인 등)
  // ============================================================================
  if (verbose) {
    console.log('\n[2단계: 장바구니 레벨 할인 계산]');
  }

  // 장바구니 레벨 할인 결과 저장
  const cartLevelDiscounts: CartLevelDiscount[] = [];

  // 모든 상품에서 선택된 통신사 할인 찾기 (calculationLevel이 'cart'인 경우)
  const cartLevelTelecomDiscounts = new Set<string>(); // discountId 저장

  for (const item of items) {
    const productId = item.productId.toString();
    const selection = discountSelections.find(
      (s) => s.productId.toString() === productId
    );

    if (!selection) continue;

    for (const discount of selection.selectedDiscounts) {
      if (discount.config.category === 'telecom') {
        const config = discount.config as Extract<DiscountConfig, { category: 'telecom' }>;
        // calculationLevel이 'cart'이거나 명시되지 않은 경우 (기본값 'cart')
        if (!config.calculationLevel || config.calculationLevel === 'cart') {
          cartLevelTelecomDiscounts.add(discount._id.toString());
        }
      }
    }
  }

  // 장바구니 레벨 통신사 할인 계산
  for (const discountId of cartLevelTelecomDiscounts) {
    // 할인 정보 찾기
    let discount: IDiscountRuleV2 | undefined;
    for (const item of items) {
      const productId = item.productId.toString();
      const selection = discountSelections.find(
        (s) => s.productId.toString() === productId
      );
      if (selection) {
        discount = selection.selectedDiscounts.find((d) => d._id.toString() === discountId);
        if (discount) break;
      }
    }

    if (!discount) continue;

    const config = discount.config as Extract<DiscountConfig, { category: 'telecom' }>;

    // 프로모션 증정 상품인지 확인하는 함수
    const isGiftProduct = (productId: string): { isGift: boolean; giftType?: 'same' | 'cross' | 'combo' } => {
      // Combo/Cross 프로모션 증정 상품인지 확인
      if (crossPromotionDiscounts.has(productId) && crossPromotionDiscounts.get(productId)! > 0) {
        // 이 상품이 어떤 프로모션의 증정 상품인지 확인
        const matchingPromotion = crossPromotions.find(cp =>
          cp.giftProduct?.productId.toString() === productId
        );

        if (matchingPromotion) {
          const promoConfig = matchingPromotion.promotion.config as Extract<DiscountConfig, { category: 'promotion' }>;
          return { isGift: true, giftType: promoConfig.giftSelectionType as 'cross' | 'combo' };
        }

        // 프로모션을 찾지 못한 경우 기본값 'cross' (이전 동작 유지)
        return { isGift: true, giftType: 'cross' };
      }

      // Same 프로모션 증정 상품인지 확인 (할인액이 상품 가격의 일부인 경우)
      const item = items.find((i) => i.productId.toString() === productId);
      if (item) {
        const selection = discountSelections.find(
          (s) => s.productId.toString() === productId
        );
        const samePromotion = selection?.selectedDiscounts.find(
          (d) => d.config.category === 'promotion'
        );
        if (samePromotion) {
          const config = samePromotion.config as Extract<DiscountConfig, { category: 'promotion' }>;
          if (config.giftSelectionType === 'same') {
            return { isGift: true, giftType: 'same' };
          }
        }
      }

      return { isGift: false };
    };

    // 장바구니 전체 금액 계산 (프로모션 적용 후, 프로모션 조합 규칙 체크)
    let totalOriginal = 0;
    let totalAfterPromotion = 0;
    const eligibleItemsForTelecom: typeof items = [];
    const promotionDiscountByProductId = new Map<string, number>(); // 각 상품의 프로모션 할인액 저장

    for (const item of items) {
      const productId = item.productId.toString();
      const itemOriginalPrice = item.unitPrice * item.quantity;

      // 이 상품이 통신사 할인 대상인지 확인
      const selection = discountSelections.find(
        (s) => s.productId.toString() === productId
      );

      // 통신사 할인이 선택되지 않은 상품은 제외
      const hasThisTelecomDiscount = selection?.selectedDiscounts.some(
        (d) => d._id.toString() === discountId
      );
      if (!hasThisTelecomDiscount) {
        continue;
      }

      // 프로모션 조합 규칙 체크
      const giftInfo = isGiftProduct(productId);
      if (giftInfo.isGift && discount.combinationRules?.cannotCombineWithPromotionGiftTypes) {
        const blockedTypes = discount.combinationRules.cannotCombineWithPromotionGiftTypes;
        if (blockedTypes.includes(giftInfo.giftType!)) {
          if (verbose) {
            console.log(`  [제외] ${item.productBarcode} - ${giftInfo.giftType} 프로모션 증정 상품`);
          }
          continue;
        }
      }

      eligibleItemsForTelecom.push(item);
      totalOriginal += itemOriginalPrice;

      // 이 상품에 적용된 프로모션 할인 계산
      const crossPromotionDiscount = crossPromotionDiscounts.get(productId) || 0;

      // Same 프로모션 할인 계산
      const samePromotionDiscount = selection?.selectedDiscounts
        .filter((d) => d.config.category === 'promotion')
        .reduce((sum, d) => {
          return (
            sum +
            calculatePromotionDiscount(
              item.unitPrice,
              item.quantity,
              d.config as Extract<DiscountConfig, { category: 'promotion' }>
            )
          );
        }, 0) || 0;

      const totalPromotionDiscount = samePromotionDiscount + crossPromotionDiscount;
      promotionDiscountByProductId.set(productId, totalPromotionDiscount);

      totalAfterPromotion += (itemOriginalPrice - totalPromotionDiscount);
    }

    // baseAmountType에 따라 기준 금액 결정 (기본값: after_promotion)
    // - 'original_price': 정가 기준
    // - 'after_promotion' 또는 undefined: 프로모션 적용 후 기준 (기본값)
    const baseAmount = config.baseAmountType === 'original_price'
      ? totalOriginal
      : totalAfterPromotion;

    // 통신사 할인 계산
    const totalTelecomDiscount = calculateTelecomDiscount(
      baseAmount,
      config,
      getConstraints(discount).maxDiscountAmount
    );

    if (verbose) {
      console.log(`[장바구니 레벨 통신사 할인] ${discount.name}`);
      console.log(`  기준 금액: ${baseAmount.toLocaleString()}원`);
      console.log(`  할인 금액: ${totalTelecomDiscount.toLocaleString()}원`);
    }

    // 기준 금액 설명
    const baseAmountDesc = config.baseAmountType === 'original_price'
      ? '정가 기준'
      : '프로모션 적용 후 기준';

    const detail =
      config.valueType === 'percentage'
        ? `${config.percentage}% 할인`
        : `${config.tierUnit}원당 ${config.tierAmount}원 할인`;

    const limitInfo = [];
    if (config.maxDiscountPerMonth) limitInfo.push(`월 최대 ${config.maxDiscountPerMonth.toLocaleString()}원`);
    if (getConstraints(discount).maxDiscountAmount) limitInfo.push(`최대 ${getConstraints(discount).maxDiscountAmount.toLocaleString()}원`);
    const limitText = limitInfo.length > 0 ? ` (${limitInfo.join(', ')})` : '';

    // 장바구니 레벨 할인 결과 저장 (배분 없음)
    cartLevelDiscounts.push({
      discountId: discount._id,
      discountName: discount.name,
      category: 'telecom',
      baseAmount,
      baseAmountDescription: baseAmountDesc,
      discountAmount: totalTelecomDiscount,
      applicableItems: eligibleItemsForTelecom.map((item) => {
        const productId = item.productId.toString();
        const itemAmount = item.unitPrice * item.quantity;
        const promotionDiscount = promotionDiscountByProductId.get(productId) || 0;
        const itemAmountAfterPromotion = itemAmount - promotionDiscount;

        return {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemAmount,
          promotionDiscount: promotionDiscount > 0 ? promotionDiscount : undefined,
          itemAmountAfterPromotion: promotionDiscount > 0 ? itemAmountAfterPromotion : undefined,
        };
      }),
      calculationDetails: detail + limitText,
    });
  }

  // ============================================================================
  // 3단계: 각 상품별 할인 계산 (장바구니 레벨 할인 제외)
  // ============================================================================
  if (verbose) {
    console.log('\n[3단계: 각 상품별 할인 계산]');
  }

  for (const item of items) {
    const productId = item.productId.toString();
    const productBarcode = item.productBarcode;

    // 이 상품에 대한 할인 선택 찾기
    const selection = discountSelections.find(
      (s) => s.productId.toString() === productId
    );

    // 장바구니 레벨 할인 제외
    const discounts = (selection?.selectedDiscounts || []).filter((d) => {
      if (d.config.category === 'telecom') {
        const config = d.config as Extract<DiscountConfig, { category: 'telecom' }>;
        // calculationLevel이 'cart'이거나 명시되지 않은 경우 제외
        if (!config.calculationLevel || config.calculationLevel === 'cart') {
          return false;
        }
      }
      return true;
    });

    // 상품 총액 (단가 × 수량)
    const itemOriginalPrice = item.unitPrice * item.quantity;

    // 크로스 프로모션 할인액 가져오기
    const crossPromotionDiscount = crossPromotionDiscounts.get(productId) || 0;

    // 할인 계산 (verbose 플래그 및 크로스 프로모션 할인 전달)
    const calculation = calculateDiscountForItem(
      itemOriginalPrice,
      item.unitPrice,
      item.quantity,
      discounts,
      productBarcode, // 바코드 사용
      item.productCategory,
      item.productBrand,
      paymentMethod,
      currentDate,
      verbose,
      crossPromotionDiscount // 크로스 프로모션 할인액 전달
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

  // 전체 합계 계산 (장바구니 레벨 할인 포함)
  const totalOriginalPrice = itemResults.reduce(
    (sum, item) => sum + item.itemOriginalPrice,
    0
  );

  // 아이템 레벨 할인 합계
  const itemLevelFinalPrice = itemResults.reduce(
    (sum, item) => sum + item.itemFinalPrice,
    0
  );

  // 장바구니 레벨 할인 합계
  const cartLevelDiscountTotal = cartLevelDiscounts.reduce(
    (sum, discount) => sum + discount.discountAmount,
    0
  );

  // 최종 금액 = 아이템 레벨 할인 후 금액 - 장바구니 레벨 할인
  const totalFinalPrice = itemLevelFinalPrice - cartLevelDiscountTotal;
  const totalDiscount = totalOriginalPrice - totalFinalPrice;
  const totalDiscountRate =
    totalOriginalPrice > 0 ? totalDiscount / totalOriginalPrice : 0;

  return {
    items: itemResults,
    cartLevelDiscounts: cartLevelDiscounts.length > 0 ? cartLevelDiscounts : undefined,
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
