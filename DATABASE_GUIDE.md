# 데이터베이스 전환 가이드

이 프로젝트는 **데이터베이스 추상화 레이어**를 사용하여 쉽게 다른 데이터베이스로 전환할 수 있습니다.

## 📦 현재 사용 가능한 어댑터

1. **LocalStorage** (기본값) - 브라우저 localStorage 사용
2. **MongoDB** - MongoDB 데이터베이스 사용

## 🔄 데이터베이스 전환 방법

### 방법 1: 환경 변수로 전환 (추천)

`.env.local` 파일을 생성하고 다음을 설정하세요:

```env
# LocalStorage 사용 (기본값)
NEXT_PUBLIC_DB_TYPE=localStorage

# 또는 MongoDB 사용
# NEXT_PUBLIC_DB_TYPE=mongodb
# MONGODB_URI=mongodb://localhost:27017/cu-discount
```

### 방법 2: 코드에서 직접 전환

`src/lib/db/index.ts` 파일에서 직접 변경:

```typescript
// LocalStorage 사용
const DB_TYPE = 'localStorage';

// MongoDB 사용
const DB_TYPE = 'mongodb';
```

## 🚀 빠른 시작

### LocalStorage 사용 (설치 필요 없음!)

1. 환경 변수 설정 (선택적)
```bash
echo "NEXT_PUBLIC_DB_TYPE=localStorage" > .env.local
```

2. 개발 서버 실행
```bash
npm run dev
```

3. 브라우저에서 샘플 데이터 초기화
```bash
# POST 요청으로 초기 데이터 생성
curl -X POST http://localhost:3000/api/init

# 또는 브라우저에서
fetch('http://localhost:3000/api/init', { method: 'POST' })
```

4. 데이터 확인
```bash
# GET 요청으로 상태 확인
curl http://localhost:3000/api/init

# 상품 목록 조회
curl http://localhost:3000/api/products
```

### MongoDB 사용

1. MongoDB 설치 및 실행
```bash
# Docker 사용
docker run -d -p 27017:27017 --name cu-mongodb mongo

# 또는 로컬 설치 후
mongod
```

2. 환경 변수 설정
```bash
cat > .env.local << EOF
NEXT_PUBLIC_DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/cu-discount
EOF
```

3. 개발 서버 실행
```bash
npm run dev
```

4. 샘플 데이터 초기화
```bash
curl -X POST http://localhost:3000/api/init
```

## 📊 데이터 구조

두 어댑터 모두 **동일한 MongoDB 스타일 데이터 구조**를 사용합니다:

### Products
```javascript
{
  _id: ObjectId,
  barcode: "8801234567890",
  name: "코카콜라 500ml",
  price: 1500,
  category: "음료",
  brand: "코카콜라",
  createdBy: "user123",
  createdAt: Date,
  updatedAt: Date,
  isVerified: true,
  verificationCount: 5,
  reportCount: 0
}
```

### DiscountRules
```javascript
{
  _id: ObjectId,
  name: "음료 1+1",
  type: "bundle",
  requiredQuantity: 2,
  freeQuantity: 1,
  applicableProducts: [ObjectId, ObjectId],
  applicationOrder: 1,
  validFrom: Date,
  validTo: Date,
  isActive: true,
  createdAt: Date,
  updatedAt: Date
}
```

## 🎮 API 사용 예시

모든 API는 **데이터베이스에 상관없이 동일하게 작동**합니다!

### 상품 조회
```bash
# 모든 상품
GET /api/products

# 바코드로 검색
GET /api/products?barcode=8801234567890

# 이름으로 검색
GET /api/products?name=콜라

# 카테고리로 검색
GET /api/products?category=음료
```

### 상품 추가
```bash
POST /api/products
Content-Type: application/json

{
  "barcode": "8801234567899",
  "name": "새로운 상품",
  "price": 2000,
  "category": "과자"
}
```

### 할인 규칙 조회
```bash
# 현재 월 활성 할인
GET /api/discounts/current-month

# 모든 할인
GET /api/discounts

# 특정 결제수단 가능 할인
GET /api/discounts?paymentMethod=card_shinhan
```

### 장바구니 계산
```bash
POST /api/calculate
Content-Type: application/json

{
  "items": [
    {
      "barcode": "8801234567890",
      "quantity": 2,
      "selectedDiscountIds": ["discount_id_1"]
    }
  ],
  "paymentMethod": "card_shinhan"
}
```

## 🔧 나만의 어댑터 만들기

PostgreSQL, MySQL 등 다른 데이터베이스도 쉽게 추가할 수 있습니다!

