import mongoose, { Schema, Document, Model } from 'mongoose';

export type PromotionType = '1+1' | '2+1' | '3+1' | 'custom';
export type ApplicableType = 'products' | 'categories' | 'brands';
export type GiftSelectionType = 'same' | 'cross' | 'combo'; // same: 동일 상품, cross: 교차 증정, combo: 콤보 증정
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'disputed';
export type PromotionStatus = 'active' | 'expired' | 'archived' | 'merged';

export interface IPromotion extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;

  // 프로모션 타입
  promotionType: PromotionType;
  buyQuantity: number;
  getQuantity: number;

  // 적용 대상 (구매 가능 상품)
  applicableType: ApplicableType;
  applicableProducts?: string[];
  applicableCategories?: string[];
  applicableBrands?: string[];

  // 증정 방식
  giftSelectionType: GiftSelectionType;
  giftProducts?: string[];
  giftCategories?: string[];
  giftBrands?: string[];

  // 증정 제약 조건
  giftConstraints?: {
    maxGiftPrice?: number;
    mustBeCheaperThanPurchased?: boolean;
    mustBeSameProduct?: boolean;
  };

  // 제약 조건
  constraints?: {
    maxApplicationsPerCart?: number;
    minPurchaseAmount?: number;
    excludedProducts?: string[];
  };

  // 유효 기간
  validFrom: Date;
  validTo: Date;

  // 상태
  status: PromotionStatus;
  isActive: boolean;
  priority: number;
  sourceUrl?: string;

  // 위키형 시스템
  createdBy: string;
  lastModifiedBy: string;
  modificationHistory: Array<{
    modifiedBy: string;
    modifiedAt: Date;
    changes: any;
    comment: string;
  }>;

  // 신뢰도 시스템
  verificationStatus: VerificationStatus;
  verifiedBy: string[];
  disputedBy: string[];
  verificationCount: number;
  disputeCount: number;

  // 병합 추적
  mergedFrom?: string[];
  mergedAt?: Date;
  mergedBy?: string;

  // 크롤링 메타데이터
  crawledAt?: Date;
  isCrawled?: boolean;
  needsVerification?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },

    // 프로모션 타입
    promotionType: {
      type: String,
      enum: ['1+1', '2+1', '3+1', 'custom'],
      required: true,
      index: true,
    },
    buyQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    getQuantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // 적용 대상
    applicableType: {
      type: String,
      enum: ['products', 'categories', 'brands'],
      required: true,
      index: true,
    },
    applicableProducts: {
      type: [String],
      default: undefined,
    },
    applicableCategories: {
      type: [String],
      default: undefined,
    },
    applicableBrands: {
      type: [String],
      default: undefined,
    },

    // 증정 방식
    giftSelectionType: {
      type: String,
      enum: ['same', 'cross', 'combo'],
      required: true,
      default: 'same',
    },
    giftProducts: {
      type: [String],
      default: undefined,
    },
    giftCategories: {
      type: [String],
      default: undefined,
    },
    giftBrands: {
      type: [String],
      default: undefined,
    },

    // 증정 제약 조건
    giftConstraints: {
      maxGiftPrice: Number,
      mustBeCheaperThanPurchased: Boolean,
      mustBeSameProduct: Boolean,
    },

    // 제약 조건
    constraints: {
      maxApplicationsPerCart: Number,
      minPurchaseAmount: Number,
      excludedProducts: [String],
    },

    // 유효 기간
    validFrom: {
      type: Date,
      required: true,
      index: true,
    },
    validTo: {
      type: Date,
      required: true,
      index: true,
    },

    // 상태
    status: {
      type: String,
      enum: ['active', 'expired', 'archived', 'merged'],
      default: 'active',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    sourceUrl: String,

    // 위키형 시스템
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    lastModifiedBy: {
      type: String,
      required: true,
    },
    modificationHistory: [
      {
        modifiedBy: String,
        modifiedAt: Date,
        changes: Schema.Types.Mixed,
        comment: String,
      },
    ],

    // 신뢰도 시스템
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'disputed'],
      default: 'unverified',
      index: true,
    },
    verifiedBy: {
      type: [String],
      default: [],
    },
    disputedBy: {
      type: [String],
      default: [],
    },
    verificationCount: {
      type: Number,
      default: 0,
      index: true,
    },
    disputeCount: {
      type: Number,
      default: 0,
      index: true,
    },

    // 병합 추적
    mergedFrom: [String],
    mergedAt: Date,
    mergedBy: String,

    // 크롤링 메타데이터
    crawledAt: Date,
    isCrawled: {
      type: Boolean,
      default: false,
      index: true,
    },
    needsVerification: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// 복합 인덱스
PromotionSchema.index({ status: 1, isActive: 1, validFrom: 1, validTo: 1 });
PromotionSchema.index({ applicableType: 1, applicableCategories: 1 });
PromotionSchema.index({ applicableType: 1, applicableBrands: 1 });
PromotionSchema.index({ promotionType: 1, isActive: 1 });
PromotionSchema.index({ verificationStatus: 1, verificationCount: 1 });

const Promotion: Model<IPromotion> =
  mongoose.models.Promotion || mongoose.model<IPromotion>('Promotion', PromotionSchema);

export default Promotion;
