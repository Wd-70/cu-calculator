import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { isAdmin } from '@/lib/adminAuth';
import mongoose from 'mongoose';

export const maxDuration = 300; // 5분

/**
 * POST /api/admin/collection-backup
 * MongoDB 컬렉션 백업/복원 관리 (관리자 전용)
 */
export async function POST(request: NextRequest) {
  try {
    const { accountAddress, action, sourceCollection, targetCollection } = await request.json();

    // 관리자 권한 확인
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await connectDB();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'copy': {
        // 컬렉션 복사: source -> target
        if (!sourceCollection || !targetCollection) {
          return NextResponse.json(
            { success: false, error: 'sourceCollection과 targetCollection이 필요합니다.' },
            { status: 400 }
          );
        }

        // 소스 컬렉션 존재 확인
        const collections = await db.listCollections({ name: sourceCollection }).toArray();
        if (collections.length === 0) {
          return NextResponse.json(
            { success: false, error: `컬렉션 '${sourceCollection}'이 존재하지 않습니다.` },
            { status: 404 }
          );
        }

        // 소스에서 모든 문서 가져오기
        const sourceData = await db.collection(sourceCollection).find({}).toArray();

        if (sourceData.length === 0) {
          return NextResponse.json(
            { success: false, error: `컬렉션 '${sourceCollection}'에 데이터가 없습니다.` },
            { status: 400 }
          );
        }

        // 타겟 컬렉션이 이미 존재하면 삭제
        const targetExists = await db.listCollections({ name: targetCollection }).toArray();
        if (targetExists.length > 0) {
          await db.collection(targetCollection).drop();
        }

        // 타겟에 데이터 삽입
        await db.collection(targetCollection).insertMany(sourceData);

        return NextResponse.json({
          success: true,
          message: `${sourceData.length}개 문서를 '${sourceCollection}'에서 '${targetCollection}'으로 복사했습니다.`,
          count: sourceData.length,
        });
      }

      case 'restore': {
        // 컬렉션 복원: backup -> original (기존 데이터 삭제 후)
        if (!sourceCollection || !targetCollection) {
          return NextResponse.json(
            { success: false, error: 'sourceCollection과 targetCollection이 필요합니다.' },
            { status: 400 }
          );
        }

        // 백업 컬렉션 존재 확인
        const backupExists = await db.listCollections({ name: sourceCollection }).toArray();
        if (backupExists.length === 0) {
          return NextResponse.json(
            { success: false, error: `백업 컬렉션 '${sourceCollection}'이 존재하지 않습니다.` },
            { status: 404 }
          );
        }

        // 백업에서 모든 문서 가져오기
        const backupData = await db.collection(sourceCollection).find({}).toArray();

        if (backupData.length === 0) {
          return NextResponse.json(
            { success: false, error: `백업 컬렉션 '${sourceCollection}'에 데이터가 없습니다.` },
            { status: 400 }
          );
        }

        // 원본 컬렉션 비우기
        const targetExists = await db.listCollections({ name: targetCollection }).toArray();
        if (targetExists.length > 0) {
          await db.collection(targetCollection).deleteMany({});
        }

        // 백업 데이터 복원
        await db.collection(targetCollection).insertMany(backupData);

        return NextResponse.json({
          success: true,
          message: `${backupData.length}개 문서를 '${sourceCollection}'에서 '${targetCollection}'으로 복원했습니다.`,
          count: backupData.length,
        });
      }

      case 'list': {
        // 모든 컬렉션 목록 조회
        const allCollections = await db.listCollections().toArray();
        const collectionInfo = await Promise.all(
          allCollections.map(async (col) => {
            const count = await db.collection(col.name).countDocuments();
            return {
              name: col.name,
              count,
            };
          })
        );

        return NextResponse.json({
          success: true,
          collections: collectionInfo,
        });
      }

      case 'delete': {
        // 컬렉션 삭제
        if (!targetCollection) {
          return NextResponse.json(
            { success: false, error: 'targetCollection이 필요합니다.' },
            { status: 400 }
          );
        }

        const exists = await db.listCollections({ name: targetCollection }).toArray();
        if (exists.length === 0) {
          return NextResponse.json(
            { success: false, error: `컬렉션 '${targetCollection}'이 존재하지 않습니다.` },
            { status: 404 }
          );
        }

        await db.collection(targetCollection).drop();

        return NextResponse.json({
          success: true,
          message: `컬렉션 '${targetCollection}'을 삭제했습니다.`,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: '유효하지 않은 action입니다. (copy, restore, list, delete 중 하나)' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Collection backup error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
