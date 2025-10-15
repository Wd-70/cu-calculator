import { IProduct } from './product';
import { IDiscountRule, AppliedDiscountDetail } from './discount';
import { PaymentMethod } from './payment';

export interface CartItem {
  product: IProduct;
  quantity: number;
  selectedDiscountIds?: string[];
}

export interface CartItemResult {
  product: IProduct;
  quantity: number;
  originalPrice: number;
  discountedPrice: number;
  appliedDiscounts: AppliedDiscountDetail[];
  savings: number;
}

export interface CartSummary {
  totalOriginalPrice: number;
  totalDiscountedPrice: number;
  totalSavings: number;
  savingsPercentage: number;
}

export interface CartCalculation {
  items: CartItemResult[];
  summary: CartSummary;
  paymentMethod?: PaymentMethod;
  warnings?: string[];
}
