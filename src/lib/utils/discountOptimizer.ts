/**
 * 할인 최적화 알고리즘
 * 프리셋 데이터와 장바구니를 기반으로 최적의 할인 조합을 찾음
 */

import { IDiscountRule, DiscountCategory, DISCOUNT_CATEGORY_ORDER } from '@/types/discount';
import { IPreset } from '@/types/preset';
import { ICartItem } from '@/types/cart';
import { checkDiscountEligibility, filterEligibleDiscounts } from './discountEligibility';
import { calculateCartDiscountV2 } from '../discountCalculator';

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
async function calculateCombinationDiscount(
  cartItems: ICartItem[],
  discounts: IDiscountRule[],
  preset: IPreset
): Promise<{
  totalDiscount: number;
  totalDiscountRate: number;
  finalPrice: number;
  originalPrice: number;
  warnings?: string[];
}> {
  // 장바구니 아이템별로 할인 매핑
  const discountSelections = cartItems.map((item) => ({
    productId: item.productId,
    productBarcode: item.barcode,
    selectedDiscounts: discounts,
  }));

  // 할인 계산 (v2 계산기 사용)
  const calculationOptions = {
    items: cartItems.map((item) => ({
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
  };

  const result = await calculateCartDiscountV2(calculationOptions);

  return {
    totalDiscount: result.totalDiscount,
    totalDiscountRate: result.totalDiscountRate,
    finalPrice: result.totalFinalPrice,
    originalPrice: result.totalOriginalPrice,
    warnings: result.warnings,
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
export async function findOptimalDiscountCombination(
  cartItems: ICartItem[],
  availableDiscounts: IDiscountRule[],
  preset: IPreset,
  options?: OptimizerOptions
): Promise<{
  optimal: DiscountCombination | null;
  alternatives: DiscountCombination[];
}> {
  const maxCombinations = options?.maxCombinations || 100;
  const includeAlternatives = options?.includeAlternatives !== false;
  const maxAlternatives = options?.maxAlternatives || 5;

  // 1. 프리셋으로 적용 가능한 할인만 필터링
  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const eligibleDiscounts = filterEligibleDiscounts(availableDiscounts, preset, {
    totalAmount,
    totalQuantity,
  });

  if (eligibleDiscounts.length === 0) {
    return {
      optimal: null,
      alternatives: [],
    };
  }

  // 2. 가능한 할인 조합 생성
  let combinations = generateCombinations(eligibleDiscounts);

  // 조합 수 제한
  if (combinations.length > maxCombinations) {
    // 큰 조합부터 우선 탐색 (할인액이 클 가능성이 높음)
    combinations = combinations
      .sort((a, b) => b.length - a.length)
      .slice(0, maxCombinations);
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

      const calculation = await calculateCombinationDiscount(
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

  // 5. 결과 정렬 (할인액 기준 내림차순)
  results.sort((a, b) => b.totalDiscount - a.totalDiscount);

  // 6. 최적 조합 선정
  const optimal = results[0];
  optimal.isOptimal = true;

  // 7. 대안 조합 추출
  const alternatives = includeAlternatives
    ? results.slice(1, maxAlternatives + 1)
    : [];

  return {
    optimal,
    alternatives,
  };
}

/**
 * 상품별 최적 할인 찾기
 * (각 상품마다 독립적으로 최적 할인 조합을 찾음)
 */
export async function findOptimalDiscountsPerProduct(
  cartItems: ICartItem[],
  availableDiscounts: IDiscountRule[],
  preset: IPreset
): Promise<Map<string, IDiscountRule[]>> {
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
        const calculation = await calculateCombinationDiscount(
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
