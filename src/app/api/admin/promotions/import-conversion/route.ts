import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';
import { isAdmin } from '@/lib/adminAuth';
import mongoose from 'mongoose';

interface ConversionData {
  batchId: string;
  createdAt: string;
  totalPromotions: number;
  conversions: Array<{
    sourcePromotionId: string;
    sourcePhotoPath: string;
    action: 'update_and_merge' | 'create_new' | 'skip';
    confidence: 'high' | 'medium' | 'low';
    extractedData: {
      posScreenData: any;
      promotionUpdate: {
        name: string;
        description: string;
        promotionType: string;
        buyQuantity: number;
        getQuantity: number;
        applicableType: string;
        applicableProducts: string[];
        giftSelectionType: 'same' | 'cross';
        giftProducts?: string[];
        validFrom: string;
        validTo: string;
        status: string;
        isActive: boolean;
      };
    };
    mergeStrategy?: any;
    warnings: string[];
    notes: string;
  }>;
  summary: {
    processed: number;
    succeeded: number;
    failed: number;
    warnings: number;
  };
}

export async function POST(request: NextRequest) {
  const session = await mongoose.startSession();

  try {
    const { accountAddress, conversionData } = await request.json();

    // 관리자 권한 확인
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 변환 데이터 검증
    if (!conversionData || !conversionData.conversions) {
      return NextResponse.json(
        { success: false, error: '변환 데이터가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    await connectDB();

    const data = conversionData as ConversionData;
    const updatedPromotionIds: string[] = [];
    const errors: string[] = [];

    // 트랜잭션 시작
    session.startTransaction();

    try {
      for (const conversion of data.conversions) {
        const { sourcePromotionId, action, extractedData } = conversion;

        if (action === 'skip') {
          continue;
        }

        // 프로모션 찾기
        const promotion = await Promotion.findById(sourcePromotionId).session(session);

        if (!promotion) {
          errors.push(`프로모션 ${sourcePromotionId}을(를) 찾을 수 없습니다.`);
          continue;
        }

        const { promotionUpdate } = extractedData;

        // 기존 상품 목록과 새 상품 목록 병합
        const existingProducts = promotion.applicableProducts || [];
        const newProducts = promotionUpdate.applicableProducts || [];
        const allProducts = Array.from(new Set([...existingProducts, ...newProducts]));

        // 사진에서 발견된 모든 상품들의 개별 프로모션 찾기
        const relatedPromotions = await Promotion.find({
          _id: { $ne: promotion._id }, // 현재 프로모션 제외
          promotionType: promotionUpdate.promotionType,
          applicableProducts: { $in: allProducts },
          status: 'active'
        }).session(session);

        // 관련된 모든 프로모션의 상품 수집
        const allRelatedProducts = new Set<string>(allProducts);
        const promotionsToDelete: string[] = [];

        for (const relatedPromo of relatedPromotions) {
          // 관련 프로모션의 모든 상품 추가
          relatedPromo.applicableProducts?.forEach(barcode => {
            allRelatedProducts.add(barcode);
          });

          // 삭제할 프로모션 ID 저장
          promotionsToDelete.push(relatedPromo._id.toString());
        }

        const mergedProducts = Array.from(allRelatedProducts);

        // 메인 프로모션 업데이트
        promotion.name = promotionUpdate.name;
        promotion.description = promotionUpdate.description;
        promotion.promotionType = promotionUpdate.promotionType;
        promotion.buyQuantity = promotionUpdate.buyQuantity;
        promotion.getQuantity = promotionUpdate.getQuantity;
        promotion.applicableType = promotionUpdate.applicableType;
        promotion.applicableProducts = mergedProducts;
        promotion.giftSelectionType = promotionUpdate.giftSelectionType;

        if (promotionUpdate.giftProducts && promotionUpdate.giftProducts.length > 0) {
          promotion.giftProducts = promotionUpdate.giftProducts;
        }

        // 병합 시 mustBeSameProduct 제약 제거 (2개 이상 상품이 있으면 교차 증정 가능)
        if (mergedProducts.length > 1 && promotion.giftConstraints?.mustBeSameProduct) {
          if (!promotion.giftConstraints) {
            promotion.giftConstraints = {};
          }
          promotion.giftConstraints.mustBeSameProduct = false;
        }

        promotion.validFrom = new Date(promotionUpdate.validFrom);
        promotion.validTo = new Date(promotionUpdate.validTo);
        promotion.status = promotionUpdate.status;
        promotion.isActive = promotionUpdate.isActive;
        promotion.lastModifiedBy = accountAddress;

        // 수정 이력 추가
        if (!promotion.modificationHistory) {
          promotion.modificationHistory = [];
        }
        promotion.modificationHistory.push({
          modifiedBy: accountAddress,
          modifiedAt: new Date(),
          changes: {
            type: 'photo_conversion',
            batchId: data.batchId,
            addedProducts: newProducts.filter(p => !existingProducts.includes(p)),
            mergedPromotions: promotionsToDelete,
            totalProductsAfterMerge: mergedProducts.length,
            notes: conversion.notes,
          },
          comment: `사진 변환을 통한 프로모션 업데이트 및 ${relatedPromotions.length}개 프로모션 병합 (${conversion.confidence} confidence)`,
        });

        await promotion.save({ session });

        // 개별 프로모션 삭제
        if (promotionsToDelete.length > 0) {
          await Promotion.deleteMany(
            { _id: { $in: promotionsToDelete } },
            { session }
          );
        }

        // PromotionIndex 업데이트 - 모든 상품에 대해
        for (const barcode of mergedProducts) {
          // 기존 인덱스에서 삭제된 프로모션 ID 제거
          await PromotionIndex.updateOne(
            { barcode },
            {
              $pull: { promotionIds: { $in: promotionsToDelete } }
            },
            { session }
          );

          // 메인 프로모션 ID 추가
          await PromotionIndex.updateOne(
            { barcode },
            {
              $addToSet: { promotionIds: promotion._id },
              $set: { lastUpdated: new Date() },
            },
            { upsert: true, session }
          );
        }

        // metadata.json 업데이트
        const metadataPath = path.join(
          process.cwd(),
          'data',
          'promotions',
          sourcePromotionId,
          'metadata.json'
        );

        if (existsSync(metadataPath)) {
          const metadataContent = await readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent);

          metadata.conversionStatus = 'completed';
          metadata.convertedAt = new Date().toISOString();
          metadata.batchId = data.batchId;
          metadata.convertedData = promotionUpdate;

          await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        }

        updatedPromotionIds.push(sourcePromotionId);
      }

      // 트랜잭션 커밋
      await session.commitTransaction();

      // batch 파일 저장
      const batchDir = path.join(process.cwd(), 'data', 'promotions', 'conversion-batches');
      const { mkdir } = await import('fs/promises');
      if (!existsSync(batchDir)) {
        await mkdir(batchDir, { recursive: true });
      }

      const batchFilePath = path.join(batchDir, `${data.batchId}.json`);
      const flagFilePath = path.join(batchDir, `${data.batchId}_imported.flag`);

      // batch 파일이 없으면 저장
      if (!existsSync(batchFilePath)) {
        await writeFile(batchFilePath, JSON.stringify(data, null, 2));
      }

      // 임포트 완료 플래그 생성
      await writeFile(
        flagFilePath,
        JSON.stringify({
          importedAt: new Date().toISOString(),
          importedBy: accountAddress,
          updatedPromotions: updatedPromotionIds.length,
          errors: errors.length,
        }, null, 2)
      );

      return NextResponse.json({
        success: true,
        updatedCount: updatedPromotionIds.length,
        updatedPromotions: updatedPromotionIds,
        errors: errors.length > 0 ? errors : undefined,
        batchId: data.batchId,
      });

    } catch (error) {
      // 트랜잭션 롤백
      await session.abortTransaction();
      throw error;
    }

  } catch (error) {
    console.error('Import conversion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import conversion data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
