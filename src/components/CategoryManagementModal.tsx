'use client';

import { useState, useEffect } from 'react';
import { UNIFIED_CATEGORIES, CATEGORY_MAPPING, type UnifiedCategory } from '@/lib/constants/categoryMapping';

interface Product {
  _id: string;
  name: string;
  barcode: string;
  price: number;
}

interface UnmappedCategory {
  category: string;
  productCount: number;
  unmappedProductCount?: number; // 상세 검사 시에만 존재
  sampleProducts: Product[];
}

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoryManagementModal({
  isOpen,
  onClose,
}: CategoryManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'mapping' | 'unmapped'>('mapping');
  const [loading, setLoading] = useState(false);
  const [unmappedData, setUnmappedData] = useState<{
    detailed?: boolean;
    totalCategories: number;
    mappedCount: number;
    unmappedCount: number;
    totalUnmappedProducts?: number; // 상세 검사 시에만 존재
    unmappedCategories: UnmappedCategory[];
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailedCheck, setDetailedCheck] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'unmapped' && !unmappedData) {
      fetchUnmappedCategories(false);
    }
  }, [isOpen, activeTab]);

  const fetchUnmappedCategories = async (detailed: boolean) => {
    setLoading(true);
    try {
      const url = `/api/admin/categories/unmapped${detailed ? '?detailed=true' : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setUnmappedData(data);
        setDetailedCheck(detailed);
      }
    } catch (error) {
      console.error('Error fetching unmapped categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDetailedCheckToggle = () => {
    const newDetailedCheck = !detailedCheck;
    fetchUnmappedCategories(newDetailedCheck);
  };

  if (!isOpen) return null;

  // 매핑 현황 탭: 통합 카테고리별로 그룹화
  const getMappingInfo = () => {
    const result: Record<UnifiedCategory, string[]> = {} as any;

    // 초기화
    UNIFIED_CATEGORIES.forEach(cat => {
      result[cat] = [];
    });

    // 매핑 테이블을 순회하며 그룹화
    Object.entries(CATEGORY_MAPPING).forEach(([original, unified]) => {
      if (!result[unified]) {
        result[unified] = [];
      }
      result[unified].push(original);
    });

    return result;
  };

  const mappingInfo = getMappingInfo();

  // 검색 필터링
  const filteredMappingInfo = Object.entries(mappingInfo).filter(([unified, originals]) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      unified.toLowerCase().includes(searchLower) ||
      originals.some(o => o.toLowerCase().includes(searchLower))
    );
  });

  const filteredUnmappedCategories = unmappedData?.unmappedCategories.filter(item =>
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">📂 카테고리 관리</h2>
              <p className="text-purple-100 text-sm">
                카테고리 매핑 현황 및 미매핑 카테고리 검사
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

        {/* 탭 */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('mapping')}
              className={`px-6 py-4 font-semibold transition-all border-b-2 ${
                activeTab === 'mapping'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 매핑 현황
            </button>
            <button
              onClick={() => setActiveTab('unmapped')}
              className={`px-6 py-4 font-semibold transition-all border-b-2 ${
                activeTab === 'unmapped'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🔍 미매핑 검사
              {unmappedData && unmappedData.unmappedCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {unmappedData.unmappedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 검색바 */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="카테고리 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              {filteredMappingInfo.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  검색 결과가 없습니다.
                </div>
              ) : (
                filteredMappingInfo.map(([unified, originals]) => (
                  <div key={unified} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">{unified}</h3>
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                          {originals.length}개
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-white">
                      <div className="flex flex-wrap gap-2">
                        {originals.map((original) => (
                          <span
                            key={original}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                          >
                            {original}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'unmapped' && (
            <div>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-gray-600">검사 중...</p>
                </div>
              ) : unmappedData ? (
                <div className="space-y-6">
                  {/* 상세 검사 토글 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-blue-900 mb-1">🔍 상세 검사</div>
                        <div className="text-sm text-blue-700">
                          {detailedCheck
                            ? '모든 카테고리가 미매핑인 상품만 표시합니다'
                            : '미매핑 카테고리를 가진 모든 상품을 표시합니다'}
                        </div>
                      </div>
                      <button
                        onClick={handleDetailedCheckToggle}
                        className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                          detailedCheck
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-50'
                        }`}
                      >
                        {detailedCheck ? '일반 검사로 전환' : '상세 검사 시작'}
                      </button>
                    </div>
                  </div>

                  {/* 요약 정보 */}
                  <div className={`grid ${detailedCheck ? 'grid-cols-4' : 'grid-cols-3'} gap-4`}>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-blue-600 text-sm font-medium mb-1">전체 카테고리</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {unmappedData.totalCategories}
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-green-600 text-sm font-medium mb-1">매핑 완료</div>
                      <div className="text-2xl font-bold text-green-900">
                        {unmappedData.mappedCount}
                      </div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-red-600 text-sm font-medium mb-1">
                        {detailedCheck ? '문제 카테고리' : '미매핑'}
                      </div>
                      <div className="text-2xl font-bold text-red-900">
                        {unmappedData.unmappedCount}
                      </div>
                    </div>
                    {detailedCheck && unmappedData.totalUnmappedProducts !== undefined && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="text-orange-600 text-sm font-medium mb-1">문제 상품</div>
                        <div className="text-2xl font-bold text-orange-900">
                          {unmappedData.totalUnmappedProducts}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 미매핑 카테고리 목록 */}
                  {filteredUnmappedCategories.length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                      <div className="text-4xl mb-2">✨</div>
                      <div className="font-bold text-green-900 mb-1">
                        {searchTerm ? '검색 결과가 없습니다' : '모든 카테고리가 매핑되어 있습니다!'}
                      </div>
                      {!searchTerm && (
                        <div className="text-sm text-green-700">
                          데이터베이스의 모든 카테고리가 통합 카테고리로 매핑되었습니다.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-gray-900">
                        미매핑 카테고리 ({filteredUnmappedCategories.length}개)
                      </h3>
                      {filteredUnmappedCategories.map((item) => (
                        <div key={item.category} className="border border-red-200 rounded-lg overflow-hidden">
                          <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                            <div className="flex items-center justify-between">
                              <h4 className="text-lg font-bold text-red-900">{item.category}</h4>
                              <div className="flex gap-2">
                                {detailedCheck && item.unmappedProductCount !== undefined && (
                                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                                    문제 상품 {item.unmappedProductCount}개
                                  </span>
                                )}
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                                  전체 {item.productCount}개
                                </span>
                              </div>
                            </div>
                            {detailedCheck && item.unmappedProductCount !== undefined && item.unmappedProductCount < item.productCount && (
                              <div className="mt-2 text-xs text-red-700">
                                ℹ️ {item.productCount - item.unmappedProductCount}개 상품은 다른 매핑된 카테고리를 가지고 있습니다
                              </div>
                            )}
                          </div>
                          <div className="p-4 bg-white">
                            <div className="text-sm font-medium text-gray-700 mb-3">
                              샘플 상품 (최대 10개):
                            </div>
                            <div className="space-y-2">
                              {item.sampleProducts.map((product) => (
                                <div
                                  key={product._id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">
                                      {product.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {product.barcode}
                                    </div>
                                  </div>
                                  <div className="ml-4 text-sm font-semibold text-gray-700">
                                    {product.price.toLocaleString()}원
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  데이터를 불러오는 중...
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {activeTab === 'mapping' && `총 ${UNIFIED_CATEGORIES.length}개 통합 카테고리`}
            {activeTab === 'unmapped' && unmappedData && `매핑률: ${((unmappedData.mappedCount / unmappedData.totalCategories) * 100).toFixed(1)}%`}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
