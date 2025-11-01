# 교차증정 프로모션 시스템 설계안

## 📋 요구사항
- 1+1, 2+1 등의 프로모션 지원
- **교차증정**: 특정 상품군에서 N개 구매 시, 다른 상품군에서 M개 증정
- 예시:
  - 음료 A, B, C 중 2개 구매 → 과자 D, E, F 중 1개 증정
  - 특정 브랜드 상품 1개 구매 → 동일 브랜드 다른 상품 1개 증정

## 🏗️ 새로운 Promotion 모델 설계

### Option 1: 독립적인 Promotion 컬렉션 (권장)

```typescript
interface IPromotion {
  _id: ObjectId;
  name: string;  // "코카콜라 1+1", "롯데 과자 2+1"
  description: string;

  // 프로모션 타입
  promotionType: '1+1' | '2+1' | '3+1' | 'custom';
  buyQuantity: number;  // 구매해야 하는 수량
  getQuantity: number;  // 무료로 받는 수량

  // 적용 대상 (구매 가능 상품)
  applicableType: 'products' | 'categories' | 'brands';
  applicableProducts?: string[];      // 바코드 배열
  applicableCategories?: string[];    // 카테고리 배열
  applicableBrands?: string[];        // 브랜드 배열

  // 증정 방식
  giftSelectionType: 'same' | 'cross' | 'combo';
  // 'same': 동일 상품 증정
  //         - 구매한 상품과 정확히 동일한 상품만 증정 (예: 코카콜라 구매 → 코카콜라 증정)
  //         - 크롤링된 1+1, 2+1은 대부분 이 방식
  // 'cross': 교차 증정
  //         - 구매 상품 목록(applicableXXX) 내에서 아무거나 선택 가능
  //         - 같은 그룹 내에서 교차 증정 (예: A, B, C 중 2개 구매 → A, B, C 중 아무거나 1개 증정)
  // 'combo': 콤보 증정
  //         - 구매 목록과 증정 목록이 별도로 분리
  //         - 별도의 증정 가능 목록(giftXXX)에서 선택 (예: 음료 구매 → 과자 증정)

  // 콤보 증정인 경우에만 사용
  giftProducts?: string[];      // 증정 가능 바코드 배열
  giftCategories?: string[];    // 증정 가능 카테고리
  giftBrands?: string[];        // 증정 가능 브랜드

  // 증정 제약 조건
  giftConstraints?: {
    maxGiftPrice?: number;    // 증정품 최대 가격
    mustBeCheaperThanPurchased?: boolean;  // 구매 상품보다 저렴해야 함
    mustBeSameProduct?: boolean;  // 구매한 상품과 동일해야 함
  };

  // 제약 조건
  constraints?: {
    maxApplicationsPerCart?: number;  // 장바구니당 최대 적용 횟수
    minPurchaseAmount?: number;       // 최소 구매 금액
    excludedProducts?: string[];      // 제외 상품
  };

  // 유효 기간
  validFrom: Date;
  validTo: Date;

  // 메타데이터
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

  // 신뢰도 시스템 (프로모션 특화)
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'disputed';
  verifiedBy?: string[];      // 검증한 사용자 주소 배열
  disputedBy?: string[];      // 이의 제기한 사용자 주소 배열
  verificationCount: number;  // 검증 횟수
  disputeCount: number;       // 이의 제기 횟수

  createdAt: Date;
  updatedAt: Date;
}
```

### 실제 사용 예시

#### 예시 1: 동일 상품만 1+1 (가장 제한적)
```json
{
  "name": "코카콜라 500ml 1+1",
  "promotionType": "1+1",
  "buyQuantity": 1,
  "getQuantity": 1,
  "applicableType": "products",
  "applicableProducts": ["8801234567890"],
  "giftSelectionType": "same",
  "giftConstraints": {
    "mustBeSameProduct": true  // 구매한 상품과 정확히 동일
  }
}
```

