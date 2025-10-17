import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/search-images
 * Search product images using Unsplash API
 */
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: '검색어를 입력해주세요.' },
        { status: 400 }
      );
    }

    console.log('Searching images for:', query);

    // Unsplash API 사용 (API 키 없이도 제한적으로 사용 가능)
    const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || 'demo';
    const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' product')}&per_page=6&orientation=squarish`;

    const response = await fetch(searchUrl, {
      headers: UNSPLASH_ACCESS_KEY !== 'demo' ? {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
      } : {}
    });

    if (!response.ok) {
      console.error('Unsplash API error:', response.status);
      // Unsplash 실패 시 더미 이미지 생성
      const dummyImages = Array.from({ length: 6 }, (_, i) => ({
        url: `https://via.placeholder.com/400x400/7C3FBF/FFFFFF?text=${encodeURIComponent(query)}+${i + 1}`,
        thumbnail: `https://via.placeholder.com/200x200/7C3FBF/FFFFFF?text=${encodeURIComponent(query)}+${i + 1}`,
        title: `${query} ${i + 1}`
      }));

      return NextResponse.json({
        success: true,
        images: dummyImages,
        total: dummyImages.length,
        message: 'API 키가 없어 샘플 이미지를 표시합니다. .env 파일에 UNSPLASH_ACCESS_KEY를 추가하면 실제 이미지를 검색할 수 있습니다.'
      });
    }

    const data = await response.json();

    const images = (data.results || []).map((item: any) => ({
      url: item.urls.regular || item.urls.small,
      thumbnail: item.urls.thumb || item.urls.small,
      title: item.alt_description || item.description || query
    }));

    console.log('Found images:', images.length);

    if (images.length === 0) {
      // 검색 결과 없음 - 더미 이미지
      const dummyImages = Array.from({ length: 6 }, (_, i) => ({
        url: `https://via.placeholder.com/400x400/7C3FBF/FFFFFF?text=${encodeURIComponent(query)}+${i + 1}`,
        thumbnail: `https://via.placeholder.com/200x200/7C3FBF/FFFFFF?text=${encodeURIComponent(query)}+${i + 1}`,
        title: `${query} ${i + 1}`
      }));

      return NextResponse.json({
        success: true,
        images: dummyImages,
        total: dummyImages.length,
        message: '검색 결과가 없어 샘플 이미지를 표시합니다.'
      });
    }

    return NextResponse.json({
      success: true,
      images,
      total: images.length
    });
  } catch (error) {
    console.error('Error searching images:', error);

    // 에러 발생 시에도 더미 이미지 반환
    const query = 'Product';
    const dummyImages = Array.from({ length: 6 }, (_, i) => ({
      url: `https://via.placeholder.com/400x400/7C3FBF/FFFFFF?text=${encodeURIComponent(query)}+${i + 1}`,
      thumbnail: `https://via.placeholder.com/200x200/7C3FBF/FFFFFF?text=${encodeURIComponent(query)}+${i + 1}`,
      title: `${query} ${i + 1}`
    }));

    return NextResponse.json({
      success: true,
      images: dummyImages,
      total: dummyImages.length,
      message: '이미지 검색 중 오류가 발생하여 샘플 이미지를 표시합니다.'
    });
  }
}
