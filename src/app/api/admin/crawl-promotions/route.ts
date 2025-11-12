import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { isAdmin } from '@/lib/adminAuth';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';

// API 라우트 타임아웃 설정 (2분)
export const maxDuration = 120;

interface ProgressMessage {
  type: 'progress' | 'complete' | 'error';
  message?: string;
  tabProgress?: {
    current: number;
    total: number;
  };
  pageProgress?: {
    current: number;
    total: number;
  };
  productCount?: number;
  promotionCount?: number;
  products?: any[];
  promotions?: any[];
  total?: number;
  error?: string;
}

/**
 * POST /api/admin/crawl-promotions
 * Crawl promotion products from CU event page (1+1, 2+1)
 * Admin only
 */
export async function POST(request: NextRequest) {
  const { accountAddress, pagesPerTab = 5 } = await request.json();

  // 관리자 계정 검증
  if (!isAdmin(accountAddress)) {
    return NextResponse.json(
      { error: '관리자 권한이 필요합니다.' },
      { status: 403 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let browser;

      const sendMessage = (msg: ProgressMessage) => {
        const text = JSON.stringify(msg) + '\n';
        controller.enqueue(encoder.encode(text));
      };

      try {
        sendMessage({
          type: 'progress',
          message: '브라우저 시작 중...'
        });

        console.log('Starting CU promotion product crawling...');
        console.log('Pages per tab:', pagesPerTab);

        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // User agent 설정
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 전체 상품을 모을 배열
        const allProducts: any[] = [];
        const promotionData: { [key: string]: { type: string; barcodes: string[] } } = {
          '1+1': { type: '1+1', barcodes: [] },
          '2+1': { type: '2+1', barcodes: [] }
        };

        // 1+1, 2+1 탭 순회
        const tabs = [
          { name: '1+1', searchCondition: '23' },
          { name: '2+1', searchCondition: '24' }
        ];

        sendMessage({
          type: 'progress',
          message: '프로모션 탭 크롤링 시작...',
          tabProgress: { current: 0, total: tabs.length }
        });

        for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
          const tab = tabs[tabIndex];
          console.log(`\n=== ${tab.name} 탭 크롤링 시작 (최대 ${pagesPerTab}페이지) ===`);

          sendMessage({
            type: 'progress',
            message: `${tab.name} 탭 크롤링 중...`,
            tabProgress: { current: tabIndex + 1, total: tabs.length },
            productCount: allProducts.length
          });

          // 행사 페이지로 이동
          const eventUrl = `https://cu.bgfretail.com/event/plus.do?category=event&depth2=1&sf=N`;

          await page.goto(eventUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          });

          // searchCondition 설정하여 탭 전환
          await page.evaluate((condition) => {
            const searchConditionInput = document.getElementById('searchCondition') as HTMLInputElement;
            if (searchConditionInput) {
              searchConditionInput.value = condition;
            }
            // goDepth 함수 호출
            if (typeof (window as any).goDepth === 'function') {
              (window as any).goDepth(condition);
            }
          }, tab.searchCondition);

          // 초기 상품 로드 대기
          let productCount = 0;
          let pollAttempts = 0;
          const maxInitialPollAttempts = 30;

          while (pollAttempts < maxInitialPollAttempts) {
            await new Promise(resolve => setTimeout(resolve, 200));

            productCount = await page.evaluate(() => {
              return document.querySelectorAll('.prod_list').length;
            });

            if (productCount > 0) {
              console.log(`${tab.name} - 초기 상품 로드 완료: ${productCount}개 (${pollAttempts * 200}ms 소요)`);
              break;
            }

            pollAttempts++;
          }

          if (productCount === 0) {
            console.log(`${tab.name} - 상품 로드 실패, 다음 탭으로`);
            continue;
          }

          // "더보기" 버튼을 클릭하여 더 많은 상품 로드
          let clickAttempts = 0;

          while (clickAttempts < pagesPerTab) {
            sendMessage({
              type: 'progress',
              message: `${tab.name} 탭 - 페이지 ${clickAttempts + 1}/${pagesPerTab} 로드 중...`,
              tabProgress: { current: tabIndex + 1, total: tabs.length },
              pageProgress: { current: clickAttempts + 1, total: pagesPerTab },
              productCount: allProducts.length
            });

            // "더보기" 버튼 찾기 및 클릭
            const clicked = await page.evaluate(() => {
              const moreButton = document.querySelector('.prodListBtn-w a') as HTMLAnchorElement;
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
              console.log(`${tab.name} - "더보기" 버튼 없음, 다음 탭으로`);
              sendMessage({
                type: 'progress',
                message: `${tab.name} 탭 - 더 이상 페이지 없음`,
                tabProgress: { current: tabIndex + 1, total: tabs.length },
                productCount: allProducts.length
              });
              break;
            }

            // AJAX 로딩 대기
            let newProductCount = productCount;
            let pollAttempts = 0;
            const maxPollAttempts = 50;

            while (pollAttempts < maxPollAttempts) {
              await new Promise(resolve => setTimeout(resolve, 200));

              newProductCount = await page.evaluate(() => {
                return document.querySelectorAll('.prod_list').length;
              });

              if (newProductCount > productCount) {
                console.log(`${tab.name} - 클릭 ${clickAttempts + 1}: ${productCount}개 → ${newProductCount}개 (${pollAttempts * 200}ms 소요)`);
                break;
              }

              pollAttempts++;
            }

            if (newProductCount === productCount) {
              console.log(`${tab.name} - 더 이상 로드되지 않음 (${maxPollAttempts * 200}ms 대기)`);
              break;
            }

            productCount = newProductCount;
            clickAttempts++;
          }

          console.log(`${tab.name} - 최종 상품 수: ${productCount}개 (총 ${clickAttempts}번 클릭)`);

          sendMessage({
            type: 'progress',
            message: `${tab.name} 탭 - 상품 데이터 추출 중...`,
            tabProgress: { current: tabIndex + 1, total: tabs.length },
            productCount: allProducts.length
          });

          // 현재 탭의 상품 데이터 추출
          const tabProducts = await page.evaluate(() => {
            const productElements = document.querySelectorAll('.prod_list');
            const results: Array<{
              name: string;
              price: number;
              imageUrl: string;
              barcode: string;
              detailUrl: string;
              promotion: string;
            }> = [];

            productElements.forEach((elem) => {
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

                if (imageUrl.startsWith('//')) {
                  imageUrl = 'https:' + imageUrl;
                }

                // 바코드 추출
                const barcodeMatch = imageUrl.match(/\/(\d{13})\./);
                const barcode = barcodeMatch ? barcodeMatch[1] : '';

                // 상세 페이지 URL 추출
                let detailUrl = '';
                const prodItem = elem.querySelector('.prod_item') as HTMLAnchorElement;
                if (prodItem) {
                  const href = prodItem.getAttribute('href') || '';
                  const viewMatch = href.match(/view\((\d+)\)/);
                  if (viewMatch) {
                    const productId = viewMatch[1];
                    detailUrl = `https://cu.bgfretail.com/event/eventDetail.do?category=event&gdIdx=${productId}`;
                  }
                }

                // 프로모션 정보 추출
                let promotion = '';
                const badge = elem.querySelector('.badge');
                if (badge) {
                  if (badge.querySelector('.plus1')) {
                    promotion = '1+1';
                  } else if (badge.querySelector('.plus2')) {
                    promotion = '2+1';
                  }
                }

                if (name && price > 0 && barcode && promotion) {
                  results.push({
                    name: name.trim(),
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

          // 현재 탭 상품을 전체 배열에 추가 (중복 체크)
          const barcodeToIndexMap = new Map<string, number>();
          allProducts.forEach((p, index) => {
            barcodeToIndexMap.set(p.barcode, index);
          });

          let addedCount = 0;
          let duplicateCount = 0;

          for (const product of tabProducts) {
            const existingIndex = barcodeToIndexMap.get(product.barcode);

            if (existingIndex === undefined) {
              // 새 상품 추가
              allProducts.push(product);
              barcodeToIndexMap.set(product.barcode, allProducts.length - 1);
              promotionData[product.promotion].barcodes.push(product.barcode);
              addedCount++;
            } else {
              duplicateCount++;
            }
          }

          console.log(`${tab.name} - ${tabProducts.length}개 추출, ${addedCount}개 추가, ${duplicateCount}개 중복, 총 ${allProducts.length}개`);

          sendMessage({
            type: 'progress',
            message: `${tab.name} 탭 완료 - ${addedCount}개 추가, 총 ${allProducts.length}개`,
            tabProgress: { current: tabIndex + 1, total: tabs.length },
            productCount: allProducts.length
          });
        }

        await browser.close();

        sendMessage({
          type: 'progress',
          message: '상품 및 프로모션 데이터 저장 중...'
        });

        // MongoDB 연결
        await connectDB();

        // 현재 달 계산
        const now = new Date();
        const validFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        const validTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // 상품 등록 및 프로모션 생성
        let newProductCount = 0;
        let existingProductCount = 0;
        const createdPromotions: any[] = [];

        // 1. 상품 등록
        for (const product of allProducts) {
          const existingProduct = await Product.findOne({ barcode: product.barcode });

          if (!existingProduct) {
            await Product.create({
              barcode: product.barcode,
              name: product.name,
              price: product.price,
              brand: 'CU',
              imageUrl: product.imageUrl,
              detailUrls: product.detailUrl ? [product.detailUrl] : [],
              createdBy: accountAddress,
              modificationCount: 0,
              isVerified: false,
              verificationCount: 0,
              reportCount: 0,
            });
            newProductCount++;
          } else {
            existingProductCount++;
          }
        }

        // 2. 프로모션 생성 또는 업데이트 (중복 방지)
        for (const [promotionType, data] of Object.entries(promotionData)) {
          if (data.barcodes.length === 0) continue;

          const [buy, get] = promotionType.split('+').map(Number);

          // 프로모션 이름 생성: YYMM동일상품[프로모션타입]
          // 예: 2511동일상품1+1, 2512동일상품2+1
          const year = now.getFullYear().toString().slice(2); // 25
          const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 11
          const promotionName = `${year}${month}동일상품${promotionType}`;

          // 같은 이름의 프로모션이 있는지 확인 (같은 달, 같은 타입)
          const existingPromotion = await Promotion.findOne({
            name: promotionName,
            isCrawled: true,
          });

          let promotion;

          if (existingPromotion) {
            // 기존 프로모션이 있으면 상품만 추가
            console.log(`기존 프로모션 발견: ${existingPromotion.name}, 상품 ${data.barcodes.length}개 추가`);

            // 기존 상품과 새 상품을 합쳐서 중복 제거
            const existingBarcodes = new Set(existingPromotion.applicableProducts || []);
            let addedCount = 0;

            for (const barcode of data.barcodes) {
              if (!existingBarcodes.has(barcode)) {
                addedCount++;
              }
              existingBarcodes.add(barcode);
            }

            // 상품 목록 업데이트
            await Promotion.updateOne(
              { _id: existingPromotion._id },
              {
                $addToSet: { applicableProducts: { $each: data.barcodes } },
                $set: {
                  lastModifiedBy: accountAddress,
                  crawledAt: new Date()
                }
              }
            );

            promotion = await Promotion.findById(existingPromotion._id);
            console.log(`프로모션 업데이트 완료: ${addedCount}개 신규 상품 추가, 총 ${existingBarcodes.size}개 상품`);
          } else {
            // 새 프로모션 생성
            console.log(`새 프로모션 생성: ${promotionName}`);

            promotion = await Promotion.create({
              name: promotionName,
              description: `CU ${promotionType} 동일상품 행사 (크롤링 자동생성)`,
              promotionType: promotionType,
              buyQuantity: buy,
              getQuantity: get,
              applicableType: 'products',
              applicableProducts: data.barcodes,
              giftSelectionType: 'same', // 동일 상품 증정
              giftProducts: [],
              giftConstraints: {},
              validFrom,
              validTo,
              status: 'active',
              isActive: true,
              priority: 0,
              createdBy: 'crawler_bot',
              lastModifiedBy: 'crawler_bot',
              verificationStatus: 'unverified',
              verificationCount: 0,
              disputeCount: 0,
              verifiedBy: [],
              disputedBy: [],
              modificationHistory: [{
                modifiedBy: 'crawler_bot',
                modifiedAt: new Date(),
                changes: { type: 'crawl' },
                comment: '크롤링으로 자동 생성'
              }],
              crawledAt: new Date(),
              isCrawled: true,
              needsVerification: true
            });
          }

          if (promotion) {
            createdPromotions.push(promotion);

            // PromotionIndex 업데이트
            for (const barcode of data.barcodes) {
              await PromotionIndex.updateOne(
                { barcode },
                {
                  $addToSet: { promotionIds: promotion._id.toString() },
                  $set: { lastUpdated: new Date() }
                },
                { upsert: true }
              );
            }
          }
        }

        console.log(`\n크롤링 완료: 총 ${allProducts.length}개 상품`);
        console.log(`새 상품: ${newProductCount}개, 기존 상품: ${existingProductCount}개`);
        console.log(`프로모션 처리: ${createdPromotions.length}개 (신규 생성 또는 업데이트)`);

        // 최종 완료 메시지 전송
        sendMessage({
          type: 'complete',
          message: `크롤링 완료! ${allProducts.length}개 상품, ${newProductCount}개 신규 등록, ${createdPromotions.length}개 프로모션 처리 (중복 시 상품 추가)`,
          products: allProducts,
          promotions: createdPromotions,
          total: allProducts.length,
          productCount: allProducts.length,
          promotionCount: createdPromotions.length
        });

        controller.close();
      } catch (error) {
        console.error('Error crawling promotions:', error);

        if (browser) {
          await browser.close();
        }

        sendMessage({
          type: 'error',
          message: '프로모션 크롤링 중 오류가 발생했습니다.',
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
