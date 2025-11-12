import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { isAdmin } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountAddress = searchParams.get('accountAddress');

    // 관리자 권한 확인
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const promotionsDir = path.join(process.cwd(), 'data', 'promotions');

    // data/promotions 폴더가 없으면 빈 배열 반환
    if (!existsSync(promotionsDir)) {
      return NextResponse.json({
        success: true,
        pendingPhotos: [],
      });
    }

    const pendingPhotos: any[] = [];

    // 모든 프로모션 폴더 스캔
    const promotionFolders = readdirSync(promotionsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const promotionId of promotionFolders) {
      const metadataPath = path.join(promotionsDir, promotionId, 'metadata.json');

      if (existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

          // conversionStatus가 'pending'인 프로모션만 포함
          if (metadata.conversionStatus === 'pending' && metadata.photos && metadata.photos.length > 0) {
            pendingPhotos.push({
              promotionId: promotionId,
              promotionName: metadata.promotionName,
              photoCount: metadata.photos.length,
              photos: metadata.photos,
            });
          }
        } catch (error) {
          console.error(`Error reading metadata for ${promotionId}:`, error);
          // 메타데이터 파싱 실패 시 해당 프로모션은 스킵
        }
      }
    }

    return NextResponse.json({
      success: true,
      pendingPhotos: pendingPhotos,
    });
  } catch (error) {
    console.error('Error fetching pending photos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending photos' },
      { status: 500 }
    );
  }
}
