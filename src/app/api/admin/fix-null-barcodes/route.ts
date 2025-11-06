import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';
import Product from '@/lib/models/Product';

/**
 * POST /api/admin/fix-null-barcodes
 * Fix products with barcode: null by removing the barcode field entirely
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const { accountAddress } = await request.json();

    // 관리자 계정 검증
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await db.connect();

    // barcode가 null인 상품 찾기
    const productsWithNullBarcode = await Product.find({
      barcode: null
    }).exec();

    console.log(`barcode: null인 상품 ${productsWithNullBarcode.length}개 발견`);

    if (productsWithNullBarcode.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'barcode: null인 상품이 없습니다.',
        fixed: 0
      });
    }

    // barcode 필드를 완전히 제거 (unset)
    const result = await Product.updateMany(
      { barcode: null },
      { $unset: { barcode: "" } }
    );

    console.log(`✅ ${result.modifiedCount}개 상품의 barcode 필드 제거 완료`);

    return NextResponse.json({
      success: true,
      message: `${result.modifiedCount}개 상품의 barcode: null 문제를 수정했습니다.`,
      fixed: result.modifiedCount
    });
  } catch (error) {
    console.error('Error fixing null barcodes:', error);
    return NextResponse.json(
      {
        error: 'barcode 수정 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
