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

    for (const product of products) {
      try {
        const { barcode, name, price, category, imageUrl, detailUrl } = product;

        // 필수 필드 검증
        if (!barcode || !name || !price) {
          results.failed++;
          results.errors.push(`${name || barcode}: 필수 정보 누락`);
          continue;
        }

        // 이미 존재하는 상품인지 확인
        const existingProduct = await db.findProductByBarcode(barcode);
        if (existingProduct) {
          results.skipped++;
          continue;
        }

        // 상품 등록
        await db.createProduct({
          barcode,
          name,
          price,
          category: category || null,
          brand: 'CU',
          imageUrl: imageUrl || null,
          detailUrl: detailUrl || null,
          createdBy,
          modificationCount: 0,
          isVerified: false,
          verificationCount: 0,
          reportCount: 0,
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${product.name || product.barcode}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
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
