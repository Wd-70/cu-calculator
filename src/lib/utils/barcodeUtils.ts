/**
 * 바코드 정규화 유틸리티
 * 신선식품의 18자리 바코드(EAN-18)를 13자리 표준 바코드(EAN-13)로 변환
 */

/**
 * 바코드를 정규화합니다.
 * - 18자리 바코드: 앞 13자리만 추출 (뒤 5자리는 제조일자/유통기한 정보)
 * - 13자리 이하: 그대로 반환
 *
 * @param barcode 스캔된 바코드
 * @returns 정규화된 바코드 (13자리 또는 원본)
 *
 * @example
 * normalizeBarcode('880028196680240614') // '8800281966802' (13자리 추출)
 * normalizeBarcode('8800281966802') // '8800281966802' (그대로)
 * normalizeBarcode('123456') // '123456' (그대로)
 */
export function normalizeBarcode(barcode: string): string {
  // 공백 제거
  const cleaned = barcode.trim();

  // 18자리 바코드인 경우 앞 13자리만 추출
  if (cleaned.length === 18 && /^\d{18}$/.test(cleaned)) {
    return cleaned.substring(0, 13);
  }

  // 그 외의 경우 그대로 반환
  return cleaned;
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
