'use client';

import { useState, useEffect } from 'react';
import CameraCapture from './CameraCapture';

interface PendingPhoto {
  promotionId?: string;
  promotionName?: string;
  sessionId?: string;
  sessionName?: string;
  photoCount: number;
  photos: Array<{
    filename: string;
    uploadedAt: string;
  }>;
  createdAt?: string;
  lastUpdated?: string;
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
  const [activeTab, setActiveTab] = useState<'capture' | 'list' | 'import'>('capture');

  // 배치 파일 관련 상태
  const [batchFiles, setBatchFiles] = useState<any[]>([]);
  const [selectedBatchFile, setSelectedBatchFile] = useState<string>('');
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');

  // 사진 촬영 관련 상태
  const [showCamera, setShowCamera] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPendingPhotos();
      loadBatchFiles();
      // 새 세션 ID 생성
      if (!currentSessionId) {
        setCurrentSessionId(generateSessionId());
      }
    }
  }, [isOpen]);

  const generateSessionId = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return `session_${timestamp}`;
  };

  const loadPendingPhotos = async () => {
    if (!userAddress) return;

    setLoading(true);
    try {
      // 프로모션 기반 사진들
      const promotionResponse = await fetch(`/api/admin/promotions/pending-photos?accountAddress=${userAddress}`);
      const promotionData = await promotionResponse.json();

      // 독립 세션 사진들
      const sessionResponse = await fetch(`/api/admin/photos/list-sessions?accountAddress=${userAddress}`);
      const sessionData = await sessionResponse.json();

      const allPending: PendingPhoto[] = [];

      if (promotionData.success && promotionData.pendingPhotos) {
        allPending.push(...promotionData.pendingPhotos);
      }

      if (sessionData.success && sessionData.sessions) {
        allPending.push(...sessionData.sessions);
      }

      setPendingPhotos(allPending);
    } catch (error) {
      console.error('Error loading pending photos:', error);
      alert('사진 목록 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadBatchFiles = async () => {
    if (!userAddress) return;

    setLoadingBatches(true);
    try {
      const response = await fetch(`/api/admin/promotions/list-conversion-batches?accountAddress=${userAddress}`);
      const data = await response.json();

      if (data.success) {
        setBatchFiles(data.batches || []);
      }
    } catch (error) {
      console.error('Error loading batch files:', error);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleSelectBatchFile = async (filename: string) => {
    if (!userAddress) return;

    setSelectedBatchFile(filename);

    try {
      const response = await fetch(`/api/admin/promotions/read-conversion-batch?accountAddress=${userAddress}&filename=${encodeURIComponent(filename)}`);
      const data = await response.json();

      if (data.success) {
        setConversionData(JSON.stringify(data.data, null, 2));
      } else {
        alert('파일 읽기 실패: ' + data.error);
      }
    } catch (error) {
      console.error('Error reading batch file:', error);
      alert('파일 읽기 중 오류가 발생했습니다.');
    }
  };

  const handlePhotoCapture = async (blob: Blob, filename: string) => {
    if (!userAddress) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', blob, filename);
      formData.append('sessionId', currentSessionId);
      formData.append('sessionName', sessionName || '이름 없는 세션');
      formData.append('accountAddress', userAddress);

      const response = await fetch('/api/admin/photos/upload-standalone', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setCapturedPhotos((prev) => [...prev, filename]);
        setShowCamera(false);
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

  const handleStartNewSession = () => {
    setCurrentSessionId(generateSessionId());
    setSessionName('');
    setCapturedPhotos([]);
  };

  const handleFinishCapture = () => {
    setCapturedPhotos([]);
    setCurrentSessionId(generateSessionId());
    setSessionName('');
    setActiveTab('list');
    loadPendingPhotos();
  };

  const handleCopyTaskInfo = () => {
    const taskInfo = `
# 프로모션 사진 변환 요청

data/PROMOTION_CONVERSION_GUIDE.md 파일을 읽고, 다음 사진들을 변환해주세요.

## 변환 대기 중인 사진 (${pendingPhotos.length}개)

${pendingPhotos.map((p, idx) => {
  if (p.promotionId) {
    return `
### ${idx + 1}. ${p.promotionName} (프로모션)
- Promotion ID: ${p.promotionId}
- 사진 개수: ${p.photoCount}장
- 사진 위치: data/promotions/${p.promotionId}/
${p.photos.map(photo => `  - ${photo.filename}`).join('\n')}
`;
  } else {
    return `
### ${idx + 1}. ${p.sessionName} (독립 촬영)
- Session ID: ${p.sessionId}
- 사진 개수: ${p.photoCount}장
- 사진 위치: data/photos/${p.sessionId}/
${p.photos.map(photo => `  - ${photo.filename}`).join('\n')}
`;
  }
}).join('\n')}

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
        setSelectedBatchFile('');
        setActiveTab('list');
        loadPendingPhotos();
        loadBatchFiles(); // 배치 파일 목록 갱신
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">📷 사진 관리 & 변환</h2>
              <p className="text-blue-100 text-sm">
                POS 사진 촬영 및 데이터 변환
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
              onClick={() => setActiveTab('capture')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'capture'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📸 사진 촬영
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'list'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 변환 대기 ({pendingPhotos.length})
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
          {/* 사진 촬영 탭 */}
          {activeTab === 'capture' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">💡 사진 촬영 가이드</h3>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• 한 정보에 대해 여러 사진을 촬영할 수 있습니다</li>
                  <li>• 촬영 후 "다음 정보 촬영"으로 새로운 정보를 촬영할 수 있습니다</li>
                  <li>• POS 화면이 잘 보이도록 촬영해주세요</li>
                </ul>
              </div>

              {/* 세션 정보 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  촬영 정보 이름 (선택사항)
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="예: 2+1 아이스크림 행사"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  나중에 구분하기 쉽도록 이름을 입력하세요
                </p>
              </div>

              {/* 촬영된 사진 목록 */}
              {capturedPhotos.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">
                    ✅ 촬영된 사진 ({capturedPhotos.length}장)
                  </h4>
                  <div className="space-y-1">
                    {capturedPhotos.map((filename, idx) => (
                      <div key={idx} className="text-sm text-green-800 font-mono">
                        📷 {filename}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 촬영 버튼 */}
              <button
                onClick={() => setShowCamera(true)}
                disabled={uploading}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {uploading ? '업로드 중...' : '📸 사진 촬영하기'}
              </button>

              {/* 세션 관리 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={handleStartNewSession}
                  disabled={capturedPhotos.length === 0}
                  className="flex-1 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ➡️ 다음 정보 촬영
                </button>
                <button
                  onClick={handleFinishCapture}
                  disabled={capturedPhotos.length === 0}
                  className="flex-1 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ✅ 촬영 완료
                </button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                현재 세션 ID: {currentSessionId}
              </div>
            </div>
          )}

          {/* 변환 대기 목록 탭 */}
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
                  <p className="text-gray-400 text-sm mt-2">사진 촬영 탭에서 사진을 촬영해주세요.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">📸 변환 대기 중</h3>
                    <p className="text-blue-800 text-sm">
                      총 <strong>{pendingPhotos.length}개</strong> 항목의 사진이 변환을 기다리고 있습니다.
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {pendingPhotos.map((photo, idx) => (
                      <div
                        key={photo.promotionId || photo.sessionId}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">
                                {photo.promotionName || photo.sessionName}
                              </h4>
                              {photo.promotionId ? (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                  프로모션
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs rounded-full">
                                  독립 촬영
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 font-mono mt-1">
                              ID: {photo.promotionId || photo.sessionId}
                            </p>
                            <p className="text-sm text-gray-600 mt-2">
                              📷 {photo.photoCount}장의 사진
                            </p>
                            {photo.lastUpdated && (
                              <p className="text-xs text-gray-400 mt-1">
                                마지막 업데이트: {new Date(photo.lastUpdated).toLocaleString('ko-KR')}
                              </p>
                            )}
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

          {/* 데이터 임포트 탭 */}
          {activeTab === 'import' && (
            <div>
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ 주의사항</h3>
                <ul className="text-yellow-800 text-sm space-y-1">
                  <li>• 임포트 전에 데이터를 검토하세요</li>
                  <li>• 임포트는 되돌릴 수 없습니다</li>
                </ul>
              </div>

              {/* 임포트 모드 선택 */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setImportMode('file')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    importMode === 'file'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📁 파일 선택
                </button>
                <button
                  onClick={() => setImportMode('paste')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    importMode === 'paste'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📋 직접 붙여넣기
                </button>
              </div>

              {/* 파일 선택 모드 */}
              {importMode === 'file' && (
                <div className="space-y-3">
                  {loadingBatches ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                      <p className="mt-2 text-gray-600 text-sm">파일 목록 로딩 중...</p>
                    </div>
                  ) : batchFiles.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">변환 배치 파일이 없습니다.</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Claude가 생성한 JSON 파일을 data/promotions/conversion-batches/ 폴더에 저장하세요.
                      </p>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-semibold text-gray-900">변환 배치 파일 목록</h4>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {batchFiles.map((batch) => (
                          <div
                            key={batch.filename}
                            onClick={() => !batch.isImported && handleSelectBatchFile(batch.filename)}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedBatchFile === batch.filename
                                ? 'border-blue-500 bg-blue-50'
                                : batch.isImported
                                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-mono text-sm text-gray-900">{batch.filename}</p>
                                  {batch.isImported && (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                      ✓ 임포트 완료
                                    </span>
                                  )}
                                  {batch.error && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                      ⚠️ 오류
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                  <span>📊 {batch.conversions}개 변환</span>
                                  <span>📅 {new Date(batch.createdAt).toLocaleString('ko-KR')}</span>
                                  <span>💾 {(batch.fileSize / 1024).toFixed(1)} KB</span>
                                </div>
                                {batch.error && (
                                  <p className="text-xs text-red-600 mt-1">{batch.error}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {selectedBatchFile && conversionData && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm">
                        ✅ <strong>{selectedBatchFile}</strong> 파일이 로드되었습니다.
                      </p>
                      <p className="text-green-700 text-xs mt-1">
                        아래 "데이터 임포트" 버튼을 클릭하여 임포트하세요.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 직접 붙여넣기 모드 */}
              {importMode === 'paste' && (
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
              )}
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
