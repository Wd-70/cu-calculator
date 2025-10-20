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
}, { _id: false });

const DiscountRuleSchema = new Schema<IDiscountRule>(
  {
    name: {
      type: String,
      required: true,
    },
    description: String,

    // 할인 설정 (v2)
    config: {
      type: DiscountConfigSchema,
      required: true,
    },

    // 적용 대상
    applicableProducts: [String], // 바코드 배열
    applicableCategories: [String],
    applicableBrands: [String],

    // 결제수단 제약
    requiredPaymentMethods: [String],
    paymentMethodNames: [String],

    // 중복 적용 규칙 (v2)
    cannotCombineWithCategories: [String],
    cannotCombineWithIds: [Schema.Types.Mixed],
    requiresDiscountId: Schema.Types.Mixed,

    // 최소 구매 조건
    minPurchaseAmount: Number,
    minQuantity: Number,

    // 최대 할인 제한
    maxDiscountAmount: Number,
    maxDiscountPerItem: Number,

    // 행사 정보
    eventMonth: String,
    eventName: String,
    isRecurring: {
      type: Boolean,
      default: false,
    },

    // 유효 기간
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },

    // 메타데이터
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
  },
  {
    timestamps: true,
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