1. `src/lib/db/interfaces.ts`의 `IDatabase` 인터페이스를 구현
2. 새 어댑터 파일 생성 (예: `postgresql.adapter.ts`)
3. `src/lib/db/index.ts`에 추가

```typescript
// postgresql.adapter.ts
import { IDatabase } from './interfaces';

export class PostgreSQLAdapter implements IDatabase {
  async connect() { /* PostgreSQL 연결 */ }
  async findProducts(filter, options) { /* 구현 */ }
  // ... 나머지 메서드 구현
}

// index.ts에 추가
case 'postgresql':
  dbInstance = new PostgreSQLAdapter();
  break;
```

## 💾 LocalStorage 데이터 확인

브라우저 개발자 도구에서:

```javascript
// 저장된 데이터 보기
localStorage.getItem('cu_products')
localStorage.getItem('cu_discount_rules')

// 데이터 삭제 (초기화)
localStorage.clear()
```

## 🚨 주의사항

### LocalStorage
- ✅ 설치 불필요
- ✅ 빠른 프로토타이핑
- ❌ 브라우저마다 독립적 (동기화 안 됨)
- ❌ 용량 제한 (보통 5-10MB)
- ❌ 서버 사이드에서 접근 불가
- ⚠️  **프로덕션에서는 사용하지 마세요!**

### MongoDB
- ✅ 프로덕션 환경에 적합
- ✅ 대용량 데이터 처리
- ✅ 서버 사이드 접근 가능
- ✅ 데이터 동기화
- ❌ 설치 및 설정 필요

## 🎯 권장 워크플로우

1. **개발 초기**: LocalStorage로 빠르게 프로토타입 개발
2. **기능 완성 후**: MongoDB로 전환하여 테스트
3. **배포**: MongoDB 사용

## 📝 샘플 데이터 내용

초기화 API(`POST /api/init`)를 호출하면 다음 데이터가 생성됩니다:

**상품 (6개)**
- 코카콜라 500ml (1,500원)
- 스프라이트 500ml (1,500원)
- 프링글스 오리지널 (2,500원)
- 허니버터칩 (2,000원)
- 삼각김밥 참치 (1,800원)
- 컵라면 신라면 (1,300원)

**할인 규칙 (5개)**
- 음료 1+1 (코카콜라, 스프라이트)
- 과자 2+1 (프링글스, 허니버터칩)
- 전체 상품 20% 할인
- 신한카드 10% 할인 (최대 3,000원)
- 멤버십 5% 추가할인

## 🧪 테스트 시나리오

```bash
# 1. 초기화
curl -X POST http://localhost:3000/api/init

# 2. 상품 조회
curl http://localhost:3000/api/products

# 3. 할인 조회
curl http://localhost:3000/api/discounts/current-month

# 4. 장바구니 계산 (코카콜라 2개, 1+1 할인 적용)
curl -X POST http://localhost:3000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "barcode": "8801234567890",
      "quantity": 2,
      "selectedDiscountIds": ["음료1+1할인ID"]
    }]
  }'
```

## 🔄 데이터베이스 마이그레이션

LocalStorage에서 MongoDB로 데이터를 옮기려면:

```typescript
// 간단한 마이그레이션 스크립트 예시
import { LocalStorageAdapter } from '@/lib/db/localStorage.adapter';
import { MongoDBAdapter } from '@/lib/db/mongodb.adapter';

async function migrate() {
  const local = new LocalStorageAdapter();
  const mongo = new MongoDBAdapter();

  await local.connect();
  await mongo.connect();

  // 상품 복사
  const products = await local.findProducts();
  for (const product of products) {
    await mongo.createProduct(product);
  }

  // 할인 복사
  const discounts = await local.findDiscountRules();
  for (const discount of discounts) {
    await mongo.createDiscountRule(discount);
  }
}
```

## ❓ FAQ

**Q: LocalStorage가 꽉 차면 어떻게 되나요?**
A: 브라우저가 에러를 발생시킵니다. 개발자 도구에서 `localStorage.clear()`로 초기화하세요.

**Q: LocalStorage 데이터는 어디에 저장되나요?**
A: 브라우저 데이터 폴더에 저장됩니다. 브라우저 캐시를 지우면 삭제됩니다.

**Q: 프로덕션에서 LocalStorage를 써도 되나요?**
A: 절대 안 됩니다! 실제 서비스에서는 반드시 MongoDB나 다른 데이터베이스를 사용하세요.

**Q: API 코드는 수정해야 하나요?**
A: 아니요! 어댑터만 바꾸면 모든 API가 자동으로 작동합니다.
