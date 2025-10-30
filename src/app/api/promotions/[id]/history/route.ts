import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();

    const promotion = await Promotion.findById(id, {
      modificationHistory: 1,
      createdBy: 1,
      createdAt: 1,
      _id: 1,
    }).lean();

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: '프로모션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 히스토리를 최신 순으로 정렬
    const history = [...(promotion.modificationHistory || [])].reverse();

    return NextResponse.json({
      success: true,
      history,
      createdBy: promotion.createdBy,
      createdAt: promotion.createdAt,
    });

  } catch (error) {
    console.error('Promotion history error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get promotion history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
