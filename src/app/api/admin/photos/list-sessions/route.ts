import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isAdmin } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountAddress = searchParams.get('accountAddress');

    // 관리자 권한 확인
    if (!accountAddress || !isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const photosDir = path.join(process.cwd(), 'data', 'photos');

    // photos 디렉토리가 없으면 빈 배열 반환
    if (!existsSync(photosDir)) {
      return NextResponse.json({
        success: true,
        sessions: [],
      });
    }

    // 모든 세션 폴더 읽기
    const sessionDirs = await readdir(photosDir, { withFileTypes: true });
    const sessions = [];

    for (const dir of sessionDirs) {
      if (dir.isDirectory()) {
        const metadataPath = path.join(photosDir, dir.name, 'metadata.json');

        if (existsSync(metadataPath)) {
          try {
            const metadataContent = await readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);

            // 변환 대기 중인 세션만 포함
            if (metadata.conversionStatus === 'pending') {
              sessions.push({
                sessionId: metadata.sessionId,
                sessionName: metadata.sessionName,
                photoCount: metadata.photos?.length || 0,
                createdAt: metadata.createdAt,
                lastUpdated: metadata.lastUpdated || metadata.createdAt,
                photos: metadata.photos || [],
              });
            }
          } catch (error) {
            console.error(`Error reading metadata for ${dir.name}:`, error);
          }
        }
      }
    }

    // 최신 순으로 정렬
    sessions.sort((a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error('Error listing photo sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list photo sessions' },
      { status: 500 }
    );
  }
}
