import { Types } from 'mongoose';
import { PaymentMethod } from './payment';

/**
 * CU 할인 계산기 v2 타입 정의
 * 엑셀 분석 결과를 반영한 새로운 할인 시스템
 */

// ============================================================================
// 6가지 할인 카테고리
// ============================================================================

export type DiscountCategory =
  | 'coupon'           // 쿠폰 할인 (구독, 상품 할인 쿠폰 등)
  | 'telecom'          // 통신사 할인 (우주패스, SKT, KT알뜰 등)
  | 'payment_event'    // 결제행사 할인 (CU 결제행사)
  | 'voucher'          // 금액권 (CU 상품권, 포인트)
  | 'payment_instant'  // 결제 할인(독립형) - 네플, 즉시할인 카드
  | 'payment_compound' // 결제 할인(누적형) - 오키클럽, 청구할인 카드
  | 'event'            // 이벤트 할인 (행사 기간 한정 할인)
  | 'promotion';       // 프로모션 할인 (1+1, 2+1 등)

export const DISCOUNT_CATEGORY_ORDER: Record<DiscountCategory, number> = {
  promotion: 1,        // 프로모션(1+1, 2+1)이 가장 먼저 적용
  coupon: 2,
  telecom: 3,
  event: 4,            // 이벤트 할인
  payment_event: 5,    // 결제행사는 프로모션 이후 적용
  voucher: 6,
  payment_instant: 7,
  payment_compound: 8,
};

export const DISCOUNT_CATEGORY_NAMES: Record<DiscountCategory, string> = {
  coupon: '구독',
  telecom: '통신사 할인',
  payment_event: '결제행사 할인',
  voucher: '금액권',
  payment_instant: '결제 할인(독립형)',
  payment_compound: '결제 할인(누적형)',
  event: '이벤트 할인',
  promotion: '프로모션',
};

// ============================================================================
// 할인 값 타입
// ============================================================================

export type DiscountValueType =
  | 'percentage'        // 퍼센트 할인 (예: 25%)
  | 'fixed_amount'      // 고정 금액 할인 (예: 1000원)
  | 'tiered_amount'     // 구간 금액 할인 (예: 1천원당 300원)
  | 'voucher_amount'    // 금액권 차감
  | 'buy_n_get_m';      // N개 구매 시 M개 무료 (1+1, 2+1 등)

// ============================================================================
// 상품 그룹 (세트 상품)
// ============================================================================

export interface ProductGroup {
  name: string; // 그룹 이름 (예: "GET아이스아메리카노XL")
  barcodes: string[]; // 그룹에 포함되는 상품 바코드들 (예: ["2201148643502", "8809197840107"])
  countAs: number; // 개수 카운트 (예: 1 - 그룹 전체를 1개로 카운트)
}

// ============================================================================
// 쿠폰 할인
// ============================================================================

export interface CouponDiscount {
  category: 'coupon';
  valueType: 'percentage';
  percentage: number; // 예: 25 (25% 할인)

  // 구독 쿠폰 관련
  isSubscription?: boolean; // 구독 쿠폰 여부
  subscriptionCost?: number; // 구독료 (원)
  subscriptionPeriodDays?: number; // 구독 기간 (일)
  dailyUsageLimit?: number; // 하루 사용 횟수 제한 (레거시, 호환성 유지)
  totalUsageLimit?: number; // 구독 기간 내 총 사용 가능 횟수 (레거시, 호환성 유지)

  // 일일 상품 개수 제한 (개별 상품 단위 제한)
  itemLimitPerDay?: number; // 하루에 할인 적용 가능한 최대 상품 개수
  totalItemLimit?: number; // 구독 기간 동안 할인 적용 가능한 총 상품 개수
  itemSelectionMethod?: 'highest_price' | 'most_expensive' | 'cheapest' | 'first_come'; // 상품 선택 방식

  // 상품 그룹 (세트 상품 처리)
  productGroups?: ProductGroup[]; // 세트로 취급할 상품 그룹들 (예: 아이스 음료 + 얼음컵)
}

// ============================================================================
// 통신사 할인
// ============================================================================

export interface TelecomDiscount {
  category: 'telecom';
  valueType: 'percentage' | 'tiered_amount';

