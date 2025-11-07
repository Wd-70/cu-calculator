/**
 * 프로모션 적용 로직
 *
 * 프로모션은 개별 상품 단위로 적용되며, 조합 최적화가 필요 없습니다.
 * 각 상품에 대해 적용 가능한 프로모션을 찾아 가장 할인이 큰 것을 선택합니다.
 */

import { IDiscountRule, DiscountConfig } from '@/types/discount';

export interface CartItem {
  productId: string | { toString(): string };
  productBarcode: string;
  productName?: string;
  productCategory?: string;
  productCategories?: string[]; // 모든 카테고리 이름 배열
  productBrand?: string;
  unitPrice: number;
  quantity: number;
}

export interface PromotionApplicationResult {
  item: CartItem;
  promotion: IDiscountRule | null;
  promotionDiscount: number;
  priceAfterPromotion: number;
}

export interface CrossPromotionPair {
  buyItem: CartItem;
  giftItem: CartItem;
  promotion: IDiscountRule;
  giftDiscount: number;
}

export interface CartPromotionResult {
  itemsWithPromotions: PromotionApplicationResult[];
  crossPromotionPairs: CrossPromotionPair[];
  warnings: string[];
  totalPromotionDiscount: number;
}

/**
 * 프로모션이 현재 유효한지 확인
 */
function isPromotionValid(
  promotion: IDiscountRule,
  currentDate: Date = new Date()
): boolean {
  if (!promotion.isActive) return false;

  const validFrom = new Date(promotion.validFrom);
  const validTo = new Date(promotion.validTo);

  return currentDate >= validFrom && currentDate <= validTo;
}

/**
 * 프로모션이 상품에 적용 가능한지 확인
 */
function isPromotionApplicableToProduct(
  promotion: IDiscountRule,
  item: CartItem
): boolean {
  // 전체 상품 대상
  if (
    promotion.applicableProducts.length === 0 &&
    promotion.applicableCategories.length === 0 &&
    (!promotion.applicableBrands || promotion.applicableBrands.length === 0)
  ) {
    return true;
  }

  // 특정 상품 대상 (바코드로 비교)
  if (
    promotion.applicableProducts.length > 0 &&
    promotion.applicableProducts.includes(item.productBarcode)
  ) {
    return true;
  }

  // 특정 카테고리 대상
  if (promotion.applicableCategories.length > 0) {
    // 상품의 모든 카테고리 중 하나라도 프로모션 대상 카테고리에 포함되는지 확인
    const hasMatchingCategory = item.productCategories?.some(category =>
      promotion.applicableCategories.includes(category)
    ) || false;

    if (hasMatchingCategory) {
      return true;
    }
  }

  // 특정 브랜드 대상
  if (
    item.productBrand &&
    promotion.applicableBrands &&
    promotion.applicableBrands.length > 0 &&
    promotion.applicableBrands.includes(item.productBrand)
  ) {
    return true;
  }

  return false;
}

/**
 * 프로모션 할인 계산 (Same/Cross 프로모션)
 */
function calculatePromotionDiscount(
  unitPrice: number,
  quantity: number,
  config: Extract<DiscountConfig, { category: 'promotion' }>
): number {
  const { buyQuantity, getQuantity, giftSelectionType } = config;

  // 콤보 프로모션은 장바구니 레벨에서 처리
  if (giftSelectionType === 'combo') {
    return 0;
  }

  // Same/Cross 프로모션 (같은 상품 또는 교차 증정)
  const setSize = buyQuantity + getQuantity;
  const setsApplied = Math.floor(quantity / setSize);
  const freeItems = setsApplied * getQuantity;

  return freeItems * unitPrice;
}

/**
 * 개별 상품에 적용 가능한 프로모션 필터링
 */
export function filterPromotionsForItem(
  item: CartItem,
  promotions: IDiscountRule[],
  cartItems: CartItem[],
  currentDate: Date = new Date()
): IDiscountRule[] {
  return promotions.filter(promo => {
    // 프로모션만 처리
    if (promo.config.category !== 'promotion') return false;

    // 유효성 체크
    if (!isPromotionValid(promo, currentDate)) return false;

    // 상품 적용 대상 체크
    if (!isPromotionApplicableToProduct(promo, item)) return false;

    // 콤보 증정: 증정 상품 존재 여부 확인
    const config = promo.config as Extract<DiscountConfig, { category: 'promotion' }>;
    if (config.giftSelectionType === 'combo') {
      // 현재 상품이 구매 상품인 경우만 체크
      if (config.giftProducts && config.giftProducts.includes(item.productBarcode)) {
        // 증정 상품인 경우 프로모션 적용 안 함 (구매 상품에서만 트리거)
        return false;
      }

      // 증정 상품이 장바구니에 있는지 확인
      const hasGiftProduct = config.giftProducts?.some(giftBarcode =>
        cartItems.some(cartItem => cartItem.productBarcode === giftBarcode)
      );

      if (!hasGiftProduct) return false;
    }

    return true;
  });
}

/**
 * 가장 할인이 큰 프로모션 선택
 */
export function selectBestPromotionForItem(
  item: CartItem,
  applicablePromotions: IDiscountRule[]
): { promotion: IDiscountRule | null; discount: number } {
  if (applicablePromotions.length === 0) {
    return { promotion: null, discount: 0 };
  }

  // 각 프로모션의 할인액 계산
  const promotionsWithDiscounts = applicablePromotions.map(promo => {
    const config = promo.config as Extract<DiscountConfig, { category: 'promotion' }>;
    const discount = calculatePromotionDiscount(item.unitPrice, item.quantity, config);

    return {
      promotion: promo,
      discount
    };
  });

  // 할인액 기준 내림차순 정렬
  promotionsWithDiscounts.sort((a, b) => b.discount - a.discount);

  // 데이터 오류 경고 (2개 이상 존재)
  if (applicablePromotions.length > 1) {
    console.warn(
      `[프로모션 중복] 상품 ${item.productBarcode}(${item.productName || ''})에 ${applicablePromotions.length}개 프로모션 적용 가능:`,
      applicablePromotions.map(p => p.name)
    );
    console.warn('  → 가장 할인이 큰 프로모션 선택:', promotionsWithDiscounts[0].promotion.name);
  }

  return promotionsWithDiscounts[0];
}

