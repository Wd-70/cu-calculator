import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { findUnmappedCategories, CATEGORY_MAPPING } from '@/lib/constants/categoryMapping';

/**
 * GET /api/admin/categories/unmapped
 * 미매핑 카테고리 검사 + 상품 정보
 *
 * Query Parameters:
 * - detailed: boolean - true일 경우 상세 검사 수행 (모든 카테고리가 미매핑인 상품만 필터링)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const detailed = searchParams.get('detailed') === 'true';

    // MongoDB aggregation으로 모든 고유 카테고리 추출
    const result = await Product.aggregate([
      { $match: { categoryTags: { $exists: true, $ne: null, $not: { $size: 0 } } } },
      { $unwind: '$categoryTags' },
      { $group: { _id: '$categoryTags.name' } },
      { $sort: { _id: 1 } }
    ]);

    const allCategories = result.map(item => item._id);

    // 미매핑 카테고리 찾기
    const unmappedCategories = findUnmappedCategories(allCategories);

    // 각 미매핑 카테고리별 상품 정보 가져오기
    const unmappedWithProducts = await Promise.all(
      unmappedCategories.map(async (category) => {
        const allProductsInCategory = await Product.find(
          { 'categoryTags.name': category },
          { _id: 1, name: 1, barcode: 1, price: 1, categoryTags: 1 }
        ).lean();

        let productsToShow = allProductsInCategory;
        let unmappedProductCount = 0;

        // 상세 검사: 모든 카테고리가 미매핑인 상품만 필터링
        if (detailed) {
          const trulyUnmappedProducts = allProductsInCategory.filter(product => {
            // 상품의 모든 카테고리가 미매핑인지 확인
            const allCategoriesUnmapped = product.categoryTags?.every(
              (tag: any) => !CATEGORY_MAPPING[tag.name] && tag.name !== '전체'
            ) ?? true;

            return allCategoriesUnmapped;
          });

          productsToShow = trulyUnmappedProducts;
          unmappedProductCount = trulyUnmappedProducts.length;
        }

        // 샘플 상품은 최대 10개만
        const sampleProducts = productsToShow.slice(0, 10).map(p => ({
          _id: p._id,
          name: p.name,
          barcode: p.barcode,
          price: p.price,
        }));

        return {
          category,
          productCount: allProductsInCategory.length, // 이 카테고리를 가진 전체 상품 수
          unmappedProductCount: detailed ? unmappedProductCount : undefined, // 상세 검사 시에만 포함
          sampleProducts,
        };
      })
    );

    // 상세 검사 시 진짜 문제 상품이 있는 카테고리만 필터링
    const finalUnmappedCategories = detailed
      ? unmappedWithProducts.filter(item => item.unmappedProductCount! > 0)
      : unmappedWithProducts;

    // 총 미매핑 상품 수 계산 (상세 검사 시에만)
    const totalUnmappedProducts = detailed
      ? finalUnmappedCategories.reduce((sum, item) => sum + (item.unmappedProductCount || 0), 0)
      : undefined;

    return NextResponse.json({
      success: true,
      detailed,
      totalCategories: allCategories.length,
      mappedCount: allCategories.length - unmappedCategories.length,
      unmappedCount: finalUnmappedCategories.length,
      totalUnmappedProducts, // 상세 검사 시에만 포함
      unmappedCategories: finalUnmappedCategories,
    });
  } catch (error) {
    console.error('Error checking unmapped categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check unmapped categories' },
      { status: 500 }
    );
  }
}
