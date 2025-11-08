'use client';

import { useState, useEffect, useRef } from 'react';
import { IDiscountRule, DISCOUNT_CATEGORY_NAMES, PaymentMethodRequirement, CardIssuerRequirement, PaymentMethodException } from '@/types/discount';
import { PAYMENT_METHOD_NAMES } from '@/types/payment';
import { IProduct } from '@/types/product';
import ProductSearchModal from '@/components/cart/ProductSearchModal';
import { signWithTimestamp, getCurrentUserAddress } from '@/lib/userAuth';

interface DiscountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  discount: IDiscountRule | null;
  onSave?: () => void;
  isAdmin?: boolean;
}

export default function DiscountDetailModal({
  isOpen,
  onClose,
  discount,
  onSave,
  isAdmin = false,
}: DiscountDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDiscount, setEditedDiscount] = useState<IDiscountRule | null>(null);
  const [currentTab, setCurrentTab] = useState<'basic' | 'products' | 'payment' | 'rules'>('basic');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (discount) {
      setEditedDiscount(JSON.parse(JSON.stringify(discount)));
    }
  }, [discount]);

  if (!isOpen || !discount) return null;

  const displayDiscount = isEditing && editedDiscount ? editedDiscount : discount;

  const handleSave = async () => {
    if (!editedDiscount) return;

    try {
      setSaving(true);

      // 사용자 주소 확인
      const address = getCurrentUserAddress();
      if (!address) {
        alert('계정을 찾을 수 없습니다. 로그인이 필요합니다.');
        setSaving(false);
        return;
      }

      // 저장할 데이터 준비 (읽기 전용 필드 제외)
      const discountData = {
        name: editedDiscount.name,
        description: editedDiscount.description,
        config: editedDiscount.config,
        applicationMethod: editedDiscount.applicationMethod,
        applicableProducts: editedDiscount.applicableProducts,
        applicableCategories: editedDiscount.applicableCategories,
        applicableBrands: editedDiscount.applicableBrands,
        requiredPaymentMethods: editedDiscount.requiredPaymentMethods,
        paymentMethodNames: editedDiscount.paymentMethodNames,
        paymentMethodRequirements: editedDiscount.paymentMethodRequirements,
        allowedExceptions: editedDiscount.allowedExceptions,
        blockedExceptions: editedDiscount.blockedExceptions,
        cannotCombineWithCategories: editedDiscount.cannotCombineWithCategories,
        cannotCombineWithIds: editedDiscount.cannotCombineWithIds,
        requiresDiscountId: editedDiscount.requiresDiscountId,
        minPurchaseAmount: editedDiscount.minPurchaseAmount,
        minQuantity: editedDiscount.minQuantity,
        maxDiscountAmount: editedDiscount.maxDiscountAmount,
        maxDiscountPerItem: editedDiscount.maxDiscountPerItem,
        dailyUsageLimit: editedDiscount.dailyUsageLimit,
        totalUsageLimit: editedDiscount.totalUsageLimit,
        usageResetTime: editedDiscount.usageResetTime,
        eventMonth: editedDiscount.eventMonth,
        eventName: editedDiscount.eventName,
        isRecurring: editedDiscount.isRecurring,
        validFrom: editedDiscount.validFrom,
        validTo: editedDiscount.validTo,
        sourceUrl: editedDiscount.sourceUrl,
        priority: editedDiscount.priority,
        isActive: editedDiscount.isActive,
      };

      // 서명 생성
      const { signature, timestamp } = await signWithTimestamp({
        action: 'update_discount',
        id: editedDiscount._id,
        ...discountData,
      });

      // API 호출
      const response = await fetch(`/api/discounts/${editedDiscount._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountData,
          signature,
          timestamp,
          address,
          comment: '할인 규칙 수정',
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('할인 규칙이 저장되었습니다.');
        setIsEditing(false);
        onSave?.();
      } else {
        alert('저장에 실패했습니다: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Failed to save discount:', error);
      alert('저장 중 오류가 발생했습니다: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const getDiscountValue = (): string => {
    const config = displayDiscount.config;

    switch (config.category) {
      case 'coupon':
        if (config.valueType === 'fixed_amount' && config.fixedAmount) {
          return `${config.fixedAmount.toLocaleString()}원 할인`;
        }
        return `${config.percentage}% 할인`;
      case 'telecom':
        if (config.valueType === 'percentage') {
          return `${config.percentage}% 할인`;
        }
        return `${config.tierUnit}원당 ${config.tierAmount}원 할인`;
      case 'payment_event':
        if (config.valueType === 'percentage') {
          const baseText = config.baseAmountType === 'current_amount'
            ? ' (프로모션 적용 후 기준)'
            : ' (정가 기준)';
          return `${config.percentage}% 할인${baseText}`;
        }
        return `${config.fixedAmount?.toLocaleString()}원 할인`;
      case 'voucher':
        return `${config.amount.toLocaleString()}원권`;
      case 'payment_instant':
      case 'payment_compound':
        return `${config.percentage}% 할인`;
      case 'event':
        if (config.valueType === 'fixed_amount' && config.fixedAmount) {
          return `${config.fixedAmount.toLocaleString()}원 할인`;
        }
        return `${config.percentage}% 할인`;
      default:
        return '할인';
    }
  };

  const categoryColors: Record<string, { bg: string; text: string; badge: string }> = {
    coupon: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
    telecom: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
    payment_event: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100' },
    voucher: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100' },
    payment_instant: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100' },
    payment_compound: { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100' },
    event: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100' },
    promotion: { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100' },
  };

  const colors = categoryColors[displayDiscount.config.category] || { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100' };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className={`${colors.bg} rounded-t-2xl p-6 border-b border-gray-200`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 ${colors.badge} rounded-lg text-sm font-semibold ${colors.text}`}>
                  {DISCOUNT_CATEGORY_NAMES[displayDiscount.config.category as keyof typeof DISCOUNT_CATEGORY_NAMES]}
                </span>
                {!displayDiscount.isActive && (
                  <span className="px-3 py-1 bg-gray-200 rounded-lg text-sm font-semibold text-gray-600">
                    비활성
                  </span>
                )}
              </div>
              {isEditing && editedDiscount ? (
                <input
                  type="text"
                  value={editedDiscount.name}
                  onChange={(e) => setEditedDiscount({ ...editedDiscount, name: e.target.value })}
                  className="text-2xl font-bold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 w-full"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-900">{displayDiscount.name}</h2>
              )}
              <div className={`text-3xl font-bold ${colors.text} mt-2`}>
                {getDiscountValue()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  수정
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-2 mt-4 border-b border-gray-200">
            {['basic', 'products', 'payment', 'rules'].map((tab) => {
              const tabNames = {
                basic: '기본 정보',
                products: '적용 상품',
                payment: '결제수단',
                rules: '제약 조건',
              };
              return (
                <button
                  key={tab}
                  onClick={() => setCurrentTab(tab as any)}
                  className={`pb-3 px-4 font-semibold transition-colors border-b-2 ${
                    currentTab === tab
                      ? `${colors.text} border-current`
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  {tabNames[tab as keyof typeof tabNames]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {currentTab === 'basic' && (
            <BasicInfoTab discount={displayDiscount} isEditing={isEditing} editedDiscount={editedDiscount} setEditedDiscount={setEditedDiscount} />
          )}
          {currentTab === 'products' && (
            <ProductsTab discount={displayDiscount} isEditing={isEditing} editedDiscount={editedDiscount} setEditedDiscount={setEditedDiscount} />
          )}
          {currentTab === 'payment' && (
            <PaymentTab discount={displayDiscount} isEditing={isEditing} editedDiscount={editedDiscount} setEditedDiscount={setEditedDiscount} />
          )}
          {currentTab === 'rules' && (
            <RulesTab discount={displayDiscount} isEditing={isEditing} editedDiscount={editedDiscount} setEditedDiscount={setEditedDiscount} />
          )}
        </div>

        {/* 푸터 */}
        {isEditing && (
          <div className="border-t border-gray-200 p-6 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedDiscount(JSON.parse(JSON.stringify(discount)));
              }}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-white transition-colors"
              disabled={saving}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 기본 정보 탭
function BasicInfoTab({ discount, isEditing, editedDiscount, setEditedDiscount }: any) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">설명</label>
        {isEditing && editedDiscount ? (
          <textarea
            value={editedDiscount.description || ''}
            onChange={(e) => setEditedDiscount({ ...editedDiscount, description: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={4}
          />
        ) : (
          <p className="text-gray-700 whitespace-pre-wrap">
            {discount.description || '설명이 없습니다.'}
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">유효 기간</label>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">시작:</span>
              {isEditing && editedDiscount ? (
                <input
                  type="date"
                  value={new Date(editedDiscount.validFrom).toISOString().split('T')[0]}
                  onChange={(e) => setEditedDiscount({ ...editedDiscount, validFrom: new Date(e.target.value) })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-gray-900 font-medium">
                  {new Date(discount.validFrom).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">종료:</span>
              {isEditing && editedDiscount ? (
                <input
                  type="date"
                  value={new Date(editedDiscount.validTo).toISOString().split('T')[0]}
                  onChange={(e) => setEditedDiscount({ ...editedDiscount, validTo: new Date(e.target.value) })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-gray-900 font-medium">
                  {new Date(discount.validTo).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">사용 제한</label>
          <div className="space-y-2">
            {/* 구독 쿠폰의 상품 개수 제한 */}
            {discount.config.category === 'coupon' && discount.config.isSubscription && (
              <>
                {discount.config.itemLimitPerDay && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">일일 상품 제한:</span>
                    {isEditing && editedDiscount ? (
                      <input
                        type="number"
                        value={editedDiscount.config.itemLimitPerDay}
                        onChange={(e) => setEditedDiscount({
                          ...editedDiscount,
                          config: { ...editedDiscount.config, itemLimitPerDay: Number(e.target.value) }
                        })}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    ) : (
                      <span className="text-gray-900 font-medium">{discount.config.itemLimitPerDay}개</span>
                    )}
                  </div>
                )}
                {discount.config.totalItemLimit && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">총 상품 제한:</span>
                    {isEditing && editedDiscount ? (
                      <input
                        type="number"
                        value={editedDiscount.config.totalItemLimit}
                        onChange={(e) => setEditedDiscount({
                          ...editedDiscount,
                          config: { ...editedDiscount.config, totalItemLimit: Number(e.target.value) }
                        })}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    ) : (
                      <span className="text-gray-900 font-medium">{discount.config.totalItemLimit}개</span>
                    )}
                  </div>
                )}
                {discount.config.itemSelectionMethod && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">적용 방식:</span>
                    {isEditing && editedDiscount ? (
                      <select
                        value={editedDiscount.config.itemSelectionMethod}
                        onChange={(e) => setEditedDiscount({
                          ...editedDiscount,
                          config: { ...editedDiscount.config, itemSelectionMethod: e.target.value }
                        })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="highest_price">높은 가격 순</option>
                        <option value="most_expensive">높은 가격 순</option>
                        <option value="cheapest">낮은 가격 순</option>
                        <option value="first_come">먼저 담긴 순서</option>
                      </select>
                    ) : (
                      <span className="text-gray-900 font-medium">
                        {discount.config.itemSelectionMethod === 'highest_price' ||
                         discount.config.itemSelectionMethod === 'most_expensive' ?
                         '높은 가격 순' :
                         discount.config.itemSelectionMethod === 'cheapest' ?
                         '낮은 가격 순' :
                         '먼저 담긴 순서'}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
            {/* 레거시: 일일 사용 횟수 제한 */}
            {discount.dailyUsageLimit && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">일일 사용:</span>
                {isEditing && editedDiscount ? (
                  <input
                    type="number"
                    value={editedDiscount.dailyUsageLimit}
                    onChange={(e) => setEditedDiscount({ ...editedDiscount, dailyUsageLimit: Number(e.target.value) })}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                ) : (
                  <span className="text-gray-900 font-medium">{discount.dailyUsageLimit}회</span>
                )}
              </div>
            )}
            {discount.maxDiscountAmount && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">최대 할인:</span>
                {isEditing && editedDiscount ? (
                  <input
                    type="number"
                    value={editedDiscount.maxDiscountAmount}
                    onChange={(e) => setEditedDiscount({ ...editedDiscount, maxDiscountAmount: Number(e.target.value) })}
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="100"
                  />
                ) : (
                  <span className="text-gray-900 font-medium">{discount.maxDiscountAmount.toLocaleString()}원</span>
                )}
              </div>
            )}
            {discount.minPurchaseAmount && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">최소 구매 금액:</span>
                {isEditing && editedDiscount ? (
                  <input
                    type="number"
                    value={editedDiscount.minPurchaseAmount}
                    onChange={(e) => setEditedDiscount({ ...editedDiscount, minPurchaseAmount: Number(e.target.value) })}
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="100"
                  />
                ) : (
                  <span className="text-gray-900 font-medium">{discount.minPurchaseAmount.toLocaleString()}원</span>
                )}
              </div>
            )}
            {discount.constraints?.minPurchaseAmount && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">최소 구매 금액:</span>
                <span className="text-gray-900 font-medium">{discount.constraints.minPurchaseAmount.toLocaleString()}원</span>
              </div>
            )}
            {discount.constraints?.minQuantity && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">최소 구매 수량:</span>
                <span className="text-gray-900 font-medium">{discount.constraints.minQuantity}개</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditing && editedDiscount && (
        <div>
          <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={editedDiscount.isActive}
              onChange={(e) => setEditedDiscount({ ...editedDiscount, isActive: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <div className="font-semibold text-gray-900">활성화</div>
              <div className="text-sm text-gray-600">이 할인을 사용 가능하게 합니다</div>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}

// 적용 상품 탭
function ProductsTab({ discount, isEditing, editedDiscount, setEditedDiscount }: any) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IProduct[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [productInfoMap, setProductInfoMap] = useState<Map<string, IProduct>>(new Map());
  const [loadingProducts, setLoadingProducts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayProducts = isEditing && editedDiscount ? editedDiscount.applicableProducts : discount.applicableProducts;

  // 바코드 목록이 변경될 때마다 상품 정보 fetch
  useEffect(() => {
    const fetchProductInfo = async () => {
      if (displayProducts.length === 0) {
        setProductInfoMap(new Map());
        return;
      }

      setLoadingProducts(true);
      const newMap = new Map<string, IProduct>();

      try {
        // 병렬로 모든 바코드의 상품 정보 가져오기
        const promises = displayProducts.map(async (barcode: string) => {
          try {
            const response = await fetch(`/api/products?barcode=${barcode}`);
            if (response.ok) {
              const data = await response.json();
              // 검색 결과가 배열로 오므로 첫 번째 항목 사용
              if (data.success && data.data && data.data.length > 0) {
                newMap.set(barcode, data.data[0]);
              }
            }
          } catch (error) {
            console.error(`바코드 ${barcode} 정보 가져오기 실패:`, error);
          }
        });

        await Promise.all(promises);
        setProductInfoMap(newMap);
      } catch (error) {
        console.error('상품 정보 가져오기 실패:', error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProductInfo();
  }, [displayProducts]);

  const handleRemoveBarcode = (barcode: string) => {
    if (!editedDiscount) return;
    setEditedDiscount({
      ...editedDiscount,
      applicableProducts: editedDiscount.applicableProducts.filter((b: string) => b !== barcode),
    });
  };

  // 바코드 직접 추가
  const handleBarcodeAdd = async (barcode: string) => {
    if (!editedDiscount) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/products?barcode=${barcode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          const product = data.data[0];
          const barcodes = [...editedDiscount.applicableProducts];
          if (!barcodes.includes(product.barcode)) {
            barcodes.push(product.barcode);
            setEditedDiscount({ ...editedDiscount, applicableProducts: barcodes });
            setQuery('');
          } else {
            alert('이미 추가된 상품입니다.');
          }
        } else {
          alert('바코드를 찾을 수 없습니다.');
        }
      } else {
        alert('바코드를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('바코드 검색 실패:', error);
      alert('바코드 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 상품명 검색
  const handleSearch = async () => {
    if (query.length < 2) {
      alert('검색어를 2글자 이상 입력해주세요.');
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/products?name=${encodeURIComponent(query)}&limit=200`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
        setTotalCount(data.total || 0);
        setIsSearchModalOpen(true);
      }
    } catch (error) {
      console.error('상품 검색 실패:', error);
      alert('상품 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 통합 입력 처리
  const handleInput = () => {
    if (!query.trim()) return;

    // 13자리 숫자면 바코드로 처리
    if (query.match(/^\d{13}$/)) {
      handleBarcodeAdd(query);
    } else {
      // 아니면 검색
      handleSearch();
    }
  };

  // 상품 선택 시 바코드 추가
  const handleSelectProduct = (product: IProduct) => {
    if (!editedDiscount) return;

    const barcodes = [...editedDiscount.applicableProducts];
    if (!barcodes.includes(product.barcode)) {
      barcodes.push(product.barcode);
      setEditedDiscount({ ...editedDiscount, applicableProducts: barcodes });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">적용 상품 목록</h3>
        <p className="text-sm text-gray-600 mb-4">
          {displayProducts.length === 0
            ? '모든 상품에 적용됩니다.'
            : `${displayProducts.length}개의 상품에만 적용됩니다.`}
        </p>

        {isEditing && editedDiscount && (
          <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">상품 추가</h4>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleInput()}
                placeholder="상품명 또는 바코드 입력..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSearching}
              />
              <button
                onClick={handleInput}
                disabled={isSearching || !query.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSearching ? '처리 중...' : '추가/검색'}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              💡 상품명을 입력하고 Enter를 누르면 검색됩니다. 13자리 바코드는 바로 추가됩니다.
            </div>
          </div>
        )}

        {displayProducts.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-gray-600">상품 정보 불러오는 중...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {displayProducts.map((barcode: string, index: number) => {
                  const product = productInfoMap.get(barcode);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-4 bg-white px-4 py-3 rounded-lg border border-gray-200"
                    >
                      {/* 상품 이미지 */}
                      {product?.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}

                      {/* 상품 정보 */}
                      <div className="flex-1 min-w-0">
                        {product ? (
                          <>
                            <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                              {product.name}
                            </h4>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-mono text-gray-500">{barcode}</span>
                              <span className="font-bold text-blue-600">
                                {product.price.toLocaleString()}원
                              </span>
                              {product.brand && (
                                <span className="text-gray-500">{product.brand}</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-mono text-sm text-gray-900 mb-1">{barcode}</div>
                            <div className="text-xs text-gray-500">상품 정보를 찾을 수 없습니다</div>
                          </>
                        )}
                      </div>

                      {/* 삭제 버튼 */}
                      {isEditing && editedDiscount && (
                        <button
                          onClick={() => handleRemoveBarcode(barcode)}
                          className="flex-shrink-0 text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {discount.applicableCategories.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">적용 카테고리</h3>
          <div className="flex flex-wrap gap-2">
            {discount.applicableCategories.map((category: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 상품 검색 결과 모달 */}
      <ProductSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => {
          setIsSearchModalOpen(false);
          setQuery('');
          // 모달이 닫힌 후 입력란에 포커스
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }}
        searchQuery={query}
        searchResults={searchResults}
        totalCount={totalCount}
        isSearching={isSearching}
        onSelectProduct={handleSelectProduct}
      />
    </div>
  );
}

// 결제수단 탭
function PaymentTab({ discount, isEditing, editedDiscount, setEditedDiscount }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">지원 결제수단</h3>
        <div className="flex flex-wrap gap-2">
          {discount.paymentMethodNames.length > 0 ? (
            discount.paymentMethodNames.map((name: string, index: number) => (
              <span
                key={index}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="text-gray-500">모든 결제수단 사용 가능</span>
          )}
        </div>
      </div>

      {discount.paymentMethodRequirements && discount.paymentMethodRequirements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">결제수단 상세 조건</h3>
          <div className="space-y-4">
            {discount.paymentMethodRequirements.map((req: PaymentMethodRequirement, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="font-semibold text-gray-900 mb-2">
                  {PAYMENT_METHOD_NAMES[req.method] || req.method}
                </div>
                {req.cardRequirements && req.cardRequirements.length > 0 && (
                  <div className="space-y-2 ml-4">
                    {req.cardRequirements.map((cardReq: CardIssuerRequirement, cardIndex: number) => (
                      <div key={cardIndex} className="text-sm">
                        <div className="font-medium text-gray-700">{cardReq.issuer}</div>
                        {cardReq.allowedCardTypes && (
                          <div className="text-gray-600">
                            허용: {cardReq.allowedCardTypes.join(', ')}
                          </div>
                        )}
                        {cardReq.specialConditions && (
                          <div className="text-gray-600 text-xs mt-1">
                            {cardReq.specialConditions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {discount.blockedExceptions && discount.blockedExceptions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">차단된 결제 조합</h3>
          <div className="space-y-2">
            {discount.blockedExceptions.map((exception: PaymentMethodException, index: number) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="font-medium text-red-900">
                  {exception.method}
                  {exception.cardIssuer && ` / ${exception.cardIssuer}`}
                  {exception.cardType && ` / ${exception.cardType}`}
                </div>
                {exception.reason && (
                  <div className="text-sm text-red-700 mt-1">{exception.reason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {discount.allowedExceptions && discount.allowedExceptions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">허용된 예외 조합</h3>
          <div className="space-y-2">
            {discount.allowedExceptions.map((exception: PaymentMethodException, index: number) => (
              <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="font-medium text-green-900">
                  {exception.method}
                  {exception.cardIssuer && ` / ${exception.cardIssuer}`}
                  {exception.cardType && ` / ${exception.cardType}`}
                </div>
                {exception.reason && (
                  <div className="text-sm text-green-700 mt-1">{exception.reason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 제약 조건 탭
function RulesTab({ discount, isEditing, editedDiscount, setEditedDiscount }: any) {
  return (
    <div className="space-y-6">
      {discount.cannotCombineWithCategories && discount.cannotCombineWithCategories.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">중복 불가 카테고리</h3>
          <p className="text-sm text-gray-600 mb-3">다음 카테고리와 함께 사용할 수 없습니다:</p>
          <div className="flex flex-wrap gap-2">
            {discount.cannotCombineWithCategories.map((category: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium"
              >
                {DISCOUNT_CATEGORY_NAMES[category as keyof typeof DISCOUNT_CATEGORY_NAMES]}
              </span>
            ))}
          </div>
        </div>
      )}

      {discount.config.category === 'payment_event' && discount.config.requiresQR && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-semibold text-blue-900">QR코드 스캔 필수</div>
              <div className="text-sm text-blue-700 mt-1">
                포켓CU 멤버십 QR을 스캔한 후 결제해야 할인이 적용됩니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {discount.config.category === 'payment_event' && discount.config.baseAmountType === 'current_amount' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-semibold text-green-900">프로모션 적용 후 할인</div>
              <div className="text-sm text-green-700 mt-1">
                1+1, 2+1 등 프로모션이 적용된 금액을 기준으로 할인됩니다.
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">기타 정보</h3>
        <div className="space-y-2 text-sm">
          {discount.eventName && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 min-w-24">행사명:</span>
              <span className="text-gray-900 font-medium">{discount.eventName}</span>
            </div>
          )}
          {discount.eventMonth && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 min-w-24">행사 월:</span>
              <span className="text-gray-900 font-medium">{discount.eventMonth}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
