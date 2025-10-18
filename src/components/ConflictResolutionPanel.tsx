'use client';

import { useState, useEffect, useRef } from 'react';

interface CategoryTag {
  name: string;
  level: number;
}

interface ConflictOption {
  url: string;
  name: string;
  price: number;
  imageUrl: string;
  categoryTags: CategoryTag[];
  promotionTags: string[];
}

interface ConflictData {
  productId: string;
  barcode: string;
  currentName: string;
  currentPrice: number;
  currentImageUrl: string;
  currentCategoryTags: CategoryTag[];
  options: ConflictOption[];
}

interface ConflictResolutionPanelProps {
  userAddress: string | null;
  maxProducts: number;
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function ConflictResolutionPanel({
  userAddress,
  maxProducts,
  onToast
}: ConflictResolutionPanelProps) {
  const [updating, setUpdating] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [progress, setProgress] = useState<string>('');
  const [results, setResults] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [checkingPending, setCheckingPending] = useState(false);

  // 로그 영역 자동 스크롤을 위한 ref
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // 로그가 추가될 때 스크롤이 하단에 있으면 자동으로 따라가기
  useEffect(() => {
    if (logsContainerRef.current) {
      const container = logsContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

      // 스크롤이 하단 근처에 있으면 자동으로 스크롤 (컨테이너 내부만)
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs]);

  const startStreamingUpdate = async () => {
    if (!userAddress) {
      onToast('계정이 필요합니다.', 'error');
      return;
    }

    try {
      setUpdating(true);
      setConflicts([]);
      setProgress('카테고리 업데이트를 시작합니다...');
      setResults(null);
      setLogs([]);
      setCurrentIndex(0);
      setTotalCount(0);

      const controller = new AbortController();
      setAbortController(controller);

      const response = await fetch('/api/admin/update-categories-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress,
          maxProducts
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('스트리밍 연결 실패');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('스트림을 읽을 수 없습니다');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'init':
                  setTotalCount(data.total);
                  setLogs(prev => [...prev, `총 ${data.total}개 상품을 처리합니다.`]);
                  break;

                case 'status':
                  setProgress(data.message);
                  setLogs(prev => [...prev, data.message]);
                  break;

                case 'progress':
                  setCurrentIndex(data.index + 1);
                  const progressMsg = `[${data.index + 1}/${data.total}] ${data.product.name} (${data.product.urlCount}개 URL)`;
                  setProgress(progressMsg);
                  setLogs(prev => [...prev, progressMsg]);
                  break;

                case 'conflict':
                  // 충돌 발견! 즉시 카드 추가
                  setConflicts(prev => [...prev, data.data]);
                  const conflictMsg = `⚠️ 충돌 발견: ${data.data.currentName}`;
                  setLogs(prev => [...prev, conflictMsg]);
                  onToast(conflictMsg, 'info');
                  break;

                case 'debug':
                  setLogs(prev => [...prev, `🔍 ${data.message}`]);
                  break;

                case 'success':
                  const successMsg = data.categoryTags
                    ? `✅ ${data.productName} → [${data.categoryTags}]`
                    : `✅ ${data.productName} - 업데이트 완료`;
                  setLogs(prev => [...prev, successMsg]);
                  break;

                case 'skip':
                  setLogs(prev => [...prev, `⏭️ ${data.productName} - 스킵`]);
                  break;

                case 'error':
                  setLogs(prev => [...prev, `❌ 오류: ${data.error}`]);
                  break;

                case 'complete':
                  setProgress(`완료: ${data.message}`);
                  setResults(data.results);
                  setUpdating(false);
                  setAbortController(null);
                  setLogs(prev => [...prev, `🎉 ${data.message}`]);
                  onToast(data.message, 'success');
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e, line);
            }
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setLogs(prev => [...prev, '🛑 사용자가 작업을 중단했습니다.']);
        onToast('작업이 중단되었습니다.', 'info');
      } else {
        console.error('Streaming error:', error);
        setLogs(prev => [...prev, `❌ 오류: ${error.message}`]);
        onToast('카테고리 업데이트 중 오류가 발생했습니다.', 'error');
      }
      setUpdating(false);
      setAbortController(null);
    }
  };

  const cancelUpdate = () => {
    if (abortController) {
      abortController.abort();
      setUpdating(false);
      setAbortController(null);
    }
  };

