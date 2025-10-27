// Payment method types and constants

export const PAYMENT_METHODS = {
  CARD: "card", // 일반 카드 (카드사 선택 가능)
  SAMSUNG_PAY: "samsung_pay",
  CU_PAY: "cu_pay",
  KAKAO_PAY: "kakao_pay",
  NAVER_PAY: "naver_pay",
  POINT_MEMBERSHIP: "point_membership",
  CASH: "cash"
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

export const PAYMENT_METHOD_NAMES: Record<PaymentMethod, string> = {
  [PAYMENT_METHODS.CARD]: "카드",
  [PAYMENT_METHODS.SAMSUNG_PAY]: "삼성페이",
  [PAYMENT_METHODS.CU_PAY]: "CU페이",
  [PAYMENT_METHODS.KAKAO_PAY]: "카카오페이",
  [PAYMENT_METHODS.NAVER_PAY]: "네이버페이",
  [PAYMENT_METHODS.POINT_MEMBERSHIP]: "멤버십포인트",
  [PAYMENT_METHODS.CASH]: "현금"
};
