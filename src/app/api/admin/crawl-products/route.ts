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
    console.log('Category:', category || '전체');
    console.log('Max products:', maxProducts);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // User agent 설정
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // CU 상품 페이지 URL
    const baseUrl = 'https://cu.bgfretail.com/product/product.do?category=product&sf=N';

    await page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000 // 60초로 증가
    });

    // 페이지 로드 대기 (setTimeout 사용)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 스크롤하여 더 많은 상품 로드
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = Math.ceil(maxProducts / 40); // 40개씩 로드되므로

    while (scrollAttempts < maxScrollAttempts) {
      // 페이지 끝까지 스크롤
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // 스크롤 후 대기
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 페이지 높이 확인
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);

      // 더 이상 로드되지 않으면 중단
      if (currentHeight === previousHeight) {
        break;
      }

      previousHeight = currentHeight;
      scrollAttempts++;
    }

    console.log(`Scrolled ${scrollAttempts} times`);

    // 상품 데이터 추출
    const products = await page.evaluate((maxCount) => {
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
        if (results.length >= maxCount) return;

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

          // 상세 페이지 URL 추출
          const linkElem = elem.querySelector('a[href*="prodId"]');
          let detailUrl = '';
          if (linkElem) {
            const href = linkElem.getAttribute('href') || '';
            if (href.startsWith('http')) {
              detailUrl = href;
            } else if (href.startsWith('/')) {
              detailUrl = 'https://cu.bgfretail.com' + href;
            } else if (href.startsWith('javascript:')) {
              // onclick 이벤트에서 prodId 추출
              const onclick = linkElem.getAttribute('onclick') || '';
              const prodIdMatch = onclick.match(/prodId['"]\s*[:,]\s*['"](\d+)['"]/);
              if (prodIdMatch) {
                detailUrl = `https://cu.bgfretail.com/product/product.do?category=product&gdIdx=${prodIdMatch[1]}`;
              }
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
              detailUrl
            });
          }
        } catch (error) {
          console.error('Error parsing product:', error);
        }
      });

      return results;
    }, maxProducts);

    await browser.close();

    console.log(`Crawled ${products.length} products`);

    return NextResponse.json({
      success: true,
      products,
      total: products.length,
      message: `${products.length}개의 상품 정보를 수집했습니다.`
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
