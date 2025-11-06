import { Types } from 'mongoose';

// 카테고리 태그 계층 구조
export interface CategoryTag {
  name: string;
  level: number; // 0: 메인 카테고리, 1: 중분류, 2: 소분류, etc.
}

export interface IProduct {
  _id: Types.ObjectId;
  barcode?: string; // Optional: 바코드 없이 등록 후 나중에 추가 가능
  name: string;
  price: number;
  categoryTags?: CategoryTag[]; // 모든 카테고리 태그 (계층 구조 포함)
  brand?: string;
  imageUrl?: string;
  cuProductCode?: string;
  detailUrls?: string[]; // 여러 상세페이지 URL (중복 등록된 상품 처리용)

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy?: string;
  modificationCount: number;

  // Data quality
  isVerified: boolean;
  verificationCount: number;
  reportCount: number;
}

export interface ExternalProductData {
  barcode: string;
  name: string;
  price?: number;
  manufacturer?: string;
  category?: string;
}
