import { NextRequest } from 'next/server';
import puppeteer from 'puppeteer';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';

// API 라우트 타임아웃 설정 (10분)
export const maxDuration = 600;

/**
 * POST /api/admin/update-categories-stream
 * Update product categories with real-time streaming and conflict detection
 * Admin only
 */
export async function POST(request: NextRequest) {
  const { accountAddress, barcodes = [], maxProducts = 10 } = await request.json();

  // 관리자 계정 검증
  if (!isAdmin(accountAddress)) {
    return new Response(JSON.stringify({ error: '관리자 권한이 필요합니다.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Server-Sent Events 스트림 설정
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let browser;

      try {
        send({ type: 'status', message: 'Starting category update...' });

        await db.connect();

        // 업데이트할 상품 찾기
        let productsToUpdate = [];
        if (barcodes.length > 0) {
          for (const barcode of barcodes) {
            const product = await db.findProductByBarcode(barcode);
            if (product && product.detailUrls && product.detailUrls.length > 0) {
              productsToUpdate.push(product);
            }
          }
        } else {
          const allProducts = await db.findProducts(
            { detailUrls: { $exists: true, $ne: null, $not: { $size: 0 } } },
            { limit: maxProducts }
          );
          productsToUpdate = allProducts;
        }

        if (productsToUpdate.length === 0) {
          send({ type: 'complete', message: '업데이트할 상품이 없습니다.' });
          controller.close();
          return;
        }

        send({ type: 'init', total: productsToUpdate.length });
        send({ type: 'status', message: `Found ${productsToUpdate.length} products to update` });

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
          conflicts: 0,
          errors: [] as string[]
        };

        // 각 상품의 모든 상세 페이지 방문
        for (let productIndex = 0; productIndex < productsToUpdate.length; productIndex++) {
          const product = productsToUpdate[productIndex];

          try {
            if (!product.detailUrls || product.detailUrls.length === 0) {
              results.skipped++;
              send({
                type: 'skip',
                productName: product.name,
                index: productIndex,
                total: productsToUpdate.length
              });
              continue;
            }

            send({
              type: 'progress',
              index: productIndex,
              total: productsToUpdate.length,
              product: {
                name: product.name,
                barcode: product.barcode,
                urlCount: product.detailUrls.length
              }
            });

            // 각 URL에서 수집한 데이터
            const urlData: Array<{
              url: string;
              name: string;
              price: number;
              imageUrl: string;
              categoryTags: Array<{ name: string; level: number }>;
              promotionTags: string[];
            }> = [];

            // 각 detailUrl 방문
            for (let urlIndex = 0; urlIndex < product.detailUrls.length; urlIndex++) {
              const detailUrl = product.detailUrls[urlIndex];

              await page.goto(detailUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
              });

              // 폴링 방식으로 페이지 로드 대기
              let categoryLoaded = false;
              let pollAttempts = 0;
              const maxPollAttempts = 20;

              while (pollAttempts < maxPollAttempts && !categoryLoaded) {
                await new Promise(resolve => setTimeout(resolve, 500));

                categoryLoaded = await page.evaluate(() => {
                  const mainCategory = document.querySelector('.prodView .on');
                  return mainCategory !== null;
                });

                if (categoryLoaded) break;
                pollAttempts++;
              }

              // 추가 안정화 대기
              await new Promise(resolve => setTimeout(resolve, 500));

              // 상품 정보 추출
              const pageData = await page.evaluate(() => {
                interface CategoryTagData {
                  name: string;
                  level: number;
                }

                const categoryTags: CategoryTagData[] = [];

                // 메인 카테고리 추출 (level 0)
                const mainCategory = document.querySelector('.prodView .on');
                if (mainCategory) {
                  const name = mainCategory.textContent?.trim() || '';
                  if (name) {
                    categoryTags.push({ name, level: 0 });
                  }
                }

                // 서브 카테고리 추출 (innerHTML 앞 공백으로 레벨 판단)
                const subCategories = document.querySelectorAll('.prodTag li');
                subCategories.forEach(li => {
                  const text = li.textContent?.trim() || '';
                  if (!text) return;

                  // 프로모션 태그 (1+1, 2+1 등)는 건너뛰기
                  if (text.match(/^\d+\+\d+$/)) return;

                  const onclickAttr = li.getAttribute('onclick');
                  if (onclickAttr) {
                    // innerHTML 앞 공백으로 계층 구조 판단
                    const innerHTML = li.innerHTML || '';
                    const leadingSpaces = (innerHTML.match(/^(\s+)/) || [''])[0].length;

                    // 공백 0개 = level 1 (중분류)
                    // 공백 1개 = level 2 (소분류)
                    // 공백 2개 이상 = level 3+ (세분류)
                    const level = leadingSpaces === 0 ? 1 : leadingSpaces + 1;
                    categoryTags.push({ name: text, level });
                  }
                });

                // 상품명
                const nameElem = document.querySelector('.prodView .prodInfo .name');
                const name = nameElem?.textContent?.trim() || '';

                // 가격
                const priceElem = document.querySelector('.prodView .prodInfo .price');
                const priceText = priceElem?.textContent?.trim() || '0';
                const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

                // 이미지
                const imgElem = document.querySelector('.prodView .photo img') as HTMLImageElement;
                let imageUrl = imgElem?.src || '';
                if (imageUrl.startsWith('//')) {
                  imageUrl = 'https:' + imageUrl;
                }

                // 프로모션 태그 추출
                const promotionTags: string[] = [];
                subCategories.forEach(li => {
                  const text = li.textContent?.trim() || '';
                  if (text.match(/^\d+\+\d+$/)) {
                    promotionTags.push(text);
                  }
                });

                return { name, price, imageUrl, categoryTags, promotionTags };
              });

              urlData.push({
                url: detailUrl,
                name: pageData.name,
                price: pageData.price,
                imageUrl: pageData.imageUrl,
                categoryTags: pageData.categoryTags,
                promotionTags: pageData.promotionTags
              });

              // 디버깅: 수집된 카테고리 정보 전송
              send({
                type: 'debug',
                message: `수집된 카테고리: ${pageData.categoryTags.map(t => `${t.name}(L${t.level})`).join(', ')}`
              });

              await new Promise(resolve => setTimeout(resolve, 300));
            }

            // 중복 URL 간 차이 감지
            if (urlData.length > 1) {
              const hasConflict = urlData.some((data, index) => {
                if (index === 0) return false;
                const first = urlData[0];
                return (
                  data.name !== first.name ||
                  data.price !== first.price ||
                  data.imageUrl !== first.imageUrl ||
                  JSON.stringify(data.categoryTags) !== JSON.stringify(first.categoryTags)
                );
              });

              if (hasConflict) {
                // 충돌 발견! 사용자에게 알림
                send({
                  type: 'conflict',
                  data: {
                    productId: product._id.toString(),
                    barcode: product.barcode,
                    currentName: product.name,
                    currentPrice: product.price,
                    currentImageUrl: product.imageUrl,
                    currentCategoryTags: product.categoryTags || [],
                    options: urlData
                  }
                });
                results.conflicts++;
                continue; // 사용자 선택을 기다리므로 자동 업데이트 안 함
              }
            }

            // 충돌 없음: 자동 업데이트
            const categoryTagsMap = new Map<string, { name: string; level: number }>();
            const allPromotionTags = new Set<string>();

            urlData.forEach(data => {
              data.categoryTags.forEach(tag => {
                const existing = categoryTagsMap.get(tag.name);
                // 같은 이름이 이미 있으면, 레벨이 낮은 것(상위 레벨)만 유지
                if (!existing || tag.level < existing.level) {
                  categoryTagsMap.set(tag.name, tag);
                }
              });
              data.promotionTags.forEach(tag => allPromotionTags.add(tag));
            });

            // 카테고리 설정
            if (categoryTagsMap.size > 0) {
              const categoryTagArray = Array.from(categoryTagsMap.values())
                .sort((a, b) => a.level - b.level); // 레벨순으로 정렬

              await db.updateProduct(product._id.toString(), {
                categoryTags: categoryTagArray, // 계층 구조를 포함한 모든 카테고리 태그 저장
                detailUrls: []
              });

              // 프로모션 처리
              for (const promotionTag of Array.from(allPromotionTags)) {
                const now = new Date();
                const discountRules = await db.findDiscountRules({
                  name: { $regex: promotionTag, $options: 'i' },
                  isActive: true,
                  validFrom: { $lte: now },
                  validTo: { $gte: now }
                });

                if (discountRules.length > 0) {
                  const discountRule = discountRules.sort((a: any, b: any) => {
                    const aStart = new Date(a.validFrom).getTime();
                    const bStart = new Date(b.validFrom).getTime();
                    const nowTime = now.getTime();
                    return Math.abs(nowTime - bStart) - Math.abs(nowTime - aStart);
                  })[0];

                  const productId = product._id.toString();
                  const isAlreadyIncluded = discountRule.applicableProducts.some(
                    (id: any) => id.toString() === productId
                  );

                  if (!isAlreadyIncluded) {
                    discountRule.applicableProducts.push(product._id);
                    await db.updateDiscountRule(discountRule._id.toString(), {
                      applicableProducts: discountRule.applicableProducts
                    });
                  }
                }
              }

              results.success++;
              send({
                type: 'success',
                productName: product.name,
                categoryTags: categoryTagArray.map(t => `${t.name}(L${t.level})`).join(' > ')
              });
            } else {
              results.skipped++;
            }

            await new Promise(resolve => setTimeout(resolve, 300));

          } catch (error) {
            results.failed++;
            const errorMsg = `${product.name}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
            results.errors.push(errorMsg);
            send({
              type: 'error',
              error: errorMsg
            });
          }
        }

        await browser.close();

        send({
          type: 'complete',
          results,
          message: `완료: 성공 ${results.success}, 실패 ${results.failed}, 스킵 ${results.skipped}, 충돌 ${results.conflicts}`
        });

        controller.close();

      } catch (error) {
        send({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (browser) {
          await browser.close();
        }

        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