#### 예시 2: 상품군 내에서 교차 증정 가능한 1+1 (가장 흔한 케이스) ⭐
```json
{
  "name": "코카콜라 제품 1+1",
  "promotionType": "1+1",
  "buyQuantity": 1,
  "getQuantity": 1,
  "applicableType": "products",
  "applicableProducts": [
    "8801234567890",  // 코카콜라 500ml
    "8801234567891",  // 코카제로 500ml
    "8801234567892"   // 코카라이트 500ml
  ],
  "giftSelectionType": "cross"
  // 'cross' = 같은 그룹(applicableProducts) 내에서 교차 증정 가능
  // 예: 코카콜라 1개 구매 → 코카제로 증정 가능
  // 예: 코카제로 1개 구매 → 코카콜라 증정 가능
}
```

#### 예시 3: 콤보 증정 - A 구매 → B 증정 (구매 상품과 증정 상품이 다름)
```json
{
  "name": "칸초 구매시 새우깡 증정",
  "promotionType": "1+1",
  "buyQuantity": 1,
  "getQuantity": 1,
  "applicableType": "products",
  "applicableProducts": ["칸초바코드"],
  "giftSelectionType": "combo",
  "giftProducts": ["새우깡바코드"]
  // 'combo' = 구매 목록(칸초)과 증정 목록(새우깡)이 별도로 분리됨
  // applicableProducts에서 구매 → giftProducts에서 증정
}
```

#### 예시 4: 콤보 증정 - 음료 2개 구매 시 과자 1개 (카테고리 간 콤보)
```json
{
  "name": "음료 2+1 과자 증정",
  "promotionType": "2+1",
  "buyQuantity": 2,
  "getQuantity": 1,
  "applicableType": "categories",
  "applicableCategories": ["음료"],
  "giftSelectionType": "combo",
  "giftCategories": ["과자"],
  "giftConstraints": {
    "maxGiftPrice": 3000,
    "mustBeCheaperThanPurchased": true
  }
  // 'combo' = 음료 카테고리에서 구매 → 과자 카테고리에서 증정
  // 서로 다른 카테고리이므로 'combo' 사용
}
```

#### 예시 5: 브랜드 내 1+1 (같은 브랜드 내에서 교차 증정)
```json
{
  "name": "롯데 제품 1+1",
  "promotionType": "1+1",
  "buyQuantity": 1,
  "getQuantity": 1,
  "applicableType": "brands",
  "applicableBrands": ["롯데"],
  "giftSelectionType": "cross",
  "giftConstraints": {
    "maxGiftPrice": 2000
  }
  // 'cross' = 롯데 브랜드 제품끼리 서로 교차 증정 가능
  // 같은 브랜드 내에서 선택하므로 'cross' 사용
}
```

## 🔄 DiscountRule과의 관계

### Option A: 완전 분리 (권장)
- `Promotion` 컬렉션: 1+1, 2+1 등 증정 프로모션만
- `DiscountRule` 컬렉션: 금액/퍼센트 할인만
- **장점**: 명확한 분리, 각각의 로직이 단순함
- **단점**: 두 시스템 모두 고려해야 함

### Option B: DiscountRule 확장
- `DiscountRule`에 프로모션 관련 필드 추가
- **장점**: 하나의 시스템으로 관리
- **단점**: 스키마가 복잡해짐, 프로모션 로직과 할인 로직이 섞임

## 🎯 권장사항

**Option A (완전 분리) 권장 이유:**

1. **명확성**: 프로모션과 할인은 근본적으로 다른 개념
2. **계산 로직 분리**:
   - 할인: 금액 차감
   - 프로모션: 상품 증정 (무료 항목 추가)
3. **UI/UX 분리**:
   - 할인: "할인 적용" 선택
   - 프로모션: "증정 상품 선택" 필요
4. **확장성**: 향후 복잡한 프로모션 규칙 추가 용이

## 📝 점진적 데이터 수집 워크플로우

### 문제 상황
- 크롤링으로 수집 시: 개별 상품의 1+1 정보만 수집 가능 (교차증정 여부 불명)
- 초기 데이터: 각 상품마다 별도의 프로모션으로 생성됨
- 추후 작업: 실제로는 같은 그룹임을 확인 → 병합 필요

### 해결책: 프로모션 그룹화 및 병합 기능

