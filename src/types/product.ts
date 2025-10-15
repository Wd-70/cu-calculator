import { Types } from 'mongoose';

export interface IProduct {
  _id: Types.ObjectId;
  barcode: string;
  name: string;
  price: number;
  category?: string;
  brand?: string;
  imageUrl?: string;
  cuProductCode?: string;

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
