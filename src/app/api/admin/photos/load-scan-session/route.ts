import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isAdmin } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountAddress = searchParams.get('accountAddress');
    const sessionId = searchParams.get('sessionId');

    // 관리자 권한 확인
    if (!accountAddress || !isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: '세션 ID가 없습니다.' },
        { status: 400 }
      );
    }

    // 세션 파일 읽기
    const filepath = path.join(process.cwd(), 'data', 'scan-sessions', sessionId, 'session.json');

    if (!existsSync(filepath)) {
      return NextResponse.json({
        success: true,
        products: [],
      });
    }

    const content = await readFile(filepath, 'utf-8');
    const sessionData = JSON.parse(content);

    return NextResponse.json({
      success: true,
      products: sessionData.products || [],
      createdAt: sessionData.createdAt,
      lastUpdated: sessionData.lastUpdated,
    });
  } catch (error) {
    console.error('Load scan session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load scan session' },
      { status: 500 }
    );
  }
}
