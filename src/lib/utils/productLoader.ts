import { IProduct } from '@/types/product';

/**
 * 전체 상품 정보를 메모리에 로드
 * 캐싱 없이 항상 최신 데이터 사용
 * 최적화된 전용 API 엔드포인트 사용
 */
export async function loadAllProducts(): Promise<IProduct[]> {
  try {
    console.log('[ProductLoader] 전체 상품 로드 시작...');
    const startTime = performance.now();

    // 전용 API 엔드포인트 사용 (정렬 없이 빠른 응답)
    const response = await fetch('/api/products/all');

    if (!response.ok) {
      throw new Error(`Failed to load products: ${response.status}`);
    }

    const data = await response.json();
    const products = data.data || [];

    const loadTime = performance.now() - startTime;
    const serverTime = data.loadTime || 0;
    const networkTime = loadTime - serverTime;

    console.log(`[ProductLoader] ${products.length}개 상품 로드 완료`);
    console.log(`  - 서버 처리: ${serverTime}ms`);
    console.log(`  - 네트워크: ${networkTime.toFixed(0)}ms`);
    console.log(`  - 총 시간: ${loadTime.toFixed(0)}ms`);

    return products;
  } catch (error) {
    console.error('[ProductLoader] 상품 로드 실패:', error);
    return [];
  }
}

/**
 * 메모리에서 바코드로 상품 검색
 */
export function findProductByBarcode(products: IProduct[], barcode: string): IProduct | null {
  return products.find(p => p.barcode === barcode) || null;
}

/**
 * 메모리에서 상품명으로 검색 (부분 일치)
 */
export function searchProductsByName(products: IProduct[], query: string): IProduct[] {
  const lowerQuery = query.toLowerCase();
  return products.filter(p => p.name.toLowerCase().includes(lowerQuery));
}
