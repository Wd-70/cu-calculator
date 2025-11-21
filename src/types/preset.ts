import { Types } from 'mongoose';
import { PaymentMethod } from './payment';
import { DiscountCategory } from './discount';

/**
 * 사용자 프리셋 타입 정의
 * 자주 사용하는 할인 조합을 저장하고 빠르게 적용
 */

/**
 * 결제수단 상세 정보
 */
export interface PaymentMethodInfo {
  method: PaymentMethod;

  // 상세 정보
  channel?: 'direct_card' | 'card' | 'samsung_pay' | 'naver_pay' | 'kakao_pay' | 'cu_pay' | 'toss_pay' | 'money' | 'account' | 'cash';
  cardIssuer?: 'shinhan' | 'bc' | 'samsung' | 'hana' | 'woori' | 'kb' | 'hyundai' | 'nh' | 'ibk' | 'suhyup';
  cardType?: 'personal_credit' | 'personal_check' | 'corporate' | 'prepaid' | 'gift';

  // BC카드 여부 (하나BC, 우리BC 등)
  isBCCard?: boolean;

  // 네이버페이 특수
  naverPayMethod?: 'qr' | 'card';

  // 별칭 (사용자가 지정)
  nickname?: string; // 예: "주력 카드", "월급날 카드"

  // 기본 결제수단 여부
  isDefault?: boolean;
}

/**
 * 사용자 구독/멤버십 정보
 */
export interface UserSubscription {
  // 할인 규칙 ID (구독, 통신사 할인 등)
  discountId: Types.ObjectId | string;

  // 구독 타입
  type: 'subscription' | 'telecom' | 'membership' | 'card_benefit';

  // 이름 (자동 또는 사용자 지정)
  name: string;

  // 유효 기간
  validFrom?: Date;
  validTo?: Date;

  // 사용 제한 (횟수 기준 - 레거시)
  dailyUsageRemaining?: number;   // 오늘 남은 횟수
  totalUsageRemaining?: number;   // 전체 남은 횟수
  dailyUsageLimit?: number;        // 하루 최대 사용 횟수
  totalUsageLimit?: number;        // 전체 최대 사용 횟수

  // 상품 개수 제한 (개별 상품 단위)
  dailyItemRemaining?: number;     // 오늘 남은 상품 개수
  totalItemRemaining?: number;     // 전체 남은 상품 개수
  dailyItemLimit?: number;         // 하루 최대 상품 개수
  totalItemLimit?: number;         // 전체 최대 상품 개수

  // 활성화 여부
  isActive: boolean;
}

export interface IPreset {
  _id: Types.ObjectId | string;

  // 프리셋 메타데이터
  name: string; // 예: "출근길 조합", "점심 도시락"
  emoji?: string; // 예: "🏃", "🍱"
  description?: string;
  color?: string; // 프리셋 색상
  isDefault?: boolean; // 기본 프리셋 여부

  // ===== 확장: 사용자 결제수단 목록 =====
  paymentMethods?: PaymentMethodInfo[]; // 사용 가능한 결제수단들

  // ===== 확장: 사용자 구독/멤버십 목록 =====
  subscriptions?: UserSubscription[]; // 가입한 구독/멤버십들

  // ===== 확장: QR 스캔 기능 =====
  hasQRScanner?: boolean; // 포켓CU 앱 사용 여부

  // 할인 설정
  discountIds?: (Types.ObjectId | string)[]; // 선택된 할인 규칙들 (수동 선택 시)
  paymentMethod?: PaymentMethod; // 기본 결제수단 (하위 호환)

  // 통계 정보
  usageCount?: number; // 사용 횟수
  lastUsedAt?: Date;

  // 메타데이터
  createdAt: Date;
  updatedAt: Date;
}

// 하위 호환성
export interface IUserPreset extends IPreset {}

export interface CreatePresetInput {
  name: string;
  emoji?: string;
  description?: string;
  color?: string;
  discountIds?: (Types.ObjectId | string)[];
  paymentMethod?: PaymentMethod;
  paymentMethods?: PaymentMethodInfo[];
  subscriptions?: UserSubscription[];
  hasQRScanner?: boolean;
}

export interface UpdatePresetInput {
  name?: string;
  emoji?: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  discountIds?: (Types.ObjectId | string)[];
  paymentMethod?: PaymentMethod;
  paymentMethods?: PaymentMethodInfo[];
  subscriptions?: UserSubscription[];
  hasQRScanner?: boolean;
  usageCount?: number;
  lastUsedAt?: Date;
}
