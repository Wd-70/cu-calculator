import { Types } from 'mongoose';
import { PaymentMethod } from './payment';

/**
 * 사용자 프리셋 타입 정의
 * 자주 사용하는 할인 조합을 저장하고 빠르게 적용
 */

export interface IUserPreset {
  _id: Types.ObjectId | string;

  // 프리셋 메타데이터
  name: string; // 예: "출근길 조합", "점심 도시락"
  emoji?: string; // 예: "🏃", "🍱"
  description?: string;

  // 할인 설정
  selectedDiscountIds: (Types.ObjectId | string)[]; // 선택된 할인 규칙들
  paymentMethod?: PaymentMethod; // 결제수단

  // 통계 정보
  usageCount: number; // 사용 횟수
  lastUsedAt?: Date;

  // 메타데이터
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePresetInput {
  name: string;
  emoji?: string;
  description?: string;
  selectedDiscountIds: (Types.ObjectId | string)[];
  paymentMethod?: PaymentMethod;
}

export interface UpdatePresetInput {
  name?: string;
  emoji?: string;
  description?: string;
  selectedDiscountIds?: (Types.ObjectId | string)[];
  paymentMethod?: PaymentMethod;
}
