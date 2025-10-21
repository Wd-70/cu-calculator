'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { IPromotion } from '@/lib/models/Promotion';
import { signWithTimestamp, getCurrentUserAddress } from '@/lib/userAuth';
import { checkIsAdminClient } from '@/lib/adminAuth';
import Toast from '@/components/Toast';
import PromotionJsonModal from '@/components/PromotionJsonModal';

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface MergeCandidate {
  _id: {
    promotionType: string;
    validFrom: Date;
    validTo: Date;
  };
  promotions: Array<{
    _id: string;
    name: string;
    barcode: string;
    verificationStatus: string;
    verificationCount: number;
    disputeCount: number;
  }>;
  count: number;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<IPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<IPromotion | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [showMergeCandidates, setShowMergeCandidates] = useState(false);
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [mergeGroupName, setMergeGroupName] = useState('');
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [loadingMergeCandidates, setLoadingMergeCandidates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [debouncedMergeSearchQuery, setDebouncedMergeSearchQuery] = useState('');

  useEffect(() => {
    loadPromotions();
    checkAdminStatus();
  }, [statusFilter, verificationFilter]);

  // 프로모션 목록 검색어 디바운싱 (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 병합 모달 검색어 디바운싱 (300ms - 더 빠른 반응)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMergeSearchQuery(mergeSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [mergeSearchQuery]);

  // 프로모션 목록 필터링 (useMemo로 최적화)
  const filteredPromotions = useMemo(() => {
    if (!debouncedSearchQuery) return promotions;
    const query = debouncedSearchQuery.toLowerCase();
    return promotions.filter((promotion) => {
      // 이름 검색
      if (promotion.name.toLowerCase().includes(query)) return true;
      // 설명 검색
      if (promotion.description?.toLowerCase().includes(query)) return true;
      // 바코드 검색
      if (promotion.applicableProducts?.some((barcode: string) =>
        barcode.toLowerCase().includes(query)
      )) return true;
      return false;
    });
  }, [promotions, debouncedSearchQuery]);

  // 병합 후보 필터링 (useMemo로 최적화)
  const filteredMergeCandidates = useMemo(() => {
    if (!debouncedMergeSearchQuery) return mergeCandidates;
    const query = debouncedMergeSearchQuery.toLowerCase();
    return mergeCandidates.filter((candidate) =>
      candidate.promotions.some(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.barcode.toLowerCase().includes(query)
      )
    );
  }, [mergeCandidates, debouncedMergeSearchQuery]);

  const checkAdminStatus = async () => {
    const address = getCurrentUserAddress();
    setUserAddress(address);
    if (address) {
      const adminStatus = await checkIsAdminClient(address);
      setIsAdmin(adminStatus);
    }
  };

  const loadPromotions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (verificationFilter !== 'all') params.append('verificationStatus', verificationFilter);

      const response = await fetch(`/api/promotions?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setPromotions(data.promotions);
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
      setToast({ show: true, message: '프로모션 로드 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (promotionId: string, adminVerify: boolean = false) => {
    if (!userAddress) {
      setToast({ show: true, message: '계정을 먼저 생성해주세요.', type: 'error' });
      return;
    }

    try {
      const { signature, timestamp } = await signWithTimestamp({
        action: 'verify_promotion',
        id: promotionId,
      });

      const response = await fetch(`/api/promotions/${promotionId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          timestamp,
          address: userAddress,
          adminVerify,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          show: true,
          message: adminVerify ? '✅ 관리자 검증 완료!' : '✅ 검증이 완료되었습니다!',
          type: 'success',
        });
        loadPromotions();
      } else {
        setToast({ show: true, message: data.error, type: 'error' });
      }
    } catch (error) {
      console.error('Error verifying promotion:', error);
      setToast({ show: true, message: '검증 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  const handleDispute = async (promotionId: string) => {
    if (!userAddress) {
      setToast({ show: true, message: '계정을 먼저 생성해주세요.', type: 'error' });
      return;
    }

    const reason = prompt('이의 제기 사유를 입력해주세요:');
    if (!reason) return;

    try {
      const { signature, timestamp } = await signWithTimestamp({
        action: 'dispute_promotion',
        id: promotionId,
        reason,
      });

      const response = await fetch(`/api/promotions/${promotionId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          timestamp,
          address: userAddress,
          reason,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({ show: true, message: '⚠️ 이의 제기가 완료되었습니다.', type: 'info' });
        loadPromotions();
      } else {
        setToast({ show: true, message: data.error, type: 'error' });
      }
    } catch (error) {
      console.error('Error disputing promotion:', error);
      setToast({ show: true, message: '이의 제기 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  const loadMergeCandidates = async () => {
    setLoadingMergeCandidates(true);
    try {
      const response = await fetch('/api/promotions/find-merge-candidates');
      const data = await response.json();

      if (data.success) {
        setMergeCandidates(data.candidates);
        setShowMergeCandidates(true);
        setMergeSearchQuery(''); // 검색어 초기화
      } else {
        setToast({ show: true, message: '병합 후보 로드 실패', type: 'error' });
      }
    } catch (error) {
      console.error('Error loading merge candidates:', error);
      setToast({ show: true, message: '병합 후보 로드 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setLoadingMergeCandidates(false);
    }
  };

  const handleMergePromotions = async () => {
    if (selectedForMerge.length < 2) {
      setToast({ show: true, message: '최소 2개 이상 선택해주세요.', type: 'error' });
      return;
    }

    if (!mergeGroupName.trim()) {
      setToast({ show: true, message: '병합 프로모션 이름을 입력해주세요.', type: 'error' });
      return;
    }

    if (!userAddress) {
      setToast({ show: true, message: '계정을 먼저 생성해주세요.', type: 'error' });
      return;
    }

    try {
      // 선택된 프로모션 정보 가져오기
      const selectedPromotionsData = selectedForMerge.map(id => {
        for (const candidate of mergeCandidates) {
          const promo = candidate.promotions.find(p => p._id.toString() === id);
          if (promo) return { ...promo, group: candidate._id };
        }
        return null;
      }).filter(Boolean);

      if (selectedPromotionsData.length === 0) return;

      const firstGroup = (selectedPromotionsData[0] as any).group;
      const allBarcodes = selectedPromotionsData.map((p: any) => p.barcode);

      const mergedData = {
        name: mergeGroupName,
        description: `${mergeGroupName} 프로모션 (${selectedForMerge.length}개 병합)`,
        promotionType: firstGroup.promotionType,
        buyQuantity: parseInt(firstGroup.promotionType.split('+')[0]),
        getQuantity: parseInt(firstGroup.promotionType.split('+')[1]),
        applicableType: 'products',
        applicableProducts: allBarcodes,
        giftSelectionType: 'same',
        giftConstraints: {},
        validFrom: firstGroup.validFrom,
        validTo: firstGroup.validTo,
        status: 'active',
        isActive: true,
        priority: 0,
      };

      const { signature, timestamp } = await signWithTimestamp({
        action: 'merge_promotions',
        promotionIds: selectedForMerge,
        ...mergedData,
      });

      const response = await fetch('/api/promotions/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promotionIds: selectedForMerge,
          mergedData,
          signature,
          timestamp,
          address: userAddress,
          comment: `${selectedForMerge.length}개 프로모션 병합`,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({ show: true, message: `✅ ${selectedForMerge.length}개 프로모션이 병합되었습니다!`, type: 'success' });
        setShowMergeCandidates(false);
        setSelectedForMerge([]);
        setMergeGroupName('');
        loadPromotions();
      } else {
        setToast({ show: true, message: data.error, type: 'error' });
      }
    } catch (error) {
      console.error('Error merging promotions:', error);
      setToast({ show: true, message: '병합 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  const getVerificationBadge = (promotion: IPromotion) => {
    const badges = {
      verified: {
        icon: '✅',
        text: '검증됨',
        color: 'bg-green-100 text-green-800',
        tooltip: `${promotion.verificationCount}명이 검증함`,
      },
      pending: {
        icon: '⏳',
        text: '검증 중',
        color: 'bg-yellow-100 text-yellow-800',
        tooltip: `${promotion.verificationCount}명 검증`,
      },
      unverified: {
        icon: '❓',
        text: '미검증',
        color: 'bg-gray-100 text-gray-800',
        tooltip: '검증이 필요합니다',
      },
      disputed: {
        icon: '⚠️',
        text: '논란',
        color: 'bg-red-100 text-red-800',
        tooltip: `${promotion.disputeCount}명이 이의 제기함`,
      },
    };

    const badge = badges[promotion.verificationStatus];

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badge.color}`} title={badge.tooltip}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      active: { text: '활성', color: 'bg-blue-100 text-blue-800' },
      expired: { text: '만료', color: 'bg-gray-100 text-gray-800' },
      merged: { text: '병합됨', color: 'bg-purple-100 text-purple-800' },
      archived: { text: '보관', color: 'bg-gray-200 text-gray-600' },
    };

    const badge = badges[status] || badges.active;

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}

      {showJsonModal && (
        <PromotionJsonModal
          isOpen={showJsonModal}
          onClose={() => {
            setShowJsonModal(false);
            setSelectedPromotion(null);
          }}
          promotion={selectedPromotion}
          onSave={loadPromotions}
          allPromotions={promotions}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  🎁 프로모션 관리
                </h1>
                <p className="text-gray-600">
                  1+1, 2+1 등의 증정 프로모션을 관리하고 검증합니다
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setSelectedPromotion(null);
                    setShowJsonModal(true);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg"
                >
                  ➕ 프로모션 생성
                </button>
              )}
            </div>

            {/* 검색 바 */}
            <div className="mt-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="프로모션 이름 또는 상품 바코드로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-12 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 필터 */}
            <div className="mt-4 flex gap-4 items-end flex-wrap">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상태
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">전체</option>
                  <option value="active">활성</option>
                  <option value="expired">만료</option>
                  <option value="merged">병합됨</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  검증 상태
                </label>
                <select
                  value={verificationFilter}
                  onChange={(e) => setVerificationFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">전체</option>
                  <option value="verified">검증됨</option>
                  <option value="pending">검증 중</option>
                  <option value="unverified">미검증</option>
                  <option value="disputed">논란</option>
                </select>
              </div>
              {isAdmin && (
                <button
                  onClick={loadMergeCandidates}
                  className="px-6 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-pink-600 transition-all shadow-md"
                >
                  🔀 병합 후보 찾기
                </button>
              )}
            </div>
          </div>

          {/* 프로모션 목록 */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">로딩 중...</p>
            </div>
          ) : filteredPromotions.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                <p className="text-gray-500 text-lg">
                  {debouncedSearchQuery
                    ? `"${debouncedSearchQuery}"에 대한 검색 결과가 없습니다.`
                    : '프로모션이 없습니다.'
                  }
                </p>
                {debouncedSearchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
                  >
                    검색 초기화
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-6">
                {debouncedSearchQuery && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 text-sm">
                      <strong>{filteredPromotions.length}개</strong>의 프로모션을 찾았습니다.
                    </p>
                  </div>
                )}
                {filteredPromotions.map((promotion) => (
                <div
                  key={promotion._id.toString()}
                  className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {promotion.name}
                        </h3>
                        {getVerificationBadge(promotion)}
                        {getStatusBadge(promotion.status)}
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                          {promotion.promotionType}
                        </span>
                      </div>
                      <p className="text-gray-600">{promotion.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-500">적용 대상:</span>
                      <span className="ml-2 font-medium">
                        {promotion.applicableType === 'products' && '상품'}
                        {promotion.applicableType === 'categories' && '카테고리'}
                        {promotion.applicableType === 'brands' && '브랜드'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">증정 방식:</span>
                      <span className="ml-2 font-medium">
                        {promotion.giftSelectionType === 'same' ? '동일 그룹' : '교차증정'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">유효 기간:</span>
                      <span className="ml-2 font-medium">
                        {new Date(promotion.validFrom).toLocaleDateString()} ~{' '}
                        {new Date(promotion.validTo).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">검증:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {promotion.verificationCount}
                      </span>
                      <span className="mx-1 text-gray-400">/</span>
                      <span className="font-medium text-red-600">
                        {promotion.disputeCount}
                      </span>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    {userAddress && !promotion.verifiedBy?.includes(userAddress) && (
                      <button
                        onClick={() => handleVerify(promotion._id.toString())}
                        className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                      >
                        ✓ 검증하기
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleVerify(promotion._id.toString(), true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        ✅ 관리자 검증
                      </button>
                    )}
                    {userAddress && !promotion.disputedBy?.includes(userAddress) && (
                      <button
                        onClick={() => handleDispute(promotion._id.toString())}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                      >
                        ⚠ 이의 제기
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setSelectedPromotion(promotion);
                          setShowJsonModal(true);
                        }}
                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                      >
                        🔧 수정
                      </button>
                    )}
                    <div className="flex-1"></div>
                    <span className="text-xs text-gray-500 self-center">
                      생성: {promotion.createdBy.slice(0, 10)}...
                    </span>
                  </div>
                </div>
              ))}
              </div>
            )
          }
        </div>
      </div>

      {/* 병합 후보 모달 */}
      {showMergeCandidates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 모달 헤더 */}
            <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">🔀 병합 가능한 프로모션 그룹</h2>
                <button
                  onClick={() => {
                    setShowMergeCandidates(false);
                    setMergeSearchQuery('');
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="mt-2 text-white text-opacity-90">
                동일한 타입과 기간을 가진 프로모션을 하나로 통합할 수 있습니다
              </p>
            </div>

            {/* 검색 바 */}
            <div className="p-6 border-b border-gray-200">
              <div className="relative">
                <input
                  type="text"
                  placeholder="프로모션 이름 또는 바코드로 검색..."
                  value={mergeSearchQuery}
                  onChange={(e) => setMergeSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-12 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* 병합 후보 목록 */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingMergeCandidates ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
                  <p className="mt-4 text-gray-600">병합 후보를 찾는 중...</p>
                </div>
              ) : mergeCandidates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">병합 가능한 프로모션 그룹이 없습니다.</p>
                  <p className="text-gray-400 text-sm mt-2">크롤링으로 생성된 개별 프로모션이 2개 이상 있어야 합니다.</p>
                </div>
              ) : filteredMergeCandidates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">검색 결과가 없습니다.</p>
                  <p className="text-gray-400 text-sm mt-2">&quot;{debouncedMergeSearchQuery}&quot;와 일치하는 병합 후보가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredMergeCandidates.map((candidate, idx) => (
                    <MergeCandidateGroup
                      key={idx}
                      candidate={candidate}
                      searchQuery={debouncedMergeSearchQuery}
                      onMerge={async (promotionIds, mergedName) => {
                        await handleMergePromotions();
                      }}
                      userAddress={userAddress}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 병합 후보 그룹 컴포넌트
function MergeCandidateGroup({
  candidate,
  searchQuery,
  onMerge,
  userAddress,
}: {
  candidate: MergeCandidate;
  searchQuery: string;
  onMerge: (promotionIds: string[], mergedName: string) => Promise<void>;
  userAddress: string | null;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergedName, setMergedName] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // 필터링된 프로모션 리스트 (성능 최적화)
  const filteredPromotions = useMemo(() => {
    if (!searchQuery) return candidate.promotions;
    const query = searchQuery.toLowerCase();
    return candidate.promotions.filter(
      (promo) =>
        promo.name.toLowerCase().includes(query) ||
        promo.barcode.toLowerCase().includes(query)
    );
  }, [candidate.promotions, searchQuery]);

  const handleMerge = async () => {
    if (selectedIds.length < 2) {
      alert('최소 2개 이상 선택해주세요.');
      return;
    }
    if (!mergedName.trim()) {
      alert('병합 후 프로모션 이름을 입력해주세요.');
      return;
    }
    if (!userAddress) {
      alert('계정을 먼저 생성해주세요.');
      return;
    }

    setIsMerging(true);
    try {
      const selectedPromotions = candidate.promotions.filter((p) =>
        selectedIds.includes(p._id)
      );
      const allBarcodes = selectedPromotions.map((p) => p.barcode);

      const mergedData = {
        name: mergedName,
        description: `${mergedName} (${selectedIds.length}개 병합)`,
        promotionType: candidate._id.promotionType,
        buyQuantity: parseInt(candidate._id.promotionType.split('+')[0]),
        getQuantity: parseInt(candidate._id.promotionType.split('+')[1]),
        applicableType: 'products',
        applicableProducts: allBarcodes,
        giftSelectionType: 'same',
        giftConstraints: {},
        validFrom: candidate._id.validFrom,
        validTo: candidate._id.validTo,
        status: 'active',
        isActive: true,
        priority: 0,
      };

      const { signWithTimestamp } = await import('@/lib/userAuth');
      const { signature, timestamp } = await signWithTimestamp({
        action: 'merge_promotions',
        promotionIds: selectedIds,
        ...mergedData,
      });

      const response = await fetch('/api/promotions/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promotionIds: selectedIds,
          mergedData,
          signature,
          timestamp,
          address: userAddress,
          comment: `${selectedIds.length}개 프로모션 병합`,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ ${selectedIds.length}개 프로모션이 병합되었습니다!`);
        window.location.reload(); // 페이지 새로고침
      } else {
        alert(`오류: ${data.error}`);
      }
    } catch (error) {
      console.error('Error merging promotions:', error);
      alert('병합 중 오류가 발생했습니다.');
    } finally {
      setIsMerging(false);
    }
  };

  const highlightText = useCallback(
    (text: string) => {
      if (!searchQuery) return text;
      const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === searchQuery.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200">
            {part}
          </mark>
        ) : (
          part
        )
      );
    },
    [searchQuery]
  );

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-orange-300 transition-colors">
      {/* 그룹 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="px-4 py-2 bg-gradient-to-r from-orange-100 to-pink-100 text-orange-700 rounded-full text-sm font-bold">
            {candidate._id.promotionType}
          </span>
          <span className="text-sm text-gray-600">
            {new Date(candidate._id.validFrom).toLocaleDateString()} ~{' '}
            {new Date(candidate._id.validTo).toLocaleDateString()}
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            {candidate.count}개 발견
          </span>
          {selectedIds.length > 0 && (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
              {selectedIds.length}개 선택됨
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedIds(filteredPromotions.map((p) => p._id))}
            className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
          >
            전체 선택
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium"
          >
            선택 해제
          </button>
        </div>
      </div>

      {/* 프로모션 목록 */}
      <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
        {filteredPromotions.map((promo) => (
            <label
              key={promo._id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(promo._id)}
                onChange={() => toggleSelection(promo._id)}
                className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {highlightText(promo.name)}
                </div>
                <div className="text-sm text-gray-500">
                  바코드: {highlightText(promo.barcode)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {promo.verificationStatus === 'verified' && (
                  <span className="text-green-600 text-xs">✅ 검증됨</span>
                )}
                {promo.verificationStatus === 'pending' && (
                  <span className="text-yellow-600 text-xs">⏳ 검증 중</span>
                )}
                {promo.verificationStatus === 'disputed' && (
                  <span className="text-red-600 text-xs">⚠️ 논란</span>
                )}
              </div>
            </label>
          ))}
      </div>

      {/* 병합 컨트롤 */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="병합 후 프로모션 이름 (예: 코카콜라 제품 1+1)"
            value={mergedName}
            onChange={(e) => setMergedName(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <button
            onClick={handleMerge}
            disabled={isMerging || selectedIds.length < 2}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            {isMerging ? '병합 중...' : `병합하기 (${selectedIds.length}개)`}
          </button>
        </div>
        {selectedIds.length < 2 && (
          <p className="text-sm text-red-500 mt-2">최소 2개 이상 선택해주세요</p>
        )}
      </div>
    </div>
  );
}
