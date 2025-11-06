import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { checkIsAdminServer } from '@/lib/adminAuth';
import Product from '@/lib/models/Product';

/**
 * POST /api/admin/products/update-barcode
 * 상품의 바코드 등록/수정 (관리자 전용)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountAddress, productId, barcode } = body;

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

    if (!productId || !barcode) {
      return NextResponse.json(
        { success: false, error: 'Product ID and barcode are required' },
        { status: 400 }
      );
    }

    // 바코드 유효성 검사 (13자리 숫자)
    if (!/^\d{13}$/.test(barcode)) {
      return NextResponse.json(
        { success: false, error: 'Barcode must be 13 digits' },
        { status: 400 }
      );
    }

    await db.connect();

    // 해당 상품 존재 확인
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // 바코드 중복 확인 (다른 상품에서 이미 사용 중인지)
    const existingProduct = await Product.findOne({
      barcode,
      _id: { $ne: productId }
    });

    if (existingProduct) {
      return NextResponse.json(
        {
          success: false,
          error: 'Barcode already exists for another product',
          existingProduct: {
            id: existingProduct._id,
            name: existingProduct.name,
            barcode: existingProduct.barcode
          }
        },
        { status: 409 }
      );
    }

    // 바코드 업데이트
    const oldBarcode = product.barcode;
    product.barcode = barcode;
    product.lastModifiedBy = accountAddress;
    product.modificationCount += 1;
    await product.save();

    // 수정 기록 저장
    await db.createModificationHistory({
      productId: product._id,
      action: 'update',
      beforeData: { barcode: oldBarcode },
      afterData: { barcode },
      modifiedBy: accountAddress,
      modifiedAt: new Date(),
      ipAddress: request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown',
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Barcode updated successfully',
    });
  } catch (error) {
    console.error('Error updating barcode:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update barcode' },
      { status: 500 }
    );
  }
}
