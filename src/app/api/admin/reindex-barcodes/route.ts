import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';
import Product from '@/lib/models/Product';

/**
 * POST /api/admin/reindex-barcodes
 * Drop and recreate barcode index as sparse unique
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

    console.log('\n=== Barcode 인덱스 재생성 시작 ===');

    // 1. 현재 인덱스 확인
    const indexes = await Product.collection.getIndexes();
    console.log('현재 인덱스 목록:', Object.keys(indexes));

    if (indexes.barcode_1) {
      console.log('barcode_1 인덱스 정보:', indexes.barcode_1);
    }

    // 2. 기존 barcode 인덱스 삭제 (있으면)
    try {
      await Product.collection.dropIndex('barcode_1');
      console.log('✅ 기존 barcode_1 인덱스 삭제 완료');
    } catch (error: any) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('ℹ️ 기존 barcode_1 인덱스가 없습니다 (정상)');
      } else {
        throw error;
      }
    }

    // 3. sparse unique 인덱스로 재생성
    await Product.collection.createIndex(
      { barcode: 1 },
      {
        unique: true,
        sparse: true,
        name: 'barcode_1'
      }
    );
    console.log('✅ barcode_1 인덱스를 sparse unique로 재생성 완료');

    // 4. 재생성된 인덱스 확인
    const newIndexes = await Product.collection.getIndexes();
    console.log('새 barcode_1 인덱스 정보:', newIndexes.barcode_1);
    console.log('===================================\n');

    return NextResponse.json({
      success: true,
      message: 'barcode 인덱스를 sparse unique로 재생성했습니다.',
      indexInfo: newIndexes.barcode_1
    });
  } catch (error) {
    console.error('Error reindexing barcodes:', error);
    return NextResponse.json(
      {
        error: '인덱스 재생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
