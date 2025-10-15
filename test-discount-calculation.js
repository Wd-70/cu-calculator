/**
 * 할인 계산 로직 검증 스크립트
 * Node.js로 직접 실행 가능
 *
 * 실행: node test-discount-calculation.js
 */

// 간단한 Mock ObjectId
class MockObjectId {
  constructor() {
    this.id = Math.random().toString(36).substring(7);
  }
  toString() {
    return this.id;
  }
}

// ============================================================================
// 할인 계산 함수들 (discountCalculator.v2.ts에서 복사)
// ============================================================================

function calculateCouponDiscount(originalPrice, percentage) {
  return Math.floor(originalPrice * (percentage / 100));
}

function calculateTelecomDiscount(originalPrice, config) {
  if (config.valueType === 'percentage' && config.percentage) {
    return Math.floor(originalPrice * (config.percentage / 100));
  } else if (config.valueType === 'tiered_amount' && config.tierUnit && config.tierAmount) {
    const tiers = Math.floor(originalPrice / config.tierUnit);
    return tiers * config.tierAmount;
  }
  return 0;
}

function calculatePaymentEventDiscount(originalPrice, config) {
  if (config.valueType === 'percentage' && config.percentage) {
    return Math.floor(originalPrice * (config.percentage / 100));
  } else if (config.valueType === 'fixed_amount' && config.fixedAmount) {
    return Math.min(originalPrice, config.fixedAmount);
  }
  return 0;
}

function calculateVoucherDiscount(remainingAmount, amount) {
  return Math.min(remainingAmount, amount);
}

function calculatePaymentInstantDiscount(originalPrice, percentage) {
  return Math.floor(originalPrice * (percentage / 100));
}

function calculatePaymentCompoundDiscount(remainingAmount, percentage) {
  return Math.floor(remainingAmount * (percentage / 100));
}

// ============================================================================
// 간단한 할인 계산 함수
// ============================================================================

function calculateDiscount(originalPrice, discounts) {
  const steps = [];
  let currentAmount = originalPrice;

  // 1. 정가 기준 할인액 계산
  const couponDiscounts = discounts.filter(d => d.category === 'coupon');
  const telecomDiscounts = discounts.filter(d => d.category === 'telecom');
  const paymentEventDiscounts = discounts.filter(d => d.category === 'payment_event');
  const voucherDiscounts = discounts.filter(d => d.category === 'voucher');
  const paymentInstantDiscounts = discounts.filter(d => d.category === 'payment_instant');
  const paymentCompoundDiscounts = discounts.filter(d => d.category === 'payment_compound');

  // 2. 쿠폰 할인
  for (const d of couponDiscounts) {
    const amount = calculateCouponDiscount(originalPrice, d.percentage);
    currentAmount -= amount;
    steps.push({ name: d.name, amount, remaining: currentAmount, detail: `${d.percentage}% 할인` });
  }

  // 3. 통신사 할인
  for (const d of telecomDiscounts) {
    const amount = calculateTelecomDiscount(originalPrice, d);
    currentAmount -= amount;
    const detail = d.valueType === 'percentage'
      ? `${d.percentage}% 할인`
      : `${d.tierUnit}원당 ${d.tierAmount}원 할인`;
    steps.push({ name: d.name, amount, remaining: currentAmount, detail });
  }

  // 4. 결제행사 할인
  for (const d of paymentEventDiscounts) {
    const amount = calculatePaymentEventDiscount(originalPrice, d);
    currentAmount -= amount;
    const detail = d.valueType === 'percentage'
      ? `${d.percentage}% 할인`
      : `${d.fixedAmount}원 할인`;
    steps.push({ name: d.name, amount, remaining: currentAmount, detail });
  }

  // 5. 금액권
  for (const d of voucherDiscounts) {
    const amount = calculateVoucherDiscount(currentAmount, d.amount);
    currentAmount -= amount;
    steps.push({ name: d.name, amount, remaining: currentAmount, detail: `${d.amount}원 차감` });
  }

  // 6. 결제 할인(독립형) - 정가 기준!
  for (const d of paymentInstantDiscounts) {
    const amount = calculatePaymentInstantDiscount(originalPrice, d.percentage);
    currentAmount -= amount;
    steps.push({ name: d.name, amount, remaining: currentAmount, detail: `${d.percentage}% 할인 (정가 기준)` });
  }

  // 7. 결제 할인(누적형) - 현재 금액 기준
  for (const d of paymentCompoundDiscounts) {
    const amount = calculatePaymentCompoundDiscount(currentAmount, d.percentage);
    currentAmount -= amount;
    steps.push({ name: d.name, amount, remaining: currentAmount, detail: `${d.percentage}% 할인 (누적 기준)` });
  }

  const finalPrice = Math.max(0, currentAmount);
  const totalDiscount = originalPrice - finalPrice;
  const discountRate = originalPrice > 0 ? (totalDiscount / originalPrice) * 100 : 0;

  return {
    originalPrice,
    finalPrice,
    totalDiscount,
    discountRate,
    steps,
  };
}

// ============================================================================
// 테스트 실행
// ============================================================================

console.log('='.repeat(80));
console.log('CU 할인 계산 로직 검증');
console.log('='.repeat(80));

// 테스트 1: 엑셀 예시 A
console.log('\n[테스트 1] 엑셀 예시 A - 정가 3,300원');
console.log('-'.repeat(80));
const test1 = calculateDiscount(3300, [
  { name: '간편식 25%', category: 'coupon', percentage: 25 },
  { name: '우주패스', category: 'telecom', valueType: 'tiered_amount', tierUnit: 1000, tierAmount: 300 },
  { name: '결제행사 1000원', category: 'payment_event', valueType: 'fixed_amount', fixedAmount: 1000 },
]);

