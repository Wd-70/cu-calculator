import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/products
 * Search products
 */
export async function GET(request: NextRequest) {
  try {
    await db.connect();

    const searchParams = request.nextUrl.searchParams;
    const barcode = searchParams.get('barcode');
    const name = searchParams.get('name');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const filter: any = {};

    if (barcode) {
      filter.barcode = barcode;
    }

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (category) {
      // categoryTags 배열 내에서 해당 이름을 가진 태그가 있는지 검색
      filter.categoryTags = { $elemMatch: { name: category } };
    }

    const total = await db.countProducts(filter);
    const products = await db.findProducts(filter, {
      limit,
      skip: offset,
      sort: { createdAt: -1 },
    });

    return NextResponse.json({
      success: true,
      data: products,
      total,
      source: 'local',
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
  try {
    await db.connect();

    const body = await request.json();
    const { barcode, name, price, category, brand, imageUrl, createdBy } = body;

    // Validate required fields
    if (!barcode || !name || price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate user account
    if (!createdBy) {
      return NextResponse.json(
        { success: false, error: 'User account is required' },
        { status: 401 }
      );
    }

    // Check if product already exists
    const existingProduct = await db.findProductByBarcode(barcode);
    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product with this barcode already exists' },
        { status: 409 }
      );
    }

    // Get IP address for logging
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const product = await db.createProduct({
      barcode,
      name,
      price,
      category,
      brand,
      imageUrl,
      createdBy, // Use user's public address
      modificationCount: 0,
      isVerified: false,
      verificationCount: 0,
      reportCount: 0,
    });

    // Log modification history
    await db.createModificationHistory({
      productId: product._id,
      action: 'create',
      afterData: product as any,
      modifiedBy: createdBy, // Use user's public address
      modifiedAt: new Date(),
      ipAddress: ipAddress,
    });

    return NextResponse.json(
      {
        success: true,
        data: product,
        message: 'Product created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