  // 퍼센트 방식 (예: 20%)
  percentage?: number;
  maxDiscountPerMonth?: number; // 월 최대 할인 금액 (예: 5000원)

  // 구간 방식 (예: 1천원당 300원)
  tierUnit?: number; // 1000 (1천원)
  tierAmount?: number; // 300 (300원)

  provider: string; // 우주패스, SKT, KT알뜰, etc.
  canCombineWithMembership?: boolean; // CU멤버십/네이버플러스와 중복 가능 여부
  restrictedProviders?: string[]; // 특정 통신사와 중복 불가 (예: ["KT알뜰"])
}

// ============================================================================
// 결제행사 할인
// ============================================================================

export interface PaymentEventDiscount {
  category: 'payment_event';
  valueType: 'percentage' | 'fixed_amount';

  percentage?: number; // 퍼센트 방식
  fixedAmount?: number; // 고정 금액 방식

  // 할인 계산 기준 금액
  baseAmountType?: 'original_price' | 'current_amount'; // 기본값: original_price (정가 기준)
  // 'original_price': 정가 기준으로 할인 계산
  // 'current_amount': 이전 할인 적용 후 금액 기준으로 할인 계산 (프로모션 적용 후 등)

  requiresQR?: boolean; // QR코드 제시 필요 여부
  eventName: string;
  restrictedProviders?: string[]; // 특정 통신사와 중복 불가 (예: 우주패스)
  blockedInPocketCU?: boolean; // 포켓CU 앱에서 사용 불가
}

// ============================================================================
// 금액권
// ============================================================================

export interface VoucherDiscount {
  category: 'voucher';
  valueType: 'voucher_amount';

  amount: number; // 금액권 금액
  voucherType: 'cu_voucher' | 'point' | 'partner_point';
  voucherName: string; // 예: CU 1천원권, 신세계포인트
}

// ============================================================================
// 결제 할인(독립형)
// ============================================================================

export interface PaymentInstantDiscount {
  category: 'payment_instant';
  valueType: 'percentage';

  percentage: number;
  provider: string; // 네이버플러스, 카드사 등
  isNaverPlus?: boolean; // 네이버플러스 멤버십
  canCombineWithNaverCard?: boolean; // 네이버페이 카드와 중복 가능
}

// ============================================================================
// 결제 할인(누적형)
// ============================================================================

export interface PaymentCompoundDiscount {
  category: 'payment_compound';
  valueType: 'percentage';

  percentage: number;
  provider: string; // 오키클럽, 카드사 등
}

// ============================================================================
// 이벤트 할인
// ============================================================================

export interface EventDiscount {
  category: 'event';
  valueType: 'percentage' | 'fixed_amount';

  // 퍼센트 방식
  percentage?: number; // 퍼센트 할인 (예: 20%)

  // 고정 금액 방식
  fixedAmount?: number; // 고정 금액 할인 (예: 1000원)

  // 이벤트 정보
  eventName?: string; // 행사 이름 (예: "배러10입 단품 할인")
  eventDescription?: string; // 행사 설명
}

// ============================================================================
// 프로모션 할인 (1+1, 2+1 등)
// ============================================================================

export interface PromotionDiscount {
  category: 'promotion';
  valueType: 'buy_n_get_m';

  buyQuantity: number; // 구매해야 하는 수량 (예: 1+1의 경우 1, 2+1의 경우 2)
  getQuantity: number; // 무료로 받는 수량 (예: 1+1의 경우 1, 2+1의 경우 1)
  promotionType: string; // 프로모션 이름 (예: '1+1', '2+1', '3+1')

  // 크로스 프로모션 지원
  giftSelectionType?: 'same' | 'cross' | 'combo'; // same: 동일 상품, cross: 교차 증정, combo: 콤보 증정
  giftProducts?: string[]; // 증정 상품 바코드 목록 (combo인 경우)
  giftCategories?: string[]; // 증정 상품 카테고리 목록 (combo인 경우)
  giftBrands?: string[]; // 증정 상품 브랜드 목록 (combo인 경우)
}

// ============================================================================
// 통합 할인 타입
// ============================================================================

