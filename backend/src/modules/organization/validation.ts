import { OrganizationRole } from "../../middleware/organization.middleware";

/**
 * Roles assignable through the member-management API. "owner"
 * is deliberately excluded — ownership transfer is explicitly
 * out of scope (approved rule: "Cannot transfer ownership"), so
 * nobody can be promoted to owner through this endpoint.
 *
 * Phase 7 — widened from the original 2 to all 5 non-owner roles.
 * This is a separate allowlist from permissions/roles.ts's
 * ORGANIZATION_ROLES by design (defense in depth: input validation
 * and the permission engine are independent layers), but it must be
 * kept in sync with it — a role added to one without the other is a
 * bug, not a feature.
 */
const ASSIGNABLE_ROLES = [
  "company_admin",
  "manager",
  "host",
  "member",
  "spectator",
] as const;

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function isAssignableRole(
  value: string
): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(
    value
  );
}

export interface ChangeRoleInput {
  role: OrganizationRole;
}

export function validateChangeRole(
  input: unknown
): ChangeRoleInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (
    typeof data.role !== "string" ||
    !isAssignableRole(data.role.trim())
  ) {
    throw new Error(
      `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}`
    );
  }

  return { role: data.role.trim() as OrganizationRole };
}

export interface CreateOrganizationInput {
  name: string;
  country: string | null;
  timezone: string | null;
}

/**
 * Property types offered on the registration form — mirrors
 * properties/new/page.tsx's own <select> options exactly (apartment,
 * house, villa, condo, studio, hotel, guesthouse, other) so the
 * business-profile question ("what kind of properties do you manage")
 * uses the same vocabulary the Properties module itself uses, rather
 * than inventing a second one.
 */
export const REGISTRATION_PROPERTY_TYPES = [
  "apartment",
  "house",
  "villa",
  "condo",
  "studio",
  "hotel",
  "guesthouse",
  "other",
] as const;

export const REGISTRATION_REFERRAL_SOURCES = [
  "search_engine",
  "social_media",
  "referral",
  "advertisement",
  "other",
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterOrganizationInput {
  fullName: string;
  email: string;
  password: string;
  phone: string | null;
  country: string;
  organizationName: string;
  numberOfListings: number | null;
  propertyTypes: string[];
  referralSource: string | null;
}

/**
 * Registration collects both the owner's personal details and the
 * organization's business-profile details in one submission (see
 * service.ts's registerOrganization, which creates the auth account
 * and the organization together, rolling back the account if
 * organization creation fails). Full name, email, password,
 * organization name, and country are required; phone/number of
 * listings/property types/referral source are optional business
 * context, matching onboarding's existing optional timezone field.
 */
export function validateRegisterOrganization(
  input: unknown
): RegisterOrganizationInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.fullName !== "string" || !data.fullName.trim()) {
    throw new Error("Full name is required");
  }

  const fullName = data.fullName.trim();

  if (fullName.length > 200) {
    throw new Error("Full name must be 200 characters or fewer");
  }

  if (typeof data.email !== "string" || !data.email.trim()) {
    throw new Error("Email is required");
  }

  const email = data.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Email must be a valid email address");
  }

  if (typeof data.password !== "string" || data.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  if (data.password.length > 200) {
    throw new Error("Password must be 200 characters or fewer");
  }

  const password = data.password;

  if (
    typeof data.organizationName !== "string" ||
    !data.organizationName.trim()
  ) {
    throw new Error("Organization / company name is required");
  }

  const organizationName = data.organizationName.trim();

  if (organizationName.length < 2 || organizationName.length > 120) {
    throw new Error(
      "Organization name must be between 2 and 120 characters"
    );
  }

  let phone: string | null = null;

  if (data.phone !== undefined && data.phone !== null && data.phone !== "") {
    if (typeof data.phone !== "string") {
      throw new Error("Phone number must be a string");
    }

    phone = data.phone.trim().slice(0, 40) || null;
  }

  if (typeof data.country !== "string" || !data.country.trim()) {
    throw new Error("Country is required");
  }

  const country = data.country.trim();

  let numberOfListings: number | null = null;

  if (
    data.numberOfListings !== undefined &&
    data.numberOfListings !== null &&
    data.numberOfListings !== ""
  ) {
    const parsed = Number(data.numberOfListings);

    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      throw new Error("Number of listings must be a whole number");
    }

    numberOfListings = parsed;
  }

  let propertyTypes: string[] = [];

  if (data.propertyTypes !== undefined && data.propertyTypes !== null) {
    if (!Array.isArray(data.propertyTypes)) {
      throw new Error("Property types must be a list");
    }

    propertyTypes = data.propertyTypes.filter(
      (value): value is string =>
        typeof value === "string" &&
        (REGISTRATION_PROPERTY_TYPES as readonly string[]).includes(value)
    );
  }

  let referralSource: string | null = null;

  if (
    data.referralSource !== undefined &&
    data.referralSource !== null &&
    data.referralSource !== ""
  ) {
    if (
      typeof data.referralSource !== "string" ||
      !(REGISTRATION_REFERRAL_SOURCES as readonly string[]).includes(
        data.referralSource
      )
    ) {
      throw new Error("Invalid referral source");
    }

    referralSource = data.referralSource;
  }

  return {
    fullName,
    email,
    password,
    phone,
    country,
    organizationName,
    numberOfListings,
    propertyTypes,
    referralSource,
  };
}

/**
 * Onboarding's create-workspace form. Only `name` is required —
 * `country`/`timezone` mirror the two optional, freely-typed fields
 * the organizations table actually has room for (confirmed via schema
 * introspection); no enum is enforced for either, matching how
 * settings/validation.ts already treats timezone/currency as
 * free text.
 */
export function validateCreateOrganization(
  input: unknown
): CreateOrganizationInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.name !== "string" || !data.name.trim()) {
    throw new Error("Organization name is required");
  }

  const name = data.name.trim();

  if (name.length < 2) {
    throw new Error("Organization name must be at least 2 characters");
  }

  if (name.length > 120) {
    throw new Error("Organization name must be 120 characters or fewer");
  }

  let country: string | null = null;

  if (
    data.country !== undefined &&
    data.country !== null &&
    data.country !== ""
  ) {
    if (typeof data.country !== "string") {
      throw new Error("country must be a string");
    }

    country = data.country.trim() || null;
  }

  let timezone: string | null = null;

  if (
    data.timezone !== undefined &&
    data.timezone !== null &&
    data.timezone !== ""
  ) {
    if (typeof data.timezone !== "string") {
      throw new Error("timezone must be a string");
    }

    timezone = data.timezone.trim() || null;
  }

  return { name, country, timezone };
}
