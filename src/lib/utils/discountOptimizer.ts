/**
 * 할인 최적화 알고리즘
 * 프리셋 데이터와 장바구니를 기반으로 최적의 할인 조합을 찾음
 */

import { IDiscountRule, DiscountCategory, DISCOUNT_CATEGORY_ORDER } from '@/types/discount';
import { IPreset } from '@/types/preset';
import { ICartItem } from '@/types/cart';
import { checkDiscountEligibility, filterEligibleDiscounts } from './discountEligibility';
import { calculateCart } from './discountCalculator';

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

  // discount1이 discount2의 카테고리를 금지하는 경우
  if (
    discount1.cannotCombineWithCategories &&
    discount1.cannotCombineWithCategories.includes(discount2.config.category)
  ) {
    return true;
  }

  // discount2가 discount1의 카테고리를 금지하는 경우
  if (
    discount2.cannotCombineWithCategories &&
    discount2.cannotCombineWithCategories.includes(discount1.config.category)
  ) {
    return true;
  }

  // discount1이 discount2의 ID를 명시적으로 금지하는 경우
  if (
    discount1.cannotCombineWithIds &&
    discount1.cannotCombineWithIds.some((id) => String(id) === String(discount2._id))
  ) {
    return true;
  }

  // discount2가 discount1의 ID를 명시적으로 금지하는 경우
  if (
    discount2.cannotCombineWithIds &&
    discount2.cannotCombineWithIds.some((id) => String(id) === String(discount1._id))
  ) {
    return true;
  }

  // 통신사 할인의 restrictedProviders 체크
  if (discount1.config.category === 'telecom' && discount2.config.category === 'telecom') {
    const telecomConfig1 = discount1.config as { provider: string; restrictedProviders?: string[] };
    const telecomConfig2 = discount2.config as { provider: string; restrictedProviders?: string[] };

    // discount1이 discount2의 provider를 금지하는 경우
    if (
      telecomConfig1.restrictedProviders &&
      telecomConfig1.restrictedProviders.includes(telecomConfig2.provider)
    ) {
      return true;
    }

    // discount2가 discount1의 provider를 금지하는 경우
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
 * 최적 할인 조합 찾기
 */
export function findOptimalDiscountCombination(
  cartItems: ICartItem[],
  availableDiscounts: IDiscountRule[],
  preset: IPreset,
  options?: OptimizerOptions
): {
  optimal: DiscountCombination | null;
  alternatives: DiscountCombination[];
} {
  const maxCombinations = options?.maxCombinations || 100;
  const includeAlternatives = options?.includeAlternatives !== false;
  const maxAlternatives = options?.maxAlternatives || 5;

  // 1. 프리셋으로 적용 가능한 할인만 필터링
  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // 장바구니에 있는 상품 바코드 추출
  const cartBarcodes = [...new Set(cartItems.map(item => item.barcode))];
  console.log(`[최적화] 장바구니 상품 바코드: ${cartBarcodes.length}개`);

  // 프로모션은 장바구니 상품과 관련된 것만 필터링
  const filteredDiscounts = availableDiscounts.filter(discount => {
    // 프로모션이 아니면 모두 포함
    if (discount.config.category !== 'promotion') {
      return true;
    }

    // 프로모션인 경우: 장바구니에 있는 상품과 관련된 것만
    // applicableProducts가 비어있으면 (전체 상품 대상) 포함
    if (!discount.applicableProducts || discount.applicableProducts.length === 0) {
      return true;
    }

    // 구매 상품이 장바구니에 있는지 확인
    const hasApplicableProduct = discount.applicableProducts.some(barcode =>
      cartBarcodes.includes(barcode)
    );

    // 콤보 프로모션인 경우: 증정 상품도 확인
    if (discount.config.category === 'promotion' && discount.config.giftSelectionType === 'combo') {
      const hasGiftProduct = discount.config.giftProducts?.some(barcode =>
        cartBarcodes.includes(barcode)
      );
      return hasApplicableProduct && hasGiftProduct;
    }

    return hasApplicableProduct;
  });

  console.log(`[최적화] 필터링 후 할인: ${availableDiscounts.length} → ${filteredDiscounts.length}개`);

  const eligibleDiscounts = filterEligibleDiscounts(filteredDiscounts, preset, {
    totalAmount,
    totalQuantity,
  });

  console.log(`[최적화] 적격 할인: ${eligibleDiscounts.length}개`);

  if (eligibleDiscounts.length === 0) {
    return {
      optimal: null,
      alternatives: [],
    };
  }

  // 2. 프로모션과 비프로모션 분리
  // 프로모션은 조건만 맞으면 무조건 적용되어야 함
  const promotions = eligibleDiscounts.filter(d => d.config.category === 'promotion');
  const nonPromotions = eligibleDiscounts.filter(d => d.config.category !== 'promotion');

  console.log(`[최적화] 프로모션: ${promotions.length}개, 비프로모션: ${nonPromotions.length}개`);

  // 3. 가능한 할인 조합 생성
  // 비프로모션 할인만으로 조합 생성 (프로모션은 모든 조합에 자동 포함)
  const maxCombinationSize = Math.min(4, nonPromotions.length);
  let nonPromotionCombinations = generateCombinations(nonPromotions, maxCombinationSize);

  // 모든 조합에 프로모션 추가 (프로모션은 무조건 적용)
  let combinations = nonPromotionCombinations.map(combo => [...promotions, ...combo]);

  console.log(`[최적화] 생성된 조합: ${combinations.length}개 (프로모션 ${promotions.length}개 + 비프로모션 조합)`);

  // 조합 수 제한
  if (combinations.length > maxCombinations) {
    // 큰 조합부터 우선 탐색 (할인액이 클 가능성이 높음)
    combinations = combinations
      .sort((a, b) => b.length - a.length)
      .slice(0, maxCombinations);
    console.log(`[최적화] 조합 수 제한: ${combinations.length}개로 축소`);
  }

  // 3. 유효한 조합만 필터링 (충돌 체크)
  const validCombinations = combinations.filter(isValidCombination);

  if (validCombinations.length === 0) {
    return {
      optimal: null,
      alternatives: [],
    };
  }

  // 4. 각 조합의 할인액 계산
  const results: DiscountCombination[] = [];

  for (const combination of validCombinations) {
    try {
      // 카테고리 순서에 따라 정렬
      const sortedDiscounts = sortDiscountsByCategory(combination);

      const calculation = calculateCombinationDiscount(
        cartItems,
        sortedDiscounts,
        preset
      );

      results.push({
        discountIds: sortedDiscounts.map((d) => String(d._id)),
        totalDiscount: calculation.totalDiscount,
        totalDiscountRate: calculation.totalDiscountRate,
        finalPrice: calculation.finalPrice,
        originalPrice: calculation.originalPrice,
        isOptimal: false, // 나중에 설정
        warnings: calculation.warnings,
        discountBreakdown: calculation.discountBreakdown,
      });
    } catch (error) {
      console.error('Error calculating combination:', error);
      // 계산 오류 발생 시 해당 조합은 건너뜀
    }
  }

  if (results.length === 0) {
    return {
      optimal: null,
      alternatives: [],
    };
  }

  // 5. 의미 있는 조합만 필터링
  // - 실제로 할인이 적용되는 조합만 포함
  // - discountBreakdown에서 모든 할인의 amount가 0인 조합 제외
  const meaningfulResults = results.filter((result) => {
    if (!result.discountBreakdown || result.discountBreakdown.length === 0) {
      return result.totalDiscount > 0;
    }
    // 최소 하나 이상의 할인이 실제로 적용되었는지 확인
    return result.discountBreakdown.some((breakdown) => breakdown.amount > 0);
  });

  if (meaningfulResults.length === 0) {
    return {
      optimal: null,
      alternatives: [],
    };
  }

  // 6. 결과 정렬 (할인액 기준 내림차순)
  meaningfulResults.sort((a, b) => b.totalDiscount - a.totalDiscount);

  // 7. 최적 조합 선정
  const optimal = meaningfulResults[0];
  optimal.isOptimal = true;

  // 8. 대안 조합 추출 (중복 제거)
  let alternatives: DiscountCombination[] = [];

  if (includeAlternatives && meaningfulResults.length > 1) {
    const seenDiscounts = new Set<number>();
    seenDiscounts.add(optimal.totalDiscount);

    for (let i = 1; i < meaningfulResults.length && alternatives.length < maxAlternatives; i++) {
      const candidate = meaningfulResults[i];

      // 동일한 할인액을 가진 조합은 건너뛰기 (중복 제거)
      if (!seenDiscounts.has(candidate.totalDiscount)) {
        alternatives.push(candidate);
        seenDiscounts.add(candidate.totalDiscount);
      }
    }
  }

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
