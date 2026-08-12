import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import { getOrganizationSettings } from "../settings/service";
import { listOrganizationRates, setManualRate } from "./service";
import { isSupportedCurrency, SUPPORTED_CURRENCY_CODES } from "../../constants/currency";

function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

/**
 * GET /api/organization/exchange-rates — every supported currency
 * paired with the org's base currency, plus whatever rate is
 * currently on file for it (null if none yet — never fabricated).
 * Any organization member may view this (matches the settings GET
 * pattern — viewing isn't a "manage" action).
 */
export async function listExchangeRatesController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const organizationId = req.organization.id;
    const settings = await getOrganizationSettings(organizationId);
    const rows = await listOrganizationRates(
      organizationId,
      settings.baseCurrency
    );

    const rateByTarget = new Map(rows.map((row) => [row.target_currency, row]));

    const rates = SUPPORTED_CURRENCY_CODES.filter(
      (code) => code !== settings.baseCurrency
    ).map((code) => {
      const existing = rateByTarget.get(code);

      return {
        targetCurrency: code,
        rate: existing?.rate ?? null,
        source: existing?.source ?? null,
        fetchedAt: existing?.fetched_at ?? null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        baseCurrency: settings.baseCurrency,
        exchangeRateMode: settings.exchangeRateMode,
        rates,
      },
    });
  } catch (error) {
    console.error("List exchange rates error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load exchange rates",
    });
  }
}

/**
 * PATCH /api/organization/exchange-rates/:targetCurrency — sets a
 * manual rate (1 targetCurrency = rate baseCurrency). Only takes
 * effect for conversions once the organization's exchange_rate_mode
 * is 'manual' (see PATCH /api/organization/settings), but can be
 * staged ahead of time in either mode. owner/company_admin only.
 */
export async function setExchangeRateController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const targetCurrency = String(req.params.targetCurrency ?? "")
      .trim()
      .toUpperCase();

    if (!isSupportedCurrency(targetCurrency)) {
      throw new Error(
        `targetCurrency must be one of: ${SUPPORTED_CURRENCY_CODES.join(", ")}`
      );
    }

    const { rate } = req.body ?? {};

    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("rate must be a positive number");
    }

    const organizationId = req.organization.id;
    const settings = await getOrganizationSettings(organizationId);

    if (targetCurrency === settings.baseCurrency) {
      throw new Error(
        "targetCurrency cannot be the same as the organization's base currency"
      );
    }

    const saved = await setManualRate(
      organizationId,
      settings.baseCurrency,
      targetCurrency,
      rate
    );

    return res.status(200).json({
      success: true,
      data: {
        targetCurrency: saved.target_currency,
        rate: saved.rate,
        source: saved.source,
        fetchedAt: saved.fetched_at,
      },
    });
  } catch (error) {
    console.error("Set exchange rate error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to set exchange rate",
    });
  }
}
