/**
 * Database Abstraction Layer
 *
 * 이 인터페이스를 구현하면 어떤 데이터베이스든 사용 가능합니다:
 * - LocalStorage (브라우저)
 * - MongoDB
 * - PostgreSQL
 * - MySQL
 * 등등...
 */

import { IProduct } from '@/types/product';
import { IDiscountRule } from '@/types/discount';
import { IModificationHistory } from '@/lib/models/ModificationHistory';
import { IUserPreset } from '@/types/preset';
import { ICart } from '@/types/cart';

// Generic query filter type
export type QueryFilter<T> = Partial<T> & {
  $or?: Partial<T>[];
  $and?: Partial<T>[];
  [key: string]: any;
};

// Query options
export interface QueryOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

// Database adapter interface
export interface IDatabase {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Products
  findProducts(filter?: QueryFilter<IProduct>, options?: QueryOptions): Promise<IProduct[]>;
  findProductById(id: string): Promise<IProduct | null>;
  findProductByBarcode(barcode: string): Promise<IProduct | null>;
  createProduct(data: Omit<IProduct, '_id' | 'createdAt' | 'updatedAt'>): Promise<IProduct>;
  updateProduct(id: string, data: Partial<IProduct>): Promise<IProduct | null>;
  deleteProduct(id: string): Promise<boolean>;
  countProducts(filter?: QueryFilter<IProduct>): Promise<number>;

  // Discount Rules
  findDiscountRules(filter?: QueryFilter<IDiscountRule>, options?: QueryOptions): Promise<IDiscountRule[]>;
  findDiscountRuleById(id: string): Promise<IDiscountRule | null>;
  findDiscountRulesByIds(ids: string[]): Promise<IDiscountRule[]>;
  createDiscountRule(data: Omit<IDiscountRule, '_id' | 'createdAt' | 'updatedAt'>): Promise<IDiscountRule>;
  updateDiscountRule(id: string, data: Partial<IDiscountRule>): Promise<IDiscountRule | null>;
  deleteDiscountRule(id: string): Promise<boolean>;

  // Modification History
  findModificationHistory(filter?: QueryFilter<IModificationHistory>, options?: QueryOptions): Promise<IModificationHistory[]>;
  createModificationHistory(data: Omit<IModificationHistory, '_id'>): Promise<IModificationHistory>;

  // User Presets
  findPresets(filter?: QueryFilter<IUserPreset>, options?: QueryOptions): Promise<IUserPreset[]>;
  findPresetById(id: string): Promise<IUserPreset | null>;
  createPreset(data: Omit<IUserPreset, '_id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'>): Promise<IUserPreset>;
  updatePreset(id: string, data: Partial<IUserPreset>): Promise<IUserPreset | null>;
  deletePreset(id: string): Promise<boolean>;
  incrementPresetUsage(id: string): Promise<IUserPreset | null>;

  // Carts
  findCarts(filter?: QueryFilter<ICart>, options?: QueryOptions): Promise<ICart[]>;
  findCartById(id: string): Promise<ICart | null>;
  createCart(data: Omit<ICart, '_id' | 'createdAt' | 'updatedAt'>): Promise<ICart>;
  updateCart(id: string, data: Partial<ICart>): Promise<ICart | null>;
  deleteCart(id: string): Promise<boolean>;
}
