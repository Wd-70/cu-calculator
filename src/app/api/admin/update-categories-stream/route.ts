import { NextRequest } from 'next/server';
import puppeteer from 'puppeteer';
import db from '@/lib/db';
import { isAdmin } from '@/lib/adminAuth';
import connectDB from '@/lib/mongodb';
import Promotion from '@/lib/models/Promotion';
import PromotionIndex from '@/lib/models/PromotionIndex';

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
        await connectDB();

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
            { detailUrls: { $exists: true, $ne: null, $not: { $size: 0 } } } as any,
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
              await new Promise(resolve => setTimeout(resolve, 1000));

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

                // 서브 카테고리 추출 - .prodInfo 영역 내의 태그만 파싱
                const prodInfo = document.querySelector('.prodInfo');
                const subCategories = prodInfo ? prodInfo.querySelectorAll('.prodTag li') : [];

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

                // 상품명 - p.tit 요소에서 추출
                let name = '';
                let foundSelector = '';

                const nameElem = document.querySelector('p.tit');
                if (nameElem) {
                  name = nameElem.textContent?.trim() || '';
                  foundSelector = 'p.tit';
                }

                // 가격 - .prodInfo의 dl에서 dt가 "가격"인 요소의 dd에서 추출
                let price = 0;
                let foundPriceSelector = '';

                if (prodInfo) {
                  const dls = Array.from(prodInfo.querySelectorAll('dl'));
                  for (const dl of dls) {
                    const dt = dl.querySelector('dt')?.textContent?.trim() || '';
                    if (dt === '가격') {
                      const dd = dl.querySelector('dd');
                      if (dd) {
                        const priceText = dd.textContent?.trim() || '';
                        price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
                        foundPriceSelector = 'dl[dt=가격] dd';
                        break;
                      }
                    }
                  }
                }

                // 이미지 - .prodDetail-w 영역의 img 태그에서 추출
                const imgElem = document.querySelector('.prodDetail-w img') as HTMLImageElement;
                let imageUrl = imgElem?.src || '';
                if (imageUrl.startsWith('//')) {
                  imageUrl = 'https:' + imageUrl;
                }

                // 프로모션 태그 추출 - .prodDetail-e와 .prodInfo 영역에서 파싱
                const promotionTags: string[] = [];

                // .prodDetail-e 영역의 프로모션 태그 (주요 프로모션)
                const prodDetailE = document.querySelector('.prodDetail-e');
                if (prodDetailE) {
                  const detailTags = prodDetailE.querySelectorAll('.prodTag li');
                  detailTags.forEach(li => {
                    const text = li.textContent?.trim() || '';
                    if (text.match(/^\d+\+\d+$/)) {
                      promotionTags.push(text);
                    }
                  });
                }

                // .prodInfo 영역의 프로모션 태그 (추가 프로모션)
                subCategories.forEach(li => {
                  const text = li.textContent?.trim() || '';
                  if (text.match(/^\d+\+\d+$/)) {
                    promotionTags.push(text);
                  }
                });

                return {
                  name,
                  price,
                  imageUrl,
                  categoryTags,
                  promotionTags,
                  foundSelector,
                  foundPriceSelector
                };
              });

              urlData.push({
                url: detailUrl,
                name: pageData.name,
                price: pageData.price,
                imageUrl: pageData.imageUrl,
                categoryTags: pageData.categoryTags,
                promotionTags: pageData.promotionTags
              });

              // 디버깅: 수집된 정보 전송
              send({
                type: 'debug',
                message: `URL ${urlIndex + 1}: 상품명="${pageData.name}", 가격=${pageData.price}원, 카테고리: ${pageData.categoryTags.map(t => `${t.name}(L${t.level})`).join(', ')}`
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
                  type: 'debug',
                  message: `충돌 발견! 이미지 URLs: ${urlData.map((d, i) => `옵션${i + 1}: "${d.imageUrl}"`).join(', ')}`
                });

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
              if (allPromotionTags.size > 0) {
                send({
                  type: 'debug',
                  message: `프로모션 태그 발견: ${Array.from(allPromotionTags).join(', ')}`
                });
              }

              for (const promotionTag of Array.from(allPromotionTags)) {
                send({
                  type: 'debug',
                  message: `🎁 프로모션 처리: ${promotionTag}`
                });

                // 프로모션 타입 파싱
                const match = promotionTag.match(/^(\d+)\+(\d+)$/);
                if (!match) {
                  send({
                    type: 'debug',
                    message: `⚠️ 잘못된 프로모션 형식: ${promotionTag}`
                  });
                  continue;
                }

                const buyQuantity = parseInt(match[1]);
                const getQuantity = parseInt(match[2]);
                const now = new Date();

                // 이미 존재하는 프로모션 확인
                const existingPromotions = await Promotion.find({
                  promotionType: promotionTag as any,
                  status: 'active',
                  isActive: true,
                  validFrom: { $lte: now } as any,
                  validTo: { $gte: now } as any,
                  applicableProducts: product.barcode
                } as any);

                if (existingPromotions.length > 0) {
                  send({
                    type: 'debug',
                    message: `ℹ️ 프로모션이 이미 존재함: ${existingPromotions[0].name}`
                  });
                  continue;
                }

                // 비슷한 프로모션 찾기 (기간 동기화용)
                const similarPromotions = await Promotion.find({
                  promotionType: promotionTag as any,
                  status: 'active',
                  isActive: true,
                  isCrawled: true,
                  needsVerification: true,
                  'applicableProducts.0': { $exists: true } as any,
                  validFrom: { $lte: now } as any,
                  validTo: { $gte: now } as any
                } as any).limit(1);

                // 기본 기간: 현재 달의 첫 날부터 마지막 날까지
                let validFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                let validTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

                // 비슷한 프로모션이 있으면 동일한 기간 사용
                if (similarPromotions.length > 0) {
                  validFrom = similarPromotions[0].validFrom;
                  validTo = similarPromotions[0].validTo;
                }

                // 새 프로모션 생성
                const newPromotion = await Promotion.create({
                  name: `${product.name} ${promotionTag}`,
                  description: `${product.name} 상품의 ${promotionTag} 프로모션 (크롤링 자동생성)`,
                  promotionType: promotionTag as any,
                  buyQuantity,
                  getQuantity,
                  applicableType: 'products',
                  applicableProducts: [product.barcode],
                  giftSelectionType: 'same',
                  giftConstraints: {
                    mustBeSameProduct: true
                  },
                  validFrom,
                  validTo,
                  status: 'active',
                  isActive: true,
                  priority: 0,
                  createdBy: 'crawler_bot',
                  lastModifiedBy: 'crawler_bot',
                  modificationHistory: [{
                    modifiedBy: 'crawler_bot',
                    modifiedAt: now,
                    changes: { type: 'crawl' },
                    comment: '크롤링으로 자동 생성'
                  }],
                  verificationStatus: 'unverified',
                  verificationCount: 0,
                  disputeCount: 0,
                  verifiedBy: [],
                  disputedBy: [],
                  isCrawled: true,
                  crawledAt: now,
                  needsVerification: true
                });

                // PromotionIndex 업데이트
                await PromotionIndex.updateOne(
                  { barcode: product.barcode },
                  {
                    $addToSet: { promotionIds: newPromotion._id },
                    $set: { lastUpdated: now }
                  },
                  { upsert: true }
                );

                send({
                  type: 'debug',
                  message: `✅ 프로모션 생성됨: ${newPromotion.name}`
                });
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
