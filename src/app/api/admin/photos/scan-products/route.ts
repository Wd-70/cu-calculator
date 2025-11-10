import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isAdmin } from '@/lib/adminAuth';

interface ScannedProduct {
  barcode: string;
  name: string;
  price: number;
  imageUrl?: string;
  scannedAt: string;
  scannedBy: string;
  isActive: boolean;
}

interface ScanProductsData {
  products: ScannedProduct[];
  lastUpdated: string;
}

const PRODUCTS_FILE = path.join(process.cwd(), 'data', 'scan-products', 'products.json');

async function loadProducts(): Promise<ScanProductsData> {
  if (!existsSync(PRODUCTS_FILE)) {
    const dir = path.dirname(PRODUCTS_FILE);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    return { products: [], lastUpdated: new Date().toISOString() };
  }

  const content = await readFile(PRODUCTS_FILE, 'utf-8');
  return JSON.parse(content);
}

async function saveProducts(data: ScanProductsData): Promise<void> {
  const dir = path.dirname(PRODUCTS_FILE);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(PRODUCTS_FILE, JSON.stringify(data, null, 2));
}

// GET - 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountAddress = searchParams.get('accountAddress');

    if (!accountAddress || !isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const data = await loadProducts();
    return NextResponse.json({ success: true, products: data.products });
  } catch (error) {
    console.error('Load scan products error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load products' },
      { status: 500 }
    );
  }
}

// POST - 상품 추가
export async function POST(request: NextRequest) {
  try {
    const { accountAddress, product } = await request.json();

    if (!accountAddress || !isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!product || !product.barcode) {
      return NextResponse.json(
        { success: false, error: '상품 정보가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const data = await loadProducts();

    // 이미 존재하는 상품인지 확인
    const existingIndex = data.products.findIndex(p => p.barcode === product.barcode);

    if (existingIndex >= 0) {
      // 이미 있으면 활성화만
      data.products[existingIndex].isActive = true;
      data.products[existingIndex].scannedAt = new Date().toISOString();
    } else {
      // 새로운 상품 추가
      data.products.unshift({
        ...product,
        scannedAt: new Date().toISOString(),
        scannedBy: accountAddress,
        isActive: true,
      });
    }

    data.lastUpdated = new Date().toISOString();
    await saveProducts(data);

    return NextResponse.json({ success: true, products: data.products });
  } catch (error) {
    console.error('Add scan product error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add product' },
      { status: 500 }
    );
  }
}

// DELETE - 상품 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountAddress = searchParams.get('accountAddress');
    const barcode = searchParams.get('barcode');

    if (!accountAddress || !isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!barcode) {
      return NextResponse.json(
        { success: false, error: '바코드가 필요합니다.' },
        { status: 400 }
      );
    }

    const data = await loadProducts();
    data.products = data.products.filter(p => p.barcode !== barcode);
    data.lastUpdated = new Date().toISOString();
    await saveProducts(data);

    return NextResponse.json({ success: true, products: data.products });
  } catch (error) {
    console.error('Delete scan product error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}

// PATCH - 상품 활성/비활성 토글
export async function PATCH(request: NextRequest) {
  try {
    const { accountAddress, barcode, isActive } = await request.json();

    if (!accountAddress || !isAdmin(accountAddress)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!barcode || isActive === undefined) {
      return NextResponse.json(
        { success: false, error: '바코드와 활성 상태가 필요합니다.' },
        { status: 400 }
      );
    }

    const data = await loadProducts();
    const product = data.products.find(p => p.barcode === barcode);

    if (product) {
      product.isActive = isActive;
      data.lastUpdated = new Date().toISOString();
      await saveProducts(data);
    }

    return NextResponse.json({ success: true, products: data.products });
  } catch (error) {
    console.error('Toggle scan product error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle product' },
      { status: 500 }
    );
  }
}
