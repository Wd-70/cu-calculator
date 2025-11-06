import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { CATEGORY_MAPPING } from '@/lib/constants/categoryMapping';

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
    const categories = searchParams.getAll('categories'); // 복수 카테고리 지원
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 바코드 필터: 기본적으로 바코드가 있는 상품만 표시
    // includeWithoutBarcode=true 시에만 바코드 없는 상품도 포함
    const includeWithoutBarcode = searchParams.get('includeWithoutBarcode') === 'true';

    // "기타" 카테고리 특수 처리
    const isUnmappedOnlyQuery =
      category === '기타' ||
      (categories && categories.includes('기타'));

    if (isUnmappedOnlyQuery) {
      // 모든 카테고리가 미매핑인 상품만 필터링
      const filter: any = {
        categoryTags: { $exists: true, $ne: null, $not: { $size: 0 } }
      };

      // 바코드 필터 적용
      if (!includeWithoutBarcode) {
        filter.barcode = { $exists: true, $ne: null, $ne: '' };
      }

      if (barcode) {
        filter.barcode = barcode;
      }

      if (name) {
        filter.name = { $regex: name, $options: 'i' };
      }

      // 모든 상품을 가져와서 메모리에서 필터링
      // (성능 최적화가 필요하면 나중에 aggregation으로 변경)
      const allProducts = await db.findProducts(filter, {
        sort: { createdAt: -1 },
      });

      // 모든 카테고리가 미매핑인 상품만 필터링
      const unmappedProducts = allProducts.filter((product: any) => {
        if (!product.categoryTags || product.categoryTags.length === 0) {
          return true; // 카테고리가 없는 상품은 미매핑으로 간주
        }

        // 모든 카테고리가 미매핑인지 확인
        const allCategoriesUnmapped = product.categoryTags.every(
          (tag: any) => !CATEGORY_MAPPING[tag.name] && tag.name !== '전체'
        );

        return allCategoriesUnmapped;
      });

      // 페이징 적용
      const paginatedProducts = unmappedProducts.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        data: paginatedProducts,
        total: unmappedProducts.length,
        source: 'local',
      });
    }

    // 일반 카테고리 필터링
    const filter: any = {};

    // 바코드 필터 적용
    if (!includeWithoutBarcode) {
      filter.barcode = { $exists: true, $ne: null, $ne: '' };
    }

    if (barcode) {
      filter.barcode = barcode;
    }

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (category) {
      // categoryTags 배열 내에서 해당 이름을 가진 태그가 있는지 검색
      filter.categoryTags = { $elemMatch: { name: category } };
    } else if (categories && categories.length > 0) {
      // 여러 카테고리 중 하나라도 포함하는 상품 검색
      filter.categoryTags = {
        $elemMatch: {
          name: { $in: categories }
        }
      };
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
