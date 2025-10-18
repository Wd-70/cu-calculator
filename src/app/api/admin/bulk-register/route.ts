import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';

/**
 * POST /api/admin/bulk-register
 * Bulk register products
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const { accountAddress, products, createdBy } = await request.json();

    // 관리자 계정 검증
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: '등록할 상품이 없습니다.' },
        { status: 400 }
      );
    }

    if (!createdBy) {
      return NextResponse.json(
        { error: '사용자 계정이 필요합니다.' },
        { status: 401 }
      );
    }

    await db.connect();

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const product of products) {
      try {
        const { barcode, name, price, category, imageUrl, detailUrl, promotion } = product;

        // 디버깅: 첫 번째 상품의 detailUrl 확인
        if (results.success === 0 && results.failed === 0) {
          console.log('첫 번째 상품 데이터:', { barcode, name, price, category, imageUrl, detailUrl, promotion });
        }

        // 필수 필드 검증
        if (!barcode || !name || !price) {
          results.failed++;
          results.errors.push(`${name || barcode}: 필수 정보 누락`);
          continue;
        }

        // 이미 존재하는 상품인지 확인
        const existingProduct = await db.findProductByBarcode(barcode);
        let productToProcess;

        if (existingProduct) {
          // 기존 상품이 있으면 프로모션 처리만 진행
          productToProcess = existingProduct;
          console.log(`  기존 상품 발견: ${name} (프로모션 정보만 업데이트)`);
        } else {
          // 새 상품 등록
          productToProcess = await db.createProduct({
          barcode,
          name,
          price,
          category: category || null,
          brand: 'CU',
          imageUrl: imageUrl || null,
          detailUrl: detailUrl || null,
          createdBy,
          modificationCount: 0,
          isVerified: false,
          verificationCount: 0,
          reportCount: 0,
        });

          // 디버깅: 첫 번째 상품이 DB에 저장된 후 확인
          if (results.success === 0) {
            console.log('DB에 저장된 첫 번째 상품:', {
              barcode: productToProcess.barcode,
              name: productToProcess.name,
              detailUrl: productToProcess.detailUrl,
              promotion: promotion
            });
          }
        }

        // 프로모션 정보가 있으면 할인 규칙에 자동 추가
        if (promotion) {
          console.log(`  상품 "${name}"에 프로모션 "${promotion}" 감지`);

          // 현재 날짜 기준으로 유효한 할인 규칙 찾기
          const now = new Date();
          const discountRules = await db.findDiscountRules({
            name: { $regex: promotion, $options: 'i' },
            isActive: true,
            validFrom: { $lte: now },
            validTo: { $gte: now }
          });

          if (discountRules.length > 0) {
            // 현재 날짜에 가장 가까운 규칙 선택
            const discountRule = discountRules.sort((a: any, b: any) => {
              const aStart = new Date(a.validFrom).getTime();
              const bStart = new Date(b.validFrom).getTime();
              const nowTime = now.getTime();
              return Math.abs(nowTime - bStart) - Math.abs(nowTime - aStart);
            })[0];

            // 중복 확인 후 추가
            const productId = productToProcess._id.toString();
            const isAlreadyIncluded = discountRule.applicableProducts.some(
              (id: any) => id.toString() === productId
            );

            if (!isAlreadyIncluded) {
              discountRule.applicableProducts.push(productToProcess._id);
              await db.updateDiscountRule(discountRule._id.toString(), {
                applicableProducts: discountRule.applicableProducts
              });
              console.log(`    "${discountRule.name}" 할인 규칙에 추가됨`);
            } else {
              console.log(`    이미 "${discountRule.name}" 할인 규칙에 포함되어 있음`);
            }
          } else {
            console.log(`    "${promotion}" 프로모션에 해당하는 유효한 할인 규칙을 찾지 못함`);
          }
        }

        // 결과 카운트 (기존 상품은 skipped, 새 상품은 success)
        if (existingProduct) {
          results.skipped++;
        } else {
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${product.name || product.barcode}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    console.log('Bulk registration completed:', results);

    return NextResponse.json({
      success: true,
      results,
      message: `성공: ${results.success}, 실패: ${results.failed}, 스킵: ${results.skipped}`
    });
  } catch (error) {
    console.error('Error in bulk registration:', error);
    return NextResponse.json(
      {
        error: '일괄 등록 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
