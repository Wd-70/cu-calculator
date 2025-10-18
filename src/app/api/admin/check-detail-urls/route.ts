import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';

/**
 * GET /api/admin/check-detail-urls
 * Check how many products have detailUrl
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountAddress = searchParams.get('accountAddress');

    // 관리자 계정 검증
    if (!accountAddress || !isAdmin(accountAddress)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await db.connect();

    // 전체 상품 수
    const totalProducts = await db.countProducts({});

    // detailUrl이 있는 상품 수
    const productsWithDetailUrl = await db.countProducts({
      detailUrl: { $exists: true, $ne: null, $ne: '' }
    });

    // detailUrl이 없는 상품 수
    const productsWithoutDetailUrl = totalProducts - productsWithDetailUrl;

    // 샘플 상품 몇 개 가져오기 (detailUrl 있는 것)
    const sampleWithDetailUrl = await db.findProducts(
      { detailUrl: { $exists: true, $ne: null, $ne: '' } },
      { limit: 3 }
    );

    // 샘플 상품 몇 개 가져오기 (detailUrl 없는 것)
    const sampleWithoutDetailUrl = await db.findProducts(
      { $or: [
        { detailUrl: { $exists: false } },
        { detailUrl: null },
        { detailUrl: '' }
      ]},
      { limit: 3 }
    );

    return NextResponse.json({
      success: true,
      data: {
        totalProducts,
        productsWithDetailUrl,
        productsWithoutDetailUrl,
        sampleWithDetailUrl: sampleWithDetailUrl.map(p => ({
          name: p.name,
          barcode: p.barcode,
          detailUrl: p.detailUrl
        })),
        sampleWithoutDetailUrl: sampleWithoutDetailUrl.map(p => ({
          name: p.name,
          barcode: p.barcode,
          detailUrl: p.detailUrl
        }))
      }
    });
  } catch (error) {
    console.error('Error checking detail URLs:', error);
    return NextResponse.json(
      {
        error: '상태 확인 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
