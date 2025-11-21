'use client';

import { useState, useEffect } from 'react';
import { IPromotion } from '@/lib/models/Promotion';
import { signWithTimestamp } from '@/lib/userAuth';
import ProductSearchModal from './cart/ProductSearchModal';
import BarcodeScanner from './BarcodeScanner';

interface PromotionWikiEditModalProps {
  promotion: IPromotion;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPromotion: IPromotion) => void;
  userAddress: string | null;
}

export default function PromotionWikiEditModal({
  promotion,
  isOpen,
  onClose,
  onSave,
  userAddress,
}: PromotionWikiEditModalProps) {
  const [editedPromotion, setEditedPromotion] = useState<Partial<IPromotion>>({});
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showGiftSearch, setShowGiftSearch] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'applicable' | 'gift'>('applicable');
  const [productQuery, setProductQuery] = useState('');
  const [giftQuery, setGiftQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const commentExamples = [
    '상품 정보 업데이트',
    '누락된 상품 추가',
    '잘못된 상품 제거',
    '유효 기간 수정',
    '프로모션 이름 수정',
    '증정 방식 변경',
  ];

  useEffect(() => {
    if (isOpen && promotion) {
      setEditedPromotion({
        name: promotion.name,
        description: promotion.description,
        promotionType: promotion.promotionType,
        buyQuantity: promotion.buyQuantity,
        getQuantity: promotion.getQuantity,
        giftSelectionType: promotion.giftSelectionType,
        applicableProducts: [...(promotion.applicableProducts || [])],
        giftProducts: [...(promotion.giftProducts || [])],
        validFrom: promotion.validFrom,
        validTo: promotion.validTo,
        giftConstraints: promotion.giftConstraints,
      });
      setComment('');
    }
  }, [isOpen, promotion]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!userAddress) {
      alert('계정이 필요합니다. 먼저 계정을 생성해주세요.');
      return;
    }

    // 자동 생성된 변경 사항 계산
    let finalComment = comment.trim();
    if (!finalComment) {
      const changes: string[] = [];

      if (editedPromotion.name && editedPromotion.name !== promotion.name) {
        changes.push(`프로모션 이름 변경`);
      }
      if (editedPromotion.description && editedPromotion.description !== promotion.description) {
        changes.push(`설명 수정`);
      }
      if (editedPromotion.giftSelectionType && editedPromotion.giftSelectionType !== promotion.giftSelectionType) {
        const getTypeName = (type: string) => {
          if (type === 'same') return '동일 상품';
          if (type === 'cross') return '교차 증정';
          return '콤보 증정';
        };
        const oldType = getTypeName(promotion.giftSelectionType);
        const newType = getTypeName(editedPromotion.giftSelectionType);
        changes.push(`증정 방식 변경 (${oldType} → ${newType})`);
      }

      const oldApplicable = promotion.applicableProducts || [];
      const newApplicable = editedPromotion.applicableProducts || [];
      const addedApplicable = newApplicable.filter(b => !oldApplicable.includes(b));
      const removedApplicable = oldApplicable.filter(b => !newApplicable.includes(b));

      if (addedApplicable.length > 0) changes.push(`구매 상품 ${addedApplicable.length}개 추가`);
      if (removedApplicable.length > 0) changes.push(`구매 상품 ${removedApplicable.length}개 제거`);

      if (editedPromotion.giftSelectionType === 'combo') {
        const oldGift = promotion.giftProducts || [];
        const newGift = editedPromotion.giftProducts || [];
        const addedGift = newGift.filter(b => !oldGift.includes(b));
        const removedGift = oldGift.filter(b => !newGift.includes(b));

        if (addedGift.length > 0) changes.push(`증정 상품 ${addedGift.length}개 추가`);
        if (removedGift.length > 0) changes.push(`증정 상품 ${removedGift.length}개 제거`);
      }

      if (editedPromotion.validFrom && new Date(editedPromotion.validFrom).getTime() !== new Date(promotion.validFrom).getTime()) {
        changes.push(`시작일 변경`);
      }
      if (editedPromotion.validTo && new Date(editedPromotion.validTo).getTime() !== new Date(promotion.validTo).getTime()) {
        changes.push(`종료일 변경`);
      }

      if (changes.length > 0) {
        finalComment = changes.join(', ');
      } else {
        alert('변경 사항이 없습니다.');
        return;
      }
    }

    setSaving(true);
    try {
      // Date 객체를 ISO 문자열로 변환
      const sanitizedUpdates = {
        ...editedPromotion,
        validFrom: editedPromotion.validFrom ? new Date(editedPromotion.validFrom).toISOString() : undefined,
        validTo: editedPromotion.validTo ? new Date(editedPromotion.validTo).toISOString() : undefined,
      };

      const { signature, timestamp } = await signWithTimestamp({
        action: 'edit_promotion',
        promotionId: promotion._id.toString(),
        updates: sanitizedUpdates,
        comment: finalComment,
      });

      const response = await fetch(`/api/promotions/${promotion._id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: sanitizedUpdates,
          comment: finalComment,
          signature,
          timestamp,
          address: userAddress,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 수정 후 최신 데이터 다시 가져오기
        const freshResponse = await fetch(`/api/promotions/${promotion._id}`);
        const freshData = await freshResponse.json();

        if (freshData.success) {
          alert('프로모션이 성공적으로 수정되었습니다!');
          onSave(freshData.promotion);
          onClose();
        } else {
          alert('프로모션이 수정되었지만 최신 데이터를 불러오지 못했습니다.');
          onSave(data.promotion);
          onClose();
        }
      } else {
        alert(`오류: ${data.error}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddProduct = (barcode: string, isGift: boolean = false) => {
    const field = isGift ? 'giftProducts' : 'applicableProducts';
    const current = editedPromotion[field] || [];

    if (!current.includes(barcode)) {
      setEditedPromotion({
        ...editedPromotion,
        [field]: [...current, barcode],
      });
    }
  };

  const handleRemoveProduct = (barcode: string, isGift: boolean = false) => {
    const field = isGift ? 'giftProducts' : 'applicableProducts';
    const current = editedPromotion[field] || [];

    setEditedPromotion({
      ...editedPromotion,
      [field]: current.filter(b => b !== barcode),
    });
  };

  const handleProductQuerySubmit = (query: string, isGift: boolean) => {
    if (!query.trim()) return;

    // 13자리 숫자면 바코드로 간주하고 바로 추가
    if (/^\d{13}$/.test(query.trim())) {
      handleAddProduct(query.trim(), isGift);
      if (isGift) {
        setGiftQuery('');
      } else {
        setProductQuery('');
      }
    } else {
      // 아니면 검색 실행
      handleSearch(isGift, query);
    }
  };

  const handleScanStart = (target: 'applicable' | 'gift') => {
    setScanTarget(target);
    setShowBarcodeScanner(true);
  };

  const handleScanComplete = (barcode: string) => {
    handleAddProduct(barcode, scanTarget === 'gift');
    setShowBarcodeScanner(false);
  };

  const handleSearch = async (isForGift: boolean, query: string) => {
    if (query.length < 2) {
      alert('검색어를 2자 이상 입력해주세요.');
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/products?name=${encodeURIComponent(query)}&limit=200`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
        setTotalCount(data.total || 0);
        if (isForGift) {
          setShowGiftSearch(true);
        } else {
          setShowProductSearch(true);
        }
      }
    } catch (error) {
      console.error('상품 검색 실패:', error);
      alert('상품 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const applicableProducts = editedPromotion.applicableProducts || [];
  const giftProducts = editedPromotion.giftProducts || [];
  const isComboGift = editedPromotion.giftSelectionType === 'combo';

  return (
    <>
      {showBarcodeScanner && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">바코드 스캔</h3>
              <button
                onClick={() => setShowBarcodeScanner(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <BarcodeScanner
              onScan={handleScanComplete}
              onError={(error) => {
                console.error('Scan error:', error);
                alert('바코드 스캔 중 오류가 발생했습니다.');
              }}
            />
          </div>
        </div>
      )}

      {showProductSearch && (
        <ProductSearchModal
          isOpen={showProductSearch}
          onClose={() => {
            setShowProductSearch(false);
            setProductQuery('');
          }}
          searchQuery={productQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          onSelectProduct={(product) => {
            if (product.barcode) {
              handleAddProduct(product.barcode, false);
            }
          }}
          totalCount={totalCount}
        />
      )}

      {showGiftSearch && (
        <ProductSearchModal
          isOpen={showGiftSearch}
          onClose={() => {
            setShowGiftSearch(false);
            setGiftQuery('');
          }}
          searchQuery={giftQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          onSelectProduct={(product) => {
            if (product.barcode) {
              handleAddProduct(product.barcode, true);
            }
          }}
          totalCount={totalCount}
        />
      )}

      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">📝 프로모션 편집 (위키)</h2>
                <p className="text-blue-100 text-sm">
                  모든 사용자가 편집할 수 있습니다. 수정 내역은 모두 기록됩니다.
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors flex-shrink-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 콘텐츠 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 기본 정보 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">기본 정보</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    프로모션 이름
                  </label>
                  <input
                    type="text"
                    value={editedPromotion.name || ''}
                    onChange={(e) => setEditedPromotion({ ...editedPromotion, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    설명
                  </label>
                  <textarea
                    value={editedPromotion.description || ''}
                    onChange={(e) => setEditedPromotion({ ...editedPromotion, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      유효 시작일
                    </label>
                    <input
                      type="date"
                      value={editedPromotion.validFrom ? new Date(editedPromotion.validFrom).toISOString().split('T')[0] : ''}
                      onChange={(e) => setEditedPromotion({ ...editedPromotion, validFrom: new Date(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      유효 종료일
                    </label>
                    <input
                      type="date"
                      value={editedPromotion.validTo ? new Date(editedPromotion.validTo).toISOString().split('T')[0] : ''}
                      onChange={(e) => setEditedPromotion({ ...editedPromotion, validTo: new Date(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    증정 방식
                  </label>
                  <select
                    value={editedPromotion.giftSelectionType || 'same'}
                    onChange={(e) => setEditedPromotion({ ...editedPromotion, giftSelectionType: e.target.value as 'same' | 'cross' | 'combo' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="same">동일 상품</option>
                    <option value="cross">교차 증정</option>
                    <option value="combo">콤보 증정</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 구매 상품 */}
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  구매 상품 ({applicableProducts.length}개)
                </h3>
                <button
                  onClick={() => handleScanStart('applicable')}
                  className="px-3 py-1 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors"
                >
                  📷 스캔
                </button>
              </div>

              {/* 상품 검색/바코드 입력 통합 */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="상품명 또는 바코드 입력 (13자리 숫자는 바로 추가)"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleProductQuerySubmit(productQuery, false);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => handleProductQuerySubmit(productQuery, false)}
                    disabled={isSearching || !productQuery.trim()}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSearching ? '처리 중...' : '입력'}
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  💡 13자리 바코드는 바로 추가되고, 나머지는 검색됩니다
                </div>
              </div>

              {/* 상품 목록 */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {applicableProducts.map((barcode, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white p-3 rounded-lg"
                  >
                    <span className="font-mono text-sm text-gray-700">{barcode}</span>
                    <button
                      onClick={() => handleRemoveProduct(barcode, false)}
                      className="text-red-500 hover:text-red-700 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {applicableProducts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    구매 상품이 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* 증정 상품 (콤보 증정일 경우만) */}
            {isComboGift && (
              <div className="bg-pink-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    증정 상품 ({giftProducts.length}개)
                  </h3>
                  <button
                    onClick={() => handleScanStart('gift')}
                    className="px-3 py-1 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 transition-colors"
                  >
                    📷 스캔
                  </button>
                </div>

                {/* 상품 검색/바코드 입력 통합 */}
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="상품명 또는 바코드 입력 (13자리 숫자는 바로 추가)"
                      value={giftQuery}
                      onChange={(e) => setGiftQuery(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleProductQuerySubmit(giftQuery, true);
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    />
                    <button
                      onClick={() => handleProductQuerySubmit(giftQuery, true)}
                      disabled={isSearching || !giftQuery.trim()}
                      className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSearching ? '처리 중...' : '입력'}
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    💡 13자리 바코드는 바로 추가되고, 나머지는 검색됩니다
                  </div>
                </div>

                {/* 상품 목록 */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {giftProducts.map((barcode, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white p-3 rounded-lg"
                    >
                      <span className="font-mono text-sm text-gray-700">{barcode}</span>
                      <button
                        onClick={() => handleRemoveProduct(barcode, true)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {giftProducts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      증정 상품이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 수정 코멘트 */}
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
              <label className="block text-sm font-bold text-yellow-900 mb-2">
                ⚠️ 수정 이유 (선택 - 자동 생성 가능)
              </label>

              {/* 자동 감지된 변경 사항 미리보기 */}
              {(() => {
                const changes: string[] = [];
                if (!promotion || !editedPromotion) return null;

                if (editedPromotion.name && editedPromotion.name !== promotion.name) {
                  changes.push(`프로모션 이름 변경`);
                }
                if (editedPromotion.description && editedPromotion.description !== promotion.description) {
                  changes.push(`설명 수정`);
                }
                if (editedPromotion.giftSelectionType && editedPromotion.giftSelectionType !== promotion.giftSelectionType) {
                  const getTypeName = (type: string) => {
                    if (type === 'same') return '동일 상품';
                    if (type === 'cross') return '교차 증정';
                    return '콤보 증정';
                  };
                  const oldType = getTypeName(promotion.giftSelectionType);
                  const newType = getTypeName(editedPromotion.giftSelectionType);
                  changes.push(`증정 방식 변경 (${oldType} → ${newType})`);
                }

                const oldApplicable = promotion.applicableProducts || [];
                const newApplicable = editedPromotion.applicableProducts || [];
                const addedApplicable = newApplicable.filter(b => !oldApplicable.includes(b));
                const removedApplicable = oldApplicable.filter(b => !newApplicable.includes(b));

                if (addedApplicable.length > 0) changes.push(`구매 상품 ${addedApplicable.length}개 추가`);
                if (removedApplicable.length > 0) changes.push(`구매 상품 ${removedApplicable.length}개 제거`);

                if (editedPromotion.giftSelectionType === 'combo') {
                  const oldGift = promotion.giftProducts || [];
                  const newGift = editedPromotion.giftProducts || [];
                  const addedGift = newGift.filter(b => !oldGift.includes(b));
                  const removedGift = oldGift.filter(b => !newGift.includes(b));

                  if (addedGift.length > 0) changes.push(`증정 상품 ${addedGift.length}개 추가`);
                  if (removedGift.length > 0) changes.push(`증정 상품 ${removedGift.length}개 제거`);
                }

                if (editedPromotion.validFrom && new Date(editedPromotion.validFrom).getTime() !== new Date(promotion.validFrom).getTime()) {
                  changes.push(`시작일 변경`);
                }
                if (editedPromotion.validTo && new Date(editedPromotion.validTo).getTime() !== new Date(promotion.validTo).getTime()) {
                  changes.push(`종료일 변경`);
                }

                if (changes.length > 0) {
                  return (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-xs font-semibold text-blue-800">🤖 감지된 변경 사항:</div>
                        <button
                          type="button"
                          onClick={() => setComment(changes.join(', '))}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          이 내용 사용
                        </button>
                      </div>
                      <div className="text-sm text-blue-700">
                        {changes.join(', ')}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* 예시 선택 버튼 */}
              <div className="mb-3">
                <div className="text-xs text-yellow-700 mb-2">빠른 선택:</div>
                <div className="flex flex-wrap gap-2">
                  {commentExamples.map((example, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setComment(example)}
                      className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg text-xs font-medium transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="이 프로모션을 왜 수정하는지 설명해주세요..."
                rows={3}
                className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
              />
              <p className="text-xs text-yellow-700 mt-2">
                💡 변경 사항이 자동으로 감지됩니다. 직접 수정하거나 추가 설명을 입력할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 푸터 */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '저장 중...' : '✍️ 서명하고 저장'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
