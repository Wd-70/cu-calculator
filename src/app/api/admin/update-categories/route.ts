import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';

// API 라우트 타임아웃 설정 (5분)
export const maxDuration = 300;

/**
 * POST /api/admin/update-categories
 * Update product categories by crawling detail pages
 * Admin only
 */
export async function POST(request: NextRequest) {
  let browser;

  try {
    const { accountAddress, barcodes = [], maxProducts = 10 } = await request.json();

    // 관리자 계정 검증
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    console.log('Starting category update...');
    console.log('Barcodes:', barcodes.length > 0 ? barcodes : 'All products');
    console.log('Max products:', maxProducts);

    await db.connect();

    // 업데이트할 상품 찾기
    let productsToUpdate = [];
    if (barcodes.length > 0) {
      // 특정 바코드만
      for (const barcode of barcodes) {
        const product = await db.findProductByBarcode(barcode);
        if (product && product.detailUrls && product.detailUrls.length > 0) {
          productsToUpdate.push(product);
        }
      }
    } else {
      // detailUrls가 있는 모든 상품 (최대 maxProducts개)
      // detailUrls가 있다 = 아직 업데이트되지 않은 상품
      const allProducts = await db.findProducts(
        { detailUrls: { $exists: true, $ne: null, $not: { $size: 0 } } },
        { limit: maxProducts }
      );
      productsToUpdate = allProducts;
    }

    if (productsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        results: {
          success: 0,
          failed: 0,
          skipped: 0,
          errors: []
        },
        message: '업데이트할 상품이 없습니다.'
      });
    }

    console.log(`Found ${productsToUpdate.length} products to update`);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // 각 상품의 모든 상세 페이지 방문
    for (const product of productsToUpdate) {
      try {
        if (!product.detailUrls || product.detailUrls.length === 0) {
          results.skipped++;
          continue;
        }

        console.log(`\nProcessing: ${product.name} (${product.barcode})`);
        console.log(`  Detail URLs: ${product.detailUrls.length}개`);

        // 모든 URL에서 수집한 태그를 저장
        const allCategoryTags = new Set<string>();
        const allPromotionTags = new Set<string>();

        // 각 detailUrl 방문
        for (let urlIndex = 0; urlIndex < product.detailUrls.length; urlIndex++) {
          const detailUrl = product.detailUrls[urlIndex];
          console.log(`  [${urlIndex + 1}/${product.detailUrls.length}] Visiting: ${detailUrl}`);

          // 상세 페이지 이동
          await page.goto(detailUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });

          // 폴링 방식으로 페이지 로드 대기 (카테고리 요소가 나타날 때까지)
          let categoryLoaded = false;
          let pollAttempts = 0;
          const maxPollAttempts = 20; // 최대 10초 (500ms * 20)

          while (pollAttempts < maxPollAttempts && !categoryLoaded) {
            await new Promise(resolve => setTimeout(resolve, 500));

            categoryLoaded = await page.evaluate(() => {
              const mainCategory = document.querySelector('.prodView .on');
              return mainCategory !== null;
            });

            if (categoryLoaded) {
              console.log(`    페이지 로드 완료 (${pollAttempts * 500}ms 소요)`);
              break;
            }

            pollAttempts++;
          }

          // 카테고리 추출
          const categoryTags = await page.evaluate(() => {
            const tags: string[] = [];

            // 대분류: .prodView .on
            const mainCategory = document.querySelector('.prodView .on');
            if (mainCategory) {
              tags.push(mainCategory.textContent?.trim() || '');
            }

            // 소분류: .prodTag li
            const subCategories = document.querySelectorAll('.prodTag li');
            subCategories.forEach(li => {
              const text = li.textContent?.trim() || '';
              if (text && !tags.includes(text)) {
                tags.push(text);
              }
            });

            return tags;
          });

          if (categoryTags.length > 0) {
            console.log(`    Found tags: ${categoryTags.join(', ')}`);

            // 프로모션 태그와 카테고리 태그 분리
            const promotionTags = categoryTags.filter(tag => tag.match(/^\d+\+\d+$/));
            const categoryOnlyTags = categoryTags.filter(tag => !tag.match(/^\d+\+\d+$/));

            // 모든 태그를 Set에 추가
            categoryOnlyTags.forEach(tag => allCategoryTags.add(tag));
            promotionTags.forEach(tag => allPromotionTags.add(tag));
          }

          // 다음 URL 방문 전 짧은 대기
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 모든 URL 방문 완료 후 처리
        console.log(`  수집된 카테고리 태그: ${Array.from(allCategoryTags).join(', ')}`);
        console.log(`  수집된 프로모션 태그: ${Array.from(allPromotionTags).join(', ')}`);

        // 카테고리 설정 (가장 세부적인 카테고리 선택)
        let newCategory = '';
        if (allCategoryTags.size > 0) {
          const categoryArray = Array.from(allCategoryTags);
          // 마지막 태그가 가장 세부적인 카테고리
          newCategory = categoryArray[categoryArray.length - 1];

          console.log(`  Setting category: ${newCategory}`);
          // 카테고리 업데이트 후 detailUrls 제거 (재업데이트 방지)
          await db.updateProduct(product._id.toString(), {
            category: newCategory,
            detailUrls: []
          });
        }

        // 프로모션 태그 처리 (1+1, 2+1 등)
        for (const promotionTag of Array.from(allPromotionTags)) {
          console.log(`  Processing promotion: ${promotionTag}`);

          // 현재 날짜 기준으로 유효한 할인 규칙 찾기
          const now = new Date();
          const discountRules = await db.findDiscountRules({
            name: { $regex: promotionTag, $options: 'i' },
            isActive: true,
            validFrom: { $lte: now },
            validTo: { $gte: now }
          });

          if (discountRules.length > 0) {
            // 여러 개의 규칙이 있을 경우:
            // 1. 현재 날짜가 유효기간 내에 있는 규칙들 중
            // 2. validFrom이 현재에 가장 가까운 것 선택 (가장 최근에 시작된 것)
            const discountRule = discountRules.sort((a: any, b: any) => {
              const aStart = new Date(a.validFrom).getTime();
              const bStart = new Date(b.validFrom).getTime();
              const nowTime = now.getTime();
              // 현재 시간에 더 가까운 것을 우선
              return Math.abs(nowTime - bStart) - Math.abs(nowTime - aStart);
            })[0];

            console.log(`    Found valid rule: ${discountRule.name} (${new Date(discountRule.validFrom).toLocaleDateString()} ~ ${new Date(discountRule.validTo).toLocaleDateString()})`);

            // 이미 상품이 포함되어 있는지 확인
            const productId = product._id.toString();
            const isAlreadyIncluded = discountRule.applicableProducts.some(
              (id: any) => id.toString() === productId
            );

            if (!isAlreadyIncluded) {
              // 상품을 할인 규칙에 추가
              discountRule.applicableProducts.push(product._id);
              await db.updateDiscountRule(discountRule._id.toString(), {
                applicableProducts: discountRule.applicableProducts
              });
              console.log(`    Added to discount rule: ${discountRule.name}`);
            } else {
              console.log(`    Already in discount rule: ${discountRule.name}`);
            }
          } else {
            console.log(`    No valid discount rule found for: ${promotionTag} (현재 날짜 기준)`);
          }
        }

        results.success++;

        // 다음 상품 처리 전 최소 대기
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`Error processing ${product.name}:`, error);
        results.failed++;
        results.errors.push(`${product.name}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    await browser.close();

    console.log('Category update completed:', results);

    return NextResponse.json({
      success: true,
      results,
      message: `성공: ${results.success}, 실패: ${results.failed}, 스킵: ${results.skipped}`
    });
  } catch (error) {
    console.error('Error updating categories:', error);

    if (browser) {
      await browser.close();
    }

    return NextResponse.json(
      {
        error: '카테고리 업데이트 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
