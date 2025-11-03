import mongoose, { Schema, Model } from 'mongoose';
import { IDiscountRule, DiscountConfig } from '@/types/discount';

/**
 * DiscountConfig를 위한 서브스키마
 * 7가지 할인 카테고리를 지원 (프로모션 추가)
 */
const DiscountConfigSchema = new Schema({
  category: {
    type: String,
    required: true,
    enum: ['coupon', 'telecom', 'payment_event', 'voucher', 'payment_instant', 'payment_compound', 'promotion'],
  },
  valueType: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed_amount', 'tiered_amount', 'voucher_amount', 'buy_n_get_m'],
  },

  // 공통 필드
  percentage: Number,
  fixedAmount: Number,

  // 통신사 할인 (구간 방식)
  tierUnit: Number,
  tierAmount: Number,
  provider: String,
  canCombineWithMembership: Boolean,

  // 결제행사 할인
  requiresQR: Boolean,
  eventName: String,
  restrictedProviders: [String],
  blockedInPocketCU: Boolean,

  // 금액권
  amount: Number,
  voucherType: String,
  voucherName: String,

  // 결제 할인(독립형)
  isNaverPlus: Boolean,
  canCombineWithNaverCard: Boolean,

  // 쿠폰 할인
  subscriptionCost: Number,
  usageLimit: Number,

  // 프로모션 할인 (1+1, 2+1 등)
  buyQuantity: Number,
  getQuantity: Number,
  promotionType: String,
  giftSelectionType: {
    type: String,
    enum: ['same', 'cross', 'combo'],
  },
  giftProducts: [String],
  giftCategories: [String],
  giftBrands: [String],
}, { _id: false });

/**
 * 할인 결합 규칙 서브스키마
 */
const CombinationRulesSchema = new Schema({
  cannotCombineWithCategories: [String], // 특정 카테고리와 중복 불가
  cannotCombineWithIds: [Schema.Types.Mixed], // 특정 할인 ID와 중복 불가
  cannotCombineWithPromotionGiftTypes: [{
    type: String,
    enum: ['same', 'cross', 'combo'], // 특정 프로모션 증정방식과 중복 불가
  }],
  requiresDiscountId: Schema.Types.Mixed, // 의존성: 특정 할인이 먼저 적용되어야 함
}, { _id: false, toJSON: { getters: true }, toObject: { getters: true } });

/**
 * 할인 적용 제약 조건 서브스키마
 */
const ConstraintsSchema = new Schema({
  minPurchaseAmount: Number, // 최소 구매 금액
  minQuantity: Number, // 최소 구매 수량
  maxDiscountAmount: Number, // 최대 할인 금액
  maxDiscountPerItem: Number, // 상품당 최대 할인 금액
  dailyUsageLimit: Number, // 일일 사용 횟수 제한
  totalUsageLimit: Number, // 총 사용 횟수 제한
  usageResetTime: String, // 사용 횟수 리셋 시간
}, { _id: false, toJSON: { getters: true }, toObject: { getters: true } });

const DiscountRuleSchema = new Schema<IDiscountRule>(
  {
    name: {
      type: String,
      required: true,
    },
    description: String,

    // 1. 할인 메커니즘
    config: {
      type: DiscountConfigSchema,
      required: true,
    },
    applicationMethod: {
      type: String,
      enum: ['per_item', 'cart_total'],
      default: 'cart_total',
    },

    // 2. 적용 대상
    applicableProducts: [String], // 바코드 배열
    applicableCategories: [String],
    applicableBrands: [String],

    // 3. 결제수단 요구사항
    requiredPaymentMethods: [String],
    paymentMethodNames: [String],

    // 4. 할인 결합 규칙 (신규 구조)
    combinationRules: CombinationRulesSchema,

    // 5. 적용 제약 조건 (신규 구조)
    constraints: ConstraintsSchema,

    // 6. 행사 정보
    eventMonth: String,
    eventName: String,
    isRecurring: {
      type: Boolean,
      default: false,
    },

    // 7. 유효 기간
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },

    // 8. 메타데이터
    sourceUrl: String,
    lastCrawledAt: Date,
    priority: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // 위키형 시스템: 생성자 및 수정 이력
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    lastModifiedBy: {
      type: String,
      required: true,
    },
    modificationHistory: [{
      modifiedBy: String,
      modifiedAt: Date,
      changes: Schema.Types.Mixed,
      comment: String,
    }],

    // ===== 하위 호환성을 위한 레거시 필드 =====
    cannotCombineWithCategories: [String],
    cannotCombineWithIds: [Schema.Types.Mixed],
    cannotCombineWithPromotionGiftTypes: [{
      type: String,
      enum: ['same', 'cross', 'combo'],
    }],
    requiresDiscountId: Schema.Types.Mixed,
    minPurchaseAmount: Number,
    minQuantity: Number,
    maxDiscountAmount: Number,
    maxDiscountPerItem: Number,
    dailyUsageLimit: Number,
    totalUsageLimit: Number,
    usageResetTime: String,
  },
  {
    timestamps: true,
    minimize: false, // 빈 객체도 포함하도록 설정
    toJSON: { getters: true, virtuals: false },
    toObject: { getters: true, virtuals: false },
  }
);

// Indexes for better query performance
DiscountRuleSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });
DiscountRuleSchema.index({ 'config.category': 1, isActive: 1 });
DiscountRuleSchema.index({ eventMonth: 1, isActive: 1 });
DiscountRuleSchema.index({ applicableProducts: 1 });
DiscountRuleSchema.index({ applicableCategories: 1 });

const DiscountRule: Model<IDiscountRule> =
  mongoose.models.DiscountRule || mongoose.model<IDiscountRule>('DiscountRule', DiscountRuleSchema);

export default DiscountRule;
