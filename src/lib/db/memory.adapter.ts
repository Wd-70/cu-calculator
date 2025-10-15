/**
 * In-Memory Database Adapter
 *
 * 메모리에 데이터를 저장하는 어댑터입니다.
 * 서버와 브라우저 모두에서 작동하며, MongoDB와 동일한 데이터 구조를 유지합니다.
 *
 * 주의: 서버를 재시작하면 데이터가 사라집니다.
 * 개발 및 테스트 용도로만 사용하세요.
 */

import { IDatabase, QueryFilter, QueryOptions } from './interfaces';
import { IProduct } from '@/types/product';
import { IDiscountRule } from '@/types/discount';
import { IModificationHistory } from '@/lib/models/ModificationHistory';
import { Types } from 'mongoose';

// 메모리 저장소
class MemoryStore {
  private products: IProduct[] = [];
  private discountRules: IDiscountRule[] = [];
  private modificationHistory: IModificationHistory[] = [];

  getProducts() {
    return this.products;
  }

  setProducts(products: IProduct[]) {
    this.products = products;
  }

  getDiscountRules() {
    return this.discountRules;
  }

  setDiscountRules(rules: IDiscountRule[]) {
    this.discountRules = rules;
  }

  getModificationHistory() {
    return this.modificationHistory;
  }

  setModificationHistory(history: IModificationHistory[]) {
    this.modificationHistory = history;
  }

  clear() {
    this.products = [];
    this.discountRules = [];
    this.modificationHistory = [];
  }
}

// 전역 싱글톤 스토어
const globalStore = new MemoryStore();

// Helper to generate MongoDB-like ObjectId
function generateObjectId(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16);
  const randomValue = Math.random().toString(16).substring(2, 18);
  return timestamp + randomValue.padEnd(16, '0');
}

// Helper to match filter
function matchesFilter<T extends Record<string, any>>(
  item: T,
  filter?: QueryFilter<T>
): boolean {
  if (!filter) return true;

  // Handle $or
  if (filter.$or) {
    return filter.$or.some((orFilter) => matchesFilter(item, orFilter as QueryFilter<T>));
  }

  // Handle $and
  if (filter.$and) {
    return filter.$and.every((andFilter) => matchesFilter(item, andFilter as QueryFilter<T>));
  }

  // Handle regular filters
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or' || key === '$and') continue;

    const itemValue = item[key];

    // Handle special operators
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // $in operator
      if ('$in' in value) {
        if (!Array.isArray(value.$in)) continue;
        const matchFound = value.$in.some((v: any) => {
          if (Array.isArray(itemValue)) {
            return itemValue.some((iv) => String(iv) === String(v));
          }
          return String(itemValue) === String(v);
        });
        if (!matchFound) return false;
        continue;
      }

      // $gte operator
      if ('$gte' in value) {
        const itemDate = new Date(itemValue);
        const filterDate = new Date(value.$gte);
        if (itemDate < filterDate) return false;
        continue;
      }

      // $lte operator
      if ('$lte' in value) {
        const itemDate = new Date(itemValue);
        const filterDate = new Date(value.$lte);
        if (itemDate > filterDate) return false;
        continue;
      }

      // $regex operator
      if ('$regex' in value) {
        const regex = new RegExp(value.$regex, value.$options || '');
        if (!regex.test(String(itemValue))) return false;
        continue;
      }

      // $size operator
      if ('$size' in value) {
        if (!Array.isArray(itemValue) || itemValue.length !== value.$size) {
          return false;
        }
        continue;
      }
    }

    // Handle arrays (check if filter value is in array)
    if (Array.isArray(itemValue)) {
      const matchFound = itemValue.some((v) => String(v) === String(value));
      if (!matchFound) return false;
      continue;
    }

    // Handle direct comparison
    if (String(itemValue) !== String(value)) {
      return false;
    }
  }

  return true;
}