#### 1. 초기 상태 (크롤링 직후)
```json
// 개별 프로모션 3개로 생성
[
  {
    "_id": "promo_001",
    "name": "코카콜라 500ml 1+1",
    "applicableProducts": ["8801234567890"],
    "giftSelectionType": "same",
    "giftConstraints": { "mustBeSameProduct": true }
  },
  {
    "_id": "promo_002",
    "name": "코카제로 500ml 1+1",
    "applicableProducts": ["8801234567891"],
    "giftSelectionType": "same",
    "giftConstraints": { "mustBeSameProduct": true }
  },
  {
    "_id": "promo_003",
    "name": "코카라이트 500ml 1+1",
    "applicableProducts": ["8801234567892"],
    "giftSelectionType": "same",
    "giftConstraints": { "mustBeSameProduct": true }
  }
]
```

#### 2. 병합 후 상태 (교차증정 확인 후)
```json
// 하나의 프로모션으로 통합
{
  "_id": "promo_merged_001",
  "name": "코카콜라 제품 1+1",
  "applicableProducts": [
    "8801234567890",  // 코카콜라 500ml
    "8801234567891",  // 코카제로 500ml
    "8801234567892"   // 코카라이트 500ml
  ],
  "giftSelectionType": "cross",  // 같은 목록에서 교차 증정 가능
  "giftConstraints": {},  // mustBeSameProduct 제거
  "mergedFrom": ["promo_001", "promo_002", "promo_003"]  // 병합 추적
}
```

#### 3. IPromotion 인터페이스 추가 필드

```typescript
interface IPromotion {
  // ... 기존 필드들 ...

  // 병합 추적 (선택적)
  mergedFrom?: string[];  // 병합된 원본 프로모션 ID 배열
  mergedAt?: Date;        // 병합 시점
  mergedBy?: string;      // 병합 수행자

  // 크롤링 메타데이터 (선택적)
  crawledAt?: Date;          // 크롤링 시점
  isCrawled?: boolean;       // 크롤링으로 생성되었는지 여부
  needsVerification?: boolean;  // 교차증정 여부 미확인
}
```

#### 4. 병합 API 설계

```typescript
// POST /api/promotions/merge
{
  "promotionIds": ["promo_001", "promo_002", "promo_003"],
  "mergedData": {
    "name": "코카콜라 제품 1+1",
    "applicableProducts": ["8801234567890", "8801234567891", "8801234567892"],
    "giftSelectionType": "cross"
  },
  "signature": "0x...",
  "timestamp": 1234567890,
  "address": "0x..."
}
```

**병합 로직:**
1. 모든 원본 프로모션의 `isActive`를 `false`로 설정 (삭제하지 않고 보관)
2. 새 프로모션 생성 시 `mergedFrom` 필드에 원본 ID 저장
3. PromotionIndex 업데이트:
   - 원본 프로모션 ID 제거
   - 새 프로모션 ID 추가

```typescript
async function mergePromotions(promotionIds: string[], mergedData: any, userAddress: string) {
  // 1. 원본 프로모션들을 비활성화
  await Promotion.updateMany(
    { _id: { $in: promotionIds } },
    {
      $set: {
        isActive: false,
        lastModifiedBy: userAddress,
      },
      $push: {
        modificationHistory: {
          modifiedBy: userAddress,
          modifiedAt: new Date(),
          changes: { merged: true },
          comment: '프로모션 병합으로 비활성화'
        }
      }
    }
  );

  // 2. 모든 바코드 수집
  const originalPromotions = await Promotion.find({ _id: { $in: promotionIds } });
  const allBarcodes = new Set<string>();
  originalPromotions.forEach(p => {
    (p.applicableProducts || []).forEach(barcode => allBarcodes.add(barcode));
  });

  // 3. 새 프로모션 생성
  const newPromotion = await Promotion.create({
    ...mergedData,
    mergedFrom: promotionIds,
    mergedAt: new Date(),
    mergedBy: userAddress,
    createdBy: userAddress,
    lastModifiedBy: userAddress,
    needsVerification: false,  // 수동 병합이므로 검증됨
  });

  // 4. PromotionIndex 업데이트
  for (const barcode of allBarcodes) {
    await PromotionIndex.updateOne(
      { barcode },
      {
        $pull: { promotionIds: { $in: promotionIds } },  // 원본 제거
        $addToSet: { promotionIds: newPromotion._id },   // 새 ID 추가
        $set: { lastUpdated: new Date() }
      }
    );
  }

  return newPromotion;
}
```

