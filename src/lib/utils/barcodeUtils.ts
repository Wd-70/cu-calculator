/**
 * 바코드 정규화 유틸리티
 * 신선식품의 18자리 바코드(EAN-18)를 13자리 표준 바코드(EAN-13)로 변환
 */

/**
 * 바코드를 정규화합니다.
 * - 18자리 바코드: 여러 패턴을 시도하여 가능한 13자리 바코드 배열 반환
 * - 13자리 이하: 그대로 반환
 *
 * @param barcode 스캔된 바코드
 * @returns 정규화된 바코드 (또는 가능한 바코드 배열)
 *
 * @example
 * normalizeBarcode('880028196680240614') // '8800281966802' (13자리 추출)
 * normalizeBarcode('8800336391535') // '8800336391535' (그대로)
 */
export function normalizeBarcode(barcode: string): string {
  // 공백 제거
  const cleaned = barcode.trim();

  // 18자리 바코드인 경우 앞 13자리만 추출 (가장 일반적인 케이스)
  if (cleaned.length === 18 && /^\d{18}$/.test(cleaned)) {
    return cleaned.substring(0, 13);
  }

  // 그 외의 경우 그대로 반환
  return cleaned;
}

/**
 * 18자리 바코드에서 가능한 모든 13자리 바코드 패턴을 생성합니다.
 * DB 조회 시 여러 패턴을 시도할 수 있도록 합니다.
 *
 * @param barcode 18자리 바코드
 * @returns 가능한 13자리 바코드 배열
 *
 * @example
 * getPossibleBarcodes('880033639154240814')
 * // ['8800336391542', '8800336391535', ...]
 */
export function getPossibleBarcodes(barcode: string): string[] {
  const cleaned = barcode.trim();

  // 18자리가 아니면 원본만 반환
  if (cleaned.length !== 18 || !/^\d{18}$/.test(cleaned)) {
    return [cleaned];
  }

  const candidates: string[] = [];

  // 패턴 1: 앞 13자리 추출 (일반적인 간편식사 제품)
  candidates.push(cleaned.substring(0, 13));

  // 패턴 2: 앞 12자리 + 재계산된 체크디지트
  const first12 = cleaned.substring(0, 12);
  const checkDigit = calculateEAN13CheckDigit(first12);
  candidates.push(first12 + checkDigit);

  // 패턴 3: 앞 7자리 + 중간 5자리 건너뛰기 + 다음 자리
  // (가변중량 상품의 경우 중간에 가격/중량 정보가 있을 수 있음)
  if (cleaned.length === 18) {
    const prefix = cleaned.substring(0, 7);  // 회사코드
    const productCode = cleaned.substring(12, 17); // 상품코드 부분
    const candidate3 = prefix + productCode + calculateEAN13CheckDigit(prefix + productCode);
    if (candidate3.length === 13) {
      candidates.push(candidate3);
    }
  }

  // 중복 제거
  return Array.from(new Set(candidates));
}

/**
 * EAN-13 체크 디지트 계산
 * @param barcode12 12자리 바코드 (체크디지트 제외)
 * @returns 체크 디지트 (0-9)
 */
function calculateEAN13CheckDigit(barcode12: string): string {
  if (barcode12.length !== 12) {
    throw new Error('EAN-13 체크디지트 계산에는 12자리 바코드가 필요합니다');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode12[i], 10);
    // 홀수 위치(0-indexed에서 짝수)는 1배, 짝수 위치는 3배
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

/**
 * 바코드가 18자리 신선식품 바코드인지 확인
 */
export function isExtendedBarcode(barcode: string): boolean {
  const cleaned = barcode.trim();
  return cleaned.length === 18 && /^\d{18}$/.test(cleaned);
}

/**
 * 18자리 바코드에서 날짜 코드 추출 (뒤 5자리)
 * 날짜 형식은 제조사마다 다를 수 있음 (MMDD, Julian Date 등)
 */
export function extractDateCode(barcode: string): string | null {
  if (!isExtendedBarcode(barcode)) {
    return null;
  }

  // 뒤 5자리 반환 (마지막 1자리는 체크 디지트)
  return barcode.substring(13, 18);
}
