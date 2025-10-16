import { Types } from 'mongoose';
import { IProduct } from './product';
import { IDiscountRule, AppliedDiscountDetail } from './discount';
import { PaymentMethod } from './payment';

// 기존 장바구니 계산용 타입 (하위 호환성 유지)
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

// ============================================================================
// 멀티 카트 시스템 타입
// ============================================================================

// 저장용 카트 아이템
export interface ICartItem {
  productId: Types.ObjectId | string;
  barcode: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  brand?: string;
  selectedDiscountIds: (Types.ObjectId | string)[];
}

// 저장용 카트
export interface ICart {
  _id: Types.ObjectId | string;

  // 카트 메타데이터
  name: string; // 예: "통신사 할인 조합", "카드 할인 조합"
  emoji?: string; // 예: "📱", "💳"
  description?: string;
  color?: CartColor; // 카트 구분 색상

  // 카트 아이템
  items: ICartItem[];

  // 전역 설정
  paymentMethod?: PaymentMethod;

  // 프리셋 연결 (선택사항)
  presetId?: Types.ObjectId | string;

  // 계산 결과 캐시 (선택사항)
  cachedTotalOriginalPrice?: number;
  cachedTotalFinalPrice?: number;
  cachedTotalDiscount?: number;

  // 메타데이터
  createdAt: Date;
  updatedAt: Date;
  lastCalculatedAt?: Date;
}

// 카트 생성 입력
export interface CreateCartInput {
  name: string;
  emoji?: string;
  description?: string;
  color?: CartColor;
  items?: ICartItem[];
  paymentMethod?: PaymentMethod;
  presetId?: Types.ObjectId | string;
}

// 카트 수정 입력
export interface UpdateCartInput {
  name?: string;
  emoji?: string;
  description?: string;
  color?: CartColor;
  items?: ICartItem[];
  paymentMethod?: PaymentMethod;
  presetId?: Types.ObjectId | string;
  cachedTotalOriginalPrice?: number;
  cachedTotalFinalPrice?: number;
  cachedTotalDiscount?: number;
  lastCalculatedAt?: Date;
}

// 카트 아이템 추가 입력
export interface AddCartItemInput {
  productId: Types.ObjectId | string;
  barcode: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  brand?: string;
  selectedDiscountIds?: (Types.ObjectId | string)[];
}

// 카트 비교 결과
export interface CartComparison {
  carts: Array<{
    cart: ICart;
    totalOriginalPrice: number;
    totalFinalPrice: number;
    totalDiscount: number;
    totalDiscountRate: number;
  }>;

  // 최적 카트
  bestCart?: {
    cartId: Types.ObjectId | string;
    cartName: string;
    savings: number;
  };
}

// 카트 색상 옵션
export const CART_COLORS = {
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' },
} as const;

export type CartColor = keyof typeof CART_COLORS;