#### 5. UI 워크플로우

**관리자 페이지에 "병합 가능한 프로모션 찾기" 기능:**

```typescript
// 병합 후보 찾기 알고리즘
async function findMergeCandidates() {
  // 1. 크롤링으로 생성된 개별 상품 프로모션 중
  //    동일한 프로모션 타입(1+1, 2+1)을 가진 것들을 그룹화
  const candidates = await Promotion.aggregate([
    {
      $match: {
        isCrawled: true,
        isActive: true,
        giftSelectionType: 'same',
        'giftConstraints.mustBeSameProduct': true,
        'applicableProducts': { $size: 1 }  // 단일 상품만
      }
    },
    {
      $group: {
        _id: {
          promotionType: '$promotionType',
          validFrom: '$validFrom',
          validTo: '$validTo'
        },
        promotions: { $push: '$$ROOT' },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gte: 2 } }  // 2개 이상인 그룹만
    }
  ]);

  return candidates;
}
```

**UI 화면:**
```
📦 병합 가능한 프로모션 그룹

그룹 1: 1+1 프로모션 (2025-01-01 ~ 2025-01-31)
  ☑ 코카콜라 500ml 1+1
  ☑ 코카제로 500ml 1+1
  ☑ 코카라이트 500ml 1+1

  [병합하기] 버튼
  → 모달 열림: "코카콜라 제품 1+1" 이름 입력, 교차증정 확인
```

#### 6. 크롤러 개선 (향후)

```typescript
// 크롤링 시 needsVerification 플래그 추가
async function crawlPromotion(product) {
  const promotion = {
    name: `${product.name} 1+1`,
    applicableProducts: [product.barcode],
    giftSelectionType: 'same',
    giftConstraints: { mustBeSameProduct: true },

    // 크롤링 메타데이터
    isCrawled: true,
    crawledAt: new Date(),
    needsVerification: true,  // 교차증정 여부 미확인

    createdBy: 'crawler_bot',
    lastModifiedBy: 'crawler_bot',
  };

  return await Promotion.create(promotion);
}
```

## 🚀 구현 단계

1. **Phase 1**: `Promotion` 모델 생성 (병합 추적 필드 포함)
2. **Phase 2**: 프로모션 CRUD API 구현
3. **Phase 3**: 프로모션 병합 API 구현 (`POST /api/promotions/merge`)
4. **Phase 4**: 병합 후보 탐지 로직 구현
5. **Phase 5**: 프로모션 매칭 로직 구현
6. **Phase 6**: 장바구니 계산에 프로모션 통합
7. **Phase 7**: UI에 증정품 선택 기능 추가
8. **Phase 8**: 관리자 페이지에 병합 UI 추가

## 💾 데이터베이스 인덱스 및 성능 최적화

### 문제: 프로모션 조회 시 O(n) 전체 순회

수천 개의 프로모션 데이터가 있을 때, 특정 상품의 프로모션을 찾으려면 모든 프로모션을 순회해야 함.

### 해결: 역인덱스(Reverse Index) 사용

#### **PromotionIndex 컬렉션 (권장)**

```typescript
interface IPromotionIndex {
  _id: ObjectId;
  barcode: string;  // 상품 바코드 (Primary Key)
  promotionIds: ObjectId[];  // 이 상품에 적용 가능한 프로모션 ID 배열
  lastUpdated: Date;
}

// 인덱스
PromotionIndexSchema.index({ barcode: 1 }, { unique: true });
```

#### **사용 방법**

```typescript
// 1. 상품 바코드로 프로모션 ID 조회 (O(1))
const index = await PromotionIndex.findOne({ barcode: "8801234567890" });
// → { promotionIds: [ObjectId("..."), ObjectId("..."), ...] }

// 2. 프로모션 상세 정보 가져오기 (O(log n))
const promotions = await Promotion.find({
  _id: { $in: index.promotionIds },
  isActive: true,
  validFrom: { $lte: new Date() },
  validTo: { $gte: new Date() }
});
```

