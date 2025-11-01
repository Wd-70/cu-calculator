# CU POS 프로모션 사진 변환 가이드

## 📌 목적
이 문서는 `data/promotions/` 폴더에 수집된 CU POS기 프로모션 화면 사진들을 구조화된 JSON 데이터로 변환하기 위한 영구적인 작업 지시서입니다.

## 📂 파일 구조

```
data/
└── promotions/
    ├── {promotionId}/
    │   ├── photo_*.jpg           # POS 화면 사진들
    │   └── metadata.json         # 프로모션 메타데이터
    └── conversion-batches/
        ├── batch_{timestamp}.json    # 변환된 데이터 (Claude가 생성)
        └── batch_{timestamp}_imported.flag  # 임포트 완료 플래그
```

## 🎯 작업 프로세스

### 1. 읽어야 할 파일들
- **모든 `metadata.json` 파일**: 각 프로모션 폴더 내에 있음
- **`conversionStatus`가 `pending`인 프로모션의 사진들**
- **사진 파일**: `data/promotions/{promotionId}/photo_*.jpg`

### 2. metadata.json 구조 예시
```json
{
  "promotionId": "507f1f77bcf86cd799439011",
  "promotionName": "2510아이스3000원2+1",
  "currentData": {
    "name": "2510아이스3000원2+1",
    "promotionType": "2+1",
    "applicableProducts": ["8807203003003"],
    "giftSelectionType": "same",
    "giftConstraints": { "mustBeSameProduct": true },
    "validFrom": "2025-10-01T00:00:00.000Z",
    "validTo": "2025-10-31T23:59:59.999Z"
  },
  "photos": [
    {
      "filename": "photo_2025-10-22_01-23-45.jpg",
      "uploadedAt": "2025-10-22T01:23:45.123Z",
      "status": "uploaded"
    }
  ],
  "photoCollected": true,
  "conversionStatus": "pending"
}
```

## 📸 POS 화면 사진 읽는 방법

CU POS기의 "상품별 행사정보" 화면에서 다음 정보를 추출:

### 추출할 정보
1. **상품명 섹션** (○ 상품명)
   - 형식: `- {바코드} {상품명}`
   - 예: `- 8807203003003 마카다미아브리틀바`

2. **행사명 섹션** (○ 행사명)
   - 형식: `- {행사코드}{행사명}`
   - 예: `- 2510아이스3000원2+1`

3. **행사설명 섹션** (○ 행사설명)
   - 형식: `- -{설명} {프로모션타입}`
   - 예: `- -아이스 3,000원 30종 2+1`
   - 여기서 프로모션 타입 추출: `2+1`, `1+1`, `2+2` 등

4. **행사기간 섹션**
   - 형식: `행사기간 : YYYY-MM-DD ~ YYYY-MM-DD`
   - 예: `행사기간 : 2025-10-01 ~ 2025-10-31`

5. **행사대상상품 섹션** (○ 행사대상상품(교차 가능))
   - 이 섹션이 있으면 여러 상품이 서로 교차 증정 가능함을 의미
   - 구매 상품도 이 목록에 포함되어야 함
   - `giftSelectionType: "cross"` (같은 목록 내 교차 증정)
   - 각 줄: `- {바코드} {상품명}`
   - 예:
     ```
     - 8801062001774 제로트리플초코바
     - 8801062001989 제로쿠키앤크림바
     - 8801062002504 일품팥빙수
     ```
   - **주의**: 구매 상품 바코드를 applicableProducts에 포함시켜야 함!

## 📝 생성해야 할 JSON 구조

### 출력 형식: `batch_{timestamp}.json`

