'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUserAddress } from '@/lib/userAuth';
import Toast from '@/components/Toast';

export default function NewProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barcodeFromUrl = searchParams.get('barcode');

  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [formData, setFormData] = useState({
    barcode: barcodeFromUrl || '',
    name: '',
    price: '',
    category: '',
    brand: '',
    imageUrl: ''
  });

  // 이미지 검색 관련 상태
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [searchingImages, setSearchingImages] = useState(false);
  const [searchedImages, setSearchedImages] = useState<Array<{ url: string; thumbnail: string; title: string }>>([]);

  const categories = [
    '도시락/김밥',
    '삼각김밥',
    '샌드위치/햄버거',
    '식품',
    '과자',
    '아이스크림',
    '음료',
    '생활용품',
    '기타'
  ];

  useEffect(() => {
    const address = getCurrentUserAddress();
    setUserAddress(address);

    if (!address) {
      setToast({
        message: '상품 등록을 하려면 계정이 필요합니다.',
        type: 'error'
      });
    }
  }, []);

  const handleSearchImages = async () => {
    if (!formData.name.trim()) {
      setToast({
        message: '상품명을 먼저 입력해주세요.',
        type: 'error'
      });
      return;
    }

    try {
      setSearchingImages(true);
      setShowImageSearch(true);

      const response = await fetch('/api/search-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: formData.name.trim()
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSearchedImages(data.images || []);
        if (data.images.length === 0) {
          setToast({
            message: '검색 결과가 없습니다.',
            type: 'info'
          });
        }
      } else {
        setToast({
          message: data.error || '이미지 검색에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to search images:', error);
      setToast({
        message: '이미지 검색 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setSearchingImages(false);
    }
  };

  const handleSelectImage = (imageUrl: string) => {
    setFormData({ ...formData, imageUrl });
    setShowImageSearch(false);
    setToast({
      message: '이미지가 선택되었습니다!',
      type: 'success'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userAddress) {
      setToast({
        message: '상품 등록을 하려면 계정이 필요합니다.',
        type: 'error'
      });
      return;
    }

    // 필수 필드 검증
    if (!formData.barcode || !formData.name || !formData.price) {
      setToast({
        message: '바코드, 상품명, 가격은 필수 항목입니다.',
        type: 'error'
      });
      return;
    }

    // 가격 검증
    const price = parseInt(formData.price);
    if (isNaN(price) || price <= 0) {
      setToast({
        message: '올바른 가격을 입력해주세요.',
        type: 'error'
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: formData.barcode.trim(),
          name: formData.name.trim(),
          price,
          category: formData.category || null,
          brand: formData.brand.trim() || null,
          imageUrl: formData.imageUrl.trim() || null,
          createdBy: userAddress
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setToast({
          message: '상품이 성공적으로 등록되었습니다!',
          type: 'success'
        });

        // 2초 후 상품 상세 페이지로 이동
        setTimeout(() => {
          router.push(`/products?search=${formData.barcode}`);
        }, 2000);
      } else {
        setToast({
          message: data.error || '상품 등록에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Failed to create product:', error);
      setToast({
        message: '상품 등록 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/products" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">상품 등록</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {!userAddress ? (
          // 계정 없음
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">계정이 필요합니다</h2>
              <p className="text-gray-600 mb-6">
                상품 등록을 하려면 먼저 계정을 만들어주세요.
              </p>
              <Link
                href="/settings/account"
                className="inline-block px-6 py-3 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                계정 만들러 가기
              </Link>
            </div>
          </div>
        ) : (
          // 등록 폼
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">기본 정보</h2>

              <div className="space-y-4">
                {/* 바코드 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    바코드 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="바코드 번호를 입력하세요"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                    required
                  />
                </div>

                {/* 상품명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상품명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="상품명을 입력하세요"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                    required
                  />
                </div>

                {/* 가격 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    가격 (원) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="가격을 입력하세요"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                    required
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* 추가 정보 */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">추가 정보 (선택)</h2>

              <div className="space-y-4">
                {/* 카테고리 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                  >
                    <option value="">카테고리 선택</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* 브랜드 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">브랜드</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="브랜드를 입력하세요 (예: CU, 해태, 오뚜기)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                  />
                </div>

                {/* 이미지 URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">이미지 URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="이미지 URL을 입력하세요"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3FBF]"
                    />
                    <button
                      type="button"
                      onClick={handleSearchImages}
                      disabled={!formData.name.trim() || searchingImages}
                      className="px-4 py-3 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {searchingImages ? '검색 중...' : '이미지 검색'}
                    </button>
                  </div>
                  {formData.imageUrl && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-600 mb-2">미리보기</p>
                      <img
                        src={formData.imageUrl}
                        alt="상품 이미지"
                        className="w-full h-40 object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/300x300?text=Invalid+Image';
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    상품명을 입력한 후 &quot;이미지 검색&quot; 버튼을 눌러 이미지를 찾을 수 있습니다
                  </p>
                </div>
              </div>
            </div>

            {/* 안내 */}
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-bold text-blue-900 text-sm mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                안내
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 정확한 정보를 입력해주세요</li>
                <li>• 등록된 상품은 모든 사용자가 볼 수 있습니다</li>
                <li>• 기여자는 공개 주소로 기록됩니다: {userAddress?.slice(0, 10)}...{userAddress?.slice(-8)}</li>
              </ul>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <Link
                href="/products"
                className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-bold text-center hover:bg-gray-50 transition-colors"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-4 bg-gradient-to-r from-[#7C3FBF] to-[#9B5FD9] text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* 이미지 검색 모달 */}
      {showImageSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* 모달 헤더 */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">이미지 선택</h2>
                <button
                  onClick={() => setShowImageSearch(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                &quot;{formData.name}&quot; 검색 결과
              </p>
            </div>

            {/* 모달 본문 */}
            <div className="flex-1 overflow-y-auto p-6">
              {searchingImages ? (
                <div className="flex justify-center items-center py-20">
                  <div className="w-12 h-12 border-4 border-[#7C3FBF] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : searchedImages.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600">검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {searchedImages.map((image, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectImage(image.url)}
                      className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden hover:ring-4 hover:ring-[#7C3FBF] transition-all"
                    >
                      <img
                        src={image.thumbnail || image.url}
                        alt={image.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/300x300?text=Error';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-2">
                          <svg className="w-6 h-6 text-[#7C3FBF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowImageSearch(false)}
                className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