// Helper to apply query options
function applyQueryOptions<T>(items: T[], options?: QueryOptions): T[] {
  let result = [...items];

  // Sort
  if (options?.sort) {
    const sortEntries = Object.entries(options.sort);
    result.sort((a: any, b: any) => {
      for (const [key, order] of sortEntries) {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal) return order === 1 ? -1 : 1;
        if (aVal > bVal) return order === 1 ? 1 : -1;
      }
      return 0;
    });
  }

  // Skip and Limit
  if (options?.skip) {
    result = result.slice(options.skip);
  }
  if (options?.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

export class MemoryAdapter implements IDatabase {
  private connected: boolean = false;
  private store: MemoryStore;

  constructor() {
    this.store = globalStore;
  }

  async connect(): Promise<void> {
    this.connected = true;
    console.log('✅ Memory adapter connected');
  }

  async disconnect(): Promise<void> {
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
    const products = this.store.getProducts();
    const filtered = products.filter((p) => matchesFilter(p, filter));
    return applyQueryOptions(filtered, options);
  }

  async findProductById(id: string): Promise<IProduct | null> {
    const products = this.store.getProducts();
    return products.find((p) => String(p._id) === id) || null;
  }

  async findProductByBarcode(barcode: string): Promise<IProduct | null> {
    const products = this.store.getProducts();
    return products.find((p) => p.barcode === barcode) || null;
  }

  async createProduct(
    data: Omit<IProduct, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IProduct> {
    const products = this.store.getProducts();
    const now = new Date();
    const newProduct: IProduct = {
      ...data,
      _id: new Types.ObjectId(generateObjectId()),
      createdAt: now,
      updatedAt: now,
    };
    products.push(newProduct);
    this.store.setProducts(products);
    return newProduct;
  }

  async updateProduct(
    id: string,
    data: Partial<IProduct>
  ): Promise<IProduct | null> {
    const products = this.store.getProducts();
    const index = products.findIndex((p) => String(p._id) === id);
    if (index === -1) return null;

    products[index] = {
      ...products[index],
      ...data,
      updatedAt: new Date(),
    };
    this.store.setProducts(products);
    return products[index];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const products = this.store.getProducts();
    const filtered = products.filter((p) => String(p._id) !== id);
    if (filtered.length === products.length) return false;
    this.store.setProducts(filtered);
    return true;
  }

  async countProducts(filter?: QueryFilter<IProduct>): Promise<number> {
    const products = this.store.getProducts();
    return products.filter((p) => matchesFilter(p, filter)).length;
  }

  // Discount Rules
  async findDiscountRules(
    filter?: QueryFilter<IDiscountRule>,
    options?: QueryOptions
  ): Promise<IDiscountRule[]> {
    const rules = this.store.getDiscountRules();
    const filtered = rules.filter((r) => matchesFilter(r, filter));
    return applyQueryOptions(filtered, options);
  }

  async findDiscountRuleById(id: string): Promise<IDiscountRule | null> {
    const rules = this.store.getDiscountRules();
    return rules.find((r) => String(r._id) === id) || null;
  }

  async findDiscountRulesByIds(ids: string[]): Promise<IDiscountRule[]> {
    const rules = this.store.getDiscountRules();
    return rules.filter((r) => ids.includes(String(r._id)));
  }

  async createDiscountRule(
    data: Omit<IDiscountRule, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IDiscountRule> {
    const rules = this.store.getDiscountRules();
    const now = new Date();
    const newRule: IDiscountRule = {
      ...data,
      _id: new Types.ObjectId(generateObjectId()),
      createdAt: now,
      updatedAt: now,
    };
    rules.push(newRule);
    this.store.setDiscountRules(rules);
    return newRule;
  }

  async updateDiscountRule(
    id: string,
    data: Partial<IDiscountRule>
  ): Promise<IDiscountRule | null> {
    const rules = this.store.getDiscountRules();
    const index = rules.findIndex((r) => String(r._id) === id);
    if (index === -1) return null;

    rules[index] = {
      ...rules[index],
      ...data,
      updatedAt: new Date(),
    };
    this.store.setDiscountRules(rules);
    return rules[index];
  }

  async deleteDiscountRule(id: string): Promise<boolean> {
    const rules = this.store.getDiscountRules();
    const filtered = rules.filter((r) => String(r._id) !== id);
    if (filtered.length === rules.length) return false;
    this.store.setDiscountRules(filtered);
    return true;
  }

  // Modification History
  async findModificationHistory(
    filter?: QueryFilter<IModificationHistory>,
    options?: QueryOptions
  ): Promise<IModificationHistory[]> {
    const history = this.store.getModificationHistory();
    const filtered = history.filter((h) => matchesFilter(h, filter));
    return applyQueryOptions(filtered, options);
  }

  async createModificationHistory(
    data: Omit<IModificationHistory, '_id'>
  ): Promise<IModificationHistory> {
    const history = this.store.getModificationHistory();
    const newHistory: IModificationHistory = {
      ...data,
      _id: new Types.ObjectId(generateObjectId()),
    };
    history.push(newHistory);
    this.store.setModificationHistory(history);
    return newHistory;
  }
}