#### **인덱스 업데이트 시점**

프로모션이 생성/수정/삭제될 때 자동으로 인덱스 업데이트:

```typescript
// 프로모션 생성 시
async function createPromotion(promotionData) {
  const promotion = await Promotion.create(promotionData);

  // 인덱스 업데이트
  const barcodes = promotion.applicableProducts || [];
  for (const barcode of barcodes) {
    await PromotionIndex.updateOne(
      { barcode },
      {
        $addToSet: { promotionIds: promotion._id },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true }
    );
  }

  return promotion;
}

// 프로모션 삭제 시
async function deletePromotion(promotionId) {
  const promotion = await Promotion.findById(promotionId);

  // 인덱스에서 제거
  await PromotionIndex.updateMany(
    { promotionIds: promotionId },
    {
      $pull: { promotionIds: promotionId },
      $set: { lastUpdated: new Date() }
    }
  );

  await Promotion.deleteOne({ _id: promotionId });
}
```

#### **카테고리/브랜드 기반 프로모션 처리**

카테고리나 브랜드 기반 프로모션은 실시간으로 Product 정보를 확인:

```typescript
async function getPromotionsForProduct(barcode, category, brand) {
  // 1. 바코드 기반 프로모션 (인덱스 사용)
  const index = await PromotionIndex.findOne({ barcode });
  let promotionIds = index?.promotionIds || [];

  // 2. 카테고리/브랜드 기반 프로모션 (캐싱 추천)
  const categoryPromos = await Promotion.find({
    applicableType: 'categories',
    applicableCategories: category,
    isActive: true
  }).select('_id');

  const brandPromos = await Promotion.find({
    applicableType: 'brands',
    applicableBrands: brand,
    isActive: true
  }).select('_id');

  // 3. 통합
  const allPromoIds = [
    ...promotionIds,
    ...categoryPromos.map(p => p._id),
    ...brandPromos.map(p => p._id)
  ];

  // 4. 중복 제거 및 상세 정보 조회
  return await Promotion.find({
    _id: { $in: [...new Set(allPromoIds)] },
    validFrom: { $lte: new Date() },
    validTo: { $gte: new Date() }
  });
}
```

### Promotion 컬렉션 인덱스

```typescript
PromotionSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });
PromotionSchema.index({ applicableType: 1, applicableCategories: 1 });
PromotionSchema.index({ applicableType: 1, applicableBrands: 1 });
PromotionSchema.index({ promotionType: 1, isActive: 1 });
```

### 성능 비교

| 방법 | 프로모션 1000개 | 프로모션 10000개 |
|------|----------------|------------------|
| 전체 순회 | ~50ms | ~500ms |
| 역인덱스 | ~2ms | ~2ms |

**결론: 역인덱스를 사용하면 25배~250배 빠름!**

## 🌐 위키형 시스템: 사용자 참여 및 신뢰도 관리

### 문제: 프로모션은 할인규칙보다 검증이 어렵다

**할인규칙 vs 프로모션의 차이:**
- **할인규칙**: 결제 시점에 즉시 검증 가능 ("이 할인 실제로 적용되네!")
- **프로모션**: 증정품을 받기 전까지 확인 불가 ("실제로 받아봐야 알 수 있음")
- **교차증정 여부**: 매장에서 직접 시도해봐야 확인 가능

**문제 상황:**
1. 악의적 사용자가 잘못된 프로모션 등록 (존재하지 않는 1+1)
2. 교차증정 범위 불명확 (A, B만 가능한데 C도 포함시킴)
3. 기간 오류 (이미 종료된 프로모션을 활성으로 등록)

### 해결책: 다단계 신뢰도 시스템

#### 1. 검증 상태 (verificationStatus)

```typescript
type VerificationStatus =
  | 'unverified'  // 검증 안 됨 (새로 생성됨)
  | 'pending'     // 검증 대기 중 (일부 검증 있음)
  | 'verified'    // 검증됨 (충분한 검증 받음)
  | 'disputed';   // 이의 제기됨 (잘못된 정보 의심)
```

