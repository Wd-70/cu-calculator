import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, readFile } from 'fs/promises';
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

    const batchesDir = path.join(process.cwd(), 'data', 'promotions', 'conversion-batches');

    // batches 디렉토리가 없으면 빈 배열 반환
    if (!existsSync(batchesDir)) {
      return NextResponse.json({
        success: true,
        batches: [],
      });
    }

    // 모든 JSON 파일 읽기
    const files = await readdir(batchesDir);
    const batches: any[] = [];

    for (const file of files) {
      // .json 파일만 처리하고, _imported.flag는 제외
      if (file.endsWith('.json') && !file.endsWith('_imported.flag')) {
        const filePath = path.join(batchesDir, file);
        const fileStats = await stat(filePath);

        // 이미 임포트된 파일인지 확인 (flag 파일 존재 여부)
        const flagPath = path.join(batchesDir, file.replace('.json', '_imported.flag'));
        const isImported = existsSync(flagPath);

        // 파일 내용 미리 읽기 (batchId, 개수 등 메타데이터 추출)
        try {
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          batches.push({
            filename: file,
            batchId: data.batchId || file.replace('.json', ''),
            createdAt: data.createdAt || fileStats.mtime.toISOString(),
            totalPromotions: data.totalPromotions || data.conversions?.length || 0,
            conversions: data.conversions?.length || 0,
            isImported: isImported,
            fileSize: fileStats.size,
          });
        } catch (error) {
          // JSON 파싱 실패 시 기본 정보만 추가
          console.error(`Error parsing ${file}:`, error);
          batches.push({
            filename: file,
            batchId: file.replace('.json', ''),
            createdAt: fileStats.mtime.toISOString(),
            totalPromotions: 0,
            conversions: 0,
            isImported: isImported,
            fileSize: fileStats.size,
            error: 'JSON 파싱 실패',
          });
        }
      }
    }

    // 최신 순으로 정렬 (미임포트 파일 우선)
    batches.sort((a, b) => {
      if (a.isImported !== b.isImported) {
        return a.isImported ? 1 : -1; // 미임포트 파일이 먼저
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error('Error listing conversion batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list conversion batches' },
      { status: 500 }
    );
  }
}
