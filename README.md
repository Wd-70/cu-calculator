# CU 편의점 할인 계산기

CU 편의점의 복잡한 할인 시스템을 처리하는 웹 애플리케이션입니다. 1+1, 2+1, 퍼센트 할인, 카드 할인 등 다양한 할인을 조합하여 최종 결제 금액을 계산합니다.

## 주요 기능

### 이미 구현된 기능 ✅

1. **복잡한 할인 조합 시스템**
   - 중복 가능/불가능 할인 관리
   - 할인 적용 순서 제어 (applicationOrder)
   - 선행 조건이 있는 할인 처리 (requiresPreviousDiscount)
   - 결제수단별 할인 제한 (신한카드 전용, CU페이 전용 등)
   - 기간별 할인 유효성 검증 (validFrom/validTo)

2. **월별 이벤트 관리**
   - 이벤트 월 그룹핑 (eventMonth)
   - 현재 월 활성 할인 조회
   - 기간 제한 이벤트 지원

3. **상품 관리 (크라우드소싱)**
   - 상품 등록/수정/조회
   - 상품 정보 검증 시스템 (verificationCount)
   - 잘못된 정보 신고 (reportCount)
   - 수정 이력 추적 (ModificationHistory)

4. **바코드 스캔**
   - html5-qrcode 기반 모바일 카메라 스캔
   - 실시간 바코드 인식

5. **장바구니 계산 API**
   - 다중 할인 순차 적용
   - 결제수단별 할인 계산
   - 실시간 가격 계산

## 기술 스택

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**:
  - 🎯 **LocalStorage** (기본값) - 브라우저 저장소, 설치 불필요!
  - 🗄️ **MongoDB** - 프로덕션용 데이터베이스 (선택적)
  - 🔄 **쉬운 전환** - 환경 변수 하나로 전환 가능!
- **Barcode**: html5-qrcode
- **State Management**: Zustand
- **Validation**: Zod

## ⚡ 빠른 시작 (설치 없이 바로 사용!)

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

### 3. 샘플 데이터 초기화

브라우저에서 http://localhost:3000 접속 후, 개발자 도구 콘솔에서:

```javascript
// 샘플 데이터 생성 (상품 6개 + 할인 5개)
fetch('/api/init', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)

// 데이터 확인
fetch('/api/products').then(r => r.json()).then(console.log)
fetch('/api/discounts/current-month').then(r => r.json()).then(console.log)
```

또는 터미널에서:

```bash
curl -X POST http://localhost:3000/api/init
curl http://localhost:3000/api/products
```

### 4. 완료! 🎉

이제 모든 API가 작동합니다. MongoDB 설치 없이 바로 개발을 시작할 수 있습니다!

## 🔄 MongoDB로 전환하기

나중에 프로덕션 환경에서 사용하거나 더 많은 데이터를 저장하려면:

### 1. MongoDB 설치

