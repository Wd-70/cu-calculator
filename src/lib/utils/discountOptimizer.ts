/**
 * 할인 최적화 알고리즘
 * 프리셋 데이터와 장바구니를 기반으로 최적의 할인 조합을 찾음
 *
 * 구조:
 * 1. 프로모션 적용 (개별 상품 단위, 조합 불필요)
 * 2. 할인규칙 조합 최적화 (프로모션 적용 후 가격 기준)
 */

import { IDiscountRule, DiscountCategory, DISCOUNT_CATEGORY_ORDER, getCombinationRules } from '@/types/discount';
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
  const eligibleDiscounts = filterEligibleDiscounts(availableDiscounts, preset, {
    totalAmount,
    totalQuantity,
  });

  console.log(`적용 가능한 할인규칙: ${eligibleDiscounts.length}개`);

  // 프로모션과 충돌하는 할인규칙 제외
  const nonConflictingDiscounts = eligibleDiscounts.filter(discount => {
    for (const { promotion } of itemsWithPromotions) {
      if (promotion && checkDiscountConflict(discount, promotion)) {
        console.log(`  [충돌 제외] ${discount.name} ↔ ${promotion.name}`);
        return false;
      }
    }
    return true;
  });

  console.log(`충돌 체크 후: ${nonConflictingDiscounts.length}개`);

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

    itemsWithPromotions
      .filter(iwp => iwp.promotion && iwp.promotionDiscount > 0)
      .forEach(iwp => {
        const promoId = String(iwp.promotion!._id);
        const config = iwp.promotion!.config as any;

        // 프로모션 상세 설명 생성
        let promotionDetail = '';
        if (config.giftSelectionType === 'combo') {
          promotionDetail = `${iwp.item.productName || iwp.item.productBarcode} 구매 시 다른 상품 증정`;
        } else {
          const quantity = iwp.item.quantity;
          const buyQty = config.buyQuantity || 1;
          const getQty = config.getQuantity || 1;
          const sets = Math.floor(quantity / (buyQty + getQty));
          const freeItems = sets * getQty;

          promotionDetail = `${iwp.item.productName || iwp.item.productBarcode} ${quantity}개 중 ${freeItems}개 증정`;
        }

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

    const promotionOnlyResult: DiscountCombination = {
      discountIds: Array.from(new Set(itemsWithPromotions
        .filter(iwp => iwp.promotion)
        .map(iwp => String(iwp.promotion!._id)))),
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

      // 프로모션 적용 후 가격으로 계산
      // TODO: 여기서 프로모션 적용 후 가격을 반영한 계산이 필요
      // 현재는 기존 calculateCombinationDiscount 사용
      const calculation = calculateCombinationDiscount(
        cartItems,
        sortedDiscounts,
        preset
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

      // 프로모션을 ID별로 그룹화하고 상품 정보 추가
      itemsWithPromotions
        .filter(iwp => iwp.promotion && iwp.promotionDiscount > 0)
        .forEach(iwp => {
          const promoId = String(iwp.promotion!._id);
          const config = iwp.promotion!.config as any;

          // 프로모션 상세 설명 생성
          let promotionDetail = '';
          if (config.giftSelectionType === 'combo') {
            // 콤보 프로모션 (크로스 증정)
            promotionDetail = `${iwp.item.productName || iwp.item.productBarcode} 구매 시 다른 상품 증정`;
          } else {
            // Same/Cross 프로모션
            const quantity = iwp.item.quantity;
            const buyQty = config.buyQuantity || 1;
            const getQty = config.getQuantity || 1;
            const sets = Math.floor(quantity / (buyQty + getQty));
            const freeItems = sets * getQty;

            promotionDetail = `${iwp.item.productName || iwp.item.productBarcode} ${quantity}개 중 ${freeItems}개 증정`;
          }

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

      const discountBreakdown = [
        ...(calculation.discountBreakdown || []),
        ...Array.from(promotionBreakdownMap.values()),
      ];

      results.push({
        discountIds: [
          ...sortedDiscounts.map(d => String(d._id)),
          ...itemsWithPromotions.filter(iwp => iwp.promotion).map(iwp => String(iwp.promotion!._id)),
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
