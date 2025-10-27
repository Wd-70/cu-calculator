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
  | 'promotion';       // 프로모션 할인 (1+1, 2+1 등)

export const DISCOUNT_CATEGORY_ORDER: Record<DiscountCategory, number> = {
  promotion: 1,        // 프로모션(1+1, 2+1)이 가장 먼저 적용
  coupon: 2,
  telecom: 3,
  payment_event: 4,    // 결제행사는 프로모션 이후 적용
  voucher: 5,
  payment_instant: 6,
  payment_compound: 7,
};

export const DISCOUNT_CATEGORY_NAMES: Record<DiscountCategory, string> = {
  coupon: '구독',
  telecom: '통신사 할인',
  payment_event: '결제행사 할인',
  voucher: '금액권',
  payment_instant: '결제 할인(독립형)',
  payment_compound: '결제 할인(누적형)',
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
  dailyUsageLimit?: number; // 하루 사용 횟수 제한
  totalUsageLimit?: number; // 구독 기간 내 총 사용 가능 횟수
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
// 프로모션 할인 (1+1, 2+1 등)
// ============================================================================

export interface PromotionDiscount {
  category: 'promotion';
  valueType: 'buy_n_get_m';

  buyQuantity: number; // 구매해야 하는 수량 (예: 1+1의 경우 1, 2+1의 경우 2)
  getQuantity: number; // 무료로 받는 수량 (예: 1+1의 경우 1, 2+1의 경우 1)
  promotionType: string; // 프로모션 이름 (예: '1+1', '2+1', '3+1')
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
  allowedChannels?: ('card' | 'money')[];

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

  // 간편결제 채널 (카드/머니)
  channel?: 'direct_card' | 'card' | 'money';

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
// 할인 규칙 (데이터베이스 모델)
// ============================================================================

export interface IDiscountRuleV2 {
  _id: Types.ObjectId | string;
  name: string;
  description?: string;

  // 할인 설정
  config: DiscountConfig;

  // 적용 방식 (기본값: cart_total)
  applicationMethod?: DiscountApplicationMethod;

  // 적용 대상
  applicableProducts: string[]; // 바코드 배열 - 빈 배열 = 전체 상품
  applicableCategories: string[]; // 빈 배열 = 전체 카테고리
  applicableBrands?: string[];

  // 결제수단 제약 (레거시)
  requiredPaymentMethods: PaymentMethod[];
  paymentMethodNames: string[];

  // 결제수단 상세 제약 (신규)
  paymentMethodRequirements?: PaymentMethodRequirement[];

  // 결제수단 예외 처리
  allowedExceptions?: PaymentMethodException[]; // 기본 규칙에서 차단되지만 허용되는 예외
  blockedExceptions?: PaymentMethodException[]; // 기본 규칙에서 허용되지만 차단되는 예외

  // 중복 적용 규칙
  cannotCombineWithCategories?: DiscountCategory[]; // 특정 카테고리와 중복 불가
  cannotCombineWithIds?: (Types.ObjectId | string)[]; // 특정 할인과 중복 불가
  requiresDiscountId?: Types.ObjectId | string; // 특정 할인이 먼저 적용되어야 함

  // 최소 구매 조건
  minPurchaseAmount?: number;
  minQuantity?: number;

  // 최대 할인 제한
  maxDiscountAmount?: number;
  maxDiscountPerItem?: number;

  // 사용 횟수 제한
  dailyUsageLimit?: number; // 일일 사용 횟수 제한 (예: 1)
  totalUsageLimit?: number; // 총 사용 횟수 제한
  usageResetTime?: string; // 사용 횟수 리셋 시간 (예: "00:00")

  // 행사 정보
  eventMonth?: string; // 예: "2025-01"
  eventName?: string;
  isRecurring?: boolean;

  // 유효 기간
  validFrom: Date;
  validTo: Date;

  // 메타데이터
  sourceUrl?: string;
  lastCrawledAt?: Date;
  priority?: number; // 동일 카테고리 내 우선순위

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
