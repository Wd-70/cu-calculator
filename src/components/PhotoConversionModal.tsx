'use client';

import { useState, useEffect } from 'react';

interface PendingPhoto {
  promotionId: string;
  promotionName: string;
  photoCount: number;
  photos: Array<{
    filename: string;
    uploadedAt: string;
  }>;
}

interface PhotoConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string | null;
}

export default function PhotoConversionModal({
  isOpen,
  onClose,
  userAddress,
}: PhotoConversionModalProps) {
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversionData, setConversionData] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'import'>('list');

  useEffect(() => {
    if (isOpen) {
      loadPendingPhotos();
    }
  }, [isOpen]);

  const loadPendingPhotos = async () => {
    if (!userAddress) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/promotions/pending-photos?accountAddress=${userAddress}`);
      const data = await response.json();

      if (data.success) {
        setPendingPhotos(data.pendingPhotos);
      }
    } catch (error) {
      console.error('Error loading pending photos:', error);
      alert('사진 목록 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTaskInfo = () => {
    const taskInfo = `
# 프로모션 사진 변환 요청

data/PROMOTION_CONVERSION_GUIDE.md 파일을 읽고, 다음 프로모션들의 사진을 변환해주세요.

## 변환 대기 중인 프로모션 (${pendingPhotos.length}개)

${pendingPhotos.map((p, idx) => `
### ${idx + 1}. ${p.promotionName}
- Promotion ID: ${p.promotionId}
- 사진 개수: ${p.photoCount}장
- 사진 위치: data/promotions/${p.promotionId}/
${p.photos.map(photo => `  - ${photo.filename}`).join('\n')}
`).join('\n')}

---

위 가이드에 따라 batch_{timestamp}.json 파일을 생성해서 data/promotions/conversion-batches/ 폴더에 저장해주세요.
`.trim();

    navigator.clipboard.writeText(taskInfo);
    alert('✅ 변환 요청 정보가 클립보드에 복사되었습니다!\n\nClaude에게 붙여넣기 해주세요.');
  };

  const handleImport = async () => {
    if (!conversionData.trim()) {
      alert('변환 데이터를 입력해주세요.');
      return;
    }

    if (!userAddress) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const jsonData = JSON.parse(conversionData);

      setImporting(true);
      const response = await fetch('/api/admin/promotions/import-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddress: userAddress,
          conversionData: jsonData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ 변환 데이터가 성공적으로 임포트되었습니다!\n\n업데이트된 프로모션: ${data.updatedCount}개`);
        setConversionData('');
        setActiveTab('list');
        loadPendingPhotos();
        onClose();
      } else {
        alert('❌ 임포트 실패: ' + data.error);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      if (error instanceof SyntaxError) {
        alert('❌ JSON 형식이 올바르지 않습니다.');
      } else {
        alert('❌ 임포트 중 오류가 발생했습니다.');
      }
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">📷 사진 데이터 변환</h2>
              <p className="text-blue-100 text-sm">
                수집된 POS 사진을 프로모션 데이터로 변환합니다
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

        {/* 탭 */}
        <div className="border-b border-gray-200">
          <div className="flex gap-1 p-4">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'list'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 변환 대기 목록
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'import'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📥 데이터 임포트
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'list' && (
            <div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                  <p className="mt-4 text-gray-600">로딩 중...</p>
                </div>
              ) : pendingPhotos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">변환 대기 중인 사진이 없습니다.</p>
                  <p className="text-gray-400 text-sm mt-2">프로모션 상세 페이지에서 사진을 촬영해주세요.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">📸 변환 대기 중</h3>
                    <p className="text-blue-800 text-sm">
                      총 <strong>{pendingPhotos.length}개</strong> 프로모션의 사진이 변환을 기다리고 있습니다.
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {pendingPhotos.map((photo) => (
                      <div
                        key={photo.promotionId}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{photo.promotionName}</h4>
                            <p className="text-xs text-gray-500 font-mono mt-1">
                              ID: {photo.promotionId}
                            </p>
                            <p className="text-sm text-gray-600 mt-2">
                              📷 {photo.photoCount}장의 사진
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-300 pt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">🔄 변환 작업 순서</h3>
                    <ol className="space-y-2 text-sm text-gray-700">
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-600">1.</span>
                        <span>"변환 요청 복사" 버튼을 클릭하여 작업 정보를 복사합니다.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-600">2.</span>
                        <span>Claude에게 복사한 내용을 붙여넣기합니다.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-600">3.</span>
                        <span>Claude가 생성한 JSON 데이터를 받습니다.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-600">4.</span>
                        <span>"데이터 임포트" 탭에서 JSON을 붙여넣고 임포트합니다.</span>
                      </li>
                    </ol>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'import' && (
            <div>
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ 주의사항</h3>
                <ul className="text-yellow-800 text-sm space-y-1">
                  <li>• Claude가 생성한 JSON 데이터를 정확히 붙여넣어 주세요</li>
                  <li>• 임포트 전에 데이터를 검토하세요</li>
                  <li>• 임포트는 되돌릴 수 없습니다</li>
                </ul>
              </div>

              <textarea
                value={conversionData}
                onChange={(e) => setConversionData(e.target.value)}
                placeholder='Claude가 생성한 JSON 데이터를 여기에 붙여넣기 하세요.

예시:
{
  "batchId": "batch_2025-10-22_15-30-45",
  "conversions": [
    {
      "sourcePromotionId": "...",
      "action": "update_and_merge",
      ...
    }
  ]
}'
                className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
              />
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 p-6 flex gap-3">
          {activeTab === 'list' && pendingPhotos.length > 0 && (
            <button
              onClick={handleCopyTaskInfo}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md"
            >
              📋 변환 요청 복사
            </button>
          )}
          {activeTab === 'import' && (
            <button
              onClick={handleImport}
              disabled={importing || !conversionData.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {importing ? '임포트 중...' : '📥 데이터 임포트'}
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
  );
}
