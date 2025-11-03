/**
 * MongoDB Database Adapter
 *
 * MongoDB를 사용하여 데이터를 저장합니다.
 * LocalStorage와 동일한 인터페이스를 제공합니다.
 *
 * 사용 방법:
 * 1. .env.local에 MONGODB_URI 설정
 * 2. src/lib/db/index.ts에서 MongoDBAdapter로 변경
 */

import { IDatabase, QueryFilter, QueryOptions } from './interfaces';
import { IProduct } from '@/types/product';
import { IDiscountRule } from '@/types/discount';
import { IModificationHistory } from '@/lib/models/ModificationHistory';
import Product from '@/lib/models/Product';
import DiscountRule from '@/lib/models/DiscountRule';
import ModificationHistory from '@/lib/models/ModificationHistory';
import connectDB from '@/lib/mongodb';

export class MongoDBAdapter implements IDatabase {
  private connected: boolean = false;

  async connect(): Promise<void> {
    await connectDB();
    this.connected = true;
    console.log('✅ MongoDB adapter connected');
  }

  async disconnect(): Promise<void> {
    // MongoDB connection pooling handles this
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Products
  async findProducts(
    filter?: QueryFilter<IProduct>,
    options?: QueryOptions
  ): Promise<IProduct[]> {
    let query = Product.find(filter || {});

    if (options?.sort) {
      query = query.sort(options.sort);
    }
    if (options?.skip) {
      query = query.skip(options.skip);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query.exec();
  }

  async findProductById(id: string): Promise<IProduct | null> {
    return Product.findById(id).exec();
  }

  async findProductByBarcode(barcode: string): Promise<IProduct | null> {
    return Product.findOne({ barcode }).exec();
  }

  async createProduct(
    data: Omit<IProduct, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IProduct> {
    const product = await Product.create(data);
    return product.toObject();
  }

  async bulkCreateProducts(
    data: Omit<IProduct, '_id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<{ insertedCount: number; insertedIds: string[] }> {
    if (data.length === 0) {
      return { insertedCount: 0, insertedIds: [] };
    }

    const result = await Product.insertMany(data, { ordered: false });
    return {
      insertedCount: result.length,
      insertedIds: result.map((doc) => doc._id.toString()),
    };
  }

  async updateProduct(
    id: string,
    data: Partial<IProduct>
  ): Promise<IProduct | null> {
    const product = await Product.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: false, strict: false }
    ).exec();
    return product ? product.toObject() : null;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await Product.findByIdAndDelete(id).exec();
    return !!result;
  }

  async countProducts(filter?: QueryFilter<IProduct>): Promise<number> {
    return Product.countDocuments(filter || {}).exec();
  }

  // Discount Rules
  async findDiscountRules(
    filter?: QueryFilter<IDiscountRule>,
    options?: QueryOptions
  ): Promise<IDiscountRule[]> {
    let query = DiscountRule.find(filter || {})
      .select('-modificationHistory -__v -lastModifiedBy -createdAt -updatedAt');

    if (options?.sort) {
      query = query.sort(options.sort);
    }
    if (options?.skip) {
      query = query.skip(options.skip);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query.lean().exec();
  }

  async findDiscountRuleById(id: string): Promise<IDiscountRule | null> {
    return DiscountRule.findById(id)
      .select('-modificationHistory -__v -lastModifiedBy -createdAt -updatedAt')
      .lean()
      .exec();
  }

  async findDiscountRulesByIds(ids: string[]): Promise<IDiscountRule[]> {
    return DiscountRule.find({ _id: { $in: ids } })
      .select('-modificationHistory -__v -lastModifiedBy -createdAt -updatedAt')
      .lean()
      .exec();
  }

  async createDiscountRule(
    data: Omit<IDiscountRule, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IDiscountRule> {
    const rule = await DiscountRule.create(data);
    return rule.toObject({ minimize: false });
  }

  async updateDiscountRule(
    id: string,
    data: Partial<IDiscountRule>
  ): Promise<IDiscountRule | null> {
    const rule = await DiscountRule.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: false }
    ).lean().exec();
    return rule;
  }

  async deleteDiscountRule(id: string): Promise<boolean> {
    const result = await DiscountRule.findByIdAndDelete(id).exec();
    return !!result;
  }

  // Modification History
  async findModificationHistory(
    filter?: QueryFilter<IModificationHistory>,
    options?: QueryOptions
  ): Promise<IModificationHistory[]> {
    let query = ModificationHistory.find(filter || {});

    if (options?.sort) {
      query = query.sort(options.sort);
    }
    if (options?.skip) {
      query = query.skip(options.skip);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query.exec();
  }

  async createModificationHistory(
    data: Omit<IModificationHistory, '_id'>
  ): Promise<IModificationHistory> {
    const history = await ModificationHistory.create(data);
    return history.toObject();
  }
}
