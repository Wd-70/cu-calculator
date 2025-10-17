/**
 * 클라이언트 측 할인 계산
 * applicationMethod에 따라 상품별 또는 전체 합산 방식으로 계산
 */

import { calculateCart as serverCalculateCart, calculateDiscountForItem } from './utils/discountCalculator';
import { IDiscountRule } from '@/types/discount';
import { PaymentMethod } from '@/types/payment';
import { ICartItem } from '@/types/cart';

export interface ClientCalculationInput {
  cartItems: ICartItem[];
  selectedDiscountIds: string[];
  allDiscounts: IDiscountRule[];
  paymentMethod?: PaymentMethod;
  couponUsageLimits?: Record<string, number>; // 쿠폰별 남은 일일 사용 가능 횟수
}

export interface DiscountStep {
  discountId: string;
  name: string;
  amount: number;
  calculationDetails: string;
  afterAmount: number;
  appliedItems?: Array<{
    productName: string;
    price: number;
    quantity: number;
    discountAmount: number;
  }>;
}

export interface ClientCalculationResult {
  success: boolean;
  data?: {
    totalOriginalPrice: number;
    totalFinalPrice: number;
    totalDiscount: number;
    totalDiscountRate: number;
    discountSteps: DiscountStep[];
    paymentMethod?: string;
  };
  error?: string;
}

/**
 * 클라이언트에서 장바구니 할인 계산
 * applicationMethod에 따라 상품별 또는 전체 합산 방식으로 계산
 */
