/**
 * 할인 최적화 알고리즘
 * 프리셋 데이터와 장바구니를 기반으로 최적의 할인 조합을 찾음
 *
 * 구조:
 * 1. 프로모션 적용 (개별 상품 단위, 조합 불필요)
 * 2. 할인규칙 조합 최적화 (프로모션 적용 후 가격 기준)
 */

import {
  IDiscountRule,
  DiscountCategory,
  DiscountConfig,
  DISCOUNT_CATEGORY_ORDER,
  getCombinationRules,
  getConstraints
} from '@/types/discount';
import { IPreset } from '@/types/preset';
import { ICartItem } from '@/types/cart';
import { checkDiscountEligibility, filterEligibleDiscounts } from './discountEligibility';
import { calculateCart } from './discountCalculator';
import { applyPromotionsToCart, CartItem } from './promotionApplicator';

/**
 * 할인 조합 결과
 */
export interface DiscountCombination {
  discountIds: string[]; // 선택된 할인 ID 배열
  totalDiscount: number; // 총 할인액
  totalDiscountRate: number; // 총 할인율
  finalPrice: number; // 최종 결제 금액
  originalPrice: number; // 원가
  isOptimal: boolean; // 최적 조합 여부
  warnings?: string[]; // 경고 메시지
  discountBreakdown?: Array<{ // 각 할인별 금액 상세
    discountId: string;
    discountName: string;
    category: string;
    amount: number;
    steps?: any[]; // 계산 과정 단계
    baseAmount?: number; // 기준 금액
  }>;
}

/**
 * 최적화 옵션
 */
export interface OptimizerOptions {
  maxCombinations?: number; // 탐색할 최대 조합 수 (기본: 100)
  includeAlternatives?: boolean; // 대안 조합 포함 여부 (기본: true)
  maxAlternatives?: number; // 최대 대안 조합 수 (기본: 5)
}

/**
 * 할인 충돌 체크
 * 두 할인이 중복 적용 가능한지 확인
 */
export function checkDiscountConflict(
  discount1: IDiscountRule,
  discount2: IDiscountRule
): boolean {
  // 같은 할인은 중복 불가
  if (String(discount1._id) === String(discount2._id)) {
    return true;
  }

  // 할인 결합 규칙 가져오기 (신규 구조 우선, 레거시 폴백)
  const rules1 = getCombinationRules(discount1);
  const rules2 = getCombinationRules(discount2);

  // 1. 카테고리 기반 제약 체크
  if (
    rules1.cannotCombineWithCategories &&
    rules1.cannotCombineWithCategories.includes(discount2.config.category)
  ) {
    return true;
  }

  if (
    rules2.cannotCombineWithCategories &&
    rules2.cannotCombineWithCategories.includes(discount1.config.category)
  ) {
    return true;
  }

  // 2. 개별 할인 ID 기반 제약 체크
  if (
    rules1.cannotCombineWithIds &&
    rules1.cannotCombineWithIds.some((id) => String(id) === String(discount2._id))
  ) {
    return true;
  }

  if (
    rules2.cannotCombineWithIds &&
    rules2.cannotCombineWithIds.some((id) => String(id) === String(discount1._id))
  ) {
    return true;
  }

  // 3. 프로모션 증정방식 기반 제약 체크
  // discount1이 discount2(프로모션)의 giftSelectionType을 제한하는 경우
  if (
    rules1.cannotCombineWithPromotionGiftTypes &&
    discount2.config.category === 'promotion'
  ) {
    const promotionConfig = discount2.config as { giftSelectionType?: 'same' | 'cross' | 'combo' };
    const giftType = promotionConfig.giftSelectionType || 'same'; // 기본값 same

    if (rules1.cannotCombineWithPromotionGiftTypes.includes(giftType)) {
      return true;
    }
  }

  // discount2가 discount1(프로모션)의 giftSelectionType을 제한하는 경우
  if (
    rules2.cannotCombineWithPromotionGiftTypes &&
    discount1.config.category === 'promotion'
  ) {
    const promotionConfig = discount1.config as { giftSelectionType?: 'same' | 'cross' | 'combo' };
    const giftType = promotionConfig.giftSelectionType || 'same'; // 기본값 same

    if (rules2.cannotCombineWithPromotionGiftTypes.includes(giftType)) {
      return true;
    }
  }

  // 4. 통신사 할인의 provider 기반 제약 체크
  if (discount1.config.category === 'telecom' && discount2.config.category === 'telecom') {
    const telecomConfig1 = discount1.config as { provider: string; restrictedProviders?: string[] };
    const telecomConfig2 = discount2.config as { provider: string; restrictedProviders?: string[] };

    if (
      telecomConfig1.restrictedProviders &&
      telecomConfig1.restrictedProviders.includes(telecomConfig2.provider)
    ) {
      return true;
    }

    if (
      telecomConfig2.restrictedProviders &&
      telecomConfig2.restrictedProviders.includes(telecomConfig1.provider)
    ) {
      return true;
    }
  }

  // 충돌 없음
  return false;
}

/**
 * 할인 조합이 유효한지 체크 (충돌 여부)
 */
