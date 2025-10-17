import mongoose, { Schema, Model } from 'mongoose';
import { IProduct } from '@/types/product';

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
    category: {
      type: String,
    },
    brand: String,
    imageUrl: String,
    cuProductCode: String,
    detailUrl: String, // CU 상세 페이지 URL

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
ProductSchema.index({ category: 1 });

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
