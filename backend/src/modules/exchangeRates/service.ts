import { findRate, upsertRate, listRates, ExchangeRateRow } from "./repository";

// Kept short: this fetch sits inline in the reservation-creation
// request path (see reservations/service.ts's addReservation), so a
// slow/unreachable rate API must degrade quickly rather than making
// every foreign-currency booking wait a long time before falling back.
const FETCH_TIMEOUT_MS = 4000;

// The free API updates once a day, so re-fetching more often than
// this would only hammer it for no benefit.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface RateResult {
  rate: number;
  source: "auto" | "manual";
  fetchedAt: string;
}

/**
 * A stored row (organization_id, base_currency, target_currency, rate)
 * means "1 target_currency = rate base_currency" — matching how an
 * owner would naturally read it (e.g. base=PKR, target=AED, rate=77.70
 * reads as "1 AED = 77.70 PKR").
 *
 * Resolves the rate to convert an amount in `transactionCurrency` into
 * `orgBaseCurrency`, honoring the organization's exchange_rate_mode:
 *
 * - manual: only ever reads a rate an owner/company_admin explicitly
 *   set via setManualRate. Returns null (never fabricates a rate) if
 *   none has been set yet for this currency pair.
 * - auto: serves a cached rate if it's still fresh, otherwise fetches
 *   a live rate from a free public API and caches it. Falls back to
 *   the last cached rate (even if stale) if the live fetch fails, and
 *   only returns null if there is truly no rate available anywhere —
 *   callers must treat null as "skip conversion for this reservation,"
 *   never substitute a guessed rate.
 */
export async function resolveExchangeRate(
  organizationId: string,
  transactionCurrency: string,
  orgBaseCurrency: string,
  mode: "auto" | "manual"
): Promise<RateResult | null> {
  if (transactionCurrency === orgBaseCurrency) {
    return {
      rate: 1,
      source: "auto",
      fetchedAt: new Date().toISOString(),
    };
  }

  const cached = await findRate(
    organizationId,
    orgBaseCurrency,
    transactionCurrency
  );

  if (mode === "manual") {
    if (!cached) return null;

    return {
      rate: cached.rate,
      source: cached.source,
      fetchedAt: cached.fetched_at,
    };
  }

  if (
    cached &&
    Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS
  ) {
    return {
      rate: cached.rate,
      source: cached.source,
      fetchedAt: cached.fetched_at,
    };
  }

  try {
    const liveRate = await fetchLiveRate(
      transactionCurrency,
      orgBaseCurrency
    );

    if (liveRate !== null) {
      const saved = await upsertRate(
        organizationId,
        orgBaseCurrency,
        transactionCurrency,
        liveRate,
        "auto"
      );

      return {
        rate: saved.rate,
        source: "auto",
        fetchedAt: saved.fetched_at,
      };
    }
  } catch {
    // Network/API failure — fall through to the stale cache below
    // rather than letting this block reservation creation.
  }

  if (cached) {
    return {
      rate: cached.rate,
      source: cached.source,
      fetchedAt: cached.fetched_at,
    };
  }

  return null;
}

/**
 * Reads "1 fromCurrency = ? toCurrency" from a free, no-API-key public
 * rate service. Returns null on any failure (bad status, timeout,
 * malformed response, unsupported currency) — the caller decides how
 * to degrade, this function never throws for an expected failure mode.
 */
async function fetchLiveRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${fromCurrency}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };

    if (data.result !== "success" || !data.rates) {
      return null;
    }

    const rate = data.rates[toCurrency];

    return typeof rate === "number" && Number.isFinite(rate) && rate > 0
      ? rate
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function setManualRate(
  organizationId: string,
  orgBaseCurrency: string,
  transactionCurrency: string,
  rate: number
): Promise<ExchangeRateRow> {
  return upsertRate(
    organizationId,
    orgBaseCurrency,
    transactionCurrency,
    rate,
    "manual"
  );
}

export async function listOrganizationRates(
  organizationId: string,
  orgBaseCurrency: string
): Promise<ExchangeRateRow[]> {
  return listRates(organizationId, orgBaseCurrency);
}