export function isValidCombination(discounts: IDiscountRule[]): boolean {
  for (let i = 0; i < discounts.length; i++) {
    for (let j = i + 1; j < discounts.length; j++) {
      if (checkDiscountConflict(discounts[i], discounts[j])) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 할인 조합의 총 할인액 계산 (필터링 버전)
 * 각 할인규칙별로 적용 가능한 상품만 계산
 */
/**
 * 할인 직접 계산 헬퍼 함수
 */
function calculateDiscountAmount(
  baseAmount: number,
  config: DiscountConfig,
  maxDiscountAmount?: number
): number {
  let discount = 0;

  switch (config.category) {
    case 'coupon':
      if (config.valueType === 'fixed_amount' && config.fixedAmount) {
        discount = Math.min(baseAmount, config.fixedAmount);
      } else if (config.percentage) {
        discount = Math.floor(baseAmount * (config.percentage / 100));
      }
      break;

    case 'telecom':
      if (config.valueType === 'percentage' && config.percentage) {
        discount = Math.floor(baseAmount * (config.percentage / 100));
        if (config.maxDiscountPerMonth && discount > config.maxDiscountPerMonth) {
          discount = config.maxDiscountPerMonth;
        }
      } else if (config.valueType === 'tiered_amount' && config.tierUnit && config.tierAmount) {
        const tiers = Math.floor(baseAmount / config.tierUnit);
        discount = tiers * config.tierAmount;
        if (config.maxDiscountPerMonth && discount > config.maxDiscountPerMonth) {
          discount = config.maxDiscountPerMonth;
        }
      }
      break;

    case 'payment_event':
      if (config.valueType === 'percentage' && config.percentage) {
        discount = Math.floor(baseAmount * (config.percentage / 100));
        discount = Math.ceil(discount / 10) * 10; // 10원 단위 올림
      } else if (config.valueType === 'fixed_amount' && config.fixedAmount) {
        discount = Math.min(baseAmount, config.fixedAmount);
      }
      break;

    case 'event':
      if (config.valueType === 'percentage' && config.percentage) {
        discount = Math.floor(baseAmount * (config.percentage / 100));
      } else if (config.valueType === 'fixed_amount' && config.fixedAmount) {
        discount = Math.min(baseAmount, config.fixedAmount);
      }
      break;

    case 'payment_instant':
      discount = Math.floor(baseAmount * (config.percentage / 100));
      break;

    case 'payment_compound':
      discount = Math.floor(baseAmount * (config.percentage / 100));
      break;

    case 'voucher':
      discount = Math.min(baseAmount, config.amount);
      break;

    default:
      break;
  }

  // 최대 할인 금액 제한 적용
  if (maxDiscountAmount && discount > maxDiscountAmount) {
    discount = maxDiscountAmount;
  }

  return discount;
}

function calculateCombinationDiscountWithFiltering(
  cartItems: ICartItem[],
  discounts: IDiscountRule[],
  preset: IPreset,
  discountSelections: Array<{
    discount: IDiscountRule;
    applicableProductIds: string[];
  }>,
  itemsWithPromotions: any[]
): {
  totalDiscount: number;
  totalDiscountRate: number;
  finalPrice: number;
  originalPrice: number;
  warnings?: string[];
  discountBreakdown?: Array<{
    discountId: string;
    discountName: string;
    category: string;
    amount: number;
    steps?: any[];
    baseAmount?: number;
    appliedProducts?: Array<{ // 적용된 상품 목록
      productId: string;
      barcode: string;
      name: string;
      quantity: number;
      price: number;
    }>;
  }>;
} {
  const validCartItems = cartItems.filter(item => item.productId);

  if (validCartItems.length === 0) {
    return {
      totalDiscount: 0,
      totalDiscountRate: 0,
      finalPrice: 0,
      originalPrice: 0,
      warnings: ['유효한 상품이 없습니다.'],
    };
  }

  const originalPrice = validCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // 각 상품의 현재 가격 추적 (할인 적용 후)
  const itemPrices = new Map<string, number>();
  validCartItems.forEach(item => {
    itemPrices.set(item.barcode, item.price * item.quantity);
  });

  const discountBreakdown: Array<{
    discountId: string;
    discountName: string;
    category: string;
    amount: number;
    steps?: any[];
    baseAmount?: number;
    appliedProducts?: Array<{
      productId: string;
      barcode: string;
      name: string;
      quantity: number;
      price: number;
    }>;
  }> = [];

  const warnings: string[] = [];

  // 할인규칙을 카테고리 순서대로 정렬
  const sortedDiscountSelections = discountSelections.sort((a, b) => {
    const orderA = DISCOUNT_CATEGORY_ORDER[a.discount.config.category] || 99;
    const orderB = DISCOUNT_CATEGORY_ORDER[b.discount.config.category] || 99;
    return orderA - orderB;
  });

  // 각 할인규칙을 순차적으로 적용
  for (const { discount, applicableProductIds } of sortedDiscountSelections) {
    // 이 할인에 적용 가능한 상품들 찾기
    const applicableItems = validCartItems.filter(item =>
      applicableProductIds.includes(String(item.productId))
    );

    if (applicableItems.length === 0) continue;

    const applicationMethod = discount.applicationMethod || 'cart_total'; // 기본값: cart_total
    const constraints = getConstraints(discount);
    const maxDiscountAmount = constraints.maxDiscountAmount;

    if (applicationMethod === 'cart_total') {
      // 합산 후 적용 방식
      // 1. 적용 가능한 모든 상품의 기준 가격 합계 계산
      // payment_event 카테고리는 baseAmountType에 따라 원가 또는 현재가 선택
      let useOriginalPrice = false;
      if (discount.config.category === 'payment_event') {
        console.log(`[할인 계산] ${discount.name} config:`, discount.config);
        const paymentEventConfig = discount.config as any;
        console.log('paymentEventConfig:', paymentEventConfig);
        console.log('baseAmountType 값:', paymentEventConfig.baseAmountType);
        console.log('baseAmountType 타입:', typeof paymentEventConfig.baseAmountType);
        useOriginalPrice = paymentEventConfig.baseAmountType === 'original_price';
        console.log(`[할인 계산] ${discount.name}:`, {
          category: discount.config.category,
          baseAmountType: paymentEventConfig.baseAmountType,
          useOriginalPrice
        });
      }

      const totalApplicableAmount = applicableItems.reduce((sum, item) => {
        if (useOriginalPrice) {
          // 정가 기준 (원가)
          const originalPrice = item.price * item.quantity;
          console.log(`  - ${item.name}: 원가 ${originalPrice}원 사용`);
          return sum + originalPrice;
        } else {
          // 현재가 기준 (이전 할인 적용 후)
          const currentPrice = itemPrices.get(item.barcode) || 0;
          console.log(`  - ${item.name}: 현재가 ${currentPrice}원 사용`);
          return sum + currentPrice;
        }
      }, 0);

      console.log(`[할인 계산] 기준 금액 합계: ${totalApplicableAmount}원`);

      if (totalApplicableAmount === 0) continue;

      // 2. 합계에 할인 계산
      const discountAmount = calculateDiscountAmount(
        totalApplicableAmount,
        discount.config,
        maxDiscountAmount
      );

      if (discountAmount === 0) continue;

      // 3. 할인액을 각 상품에 비율로 분배
      let distributedTotal = 0;
      let actualDiscountTotal = 0; // 10원 단위 내림 후 실제 할인액
      const itemDiscounts: Array<{ barcode: string; discount: number }> = [];

      applicableItems.forEach((item, index) => {
        const currentPrice = itemPrices.get(item.barcode) || 0;

        // 분배 비율 계산: 할인 기준 금액과 동일한 기준 사용
        const itemBaseAmount = useOriginalPrice
          ? (item.price * item.quantity)
          : currentPrice;
        const ratio = itemBaseAmount / totalApplicableAmount;
        let itemDiscount = Math.floor(discountAmount * ratio);

        // 마지막 상품에 나머지를 모두 할당하여 rounding error 보정
        if (index === applicableItems.length - 1) {
          itemDiscount = discountAmount - distributedTotal;
        }

        distributedTotal += itemDiscount;

        let newPrice = Math.max(0, currentPrice - itemDiscount);
        // 10원 단위로 내림 (고객에게 유리)
        newPrice = Math.floor(newPrice / 10) * 10;

        // 실제 할인액 계산 (10원 단위 내림 후)
        let actualDiscount = currentPrice - newPrice;

        // 최대 할인 금액 체크: 전체 할인액이 이미 제한되었으므로 전체 합이 초과하지 않도록
        // (cart_total 방식이므로 전체 할인액은 이미 maxDiscountAmount 내에 있음)
        actualDiscountTotal += actualDiscount;

        itemDiscounts.push({ barcode: item.barcode, discount: actualDiscount });
        itemPrices.set(item.barcode, newPrice);
      });

      // cart_total 방식에서는 전체 할인액이 이미 maxDiscountAmount로 제한되어 있음
      // 하지만 10원 단위 내림으로 인해 총 할인액이 증가할 수 있으므로 체크
      if (maxDiscountAmount && actualDiscountTotal > maxDiscountAmount) {
        console.log(`[경고] ${discount.name}: 10원 단위 내림으로 인해 할인액 초과 (${actualDiscountTotal}원 → ${maxDiscountAmount}원으로 제한)`);

        // 초과분을 비례 배분하여 차감
        const excess = actualDiscountTotal - maxDiscountAmount;
        let excessRemaining = excess;

        applicableItems.forEach((item, index) => {
          const currentPrice = itemPrices.get(item.barcode) || 0;
          const itemDiscount = itemDiscounts[index].discount;

          // 마지막 상품에서 남은 초과분 모두 차감
          if (index === applicableItems.length - 1) {
            itemPrices.set(item.barcode, currentPrice + excessRemaining);
            itemDiscounts[index].discount -= excessRemaining;
          } else {
            // 비례 배분
            const ratio = itemDiscount / actualDiscountTotal;
            const itemExcess = Math.floor(excess * ratio);
            itemPrices.set(item.barcode, currentPrice + itemExcess);
            itemDiscounts[index].discount -= itemExcess;
            excessRemaining -= itemExcess;
          }
        });

        actualDiscountTotal = maxDiscountAmount;
      }

      // 4. 할인 내역 기록 (10원 단위 내림 후 실제 할인액 사용)
      discountBreakdown.push({
        discountId: String(discount._id),
        discountName: discount.name,
        category: discount.config.category,
        amount: actualDiscountTotal,
        baseAmount: totalApplicableAmount,
        appliedProducts: applicableItems.map(item => ({
          productId: String(item.productId),
          barcode: item.barcode,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      });

    } else if (applicationMethod === 'per_item') {
      // 상품별 개별 적용 방식
      let totalDiscountForThisRule = 0;
      const actuallyAppliedItems: typeof applicableItems = [];

      // 구독 할인의 경우 일일 상품 개수 제한 확인
      const configAny = discount.config as any;
      const dailyItemLimit = constraints.dailyItemLimit || configAny.itemLimitPerDay;
      const itemSelectionStrategy = constraints.itemSelectionStrategy || configAny.itemSelectionMethod;

      let itemsToApply = applicableItems;

      // 일일 상품 개수 제한이 있는 경우
      if (dailyItemLimit && dailyItemLimit > 0 && applicableItems.length > dailyItemLimit) {
        console.log(`[${discount.name}] 일일 상품 제한: ${dailyItemLimit}개`);
        console.log(`  적용 가능한 상품: ${applicableItems.length}개`);

        // 선택 전략에 따라 정렬
        if (itemSelectionStrategy === 'most_expensive' || itemSelectionStrategy === 'highest_price') {
          // 비싼 순서로 정렬 (현재 가격 기준)
          const sortedItems = [...applicableItems].sort((a, b) => {
            const priceA = itemPrices.get(a.barcode) || 0;
            const priceB = itemPrices.get(b.barcode) || 0;
            return priceB - priceA; // 내림차순
          });

          // 상위 N개만 선택
          itemsToApply = sortedItems.slice(0, dailyItemLimit);
          console.log(`  선택된 상품 (비싼 순서 ${dailyItemLimit}개):`);
          itemsToApply.forEach(item => {
            const price = itemPrices.get(item.barcode) || 0;
            console.log(`    - ${item.name}: ${price.toLocaleString()}원`);
          });
        }
      }

      itemsToApply.forEach(item => {
        const currentPrice = itemPrices.get(item.barcode) || 0;
        if (currentPrice === 0) return;

        const discountAmount = calculateDiscountAmount(
          currentPrice,
          discount.config,
          maxDiscountAmount
        );

        if (discountAmount > 0) {
          let newPrice = Math.max(0, currentPrice - discountAmount);
          // 10원 단위로 내림 (고객에게 유리)
          newPrice = Math.floor(newPrice / 10) * 10;

          // 실제 할인액 계산 (10원 단위 내림 후)
          let actualDiscount = currentPrice - newPrice;

          // 최대 할인 금액 체크: 10원 단위 내림으로 maxDiscountAmount 초과 방지
          if (maxDiscountAmount && actualDiscount > maxDiscountAmount) {
            console.log(`[경고] ${discount.name}: 10원 단위 내림으로 할인액 초과 (${actualDiscount}원 → ${maxDiscountAmount}원으로 제한)`);
            actualDiscount = maxDiscountAmount;
            newPrice = currentPrice - maxDiscountAmount;
          }

          itemPrices.set(item.barcode, newPrice);
          totalDiscountForThisRule += actualDiscount;
          actuallyAppliedItems.push(item);
        }
      });

      if (totalDiscountForThisRule > 0) {
        const totalApplicableAmount = actuallyAppliedItems.reduce((sum, item) =>
          sum + item.price * item.quantity, 0
        );

        discountBreakdown.push({
          discountId: String(discount._id),
          discountName: discount.name,
          category: discount.config.category,
          amount: totalDiscountForThisRule,
          baseAmount: totalApplicableAmount,
          appliedProducts: actuallyAppliedItems.map(item => ({
            productId: String(item.productId),
            barcode: item.barcode,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        });
      }
    }
  }

  const finalPrice = Array.from(itemPrices.values()).reduce((sum, price) => sum + price, 0);
  const totalDiscount = originalPrice - finalPrice;
  const totalDiscountRate = originalPrice > 0 ? totalDiscount / originalPrice : 0;

  return {
    totalDiscount,
    totalDiscountRate,
    finalPrice,
    originalPrice,
    warnings: warnings.length > 0 ? warnings : undefined,
    discountBreakdown,
  };
}

/**
 * 할인 조합의 총 할인액 계산
 */
function calculateCombinationDiscount(
  cartItems: ICartItem[],
  discounts: IDiscountRule[],
  preset: IPreset
): {
  totalDiscount: number;
  totalDiscountRate: number;
  finalPrice: number;
  originalPrice: number;
  warnings?: string[];
  discountBreakdown?: Array<{
    discountId: string;
    discountName: string;
    category: string;
    amount: number;
    steps?: any[];
    baseAmount?: number;
  }>;
} {
  // productId가 없는 아이템 필터링
  const validCartItems = cartItems.filter(item => item.productId);

  if (validCartItems.length === 0) {
    return {
      totalDiscount: 0,
      totalDiscountRate: 0,
      finalPrice: 0,
      originalPrice: 0,
      warnings: ['유효한 상품이 없습니다.'],
    };
  }

  // 장바구니 아이템별로 할인 매핑
  const discountSelections = validCartItems.map((item) => ({
    productId: item.productId,
    productBarcode: item.barcode,
    selectedDiscounts: discounts,
  }));

  // 할인 계산 (최적화 중이므로 verbose=false)
  const calculationOptions = {
    items: validCartItems.map((item) => ({
      productId: item.productId,
      productBarcode: item.barcode,
      quantity: item.quantity,
      unitPrice: item.price,
      productCategory: item.category,
      productBrand: item.brand,
    })),
    discountSelections,
    paymentMethod: preset.paymentMethod,
    currentDate: new Date(),
    verbose: false, // 최적화 중에는 로그 출력 안 함
  };

  const result = calculateCart(calculationOptions);

  // 각 할인별 금액 집계 (steps와 baseAmount 포함)
  const discountAmountMap = new Map<string, {
    name: string;
    category: string;
    amount: number;
    steps: any[];
    baseAmount?: number;
  }>();

  result.items.forEach((item) => {
    item.calculation.steps.forEach((step) => {
      const discountId = String(step.discountId || step.discountName); // discountId 없으면 이름 사용 (크로스 프로모션 등)
      const existing = discountAmountMap.get(discountId);

      if (existing) {
        existing.amount += step.discountAmount;
        existing.steps.push(step);
        // baseAmount는 첫 번째 것을 유지하거나 더 큰 값 사용
        if (step.baseAmount && (!existing.baseAmount || step.baseAmount > existing.baseAmount)) {
          existing.baseAmount = step.baseAmount;
        }
      } else {
        discountAmountMap.set(discountId, {
          name: step.discountName,
          category: step.category,
          amount: step.discountAmount,
          steps: [step],
          baseAmount: step.baseAmount,
        });
      }
    });
  });

  const discountBreakdown = Array.from(discountAmountMap.entries()).map(([id, data]) => ({
    discountId: id,
    discountName: data.name,
    category: data.category,
    amount: data.amount,
    steps: data.steps,
    baseAmount: data.baseAmount,
  }));

  return {
    totalDiscount: result.totalDiscount,
    totalDiscountRate: result.totalDiscountRate,
    finalPrice: result.totalFinalPrice,
    originalPrice: result.totalOriginalPrice,
    warnings: result.warnings,
    discountBreakdown,
  };
}

/**
 * 할인 조합 생성 (재귀 방식)
 */
function generateCombinations(
  discounts: IDiscountRule[],
  maxSize: number = discounts.length
): IDiscountRule[][] {
  const combinations: IDiscountRule[][] = [];

  // 빈 조합 (할인 없음)
  combinations.push([]);

  // 단일 할인 조합
  for (const discount of discounts) {
    combinations.push([discount]);
  }

  // 2개 이상의 조합 (재귀적으로 생성)
  for (let size = 2; size <= Math.min(maxSize, discounts.length); size++) {
    const sizeCombinations = generateCombinationsOfSize(discounts, size);
    combinations.push(...sizeCombinations);
  }

  return combinations;
}

/**
 * 특정 크기의 조합 생성
 */
function generateCombinationsOfSize(
  discounts: IDiscountRule[],
  size: number
): IDiscountRule[][] {
  if (size === 0) return [[]];
  if (size === 1) return discounts.map((d) => [d]);
  if (size > discounts.length) return [];

  const combinations: IDiscountRule[][] = [];

  for (let i = 0; i <= discounts.length - size; i++) {
    const current = discounts[i];
    const remaining = discounts.slice(i + 1);
    const subCombinations = generateCombinationsOfSize(remaining, size - 1);

    for (const subCombination of subCombinations) {
      combinations.push([current, ...subCombination]);
    }
  }

  return combinations;
}

/**
 * 할인 조합 정렬 (카테고리 순서에 따라)
 */
function sortDiscountsByCategory(discounts: IDiscountRule[]): IDiscountRule[] {
  return [...discounts].sort((a, b) => {
    const orderA = DISCOUNT_CATEGORY_ORDER[a.config.category];
    const orderB = DISCOUNT_CATEGORY_ORDER[b.config.category];
    return orderA - orderB;
  });
}

/**
 * 최적 할인 조합 찾기 (프로모션 분리 버전)
 */
export function findOptimalDiscountCombination(
  cartItems: ICartItem[],
  availableDiscounts: IDiscountRule[],
  availablePromotions: IDiscountRule[], // 프로모션 별도 파라미터
  preset: IPreset,
  options?: OptimizerOptions
): {
  optimal: DiscountCombination | null;
  alternatives: DiscountCombination[];
} {
  const maxCombinations = options?.maxCombinations || 100;
  const includeAlternatives = options?.includeAlternatives !== false;
  const maxAlternatives = options?.maxAlternatives || 5;

  console.log('\n========================================');
  console.log('[할인 최적화] 시작');
  console.log('========================================');
  console.log(`장바구니 상품: ${cartItems.length}개`);
  console.log(`할인규칙: ${availableDiscounts.length}개`);
  console.log(`프로모션: ${availablePromotions.length}개`);

  // ========================================================================
  // 1단계: 프로모션 적용 (개별 상품 단위, 조합 불필요)
  // ========================================================================
  console.log('\n[1단계] 프로모션 적용');

  // ICartItem → CartItem 변환
  const cartItemsForPromotion: CartItem[] = cartItems.map(item => ({
    productId: item.productId,
    productBarcode: item.barcode,
    productName: item.name,
    productCategory: item.category,
    productCategories: item.categoryTags?.map(tag => tag.name) || [],
    productBrand: item.brand,
    unitPrice: item.price,
    quantity: item.quantity,
  }));

  const promotionResult = applyPromotionsToCart(
    cartItemsForPromotion,
    availablePromotions,
    new Date(),
    true // verbose
  );

  const { itemsWithPromotions, crossPromotionPairs, warnings: promotionWarnings, totalPromotionDiscount } = promotionResult;

  console.log(`프로모션 적용 완료: ${totalPromotionDiscount.toLocaleString()}원 할인`);

  // ========================================================================
  // 2단계: 할인규칙 적용 가능 여부 체크
  // ========================================================================
  console.log('\n[2단계] 할인규칙 필터링');

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // 프리셋으로 적용 가능한 할인규칙 필터링
  console.log('\n[프리셋 필터링 시작]');
  console.log(`  프리셋:`, preset.name);
  console.log(`  결제수단:`, preset.paymentMethods?.map(pm => pm.method).join(', ') || '없음');
  console.log(`  구독:`, preset.subscriptions?.map(s => s.name).join(', ') || '없음');

  const eligibleDiscounts = filterEligibleDiscounts(availableDiscounts, preset, {
    totalAmount,
    totalQuantity,
  });

  console.log(`\n[필터링 결과]`);
  console.log(`  전체 할인규칙: ${availableDiscounts.length}개`);
  console.log(`  적용 가능: ${eligibleDiscounts.length}개`);

  if (eligibleDiscounts.length > 0) {
    console.log(`  적용 가능한 할인:`);
    eligibleDiscounts.forEach(d => {
      console.log(`    - ${d.name} (${d.config.category})`);
    });
  }

  // 필터링된 할인 확인 (제외된 것들)
  const excludedDiscounts = availableDiscounts.filter(
    d => !eligibleDiscounts.find(e => String(e._id) === String(d._id))
  );
  if (excludedDiscounts.length > 0) {
    console.log(`\n  제외된 할인: ${excludedDiscounts.length}개`);
    excludedDiscounts.forEach(d => {
      const result = checkDiscountEligibility(d, preset, { totalAmount, totalQuantity });
      console.log(`    ❌ ${d.name}: ${result.reason || '알 수 없음'}`);
    });
  }

  // ========================================================================
  // 2-2단계: 각 할인규칙별로 적용 가능한 상품 목록 생성
  // ========================================================================
  console.log(`\n[2-2단계] 상품별 적용 가능성 체크`);

  const discountApplicableProductsMap = new Map<string, {
    discount: IDiscountRule;
    applicableItems: typeof itemsWithPromotions;
  }>();

  for (const discount of eligibleDiscounts) {
    const applicableItems = itemsWithPromotions.filter(({ item, promotion }) => {
      // 1. 상품 적용 대상 체크 (바코드, 카테고리, 브랜드)

      // 전체 상품 대상인 경우
      const isAllProducts = discount.applicableProducts.length === 0 &&
         discount.applicableCategories.length === 0 &&
         (!discount.applicableBrands || discount.applicableBrands.length === 0);

      if (isAllProducts) {
        // 프로모션과 충돌 체크
        if (promotion && checkDiscountConflict(discount, promotion)) {
          return false;
        }
        return true;
      }

      // 특정 상품 대상 (바코드)
      if (discount.applicableProducts.includes(item.productBarcode)) {
        // 프로모션과 충돌 체크
        if (promotion && checkDiscountConflict(discount, promotion)) {
          return false;
        }
        return true;
      }

      // 특정 카테고리 대상
      if (discount.applicableCategories.length > 0) {
        // 디버깅: 상품의 모든 카테고리 출력
        if (discount.name === "간편식사 구독") {
          console.log(`    [DEBUG] ${item.productName}의 카테고리들:`, item.productCategories);
          console.log(`    [DEBUG] 할인 대상 카테고리:`, discount.applicableCategories);
        }

        // 상품의 모든 카테고리 중 하나라도 할인 대상 카테고리에 포함되는지 확인
        const hasMatchingCategory = item.productCategories?.some(category =>
          discount.applicableCategories.includes(category)
        ) || false;

        if (hasMatchingCategory) {
          // 프로모션과 충돌 체크
          if (promotion && checkDiscountConflict(discount, promotion)) {
            return false;
          }
          return true;
        }
      }

      // 특정 브랜드 대상
      if (discount.applicableBrands && discount.applicableBrands.length > 0) {
        const hasMatchingBrand = item.productBrand &&
          discount.applicableBrands.includes(item.productBrand);

        if (hasMatchingBrand) {
          // 프로모션과 충돌 체크
          if (promotion && checkDiscountConflict(discount, promotion)) {
            return false;
          }
          return true;
        }
      }

      return false;
    });

    if (applicableItems.length > 0) {
      discountApplicableProductsMap.set(String(discount._id), {
        discount,
        applicableItems,
      });

      console.log(`  ✅ ${discount.name}:`);
      console.log(`      적용 가능 상품: ${applicableItems.length}개`);
      applicableItems.forEach(({ item }) => {
        console.log(`        - ${item.productName || item.productBarcode}`);
      });
    } else {
      console.log(`  ❌ ${discount.name}: 적용 가능한 상품 없음`);
    }
  }

  // 적용 가능한 상품이 있는 할인규칙만 선택
  const discountsWithApplicableProducts = Array.from(discountApplicableProductsMap.values())
    .map(({ discount }) => discount);

  console.log(`\n[2-2단계 결과]`);
  console.log(`  적용 가능한 상품이 있는 할인: ${discountsWithApplicableProducts.length}개`);
  console.log(`  제외된 할인: ${eligibleDiscounts.length - discountsWithApplicableProducts.length}개`);

  const nonConflictingDiscounts = discountsWithApplicableProducts;

  if (nonConflictingDiscounts.length === 0) {
    // 할인규칙이 없으면 프로모션만 적용된 결과 반환
    console.log('\n할인규칙 없음, 프로모션만 적용');

    if (totalPromotionDiscount === 0) {
      return {
        optimal: null,
        alternatives: [],
      };
    }

    // 프로모션만 적용된 결과 (상품별 상세 포함)
    const promotionBreakdownMap = new Map<string, {
      discountId: string;
      discountName: string;
      category: string;
      amount: number;
      steps: any[];
    }>();

    // Same/Cross 프로모션 (자체 할인이 있는 경우)
    itemsWithPromotions
      .filter(iwp => iwp.promotion && iwp.promotionDiscount > 0)
      .forEach(iwp => {
        const promoId = String(iwp.promotion!._id);
        const config = iwp.promotion!.config as any;

        // Same/Cross 프로모션
        const quantity = iwp.item.quantity;
        const buyQty = config.buyQuantity || 1;
        const getQty = config.getQuantity || 1;
        const sets = Math.floor(quantity / (buyQty + getQty));
        const freeItems = sets * getQty;

        const promotionDetail = `${iwp.item.productName || iwp.item.productBarcode} ${quantity}개 중 ${freeItems}개 증정`;

        if (!promotionBreakdownMap.has(promoId)) {
          promotionBreakdownMap.set(promoId, {
            discountId: promoId,
            discountName: iwp.promotion!.name,
            category: 'promotion',
            amount: 0,
            steps: [],
          });
        }

        const entry = promotionBreakdownMap.get(promoId)!;
        entry.amount += iwp.promotionDiscount;
        entry.steps.push({
          category: 'promotion',
          discountId: promoId,
          discountName: iwp.promotion!.name,
          baseAmount: iwp.item.unitPrice * iwp.item.quantity,
          isOriginalPriceBased: true,
          discountAmount: iwp.promotionDiscount,
          amountAfterDiscount: iwp.priceAfterPromotion,
          calculationDetails: promotionDetail,
        });
      });

    // 콤보 프로모션 (crossPromotionPairs 사용)
    crossPromotionPairs.forEach(pair => {
      const promoId = String(pair.promotion._id);

      const promotionDetail = `${pair.buyItem.productName || pair.buyItem.productBarcode} 구매 시 ${pair.giftItem.productName || pair.giftItem.productBarcode} 증정`;

      if (!promotionBreakdownMap.has(promoId)) {
        promotionBreakdownMap.set(promoId, {
          discountId: promoId,
          discountName: pair.promotion.name,
          category: 'promotion',
          amount: 0,
          steps: [],
        });
      }

      const entry = promotionBreakdownMap.get(promoId)!;
      entry.amount += pair.giftDiscount;
      entry.steps.push({
        category: 'promotion',
        discountId: promoId,
        discountName: pair.promotion.name,
        baseAmount: pair.giftItem.unitPrice * pair.giftItem.quantity,
        isOriginalPriceBased: true,
        discountAmount: pair.giftDiscount,
        amountAfterDiscount: pair.giftItem.unitPrice * pair.giftItem.quantity - pair.giftDiscount,
        calculationDetails: promotionDetail,
      });
    });

    // 모든 프로모션 ID 수집 (중복 제거)
    const allPromotionIds = new Set<string>();
    itemsWithPromotions.forEach(iwp => {
      if (iwp.promotion) {
        allPromotionIds.add(String(iwp.promotion._id));
      }
    });
    crossPromotionPairs.forEach(pair => {
      allPromotionIds.add(String(pair.promotion._id));
    });

    const promotionOnlyResult: DiscountCombination = {
      discountIds: Array.from(allPromotionIds),
      totalDiscount: totalPromotionDiscount,
      totalDiscountRate: totalPromotionDiscount / totalAmount,
      finalPrice: totalAmount - totalPromotionDiscount,
      originalPrice: totalAmount,
      isOptimal: true,
      warnings: promotionWarnings.length > 0 ? promotionWarnings : undefined,
      discountBreakdown: Array.from(promotionBreakdownMap.values()),
    };

    return {
      optimal: promotionOnlyResult,
      alternatives: [],
    };
  }

  // ========================================================================
  // 3단계: 할인규칙 조합 생성 및 계산
  // ========================================================================
  console.log('\n[3단계] 할인규칙 조합 최적화');

  const maxCombinationSize = Math.min(4, nonConflictingDiscounts.length);
  let combinations = generateCombinations(nonConflictingDiscounts, maxCombinationSize);

  console.log(`생성된 조합: ${combinations.length}개`);

  // 충돌 체크
  const validCombinations = combinations.filter(isValidCombination);
  console.log(`충돌 체크 후: ${validCombinations.length}개`);

  // 조합 수 제한
  if (validCombinations.length > maxCombinations) {
    combinations = validCombinations
      .sort((a, b) => b.length - a.length)
      .slice(0, maxCombinations);
    console.log(`조합 수 제한: ${combinations.length}개로 축소`);
  } else {
    combinations = validCombinations;
  }

  // 각 조합의 할인액 계산
  const results: DiscountCombination[] = [];

  for (const combination of combinations) {
    try {
      const sortedDiscounts = sortDiscountsByCategory(combination);

      // ====================================================================
      // 각 할인규칙별로 적용 가능한 상품만 필터링해서 계산
      // ====================================================================

      // 각 할인규칙이 실제로 적용될 상품 목록 생성
      const discountSelections = sortedDiscounts.map(discount => {
        const discountId = String(discount._id);
        const applicableEntry = discountApplicableProductsMap.get(discountId);

        // 이 할인이 적용 가능한 상품들의 productId 추출
        const applicableProductIds = applicableEntry
          ? applicableEntry.applicableItems.map(({ item }) => String(item.productId))
          : [];

        return {
          discount,
          applicableProductIds,
        };
      });

      // 프로모션 적용 후 가격으로 계산
      const calculation = calculateCombinationDiscountWithFiltering(
        cartItems,
        sortedDiscounts,
        preset,
        discountSelections,
        itemsWithPromotions
      );

      // 프로모션 할인 추가
      const totalDiscount = calculation.totalDiscount + totalPromotionDiscount;
      const finalPrice = calculation.originalPrice - totalDiscount;

      // discountBreakdown에 프로모션 추가 (상품별 상세 포함)
      const promotionBreakdownMap = new Map<string, {
        discountId: string;
        discountName: string;
        category: string;
        amount: number;
        steps: any[];
      }>();

      // Same/Cross 프로모션 (자체 할인이 있는 경우)
      itemsWithPromotions
        .filter(iwp => iwp.promotion && iwp.promotionDiscount > 0)
        .forEach(iwp => {
          const promoId = String(iwp.promotion!._id);
          const config = iwp.promotion!.config as any;

          // Same/Cross 프로모션
          const quantity = iwp.item.quantity;
          const buyQty = config.buyQuantity || 1;
          const getQty = config.getQuantity || 1;
          const sets = Math.floor(quantity / (buyQty + getQty));
          const freeItems = sets * getQty;

          const promotionDetail = `${iwp.item.productName || iwp.item.productBarcode} ${quantity}개 중 ${freeItems}개 증정`;

          if (!promotionBreakdownMap.has(promoId)) {
            promotionBreakdownMap.set(promoId, {
              discountId: promoId,
              discountName: iwp.promotion!.name,
              category: 'promotion',
              amount: 0,
              steps: [],
            });
          }

          const entry = promotionBreakdownMap.get(promoId)!;
          entry.amount += iwp.promotionDiscount;
          entry.steps.push({
            category: 'promotion',
            discountId: promoId,
            discountName: iwp.promotion!.name,
            baseAmount: iwp.item.unitPrice * iwp.item.quantity,
            isOriginalPriceBased: true,
            discountAmount: iwp.promotionDiscount,
            amountAfterDiscount: iwp.priceAfterPromotion,
            calculationDetails: promotionDetail,
          });
        });

      // 콤보 프로모션 (crossPromotionPairs 사용)
      crossPromotionPairs.forEach(pair => {
        const promoId = String(pair.promotion._id);

        const promotionDetail = `${pair.buyItem.productName || pair.buyItem.productBarcode} 구매 시 ${pair.giftItem.productName || pair.giftItem.productBarcode} 증정`;

        if (!promotionBreakdownMap.has(promoId)) {
          promotionBreakdownMap.set(promoId, {
            discountId: promoId,
            discountName: pair.promotion.name,
            category: 'promotion',
            amount: 0,
            steps: [],
          });
        }

        const entry = promotionBreakdownMap.get(promoId)!;
        entry.amount += pair.giftDiscount;
        entry.steps.push({
          category: 'promotion',
          discountId: promoId,
          discountName: pair.promotion.name,
          baseAmount: pair.giftItem.unitPrice * pair.giftItem.quantity,
          isOriginalPriceBased: true,
          discountAmount: pair.giftDiscount,
          amountAfterDiscount: pair.giftItem.unitPrice * pair.giftItem.quantity - pair.giftDiscount,
          calculationDetails: promotionDetail,
        });
      });

      const discountBreakdown = [
        ...(calculation.discountBreakdown || []),
        ...Array.from(promotionBreakdownMap.values()),
      ];

      // 모든 프로모션 ID 수집 (중복 제거)
      const allPromotionIds = new Set<string>();
      itemsWithPromotions.forEach(iwp => {
        if (iwp.promotion) {
          allPromotionIds.add(String(iwp.promotion._id));
        }
      });
      crossPromotionPairs.forEach(pair => {
        allPromotionIds.add(String(pair.promotion._id));
      });

      results.push({
        discountIds: [
          ...sortedDiscounts.map(d => String(d._id)),
          ...Array.from(allPromotionIds),
        ],
        totalDiscount,
        totalDiscountRate: totalDiscount / calculation.originalPrice,
        finalPrice,
        originalPrice: calculation.originalPrice,
        isOptimal: false,
        warnings: [...(calculation.warnings || []), ...promotionWarnings],
        discountBreakdown,
      });
    } catch (error) {
      console.error('Error calculating combination:', error);
    }
  }

  if (results.length === 0) {
    return {
      optimal: null,
      alternatives: [],
    };
  }

  // ========================================================================
  // 4단계: 최적 조합 선정
  // ========================================================================
  console.log('\n[4단계] 최적 조합 선정');

  // 의미 있는 조합만 필터링
  const meaningfulResults = results.filter(result => {
    if (!result.discountBreakdown || result.discountBreakdown.length === 0) {
      return result.totalDiscount > 0;
    }
    return result.discountBreakdown.some(breakdown => breakdown.amount > 0);
  });

  console.log(`의미 있는 조합: ${meaningfulResults.length}개`);

  if (meaningfulResults.length === 0) {
    return {
      optimal: null,
      alternatives: [],
    };
  }

  // 결과 정렬 (할인액 기준 내림차순)
  meaningfulResults.sort((a, b) => b.totalDiscount - a.totalDiscount);

  // 최적 조합 선정
  const optimal = meaningfulResults[0];
  optimal.isOptimal = true;

  console.log(`\n✅ 최적 조합: ${optimal.totalDiscount.toLocaleString()}원 할인`);
  console.log(`   할인율: ${(optimal.totalDiscountRate * 100).toFixed(1)}%`);
  console.log(`   최종 가격: ${optimal.finalPrice.toLocaleString()}원`);

  // 대안 조합 추출
  let alternatives: DiscountCombination[] = [];

  if (includeAlternatives && meaningfulResults.length > 1) {
    const seenDiscounts = new Set<number>();
    seenDiscounts.add(optimal.totalDiscount);

    for (let i = 1; i < meaningfulResults.length && alternatives.length < maxAlternatives; i++) {
      const candidate = meaningfulResults[i];

      if (!seenDiscounts.has(candidate.totalDiscount)) {
        alternatives.push(candidate);
        seenDiscounts.add(candidate.totalDiscount);
      }
    }

    console.log(`대안 조합: ${alternatives.length}개`);
  }

  console.log('========================================\n');

  return {
    optimal,
    alternatives,
  };
}

/**
 * 상품별 최적 할인 찾기
 * (각 상품마다 독립적으로 최적 할인 조합을 찾음)
 */
export function findOptimalDiscountsPerProduct(
  cartItems: ICartItem[],
  availableDiscounts: IDiscountRule[],
  preset: IPreset
): Map<string, IDiscountRule[]> {
  const productDiscountMap = new Map<string, IDiscountRule[]>();

  for (const item of cartItems) {
    // 해당 상품에 적용 가능한 할인 필터링
    const eligibleDiscounts = filterEligibleDiscounts(availableDiscounts, preset, {
      productBarcode: item.barcode,
      productCategory: item.category,
      productBrand: item.brand,
    });

    // 유효한 조합 찾기
    const combinations = generateCombinations(eligibleDiscounts);
    const validCombinations = combinations.filter(isValidCombination);

    // 각 조합의 할인액 계산
    let bestCombination: IDiscountRule[] = [];
    let maxDiscount = 0;

    for (const combination of validCombinations) {
      try {
        const sortedDiscounts = sortDiscountsByCategory(combination);
        const calculation = calculateCombinationDiscount(
          [item],
          sortedDiscounts,
          preset
        );

        if (calculation.totalDiscount > maxDiscount) {
          maxDiscount = calculation.totalDiscount;
          bestCombination = sortedDiscounts;
        }
      } catch (error) {
        console.error('Error calculating product discount:', error);
      }
    }

    productDiscountMap.set(item.barcode, bestCombination);
  }

  return productDiscountMap;
}

/**
 * 할인 조합 추천 설명 생성
 */
export function generateCombinationDescription(
  combination: DiscountCombination,
  discounts: IDiscountRule[]
): string {
  if (combination.discountIds.length === 0) {
    return '할인 없음';
  }

  const discountNames = combination.discountIds
    .map((id) => {
      const discount = discounts.find((d) => String(d._id) === id);
      return discount?.name || 'Unknown';
    })
    .join(' + ');

  const savingsRate = (combination.totalDiscountRate * 100).toFixed(1);

  return `${discountNames} (${savingsRate}% 절약)`;
}
