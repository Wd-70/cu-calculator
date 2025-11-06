'use client';

import { ICartItem } from '@/types/cart';

interface CartItemListProps {
  items: ICartItem[];
  onUpdateQuantity: (barcode: string, quantity: number) => void;
  onRemoveItem: (barcode: string) => void;
  onItemClick?: (item: ICartItem) => void;
}

export default function CartItemList({ items, onUpdateQuantity, onRemoveItem, onItemClick }: CartItemListProps) {
  if (items.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">장바구니가 비어있습니다</h3>
        <p className="text-sm text-gray-500">상품을 추가해보세요!</p>
      </div>
    );
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          장바구니 ({totalQuantity}개 상품)
        </h3>
        <div className="text-sm font-semibold text-purple-600">
          총 {totalPrice.toLocaleString()}원
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <div
            key={item.barcode}
            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => onItemClick?.(item)}
          >
            <div className="flex items-start gap-3">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">{item.name}</h4>
                <div className="text-xs text-gray-500 mb-2">
                  {item.barcode}
                  {item.brand && ` · ${item.brand}`}
                  {item.category && ` · ${item.category}`}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-purple-600">
                    {item.price.toLocaleString()}원
                  </div>
                  {item.latestPrice && item.latestPrice !== item.price && (
                    <div className="text-xs text-orange-600">
                      가격 변동: {item.latestPrice.toLocaleString()}원
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item.barcode, item.quantity - 1);
                      }}
                      disabled={item.quantity <= 1}
                      className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (value >= 1) {
                          onUpdateQuantity(item.barcode, value);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 text-center py-1.5 border-x border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:z-10"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item.barcode, item.quantity + 1);
                      }}
                      className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  <div className="text-sm text-gray-600">
                    = {(item.price * item.quantity).toLocaleString()}원
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.barcode);
                    }}
                    className="ml-auto p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