/**
 * 크로스 프로모션 할인액 계산
 */
function calculateCrossPromotionDiscount(
  buyItem: CartItem,
  giftItem: CartItem,
  promotion: IDiscountRule
): number {
  const config = promotion.config as Extract<DiscountConfig, { category: 'promotion' }>;
  const { buyQuantity, getQuantity } = config;

  // 구매 상품 수량으로 적용 가능 세트 수 계산
  const setsApplied = Math.floor(buyItem.quantity / buyQuantity);

  if (setsApplied <= 0) return 0;

  // 무료로 받을 수 있는 증정 상품 수량
  const freeGifts = Math.min(setsApplied * getQuantity, giftItem.quantity);

  // 할인 금액 = 증정 상품 가격 × 무료 수량
  return giftItem.unitPrice * freeGifts;
}

/**
 * 장바구니 전체에 프로모션 적용
 *
 * 각 상품에 대해 독립적으로 최적 프로모션을 선택합니다.
 * 조합 최적화는 하지 않습니다 (불필요).
 */
export function applyPromotionsToCart(
  items: CartItem[],
  promotions: IDiscountRule[],
  currentDate: Date = new Date(),
  verbose: boolean = false
): CartPromotionResult {
  const itemsWithPromotions: PromotionApplicationResult[] = [];
  const crossPromotionPairs: CrossPromotionPair[] = [];
  const warnings: string[] = [];
  const appliedCrossPromotions = new Set<string>(); // 중복 적용 방지

  if (verbose) {
    console.log('\n[프로모션 적용 시작]');
    console.log(`  장바구니 상품: ${items.length}개`);
    console.log(`  사용 가능 프로모션: ${promotions.length}개`);
  }

  // 1단계: Same/Cross 프로모션 적용
  for (const item of items) {
    // 적용 가능한 프로모션 찾기
    const applicable = filterPromotionsForItem(item, promotions, items, currentDate);

    if (verbose && applicable.length > 0) {
      console.log(`\n  [상품] ${item.productBarcode} (${item.productName || ''})`);
      console.log(`    적용 가능 프로모션: ${applicable.length}개`);
      applicable.forEach(p => console.log(`      - ${p.name}`));
    }

    // 최선의 프로모션 선택
    const { promotion, discount } = selectBestPromotionForItem(item, applicable);

    if (verbose && promotion) {
      console.log(`    ✅ 선택: ${promotion.name} (${discount.toLocaleString()}원 할인)`);
    }

    const priceAfterPromotion = (item.unitPrice * item.quantity) - discount;

    itemsWithPromotions.push({
      item,
      promotion,
      promotionDiscount: discount,
      priceAfterPromotion
    });
  }

  // 2단계: 콤보 프로모션 처리
  if (verbose) {
    console.log('\n[콤보 프로모션 검사]');
  }

  for (const { item, promotion } of itemsWithPromotions) {
    if (!promotion) continue;

    const config = promotion.config as Extract<DiscountConfig, { category: 'promotion' }>;

    if (config.giftSelectionType === 'combo') {
      // 증정 상품 찾기
      const giftBarcodes = config.giftProducts || [];

      for (const giftBarcode of giftBarcodes) {
        const giftItemWithPromo = itemsWithPromotions.find(
          iwp => iwp.item.productBarcode === giftBarcode
        );

        if (!giftItemWithPromo) continue;

        const giftItem = giftItemWithPromo.item;

        // 중복 적용 방지
        const promotionKey = `${promotion._id}_${giftItem.productBarcode}`;
        if (appliedCrossPromotions.has(promotionKey)) {
          if (verbose) {
            console.log(`  [스킵] ${promotion.name} - 이미 적용됨`);
          }
          continue;
        }

        // 할인액 계산
        const giftDiscount = calculateCrossPromotionDiscount(item, giftItem, promotion);

        if (giftDiscount > 0) {
          if (verbose) {
            console.log(`  ✅ [콤보] ${promotion.name}`);
            console.log(`      구매: ${item.productBarcode} ${item.quantity}개`);
            console.log(`      증정: ${giftBarcode} (${giftDiscount.toLocaleString()}원 할인)`);
          }

          crossPromotionPairs.push({
            buyItem: item,
            giftItem,
            promotion,
            giftDiscount
          });

          // 증정 상품의 프로모션 할인액 업데이트
          giftItemWithPromo.promotionDiscount += giftDiscount;
          giftItemWithPromo.priceAfterPromotion -= giftDiscount;

          appliedCrossPromotions.add(promotionKey);
        } else {
          warnings.push(
            `'${promotion.name}' 프로모션: 구매 상품 ${config.buyQuantity}개 이상 필요`
          );
        }
      }
    }
  }

  // 전체 프로모션 할인액 계산
  const totalPromotionDiscount = itemsWithPromotions.reduce(
    (sum, iwp) => sum + iwp.promotionDiscount,
    0
  );

  if (verbose) {
    console.log(`\n[프로모션 적용 완료]`);
    console.log(`  총 할인액: ${totalPromotionDiscount.toLocaleString()}원`);
  }

  return {
    itemsWithPromotions,
    crossPromotionPairs,
    warnings,
    totalPromotionDiscount
  };
}
