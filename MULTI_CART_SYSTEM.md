# 멀티 카트 시스템 구현 완료

여러 개의 장바구니를 만들어 다양한 할인 조합을 비교할 수 있는 멀티 카트 시스템이 완료되었습니다.

## 구현된 기능

### 1. 타입 정의 (`src/types/cart.ts`)

**ICart 인터페이스:**
- 카트 메타데이터: 이름, 이모지, 설명, 색상
- 카트 아이템 목록 (상품 ID, 바코드, 이름, 가격, 수량, 선택된 할인)
- 전역 설정: 결제수단, 프리셋 연결
- 계산 결과 캐시 (정가, 최종 금액, 할인액)

**ICartItem 인터페이스:**
- 상품 정보 (ID, 바코드, 이름, 가격, 카테고리, 브랜드)
- 수량
- 선택된 할인 ID 목록

**추가 타입:**
- `CreateCartInput`, `UpdateCartInput`: CRUD 입력
- `CartComparison`: 카트 비교 결과
- `CART_COLORS`: 6가지 색상 스키마 (purple, blue, green, orange, pink, red)

### 2. 데이터베이스 레이어

#### 인터페이스 확장 (`src/lib/db/interfaces.ts`)
```typescript
// Carts
findCarts(filter?, options?): Promise<ICart[]>
findCartById(id): Promise<ICart | null>
createCart(data): Promise<ICart>
updateCart(id, data): Promise<ICart | null>
deleteCart(id): Promise<boolean>
```

#### Memory Adapter 구현 (`src/lib/db/memory.adapter.ts`)
- 인메모리 카트 저장소
- 전체 CRUD 작업 구현
- 날짜 자동 관리 (createdAt, updatedAt)

### 3. API 라우트

#### `/api/carts` (GET, POST)
- `GET`: 모든 카트 조회 (최근 수정순 정렬)
- `POST`: 새 카트 생성
  - 이름 유효성 검사
  - 빈 아이템 배열로 초기화

#### `/api/carts/[id]` (GET, PATCH, DELETE)
- `GET`: 특정 카트 조회
- `PATCH`: 카트 수정 (이름, 아이템, 결제수단, 캐시 등)
- `DELETE`: 카트 삭제

#### `/api/carts/compare` (POST)
- 여러 카트의 할인 계산 수행
- 각 카트의 정가, 최종 금액, 할인액, 할인율 반환
- 최고 절약 카트 자동 식별

### 4. UI 컴포넌트

#### 카트 관리 페이지 (`/app/carts/page.tsx`)

**주요 기능:**
- 모든 카트 그리드 표시
- 카트별 색상 구분
- 카트 통계 (상품 종류, 총 수량, 예상 결제액)
- 빠른 액션:
  - 상세보기
  - 복사 (동일한 내용의 카트 생성)
  - 삭제

**카트 생성 모달:**
- 카트 이름 (필수)
- 이모지 (선택)
- 색상 선택 (6가지)
- 설명 (선택)

**빈 상태 처리:**
- 카트가 없을 때 안내 메시지
- 첫 카트 만들기 버튼

#### 카트 비교 페이지 (`/app/carts/compare/page.tsx`)

**주요 기능:**
- 비교할 카트 다중 선택 (체크박스)
- 실시간 비교 실행
- 최고 절약 카트 강조 표시 (황금 테두리 + 🏆)

**비교 결과 표시:**
1. **최고 절약 카트 배너**
   - 황금 배경
   - 절약 금액 강조

2. **상세 비교 카드**
   - 각 카트의 정가, 할인액, 최종 금액
   - 할인율 표시
   - 카트별 색상 구분

3. **절약 비교 차트**
   - 수평 바 차트
   - 절약 금액 기준 정렬
   - 퍼센트 표시

### 5. 네비게이션

- 메인 페이지 푸터에 "장바구니 비교" 링크 추가
- 카트 목록 페이지에서 비교 페이지로 직접 이동 가능

## 사용 흐름

### 카트 생성
1. `/carts` 페이지 접속
2. "새 카트 만들기" 버튼 클릭
3. 카트 정보 입력:
   - 이름 (필수)
   - 이모지, 색상, 설명 (선택)
4. 빈 카트 생성됨

### 카트에 상품 추가 (향후 구현)
1. 카트 상세 페이지에서
2. 상품 검색 또는 스캔
3. 할인 선택
4. 수량 입력
5. 카트에 추가

### 카트 비교
1. `/carts/compare` 페이지 접속
2. 비교할 카트 선택 (최소 2개)
3. "비교하기" 버튼 클릭
4. 결과 확인:
   - 최고 절약 카트
   - 상세 비교
   - 절약 차트

