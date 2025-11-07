import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { isAdmin } from '@/lib/adminAuth';
import { writeFile, readFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// 사용 가능한 모델들
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';
import Product from '@/lib/models/Product';
import DiscountRule from '@/lib/models/DiscountRule';
import ModificationHistory from '@/lib/models/ModificationHistory';

const MODELS: Record<string, any> = {
  Promotion,
  PromotionIndex,
  Product,
  DiscountRule,
  ModificationHistory,
};

interface BackupMetadata {
  createdAt: string;
  createdBy: string;
  collections: string[];
  totalDocuments: number;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { accountAddress, action, backupName, description } = await request.json();

    // 관리자 권한 확인
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await connectDB();

    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!existsSync(backupDir)) {
      await mkdir(backupDir, { recursive: true });
    }

    switch (action) {
      case 'create': {
        // 백업 생성
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = backupName || `backup_${timestamp}`;
        const backupPath = path.join(backupDir, backupId);

        if (!existsSync(backupPath)) {
          await mkdir(backupPath, { recursive: true });
        }

        const collections: string[] = [];
        let totalDocuments = 0;

        // 각 컬렉션 백업
        for (const [name, Model] of Object.entries(MODELS)) {
          const documents = await Model.find({}).lean();

          if (documents.length > 0) {
            const filePath = path.join(backupPath, `${name}.json`);
            await writeFile(filePath, JSON.stringify(documents, null, 2));
            collections.push(name);
            totalDocuments += documents.length;
          }
        }

        // 메타데이터 저장
        const metadata: BackupMetadata = {
          createdAt: new Date().toISOString(),
          createdBy: accountAddress,
          collections,
          totalDocuments,
          description: description || `백업 생성: ${backupId}`,
        };

        await writeFile(
          path.join(backupPath, 'metadata.json'),
          JSON.stringify(metadata, null, 2)
        );

        return NextResponse.json({
          success: true,
          backupId,
          metadata,
        });
      }

      case 'list': {
        // 백업 목록 조회
        const backups = [];

        if (existsSync(backupDir)) {
          const entries = await readdir(backupDir, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.isDirectory()) {
              const metadataPath = path.join(backupDir, entry.name, 'metadata.json');

              if (existsSync(metadataPath)) {
                try {
                  const metadataContent = await readFile(metadataPath, 'utf-8');
                  const metadata = JSON.parse(metadataContent);

                  backups.push({
                    id: entry.name,
                    ...metadata,
                  });
                } catch (error) {
                  console.error(`Error reading metadata for ${entry.name}:`, error);
                }
              }
            }
          }
        }

        // 최신순 정렬
        backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({
          success: true,
          backups,
        });
      }

      case 'restore': {
        // 백업 복원
        if (!backupName) {
          return NextResponse.json(
            { success: false, error: '백업 이름이 필요합니다.' },
            { status: 400 }
          );
        }

        const backupPath = path.join(backupDir, backupName);

        if (!existsSync(backupPath)) {
          return NextResponse.json(
            { success: false, error: '백업을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          const restoredCollections: string[] = [];
          let restoredDocuments = 0;

          // 각 컬렉션 복원
          for (const [name, Model] of Object.entries(MODELS)) {
            const filePath = path.join(backupPath, `${name}.json`);

            if (existsSync(filePath)) {
              const fileContent = await readFile(filePath, 'utf-8');
              const documents = JSON.parse(fileContent);

              // 기존 데이터 삭제
              await Model.deleteMany({}, { session });

              // 새 데이터 삽입
              if (documents.length > 0) {
                await Model.insertMany(documents, { session });
                restoredCollections.push(name);
                restoredDocuments += documents.length;
              }
            }
          }

          await session.commitTransaction();

          return NextResponse.json({
            success: true,
            restoredCollections,
            restoredDocuments,
          });

        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }

      case 'delete': {
        // 백업 삭제
        if (!backupName) {
          return NextResponse.json(
            { success: false, error: '백업 이름이 필요합니다.' },
            { status: 400 }
          );
        }

        const backupPath = path.join(backupDir, backupName);

        if (!existsSync(backupPath)) {
          return NextResponse.json(
            { success: false, error: '백업을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }

        // 백업 폴더 삭제 (재귀적)
        const { rm } = await import('fs/promises');
        await rm(backupPath, { recursive: true, force: true });

        return NextResponse.json({
          success: true,
          message: '백업이 삭제되었습니다.',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: '알 수 없는 액션입니다.' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('DB backup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'DB backup operation failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
