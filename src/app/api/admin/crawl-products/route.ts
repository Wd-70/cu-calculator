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
        waitUntil: 'networkidle0', // 네트워크가 완전히 idle 될 때까지 대기
        timeout: 60000
      });

      // 페이지 로드 대기
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 초기 상품 개수 확인
      let productCount = await page.evaluate(() => {
        return document.querySelectorAll('.prod_list').length;
      });
      console.log(`카테고리 ${categoryNum} - 초기 상품: ${productCount}개`);

      // "더보기" 버튼을 클릭하여 더 많은 상품 로드
      let clickAttempts = 0;
      const maxClickAttempts = 10; // 카테고리당 최대 10번 클릭
      const remainingNeeded = maxProducts - allProducts.length;

      while (clickAttempts < maxClickAttempts) {
        // 현재 페이지에 로드된 상품이 필요한 개수를 초과하면 중단
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

        // AJAX 로딩 대기 (폴링 방식)
        let newProductCount = productCount;
        let pollAttempts = 0;
        const maxPollAttempts = 20; // 최대 10초 (500ms * 20)

        while (pollAttempts < maxPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));

          newProductCount = await page.evaluate(() => {
            return document.querySelectorAll('.prod_list').length;
          });

          // 상품이 로드되었으면 즉시 다음으로
          if (newProductCount > productCount) {
            console.log(`카테고리 ${categoryNum} - 클릭 ${clickAttempts + 1}: ${productCount}개 → ${newProductCount}개 (${pollAttempts * 500}ms 소요)`);
            break;
          }

          pollAttempts++;
        }

        // 폴링이 끝났는데도 상품이 로드되지 않았으면 중단
        if (newProductCount === productCount) {
          console.log(`카테고리 ${categoryNum} - 더 이상 로드되지 않음 (${maxPollAttempts * 500}ms 대기)`);
          break;
        }

        productCount = newProductCount;
        clickAttempts++;
      }

      console.log(`카테고리 ${categoryNum} - 최종 상품 수: ${productCount}개`);

      // 현재 카테고리의 상품 데이터 추출
      const categoryProducts = await page.evaluate(() => {
        const productElements = document.querySelectorAll('.prod_list');
      const results: Array<{
        name: string;
        price: number;
        imageUrl: string;
        barcode: string;
        category: string;
        detailUrl: string;
      }> = [];

      // 카테고리 매핑 함수
      const getCategoryFromPrefix = (name: string): string => {
        // CU 상품명 접두사 패턴
        if (name.startsWith('도)')) {
          return '도시락/김밥';
        } else if (name.startsWith('김)')) {
          return '도시락/김밥';
        } else if (name.startsWith('주)')) {
          return '삼각김밥';
        } else if (name.startsWith('햄)')) {
          return '샌드위치/햄버거';
        } else if (name.startsWith('샌)')) {
          return '샌드위치/햄버거';
        } else if (name.startsWith('샐)')) {
          return '샐러드';
        } else if (name.startsWith('면)')) {
          return '식품';
        } else if (name.startsWith('핫)')) {
          return '식품';
        } else if (name.includes('음료') || name.includes('커피') || name.includes('주스')) {
          return '음료';
        } else if (name.includes('과자') || name.includes('스낵')) {
          return '과자';
        } else if (name.includes('아이스') || name.includes('빙과')) {
          return '아이스크림';
        } else {
          return '식품';
        }
      };

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

          // 카테고리 결정 (일단 임시로, 나중에 상세페이지에서 업데이트)
          const category = getCategoryFromPrefix(name);

          if (name && price > 0 && barcode) {
            results.push({
              name: name.replace(/^[가-힣]\)/, '').trim(), // 접두사 제거
              price,
              imageUrl,
              barcode,
              category,
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

      // 현재 카테고리 상품을 전체 배열에 추가
      allProducts.push(...categoryProducts);
      console.log(`카테고리 ${categoryNum} - ${categoryProducts.length}개 추출, 총 ${allProducts.length}개`);
    }

    await browser.close();

    // 중복 제거 (바코드 기준)
    const uniqueProducts = Array.from(
      new Map(allProducts.map(p => [p.barcode, p])).values()
    ).slice(0, maxProducts);

    console.log(`\n크롤링 완료: ${uniqueProducts.length}개 (중복 제거 후)`);

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
