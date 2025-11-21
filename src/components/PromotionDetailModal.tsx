'use client';

import { useState, useEffect } from 'react';
import Barcode from 'react-barcode';
import { IPromotion } from '@/lib/models/Promotion';
import CameraCapture from './CameraCapture';
import PromotionWikiEditModal from './PromotionWikiEditModal';
import PromotionHistoryModal from './PromotionHistoryModal';

interface PromotionDetailModalProps {
  promotion: IPromotion;
  isOpen: boolean;
  onClose: () => void;
  onMerge?: (promotionId: string) => void;
  onVerify?: (promotionId: string, adminVerify?: boolean) => void;
  onDispute?: (promotionId: string) => void;
  onEdit?: (promotion: IPromotion) => void; // JSON 편집 (관리자 전용)
  onUpdate?: (promotion: IPromotion) => void; // 위키 편집 후 데이터 업데이트
  isAdmin?: boolean;
  userAddress?: string | null;
}

type TabType = 'info' | 'actions' | 'admin';

export default function PromotionDetailModal({
  promotion,
  isOpen,
  onClose,
  onMerge,
  onVerify,
  onDispute,
  onEdit,
  onUpdate,
  isAdmin = false,
  userAddress,
}: PromotionDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [currentBarcodeIndex, setCurrentBarcodeIndex] = useState(0);
  const [currentGiftBarcodeIndex, setCurrentGiftBarcodeIndex] = useState(0);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showGiftBarcode, setShowGiftBarcode] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [productInfo, setProductInfo] = useState<{ [barcode: string]: { name: string; price?: number } }>({});
  const [showWikiEdit, setShowWikiEdit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentPromotion, setCurrentPromotion] = useState<IPromotion>(promotion);

  if (!isOpen) return null;

  const barcodes = promotion.applicableProducts || [];
  const giftBarcodes = promotion.giftProducts || [];
  const currentBarcode = barcodes[currentBarcodeIndex];
  const currentGiftBarcode = giftBarcodes[currentGiftBarcodeIndex];
  const isComboGift = promotion.giftSelectionType === 'combo' && giftBarcodes.length > 0;

  // 바코드로 상품명과 가격 조회
  useEffect(() => {
    const fetchProductInfo = async () => {
      const allBarcodes = [...barcodes, ...giftBarcodes];
      if (allBarcodes.length === 0) return;

      try {
        const response = await fetch('/api/products/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcodes: allBarcodes }),
        });

        const data = await response.json();
        if (data.success && data.products) {
          const infoMap: { [barcode: string]: { name: string; price?: number } } = {};
          data.products.forEach((product: any) => {
            if (product.barcode) {
              infoMap[product.barcode] = {
                name: product.name || '상품명 없음',
                price: product.price
              };
            }
          });
          setProductInfo(infoMap);
        }
      } catch (error) {
        console.error('Failed to fetch product info:', error);
      }
    };

    fetchProductInfo();
  }, [barcodes, giftBarcodes]);

  const handlePrevious = () => {
    setCurrentBarcodeIndex((prev) => (prev > 0 ? prev - 1 : barcodes.length - 1));
  };

  const handleNext = () => {
    setCurrentBarcodeIndex((prev) => (prev < barcodes.length - 1 ? prev + 1 : 0));
  };

  const handleGiftPrevious = () => {
    setCurrentGiftBarcodeIndex((prev) => (prev > 0 ? prev - 1 : giftBarcodes.length - 1));
  };

  const handleGiftNext = () => {
    setCurrentGiftBarcodeIndex((prev) => (prev < giftBarcodes.length - 1 ? prev + 1 : 0));
  };

  const handlePhotoCapture = async (blob: Blob, filename: string) => {
    setUploading(true);
    try {
      // 현재 사용자 주소 가져오기
      const { getCurrentUserAddress } = await import('@/lib/userAuth');
      const accountAddress = getCurrentUserAddress();

      if (!accountAddress) {
        alert('로그인이 필요합니다.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('photo', blob, filename);
      formData.append('promotionId', promotion._id.toString());
      formData.append('accountAddress', accountAddress);

      const response = await fetch('/api/admin/promotions/upload-photo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        alert('사진 업로드 실패: ' + data.error);
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handlePhotoCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  const hasVerified = userAddress && promotion.verifiedBy?.includes(userAddress);
  const hasDisputed = userAddress && promotion.disputedBy?.includes(userAddress);

  return (
    <>
      {showWikiEdit && (
        <PromotionWikiEditModal
          promotion={currentPromotion}
          isOpen={showWikiEdit}
          onClose={() => setShowWikiEdit(false)}
          onSave={(updatedPromotion) => {
            setCurrentPromotion(updatedPromotion);
            setShowWikiEdit(false);
            // 부모 컴포넌트의 리스트 업데이트 (JSON 모달 열지 않음)
            if (onUpdate) {
              onUpdate(updatedPromotion);
            }
          }}
          userAddress={userAddress ?? null}
        />
      )}

      {showHistory && (
        <PromotionHistoryModal
          promotionId={promotion._id.toString()}
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{promotion.name}</h2>
              <p className="text-purple-100 text-sm">{promotion.description}</p>
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

          {/* 탭 네비게이션 */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'info'
                  ? 'bg-white text-purple-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              📋 정보
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'actions'
                  ? 'bg-white text-purple-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              ✓ 액션
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === 'admin'
                    ? 'bg-white text-purple-600'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                🔧 관리자
              </button>
            )}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {/* 정보 탭 */}
          {activeTab === 'info' && (
            <>
              {/* 바코드 섹션 */}
              {barcodes.length > 0 && (
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    적용 상품 ({barcodes.length}개)
                  </h3>

                  {/* 바코드 표시 / 목록 전환 */}
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBarcode(false)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          !showBarcode
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        목록 보기
                      </button>
                      <button
                        onClick={() => setShowBarcode(true)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          showBarcode
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        바코드 보기
                      </button>
                    </div>
                  </div>

                  {showBarcode ? (
                    // 바코드 표시
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center justify-center mb-4">
                        <Barcode
                          value={currentBarcode}
                          width={2}
                          height={80}
                          fontSize={16}
                          background="#f9fafb"
                        />
                      </div>

                      {/* 네비게이션 */}
                      {barcodes.length > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-4">
                          <button
                            onClick={handlePrevious}
                            className="p-2 bg-white rounded-full shadow hover:shadow-md transition-shadow"
                          >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <span className="text-sm text-gray-600">
                            {currentBarcodeIndex + 1} / {barcodes.length}
                          </span>
                          <button
                            onClick={handleNext}
                            className="p-2 bg-white rounded-full shadow hover:shadow-md transition-shadow"
                          >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // 목록 표시
                    <div className="bg-gray-50 rounded-xl p-4 max-h-60 overflow-y-auto">
                      <div className="space-y-2">
                        {barcodes.map((barcode, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setCurrentBarcodeIndex(index);
                              setShowBarcode(true);
                            }}
                            className="w-full px-3 py-2 bg-white rounded-lg text-sm hover:bg-purple-50 hover:text-purple-700 transition-colors text-left"
                          >
                            <div className="font-mono text-gray-600 text-xs mb-1">{barcode}</div>
                            {productInfo[barcode] && (
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-gray-900">{productInfo[barcode].name}</div>
                                {productInfo[barcode].price && (
                                  <div className="text-purple-600 font-semibold ml-2">
                                    {productInfo[barcode].price.toLocaleString()}원
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 증정 상품 섹션 (콤보 증정 방식일 때만) */}
              {isComboGift && (
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    증정 상품 ({giftBarcodes.length}개)
                  </h3>

                  {/* 바코드 표시 / 목록 전환 */}
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowGiftBarcode(false)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          !showGiftBarcode
                            ? 'bg-pink-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        목록 보기
                      </button>
                      <button
                        onClick={() => setShowGiftBarcode(true)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          showGiftBarcode
                            ? 'bg-pink-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        바코드 보기
                      </button>
                    </div>
                  </div>

                  {showGiftBarcode ? (
                    // 바코드 표시
                    <div className="bg-pink-50 rounded-xl p-6">
                      <div className="flex items-center justify-center mb-4">
                        <Barcode
                          value={currentGiftBarcode}
                          width={2}
                          height={80}
                          fontSize={16}
                          background="#fdf2f8"
                        />
                      </div>

                      {/* 네비게이션 */}
                      {giftBarcodes.length > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-4">
                          <button
                            onClick={handleGiftPrevious}
                            className="p-2 bg-white rounded-full shadow hover:shadow-md transition-shadow"
                          >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <span className="text-sm text-gray-600">
                            {currentGiftBarcodeIndex + 1} / {giftBarcodes.length}
                          </span>
                          <button
                            onClick={handleGiftNext}
                            className="p-2 bg-white rounded-full shadow hover:shadow-md transition-shadow"
                          >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // 목록 표시
                    <div className="bg-pink-50 rounded-xl p-4 max-h-60 overflow-y-auto">
                      <div className="space-y-2">
                        {giftBarcodes.map((barcode, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setCurrentGiftBarcodeIndex(index);
                              setShowGiftBarcode(true);
                            }}
                            className="w-full px-3 py-2 bg-white rounded-lg text-sm hover:bg-pink-50 hover:text-pink-700 transition-colors text-left"
                          >
                            <div className="font-mono text-gray-600 text-xs mb-1">{barcode}</div>
                            {productInfo[barcode] && (
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-gray-900">{productInfo[barcode].name}</div>
                                {productInfo[barcode].price && (
                                  <div className="text-pink-600 font-semibold ml-2">
                                    {productInfo[barcode].price.toLocaleString()}원
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 프로모션 상세 정보 */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">프로모션 타입</p>
                    <p className="font-semibold text-gray-900">{promotion.promotionType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">증정 방식</p>
                    <p className="font-semibold text-gray-900">
                      {promotion.giftSelectionType === 'same' ? '동일 상품' :
                       promotion.giftSelectionType === 'cross' ? '교차 증정' : '콤보 증정'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">구매 수량</p>
                    <p className="font-semibold text-gray-900">{promotion.buyQuantity}개</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">증정 수량</p>
                    <p className="font-semibold text-gray-900">{promotion.getQuantity}개</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">유효 기간</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(promotion.validFrom).toLocaleDateString('ko-KR')} ~{' '}
                      {new Date(promotion.validTo).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">검증 횟수</p>
                    <p className="font-semibold text-green-600">{promotion.verificationCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">이의 제기</p>
                    <p className="font-semibold text-red-600">{promotion.disputeCount}</p>
                  </div>
                </div>

                {/* 증정 제약 조건 */}
                {promotion.giftConstraints && (
                  promotion.giftConstraints.maxGiftPrice ||
                  promotion.giftConstraints.mustBeCheaperThanPurchased ||
                  promotion.giftConstraints.mustBeSameProduct
                ) && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-yellow-800 mb-2">증정 제약 조건</p>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {promotion.giftConstraints.mustBeSameProduct && (
                        <li>• 구매한 상품과 동일한 상품만 증정</li>
                      )}
                      {promotion.giftConstraints.maxGiftPrice && (
                        <li>• 증정품 최대 가격: {promotion.giftConstraints.maxGiftPrice.toLocaleString()}원</li>
                      )}
                      {promotion.giftConstraints.mustBeCheaperThanPurchased && (
                        <li>• 증정품은 구매 상품보다 저렴해야 함</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 액션 탭 */}
          {activeTab === 'actions' && (
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">사용자 액션</h3>

              {/* 검증하기 */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-green-900 mb-1">✓ 검증하기</h4>
                    <p className="text-sm text-green-700">
                      이 프로모션이 실제로 적용되는 것을 확인했다면 검증해주세요.
                    </p>
                  </div>
                </div>
                {hasVerified ? (
                  <div className="text-sm text-green-600 font-medium">
                    ✅ 이미 검증하셨습니다
                  </div>
                ) : userAddress ? (
                  <button
                    onClick={() => onVerify && onVerify(promotion._id.toString())}
                    className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
                  >
                    검증하기
                  </button>
                ) : (
                  <div className="text-sm text-gray-500">
                    검증하려면 계정이 필요합니다
                  </div>
                )}
              </div>

              {/* 이의 제기 */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">⚠ 이의 제기</h4>
                    <p className="text-sm text-red-700">
                      이 프로모션 정보가 잘못되었거나 적용되지 않는다면 이의를 제기해주세요.
                    </p>
                  </div>
                </div>
                {hasDisputed ? (
                  <div className="text-sm text-red-600 font-medium">
                    ⚠️ 이미 이의를 제기하셨습니다
                  </div>
                ) : userAddress ? (
                  <button
                    onClick={() => onDispute && onDispute(promotion._id.toString())}
                    className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
                  >
                    이의 제기
                  </button>
                ) : (
                  <div className="text-sm text-gray-500">
                    이의 제기하려면 계정이 필요합니다
                  </div>
                )}
              </div>

              {/* 검증 상태 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3">검증 상태</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-green-600">{promotion.verificationCount}</div>
                    <div className="text-sm text-gray-600 mt-1">검증</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-600">{promotion.disputeCount}</div>
                    <div className="text-sm text-gray-600 mt-1">이의제기</div>
                  </div>
                </div>
              </div>

              {/* 위키 편집 */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">📝 위키 편집</h4>
                    <p className="text-sm text-blue-700">
                      프로모션 정보를 수정할 수 있습니다. 모든 수정 내역은 기록됩니다.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWikiEdit(true)}
                  className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  프로모션 편집하기
                </button>
              </div>

              {/* 히스토리 보기 */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-indigo-900 mb-1">📜 수정 히스토리</h4>
                    <p className="text-sm text-indigo-700">
                      이 프로모션의 모든 수정 내역을 확인할 수 있습니다.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHistory(true)}
                  className="w-full px-4 py-3 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors"
                >
                  히스토리 보기
                </button>
              </div>
            </div>
          )}

          {/* 관리자 탭 */}
          {activeTab === 'admin' && isAdmin && (
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">관리자 기능</h3>

              {/* 성공 메시지 */}
              {uploadSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                  ✅ 사진이 성공적으로 저장되었습니다!
                </div>
              )}

              {/* POS 화면 촬영 */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 mb-2">📷 POS 화면 촬영</h4>
                <p className="text-sm text-blue-700 mb-3">
                  실제 매장의 POS 화면을 촬영하여 프로모션 정보를 검증합니다.
                </p>
                <button
                  onClick={() => setShowCamera(true)}
                  disabled={uploading}
                  className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? '업로드 중...' : '📷 POS 화면 촬영하기'}
                </button>
              </div>

              {/* 관리자 검증 */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h4 className="font-semibold text-indigo-900 mb-2">✅ 관리자 검증</h4>
                <p className="text-sm text-indigo-700 mb-3">
                  관리자 권한으로 이 프로모션을 즉시 검증 완료 상태로 변경합니다.
                </p>
                <button
                  onClick={() => onVerify && onVerify(promotion._id.toString(), true)}
                  className="w-full px-4 py-3 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors"
                >
                  관리자 검증하기
                </button>
              </div>

              {/* 병합 */}
              {onMerge && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <h4 className="font-semibold text-orange-900 mb-2">🔀 프로모션 병합</h4>
                  <p className="text-sm text-orange-700 mb-3">
                    다른 프로모션과 병합하여 하나의 통합 프로모션으로 만듭니다.
                  </p>
                  <button
                    onClick={() => onMerge(promotion._id.toString())}
                    className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                  >
                    다른 프로모션과 병합하기
                  </button>
                </div>
              )}

              {/* JSON 편집 */}
              {onEdit && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">🔧 JSON 편집</h4>
                  <p className="text-sm text-purple-700 mb-3">
                    프로모션의 상세 정보를 JSON 형식으로 직접 수정합니다.
                  </p>
                  <button
                    onClick={() => onEdit(promotion)}
                    className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors"
                  >
                    JSON 편집하기
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
