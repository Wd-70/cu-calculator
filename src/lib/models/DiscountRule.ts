import mongoose, { Schema, Model } from 'mongoose';
import { IDiscountRule } from '@/types/discount';

const DiscountRuleSchema = new Schema<IDiscountRule>(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['bundle', 'percentage', 'fixed', 'gift'],
    },
    description: String,

    // Discount logic
    discountValue: Number,
    requiredQuantity: Number,
    freeQuantity: Number,

    // Application conditions
    minPurchase: Number,
    maxDiscount: Number,

    // Product targeting
    applicableProducts: [{
      type: Schema.Types.ObjectId,
      ref: 'Product',
    }],
    applicableCategories: [String],

    // Payment method restrictions
    requiredPaymentMethods: [String],
    paymentMethodNames: [String],

    // Combination rules
    canCombineWith: [Schema.Types.Mixed], // Can be ObjectId or string
    cannotCombineWith: [Schema.Types.Mixed],
    applicationOrder: {
      type: Number,
      required: true,
      default: 1,
    },
    requiresPreviousDiscount: Schema.Types.Mixed,

    // Event information
    eventMonth: String, // Format: "2025-10"
    eventName: String,
    isRecurring: {
      type: Boolean,
      default: false,
    },

    // Validity period
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },

    // Crawling metadata
    sourceUrl: String,
    lastCrawledAt: Date,

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
DiscountRuleSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });
DiscountRuleSchema.index({ eventMonth: 1, isActive: 1 });
DiscountRuleSchema.index({ applicableProducts: 1 });

const DiscountRule: Model<IDiscountRule> =
  mongoose.models.DiscountRule || mongoose.model<IDiscountRule>('DiscountRule', DiscountRuleSchema);

export default DiscountRule;
