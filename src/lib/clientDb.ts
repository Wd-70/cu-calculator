/**
 * 클라이언트 사이드 데이터 저장소 (LocalStorage 기반)
 * 개인화된 데이터(장바구니, 프리셋)를 브라우저에 저장
 */

import { ICart, CreateCartInput, UpdateCartInput, ICartItem } from '@/types/cart';
import { IPreset, CreatePresetInput, UpdatePresetInput } from '@/types/preset';

// LocalStorage 키
const STORAGE_KEYS = {
  CARTS: 'cu_calculator_carts',
  PRESETS: 'cu_calculator_presets',
  INITIALIZED: 'cu_calculator_initialized',
} as const;

// ID 생성 헬퍼
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Cart Operations
// ============================================================================

export function getCarts(): ICart[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEYS.CARTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get carts from localStorage:', error);
    return [];
  }
}

export function getCart(id: string): ICart | null {
  const carts = getCarts();
  return carts.find(c => String(c._id) === id) || null;
}

export function getMainCart(): ICart | null {
  const carts = getCarts();
  return carts.find(c => c.isMain) || null;
}

export function createCart(input: CreateCartInput): ICart {
  const carts = getCarts();

  // isMain이 true면 다른 카트들의 isMain을 false로 변경
  if (input.isMain) {
    carts.forEach(cart => {
      cart.isMain = false;
    });
  }

  const now = new Date();
  const newCart: ICart = {
    _id: generateId(),
    name: input.name,
    emoji: input.emoji,
    description: input.description,
    color: input.color,
    items: input.items || [],
    paymentMethod: input.paymentMethod,
    presetId: input.presetId,
    isMain: input.isMain || false,
    createdAt: now,
    updatedAt: now,
  };

  carts.push(newCart);
  localStorage.setItem(STORAGE_KEYS.CARTS, JSON.stringify(carts));

  return newCart;
}

export function updateCart(id: string, updates: UpdateCartInput): ICart | null {
  const carts = getCarts();
  const index = carts.findIndex(c => String(c._id) === id);

  if (index === -1) return null;

  // isMain이 true로 변경되면 다른 카트들의 isMain을 false로
  if (updates.isMain) {
    carts.forEach((cart, i) => {
      if (i !== index) cart.isMain = false;
    });
  }

  carts[index] = {
    ...carts[index],
    ...updates,
    updatedAt: new Date(),
  };

  localStorage.setItem(STORAGE_KEYS.CARTS, JSON.stringify(carts));

  return carts[index];
}

export function deleteCart(id: string): boolean {
  const carts = getCarts();
  const filtered = carts.filter(c => String(c._id) !== id);

  if (filtered.length === carts.length) return false;

  localStorage.setItem(STORAGE_KEYS.CARTS, JSON.stringify(filtered));
  return true;
}

export function setMainCart(id: string): ICart | null {
  return updateCart(id, { isMain: true });
}

export function addItemToCart(cartId: string, item: ICartItem): ICart | null {
  const cart = getCart(cartId);
  if (!cart) return null;

  // 동일한 상품이 이미 있는지 확인
  const existingItemIndex = cart.items.findIndex(i => i.barcode === item.barcode);

  if (existingItemIndex !== -1) {
    // 이미 존재하면 수량 업데이트
    cart.items[existingItemIndex].quantity += item.quantity;
  } else {
    // 새 아이템 추가
    cart.items.push(item);
  }

  return updateCart(cartId, { items: cart.items });
}

export function removeItemFromCart(cartId: string, barcode: string): ICart | null {
  const cart = getCart(cartId);
  if (!cart) return null;

  const filteredItems = cart.items.filter(i => i.barcode !== barcode);
  return updateCart(cartId, { items: filteredItems });
}

export function updateCartItem(cartId: string, barcode: string, updates: Partial<ICartItem>): ICart | null {
  const cart = getCart(cartId);
  if (!cart) return null;

  const itemIndex = cart.items.findIndex(i => i.barcode === barcode);
  if (itemIndex === -1) return null;

  cart.items[itemIndex] = {
    ...cart.items[itemIndex],
    ...updates,
  };

  return updateCart(cartId, { items: cart.items });
}

// ============================================================================
// Preset Operations
// ============================================================================

export function getPresets(): IPreset[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEYS.PRESETS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get presets from localStorage:', error);
    return [];
  }
}

export function getPreset(id: string): IPreset | null {
  const presets = getPresets();
  return presets.find(p => String(p._id) === id) || null;
}

export function createPreset(input: CreatePresetInput): IPreset {
  const presets = getPresets();

  const now = new Date();
  const newPreset: IPreset = {
    _id: generateId(),
    name: input.name,
    description: input.description,
    emoji: input.emoji,
    color: input.color,
    discountIds: input.discountIds || [],
    paymentMethod: input.paymentMethod,
    createdAt: now,
    updatedAt: now,
  };

  presets.push(newPreset);
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));

  return newPreset;
}

export function updatePreset(id: string, updates: UpdatePresetInput): IPreset | null {
  const presets = getPresets();
  const index = presets.findIndex(p => String(p._id) === id);

  if (index === -1) return null;

  presets[index] = {
    ...presets[index],
    ...updates,
    updatedAt: new Date(),
  };

  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));

  return presets[index];
}

export function deletePreset(id: string): boolean {
  const presets = getPresets();
  const filtered = presets.filter(p => String(p._id) !== id);

  if (filtered.length === presets.length) return false;

  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(filtered));
  return true;
}

// ============================================================================
// Initialization
// ============================================================================

export function isInitialized(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.INITIALIZED) === 'true';
}

export function initializeClientStorage() {
  if (typeof window === 'undefined') return;

  // 이미 초기화되었으면 스킵
  if (isInitialized()) return;

  // 기본 카트 생성
  const carts = getCarts();
  if (carts.length === 0) {
    createCart({
      name: '내 장바구니',
      emoji: '🛒',
      color: 'purple',
      items: [],
      isMain: true,
    });
  }

  // 초기화 완료 표시
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}

// ============================================================================
// Utility
// ============================================================================

export function clearAllClientData() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.CARTS);
  localStorage.removeItem(STORAGE_KEYS.PRESETS);
  localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
}

export function exportClientData() {
  return {
    carts: getCarts(),
    presets: getPresets(),
  };
}

export function importClientData(data: { carts?: ICart[]; presets?: IPreset[] }) {
  if (typeof window === 'undefined') return;

  if (data.carts) {
    localStorage.setItem(STORAGE_KEYS.CARTS, JSON.stringify(data.carts));
  }
  if (data.presets) {
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(data.presets));
  }
}