export type DiscountConfig =
  | CouponDiscount
  | TelecomDiscount
  | PaymentEventDiscount
  | VoucherDiscount
  | PaymentInstantDiscount
  | PaymentCompoundDiscount
  | EventDiscount
  | PromotionDiscount;

// ============================================================================
// 할인 적용 방식
// ============================================================================

export type DiscountApplicationMethod =
  | 'per_item'      // 상품별 개별 적용 (각 상품에 개별적으로 할인 적용)
  | 'cart_total';   // 장바구니 전체 합산 후 적용

// ============================================================================
// 결제수단 상세 제약 조건
// ============================================================================

export interface CardIssuerRequirement {
  issuer: 'shinhan' | 'bc' | 'samsung' | 'hana' | 'woori' | 'kb' | 'hyundai' | 'nh' | 'ibk' | 'suhyup';

  // 허용되는 카드 종류 (지정하지 않으면 모든 종류 허용)
  allowedCardTypes?: ('personal_credit' | 'personal_check' | 'corporate' | 'prepaid' | 'gift')[];

  // BC카드 포함 여부 (하나BC, 우리BC 등)
  requiresBCCard?: boolean; // true면 BC카드만, false면 BC카드 제외

  // 허용되는 결제 채널 (지정하지 않으면 모든 채널 허용)
  allowedChannels?: ('direct_card' | 'samsung_pay' | 'naver_pay' | 'kakao_pay' | 'cu_pay')[];

  // 특별 조건 설명 (예: "수협은행, 광주은행 BC카드 포함")
  specialConditions?: string;
}

export interface PaymentMethodRequirement {
  method: PaymentMethod;

  // 카드인 경우 상세 조건
  cardRequirements?: CardIssuerRequirement[];

  // 간편결제인 경우 제약
  allowedChannels?: ('card' | 'money' | 'account')[];

  // 제외되는 간편결제 (카카오페이, 페이코 등)
  excludedSimplePayments?: string[];

  // 복합결제 허용 여부
  allowMixedPayment?: boolean;
}

// ============================================================================
// 결제수단 예외 처리
// ============================================================================

/**
 * 특정 결제 조합을 정의하는 타입
 * 기본 규칙을 덮어쓰는 허용/차단 예외에 사용
 */
export interface PaymentMethodException {
  // 결제수단
  method: PaymentMethod;

  // 간편결제 채널 (카드/머니/계좌)
  channel?: 'direct_card' | 'card' | 'money' | 'account';

  // 카드사
  cardIssuer?: 'shinhan' | 'bc' | 'samsung' | 'hana' | 'woori' | 'kb' | 'hyundai' | 'nh' | 'ibk' | 'suhyup';

  // 카드 종류
  cardType?: 'personal_credit' | 'personal_check' | 'corporate' | 'prepaid' | 'gift';

  // BC카드 여부
  isBCCard?: boolean;

  // 예외 설명 (예: "네이버페이/신한카드 조합 가능 확인됨")
  reason?: string;
}

// ============================================================================
// 할인 결합 규칙
// ============================================================================

export interface DiscountCombinationRules {
  // 카테고리 기반 제약
  cannotCombineWithCategories?: DiscountCategory[]; // 특정 카테고리와 중복 불가

  // 개별 할인 ID 기반 제약
  cannotCombineWithIds?: (Types.ObjectId | string)[]; // 특정 할인과 중복 불가

  // 프로모션 타입 기반 제약 (프로모션 카테고리 전용)
  cannotCombineWithPromotionGiftTypes?: ('same' | 'cross' | 'combo')[]; // 특정 프로모션 증정방식과 중복 불가

  // 의존성
  requiresDiscountId?: Types.ObjectId | string; // 특정 할인이 먼저 적용되어야 함
}

// ============================================================================
// 할인 적용 제약 조건
// ============================================================================

export interface DiscountConstraints {
  // 최소 구매 조건
  minPurchaseAmount?: number; // 최소 구매 금액 (원)
  minQuantity?: number; // 최소 구매 수량

  // 최대 할인 제한
  maxDiscountAmount?: number; // 최대 할인 금액 (원)
  maxDiscountPerItem?: number; // 상품당 최대 할인 금액 (원)