### 카트 복사
1. 카트 목록에서 📋 버튼 클릭
2. 동일한 내용의 카트가 "(복사본)" 이름으로 생성
3. 복사본을 수정하여 다른 조합 테스트

## 데이터 구조 예시

```typescript
{
  _id: "...",
  name: "통신사 할인 조합",
  emoji: "📱",
  description: "우주패스 + 멤버십 조합",
  color: "blue",
  items: [
    {
      productId: "product_id_1",
      barcode: "8801234567890",
      name: "코카콜라 500ml",
      price: 1500,
      quantity: 2,
      category: "음료",
      selectedDiscountIds: ["discount_id_1", "discount_id_2"]
    }
  ],
  paymentMethod: "CARD_KB",
  cachedTotalOriginalPrice: 3000,
  cachedTotalFinalPrice: 2100,
  cachedTotalDiscount: 900,
  createdAt: "2025-01-16T10:00:00Z",
  updatedAt: "2025-01-16T11:30:00Z",
  lastCalculatedAt: "2025-01-16T11:30:00Z"
}
```

## 색상 시스템

6가지 색상으로 카트를 시각적으로 구분:

| 색상 | 배경 | 테두리 | 텍스트 | 배지 |
|------|------|--------|--------|------|
| purple | bg-purple-50 | border-purple-200 | text-purple-700 | bg-purple-100 |
| blue | bg-blue-50 | border-blue-200 | text-blue-700 | bg-blue-100 |
| green | bg-green-50 | border-green-200 | text-green-700 | bg-green-100 |
| orange | bg-orange-50 | border-orange-200 | text-orange-700 | bg-orange-100 |
| pink | bg-pink-50 | border-pink-200 | text-pink-700 | bg-pink-100 |
| red | bg-red-50 | border-red-200 | text-red-700 | bg-red-100 |

## 향후 구현 항목

### 1. 카트 상세 페이지 (`/app/carts/[id]/page.tsx`)
- 카트 내 상품 목록 표시
- 상품 추가/수정/삭제
- 할인 선택 UI
- 실시간 계산 결과 표시
- 프리셋 적용 기능

### 2. 프리셋과 카트 연동
- 프리셋 선택 시 자동으로 할인 적용
- 카트에서 프리셋 변경 가능

### 3. 계산 결과 캐싱
- 카트 수정 시 자동 재계산
- 캐시된 결과를 카트 목록에 표시

### 4. 카트 공유
- 카트 설정을 URL로 공유
- QR 코드 생성

### 5. 카트 템플릿
- 자주 사용하는 조합을 템플릿으로 저장
- 템플릿에서 카트 빠른 생성

## 기술적 특징

1. **타입 안전성**: 완벽한 TypeScript 타입 정의
2. **메모리 저장소**: 개발 중 빠른 테스트, MongoDB 마이그레이션 준비됨
3. **RESTful API**: 표준 REST 패턴
4. **반응형 디자인**: 모바일/태블릿/데스크탑 지원
5. **색상 시스템**: 시각적 구분을 위한 6가지 색상
6. **실시간 계산**: 할인 계산 엔진과 완벽 통합

## 연관 시스템

### 프리셋 시스템
- 프리셋을 카트에 연결 가능
- 프리셋의 할인 설정을 카트에 빠르게 적용

### 할인 계산 엔진
- 카트 비교 시 v2 할인 계산 엔진 사용
- 6가지 할인 카테고리 모두 지원

### 상품 관리
- 상품 바코드로 카트 아이템 생성
- 상품 정보 자동 로드

---

**구현 완료일**: 2025년 1월 16일

**구현된 파일 목록**:
- `src/types/cart.ts` (확장)
- `src/lib/db/interfaces.ts` (확장)
- `src/lib/db/memory.adapter.ts` (확장)
- `src/app/api/carts/route.ts`
- `src/app/api/carts/[id]/route.ts`
- `src/app/api/carts/compare/route.ts`
- `src/app/carts/page.tsx`
- `src/app/carts/compare/page.tsx`
- `src/app/page.tsx` (네비게이션 추가)

**완료된 기능**:
- ✅ 카트 CRUD
- ✅ 카트 목록 페이지
- ✅ 카트 비교 페이지
- ✅ 색상 시스템
- ✅ 최고 절약 카트 식별
- ✅ 카트 복사 기능

**다음 단계**:
- 카트 상세 페이지 (상품 추가/수정)
- 프리셋 연동
- 실시간 계산 결과 표시
