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

// 샘플 상품 데이터
export const sampleProducts: Omit<IProduct, '_id' | 'createdAt' | 'updatedAt'>[] = [
  {
    barcode: '8801234567890',
    name: '코카콜라 500ml',
    price: 1500,
    category: '음료',
    brand: '코카콜라',
    imageUrl: '',
    createdBy: 'system',
    modificationCount: 0,
    isVerified: true,
    verificationCount: 5,
    reportCount: 0,
  },
  {
    barcode: '8801234567891',
    name: '스프라이트 500ml',
    price: 1500,
    category: '음료',
    brand: '코카콜라',
    imageUrl: '',
    createdBy: 'system',
    modificationCount: 0,
    isVerified: true,
    verificationCount: 5,
    reportCount: 0,
  },
  {
    barcode: '8801234567892',
    name: '프링글스 오리지널',
    price: 2500,
    category: '과자',
    brand: '프링글스',
    imageUrl: '',
    createdBy: 'system',
    modificationCount: 0,
    isVerified: true,
    verificationCount: 5,
    reportCount: 0,
  },
  {
    barcode: '8801234567893',
    name: '허니버터칩',
    price: 2000,
    category: '과자',
    brand: '해태',
    imageUrl: '',
    createdBy: 'system',
    modificationCount: 0,
    isVerified: true,
    verificationCount: 5,
    reportCount: 0,
  },
  {
    barcode: '8801234567894',
    name: '삼각김밥 참치',
    price: 1800,
    category: '도시락',
    brand: 'CU',
    imageUrl: '',
    createdBy: 'system',
    modificationCount: 0,
    isVerified: true,
    verificationCount: 5,
    reportCount: 0,
  },
  {
    barcode: '8801234567895',
    name: '컵라면 신라면',
    price: 1300,
    category: '라면',
    brand: '농심',
    imageUrl: '',
    createdBy: 'system',
    modificationCount: 0,
    isVerified: true,
    verificationCount: 5,
    reportCount: 0,
  },
  {
    barcode: '8801234567896',
    name: '도시락 불고기',
    price: 3300,
    category: '도시락',
    brand: 'CU',
    imageUrl: '',
    createdBy: 'system',
    modificationCount: 0,
    isVerified: true,
    verificationCount: 5,
    reportCount: 0,
  },
];

// 샘플 할인 규칙 v2 (엑셀 로직 기반)
export function getSampleDiscountRulesV2(productIds: {
  coke: string;
  sprite: string;
  pringles: string;
  honeyButter: string;
  dosirak: string;
}): Omit<IDiscountRule, '_id' | 'createdAt' | 'updatedAt'>[] {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return [
    // ============================================================================
    // 1. 쿠폰 할인 (Coupon)
    // ============================================================================
    {
      name: '도시락 20% 쿠폰',
      description: '도시락 카테고리 20% 할인 쿠폰',
      config: {
        category: 'coupon',
        valueType: 'percentage',
        percentage: 20,
      },
      applicableProducts: [],
      applicableCategories: ['도시락'],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: `${currentMonth.split('-')[1]}월 도시락 쿠폰`,
      isActive: true,
    },
    {
      name: '과자 25% 쿠폰',
      description: '과자 카테고리 25% 할인 쿠폰',
      config: {
        category: 'coupon',
        valueType: 'percentage',
        percentage: 25,
      },
      applicableProducts: [],
      applicableCategories: ['과자'],
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: `${currentMonth.split('-')[1]}월 과자 쿠폰`,
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
      description: '우주패스 가입자 할인',
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
      description: 'KT알뜰 요금제 가입자 할인',
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
      description: 'CU 상품권',
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
      requiredPaymentMethods: [PAYMENT_METHODS.CARD_SHINHAN],
      paymentMethodNames: ['신한카드'],
      cannotCombineWithCategories: ['voucher'], // 금액권과 중복 불가
      validFrom: monthStart,
      validTo: monthEnd,
      description: '신한카드 즉시할인 25%',
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
      description: '네이버플러스 멤버십 회원 할인',
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
      description: '오키클럽 회원 누적 할인',
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
      requiredPaymentMethods: [PAYMENT_METHODS.CARD_KB],
      paymentMethodNames: ['KB국민카드'],
      validFrom: monthStart,
      validTo: monthEnd,
      description: 'KB국민카드 청구할인',
      isActive: true,
    },
  ];
}

// 데이터베이스 초기화 함수
export async function seedDatabase(db: any): Promise<void> {
  console.log('🌱 Seeding database with v2 structure...');

  try {
    // 1. 상품 생성
    const createdProducts: any[] = [];
    for (const productData of sampleProducts) {
      const existing = await db.findProductByBarcode(productData.barcode);
      if (!existing) {
        const product = await db.createProduct(productData);
        createdProducts.push(product);
        console.log(`✅ Created product: ${product.name}`);
      } else {
        createdProducts.push(existing);
        console.log(`⏭️  Product already exists: ${existing.name}`);
      }
    }

    // 2. 할인 규칙 생성 (v2)
    const productIdMap = {
      coke: createdProducts[0]._id.toString(),
      sprite: createdProducts[1]._id.toString(),
      pringles: createdProducts[2]._id.toString(),
      honeyButter: createdProducts[3]._id.toString(),
      dosirak: createdProducts[6]._id.toString(),
    };

    const discountRules = getSampleDiscountRulesV2(productIdMap);

    for (const ruleData of discountRules) {
      const existing = await db.findDiscountRules({ name: ruleData.name });
      if (existing.length === 0) {
        const rule = await db.createDiscountRule(ruleData);
        console.log(`✅ Created discount rule (v2): ${rule.name} [${rule.config.category}]`);
      } else {
        console.log(`⏭️  Discount rule already exists: ${ruleData.name}`);
      }
    }

    console.log('\n✨ Database seeding completed (v2)!');
    console.log('📊 Created:');
    console.log(`   - ${sampleProducts.length} products`);
    console.log(`   - ${discountRules.length} discount rules across 6 categories`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}