  // 사용 횟수 제한
  dailyUsageLimit?: number; // 일일 사용 횟수 제한 (예: 1) - 레거시
  totalUsageLimit?: number; // 총 사용 횟수 제한 - 레거시
  usageResetTime?: string; // 사용 횟수 리셋 시간 (예: "00:00")

  // 상품 개수 제한 (개별 상품 단위)
  dailyItemLimit?: number; // 하루에 할인 적용 가능한 최대 상품 개수
  totalItemLimit?: number; // 구독 기간 동안 할인 적용 가능한 총 상품 개수
  itemSelectionStrategy?: 'most_expensive' | 'highest_price' | 'cheapest' | 'first_come'; // 상품 선택 전략
}

// ============================================================================
// 할인 규칙 (데이터베이스 모델)
// ============================================================================

export interface IDiscountRuleV2 {
  _id: Types.ObjectId | string;
  name: string;
  description?: string;

  // 1. 할인 메커니즘 (무엇을, 어떻게 할인하는가)
  config: DiscountConfig;
  applicationMethod?: DiscountApplicationMethod; // 적용 방식 (기본값: cart_total)

  // 2. 적용 대상 (어디에 적용되는가)
  applicableProducts: string[]; // 바코드 배열 - 빈 배열 = 전체 상품
  applicableCategories: string[]; // 빈 배열 = 전체 카테고리
  applicableBrands?: string[]; // 빈 배열 = 전체 브랜드

  // 3. 결제수단 요구사항
  requiredPaymentMethods: PaymentMethod[]; // 레거시: 간단한 결제수단 목록
  paymentMethodNames: string[]; // 레거시: 결제수단 이름
  paymentMethodRequirements?: PaymentMethodRequirement[]; // 신규: 상세 결제수단 제약

  // 결제수단 예외 처리
  allowedExceptions?: PaymentMethodException[]; // 기본 규칙에서 차단되지만 허용되는 예외
  blockedExceptions?: PaymentMethodException[]; // 기본 규칙에서 허용되지만 차단되는 예외

  // 4. 할인 결합 규칙 (다른 할인과의 관계)
  combinationRules?: DiscountCombinationRules;

  // 5. 적용 제약 조건 (금액, 수량, 사용 횟수 등)
  constraints?: DiscountConstraints;

  // 6. 행사 정보
  eventMonth?: string; // 예: "2025-01"
  eventName?: string;
  isRecurring?: boolean;

  // 7. 유효 기간
  validFrom: Date;
  validTo: Date;

  // 8. 메타데이터
  sourceUrl?: string;
  lastCrawledAt?: Date;
  priority?: number; // 동일 카테고리 내 우선순위
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // ===== 하위 호환성을 위한 레거시 필드 (새로운 코드에서는 사용 안 함) =====
  // 아래 필드들은 combinationRules와 constraints로 통합되었지만,
  // 기존 데이터베이스 호환성을 위해 유지
  cannotCombineWithCategories?: DiscountCategory[];
  cannotCombineWithIds?: (Types.ObjectId | string)[];
  cannotCombineWithPromotionGiftTypes?: ('same' | 'cross' | 'combo')[];
  requiresDiscountId?: Types.ObjectId | string;
  minPurchaseAmount?: number;
  minQuantity?: number;
  maxDiscountAmount?: number;
  maxDiscountPerItem?: number;
  dailyUsageLimit?: number;
  totalUsageLimit?: number;
  usageResetTime?: string;
}

// ============================================================================
// 계산 결과 타입
// ============================================================================

export interface DiscountApplicationStep {
  category: DiscountCategory;
  discountId: Types.ObjectId | string;
  discountName: string;

  // 계산 기준
  baseAmount: number; // 할인 계산에 사용된 금액
  isOriginalPriceBased: boolean; // 정가 기준 여부

  // 계산 결과
  discountAmount: number; // 할인액
  amountAfterDiscount: number; // 이 할인 적용 후 남은 금액

  // 추가 정보
  calculationDetails?: string; // 계산 과정 설명
}

export interface DiscountCalculationResultV2 {
  originalPrice: number; // 정가
  finalPrice: number; // 최종 금액
  totalDiscount: number; // 총 할인액
  discountRate: number; // 총 할인율 (0~1)

