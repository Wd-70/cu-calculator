import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';
import { verifySignature } from '@/lib/userAuth';
import { isAdmin } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const { targetDate, signature, timestamp, address } = await request.json();

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    const message = JSON.stringify({
      action: 'rebuild_promotion_index',
      targetDate,
      timestamp,
      address,
    });

    const isValid = verifySignature(message, signature, address);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 서명입니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!isAdmin(address)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await connectDB();

    // 특정 날짜를 기준으로 활성화된 프로모션만 처리
    const date = targetDate ? new Date(targetDate) : new Date();

    console.log(`PromotionIndex 재구축 시작 (기준일: ${date.toISOString()})`);

    // 해당 날짜에 활성화된 프로모션 조회
    const promotions = await Promotion.find({
      validFrom: { $lte: date },
      validTo: { $gte: date },
    }).lean();

    console.log(`${promotions.length}개 프로모션 발견`);

    // 모든 PromotionIndex 삭제 (재구축)
    await PromotionIndex.deleteMany({});
    console.log('기존 PromotionIndex 모두 삭제');

    // 바코드별로 프로모션 ID 수집
    const barcodeMap: { [barcode: string]: string[] } = {};

    for (const promo of promotions) {
      const barcodes = promo.applicableProducts || [];
      for (const barcode of barcodes) {
        if (!barcodeMap[barcode]) {
          barcodeMap[barcode] = [];
        }
        barcodeMap[barcode].push(promo._id.toString());
      }
    }

    // PromotionIndex에 일괄 삽입
    const indexDocuments = Object.entries(barcodeMap).map(([barcode, promotionIds]) => ({
      barcode,
      promotionIds,
      lastUpdated: new Date(),
    }));

    if (indexDocuments.length > 0) {
      await PromotionIndex.insertMany(indexDocuments);
      console.log(`${indexDocuments.length}개 바코드 인덱스 생성`);
    }

    return NextResponse.json({
      success: true,
      message: 'PromotionIndex가 성공적으로 재구축되었습니다.',
      stats: {
        promotionsProcessed: promotions.length,
        barcodesIndexed: indexDocuments.length,
        targetDate: date.toISOString(),
      },
    });

  } catch (error) {
    console.error('PromotionIndex rebuild error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to rebuild PromotionIndex',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
