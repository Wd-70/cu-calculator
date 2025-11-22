'use client';

import { useEffect, useRef } from 'react';

export default function ImagesPage() {
  const ogCanvasRef = useRef<HTMLCanvasElement>(null);
  const icon192Ref = useRef<HTMLCanvasElement>(null);
  const icon512Ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // OG Image (1200x630) - 세련된 플랫 디자인
    const ogCanvas = ogCanvasRef.current;
    if (ogCanvas) {
      const ctx = ogCanvas.getContext('2d');
      if (ctx) {
        // 배경 - 밝은 회색
        ctx.fillStyle = '#F9FAFB';
        ctx.fillRect(0, 0, 1200, 630);

        // 좌측 보라색 영역 (1/3)
        ctx.fillStyle = '#7C3FBF';
        ctx.fillRect(0, 0, 400, 630);

        // 보라색 영역 위 장식 도형 (밝은 보라)
        ctx.fillStyle = '#9B5FD9';
        ctx.fillRect(320, 100, 80, 80);
        ctx.fillRect(320, 450, 80, 80);

        // CU 로고 박스 (흰색 사각형)
        ctx.fillStyle = 'white';
        ctx.roundRect(80, 200, 240, 230, 20);
        ctx.fill();

        // CU 텍스트 (보라색)
        ctx.fillStyle = '#7C3FBF';
        ctx.font = 'bold 100px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CU', 200, 280);

        // 할인 텍스트 (보라색)
        ctx.font = 'bold 32px Arial';
        ctx.fillText('할인계산기', 200, 370);

        // 우측 흰색 영역 - 메인 타이틀
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 68px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('CU에서 쓰는 돈,', 460, 200);

        // 강조 텍스트 (보라색)
        ctx.fillStyle = '#7C3FBF';
        ctx.font = 'bold 68px Arial';
        ctx.fillText('최대한 아껴드립니다', 460, 280);

        // 구분선
        ctx.fillStyle = '#E5E7EB';
        ctx.fillRect(460, 330, 680, 3);

        // 기능 목록 (아이콘 스타일)
        ctx.fillStyle = '#6B7280';
        ctx.font = '32px Arial';

        const features = [
          '✓  1+1, 2+1 프로모션 자동 계산',
          '✓  쿠폰, 카드할인 최적화',
          '✓  통신사 할인 조합',
          '✓  AI 기반 할인 추천'
        ];

        features.forEach((feature, i) => {
          ctx.fillText(feature, 460, 390 + i * 48);
        });

        // 하단 URL (보라색 박스)
        ctx.fillStyle = '#7C3FBF';
        ctx.roundRect(950, 540, 200, 60, 10);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('cu-calc.app', 1050, 575);
      }
    }

    // Icon 192x192 - 세련된 보라색 디자인
    const icon192 = icon192Ref.current;
    if (icon192) {
      const ctx = icon192.getContext('2d');
      if (ctx) {
        // 배경 - 진한 보라색
        ctx.fillStyle = '#7C3FBF';
        ctx.roundRect(0, 0, 192, 192, 40);
        ctx.fill();

        // 장식 사각형 (밝은 보라)
        ctx.fillStyle = '#9B5FD9';
        ctx.fillRect(135, 20, 40, 40);
        ctx.fillRect(17, 132, 40, 40);

        // CU 텍스트
        ctx.fillStyle = 'white';
        ctx.font = 'bold 70px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CU', 96, 85);

        // 작은 부제
        ctx.font = 'bold 18px Arial';
        ctx.fillText('할인계산기', 96, 130);
      }
    }

    // Icon 512x512 - 세련된 보라색 디자인
    const icon512 = icon512Ref.current;
    if (icon512) {
      const ctx = icon512.getContext('2d');
      if (ctx) {
        // 배경 - 진한 보라색
        ctx.fillStyle = '#7C3FBF';
        ctx.roundRect(0, 0, 512, 512, 100);
        ctx.fill();

        // 장식 사각형들 (밝은 보라)
        ctx.fillStyle = '#9B5FD9';
        ctx.fillRect(370, 50, 100, 100);
        ctx.fillRect(42, 362, 100, 100);

        // 흰색 원형 배경 (로고용)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(256, 200, 120, 0, Math.PI * 2);
        ctx.fill();

        // CU 텍스트 (보라색)
        ctx.fillStyle = '#7C3FBF';
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CU', 256, 200);

        // 부제 (흰색)
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.fillText('할인계산기', 256, 360);
      }
    }
  }, []);

  const downloadImage = (canvas: HTMLCanvasElement | null, filename: string) => {
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">SEO 이미지 생성기</h1>
          <p className="text-gray-600">각 이미지를 클릭하여 다운로드하거나, 스크린샷을 찍어서 사용하세요</p>
        </div>

        {/* OG Image */}
        <div className="mb-12 bg-white p-8 rounded-lg shadow-lg">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Open Graph Image</h2>
            <p className="text-gray-600 mb-2">1200 x 630px - 소셜 미디어 공유용</p>
            <p className="text-sm text-gray-500">파일명: og-image.png</p>
          </div>
          <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg inline-block">
            <canvas
              ref={ogCanvasRef}
              width={1200}
              height={630}
              className="border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => downloadImage(ogCanvasRef.current, 'og-image.png')}
            />
          </div>
          <button
            onClick={() => downloadImage(ogCanvasRef.current, 'og-image.png')}
            className="mt-4 px-6 py-3 bg-[#7C3FBF] text-white rounded-lg hover:bg-[#6B35A8] transition-colors font-semibold"
          >
            📥 다운로드 (og-image.png)
          </button>
        </div>

        {/* Icon 192 */}
        <div className="mb-12 bg-white p-8 rounded-lg shadow-lg">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">PWA Icon 192</h2>
            <p className="text-gray-600 mb-2">192 x 192px - 작은 앱 아이콘</p>
            <p className="text-sm text-gray-500">파일명: icon-192.png</p>
          </div>
          <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg inline-block">
            <canvas
              ref={icon192Ref}
              width={192}
              height={192}
              className="border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => downloadImage(icon192Ref.current, 'icon-192.png')}
            />
          </div>
          <button
            onClick={() => downloadImage(icon192Ref.current, 'icon-192.png')}
            className="mt-4 px-6 py-3 bg-[#7C3FBF] text-white rounded-lg hover:bg-[#6B35A8] transition-colors font-semibold"
          >
            📥 다운로드 (icon-192.png)
          </button>
        </div>

        {/* Icon 512 */}
        <div className="mb-12 bg-white p-8 rounded-lg shadow-lg">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">PWA Icon 512</h2>
            <p className="text-gray-600 mb-2">512 x 512px - 큰 앱 아이콘</p>
            <p className="text-sm text-gray-500">파일명: icon-512.png</p>
          </div>
          <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg inline-block">
            <canvas
              ref={icon512Ref}
              width={512}
              height={512}
              className="border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => downloadImage(icon512Ref.current, 'icon-512.png')}
            />
          </div>
          <button
            onClick={() => downloadImage(icon512Ref.current, 'icon-512.png')}
            className="mt-4 px-6 py-3 bg-[#7C3FBF] text-white rounded-lg hover:bg-[#6B35A8] transition-colors font-semibold"
          >
            📥 다운로드 (icon-512.png)
          </button>
        </div>

        {/* 사용 방법 */}
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
          <h3 className="text-lg font-bold text-blue-900 mb-3">📋 사용 방법</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>각 이미지의 <strong>"다운로드"</strong> 버튼을 클릭하여 저장</li>
            <li>다운로드한 이미지를 <code className="bg-blue-100 px-2 py-1 rounded">/public</code> 폴더에 복사</li>
            <li>파일명이 정확한지 확인:
              <ul className="list-disc list-inside ml-6 mt-2">
                <li><code className="bg-blue-100 px-2 py-1 rounded">og-image.png</code></li>
                <li><code className="bg-blue-100 px-2 py-1 rounded">icon-192.png</code></li>
                <li><code className="bg-blue-100 px-2 py-1 rounded">icon-512.png</code></li>
              </ul>
            </li>
            <li>변경사항을 커밋하고 푸시</li>
            <li>Vercel에서 자동 재배포 확인</li>
          </ol>
        </div>

        {/* 홈으로 */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
          >
            ← 홈으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
}