```json
{
  "batchId": "batch_2025-10-22_15-30-45",
  "createdAt": "2025-10-22T15:30:45.123Z",
  "totalPromotions": 4,
  "conversions": [
    {
      "sourcePromotionId": "507f1f77bcf86cd799439011",
      "sourcePhotoPath": "data/promotions/507f1f77bcf86cd799439011/photo_2025-10-22_01-23-45.jpg",
      "action": "update_and_merge",
      "confidence": "high",
      "extractedData": {
        "posScreenData": {
          "productBarcode": "8807203003003",
          "productName": "마카다미아브리틀바",
          "eventCode": "2510",
          "eventName": "아이스3000원2+1",
          "eventDescription": "-아이스 3,000원 30종 2+1",
          "eventPeriod": {
            "start": "2025-10-01",
            "end": "2025-10-31"
          },
          "crossGiftAvailable": true,
          "giftProducts": [
            { "barcode": "8801062001774", "name": "제로트리플초코바" },
            { "barcode": "8801062001989", "name": "제로쿠키앤크림바" },
            { "barcode": "8801062002504", "name": "일품팥빙수" },
            { "barcode": "8801062861729", "name": "제로밀크모나카" },
            { "barcode": "8801062874729", "name": "생고드름" },
            { "barcode": "8801118256936", "name": "구름우유아이스잠" },
            { "barcode": "8801206004548", "name": "허쉬초코바" },
            { "barcode": "8801206004555", "name": "허쉬토피넛앤초코바" },
            { "barcode": "8801206004562", "name": "허쉬쿠키앤크림바" },
            { "barcode": "8801206004609", "name": "허쉬초코모나카" }
          ]
        },
        "promotionUpdate": {
          "name": "2510아이스3000원30종2+1",
          "description": "아이스 3,000원 30종 2+1 행사",
          "promotionType": "2+1",
          "buyQuantity": 2,
          "getQuantity": 1,
          "applicableType": "products",
          "applicableProducts": [
            "8807203003003",
            "8801062001774",
            "8801062001989",
            "8801062002504",
            "8801062861729",
            "8801062874729",
            "8801118256936",
            "8801206004548",
            "8801206004555",
            "8801206004562",
            "8801206004609"
          ],
          "giftSelectionType": "cross",
          "giftProducts": [],
          "validFrom": "2025-10-01T00:00:00.000Z",
          "validTo": "2025-10-31T23:59:59.999Z",
          "status": "active",
          "isActive": true
        }
      },
      "mergeStrategy": {
        "type": "expand_product_list",
        "description": "기존 단일 상품 프로모션을 교차 증정 가능한 다중 상품 프로모션으로 확장"
      },
      "warnings": [],
      "notes": "POS 화면에서 교차 증정 가능한 10개 상품 확인됨. 구매 상품 포함 총 11개 상품이 서로 교차 증정 가능 (giftSelectionType: cross)."
    },
    {
      "sourcePromotionId": "507f1f77bcf86cd799439012",
      "sourcePhotoPath": "data/promotions/507f1f77bcf86cd799439012/photo_2025-10-22_01-24-12.jpg",
      "action": "update_and_merge",
      "confidence": "high",
      "extractedData": {
        "posScreenData": {
          "productBarcode": "8801114160909",
          "productName": "풀무원사골양지설렁탕",
          "eventCode": "2510",
          "eventName": "풀무원국탕3종2+1",
          "eventDescription": "-풀무원)나주식수육곰탕/사골양지설렁탕/정통도가니탕 2+1",
          "eventPeriod": {
            "start": "2025-10-01",
            "end": "2025-10-31"
          },
          "crossGiftAvailable": true,
          "giftProducts": [
            { "barcode": "8801114153819", "name": "풀무원나주식수육곰탕" },
            { "barcode": "8801114160909", "name": "풀무원사골양지설렁탕" },
            { "barcode": "8801114164402", "name": "풀무원)정통도가니탕" }
          ]
        },
        "promotionUpdate": {
          "name": "2510풀무원국탕3종2+1",
          "description": "풀무원 나주식수육곰탕/사골양지설렁탕/정통도가니탕 2+1 행사",
          "promotionType": "2+1",
          "buyQuantity": 2,
          "getQuantity": 1,
          "applicableType": "products",
          "applicableProducts": [
            "8801114153819",
            "8801114160909",
            "8801114164402"
          ],
          "giftSelectionType": "cross",
          "giftProducts": [
            "8801114153819",
            "8801114160909",
            "8801114164402"
          ],
          "validFrom": "2025-10-01T00:00:00.000Z",
          "validTo": "2025-10-31T23:59:59.999Z",
          "status": "active",
          "isActive": true
        }
      },
      "mergeStrategy": {
        "type": "expand_product_list",
        "description": "3종 교차 증정 프로모션으로 확장"
      },
      "warnings": [],
      "notes": "풀무원 국탕 3종이 서로 교차 증정 가능."
    }
  ],
  "summary": {
    "processed": 4,
    "succeeded": 4,
    "failed": 0,
    "warnings": 0
  }
}
```

## 🔍 중요 규칙

### 1. 바코드 처리
- **모든 바코드는 13자리 숫자 문자열**
- 0으로 시작하는 바코드도 문자열로 처리
- 예: `"8801223100261"` (문자열)

