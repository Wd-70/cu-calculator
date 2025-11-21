import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isAdmin } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const photo = formData.get('photo') as File;
    const sessionId = formData.get('sessionId') as string;
    const sessionName = formData.get('sessionName') as string;
    const accountAddress = formData.get('accountAddress') as string;
    const productBarcode = formData.get('productBarcode') as string;
    const productName = formData.get('productName') as string;

    // 관리자 권한 확인
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!photo || !sessionId) {
      return NextResponse.json(
        { success: false, error: '사진 또는 세션 ID가 없습니다.' },
        { status: 400 }
      );
    }

    // 저장 경로 생성
    const dataDir = path.join(process.cwd(), 'data', 'photos', sessionId);
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    // 파일 저장
    const bytes = await photo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = photo.name || `photo_${Date.now()}.jpg`;
    const filepath = path.join(dataDir, filename);

    await writeFile(filepath, buffer);

    // metadata.json 생성/업데이트
    const metadataPath = path.join(dataDir, 'metadata.json');
    let metadata: any;

    if (existsSync(metadataPath)) {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
    } else {
      metadata = {
        sessionId: sessionId,
        sessionName: sessionName || `세션 ${sessionId}`,
        productBarcode: productBarcode || null,
        productName: productName || null,
        createdAt: new Date().toISOString(),
        createdBy: accountAddress,
        photos: [],
        conversionStatus: 'pending',
      };
    }

    // 기존 metadata가 있어도 상품 정보 업데이트 (최신 정보로 유지)
    if (productBarcode) {
      metadata.productBarcode = productBarcode;
    }
    if (productName) {
      metadata.productName = productName;
    }

    // 사진 정보 추가
    metadata.photos.push({
      filename: filename,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
    });
    metadata.lastUpdated = new Date().toISOString();

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return NextResponse.json({
      success: true,
      filename: filename,
      photoCount: metadata.photos.length,
      sessionId: sessionId,
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
