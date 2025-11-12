import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';

/**
 * POST /api/admin/bulk-register
 * Bulk register products
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const { accountAddress, products, createdBy } = await request.json();

    // 관리자 계정 검증
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: '등록할 상품이 없습니다.' },
        { status: 400 }
      );
    }

    if (!createdBy) {
      return NextResponse.json(
        { error: '사용자 계정이 필요합니다.' },
        { status: 401 }
      );
    }

    await db.connect();

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // 1단계: 필수 필드 검증 및 기존 상품 필터링
    const validProducts = [];
    const existingBarcodes = new Set<string>();
    const existingNames = new Set<string>();

    console.log(`총 ${products.length}개 상품 처리 시작...`);

    // 바코드가 있는 상품들의 바코드 수집
    const allBarcodes = products
      .filter(p => p.barcode && p.name && p.price)
      .map(p => p.barcode);

    // 바코드가 없는 상품들의 이름 수집
    const allNames = products
      .filter(p => !p.barcode && p.name && p.price)
      .map(p => p.name);

    // 기존 상품들을 한 번에 조회 (바코드)
    if (allBarcodes.length > 0) {
      const existingProductsWithBarcode = await db.findProducts({
        barcode: { $in: allBarcodes } as any
      });
      existingProductsWithBarcode.forEach(p => {
        if (p.barcode) existingBarcodes.add(p.barcode);
      });
    }

    // 기존 상품들을 한 번에 조회 (이름)
    if (allNames.length > 0) {
      const existingProductsWithoutBarcode = await db.findProducts({
        name: { $in: allNames } as any,
        $or: [
          { barcode: { $exists: false } } as any,
          { barcode: null },
          { barcode: '' }
        ] as any
      } as any);
      existingProductsWithoutBarcode.forEach(p => {
        if (p.name) existingNames.add(p.name);
      });
    }

    console.log(`${existingBarcodes.size}개 기존 상품 발견 (바코드)`);
    console.log(`${existingNames.size}개 기존 상품 발견 (이름)`);

    // 필터링 및 검증
    for (const product of products) {
      const { barcode, name, price, imageUrl, detailUrls } = product;

      // 필수 필드 검증 (바코드는 선택 사항)
      if (!name || !price) {
        results.failed++;
        results.errors.push(`${name || '(이름 없음)'}: 필수 정보 누락`);
        continue;
      }

      // 기존 상품 체크 (바코드가 있으면 바코드로, 없으면 이름으로)
      if (barcode && existingBarcodes.has(barcode)) {
        results.skipped++;
        continue;
      }

      if (!barcode && existingNames.has(name)) {
        results.skipped++;
        continue;
      }

      // 새 상품 목록에 추가 (바코드가 없으면 필드 자체를 생략)
      const productData: any = {
        name,
        price,
        brand: 'CU',
        imageUrl: imageUrl || null,
        detailUrls: detailUrls || [],
        createdBy,
        modificationCount: 0,
        isVerified: false,
        verificationCount: 0,
        reportCount: 0,
      };

      // 바코드가 있을 때만 추가 (sparse index를 위해)
      // undefined, null, 빈 문자열 모두 제외
      if (barcode && barcode.trim()) {
        productData.barcode = barcode.trim();
      }

      validProducts.push(productData);
    }

    // 2단계: 벌크 삽입
    if (validProducts.length > 0) {
      try {
        console.log(`${validProducts.length}개 상품 벌크 삽입 시작...`);

        // 디버깅: 바코드 없는 상품 확인
        const productsWithoutBarcode = validProducts.filter(p => !p.barcode);
        if (productsWithoutBarcode.length > 0) {
          console.log(`바코드 없는 상품 ${productsWithoutBarcode.length}개:`);
          productsWithoutBarcode.slice(0, 3).forEach(p => {
            console.log(`  - ${p.name}: barcode=${JSON.stringify(p.barcode)}, hasOwnProperty=${p.hasOwnProperty('barcode')}`);
          });
        }

        const bulkResult = await db.bulkCreateProducts(validProducts);
        results.success = bulkResult.insertedCount;
        console.log(`✅ ${bulkResult.insertedCount}개 상품 삽입 완료`);
      } catch (error) {
        console.error('벌크 삽입 오류:', error);
        results.failed += validProducts.length;
        results.errors.push(`벌크 삽입 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    console.log('Bulk registration completed:', results);

    return NextResponse.json({
      success: true,
      results,
      message: `성공: ${results.success}, 실패: ${results.failed}, 스킵: ${results.skipped}`
    });
  } catch (error) {
    console.error('Error in bulk registration:', error);
    return NextResponse.json(
      {
        error: '일괄 등록 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
