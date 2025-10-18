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

    console.log(`총 ${products.length}개 상품 처리 시작...`);

    // 먼저 모든 바코드 수집
    const allBarcodes = products
      .filter(p => p.barcode && p.name && p.price)
      .map(p => p.barcode);

    // 기존 상품들을 한 번에 조회
    const existingProducts = await db.findProducts({
      barcode: { $in: allBarcodes }
    });

    existingProducts.forEach(p => existingBarcodes.add(p.barcode));
    console.log(`${existingBarcodes.size}개 기존 상품 발견`);

    // 필터링 및 검증
    for (const product of products) {
      const { barcode, name, price, category, imageUrl, detailUrls } = product;

      // 필수 필드 검증
      if (!barcode || !name || !price) {
        results.failed++;
        results.errors.push(`${name || barcode}: 필수 정보 누락`);
        continue;
      }

      // 기존 상품 체크
      if (existingBarcodes.has(barcode)) {
        results.skipped++;
        continue;
      }

      // 새 상품 목록에 추가
      validProducts.push({
        barcode,
        name,
        price,
        category: category || null,
        brand: 'CU',
        imageUrl: imageUrl || null,
        detailUrls: detailUrls || [],
        createdBy,
        modificationCount: 0,
        isVerified: false,
        verificationCount: 0,
        reportCount: 0,
      });
    }

    // 2단계: 벌크 삽입
    if (validProducts.length > 0) {
      try {
        console.log(`${validProducts.length}개 상품 벌크 삽입 시작...`);
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