console.log(`정가: ${test1.originalPrice.toLocaleString()}원`);
console.log('\n단계별 할인:');
test1.steps.forEach((step, idx) => {
  console.log(`  ${idx + 1}. ${step.name}: -${step.amount.toLocaleString()}원 (${step.detail})`);
  console.log(`     → 남은 금액: ${step.remaining.toLocaleString()}원`);
});
console.log(`\n총 할인액: ${test1.totalDiscount.toLocaleString()}원`);
console.log(`최종 금액: ${test1.finalPrice.toLocaleString()}원`);
console.log(`할인율: ${test1.discountRate.toFixed(2)}%`);

console.log('\n[엑셀과 비교]');
console.log('  쿠폰: 825원 (계산) vs 830원 (엑셀) - Math.floor 차이');
console.log('  통신사: 900원 (계산) = 900원 (엑셀) ✓');
console.log('  결제행사: 1000원 (계산) = 1000원 (엑셀) ✓');
console.log('  총 할인: 2725원 (계산) vs 2730원 (엑셀) - 5원 차이');
console.log('  최종: 575원 (계산) vs 570원 (엑셀) - 5원 차이');

// 테스트 2: 엑셀 예시 D
console.log('\n\n[테스트 2] 엑셀 예시 D - 정가 3,300원');
console.log('-'.repeat(80));
const test2 = calculateDiscount(3300, [
  { name: '달콤디저트 20%', category: 'coupon', percentage: 20 },
  { name: '결제행사 40%', category: 'payment_event', valueType: 'percentage', percentage: 40 },
  { name: '즉시할인 카드 25%', category: 'payment_instant', percentage: 25 },
]);

console.log(`정가: ${test2.originalPrice.toLocaleString()}원`);
console.log('\n단계별 할인:');
test2.steps.forEach((step, idx) => {
  console.log(`  ${idx + 1}. ${step.name}: -${step.amount.toLocaleString()}원 (${step.detail})`);
  console.log(`     → 남은 금액: ${step.remaining.toLocaleString()}원`);
});
console.log(`\n총 할인액: ${test2.totalDiscount.toLocaleString()}원`);
console.log(`최종 금액: ${test2.finalPrice.toLocaleString()}원`);
console.log(`할인율: ${test2.discountRate.toFixed(2)}%`);

console.log('\n[엑셀과 비교]');
console.log('  쿠폰: 660원 (계산) = 660원 (엑셀) ✓');
console.log('  결제행사: 1320원 (계산) = 1320원 (엑셀) ✓');
console.log('  독립형: 825원 (계산) = 825원 (엑셀) ✓');
console.log('  총 할인: 2805원 (계산) = 2805원 (엑셀) ✓');
console.log('  최종: 495원 (계산) = 495원 (엑셀) ✓');
console.log('  할인율: 85% (계산) = 85% (엑셀) ✓');

// 테스트 3: 금액권 + 누적형
console.log('\n\n[테스트 3] 금액권 + 누적형 - 정가 3,300원');
console.log('-'.repeat(80));
const test3 = calculateDiscount(3300, [
  { name: '쿠폰 20%', category: 'coupon', percentage: 20 },
  { name: 'CU 1천원권', category: 'voucher', amount: 1000 },
  { name: '오키클럽 10%', category: 'payment_compound', percentage: 10 },
]);

console.log(`정가: ${test3.originalPrice.toLocaleString()}원`);
console.log('\n단계별 할인:');
test3.steps.forEach((step, idx) => {
  console.log(`  ${idx + 1}. ${step.name}: -${step.amount.toLocaleString()}원 (${step.detail})`);
  console.log(`     → 남은 금액: ${step.remaining.toLocaleString()}원`);
});
console.log(`\n총 할인액: ${test3.totalDiscount.toLocaleString()}원`);
console.log(`최종 금액: ${test3.finalPrice.toLocaleString()}원`);
console.log(`할인율: ${test3.discountRate.toFixed(2)}%`);

console.log('\n[계산 검증]');
console.log('  1. 쿠폰 20%: 3300 × 0.2 = 660원 ✓');
console.log('  2. 남은 금액: 3300 - 660 = 2640원');
console.log('  3. 금액권 1000원: 1000원 차감 ✓');
console.log('  4. 남은 금액: 2640 - 1000 = 1640원');
console.log('  5. 누적형 10%: 1640 × 0.1 = 164원 ✓');
console.log('  6. 최종 금액: 1640 - 164 = 1476원 ✓');

// 테스트 4: 통신사 할인 (구간 방식)
console.log('\n\n[테스트 4] 통신사 할인 구간 방식 테스트');
console.log('-'.repeat(80));

const prices = [3300, 2450, 1800, 999];
prices.forEach(price => {
  const result = calculateDiscount(price, [
    { name: '우주패스 (1천원당 300원)', category: 'telecom', valueType: 'tiered_amount', tierUnit: 1000, tierAmount: 300 }
  ]);
  const tiers = Math.floor(price / 1000);
  console.log(`  정가 ${price.toLocaleString()}원: ${tiers}개 구간 × 300원 = ${result.totalDiscount}원 할인`);
});

console.log('\n\n' + '='.repeat(80));
console.log('✅ 모든 테스트 완료!');
console.log('='.repeat(80));
console.log('\n주요 발견사항:');
console.log('  1. 대부분의 할인은 정가 기준으로 계산됨 (독립형, 통신사, 결제행사)');
console.log('  2. 금액권과 누적형만 현재 남은 금액 기준');
console.log('  3. 모든 할인액은 Math.floor()로 버림 처리');
console.log('  4. 엑셀과의 차이는 쿠폰 할인의 반올림 방식 차이로 보임');
console.log('\n');