#### 2. 검증 로직

```typescript
// POST /api/promotions/:id/verify
// 사용자가 "이 프로모션 실제로 됩니다" 클릭
async function verifyPromotion(promotionId: string, userAddress: string) {
  const promotion = await Promotion.findById(promotionId);

  // 중복 검증 방지
  if (promotion.verifiedBy?.includes(userAddress)) {
    return { error: '이미 검증하셨습니다.' };
  }

  // 검증 추가
  await Promotion.updateOne(
    { _id: promotionId },
    {
      $addToSet: { verifiedBy: userAddress },
      $inc: { verificationCount: 1 },
      $pull: { disputedBy: userAddress }  // 검증 시 이의 제기 취소
    }
  );

  // 검증 상태 업데이트
  await updateVerificationStatus(promotionId);
}

// POST /api/promotions/:id/dispute
// 사용자가 "이 프로모션 안 됩니다" 클릭
async function disputePromotion(promotionId: string, userAddress: string, reason: string) {
  const promotion = await Promotion.findById(promotionId);

  if (promotion.disputedBy?.includes(userAddress)) {
    return { error: '이미 이의를 제기하셨습니다.' };
  }

  await Promotion.updateOne(
    { _id: promotionId },
    {
      $addToSet: { disputedBy: userAddress },
      $inc: { disputeCount: 1 },
      $pull: { verifiedBy: userAddress },  // 이의 제기 시 검증 취소
      $push: {
        modificationHistory: {
          modifiedBy: userAddress,
          modifiedAt: new Date(),
          changes: { type: 'dispute', reason },
          comment: `이의 제기: ${reason}`
        }
      }
    }
  );

  await updateVerificationStatus(promotionId);
}

// 검증 상태 자동 업데이트
async function updateVerificationStatus(promotionId: string) {
  const promotion = await Promotion.findById(promotionId);

  const verifyCount = promotion.verificationCount;
  const disputeCount = promotion.disputeCount;
  const ratio = disputeCount > 0 ? verifyCount / disputeCount : verifyCount;

  let newStatus: VerificationStatus;

  if (disputeCount >= 3 || (disputeCount > verifyCount && disputeCount >= 2)) {
    // 이의 제기가 많으면 'disputed'
    newStatus = 'disputed';
  } else if (verifyCount >= 5 && ratio >= 3) {
    // 검증 5개 이상 & 검증:이의 비율 3:1 이상 → 'verified'
    newStatus = 'verified';
  } else if (verifyCount >= 2) {
    // 검증 2개 이상 → 'pending'
    newStatus = 'pending';
  } else {
    // 기본값
    newStatus = 'unverified';
  }

  await Promotion.updateOne(
    { _id: promotionId },
    { $set: { verificationStatus: newStatus } }
  );
}
```

#### 3. UI 표시

```typescript
// 프로모션 카드에 신뢰도 배지 표시
function PromotionBadge({ promotion }: { promotion: IPromotion }) {
  const badges = {
    verified: {
      icon: '✅',
      text: '검증됨',
      color: 'bg-green-100 text-green-800',
      tooltip: `${promotion.verificationCount}명이 검증함`
    },
    pending: {
      icon: '⏳',
      text: '검증 중',
      color: 'bg-yellow-100 text-yellow-800',
      tooltip: `${promotion.verificationCount}명 검증, 더 필요`
    },
    unverified: {
      icon: '❓',
      text: '미검증',
      color: 'bg-gray-100 text-gray-800',
      tooltip: '검증이 필요합니다'
    },
    disputed: {
      icon: '⚠️',
      text: '논란',
      color: 'bg-red-100 text-red-800',
      tooltip: `${promotion.disputeCount}명이 이의 제기함`
    }
  };

  const badge = badges[promotion.verificationStatus];

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${badge.color}`} title={badge.tooltip}>
      {badge.icon} {badge.text}
    </span>
  );
}
```

#### 4. 검증 인센티브 (선택적)

```typescript
// 사용자 기여도 트래킹
interface UserContribution {
  address: string;
  promotionsVerified: number;
  promotionsDisputed: number;
  promotionsCreated: number;
  promotionsMerged: number;
  accuracyScore: number;  // 검증한 프로모션 중 최종적으로 맞았던 비율
}

