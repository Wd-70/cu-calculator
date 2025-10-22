'use client';

import { useState, useEffect } from 'react';
import { IPromotion } from '@/lib/models/Promotion';

interface Product {
  _id: string;
  barcode: string;
  name: string;
  price?: number;
  category?: string;
  brand?: string;
  imageUrl?: string;
}

interface PromotionMergeModalProps {
  sourcePromotion: IPromotion;
  isOpen: boolean;
  onClose: () => void;
  onMerge: (targetPromotionIds: string[], newProducts: string[], giftProducts?: string[]) => Promise<void>;
  userAddress: string | null;
}

export default function PromotionMergeModal({
  sourcePromotion,
  isOpen,
  onClose,
  onMerge,
  userAddress,
}: PromotionMergeModalProps) {
  const [activeTab, setActiveTab] = useState<'promotions' | 'products' | 'barcodes' | 'gift'>('promotions');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IPromotion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPromotions, setSelectedPromotions] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [newProducts, setNewProducts] = useState<string>('');
  const [giftProducts, setGiftProducts] = useState<string>('');
  const [selectedGiftProducts, setSelectedGiftProducts] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  // 프로모션 검색 (디바운싱)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/promotions?name=${encodeURIComponent(searchQuery)}&limit=20`);
        const data = await response.json();

        if (data.success) {
          // 자기 자신 제외
          const filtered = data.promotions.filter(
            (p: IPromotion) => p._id.toString() !== sourcePromotion._id.toString()
          );
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error('Error searching promotions:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, sourcePromotion._id]);

  // 상품 검색 (디바운싱)
  useEffect(() => {
    if (!productSearchQuery.trim()) {
      setProductSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const response = await fetch(`/api/products?name=${encodeURIComponent(productSearchQuery)}&limit=20`);
        const data = await response.json();

        if (data.success) {
          setProductSearchResults(data.data || []);
        }
      } catch (error) {
        console.error('Error searching products:', error);
      } finally {
        setSearchingProducts(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearchQuery]);

  const togglePromotion = (id: string) => {
    setSelectedPromotions(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleProduct = (barcode: string) => {
    setSelectedProducts(prev =>
      prev.includes(barcode) ? prev.filter(x => x !== barcode) : [...prev, barcode]
    );
  };

  const toggleGiftProduct = (barcode: string) => {
    setSelectedGiftProducts(prev =>
      prev.includes(barcode) ? prev.filter(x => x !== barcode) : [...prev, barcode]
    );
  };

  const handleMerge = async () => {
    if (!userAddress) {
      alert('계정을 먼저 생성해주세요.');
      return;
    }

    // 구매 상품 바코드 수집
    const directBarcodes = newProducts
      .split(/[\n,]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const allBuyProducts = [...selectedProducts, ...directBarcodes];

    // 증정 상품 바코드 수집
    const directGiftBarcodes = giftProducts
      .split(/[\n,]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const allGiftProducts = [...selectedGiftProducts, ...directGiftBarcodes];

    if (selectedPromotions.length === 0 && allBuyProducts.length === 0 && allGiftProducts.length === 0) {
      alert('병합할 프로모션을 선택하거나 추가할 상품을 입력해주세요.');
      return;
    }

    setMerging(true);
    try {
      await onMerge(selectedPromotions, allBuyProducts, allGiftProducts.length > 0 ? allGiftProducts : undefined);
      onClose();
    } catch (error) {
      console.error('Merge error:', error);
      alert('병합 중 오류가 발생했습니다.');
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">프로모션 병합</h2>
              <p className="text-orange-100 text-sm">
                &quot;{sourcePromotion.name}&quot;에 다른 프로모션이나 상품을 추가합니다
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="border-b border-gray-200">
          <div className="flex gap-1 p-4">
            <button
              onClick={() => setActiveTab('promotions')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'promotions'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🎁 프로모션
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'products'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🛒 구매 상품
            </button>
            <button
              onClick={() => setActiveTab('barcodes')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'barcodes'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📝 바코드 입력
            </button>
            <button
              onClick={() => setActiveTab('gift')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'gift'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🎉 증정 상품
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 프로모션 검색 탭 */}
          {activeTab === 'promotions' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">기존 프로모션 추가</h3>
              <input
                type="text"
                placeholder="프로모션 이름으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />

              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {searching ? (
                  <div className="text-center py-4 text-gray-500">검색 중...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((promo) => (
                    <label
                      key={promo._id.toString()}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPromotions.includes(promo._id.toString())}
                        onChange={() => togglePromotion(promo._id.toString())}
                        className="w-5 h-5 mt-0.5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{promo.name}</p>
                        <p className="text-sm text-gray-500">{promo.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          상품 {promo.applicableProducts?.length || 0}개 포함
                        </p>
                      </div>
                    </label>
                  ))
                ) : searchQuery ? (
                  <div className="text-center py-4 text-gray-500">검색 결과가 없습니다.</div>
                ) : null}
              </div>

              {selectedPromotions.length > 0 && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>{selectedPromotions.length}개</strong> 프로모션 선택됨
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 상품 검색 탭 */}
          {activeTab === 'products' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">구매 상품 검색 및 추가</h3>
              <p className="text-sm text-gray-600 mb-3">
                프로모션 적용 대상 상품을 검색해서 추가합니다
              </p>
              <input
                type="text"
                placeholder="상품 이름으로 검색..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />

              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {searchingProducts ? (
                  <div className="text-center py-4 text-gray-500">검색 중...</div>
                ) : productSearchResults.length > 0 ? (
                  productSearchResults.map((product) => (
                    <label
                      key={product.barcode}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.barcode)}
                        onChange={() => toggleProduct(product.barcode)}
                        className="w-5 h-5 mt-0.5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">바코드: {product.barcode}</p>
                        {product.price && (
                          <p className="text-sm text-green-600 font-medium mt-1">
                            {product.price.toLocaleString()}원
                          </p>
                        )}
                      </div>
                    </label>
                  ))
                ) : productSearchQuery ? (
                  <div className="text-center py-4 text-gray-500">검색 결과가 없습니다.</div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>상품명을 검색해보세요</p>
                  </div>
                )}
              </div>

              {selectedProducts.length > 0 && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>{selectedProducts.length}개</strong> 상품 선택됨
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 바코드 직접 입력 탭 */}
          {activeTab === 'barcodes' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">구매 상품 바코드 직접 추가</h3>
              <textarea
                placeholder="바코드를 입력하세요 (한 줄에 하나씩 또는 쉼표로 구분)&#10;예:&#10;8801234567890&#10;8809876543210"
                value={newProducts}
                onChange={(e) => setNewProducts(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                rows={10}
              />
              <p className="mt-2 text-sm text-gray-500">
                여러 바코드를 입력할 때는 줄바꿈 또는 쉼표로 구분하세요
              </p>
            </div>
          )}

          {/* 증정 상품 탭 */}
          {activeTab === 'gift' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">증정 상품 그룹 추가 (교차 증정)</h3>
              <p className="text-sm text-gray-600 mb-3">
                구매 상품과 다른 상품을 증정하는 경우 여기에 증정 상품을 추가하세요
              </p>

              {/* 상품 검색 */}
              <input
                type="text"
                placeholder="증정 상품 이름으로 검색..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
              />

              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {searchingProducts ? (
                  <div className="text-center py-4 text-gray-500">검색 중...</div>
                ) : productSearchResults.length > 0 ? (
                  productSearchResults.map((product) => (
                    <label
                      key={product.barcode}
                      className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGiftProducts.includes(product.barcode)}
                        onChange={() => toggleGiftProduct(product.barcode)}
                        className="w-5 h-5 mt-0.5 text-purple-500 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">바코드: {product.barcode}</p>
                        {product.price && (
                          <p className="text-sm text-green-600 font-medium mt-1">
                            {product.price.toLocaleString()}원
                          </p>
                        )}
                      </div>
                    </label>
                  ))
                ) : productSearchQuery ? (
                  <div className="text-center py-4 text-gray-500">검색 결과가 없습니다.</div>
                ) : null}
              </div>

              {selectedGiftProducts.length > 0 && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800">
                    <strong>{selectedGiftProducts.length}개</strong> 증정 상품 선택됨
                  </p>
                </div>
              )}

              {/* 바코드 직접 입력 */}
              <div className="border-t border-gray-300 pt-4">
                <h4 className="font-semibold text-gray-900 mb-2">또는 바코드 직접 입력</h4>
                <textarea
                  placeholder="증정 상품 바코드를 입력하세요 (한 줄에 하나씩 또는 쉼표로 구분)"
                  value={giftProducts}
                  onChange={(e) => setGiftProducts(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={5}
                />
              </div>
            </div>
          )}

          {/* 현재 포함된 상품 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">현재 포함된 상품</h4>
            <p className="text-sm text-blue-700">
              {sourcePromotion.applicableProducts?.length || 0}개의 상품 바코드
            </p>
            {sourcePromotion.applicableProducts && sourcePromotion.applicableProducts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {sourcePromotion.applicableProducts.slice(0, 5).map((barcode, idx) => (
                  <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {barcode}
                  </span>
                ))}
                {sourcePromotion.applicableProducts.length > 5 && (
                  <span className="text-xs text-blue-600">
                    +{sourcePromotion.applicableProducts.length - 5}개 더
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 p-6">
          {/* 요약 정보 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">병합 요약</h4>
            <div className="space-y-1 text-sm">
              {selectedPromotions.length > 0 && (
                <p className="text-gray-700">
                  • 프로모션 <strong>{selectedPromotions.length}개</strong> 병합
                </p>
              )}
              {(selectedProducts.length > 0 || newProducts.trim().length > 0) && (
                <p className="text-gray-700">
                  • 구매 상품 <strong>{selectedProducts.length + newProducts.split(/[\n,]/).filter(p => p.trim()).length}개</strong> 추가
                </p>
              )}
              {(selectedGiftProducts.length > 0 || giftProducts.trim().length > 0) && (
                <p className="text-purple-700">
                  • 증정 상품 <strong>{selectedGiftProducts.length + giftProducts.split(/[\n,]/).filter(p => p.trim()).length}개</strong> 추가 (교차 증정)
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleMerge}
              disabled={merging || (selectedPromotions.length === 0 && selectedProducts.length === 0 && newProducts.trim().length === 0 && selectedGiftProducts.length === 0 && giftProducts.trim().length === 0)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {merging ? '병합 중...' : '병합하기'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
