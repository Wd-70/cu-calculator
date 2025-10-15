import { Types } from 'mongoose';
import { PaymentMethod } from './payment';

export type DiscountType = 'bundle' | 'percentage' | 'fixed' | 'gift';

export interface IDiscountRule {
  _id: Types.ObjectId | string;
  name: string;
  type: DiscountType;
  description?: string;

  // Discount logic
  discountValue?: number;
  requiredQuantity?: number;
  freeQuantity?: number;

  // Application conditions
  minPurchase?: number;
  maxDiscount?: number;

  // Product targeting
  applicableProducts: Types.ObjectId[];
  applicableCategories: string[];

  // Payment method restrictions
  requiredPaymentMethods: PaymentMethod[];
  paymentMethodNames: string[];

  // Combination rules
  canCombineWith: (Types.ObjectId | string)[];
  cannotCombineWith: (Types.ObjectId | string)[];
  applicationOrder: number;
  requiresPreviousDiscount?: Types.ObjectId | string;

  // Event information
  eventMonth?: string;
  eventName?: string;
  isRecurring?: boolean;

  // Validity period
  validFrom: Date;
  validTo: Date;

  // Crawling metadata
  sourceUrl?: string;
  lastCrawledAt?: Date;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscountValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface AppliedDiscountDetail {
  discount: IDiscountRule;
  savedAmount: number;
  appliedOrder: number;
}

export interface DiscountCalculationResult {
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  appliedDiscounts: AppliedDiscountDetail[];
  errors?: string[];
}
