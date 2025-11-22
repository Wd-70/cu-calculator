"use client";

import { useEffect, useRef } from "react";

export default function ImagesPage() {
  const ogCanvasRef = useRef<HTMLCanvasElement>(null);
  const icon192Ref = useRef<HTMLCanvasElement>(null);
  const icon512Ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // OG Image (1200x630) - 세련된 디자인
    const ogCanvas = ogCanvasRef.current;
    if (ogCanvas) {
      const ctx = ogCanvas.getContext("2d");
      if (ctx) {
        // === 1단계: 왼쪽 보라색 영역 ===
        // 좌측 보라색 배경
        ctx.fillStyle = "#7C3FBF";
        ctx.fillRect(0, 0, 450, 630);

        // 좌측 장식 원들 (랜덤한 느낌으로 배치)
        ctx.fillStyle = "rgba(155, 95, 217, 0.3)";
        ctx.beginPath();
        ctx.arc(75, 45, 100, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(430, 430, 85, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(115, 620, 138, 0, Math.PI * 2);
        ctx.fill();

        // 좌측 CU 텍스트 (흰색)
        ctx.fillStyle = "white";
        ctx.font = "bold 150px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CU", 225, 270);

        // 좌측 할인계산기 텍스트 (흰색)
        ctx.font = "bold 40px Arial";
        ctx.fillText("할인계산기", 225, 380);

        // === 2단계: 오른쪽 배경 (왼쪽 원들이 넘어오면 잘림) ===
        ctx.fillStyle = "#F9FAFB";
        ctx.fillRect(450, 0, 750, 630);

        // === 3단계: 우측 꾸밈 요소들 (글자 뒤에) ===
        // 우측 장식 원 (오른쪽 상단 모서리에 배치하여 텍스트와 겹치지 않도록)
        ctx.fillStyle = "rgba(124, 63, 191, 0.12)";
        ctx.beginPath();
        ctx.arc(1100, 70, 95, 0, Math.PI * 2);
        ctx.fill();

        // === 4단계: 우측 구분선 ===
        ctx.fillStyle = "#E5E7EB";
        ctx.fillRect(500, 347, 640, 2);

        // === 5단계: 우측 글자들 (상하 중앙 정렬) ===
        // URL (상단에 세련되게 배치)
        ctx.fillStyle = "#9CA3AF";
        ctx.font = "bold 28px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("cu-calc.app", 500, 120);

        // 우측 타이틀
        ctx.fillStyle = "#111827";
        ctx.font = "bold 72px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("CU에서 쓰는 돈,", 500, 168);

        // 강조 텍스트 (보라색)
        ctx.fillStyle = "#7C3FBF";
        ctx.font = "bold 72px Arial";
        ctx.fillText("최대한 아껴드립니다", 500, 255);

        // 기능 배지 스타일 (세련되게 수정)
        const features = [
          { text: "1+1·2+1 프로모션" },
          { text: "카드·쿠폰 할인" },
          { text: "통신사 할인" },
          { text: "AI 최적화" },
        ];

        features.forEach((feature, i) => {
          const x = 500 + (i % 2) * 330;
          const y = 369 + Math.floor(i / 2) * 80;

          // 배경 박스 - 보라색
          ctx.fillStyle = "#7C3FBF";
          ctx.beginPath();
          ctx.roundRect(x, y, 300, 60, 12);
          ctx.fill();

          // 왼쪽 포인트 (작은 원)
          ctx.fillStyle = "white";
          ctx.beginPath();
          ctx.arc(x + 20, y + 30, 4, 0, Math.PI * 2);
          ctx.fill();

          // 텍스트 - 흰색
          ctx.fillStyle = "white";
          ctx.font = "bold 22px Arial";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(feature.text, x + 35, y + 30);
        });

        // URL 영역은 상단으로 이동되었음 (제거)
      }
    }

    // Icon 192x192 - 통일된 스타일
    const icon192 = icon192Ref.current;
    if (icon192) {
      const ctx = icon192.getContext("2d");
      if (ctx) {
        // 배경 - 보라색
        ctx.fillStyle = "#7C3FBF";
        ctx.roundRect(0, 0, 192, 192, 40);
        ctx.fill();

        // Clipping 설정 (둥근 모서리에 맞춰 잘리도록)
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, 0, 192, 192, 40);
        ctx.clip();

        // 장식 원들 (밝은 보라 - 반투명, 둥근 모서리에 맞춰 잘림)
        ctx.fillStyle = "rgba(155, 95, 217, 0.4)";
        ctx.beginPath();
        ctx.arc(180, 30, 55, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(30, 180, 50, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // Clipping 해제

        // CU 텍스트 (최대 크기)
        ctx.fillStyle = "white";
        ctx.font = "bold 95px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CU", 96, 75);

        // 부제
        ctx.font = "bold 20px Arial";
        ctx.fillText("할인계산기", 96, 135);
      }
    }

    // Icon 512x512 - 통일된 스타일
    const icon512 = icon512Ref.current;
    if (icon512) {
      const ctx = icon512.getContext("2d");
      if (ctx) {
        // 배경 - 보라색
        ctx.fillStyle = "#7C3FBF";
        ctx.roundRect(0, 0, 512, 512, 100);
        ctx.fill();

        // Clipping 설정 (둥근 모서리에 맞춰 잘리도록)
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, 0, 512, 512, 100);
        ctx.clip();

        // 장식 원들 (밝은 보라 - 반투명, 둥근 모서리에 맞춰 잘림)
        ctx.fillStyle = "rgba(155, 95, 217, 0.4)";
        ctx.beginPath();
        ctx.arc(480, 100, 130, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(100, 480, 115, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // Clipping 해제

        // CU 텍스트 (최대 크기)
        ctx.fillStyle = "white";
        ctx.font = "bold 250px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CU", 256, 210);

        // 부제
        ctx.font = "bold 52px Arial";
        ctx.fillText("할인계산기", 256, 370);
      }
    }
  }, []);

  const downloadImage = (
    canvas: HTMLCanvasElement | null,
    filename: string
  ) => {
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            SEO 이미지 생성기
          </h1>
          <p className="text-gray-600">
            각 이미지를 클릭하여 다운로드하거나, 스크린샷을 찍어서 사용하세요
          </p>
        </div>

        {/* OG Image */}
        <div className="mb-12 bg-white p-8 rounded-lg shadow-lg">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Open Graph Image
            </h2>
            <p className="text-gray-600 mb-2">
              1200 x 630px - 소셜 미디어 공유용
            </p>
            <p className="text-sm text-gray-500">파일명: og-image.png</p>
          </div>
          <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg inline-block">
            <canvas
              ref={ogCanvasRef}
              width={1200}
              height={630}
              className="border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => downloadImage(ogCanvasRef.current, "og-image.png")}
            />
          </div>
          <button
            onClick={() => downloadImage(ogCanvasRef.current, "og-image.png")}
            className="mt-4 px-6 py-3 bg-[#7C3FBF] text-white rounded-lg hover:bg-[#6B35A8] transition-colors font-semibold"
          >
            📥 다운로드 (og-image.png)
          </button>
        </div>

        {/* Icon 192 */}
        <div className="mb-12 bg-white p-8 rounded-lg shadow-lg">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              PWA Icon 192
            </h2>
            <p className="text-gray-600 mb-2">192 x 192px - 작은 앱 아이콘</p>
            <p className="text-sm text-gray-500">파일명: icon-192.png</p>
          </div>
          <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg inline-block">
            <canvas
              ref={icon192Ref}
              width={192}
              height={192}
              className="border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => downloadImage(icon192Ref.current, "icon-192.png")}
            />
          </div>
          <button
            onClick={() => downloadImage(icon192Ref.current, "icon-192.png")}
            className="mt-4 px-6 py-3 bg-[#7C3FBF] text-white rounded-lg hover:bg-[#6B35A8] transition-colors font-semibold"
          >
            📥 다운로드 (icon-192.png)
          </button>
        </div>

        {/* Icon 512 */}
        <div className="mb-12 bg-white p-8 rounded-lg shadow-lg">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              PWA Icon 512
            </h2>
            <p className="text-gray-600 mb-2">512 x 512px - 큰 앱 아이콘</p>
            <p className="text-sm text-gray-500">파일명: icon-512.png</p>
          </div>
          <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg inline-block">
            <canvas
              ref={icon512Ref}
              width={512}
              height={512}
              className="border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => downloadImage(icon512Ref.current, "icon-512.png")}
            />
          </div>
          <button
            onClick={() => downloadImage(icon512Ref.current, "icon-512.png")}
            className="mt-4 px-6 py-3 bg-[#7C3FBF] text-white rounded-lg hover:bg-[#6B35A8] transition-colors font-semibold"
          >
            📥 다운로드 (icon-512.png)
          </button>
        </div>

        {/* 사용 방법 */}
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
          <h3 className="text-lg font-bold text-blue-900 mb-3">📋 사용 방법</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>
              각 이미지의 <strong>"다운로드"</strong> 버튼을 클릭하여 저장
            </li>
            <li>
              다운로드한 이미지를{" "}
              <code className="bg-blue-100 px-2 py-1 rounded">/public</code>{" "}
              폴더에 복사
            </li>
            <li>
              파일명이 정확한지 확인:
              <ul className="list-disc list-inside ml-6 mt-2">
                <li>
                  <code className="bg-blue-100 px-2 py-1 rounded">
                    og-image.png
                  </code>
                </li>
                <li>
                  <code className="bg-blue-100 px-2 py-1 rounded">
                    icon-192.png
                  </code>
                </li>
                <li>
                  <code className="bg-blue-100 px-2 py-1 rounded">
                    icon-512.png
                  </code>
                </li>
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
