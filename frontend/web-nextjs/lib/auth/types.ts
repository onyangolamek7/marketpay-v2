// Authentication domain model. Mirrors the API Gateway contract documented in
// docs/AUTH_API_CONTRACT.md. Backend values win if they ever diverge.

export const ROLES = ['consumer', 'retailer', 'wholesaler', 'rider', 'gov_analyst', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Roles a member of the public may self-register as. Admin/gov_analyst are provisioned. */
export const PUBLIC_ROLES = ['consumer', 'retailer', 'wholesaler', 'rider'] as const;
export type PublicRole = (typeof PUBLIC_ROLES)[number];

/** Roles whose permissions only activate after identity verification. */
export const KYC_ROLES: Role[] = ['retailer', 'wholesaler', 'gov_analyst'];

export type AccountStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'LOCKED'
  | 'DEACTIVATED';

export type KycStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_INFO';

export type MfaType = 'sms' | 'totp' | 'email';

export type DocumentType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'BUSINESS_REGISTRATION'
  | 'TAX_PIN_CERTIFICATE';

export interface User {
  id: string;
  full_name: string;
  /** Masked by the gateway for display (e.g. "+254 ••• ••• 482"). */
  phone_number: string;
  email: string | null;
  role: Role;
  status: AccountStatus;
  kyc_status: KycStatus | null;
  kyc_reason?: string | null;
  kyc_required_documents?: DocumentType[];
  mfa_enabled: boolean;
  location?: string | null;
}

export interface MfaMethod {
  type: MfaType;
  /** Never a full phone number or email address. */
  destination_masked: string | null;
}

export interface MfaChallenge {
  methods: MfaMethod[];
  /** ISO timestamp after which the challenge must be restarted. */
  expires_at: string;
  attempts_remaining: number;
}

/** Login either establishes a session or hands back an MFA challenge. */
export type LoginResult =
  | { mfa_required: false; user: User }
  | { mfa_required: true; challenge: MfaChallenge };

export interface OtpChallenge {
  destination_masked: string;
  expires_at: string;
  /** Seconds until "Resend code" becomes available. */
  resend_after: number;
}

export interface TotpSetup {
  /** otpauth:// URI the QR component renders. Supplied by the backend only. */
  provisioning_uri: string;
  /** Manual-entry key for users who cannot scan. */
  manual_key: string;
}

export interface KycSubmission {
  status: KycStatus;
  reason?: string | null;
  required_documents?: DocumentType[];
  submitted_at?: string;
}

/** The single source of truth for what the app may show a visitor. */
export type AuthState =
  | 'INITIALIZING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'MFA_REQUIRED'
  | 'KYC_REQUIRED'
  | 'KYC_PENDING'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_LOCKED'
  | 'SESSION_EXPIRED';

/** Standard API envelope: { data, meta, errors }. */
export interface ApiEnvelope<T> {
  data: T | null;
  meta?: Record<string, unknown>;
  errors?: ApiErrorDetail[];
}

export interface ApiErrorDetail {
  error_code?: string;
  message?: string;
  field?: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  consumer: 'Consumer',
  retailer: 'Retailer',
  wholesaler: 'Wholesaler',
  rider: 'Rider',
  gov_analyst: 'Government Analyst',
  admin: 'Administrator',
};

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  NATIONAL_ID: 'National ID / Huduma Namba',
  PASSPORT: 'Passport',
  BUSINESS_REGISTRATION: 'Business registration certificate',
  TAX_PIN_CERTIFICATE: 'Tax PIN certificate',
};
