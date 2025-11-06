import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { checkIsAdminServer } from '@/lib/adminAuth';

const QUEUE_STATUS_FILE = path.join(process.cwd(), 'data/promotions/conversion-queue-status.json');

interface QueueStatus {
  deactivatedItems: {
    [key: string]: {  // promotionId or sessionId
      deactivatedAt: string;
      deactivatedBy: string;
      reason?: string;
    };
  };
  lastUpdated: string;
}

/**
 * GET /api/admin/photos/queue-status
 * 변환 대기 항목 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountAddress = searchParams.get('accountAddress');

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

    // 파일이 없으면 빈 상태 반환
    try {
      const fileContent = await fs.readFile(QUEUE_STATUS_FILE, 'utf-8');
      const status: QueueStatus = JSON.parse(fileContent);
      return NextResponse.json({ success: true, status });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // 파일이 없으면 초기 상태 생성
        const initialStatus: QueueStatus = {
          deactivatedItems: {},
          lastUpdated: new Date().toISOString()
        };

        // 디렉토리 생성
        const dir = path.dirname(QUEUE_STATUS_FILE);
        await fs.mkdir(dir, { recursive: true });

        // 파일 생성
        await fs.writeFile(QUEUE_STATUS_FILE, JSON.stringify(initialStatus, null, 2), 'utf-8');

        return NextResponse.json({ success: true, status: initialStatus });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error reading queue status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read queue status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/photos/queue-status
 * 변환 대기 항목 상태 업데이트
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountAddress, itemId, action, reason } = body;

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

    if (!itemId || !action) {
      return NextResponse.json(
        { success: false, error: 'itemId and action are required' },
        { status: 400 }
      );
    }

    // 현재 상태 읽기
    let status: QueueStatus;
    try {
      const fileContent = await fs.readFile(QUEUE_STATUS_FILE, 'utf-8');
      status = JSON.parse(fileContent);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        status = {
          deactivatedItems: {},
          lastUpdated: new Date().toISOString()
        };
      } else {
        throw error;
      }
    }

    // 상태 업데이트
    if (action === 'deactivate') {
      status.deactivatedItems[itemId] = {
        deactivatedAt: new Date().toISOString(),
        deactivatedBy: accountAddress,
        reason: reason || 'Manual deactivation'
      };
    } else if (action === 'activate') {
      delete status.deactivatedItems[itemId];
    }

    status.lastUpdated = new Date().toISOString();

    // 디렉토리 생성
    const dir = path.dirname(QUEUE_STATUS_FILE);
    await fs.mkdir(dir, { recursive: true });

    // 파일 저장
    await fs.writeFile(QUEUE_STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Error updating queue status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update queue status' },
      { status: 500 }
    );
  }
}
