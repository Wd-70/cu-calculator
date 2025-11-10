import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isAdmin } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const { accountAddress, sessionId, products } = await request.json();

    // 관리자 권한 확인
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!sessionId || !products) {
      return NextResponse.json(
        { success: false, error: '세션 ID 또는 상품 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 저장 경로 생성
    const dataDir = path.join(process.cwd(), 'data', 'scan-sessions', sessionId);
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    // 세션 데이터 저장
    const sessionData = {
      sessionId,
      products,
      createdAt: new Date().toISOString(),
      createdBy: accountAddress,
      lastUpdated: new Date().toISOString(),
    };

    const filepath = path.join(dataDir, 'session.json');
    await writeFile(filepath, JSON.stringify(sessionData, null, 2));

    return NextResponse.json({
      success: true,
      sessionId,
      productCount: products.length,
    });
  } catch (error) {
    console.error('Save scan session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save scan session' },
      { status: 500 }
    );
  }
}