  // 단계별 할인 적용
  steps: DiscountApplicationStep[];

  // 경고 및 오류
  warnings?: string[];
  errors?: string[];
}

// ============================================================================
// 장바구니 계산 타입
// ============================================================================

export interface CartItemDiscounts {
  productId: Types.ObjectId | string;
  productBarcode: string;
  selectedDiscounts: IDiscountRuleV2[]; // 사용자가 선택한 할인들
}

export interface CartCalculationOptionsV2 {
  items: Array<{
    productId: Types.ObjectId | string;
    productBarcode: string; // 바코드 추가
    quantity: number;
    unitPrice: number;
    productCategory?: string;
    productBrand?: string;
  }>;
  discountSelections: CartItemDiscounts[]; // 상품별 선택된 할인
  paymentMethod?: PaymentMethod;
  currentDate?: Date;
  verbose?: boolean; // 상세 로그 출력 여부 (기본값: false)
}

export interface CartItemCalculationResult {
  productId: Types.ObjectId | string;
  quantity: number;
  unitPrice: number;

  itemOriginalPrice: number; // 상품 정가 × 수량
  itemFinalPrice: number; // 할인 후 최종 금액
  itemTotalDiscount: number;
  itemDiscountRate: number;

  calculation: DiscountCalculationResultV2;
}

export interface CartCalculationResultV2 {
  items: CartItemCalculationResult[];

  // 전체 합계
  totalOriginalPrice: number;
  totalFinalPrice: number;
  totalDiscount: number;
  totalDiscountRate: number;

  paymentMethod?: PaymentMethod;
  warnings?: string[];
  errors?: string[];
}

// ============================================================================
// 할인 검증 타입
// ============================================================================

export interface DiscountValidationResultV2 {
  isValid: boolean;
  errors: string[];
  warnings: string[];

  // 중복 체크 결과
  conflictingDiscounts?: Array<{
    discount1: string;
    discount2: string;
    reason: string;
  }>;
}

// ============================================================================
// 할인 추천 타입
// ============================================================================

export interface DiscountRecommendation {
  discounts: IDiscountRuleV2[];
  estimatedSavings: number;
  estimatedSavingsRate: number;
  reason: string;
}

// ============================================================================
// 하위 호환성을 위한 타입 Alias
// ============================================================================

// 기존 코드와의 호환성을 위해 IDiscountRule을 IDiscountRuleV2로 매핑
export type IDiscountRule = IDiscountRuleV2;
export type DiscountCalculationResult = DiscountCalculationResultV2;
export type CartCalculationResult = CartCalculationResultV2;
export type CartCalculationOptions = CartCalculationOptionsV2;
export type DiscountValidationResult = DiscountValidationResultV2;

// ============================================================================
// 헬퍼 함수 - 레거시와 신규 구조 모두 지원
// ============================================================================

/**
 * 할인 결합 규칙 가져오기 (신규 우선, 레거시 폴백)
 */
export function getCombinationRules(discount: IDiscountRule): DiscountCombinationRules {
  if (discount.combinationRules) {
    return discount.combinationRules;
  }

  // 레거시 필드에서 변환
  return {
    cannotCombineWithCategories: discount.cannotCombineWithCategories,
    cannotCombineWithIds: discount.cannotCombineWithIds,
    cannotCombineWithPromotionGiftTypes: discount.cannotCombineWithPromotionGiftTypes,
    requiresDiscountId: discount.requiresDiscountId,
  };
}

/**
 * 할인 제약 조건 가져오기 (신규 우선, 레거시 폴백)
 */
export function getConstraints(discount: IDiscountRule): DiscountConstraints {
  if (discount.constraints) {
    return discount.constraints;
  }

  // 레거시 필드에서 변환
  return {
    minPurchaseAmount: discount.minPurchaseAmount,
    minQuantity: discount.minQuantity,
    maxDiscountAmount: discount.maxDiscountAmount,
    maxDiscountPerItem: discount.maxDiscountPerItem,
    dailyUsageLimit: discount.dailyUsageLimit,
    totalUsageLimit: discount.totalUsageLimit,
    usageResetTime: discount.usageResetTime,
  };
}
