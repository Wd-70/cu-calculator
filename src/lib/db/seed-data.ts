/**
 * Seed Data for Testing (v2 - 엑셀 로직 기반)
 *
 * 테스트용 초기 데이터입니다.
 * 6가지 할인 카테고리를 사용한 실제 할인 예시
 */

import { IProduct } from '@/types/product';
import { IDiscountRule } from '@/types/discount';
import { PAYMENT_METHODS } from '@/types/payment';
import { Types } from 'mongoose';

// 샘플 할인 규칙 v2 (엑셀 로직 기반)
export function getSampleDiscountRulesV2(): Omit<IDiscountRule, '_id' | 'createdAt' | 'updatedAt'>[] {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return [
    // ============================================================================
    // 1. 구독 (Coupon - Subscription)
    // ============================================================================
    {
      name: '실속한끼 구독',
      description: '도시락 카테고리 25% 할인 (하루 5회, 총 15회)',
      config: {
        category: 'coupon',
        valueType: 'percentage',
        percentage: 25,
        isSubscription: true,
        subscriptionCost: 4900,
        subscriptionPeriodDays: 30,
        dailyUsageLimit: 5,
        totalUsageLimit: 15,
      },
      applicationMethod: 'per_item', // 상품별 개별 적용
      applicableProducts: [],
      applicableCategories: ['도시락'],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: `실속한끼 구독`,
      isActive: true,
    },
    {
      name: '간편식사 구독',
      description: '간편식 카테고리 25% 할인 (하루 5회, 총 15회)',
      config: {
        category: 'coupon',
        valueType: 'percentage',
        percentage: 25,
        isSubscription: true,
        subscriptionCost: 4900,
        subscriptionPeriodDays: 30,
        dailyUsageLimit: 5,
        totalUsageLimit: 15,
      },
      applicationMethod: 'per_item', // 상품별 개별 적용
      applicableProducts: [],
      applicableCategories: ['라면', '도시락'],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: `간편식사 구독`,
      isActive: true,
    },
    {
      name: 'get 아메리카노 구독',
      description: '음료 카테고리 30% 할인 (하루 5회, 총 15회)',
      config: {
        category: 'coupon',
        valueType: 'percentage',
        percentage: 30,
        isSubscription: true,
        subscriptionCost: 9900,
        subscriptionPeriodDays: 30,
        dailyUsageLimit: 5,
        totalUsageLimit: 15,
      },
      applicationMethod: 'per_item', // 상품별 개별 적용
      applicableProducts: [],
      applicableCategories: ['음료'],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: `get 아메리카노 구독`,
      isActive: true,
    },

    // ============================================================================
    // 2. 통신사 할인 (Telecom)
    // ============================================================================
    {
      name: '우주패스 (1천원당 300원)',
      description: '우주패스 통신사 할인 - 1천원당 300원 할인',
      config: {
        category: 'telecom',
        valueType: 'tiered_amount',
        tierUnit: 1000,
        tierAmount: 300,
        provider: '우주패스',
        canCombineWithMembership: false,
      },
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      isActive: true,
    },
    {
      name: 'KT알뜰 (1천원당 200원)',
      description: 'KT알뜰 통신사 할인 - 1천원당 200원 할인',
      config: {
        category: 'telecom',
        valueType: 'tiered_amount',
        tierUnit: 1000,
        tierAmount: 200,
        provider: 'KT알뜰',
        canCombineWithMembership: true, // KT알뜰은 멤버십과 중복 가능
      },
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      isActive: true,
    },

    // ============================================================================
    // 3. 결제행사 할인 (Payment Event)
    // ============================================================================
    {
      name: '결제행사 1000원 할인',
      description: '결제행사 - 1000원 즉시 할인',
      config: {
        category: 'payment_event',
        valueType: 'fixed_amount',
        fixedAmount: 1000,
        eventName: '1월 신년 결제행사',
        requiresQR: false,
      },
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      minPurchaseAmount: 2000, // 최소 2천원 이상 구매 시
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: '1월 신년 결제행사',
      isActive: true,
    },
    {
      name: '결제행사 40% 할인',
      description: '결제행사 - 40% 퍼센트 할인',
      config: {
        category: 'payment_event',
        valueType: 'percentage',
        percentage: 40,
        eventName: '특별 할인 행사',
        requiresQR: true,
      },
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: '특별 할인 행사',
      isActive: true,
    },

    // ============================================================================
    // 4. 금액권 (Voucher)
    // ============================================================================
    {
      name: 'CU 1천원권',
      description: 'CU 상품권 1,000원',
      config: {
        category: 'voucher',
        valueType: 'voucher_amount',
        amount: 1000,
        voucherType: 'cu_voucher',
        voucherName: 'CU 1천원권',
      },
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      cannotCombineWithCategories: ['payment_instant'], // 독립형과 중복 불가
      validFrom: monthStart,
      validTo: monthEnd,
      isActive: true,
    },

    // ============================================================================
    // 5. 결제 할인(독립형) (Payment Instant)
    // ============================================================================
    {
      name: '즉시할인 카드 25%',
      description: '즉시할인형 카드 - 25% 할인 (정가 기준)',
      config: {
        category: 'payment_instant',
        valueType: 'percentage',
        percentage: 25,
        provider: '신한카드',
        isNaverPlus: false,
      },
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [PAYMENT_METHODS.CARD],
      paymentMethodNames: ['신한카드'],
      cannotCombineWithCategories: ['voucher'], // 금액권과 중복 불가
      validFrom: monthStart,
      validTo: monthEnd,
      isActive: true,
    },
    {
      name: '네이버플러스 멤버십 10%',
      description: '네이버플러스 멤버십 - 10% 할인',
      config: {
        category: 'payment_instant',
        valueType: 'percentage',
        percentage: 10,
        provider: '네이버플러스',
        isNaverPlus: true,
        canCombineWithNaverCard: true, // 네이버페이 카드와 중복 가능
      },
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [PAYMENT_METHODS.NAVER_PAY],
      paymentMethodNames: ['네이버페이'],
      validFrom: monthStart,
      validTo: monthEnd,
      isActive: true,
    },

    // ============================================================================
    // 6. 결제 할인(누적형) (Payment Compound)
    // ============================================================================
    {
      name: '오키클럽 10% 추가할인',
      description: '오키클럽 - 10% 추가할인 (누적 금액 기준)',
      config: {
        category: 'payment_compound',
        valueType: 'percentage',
        percentage: 10,
        provider: '오키클럽',
      },
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      isActive: true,
    },
    {
      name: 'KB국민카드 청구할인 5%',
      description: 'KB국민카드 청구할인형 - 5% 할인',
      config: {
        category: 'payment_compound',
        valueType: 'percentage',
        percentage: 5,
        provider: 'KB국민카드',
      },
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [PAYMENT_METHODS.CARD],
      paymentMethodNames: ['KB국민카드'],
      validFrom: monthStart,
      validTo: monthEnd,
      isActive: true,
    },

    // ============================================================================
    // 7. 1+1 행사
    // ============================================================================
    {
      name: '1+1',
      description: '1+1 행사 - 하나 사면 하나 더 (무료 증정)',
      config: {
        category: 'promotion',
        valueType: 'buy_n_get_m',
        buyQuantity: 1,
        getQuantity: 1,
        promotionType: '1+1',
      },
      applicationMethod: 'per_item',
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: '1+1 행사',
      isActive: true,
    },

    // ============================================================================
    // 8. 2+1 행사
    // ============================================================================
    {
      name: '2+1',
      description: '2+1 행사 - 두 개 사면 하나 더 (무료 증정)',
      config: {
        category: 'promotion',
        valueType: 'buy_n_get_m',
        buyQuantity: 2,
        getQuantity: 1,
        promotionType: '2+1',
      },
      applicationMethod: 'per_item',
      applicableProducts: [],
      applicableCategories: [],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: '2+1 행사',
      isActive: true,
    },
  ];
}

// 데이터베이스 초기화 함수
export async function seedDatabase(db: any): Promise<void> {
  console.log('🌱 Seeding database with v2 structure...');

  try {
    // 할인 규칙 생성 (v2)
    const discountRules = getSampleDiscountRulesV2();

    for (const ruleData of discountRules) {
      const existing = await db.findDiscountRules({ name: ruleData.name });
      if (existing.length === 0) {
        const rule = await db.createDiscountRule(ruleData);
        console.log(`✅ Created discount rule (v2): ${rule.name} [${rule.config.category}]`);
      } else {
        // 기존 데이터를 업데이트
        const existingRule = existing[0];
        const updated = await db.updateDiscountRule(existingRule._id, ruleData);
        console.log(`🔄 Updated discount rule: ${ruleData.name} [${ruleData.config.category}]`);
      }
    }

    console.log('\n✨ Database seeding completed (v2)!');
    console.log('📊 Created:');
    console.log(`   - ${discountRules.length} discount rules across 8 categories (including 1+1 and 2+1)`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}
