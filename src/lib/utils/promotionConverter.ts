/**
 * 프로모션을 할인 규칙으로 변환하는 유틸리티
 * Promotion 데이터를 IDiscountRule 형식으로 변환하여 할인 계산 시스템에 통합
 */

import { IDiscountRuleV2, PromotionDiscount } from '@/types/discount';

/**
 * 프로모션 데이터 인터페이스 (Promotion 모델)
 */
export interface IPromotion {
  _id: any;
  name: string;
  description: string;
  promotionType: '1+1' | '2+1' | '3+1' | 'custom';
  buyQuantity: number;
  getQuantity: number;
  applicableType: 'products' | 'categories' | 'brands';
  applicableProducts?: string[];
  applicableCategories?: string[];
  applicableBrands?: string[];
  giftSelectionType: 'same' | 'cross';
  giftProducts?: string[];
  giftCategories?: string[];
  giftBrands?: string[];
  giftConstraints?: {
    maxGiftPrice?: number;
    mustBeCheaperThanPurchased?: boolean;
    mustBeSameProduct?: boolean;
  };
  constraints?: {
    maxApplicationsPerCart?: number;
    minPurchaseAmount?: number;
    excludedProducts?: string[];
  };
  validFrom: Date;
  validTo: Date;
  status: string;
  isActive: boolean;
  priority: number;
  sourceUrl?: string;
}

/**
 * 프로모션을 할인 규칙으로 변환
 */
export function convertPromotionToDiscountRule(promotion: IPromotion): IDiscountRuleV2 {
  console.log(`[프로모션 변환] ${promotion.name}`);
  console.log(`  타입: ${promotion.promotionType}, 구매: ${promotion.buyQuantity}, 증정: ${promotion.getQuantity}`);
  console.log(`  적용 타입: ${promotion.applicableType}`);
  console.log(`  증정 방식: ${promotion.giftSelectionType}`);

  // 프로모션 config 생성
  const config: PromotionDiscount = {
    category: 'promotion',
    valueType: 'buy_n_get_m',
    buyQuantity: promotion.buyQuantity,
    getQuantity: promotion.getQuantity,
    promotionType: promotion.promotionType,
    giftSelectionType: promotion.giftSelectionType,
    giftProducts: promotion.giftProducts,
    giftCategories: promotion.giftCategories,
    giftBrands: promotion.giftBrands,
  };

  // 적용 대상 상품 결정
  let applicableProducts: string[] = [];
  if (promotion.applicableType === 'products' && promotion.applicableProducts) {
    applicableProducts = promotion.applicableProducts;
    console.log(`  적용 상품: ${applicableProducts.length}개`, applicableProducts);
  }

  // 할인 규칙으로 변환
  const discountRule: IDiscountRuleV2 = {
    _id: promotion._id,
    name: promotion.name,
    description: promotion.description,
    config,
    applicableProducts,
    applicableCategories: promotion.applicableType === 'categories' && promotion.applicableCategories
      ? promotion.applicableCategories
      : [],
    applicableBrands: promotion.applicableType === 'brands' && promotion.applicableBrands
      ? promotion.applicableBrands
      : [],
    requiredPaymentMethods: [],
    paymentMethodNames: [],
    validFrom: new Date(promotion.validFrom),
    validTo: new Date(promotion.validTo),
    isActive: promotion.isActive,
    priority: promotion.priority,
    sourceUrl: promotion.sourceUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 최대 적용 횟수 제한
  if (promotion.constraints?.maxApplicationsPerCart) {
    discountRule.dailyUsageLimit = promotion.constraints.maxApplicationsPerCart;
  }

  // 최소 구매 금액
  if (promotion.constraints?.minPurchaseAmount) {
    discountRule.minPurchaseAmount = promotion.constraints.minPurchaseAmount;
  }

  return discountRule;
}

/**
 * 여러 프로모션을 한 번에 변환
 */
export function convertPromotionsToDiscountRules(promotions: IPromotion[]): IDiscountRuleV2[] {
  return promotions.map(convertPromotionToDiscountRule);
}

/**
 * 프로모션이 특정 상품에 적용 가능한지 확인
 */
export function isPromotionApplicableToProduct(
  promotion: IPromotion,
  productBarcode: string,
  productCategory?: string,
  productBrand?: string
): boolean {
  // 제외 상품 체크
  if (promotion.constraints?.excludedProducts?.includes(productBarcode)) {
    return false;
  }

  // 적용 대상 타입별 체크
  switch (promotion.applicableType) {
    case 'products':
      return promotion.applicableProducts?.includes(productBarcode) || false;

    case 'categories':
      return productCategory
        ? promotion.applicableCategories?.includes(productCategory) || false
        : false;

    case 'brands':
      return productBrand
        ? promotion.applicableBrands?.includes(productBrand) || false
        : false;

    default:
      return false;
  }
}

/**
 * 크로스 증정 프로모션인지 확인
 */
export function isCrossPromotion(promotion: IPromotion): boolean {
  return promotion.giftSelectionType === 'cross';
}

/**
 * 크로스 증정 시 증정 상품 목록 가져오기
 */
export function getGiftProducts(promotion: IPromotion): string[] {
  if (promotion.giftSelectionType !== 'cross') {
    return [];
  }

  if (promotion.giftProducts && promotion.giftProducts.length > 0) {
    return promotion.giftProducts;
  }

  // 카테고리나 브랜드 기반 증정은 여기서는 빈 배열 반환
  // 실제 적용 시 장바구니 상품에서 조건에 맞는 것을 찾아야 함
  return [];
}
