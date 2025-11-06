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
    // undefined 필드를 제거 (sparse index를 위해)
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }

    const product = await Product.create(cleaned);
    return product.toObject();
  }

  async bulkCreateProducts(
    data: Omit<IProduct, '_id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<{ insertedCount: number; insertedIds: string[] }> {
    if (data.length === 0) {
      return { insertedCount: 0, insertedIds: [] };
    }

    // undefined 필드를 제거 (MongoDB가 null로 변환하는 것을 방지)
    // sparse index가 제대로 작동하려면 필드가 완전히 없어야 함
    const cleanedData = data.map(item => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(item)) {
        if (value !== undefined) {
          cleaned[key] = value;
        }
      }
      return cleaned;
    });

    // 디버깅: MongoDB로 전송되는 데이터 확인
    console.log('\n=== MongoDB로 전송할 데이터 샘플 (최대 3개) ===');
    cleanedData.slice(0, 3).forEach((item, idx) => {
      console.log(`\n[${idx + 1}] ${item.name}`);
      console.log('  barcode:', JSON.stringify(item.barcode));
      console.log('  hasOwnProperty(barcode):', item.hasOwnProperty('barcode'));
      console.log('  전체 키:', Object.keys(item));
    });
    console.log('==========================================\n');

    const result = await Product.insertMany(cleanedData, { ordered: false });
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
