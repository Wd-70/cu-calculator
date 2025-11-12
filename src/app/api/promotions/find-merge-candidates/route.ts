import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';

// GET: 병합 가능한 프로모션 그룹 찾기
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search');

    const matchStage: any = {
      isCrawled: true,
      isActive: true,
      status: 'active',
      giftSelectionType: 'same',
      'giftConstraints.mustBeSameProduct': true,
      applicableProducts: { $size: 1 } as any // 단일 상품만
    };

    // 검색어가 있으면 이름 또는 바코드로 필터링
    if (searchQuery) {
      matchStage.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { applicableProducts: { $regex: searchQuery, $options: 'i' } }
      ] as any;
    }

    // 크롤링으로 생성된 개별 상품 프로모션 중
    // 동일한 프로모션 타입(1+1, 2+1)을 가진 것들을 그룹화
    const candidates = await Promotion.aggregate([
      {
        $match: matchStage
      },
      {
        $group: {
          _id: {
            promotionType: '$promotionType',
            validFrom: '$validFrom',
            validTo: '$validTo'
          },
          promotions: {
            $push: {
              _id: '$_id',
              name: '$name',
              barcode: { $arrayElemAt: ['$applicableProducts', 0] },
              verificationStatus: '$verificationStatus',
              verificationCount: '$verificationCount',
              disputeCount: '$disputeCount',
              createdAt: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gte: 2 } } as any // 2개 이상인 그룹만
      },
      {
        $sort: { count: -1 } // 많은 것부터
      },
      {
        $limit: 20 // 최대 20개 그룹
      }
    ]);

    return NextResponse.json({
      success: true,
      candidates,
    });
  } catch (error) {
    console.error('Error finding merge candidates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to find merge candidates' },
      { status: 500 }
    );
  }
}
