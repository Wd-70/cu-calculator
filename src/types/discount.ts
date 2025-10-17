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
  | 'payment_compound'; // 결제 할인(누적형) - 오키클럽, 청구할인 카드

export const DISCOUNT_CATEGORY_ORDER: Record<DiscountCategory, number> = {
  coupon: 1,
  telecom: 2,
  payment_event: 3,
  voucher: 4,
  payment_instant: 5,
  payment_compound: 6,
};

export const DISCOUNT_CATEGORY_NAMES: Record<DiscountCategory, string> = {
  coupon: '구독',
  telecom: '통신사 할인',
  payment_event: '결제행사 할인',
  voucher: '금액권',
  payment_instant: '결제 할인(독립형)',
  payment_compound: '결제 할인(누적형)',
};

// ============================================================================
// 할인 값 타입
// ============================================================================

export type DiscountValueType =
  | 'percentage'        // 퍼센트 할인 (예: 25%)
  | 'fixed_amount'      // 고정 금액 할인 (예: 1000원)
  | 'tiered_amount'     // 구간 금액 할인 (예: 1천원당 300원)
  | 'voucher_amount';   // 금액권 차감

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

  // 구간 방식 (예: 1천원당 300원)
  tierUnit?: number; // 1000 (1천원)
  tierAmount?: number; // 300 (300원)

  provider: string; // 우주패스, SKT, KT알뜰, etc.
  canCombineWithMembership?: boolean; // CU멤버십/네이버플러스와 중복 가능 여부
}

// ============================================================================
// 결제행사 할인
// ============================================================================

export interface PaymentEventDiscount {
  category: 'payment_event';
  valueType: 'percentage' | 'fixed_amount';

  percentage?: number; // 퍼센트 방식
  fixedAmount?: number; // 고정 금액 방식

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
// 통합 할인 타입
// ============================================================================

export type DiscountConfig =
  | CouponDiscount
  | TelecomDiscount
  | PaymentEventDiscount
  | VoucherDiscount
  | PaymentInstantDiscount
  | PaymentCompoundDiscount;

// ============================================================================
// 할인 적용 방식
// ============================================================================

export type DiscountApplicationMethod =
  | 'per_item'      // 상품별 개별 적용 (각 상품에 개별적으로 할인 적용)
  | 'cart_total';   // 장바구니 전체 합산 후 적용

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
  applicableProducts: Types.ObjectId[]; // 빈 배열 = 전체 상품
  applicableCategories: string[]; // 빈 배열 = 전체 카테고리
  applicableBrands?: string[];

  // 결제수단 제약
  requiredPaymentMethods: PaymentMethod[];
  paymentMethodNames: string[];

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