// 리더보드 표시
// 🏆 이달의 기여자
// 1. 0x1234...5678 - 45개 검증, 정확도 95%
// 2. 0xabcd...ef01 - 32개 검증, 정확도 88%
```

#### 5. 자동 필터링

```typescript
// 사용자 설정에 따른 프로모션 필터링
async function getPromotionsForCart(cartItems: any[], userSettings: any) {
  const filter: any = {
    status: 'active',
    isActive: true,
    validFrom: { $lte: new Date() },
    validTo: { $gte: new Date() }
  };

  // 사용자 설정: "검증된 프로모션만 표시"
  if (userSettings.onlyVerified) {
    filter.verificationStatus = { $in: ['verified', 'pending'] };
  }

  // 사용자 설정: "논란 있는 프로모션 숨기기"
  if (userSettings.hideDisputed) {
    filter.verificationStatus = { $ne: 'disputed' };
  }

  return await Promotion.find(filter);
}
```

#### 6. 관리자 리뷰 큐

```typescript
// 관리자 페이지: 검토가 필요한 프로모션 목록
async function getPromotionsNeedingReview() {
  return await Promotion.find({
    $or: [
      // 논란이 많은 프로모션
      { verificationStatus: 'disputed' },

      // 검증 없이 오래된 프로모션
      {
        verificationStatus: 'unverified',
        createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },

      // 크롤링으로 생성되었지만 검증 안 된 프로모션
      {
        isCrawled: true,
        needsVerification: true,
        verificationCount: 0
      }
    ]
  }).sort({ disputeCount: -1, createdAt: 1 });
}

// UI: 관리자 리뷰 대시보드
// ⚠️ 논란 있는 프로모션 (3건)
//   - "코카콜라 1+1" - 검증 2 / 이의 5 [자세히 보기]
// ❓ 검증 필요 (12건)
//   - "펩시 2+1" - 7일 경과, 검증 0건 [자세히 보기]
```

#### 7. 권한 시스템 확장

```typescript
// 할인규칙과 다른 권한 정책
const PROMOTION_PERMISSIONS = {
  create: 'all',        // 모든 사용자 생성 가능
  edit: 'creator_or_admin',  // 생성자 또는 관리자만 수정
  delete: 'admin_only', // 관리자만 삭제 (또는 disputed 상태인 경우 자동 비활성화)
  merge: 'admin_only',  // 관리자만 병합
  verify: 'all',        // 모든 사용자 검증 가능
  dispute: 'all'        // 모든 사용자 이의 제기 가능
};

// API에서 권한 확인
async function editPromotion(promotionId: string, userAddress: string, updates: any) {
  const promotion = await Promotion.findById(promotionId);
  const isAdmin = await checkAdminStatus(userAddress);
  const isCreator = promotion.createdBy === userAddress;

  if (!isAdmin && !isCreator) {
    throw new Error('수정 권한이 없습니다. 생성자 또는 관리자만 수정할 수 있습니다.');
  }

  // 수정 진행...
}
```

### 비교: 할인규칙 vs 프로모션

| 항목 | 할인규칙 (DiscountRule) | 프로모션 (Promotion) |
|------|------------------------|---------------------|
| 검증 난이도 | 쉬움 (결제 시 즉시 확인) | 어려움 (실제 증정까지 확인 필요) |
| 수정 권한 | 모든 사용자 | 생성자 또는 관리자 |
| 삭제 권한 | 관리자만 | 관리자만 |
| 신뢰도 시스템 | 선택적 | **필수** |
| 검증 시스템 | 불필요 | **필수** |
| 이의 제기 | 선택적 | **필수** |

### 권장 구현 순서

1. **Phase 1**: 기본 CRUD (생성/수정/삭제)
2. **Phase 2**: 검증/이의 제기 API
3. **Phase 3**: 신뢰도 상태 자동 업데이트
4. **Phase 4**: UI에 배지 표시
5. **Phase 5**: 사용자 기여도 트래킹
6. **Phase 6**: 관리자 리뷰 대시보드
