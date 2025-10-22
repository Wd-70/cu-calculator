'use client';

import { useState } from 'react';
import Barcode from 'react-barcode';
import { IPromotion } from '@/lib/models/Promotion';
import CameraCapture from './CameraCapture';

interface PromotionDetailModalProps {
  promotion: IPromotion;
  isOpen: boolean;
  onClose: () => void;
  onMerge?: (promotionId: string) => void;
  isAdmin?: boolean;
}

export default function PromotionDetailModal({
  promotion,
  isOpen,
  onClose,
  onMerge,
  isAdmin = false,
}: PromotionDetailModalProps) {
  const [currentBarcodeIndex, setCurrentBarcodeIndex] = useState(0);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  if (!isOpen) return null;

  const barcodes = promotion.applicableProducts || [];
  const currentBarcode = barcodes[currentBarcodeIndex];

  const handlePrevious = () => {
    setCurrentBarcodeIndex((prev) => (prev > 0 ? prev - 1 : barcodes.length - 1));
  };

  const handleNext = () => {
    setCurrentBarcodeIndex((prev) => (prev < barcodes.length - 1 ? prev + 1 : 0));
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{promotion.name}</h2>
              <p className="text-purple-100 text-sm">{promotion.description}</p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

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
                  onClick={() => setShowBarcode(true)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    showBarcode
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  바코드 보기
                </button>
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
                      {promotion.applicableProductNames && promotion.applicableProductNames[index] && (
                        <div className="font-medium text-gray-900">{promotion.applicableProductNames[index]}</div>
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
                {promotion.giftSelectionType === 'same' ? '동일 그룹' : '교차 증정'}
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
          {promotion.giftConstraints && Object.keys(promotion.giftConstraints).length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-yellow-800 mb-2">증정 제약 조건</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {promotion.giftConstraints.mustBeSameProduct && (
                  <li>• 동일 상품만 증정 가능</li>
                )}
                {promotion.giftConstraints.canChooseDifferent && (
                  <li>• 다른 상품 선택 가능</li>
                )}
                {promotion.giftConstraints.maxUniqueProducts && (
                  <li>• 최대 {promotion.giftConstraints.maxUniqueProducts}종 선택 가능</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="p-6 border-t border-gray-200">
          {/* 성공 메시지 */}
          {uploadSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              ✅ 사진이 성공적으로 저장되었습니다!
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            {isAdmin && (
              <button
                onClick={() => setShowCamera(true)}
                disabled={uploading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {uploading ? '업로드 중...' : '📷 POS 화면 촬영'}
              </button>
            )}
            {isAdmin && onMerge && (
              <button
                onClick={() => onMerge(promotion._id.toString())}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-pink-600 transition-all shadow-md"
              >
                🔀 다른 프로모션과 병합
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
