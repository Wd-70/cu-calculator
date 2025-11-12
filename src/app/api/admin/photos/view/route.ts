import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { checkIsAdminServer } from '@/lib/adminAuth';

/**
 * GET /api/admin/photos/view
 * 사진 파일 조회 (미리보기용)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountAddress = searchParams.get('accountAddress');
    const photoPath = searchParams.get('path');

    if (!accountAddress) {
      return NextResponse.json(
        { success: false, error: 'Account address is required' },
        { status: 400 }
      );
    }

    const isAdmin = await checkIsAdminServer(accountAddress);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    if (!photoPath) {
      return NextResponse.json(
        { success: false, error: 'Photo path is required' },
        { status: 400 }
      );
    }

    // 보안: 경로 검증 (data/ 또는 data\\ 폴더 내부만 허용)
    // 슬래시 통일
    const unifiedPath = photoPath.replace(/\\/g, '/');

    // data/로 시작하는지 확인
    if (!unifiedPath.startsWith('data/')) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }

    // 상위 디렉토리 접근 방지 (..)
    if (unifiedPath.includes('..')) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }

    const fullPath = path.join(process.cwd(), unifiedPath);

    // 파일 존재 확인
    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Photo not found' },
        { status: 404 }
      );
    }

    // 파일 읽기
    const fileBuffer = await fs.readFile(fullPath);

    // 이미지 타입 결정
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';

    // 이미지 반환 (Buffer를 Uint8Array로 변환)
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error viewing photo:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to view photo' },
      { status: 500 }
    );
  }
}