```bash
# Docker 사용 (추천)
docker run -d -p 27017:27017 --name cu-mongodb mongo

# 또는 로컬 설치
mongod
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성:

```env
NEXT_PUBLIC_DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/cu-discount
```

### 3. 서버 재시작

```bash
npm run dev
```

### 4. 샘플 데이터 초기화

```bash
curl -X POST http://localhost:3000/api/init
```

완료! 모든 API가 MongoDB를 사용합니다.

📚 **자세한 내용**: [DATABASE_GUIDE.md](./DATABASE_GUIDE.md) 참고

## API 문서

### 할인 관리 API

#### GET /api/discounts
모든 할인 규칙 조회 (필터링 지원)

Query Parameters:
- `active`: true/false
- `type`: bundle/percentage/fixed/gift
- `month`: 2025-10
- `paymentMethod`: card_shinhan, cu_pay 등

#### GET /api/discounts/current-month
현재 월 활성 할인 조회

#### POST /api/discounts/validate-combination
할인 조합 검증

```json
{
  "discountIds": ["id1", "id2"],
  "paymentMethod": "card_shinhan"
}
```

### 상품 관리 API

#### GET /api/products
상품 검색

Query Parameters:
- `barcode`: 바코드 번호
- `name`: 상품명
- `category`: 카테고리

#### POST /api/products
새 상품 등록

#### GET /api/products/:id
특정 상품 조회 (적용 가능한 할인 포함)

#### PUT /api/products/:id
상품 정보 수정

#### POST /api/products/:id/verify
상품 정보 검증

#### POST /api/products/:id/report
잘못된 정보 신고

### 장바구니 계산 API

#### POST /api/calculate
장바구니 총액 계산

```json
{
  "items": [
    {
      "productId": "product_id",
      "quantity": 2,
      "selectedDiscountIds": ["discount1", "discount2"]
    }
  ],
  "paymentMethod": "card_shinhan"
}
```

## 할인 시스템 핵심 개념

### 1. 할인 적용 순서 (applicationOrder)

- 숫자가 작을수록 먼저 적용
- 1+1/2+1 같은 번들 할인이 가장 먼저 (order=1)
- 퍼센트/고정금액 할인이 그 다음 (order=2-3)
- 멤버십 같은 추가 할인이 마지막 (order=4)

### 2. 할인 조합 규칙

- **canCombineWith**: 이 배열에 있는 할인과만 조합 가능
- **cannotCombineWith**: 이 배열에 있는 할인과 절대 조합 불가
- **requiresPreviousDiscount**: 이 할인 적용 전 반드시 필요한 할인

### 3. 결제수단 제한

```javascript
{
  requiredPaymentMethods: ["card_shinhan"],
  paymentMethodNames: ["신한카드"]
}
```

### 4. 상품 적용 대상

```javascript
// 특정 상품만
{ applicableProducts: [id1, id2], applicableCategories: [] }

// 특정 카테고리
{ applicableProducts: [], applicableCategories: ["음료"] }

// 모든 상품
{ applicableProducts: [], applicableCategories: [] }
```

## 할인 조합 예시

### 복합 할인: 20% + 신한카드 10% + 멤버십 5%

**결과**: 20,000원 → 16,000원 (20%) → 14,400원 (10%) → 13,680원 (5%) = **총 31.6% 할인**

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── products/          # 상품 API
│   │   ├── discounts/         # 할인 API
│   │   ├── calculate/         # 계산 API
│   │   └── init/              # 🆕 데이터 초기화 API
│   └── page.tsx
├── components/
│   └── BarcodeScanner.tsx
├── lib/
│   ├── db/                    # 🆕 데이터베이스 추상화 레이어
│   │   ├── interfaces.ts      #     - 공통 인터페이스
│   │   ├── localStorage.adapter.ts  # - LocalStorage 구현
│   │   ├── mongodb.adapter.ts       # - MongoDB 구현
│   │   ├── index.ts           #     - 팩토리 함수
│   │   ├── api-helpers.ts     #     - API 헬퍼
│   │   └── seed-data.ts       #     - 샘플 데이터
│   ├── mongodb.ts             # (MongoDB 직접 연결용)
│   ├── models/                # (MongoDB 모델)
│   │   ├── Product.ts
│   │   ├── DiscountRule.ts
│   │   └── ModificationHistory.ts
│   └── utils/
│       ├── discountValidator.ts
│       └── discountCalculator.ts
└── types/
    ├── product.ts
    ├── discount.ts
    ├── payment.ts
    └── cart.ts
```

## 다음 단계 (구현 예정)

- [ ] 메인 페이지 UI
- [ ] 상품 검색 페이지
- [ ] 장바구니 페이지
- [ ] 할인 선택 UI
- [ ] 결제수단 선택 UI
- [ ] 관리자 대시보드
- [ ] CU 웹사이트 크롤러

## 라이선스

MIT
