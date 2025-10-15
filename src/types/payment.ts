// Payment method types and constants

export const PAYMENT_METHODS = {
  CARD_SHINHAN: "card_shinhan",
  CARD_KB: "card_kb",
  CARD_HYUNDAI: "card_hyundai",
  CARD_SAMSUNG: "card_samsung",
  CU_PAY: "cu_pay",
  KAKAO_PAY: "kakao_pay",
  NAVER_PAY: "naver_pay",
  POINT_MEMBERSHIP: "point_membership",
  CASH: "cash"
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

export const PAYMENT_METHOD_NAMES: Record<PaymentMethod, string> = {
  [PAYMENT_METHODS.CARD_SHINHAN]: "신한카드",
  [PAYMENT_METHODS.CARD_KB]: "KB국민카드",
  [PAYMENT_METHODS.CARD_HYUNDAI]: "현대카드",
  [PAYMENT_METHODS.CARD_SAMSUNG]: "삼성카드",
  [PAYMENT_METHODS.CU_PAY]: "CU페이",
  [PAYMENT_METHODS.KAKAO_PAY]: "카카오페이",
  [PAYMENT_METHODS.NAVER_PAY]: "네이버페이",
  [PAYMENT_METHODS.POINT_MEMBERSHIP]: "멤버십포인트",
  [PAYMENT_METHODS.CASH]: "현금"
};
