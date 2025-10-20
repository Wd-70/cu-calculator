'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadPromotions();
    checkAdminStatus();
  }, [statusFilter, verificationFilter]);

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

            {/* 필터 */}
            <div className="mt-6 flex gap-4">
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
            </div>
          </div>

          {/* 프로모션 목록 */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">로딩 중...</p>
            </div>
          ) : promotions.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <p className="text-gray-500 text-lg">프로모션이 없습니다.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {promotions.map((promotion) => (
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
          )}
        </div>
      </div>
    </>
  );
}
