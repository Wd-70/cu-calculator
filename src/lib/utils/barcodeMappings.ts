/**
 * 18자리 바코드 -> 13자리 바코드 매핑 테이블
 *
 * 일반적인 타임바코드(13자리 + 5자리)가 아닌 특이케이스를 수동으로 관리합니다.
 * 새로운 매핑이 필요한 경우 이 파일에 추가하면 됩니다.
 */

export const BARCODE_MAPPINGS: Record<string, string> = {
  // 18자리에서 앞 13자리를 자른 것 -> 실제 13자리 바코드
  // "8800336391542": "8800336391535",
  // 새로운 매핑 추가 시:
  // '18자리바코드': '13자리바코드',
  // '앞13자리': '실제13자리바코드',
};

/**
 * 18자리 바코드를 13자리로 변환합니다.
 * @param barcode18 18자리 바코드
 * @returns 매핑된 13자리 바코드 또는 null
 */
export function mapBarcodeToStandard(barcode18: string): string | null {
  return BARCODE_MAPPINGS[barcode18] || null;
}
