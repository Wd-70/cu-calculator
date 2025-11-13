'use client';

import { useState, useEffect } from 'react';
import Barcode from 'react-barcode';
import { checkIsAdminClient } from '@/lib/adminAuth';

interface CategoryTag {
  name: string;
  level: number;
}

interface Product {
  _id: string;
  barcode: string;
  name: string;
  price: number;
  categoryTags?: CategoryTag[];
  brand?: string;
  imageUrl?: string;
}

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (quantity: number) => void;
  currentQuantity?: number;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  currentQuantity = 0,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [showBarcode, setShowBarcode] = useState(true); // 기본적으로 바코드 표시
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // 관리자 기능 상태
  const [isAdmin, setIsAdmin] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantBarcode, setVariantBarcode] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState(product.price);
  const [isSavingVariant, setIsSavingVariant] = useState(false);
  const [variantMessage, setVariantMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // 모달이 열릴 때 배경 스크롤 방지
  useEffect(() => {
    // 현재 스크롤 위치 저장
    const scrollY = window.scrollY;

    // body 스크롤 방지
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    // 클린업: 모달이 닫힐 때 원래대로 복구
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  // 관리자 권한 체크
  useEffect(() => {
    const checkAdmin = async () => {
      const userAddress = localStorage.getItem('accountAddress');
      console.log('🔍 관리자 체크 - userAddress:', userAddress);
      if (userAddress) {
        const adminStatus = await checkIsAdminClient(userAddress);
        console.log('🔍 관리자 체크 결과:', adminStatus);
        setIsAdmin(adminStatus);
      }
    };
    checkAdmin();
  }, []);

  // 간편식사 카테고리 체크
  const isSimpleMeal = product.categoryTags?.some(tag => tag.name === '간편식사') || false;
  console.log('🔍 상품 카테고리:', product.categoryTags);
  console.log('🔍 간편식사 체크:', isSimpleMeal);
  console.log('🔍 관리자 여부:', isAdmin);
  console.log('🔍 UI 표시 조건:', isAdmin && isSimpleMeal);

  const handleAddToCart = () => {
    onAddToCart(quantity);
    onClose();
  };

  const handleSaveVariant = async () => {
    if (!variantBarcode.trim()) {
      setVariantMessage({ type: 'error', text: '바코드를 입력해주세요.' });
      return;
    }
    if (!variantName.trim()) {
      setVariantMessage({ type: 'error', text: '상품명을 입력해주세요.' });
      return;
    }
    if (variantPrice <= 0) {
      setVariantMessage({ type: 'error', text: '가격을 입력해주세요.' });
      return;
    }

    setIsSavingVariant(true);
    setVariantMessage(null);

    try {
      const userAddress = localStorage.getItem('accountAddress');

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: variantBarcode.trim(),
          name: variantName.trim(),
          price: variantPrice,
          brand: product.brand || 'CU',
          imageUrl: product.imageUrl,
          createdBy: userAddress,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setVariantMessage({ type: 'success', text: '변형 상품이 등록되었습니다!' });
        setVariantBarcode('');
        setVariantName('');
        setVariantPrice(product.price);
        setTimeout(() => {
          setShowVariantForm(false);
          setVariantMessage(null);
        }, 2000);
      } else {
        setVariantMessage({ type: 'error', text: data.error || '등록에 실패했습니다.' });
      }
    } catch (error) {
      console.error('Error saving variant:', error);
      setVariantMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setIsSavingVariant(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const toggleView = () => {
    setShowBarcode(!showBarcode);
  };

  // 스와이프 최소 거리 (픽셀)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && hasNext && onNext) {
      onNext();
    }
    if (isRightSwipe && hasPrevious && onPrevious) {
      onPrevious();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
      onClick={handleBackdropClick}
    >
      {/* 이전 상품 버튼 - 모달 왼쪽 */}
      {hasPrevious && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrevious?.();
          }}
          className="absolute left-1 sm:left-4 md:left-8 top-1/2 -translate-y-1/2 z-[110] p-2.5 sm:p-4 bg-black/70 hover:bg-black/90 rounded-full shadow-lg transition-all touch-manipulation"
          aria-label="이전 상품"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* 다음 상품 버튼 - 모달 오른쪽 */}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext?.();
          }}
          className="absolute right-1 sm:right-4 md:right-8 top-1/2 -translate-y-1/2 z-[110] p-2.5 sm:p-4 bg-black/70 hover:bg-black/90 rounded-full shadow-lg transition-all touch-manipulation"
          aria-label="다음 상품"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div
        className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col relative mx-auto"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">상품 정보</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 - 스크롤 가능 영역 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 이미지/바코드 전환 영역 */}
          <div
            onClick={toggleView}
            className="w-full aspect-square mb-4 overflow-hidden rounded-xl bg-gray-100 cursor-pointer relative group"
          >
            {showBarcode ? (
              // 바코드 표시
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <p className="text-sm font-semibold text-gray-700 mb-4">바코드를 스캔하세요</p>
                <Barcode
                  value={product.barcode}
                  width={2}
                  height={80}
                  fontSize={16}
                  background="#f9fafb"
                />
                <p className="text-xs text-gray-500 mt-4">탭하여 상품 이미지 보기</p>
              </div>
            ) : (
              // 상품 이미지 표시
              <div className="w-full h-full relative">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/400x400?text=No+Image';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                  <p className="text-xs text-white text-center">탭하여 바코드 보기</p>
                </div>
              </div>
            )}

            {/* 전환 인디케이터 */}
            <div className="absolute top-3 right-3 flex gap-1">
              <div className={`w-2 h-2 rounded-full transition-colors ${showBarcode ? 'bg-[#7C3FBF]' : 'bg-white/50'}`} />
              <div className={`w-2 h-2 rounded-full transition-colors ${!showBarcode ? 'bg-[#7C3FBF]' : 'bg-white/50'}`} />
            </div>
          </div>

          {/* 상품명 */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>

          {/* 가격 */}
          <p className="text-2xl font-bold text-[#7C3FBF] mb-4">
            {product.price.toLocaleString()}원
          </p>

          {/* 카테고리 태그 */}
          {product.categoryTags && product.categoryTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {product.categoryTags
                .sort((a, b) => a.level - b.level)
                .map((tag, index) => (
                  <span
                    key={index}
                    className="inline-block px-2 py-1 bg-purple-100 text-[#7C3FBF] text-xs font-semibold rounded-lg"
                  >
                    {tag.name}
                  </span>
                ))}
            </div>
          )}

          {/* 브랜드 */}
          {product.brand && (
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-semibold">브랜드:</span> {product.brand}
            </p>
          )}

          {/* 현재 장바구니 수량 표시 */}
          {currentQuantity > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-800 text-center">
                현재 장바구니에 <span className="font-bold">{currentQuantity}개</span> 담겨있습니다
              </p>
            </div>
          )}

          {/* 수량 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              추가할 수량
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-gray-700 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                className="flex-1 min-w-0 text-center px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3FBF] font-bold text-lg"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-gray-700 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* 장바구니 추가 버튼 */}
          <button
            onClick={handleAddToCart}
            className="w-full py-3 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-bold hover:shadow-lg transition-all"
          >
            장바구니에 {quantity}개 추가
          </button>

          {/* 관리자 전용: 변형 상품 추가 */}
          {isAdmin && isSimpleMeal && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-700">🔧 관리자 전용</h4>
                {!showVariantForm && (
                  <button
                    onClick={() => {
                      setShowVariantForm(true);
                      setVariantName(product.name);
                      setVariantPrice(product.price);
                    }}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    변형 상품 추가
                  </button>
                )}
              </div>

              {showVariantForm && (
                <div className="space-y-3 p-4 bg-orange-50 rounded-lg">
                  <p className="text-xs text-orange-800 mb-2">
                    다른 바코드(1번/2번)를 스캔하여 변형 상품을 추가하세요
                  </p>

                  {/* 바코드 입력 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      바코드 *
                    </label>
                    <input
                      type="text"
                      value={variantBarcode}
                      onChange={(e) => setVariantBarcode(e.target.value)}
                      placeholder="바코드를 스캔하거나 입력하세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* 상품명 입력 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      상품명 *
                    </label>
                    <input
                      type="text"
                      value={variantName}
                      onChange={(e) => setVariantName(e.target.value)}
                      placeholder="예: 상품명 2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* 가격 입력 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      가격 (원) *
                    </label>
                    <input
                      type="number"
                      value={variantPrice}
                      onChange={(e) => setVariantPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* 메시지 */}
                  {variantMessage && (
                    <div className={`p-2 rounded-lg text-xs ${
                      variantMessage.type === 'success'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {variantMessage.text}
                    </div>
                  )}

                  {/* 버튼 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowVariantForm(false);
                        setVariantBarcode('');
                        setVariantName('');
                        setVariantMessage(null);
                      }}
                      disabled={isSavingVariant}
                      className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveVariant}
                      disabled={isSavingVariant}
                      className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isSavingVariant ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
