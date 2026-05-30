export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SubscriptionStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentStatus = {
  PENDING: 'pending',
  WAITING_FOR_CAPTURE: 'waiting_for_capture',
  SUCCEEDED: 'succeeded',
  CANCELED: 'canceled',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const NodeStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  DEGRADED: 'degraded',
} as const;
export type NodeStatus = (typeof NodeStatus)[keyof typeof NodeStatus];

export const Locale = {
  RU: 'ru',
  EN: 'en',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const LegalDocSlug = {
  PRIVACY: 'privacy',
  OFFER: 'offer',
  COOKIE: 'cookie',
} as const;
export type LegalDocSlug = (typeof LegalDocSlug)[keyof typeof LegalDocSlug];
