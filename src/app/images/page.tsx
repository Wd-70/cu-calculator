'use client';

import { useEffect, useRef } from 'react';

export default function ImagesPage() {
  const ogCanvasRef = useRef<HTMLCanvasElement>(null);
  const icon192Ref = useRef<HTMLCanvasElement>(null);
  const icon512Ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // OG Image (1200x630)
    const ogCanvas = ogCanvasRef.current;
    if (ogCanvas) {
      const ctx = ogCanvas.getContext('2d');
      if (ctx) {
        // 배경 그라디언트
        const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
        gradient.addColorStop(0, '#7C3FBF');
        gradient.addColorStop(1, '#9B5FD9');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1200, 630);

        // 장식 요소 (반투명 원들)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(1000, 100, 200, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(200, 500, 150, 0, Math.PI * 2);
        ctx.fill();

        // 흰색 카드 배경
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.roundRect(100, 100, 1000, 430, 30);
        ctx.fill();

        // CU 로고 박스
        const logoGradient = ctx.createLinearGradient(150, 150, 250, 250);
        logoGradient.addColorStop(0, '#7C3FBF');
        logoGradient.addColorStop(1, '#9B5FD9');
        ctx.fillStyle = logoGradient;
        ctx.roundRect(150, 150, 100, 100, 20);
        ctx.fill();

        // CU 텍스트
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CU', 200, 200);

        // 메인 제목
        ctx.fillStyle = '#1F2937';
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('CU 할인계산기', 300, 210);

        // 부제목
        ctx.fillStyle = '#6B7280';
        ctx.font = '36px Arial';
        ctx.fillText('편의점 할인을 똑똑하게 계산하세요', 150, 330);

        // 기능 목록
        ctx.font = '28px Arial';
        ctx.fillStyle = '#4B5563';
        const features = ['✓ 1+1, 2+1 프로모션', '✓ 쿠폰 & 카드할인', '✓ 통신사 할인', '✓ AI 최적화'];
        features.forEach((feature, i) => {
          ctx.fillText(feature, 150, 400 + i * 40);
        });

        // 하단 URL
        ctx.fillStyle = '#7C3FBF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('cu-calc.app', 600, 490);
      }
    }

    // Icon 192x192
    const icon192 = icon192Ref.current;
    if (icon192) {
      const ctx = icon192.getContext('2d');
      if (ctx) {
        // 배경 그라디언트
        const gradient = ctx.createLinearGradient(0, 0, 192, 192);
        gradient.addColorStop(0, '#7C3FBF');
        gradient.addColorStop(1, '#9B5FD9');
        ctx.fillStyle = gradient;
        ctx.roundRect(0, 0, 192, 192, 40);
        ctx.fill();

        // CU 텍스트
        ctx.fillStyle = 'white';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CU', 96, 96);

        // 작은 부제
        ctx.font = 'bold 20px Arial';
        ctx.fillText('할인', 96, 140);
      }
    }

    // Icon 512x512
    const icon512 = icon512Ref.current;
    if (icon512) {
      const ctx = icon512.getContext('2d');
      if (ctx) {
        // 배경 그라디언트
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, '#7C3FBF');
        gradient.addColorStop(1, '#9B5FD9');
        ctx.fillStyle = gradient;
        ctx.roundRect(0, 0, 512, 512, 100);
        ctx.fill();

        // 장식 원
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(400, 100, 150, 0, Math.PI * 2);
        ctx.fill();

        // CU 텍스트
        ctx.fillStyle = 'white';
        ctx.font = 'bold 200px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CU', 256, 220);

        // 부제
        ctx.font = 'bold 50px Arial';
        ctx.fillText('할인계산기', 256, 360);

        // 작은 아이콘 (체크마크)
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(180, 420);
        ctx.lineTo(220, 460);
        ctx.lineTo(330, 380);
        ctx.stroke();
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
