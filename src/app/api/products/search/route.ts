import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';

export async function POST(request: NextRequest) {
  try {
    const { barcodes } = await request.json();

    if (!barcodes || !Array.isArray(barcodes)) {
      return NextResponse.json(
        { success: false, error: '바코드 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    await connectDB();

    // 바코드 배열로 상품 조회
    const products = await Product.find(
      { barcode: { $in: barcodes } },
      { barcode: 1, name: 1, _id: 0 }
    ).lean();

    return NextResponse.json({
      success: true,
      products,
    });

  } catch (error) {
    console.error('Product search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
