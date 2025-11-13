import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/products/all
 * 전체 상품 목록 반환 (메모리 로딩용)
 * - 정렬 없음 (빠른 응답)
 * - 바코드 있는 상품만
 * - 필요한 필드만 반환
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = performance.now();

    await db.connect();

    // 바코드가 있는 상품만 조회 (정렬 없이)
    const filter = {
      barcode: { $exists: true, $nin: [null, ''] }
    };

    // 필요한 필드만 선택하여 크기 최소화
    // categoryTags.name과 level만 필요하므로 전체 객체 가져오기
    const projection = {
      _id: 1,
      barcode: 1,
      name: 1,
      price: 1,
      brand: 1,
      imageUrl: 1,
      categoryTags: 1,
      // 불필요한 필드 제외
      createdAt: 0,
      updatedAt: 0,
      createdBy: 0,
      lastModifiedBy: 0,
      modificationCount: 0,
      isVerified: 0,
      verificationCount: 0,
      reportCount: 0,
      cuProductCode: 0,
      detailUrls: 0,
    };

    const products = await db.findProducts(filter, {
      projection,
      // 정렬 없음 - 메모리에서 바코드로 검색할 것이므로 순서 불필요
    });

    const loadTime = performance.now() - startTime;

    console.log(`[API /products/all] ${products.length}개 상품 반환 (${loadTime.toFixed(0)}ms)`);

    return NextResponse.json(
      {
        success: true,
        data: products,
        total: products.length,
        loadTime: Math.round(loadTime),
      },
      {
        headers: {
          // 1분 캐싱 (브라우저 + CDN)
          'Cache-Control': 'public, max-age=60, s-maxage=60',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching all products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch all products' },
      { status: 500 }
    );
  }
}
