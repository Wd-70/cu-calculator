/**
 * Seed Data for Testing
 *
 * 테스트용 초기 데이터입니다.
 * 이 데이터를 사용하여 앱의 기능을 테스트할 수 있습니다.
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
];

// 샘플 할인 규칙 (상품 ID는 나중에 매핑)
export function getSampleDiscountRules(productIds: {
  coke: string;
  sprite: string;
  pringles: string;
  honeyButter: string;
}): Omit<IDiscountRule, '_id' | 'createdAt' | 'updatedAt'>[] {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return [
    // 1+1 음료 (코카콜라, 스프라이트)
    {
      name: '음료 1+1',
      type: 'bundle',
      requiredQuantity: 2,
      freeQuantity: 1,
      applicationOrder: 1,
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      applicableProducts: [
        new Types.ObjectId(productIds.coke),
        new Types.ObjectId(productIds.sprite),
      ],
      applicableCategories: [],
      canCombineWith: [],
      cannotCombineWith: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: `${currentMonth.split('-')[1]}월 음료 행사`,
      isActive: true,
    },

    // 2+1 과자 (프링글스, 허니버터칩)
    {
      name: '과자 2+1',
      type: 'bundle',
      requiredQuantity: 3,
      freeQuantity: 1,
      applicationOrder: 1,
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      applicableProducts: [
        new Types.ObjectId(productIds.pringles),
        new Types.ObjectId(productIds.honeyButter),
      ],
      applicableCategories: [],
      canCombineWith: [],
      cannotCombineWith: [],
      validFrom: monthStart,
      validTo: monthEnd,
      eventMonth: currentMonth,
      eventName: `${currentMonth.split('-')[1]}월 과자 행사`,
      isActive: true,
    },

    // 전체 상품 20% 할인
    {
      name: '전체 상품 20% 할인',
      type: 'percentage',
      discountValue: 20,
      applicationOrder: 2,
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      applicableProducts: [],
      applicableCategories: [],
      canCombineWith: [],
      cannotCombineWith: [],
      validFrom: monthStart,
      validTo: monthEnd,
      description: '모든 상품 20% 즉시 할인',
      isActive: true,
    },

    // 신한카드 10% 할인
    {
      name: '신한카드 10% 할인',
      type: 'percentage',
      discountValue: 10,
      maxDiscount: 3000,
      applicationOrder: 3,
      requiredPaymentMethods: [PAYMENT_METHODS.CARD_SHINHAN],
      paymentMethodNames: ['신한카드'],
      applicableProducts: [],
      applicableCategories: [],
      canCombineWith: [],
      cannotCombineWith: [],
      validFrom: monthStart,
      validTo: monthEnd,
      description: '신한카드로 결제 시 10% 할인 (최대 3천원)',
      isActive: true,
    },

    // 멤버십 5% 추가 할인
    {
      name: '멤버십 5% 추가할인',
      type: 'percentage',
      discountValue: 5,
      applicationOrder: 4,
      requiredPaymentMethods: [],
      paymentMethodNames: [],
      applicableProducts: [],
      applicableCategories: [],
      canCombineWith: [],
      cannotCombineWith: [],
      validFrom: monthStart,
      validTo: new Date(now.getFullYear(), now.getMonth() + 3, 0), // 3개월 후
      description: 'CU 멤버십 회원 추가 5% 할인',
      isActive: true,
    },
  ];
}

// 데이터베이스 초기화 함수
export async function seedDatabase(db: any): Promise<void> {
  console.log('🌱 Seeding database...');

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

    // 2. 할인 규칙 생성
    const productIdMap = {
      coke: createdProducts[0]._id.toString(),
      sprite: createdProducts[1]._id.toString(),
      pringles: createdProducts[2]._id.toString(),
      honeyButter: createdProducts[3]._id.toString(),
    };

    const discountRules = getSampleDiscountRules(productIdMap);

    for (const ruleData of discountRules) {
      const existing = await db.findDiscountRules({ name: ruleData.name });
      if (existing.length === 0) {
        const rule = await db.createDiscountRule(ruleData);
        console.log(`✅ Created discount rule: ${rule.name}`);
      } else {
        console.log(`⏭️  Discount rule already exists: ${ruleData.name}`);
      }
    }

    console.log('✨ Database seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}
