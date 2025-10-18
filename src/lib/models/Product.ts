import mongoose, { Schema, Model } from 'mongoose';
import { IProduct } from '@/types/product';

// CategoryTag 스키마 정의
const CategoryTagSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    level: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    barcode: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    categoryTags: [CategoryTagSchema], // 계층 구조를 포함한 카테고리 태그 배열
    brand: String,
    imageUrl: String,
    cuProductCode: String,
    detailUrls: [String], // CU 상세 페이지 URL 배열 (중복 등록 상품 처리용)

    // Metadata
    createdBy: {
      type: String,
      required: true,
    },
    lastModifiedBy: String,
    modificationCount: {
      type: Number,
      default: 0,
    },

    // Data quality
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCount: {
      type: Number,
      default: 0,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance (defined once)
ProductSchema.index({ barcode: 1 });
ProductSchema.index({ name: 'text' });

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
