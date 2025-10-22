import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import { isAdmin } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const photo = formData.get('photo') as File;
    const promotionId = formData.get('promotionId') as string;
    const accountAddress = formData.get('accountAddress') as string;

    // 관리자 권한 확인
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!photo || !promotionId) {
      return NextResponse.json(
        { success: false, error: '사진 또는 프로모션 ID가 없습니다.' },
        { status: 400 }
      );
    }

    // 프로모션 확인
    await connectDB();
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return NextResponse.json(
        { success: false, error: '프로모션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 저장 경로 생성
    const dataDir = path.join(process.cwd(), 'data', 'promotions', promotionId);
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
      const { readFile } = await import('fs/promises');
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
    } else {
      metadata = {
        promotionId: promotionId,
        promotionName: promotion.name,
        currentData: {
          name: promotion.name,
          promotionType: promotion.promotionType,
          applicableProducts: promotion.applicableProducts || [],
          giftSelectionType: promotion.giftSelectionType,
          validFrom: promotion.validFrom,
          validTo: promotion.validTo,
        },
        photos: [],
        photoCollected: false,
        conversionStatus: 'pending',
      };
    }

    // 사진 정보 추가
    metadata.photos.push({
      filename: filename,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
    });
    metadata.photoCollected = true;
    metadata.conversionStatus = 'pending';

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return NextResponse.json({
      success: true,
      filename: filename,
      photoCount: metadata.photos.length,
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
