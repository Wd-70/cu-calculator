# 🚀 빠른 시작 가이드

## ✅ 문제 해결 완료!

LocalStorage가 서버에서 작동하지 않는 문제를 해결했습니다.
**Memory Adapter**로 변경하여 서버와 브라우저 모두에서 작동합니다!

## 💾 Memory Adapter란?

- **메모리에 데이터 저장** - 설치 불필요!
- **서버와 브라우저 모두 작동** - API에서 바로 사용 가능
- **MongoDB와 동일한 구조** - 나중에 쉽게 전환
- ⚠️ **서버 재시작 시 데이터 삭제됨** - 개발용으로 완벽

## 🎯 지금 바로 테스트하기

### 1단계: 서버 재시작

터미널에서 `Ctrl+C`로 중지 후:

```bash
npm run dev
```

### 2단계: 샘플 데이터 생성

새 터미널을 열고:

```bash
# 샘플 데이터 생성
curl -X POST http://localhost:3000/api/init

# 응답 예시:
# {"success":true,"message":"Database initialized successfully"}
```

### 3단계: 데이터 확인

```bash
# 상태 확인
curl http://localhost:3000/api/init

# 응답 예시:
# {
#   "success": true,
#   "data": {
#     "isConnected": true,
#     "productCount": 6,
#     "discountCount": 5
#   }
# }
```

### 4단계: API 테스트

```bash
# 상품 목록 조회
curl http://localhost:3000/api/products

# 할인 목록 조회
curl http://localhost:3000/api/discounts/current-month

# 장바구니 계산 테스트
curl -X POST http://localhost:3000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "barcode": "8801234567890",
        "quantity": 2
      }
    ]
  }'
```

## 🎉 완료!

이제 모든 API가 정상적으로 작동합니다!

### 생성된 샘플 데이터

**상품 6개:**
- 코카콜라 500ml (1,500원)
- 스프라이트 500ml (1,500원)
- 프링글스 오리지널 (2,500원)
- 허니버터칩 (2,000원)
- 삼각김밥 참치 (1,800원)
- 컵라면 신라면 (1,300원)

**할인 5개:**
- 음료 1+1 (코카콜라, 스프라이트)
- 과자 2+1 (프링글스, 허니버터칩)
- 전체 상품 20% 할인
- 신한카드 10% 할인
- 멤버십 5% 추가할인

## 📊 브라우저에서 테스트

http://localhost:3000 접속 후 개발자 도구 콘솔에서:

```javascript
// 샘플 데이터 생성
await fetch('/api/init', { method: 'POST' }).then(r => r.json())

// 상품 목록
await fetch('/api/products').then(r => r.json())

// 할인 목록
await fetch('/api/discounts/current-month').then(r => r.json())

// 장바구니 계산
await fetch('/api/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ barcode: '8801234567890', quantity: 2 }]
  })
}).then(r => r.json())
```

## 🔄 MongoDB로 전환하기

나중에 프로덕션 환경에서 사용하려면:

### 1. .env.local 생성

```env
NEXT_PUBLIC_DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/cu-discount
```

### 2. MongoDB 실행

```bash
# Docker 사용
docker run -d -p 27017:27017 --name cu-mongodb mongo

# 또는 로컬 MongoDB
mongod
```

### 3. 서버 재시작

```bash
npm run dev
```

### 4. 샘플 데이터 재생성

```bash
curl -X POST http://localhost:3000/api/init
```

완료! 이제 MongoDB를 사용합니다.

## ⚙️ 현재 설정

- **데이터베이스**: Memory Adapter (메모리)
- **설치 필요**: 없음
- **데이터 영속성**: 서버 재시작 시 삭제
- **사용 용도**: 개발 및 테스트

## 📝 다음 할 일

1. ✅ API 테스트 완료
2. 🔜 UI 개발 시작
3. 🔜 바코드 스캔 기능 테스트
4. 🔜 할인 계산 로직 테스트
5. 🔜 프로덕션 배포 시 MongoDB로 전환

## 🐛 문제 해결

### 데이터가 안 보이는 경우

```bash
# 초기화 API로 샘플 데이터 재생성
curl -X POST http://localhost:3000/api/init
```

### 서버 재시작 후 데이터가 사라짐

이것은 정상입니다! Memory Adapter는 메모리에만 저장하므로:
- 개발 중: 매번 `/api/init` 호출하여 재생성
- 프로덕션: MongoDB로 전환

### MongoDB 경고 메시지

이제 중복 인덱스 경고가 사라졌습니다. 만약 여전히 보인다면 서버를 재시작하세요.

## 💡 팁

### 자동 초기화

개발 중 매번 데이터를 다시 만들기 귀찮다면, 다음 스크립트를 추가하세요:

`package.json`:
```json
{
  "scripts": {
    "dev": "next dev",
    "dev:init": "npm run dev & sleep 3 && curl -X POST http://localhost:3000/api/init"
  }
}
```

사용:
```bash
npm run dev:init
```

### 데이터 백업

Memory Adapter의 데이터를 파일로 저장하려면:

```bash
# 데이터 백업
curl http://localhost:3000/api/products > products.json
curl http://localhost:3000/api/discounts > discounts.json
```

## 📚 관련 문서

- [README.md](./README.md) - 전체 프로젝트 문서
- [DATABASE_GUIDE.md](./DATABASE_GUIDE.md) - 데이터베이스 전환 가이드
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - 구현 세부사항

---

**이제 준비 완료!** 🎉

MongoDB 설치 없이 바로 개발을 시작할 수 있습니다.
