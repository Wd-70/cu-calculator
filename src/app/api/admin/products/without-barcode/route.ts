import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { checkIsAdminServer } from '@/lib/adminAuth';

/**
 * GET /api/admin/products/without-barcode
 * 바코드 없는 상품 조회 (관리자 전용)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountAddress = searchParams.get('accountAddress');

    if (!accountAddress) {
      return NextResponse.json(
        { success: false, error: 'Account address is required' },
        { status: 400 }
      );
    }

    const isAdmin = await checkIsAdminServer(accountAddress);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    await db.connect();

    const name = searchParams.get('name');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 바코드가 없는 상품만 필터링
    const filter: any = {
      $or: [
        { barcode: { $exists: false } },
        { barcode: null },
        { barcode: '' }
      ]
    };

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    const total = await db.countProducts(filter);
    const products = await db.findProducts(filter, {
      limit,
      skip: offset,
      sort: { createdAt: -1, _id: 1 }, // 안정적인 정렬을 위해 _id 추가
    });

    return NextResponse.json({
      success: true,
      data: products,
      total,
    });
  } catch (error) {
    console.error('Error fetching products without barcode:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
