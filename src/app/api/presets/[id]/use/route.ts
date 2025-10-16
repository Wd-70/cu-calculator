import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * POST /api/presets/:id/use
 * 프리셋 사용 카운트 증가
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await db.connect();
    const { id } = await params;

    const preset = await db.incrementPresetUsage(id);

    if (!preset) {
      return NextResponse.json(
        { success: false, error: 'Preset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: preset,
    });
  } catch (error) {
    console.error('Error incrementing preset usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to increment preset usage' },
      { status: 500 }
    );
  }
}
