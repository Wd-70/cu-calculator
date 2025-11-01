import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isAdmin } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountAddress = searchParams.get('accountAddress');
    const filename = searchParams.get('filename');

    // 관리자 권한 확인
    if (!accountAddress || !isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!filename) {
      return NextResponse.json(
        { success: false, error: '파일명이 필요합니다.' },
        { status: 400 }
      );
    }

    // 경로 조작 방지
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { success: false, error: '잘못된 파일명입니다.' },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), 'data', 'promotions', 'conversion-batches', filename);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    return NextResponse.json({
      success: true,
      data: data,
      filename: filename,
    });
  } catch (error) {
    console.error('Error reading conversion batch:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'JSON 형식이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to read conversion batch' },
      { status: 500 }
    );
  }
}
