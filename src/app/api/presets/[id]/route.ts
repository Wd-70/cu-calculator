import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { UpdatePresetInput } from '@/types/preset';

/**
 * GET /api/presets/:id
 * 특정 프리셋 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await db.connect();
    const { id } = await params;

    const preset = await db.findPresetById(id);

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
    console.error('Error fetching preset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preset' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/presets/:id
 * 프리셋 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await db.connect();
    const { id } = await params;

    const body = await request.json() as UpdatePresetInput;

    // 할인 규칙 검증 (변경된 경우)
    if (body.selectedDiscountIds) {
      if (body.selectedDiscountIds.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one discount must be selected' },
          { status: 400 }
        );
      }

      const discountRules = await db.findDiscountRulesByIds(
        body.selectedDiscountIds.map(String)
      );

      if (discountRules.length !== body.selectedDiscountIds.length) {
        return NextResponse.json(
          { success: false, error: 'Some discount rules not found' },
          { status: 404 }
        );
      }
    }

    const updatedData: Partial<UpdatePresetInput> = {};
    if (body.name !== undefined) updatedData.name = body.name.trim();
    if (body.emoji !== undefined) updatedData.emoji = body.emoji;
    if (body.description !== undefined) updatedData.description = body.description?.trim();
    if (body.selectedDiscountIds !== undefined) updatedData.selectedDiscountIds = body.selectedDiscountIds;
    if (body.paymentMethod !== undefined) updatedData.paymentMethod = body.paymentMethod;

    const preset = await db.updatePreset(id, updatedData);

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
    console.error('Error updating preset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update preset' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/presets/:id
 * 프리셋 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await db.connect();
    const { id } = await params;

    const success = await db.deletePreset(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Preset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Preset deleted',
    });
  } catch (error) {
    console.error('Error deleting preset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete preset' },
      { status: 500 }
    );
  }
}
