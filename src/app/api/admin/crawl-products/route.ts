import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { isAdmin } from '@/lib/adminAuth';

// API 라우트 타임아웃 설정 (2분)
export const maxDuration = 120;

/**
 * POST /api/admin/crawl-products
 * Crawl products from CU official website
 * Admin only
 */
export async function POST(request: NextRequest) {
  let browser;

  try {
    const { accountAddress, category = '', maxProducts = 50 } = await request.json();

    // 관리자 계정 검증
    if (!isAdmin(accountAddress)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    console.log('Starting CU product crawling...');
    console.log('Max products:', maxProducts);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // User agent 설정
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 전체 상품을 모을 배열
    const allProducts: any[] = [];

    // 카테고리 1~7 순회
    for (let categoryNum = 1; categoryNum <= 7; categoryNum++) {
      if (allProducts.length >= maxProducts) {
        console.log(`목표 상품 수(${maxProducts}개)에 도달했습니다.`);
        break;
      }

      console.log(`\n=== 카테고리 ${categoryNum} 크롤링 시작 ===`);

      const categoryUrl = `https://cu.bgfretail.com/product/product.do?category=product&depth2=4&depth3=${categoryNum}`;

      await page.goto(categoryUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // 폴링 방식으로 초기 상품 로드 대기
      let productCount = 0;
      let pollAttempts = 0;
      const maxInitialPollAttempts = 30; // 최대 6초 (200ms * 30)

      while (pollAttempts < maxInitialPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200));

        productCount = await page.evaluate(() => {
          return document.querySelectorAll('.prod_list').length;
        });

        // 상품이 로드되었으면 즉시 다음으로
        if (productCount > 0) {
          console.log(`카테고리 ${categoryNum} - 초기 상품 로드 완료: ${productCount}개 (${pollAttempts * 200}ms 소요)`);
          break;
        }

        pollAttempts++;
      }

      if (productCount === 0) {
        console.log(`카테고리 ${categoryNum} - 상품 로드 실패, 다음 카테고리로`);
        continue;
      }

      // "더보기" 버튼을 클릭하여 더 많은 상품 로드 (제한 없음)
      let clickAttempts = 0;
      const remainingNeeded = maxProducts - allProducts.length;

      while (true) {
        // 목표 상품 수에 도달하면 중단
        if (productCount >= remainingNeeded + 40) { // 여유분 40개
          console.log(`카테고리 ${categoryNum} - 충분한 상품 로드됨 (${productCount}개), 추출로 이동`);
          break;
        }

        // "더보기" 버튼 찾기 및 클릭
        const clicked = await page.evaluate(() => {
          const moreButton = Array.from(document.querySelectorAll('a')).find(
            a => a.textContent?.trim() === '더보기'
          );

          if (moreButton) {
            const href = moreButton.getAttribute('href');
            if (href && href.startsWith('javascript:')) {
              eval(href.replace('javascript:', ''));
              return true;
            }
          }
          return false;
        });

        if (!clicked) {
          console.log(`카테고리 ${categoryNum} - "더보기" 버튼 없음, 다음 카테고리로`);
          break;
        }

        // AJAX 로딩 대기 (폴링 방식 - 200ms 주기)
        let newProductCount = productCount;
        let pollAttempts = 0;
        const maxPollAttempts = 50; // 최대 10초 (200ms * 50)

        while (pollAttempts < maxPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, 200));

          newProductCount = await page.evaluate(() => {
            return document.querySelectorAll('.prod_list').length;
          });

          // 상품이 로드되었으면 즉시 다음으로
          if (newProductCount > productCount) {
            console.log(`카테고리 ${categoryNum} - 클릭 ${clickAttempts + 1}: ${productCount}개 → ${newProductCount}개 (${pollAttempts * 200}ms 소요)`);
            break;
          }

          pollAttempts++;
        }

        // 폴링이 끝났는데도 상품이 로드되지 않았으면 중단
        if (newProductCount === productCount) {
          console.log(`카테고리 ${categoryNum} - 더 이상 로드되지 않음 (${maxPollAttempts * 200}ms 대기)`);
          break;
        }

        productCount = newProductCount;
        clickAttempts++;
      }

      console.log(`카테고리 ${categoryNum} - 최종 상품 수: ${productCount}개 (총 ${clickAttempts}번 클릭)`);

      // 현재 카테고리의 상품 데이터 추출
      const categoryProducts = await page.evaluate(() => {
        const productElements = document.querySelectorAll('.prod_list');
      const results: Array<{
        name: string;
        price: number;
        imageUrl: string;
        barcode: string;
        detailUrl: string;
      }> = [];

      productElements.forEach((elem, index) => {

        try {
          // 상품명
          const nameElem = elem.querySelector('.name p');
          const name = nameElem?.textContent?.trim() || '';

          // 가격
          const priceElem = elem.querySelector('.price strong');
          const priceText = priceElem?.textContent?.trim() || '0';
          const price = parseInt(priceText.replace(/,/g, ''));

          // 이미지 URL
          const imgElem = elem.querySelector('.prod_img img') as HTMLImageElement;
          let imageUrl = imgElem?.src || '';

          // 상대 경로를 절대 경로로 변환
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          }

          // 바코드 추출 (이미지 URL에서)
          const barcodeMatch = imageUrl.match(/\/(\d{13})\./);
          const barcode = barcodeMatch ? barcodeMatch[1] : '';

          // 상세 페이지 URL 추출 (onclick="view(25489);" 형식)
          let detailUrl = '';

          // prod_img div의 onclick 속성에서 추출
          const imgDiv = elem.querySelector('.prod_img[onclick]');
          if (imgDiv) {
            const onclick = imgDiv.getAttribute('onclick') || '';
            const viewMatch = onclick.match(/view\((\d+)\)/);
            if (viewMatch) {
              const productId = viewMatch[1];
              detailUrl = `https://cu.bgfretail.com/product/view.do?category=product&gdIdx=${productId}`;
            }
          }

          // 또는 name div의 onclick 속성에서 추출
          if (!detailUrl) {
            const nameDiv = elem.querySelector('.name[onclick]');
            if (nameDiv) {
              const onclick = nameDiv.getAttribute('onclick') || '';
              const viewMatch = onclick.match(/view\((\d+)\)/);
              if (viewMatch) {
                const productId = viewMatch[1];
                detailUrl = `https://cu.bgfretail.com/product/view.do?category=product&gdIdx=${productId}`;
              }
            }
          }

          // 프로모션 정보 추출 (1+1, 2+1)
          let promotion = '';
          const badge = elem.querySelector('.badge');
          if (badge) {
            if (badge.querySelector('.plus1')) {
              promotion = '1+1';
            } else if (badge.querySelector('.plus2')) {
              promotion = '2+1';
            }
          }

          if (name && price > 0 && barcode) {
            results.push({
              name: name.trim(), // 원본 이름 유지
              price,
              imageUrl,
              barcode,
              detailUrl,
              promotion
            });
          }
        } catch (error) {
          console.error('Error parsing product:', error);
        }
      });

        return results;
      });

      // 현재 카테고리 상품을 전체 배열에 추가 (중복 체크 및 detailUrl 병합)
      const barcodeToIndexMap = new Map<string, number>();
      allProducts.forEach((p, index) => {
        barcodeToIndexMap.set(p.barcode, index);
      });

      let addedCount = 0;
      let duplicateCount = 0;

      for (const product of categoryProducts) {
        const existingIndex = barcodeToIndexMap.get(product.barcode);

        if (existingIndex === undefined) {
          // 새 상품 추가
          allProducts.push(product);
          barcodeToIndexMap.set(product.barcode, allProducts.length - 1);
          addedCount++;
        } else {
          // 중복 상품: detailUrl만 추가
          const existingProduct = allProducts[existingIndex];
          if (product.detailUrl && !existingProduct.detailUrl.includes(product.detailUrl)) {
            // detailUrl이 배열이 아니면 배열로 변환
            if (typeof existingProduct.detailUrl === 'string') {
              existingProduct.detailUrl = [existingProduct.detailUrl];
            }
            if (!Array.isArray(existingProduct.detailUrl)) {
              existingProduct.detailUrl = [];
            }
            existingProduct.detailUrl.push(product.detailUrl);
          }
          duplicateCount++;
        }
      }

      console.log(`카테고리 ${categoryNum} - ${categoryProducts.length}개 추출, ${addedCount}개 추가, ${duplicateCount}개 중복 (detailUrl 병합), 총 ${allProducts.length}개`);
    }

    await browser.close();

    // 최종 처리: detailUrl을 detailUrls 배열로 정리
    const uniqueProducts = allProducts.map(product => {
      // detailUrl이 문자열이면 배열로 변환
      let detailUrls: string[] = [];

      if (Array.isArray(product.detailUrl)) {
        detailUrls = product.detailUrl;
      } else if (typeof product.detailUrl === 'string' && product.detailUrl) {
        detailUrls = [product.detailUrl];
      }

      // 중복 제거
      detailUrls = [...new Set(detailUrls)];

      // detailUrl 필드 제거하고 detailUrls만 사용
      const { detailUrl, ...productWithoutDetailUrl } = product;

      return {
        ...productWithoutDetailUrl,
        detailUrls
      };
    }).slice(0, maxProducts);

    // 디버깅: detailUrls가 2개 이상인 상품 찾기
    const multiUrlProducts = uniqueProducts.filter(p => p.detailUrls && p.detailUrls.length > 1);

    console.log(`\n크롤링 완료: ${uniqueProducts.length}개`);

    if (multiUrlProducts.length > 0) {
      console.log(`\n여러 detailUrl을 가진 상품 ${multiUrlProducts.length}개 발견:\n`);
      multiUrlProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name} (바코드: ${product.barcode})`);
        console.log(`   - 가격: ${product.price}원`);
        console.log(`   - 프로모션: ${product.promotion || '없음'}`);
        console.log(`   - detailUrls (${product.detailUrls.length}개):`);
        product.detailUrls.forEach((url: string, urlIndex: number) => {
          console.log(`     [${urlIndex + 1}] ${url}`);
        });
        console.log('');
      });
    } else {
      console.log('\n모든 상품이 고유한 detailUrl을 가지고 있습니다.');
    }

    // 샘플 상품 출력 (디버깅용)
    if (uniqueProducts.length > 0) {
      console.log('\n샘플 상품 (첫 번째):');
      console.log(JSON.stringify(uniqueProducts[0], null, 2));
    }

    return NextResponse.json({
      success: true,
      products: uniqueProducts,
      total: uniqueProducts.length,
      message: `${uniqueProducts.length}개의 상품 정보를 수집했습니다.`
    });
  } catch (error) {
    console.error('Error crawling products:', error);

    if (browser) {
      await browser.close();
    }

    return NextResponse.json(
      {
        error: '상품 크롤링 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
