import { IProduct } from '@/types/product';

/**
 * 전체 상품 정보를 메모리에 로드
 * 캐싱 없이 항상 최신 데이터 사용
 */
export async function loadAllProducts(): Promise<IProduct[]> {
  try {
    console.log('[ProductLoader] 전체 상품 로드 시작...');
    const startTime = performance.now();

    // includeWithoutBarcode=true로 바코드 없는 상품도 포함
    const response = await fetch('/api/products?limit=100000&includeWithoutBarcode=true');

    if (!response.ok) {
      throw new Error(`Failed to load products: ${response.status}`);
    }

    const data = await response.json();
    const products = data.data || [];

    const loadTime = performance.now() - startTime;
    console.log(`[ProductLoader] ${products.length}개 상품 로드 완료 (${loadTime.toFixed(0)}ms)`);

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