export function calculateCartOnClient(
  input: ClientCalculationInput
): ClientCalculationResult {
  try {
    const { cartItems, selectedDiscountIds, allDiscounts, paymentMethod, couponUsageLimits } = input;

    if (!cartItems || cartItems.length === 0) {
      return {
        success: false,
        error: '장바구니가 비어있습니다.',
      };
    }

    // 선택된 할인만 필터링
    let selectedDiscounts = allDiscounts.filter((d) =>
      selectedDiscountIds.includes(String(d._id))
    );

    // 쿠폰 할인의 경우 남은 횟수 체크
    if (couponUsageLimits) {
      selectedDiscounts = selectedDiscounts.filter((d) => {
        const discountId = String(d._id);
        const isCoupon = d.config.category === 'coupon';
        const isSubscription = isCoupon && (d.config as any).isSubscription;

        if (isSubscription) {
          const remainingUsage = couponUsageLimits[discountId];
          if (remainingUsage !== undefined && remainingUsage <= 0) {
            return false; // 남은 횟수가 0이면 제외
          }
        }
        return true;
      });
    }

    // 할인을 applicationMethod에 따라 분류
    const perItemDiscounts = selectedDiscounts.filter(d => d.applicationMethod === 'per_item');
    const cartTotalDiscounts = selectedDiscounts.filter(d => d.applicationMethod !== 'per_item');

    const discountSteps: DiscountStep[] = [];
    let totalOriginalPrice = 0;
    let currentTotalAmount = 0;

    // 1단계: per_item 할인 적용 (각 상품별로 개별 계산)
    let perItemTotalDiscount = 0;
    const itemDiscountDetails: Array<{
      name: string;
      amount: number;
      usedCount: number;
      appliedItems: Array<{
        productName: string;
        price: number;
        quantity: number;
        discountAmount: number;
      }>;
    }> = [];

    // 총 원가 계산
    cartItems.forEach((item) => {
      totalOriginalPrice += item.price * item.quantity;
    });

    // 각 할인별로 처리
    perItemDiscounts.forEach(discount => {
      const discountId = String(discount._id);
      const usageLimit = couponUsageLimits?.[discountId] ?? Infinity;

      // 이 할인이 적용 가능한 상품들을 수집
      const eligibleItems = cartItems.filter(item => {
        // 카테고리 체크
        if (discount.applicableCategories && discount.applicableCategories.length > 0) {
          if (!item.category || !discount.applicableCategories.includes(item.category)) {
            return false;
          }
        }
        // 브랜드 체크
        if (discount.applicableBrands && discount.applicableBrands.length > 0) {
          if (!item.brand || !discount.applicableBrands.includes(item.brand)) {
            return false;
          }
        }
        return true;
      });

      if (eligibleItems.length === 0) return;

      // 비싼 상품부터 적용하기 위해 가격 기준 내림차순 정렬
      const sortedItems = [...eligibleItems].sort((a, b) => b.price - a.price);

      // 한도만큼만 적용
      let remainingLimit = usageLimit;
      let totalDiscount = 0;
      let totalAppliedCount = 0;
      const appliedItems: Array<{
        productName: string;
        price: number;
        quantity: number;
        discountAmount: number;
      }> = [];

      for (const item of sortedItems) {
        if (remainingLimit <= 0) break;

        const applyCount = Math.min(item.quantity, remainingLimit);
        const discountPerItem = Math.floor(item.price * ((discount.config as any).percentage / 100));
        const discountForThisItem = discountPerItem * applyCount;

        totalDiscount += discountForThisItem;
        totalAppliedCount += applyCount;
        remainingLimit -= applyCount;

        // 적용된 상품 정보 저장
        appliedItems.push({
          productName: item.name,
          price: item.price,
          quantity: applyCount,
          discountAmount: discountForThisItem
        });
      }

      if (totalAppliedCount > 0) {
        perItemTotalDiscount += totalDiscount;
        itemDiscountDetails.push({
          name: discount.name,
          amount: totalDiscount,
          usedCount: totalAppliedCount,
          appliedItems: appliedItems
        });
      }
    });

    // per_item 할인 결과를 discountSteps에 추가
    itemDiscountDetails.forEach(detail => {
      currentTotalAmount = totalOriginalPrice - perItemTotalDiscount;
      discountSteps.push({
        discountId: detail.name,
        name: detail.name,
        amount: detail.amount,
        calculationDetails: `${detail.usedCount}개 상품에 적용`,
        afterAmount: currentTotalAmount,
        appliedItems: detail.appliedItems
      });
    });

    // 2단계: cart_total 할인 적용 (전체 합산 금액에 대해)
    if (cartTotalDiscounts.length > 0) {
      // per_item 할인이 적용된 후의 금액 또는 원가
      const baseAmount = perItemTotalDiscount > 0 ? currentTotalAmount : totalOriginalPrice;
      if (perItemTotalDiscount === 0) {
        currentTotalAmount = totalOriginalPrice;
      }

      // 장바구니 전체를 하나의 가상 상품으로 취급
      const representativeItem = cartItems[0];
      const calculationItems = [{
        productId: 'cart-total',
        quantity: 1,
        unitPrice: baseAmount,
        productCategory: representativeItem.category,
        productBrand: representativeItem.brand,
      }];

      const discountSelections = [{
        productId: 'cart-total',
        productBarcode: 'cart-total',
        selectedDiscounts: cartTotalDiscounts,
      }];

      // 서버 계산 로직 사용
      const result = serverCalculateCart({
        items: calculationItems,
        discountSelections,
        paymentMethod,
        currentDate: new Date(),
      });

      // cart_total 할인 단계 추가
      if (result.items.length > 0 && result.items[0].calculation.steps) {
        result.items[0].calculation.steps.forEach((step) => {
          currentTotalAmount -= step.discountAmount;
          discountSteps.push({
            discountId: String(step.discountId),
            name: step.discountName,
            amount: step.discountAmount,
            calculationDetails: step.calculationDetails,
            afterAmount: currentTotalAmount,
          });
        });
      }
    }

    const totalFinalPrice = currentTotalAmount;
    const totalDiscount = totalOriginalPrice - totalFinalPrice;
    const totalDiscountRate = totalOriginalPrice > 0 ? totalDiscount / totalOriginalPrice : 0;

    const clientData = {
      totalOriginalPrice,
      totalFinalPrice,
      totalDiscount,
      totalDiscountRate,
      discountSteps: discountSteps,
      paymentMethod: paymentMethod,
    };

    return {
      success: true,
      data: clientData,
    };
  } catch (error) {
    console.error('Client calculation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '계산 중 오류가 발생했습니다.',
    };
  }
}
