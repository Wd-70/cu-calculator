import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { mapBarcodeToStandard } from '@/lib/utils/barcodeMappings';

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

    const products: any[] = [];

    for (const barcode of barcodes) {
      const cleaned = barcode.trim();

      // 1차 시도: 입력된 바코드로 직접 검색
      let product = await Product.findOne(
        { barcode: cleaned },
        { barcode: 1, name: 1, price: 1, brand: 1, imageUrl: 1, categoryTags: 1, _id: 0 }
      ).lean();

      // 2차 시도: 매핑 테이블에서 변환 후 검색
      if (!product) {
        const mappedBarcode = mapBarcodeToStandard(cleaned);

        if (mappedBarcode) {
          console.log(`[바코드 매핑] ${cleaned} → ${mappedBarcode}`);

          product = await Product.findOne(
            { barcode: mappedBarcode },
            { barcode: 1, name: 1, price: 1, brand: 1, imageUrl: 1, categoryTags: 1, _id: 0 }
          ).lean();

          if (product) {
            console.log(`  → 상품 발견: ${product.name}`);
          }
        }
      }

      if (product) {
        products.push(product);
      } else {
        console.log(`[바코드 검색 실패] ${cleaned}`);
      }
    }

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
