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
        if (product && product.detailUrl) {
          productsToUpdate.push(product);
        }
      }
    } else {
      // detailUrl이 있는 모든 상품 (최대 maxProducts개)
      const allProducts = await db.findProducts(
        { detailUrl: { $exists: true, $ne: null, $ne: '' } },
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

    // 각 상품의 상세 페이지 방문
    for (const product of productsToUpdate) {
      try {
        if (!product.detailUrl) {
          results.skipped++;
          continue;
        }

        console.log(`Processing: ${product.name} (${product.barcode})`);

        // 상세 페이지 이동
        await page.goto(product.detailUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        // 페이지 로드 대기
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 태그(카테고리) 추출
        const categoryTags = await page.evaluate(() => {
          // 여러 가능한 셀렉터 시도
          const selectors = [
            '.prod_keyward a', // 태그 링크
            '.prod_keyward span',
            '.tag-list a',
            '.tag-list span',
            '.product-tag a',
            '.product-tag span'
          ];

          let tags: string[] = [];

          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              tags = Array.from(elements).map(el => el.textContent?.trim() || '').filter(tag => tag);
              break;
            }
          }

          return tags;
        });

        if (categoryTags.length > 0) {
          // 첫 번째 태그를 카테고리로 사용
          const newCategory = categoryTags[0];

          console.log(`  Found tags: ${categoryTags.join(', ')}`);
          console.log(`  Setting category: ${newCategory}`);

          // 데이터베이스 업데이트
          await db.updateProduct(product._id.toString(), {
            category: newCategory
          });

          results.success++;
        } else {
          console.log(`  No tags found`);
          results.skipped++;
        }

        // 다음 요청 전 대기 (서버 부하 방지)
        await new Promise(resolve => setTimeout(resolve, 1000));

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
