import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';
import { verifyWithTimestamp } from '@/lib/userAuth';
import { existsSync } from 'fs';
import path from 'path';

// GET: 프로모션 목록 조회
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const verificationStatus = searchParams.get('verificationStatus');
    const barcode = searchParams.get('barcode');
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const name = searchParams.get('name');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const filter: any = {};

    // 상태 필터
    if (status) {
      filter.status = status;
    }

    // 검증 상태 필터
    if (verificationStatus) {
      filter.verificationStatus = verificationStatus;
    }

    // 이름으로 검색 (부분 일치)
    if (name) {
      filter.$or = [
        { name: { $regex: name, $options: 'i' } },
        { description: { $regex: name, $options: 'i' } },
        { applicableProducts: { $regex: name, $options: 'i' } },
      ];
    }

    // 바코드로 조회 (역인덱스 사용)
    if (barcode) {
      const index = await PromotionIndex.findOne({ barcode });
      if (index && index.promotionIds.length > 0) {
        filter._id = { $in: index.promotionIds };
      } else {
        // 인덱스에 없으면 빈 결과 반환
        return NextResponse.json({ success: true, promotions: [] });
      }
    }

    // 카테고리로 조회
    if (category) {
      filter.$or = [
        { applicableType: 'categories', applicableCategories: category },
        { giftSelectionType: 'cross', giftCategories: category },
      ];
    }

    // 브랜드로 조회
    if (brand) {
      filter.$or = [
        { applicableType: 'brands', applicableBrands: brand },
        { giftSelectionType: 'cross', giftBrands: brand },
      ];
    }

    // 활성 프로모션만 조회 (기본)
    if (status === 'active') {
      const now = new Date();
      filter.isActive = true;
      filter.validFrom = { $lte: now };
      filter.validTo = { $gte: now };
    }

    // 총 개수 조회
    const total = await Promotion.countDocuments(filter);

    // 페이지네이션 적용
    const promotions = await Promotion.find(filter)
      .sort({ priority: -1, verificationCount: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // 각 프로모션의 사진 수집 상태 확인
    const promotionsWithPhotoStatus = promotions.map((promotion: any) => {
      const promotionDir = path.join(process.cwd(), 'data', 'promotions', promotion._id.toString());
      const metadataPath = path.join(promotionDir, 'metadata.json');
      const hasPhotos = existsSync(metadataPath);

      let photoCount = 0;
      if (hasPhotos) {
        try {
          const { readFileSync } = require('fs');
          const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
          photoCount = metadata.photos?.length || 0;
        } catch (error) {
          // 메타데이터 읽기 실패 시 무시
        }
      }

      return {
        ...promotion,
        photoCollected: hasPhotos,
        photoCount: photoCount,
      };
    });

    return NextResponse.json({
      success: true,
      promotions: promotionsWithPhotoStatus,
      total,
      hasMore: offset + promotions.length < total,
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch promotions' },
      { status: 500 }
    );
  }
}

// POST: 프로모션 생성
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { promotionData, signature, timestamp, address, comment } = await request.json();

    // 서명 검증
    if (!signature || !timestamp || !address) {
      return NextResponse.json(
        { success: false, error: '서명 정보가 필요합니다.' },
        { status: 401 }
      );
    }

    const isValid = verifyWithTimestamp(
      { action: 'create_promotion', ...promotionData },
      signature,
      timestamp,
      address
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 서명입니다.' },
        { status: 401 }
      );
    }

    // 프로모션 생성
    const promotion = await Promotion.create({
      ...promotionData,
      createdBy: address,
      lastModifiedBy: address,
      modificationHistory: [
        {
          modifiedBy: address,
          modifiedAt: new Date(),
          changes: { type: 'create' },
          comment: comment || '프로모션 생성',
        },
      ],
      verificationStatus: 'unverified',
      verificationCount: 0,
      disputeCount: 0,
      verifiedBy: [],
      disputedBy: [],
    });

    // PromotionIndex 업데이트 (바코드 기반만)
    if (promotionData.applicableType === 'products' && promotionData.applicableProducts) {
      const barcodes = promotionData.applicableProducts;
      for (const barcode of barcodes) {
        await PromotionIndex.updateOne(
          { barcode },
          {
            $addToSet: { promotionIds: promotion._id },
            $set: { lastUpdated: new Date() },
          },
          { upsert: true }
        );
      }
    }

    return NextResponse.json({
      success: true,
      promotion,
    });
  } catch (error) {
    console.error('Error creating promotion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create promotion' },
      { status: 500 }
    );
  }
}