### 2. 프로모션 타입 추출
- 행사설명 마지막 부분에서 추출: `2+1`, `1+1`, `2+2` 등
- `buyQuantity`와 `getQuantity` 자동 계산
  - `2+1` → `buyQuantity: 2, getQuantity: 1`
  - `1+1` → `buyQuantity: 1, getQuantity: 1`

### 3. 증정 방식 판단
- **"행사대상상품(교차 가능)"** 섹션이 있으면:
  - 목록의 상품이 2개 이상이고 구매 상품과 다른 상품이 포함되어 있으면:
    - `giftSelectionType: "combo"` (콤보 증정)
    - `giftProducts` 배열에 모든 증정 가능 상품 바코드 추가
  - 목록의 상품이 2개 이상이고 모두 구매 목록에 포함되면:
    - `giftSelectionType: "cross"` (교차 증정)
    - 구매 목록 = 증정 목록
- 교차 가능 섹션이 없고 단일 상품이면:
  - `giftSelectionType: "same"` (동일 상품)
  - `giftProducts` 필드 생략

### 4. 날짜 처리
- **입력 형식**: `YYYY-MM-DD`
- **출력 형식**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- `validFrom`: 시작일 00:00:00
- `validTo`: 종료일 23:59:59

### 5. action 필드 결정
- `"update_and_merge"`: 기존 프로모션 업데이트 및 상품 병합 (대부분의 경우)
- `"create_new"`: 완전히 새로운 프로모션 생성 (거의 없음)
- `"skip"`: 이미 완벽한 데이터, 업데이트 불필요

### 6. confidence 필드
- `"high"`: 모든 정보가 명확하게 보임
- `"medium"`: 일부 흐릿하거나 불확실
- `"low"`: 확인 필요

### 7. 상품명 처리
- POS 화면의 상품명을 그대로 사용
- 괄호, 특수문자 포함된 그대로 기록
- 예: `"풀무원)정통도가니탕"` (괄호 포함)

## ⚠️ 예외 상황 처리

### 1. 사진이 흐릿하거나 읽기 어려운 경우
```json
{
  "confidence": "low",
  "warnings": ["바코드 8801234567890의 마지막 자리가 불명확함"],
  "notes": "사용자 확인 필요"
}
```

### 2. 상품이 DB에 없는 경우
```json
{
  "warnings": ["바코드 8801234567890는 products DB에 존재하지 않음"],
  "notes": "상품 등록 후 다시 임포트 필요"
}
```

### 3. 날짜 형식이 다른 경우
```json
{
  "warnings": ["날짜 형식이 예상과 다름: 2025.10.01"],
  "notes": "날짜를 2025-10-01로 해석함"
}
```

## 🚀 작업 요청 방법

### Claude에게 요청할 때:

```
다음 프로모션 사진들을 변환해주세요:

1. `data/PROMOTION_CONVERSION_GUIDE.md` 파일을 읽어주세요
2. `data/promotions/` 폴더의 모든 서브폴더를 탐색해주세요
3. 각 폴더의 `metadata.json`을 읽고 `conversionStatus`가 `pending`인 것만 선택해주세요
4. 해당 프로모션의 사진들을 읽어주세요
5. 가이드에 따라 `batch_{timestamp}.json` 파일을 생성해주세요
6. `data/promotions/conversion-batches/` 폴더에 저장해주세요
```

## 📊 변환 후 데이터 흐름

```
batch_{timestamp}.json 생성
→ 사용자가 검토
→ /api/admin/promotions/batch-import API 호출
→ 트랜잭션 시작
  → 각 프로모션 업데이트/병합
  → PromotionIndex 역인덱스 재구축
  → metadata.json의 conversionStatus → "completed"
  → batch_{timestamp}_imported.flag 생성
→ 트랜잭션 커밋
```

## 📋 체크리스트

변환 데이터 생성 시 확인사항:
- [ ] 모든 바코드가 13자리 문자열인가?
- [ ] 날짜가 ISO 8601 형식인가?
- [ ] promotionType이 올바르게 추출되었는가?
- [ ] buyQuantity와 getQuantity가 일치하는가?
- [ ] 교차 증정 여부가 올바른가?
- [ ] giftProducts 배열이 올바른가?
- [ ] confidence와 warnings가 적절한가?
- [ ] 원본 사진 경로가 정확한가?

---

**버전**: 1.0.0
**최종 수정**: 2025-10-22
**다음 수정 필요 시기**: 프로모션 데이터 구조 변경 시
