-- VeloDrive PostgreSQL schema for tables missing from the current Neon database.
-- Additive and rerunnable: does not alter or drop existing tables or data.
-- Run against the intended database/branch in the Neon SQL Editor.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.vehicles') IS NULL THEN
    RAISE EXCEPTION 'Expected existing public.users and public.vehicles tables; stopping without creating app tables';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'owner_id'
  ) THEN
    RAISE EXCEPTION 'Expected public.vehicles.owner_id; do not add a separate ownerId column';
  END IF;
END $$;

DO $$
BEGIN
  CREATE TYPE public."enum_bookings_paymentStatus" AS ENUM (
    'pending', 'paid', 'held_in_escrow', 'released_to_owner', 'refunded', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."enum_bookings_escrowStatus" AS ENUM (
    'not_held', 'held', 'released', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."enum_bookings_status" AS ENUM (
    'pending', 'confirmed', 'active', 'completed', 'cancelled', 'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."enum_transactions_type" AS ENUM (
    'subscription', 'membership', 'booking_payment', 'service_charge', 'commission',
    'owner_payout', 'refund', 'wallet_topup', 'wallet_withdrawal',
    'fuel_charge', 'damage_charge', 'delay_charge', 'additional_charge'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."enum_transactions_status" AS ENUM (
    'pending', 'completed', 'failed', 'reversed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."enum_gdpr_consents_consentType" AS ENUM (
    'privacy_policy', 'terms_of_service', 'marketing', 'data_processing', 'gps_tracking'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."enum_documents_type" AS ENUM (
    'certificate_of_registration', 'proof_of_ownership', 'original_certificate',
    'nbi_clearance', 'tax_certificate', 'valid_id', 'drivers_license',
    'ad_campaign_image', 'ad_campaign_video', 'profile_image', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid NOT NULL PRIMARY KEY,
  "bookingReference" varchar(50) NOT NULL UNIQUE,
  "vehicleId" uuid NOT NULL REFERENCES public.vehicles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "ownerId" uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "renterId" uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "rentalStartDate" date NOT NULL,
  "rentalEndDate" date NOT NULL,
  "numberOfDays" integer NOT NULL,
  "pickupPoint" text NOT NULL,
  "returnPoint" text NOT NULL,
  "destinationPoint" text NOT NULL,
  "basePrice" numeric(12, 2) NOT NULL,
  "commissionPercent" numeric(5, 2) DEFAULT 10.00,
  "commissionAmount" numeric(12, 2) NOT NULL,
  "platformFee" numeric(12, 2) DEFAULT 0.00,
  "totalAmount" numeric(12, 2) NOT NULL,
  currency varchar(3) DEFAULT 'PHP',
  "paymentStatus" public."enum_bookings_paymentStatus" DEFAULT 'pending',
  "escrowStatus" public."enum_bookings_escrowStatus" DEFAULT 'not_held',
  "paymentMethod" varchar(50),
  "paypalOrderId" varchar(64),
  "paymentDate" timestamptz,
  "serviceChargeAmount" numeric(12, 2) DEFAULT 250.00,
  "ownerPayout" numeric(12, 2) NOT NULL,
  "ownerNetAmount" numeric(12, 2) NOT NULL,
  "serviceChargeFee" numeric(12, 2) NOT NULL DEFAULT 0.00,
  status public."enum_bookings_status" DEFAULT 'pending',
  "fuelCharged" numeric(12, 2) DEFAULT 0.00,
  "damageCharged" numeric(12, 2) DEFAULT 0.00,
  "delayHours" integer DEFAULT 0,
  "delayCharge" numeric(12, 2) DEFAULT 0.00,
  "additionalCharges" numeric(12, 2) DEFAULT 0.00,
  "actualReturnDate" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS bookings_vehicleId_idx ON public.bookings ("vehicleId");
CREATE INDEX IF NOT EXISTS bookings_ownerId_idx ON public.bookings ("ownerId");
CREATE INDEX IF NOT EXISTS bookings_renterId_idx ON public.bookings ("renterId");
CREATE INDEX IF NOT EXISTS bookings_status_idx ON public.bookings (status);
CREATE INDEX IF NOT EXISTS bookings_paymentStatus_idx ON public.bookings ("paymentStatus");

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL PRIMARY KEY,
  reference varchar(100) NOT NULL UNIQUE,
  type public."enum_transactions_type" NOT NULL,
  "userId" uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "bookingId" uuid REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL,
  amount numeric(15, 2) NOT NULL,
  currency varchar(3) DEFAULT 'PHP',
  status public."enum_transactions_status" DEFAULT 'pending',
  description text,
  metadata json,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS transactions_userId_idx ON public.transactions ("userId");
CREATE INDEX IF NOT EXISTS transactions_type_idx ON public.transactions (type);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON public.transactions (status);
CREATE INDEX IF NOT EXISTS transactions_bookingId_idx ON public.transactions ("bookingId");

CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid NOT NULL PRIMARY KEY,
  "userId" uuid NOT NULL UNIQUE REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  balance numeric(15, 2) DEFAULT 0.00,
  currency varchar(3) DEFAULT 'PHP',
  "bankAccountName" varchar(255),
  "bankAccountNumber" varchar(100),
  "bankName" varchar(100),
  "isActive" boolean DEFAULT true,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.gdpr_consents (
  id uuid NOT NULL PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "consentType" public."enum_gdpr_consents_consentType" NOT NULL,
  "isGranted" boolean DEFAULT false,
  "grantedAt" timestamptz,
  "withdrawnAt" timestamptz,
  "ipAddress" varchar(45),
  "userAgent" text,
  version varchar(20),
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS gdpr_consents_userId_idx ON public.gdpr_consents ("userId");
CREATE INDEX IF NOT EXISTS gdpr_consents_consentType_idx ON public.gdpr_consents ("consentType");

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid NOT NULL PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "vehicleId" uuid REFERENCES public.vehicles(id) ON UPDATE CASCADE ON DELETE SET NULL,
  type public."enum_documents_type" NOT NULL,
  "fileName" varchar(255) NOT NULL,
  "filePath" text NOT NULL,
  "fileSize" integer,
  "mimeType" varchar(100),
  "isVerified" boolean DEFAULT false,
  "verifiedAt" timestamptz,
  "verifiedBy" uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS documents_userId_idx ON public.documents ("userId");
CREATE INDEX IF NOT EXISTS documents_vehicleId_idx ON public.documents ("vehicleId");
CREATE INDEX IF NOT EXISTS documents_type_idx ON public.documents (type);
CREATE INDEX IF NOT EXISTS documents_isVerified_idx ON public.documents ("isVerified");

CREATE TABLE IF NOT EXISTS public.gps_locations (
  id uuid NOT NULL PRIMARY KEY,
  "vehicleId" uuid NOT NULL REFERENCES public.vehicles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "bookingId" uuid REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL,
  latitude numeric(10, 7) NOT NULL,
  longitude numeric(10, 7) NOT NULL,
  speed numeric(6, 2),
  heading numeric(6, 2),
  address text,
  "recordedAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS gps_locations_vehicleId_idx ON public.gps_locations ("vehicleId");
CREATE INDEX IF NOT EXISTS gps_locations_bookingId_idx ON public.gps_locations ("bookingId");
CREATE INDEX IF NOT EXISTS gps_locations_recordedAt_idx ON public.gps_locations ("recordedAt");

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id uuid NOT NULL PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  token text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "isRevoked" boolean DEFAULT false,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS refresh_tokens_userId_idx ON public.refresh_tokens ("userId");
CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON public.refresh_tokens (token);