  const checkPendingProducts = async () => {
    if (!userAddress) {
      onToast('계정이 필요합니다.', 'error');
      return;
    }

    try {
      setCheckingPending(true);

      const response = await fetch(`/api/admin/check-detail-urls?accountAddress=${userAddress}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setPendingCount(data.data.productsWithDetailUrl);
        onToast(`업데이트 대상: ${data.data.productsWithDetailUrl}개`, 'info');
      } else {
        onToast(data.error || '확인에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Failed to check pending products:', error);
      onToast('확인 중 오류가 발생했습니다.', 'error');
    } finally {
      setCheckingPending(false);
    }
  };

  const resolveConflict = async (
    conflictData: ConflictData,
    selectedCategoryTags: CategoryTag[],
    selectedPromotionTags: string[],
    selectedOption: ConflictOption
  ) => {
    if (!userAddress) return;

    try {
      const response = await fetch('/api/admin/resolve-conflict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountAddress: userAddress,
          productId: conflictData.productId,
          selectedData: {
            name: selectedOption.name,
            price: selectedOption.price,
            imageUrl: selectedOption.imageUrl,
            categoryTags: selectedCategoryTags,
            promotionTags: selectedPromotionTags,
          }
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 충돌 해결됨 - 목록에서 제거
        setConflicts(prev => prev.filter(c => c.productId !== conflictData.productId));
        onToast(`${conflictData.currentName} 충돌이 해결되었습니다.`, 'success');
      } else {
        onToast(data.error || '충돌 해결에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      onToast('충돌 해결 중 오류가 발생했습니다.', 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        실시간 카테고리 업데이트 및 충돌 해결
      </h2>

      <div className="mb-4 flex gap-3">
        <button
          onClick={checkPendingProducts}
          disabled={checkingPending || !userAddress}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {checkingPending ? '확인 중...' : pendingCount !== null ? `대상: ${pendingCount}개` : '대상 확인'}
        </button>
        <button
          onClick={startStreamingUpdate}
          disabled={updating || !userAddress}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updating ? '업데이트 중...' : '실시간 카테고리 업데이트 시작'}
        </button>
        {updating && (
          <button
            onClick={cancelUpdate}
            className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all"
          >
            중단
          </button>
        )}
      </div>

      {/* 진행 상황 */}
      {(progress || totalCount > 0) && (
        <div className="mb-4 p-4 bg-blue-50 rounded-xl">
          {totalCount > 0 && (
            <div className="mb-2">
              <div className="flex justify-between text-sm text-blue-900 mb-1">
                <span>진행률</span>
                <span className="font-bold">{currentIndex} / {totalCount}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentIndex / totalCount) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
          <p className="text-sm text-blue-800">
            📊 {progress}
          </p>
        </div>
      )}

      {/* 로그 히스토리 */}
      {logs.length > 0 && (
        <div ref={logsContainerRef} className="mb-4 p-4 bg-gray-50 rounded-xl max-h-60 overflow-y-auto">
          <h3 className="text-sm font-bold text-gray-900 mb-2">처리 로그</h3>
          <div className="space-y-1 text-xs font-mono">
            {logs.map((log, index) => (
              <div key={index} className="text-gray-700">
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* 결과 요약 */}
      {results && (
        <div className="mb-4 p-4 bg-green-50 rounded-xl">
          <p className="text-sm font-bold text-green-900 mb-2">업데이트 완료</p>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <p className="text-green-700">성공</p>
              <p className="text-lg font-bold text-green-900">{results.success}</p>
            </div>
            <div>
              <p className="text-red-700">실패</p>
              <p className="text-lg font-bold text-red-900">{results.failed}</p>
            </div>
            <div>
              <p className="text-gray-700">스킵</p>
              <p className="text-lg font-bold text-gray-900">{results.skipped}</p>
            </div>
            <div>
              <p className="text-orange-700">충돌</p>
              <p className="text-lg font-bold text-orange-900">{results.conflicts}</p>
            </div>
          </div>
        </div>
      )}

      {/* 충돌 카드 목록 */}
      {conflicts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900">
            충돌 발견 ({conflicts.length}개)
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            같은 바코드의 상품이 CU 사이트에 여러 번 등록되어 있으며, 정보가 다릅니다. 올바른 정보를 선택해주세요.
          </p>

          {conflicts.map((conflict) => (
            <ConflictCard
              key={conflict.productId}
              conflict={conflict}
              onResolve={resolveConflict}
            />
          ))}
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="mt-4 p-4 bg-purple-50 rounded-xl">
        <p className="text-sm text-purple-800 mb-2">
          💡 실시간 카테고리 업데이트
        </p>
        <ul className="text-sm text-purple-700 space-y-1 ml-4">
          <li>• 업데이트를 시작하면 백그라운드에서 상품 정보를 크롤링합니다</li>
          <li>• 중복 URL에서 정보가 다른 경우 자동으로 충돌 카드가 생성됩니다</li>
          <li>• 크롤링이 진행되는 동안에도 즉시 충돌을 해결할 수 있습니다</li>
          <li>• 정보가 일치하는 경우 자동으로 업데이트됩니다</li>
        </ul>
      </div>
    </div>
  );
}

// 충돌 카드 컴포넌트
function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: ConflictData;
  onResolve: (
    conflict: ConflictData,
    selectedCategoryTags: CategoryTag[],
    selectedPromotionTags: string[],
    selectedOption: ConflictOption
  ) => void;
}) {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

  // 모든 옵션의 카테고리 태그와 프로모션 태그 수집 (중복 제거)
  const allCategoryTagsMap = new Map<string, CategoryTag>();
  conflict.options.forEach(opt => {
    opt.categoryTags.forEach(tag => {
      allCategoryTagsMap.set(tag.name, tag);
    });
  });
  const allCategoryTags = Array.from(allCategoryTagsMap.values())
    .sort((a, b) => a.level - b.level); // 레벨순 정렬

  const allPromotionTags = Array.from(
    new Set(conflict.options.flatMap(opt => opt.promotionTags))
  );

  // 기본적으로 모두 선택
  const [selectedCategoryTags, setSelectedCategoryTags] = useState<CategoryTag[]>(allCategoryTags);
  const [selectedPromotionTags, setSelectedPromotionTags] = useState<string[]>(allPromotionTags);

  const toggleCategoryTag = (tag: CategoryTag) => {
    setSelectedCategoryTags(prev =>
      prev.some(t => t.name === tag.name)
        ? prev.filter(t => t.name !== tag.name)
        : [...prev, tag]
    );
  };

  const togglePromotionTag = (tag: string) => {
    setSelectedPromotionTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const selectedOption = conflict.options[selectedOptionIndex];

  return (
    <div className="border-2 border-orange-300 rounded-xl p-6 bg-orange-50">
      {/* 현재 상품 정보 */}
      <div className="mb-6">
        <h4 className="font-bold text-lg text-gray-900 mb-2">{conflict.currentName}</h4>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <p>바코드: {conflict.barcode}</p>
          <p>현재 가격: {conflict.currentPrice.toLocaleString()}원</p>
          <p className="col-span-2">
            현재 카테고리: {
              conflict.currentCategoryTags && conflict.currentCategoryTags.length > 0
                ? conflict.currentCategoryTags.map(t => t.name).join(' > ')
                : '미설정'
            }
          </p>
        </div>
      </div>

      {/* 옵션 선택 */}
      <div className="mb-6">
        <h5 className="text-sm font-bold text-gray-900 mb-3">기본 정보 선택</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {conflict.options.map((option, index) => (
            <div
              key={index}
              onClick={() => setSelectedOptionIndex(index)}
              className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                selectedOptionIndex === index
                  ? 'border-purple-500 bg-white shadow-lg'
                  : 'border-gray-300 bg-white hover:border-purple-300'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`px-2 py-1 text-xs font-bold rounded ${
                  selectedOptionIndex === index
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  옵션 {index + 1}
                </span>
                <a
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                  title="새 탭에서 상세페이지 열기"
                >
                  🔗 페이지
                </a>
              </div>

              {option.imageUrl && (
                <div className="w-full aspect-square mb-3 overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={option.imageUrl}
                    alt={option.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/200x200?text=No+Image';
                    }}
                  />
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">상품명</p>
                  <p className="font-semibold text-gray-900 line-clamp-2">{option.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">가격</p>
                  <p className="font-bold text-purple-600">{option.price.toLocaleString()}원</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">카테고리</p>
                  <p className="text-xs text-gray-700">
                    {option.categoryTags.map(t => t.name).join(' > ') || '없음'}
                  </p>
                </div>
                {option.promotionTags.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">프로모션</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {option.promotionTags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 카테고리 태그 선택 */}
      {allCategoryTags.length > 0 && (
        <div className="mb-6">
          <h5 className="text-sm font-bold text-gray-900 mb-3">카테고리 태그 선택</h5>
          <div className="flex flex-wrap gap-2">
            {allCategoryTags.map((tag) => {
              const isSelected = selectedCategoryTags.some(t => t.name === tag.name);
              const levelColors = [
                'bg-purple-500 border-purple-600',  // level 0: 메인 카테고리
                'bg-blue-500 border-blue-600',      // level 1: 중분류
                'bg-green-500 border-green-600',    // level 2: 소분류
                'bg-yellow-500 border-yellow-600',  // level 3: 세분류
              ];
              const levelLabels = ['대분류', '중분류', '소분류', '세분류'];
              const colorClass = levelColors[tag.level] || 'bg-gray-500 border-gray-600';

              return (
                <button
                  key={tag.name}
                  onClick={() => toggleCategoryTag(tag)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                    isSelected
                      ? `${colorClass} text-white shadow-md`
                      : 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && <span>✓</span>}
                    <span>{tag.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-white/20' : 'bg-gray-300'
                    }`}>
                      {levelLabels[tag.level] || `L${tag.level}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            선택된 태그: {selectedCategoryTags.length}개
          </p>
        </div>
      )}

      {/* 프로모션 태그 선택 */}
      {allPromotionTags.length > 0 && (
        <div className="mb-6">
          <h5 className="text-sm font-bold text-gray-900 mb-3">프로모션 태그 선택</h5>
          <div className="flex flex-wrap gap-2">
            {allPromotionTags.map((tag) => (
              <button
                key={tag}
                onClick={() => togglePromotionTag(tag)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  selectedPromotionTags.includes(tag)
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {selectedPromotionTags.includes(tag) && '✓ '}
                {tag}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            선택된 프로모션: {selectedPromotionTags.length}개
          </p>
        </div>
      )}

      {/* 적용 버튼 */}
      <button
        onClick={() => onResolve(conflict, selectedCategoryTags, selectedPromotionTags, selectedOption)}
        disabled={selectedCategoryTags.length === 0}
        className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        선택한 정보로 업데이트
      </button>
    </div>
  );
}
