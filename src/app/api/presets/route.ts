import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { CreatePresetInput } from '@/types/preset';

/**
 * GET /api/presets
 * 모든 프리셋 조회
 */
export async function GET(request: NextRequest) {
  try {
    await db.connect();

    const presets = await db.findPresets({}, { sort: { usageCount: -1 } });

    return NextResponse.json({
      success: true,
      data: presets,
    });
  } catch (error) {
    console.error('Error fetching presets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch presets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/presets
 * 새 프리셋 생성
 */
export async function POST(request: NextRequest) {
  try {
    await db.connect();

    const body = await request.json() as CreatePresetInput;

    // 유효성 검사
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!body.selectedDiscountIds || body.selectedDiscountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one discount must be selected' },
        { status: 400 }
      );
    }

    // 할인 규칙 검증
    const discountRules = await db.findDiscountRulesByIds(
      body.selectedDiscountIds.map(String)
    );

    if (discountRules.length !== body.selectedDiscountIds.length) {
      return NextResponse.json(
        { success: false, error: 'Some discount rules not found' },
        { status: 404 }
      );
    }

    const preset = await db.createPreset({
      name: body.name.trim(),
      emoji: body.emoji,
      description: body.description?.trim(),
      selectedDiscountIds: body.selectedDiscountIds,
      paymentMethod: body.paymentMethod,
    });

    return NextResponse.json({
      success: true,
      data: preset,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating preset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create preset' },
      { status: 500 }
    );
  }
}
