import { supabase } from "../../config/supabase";

export interface ExchangeRateRow {
  id: string;
  organization_id: string;
  base_currency: string;
  target_currency: string;
  rate: number;
  source: "auto" | "manual";
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export async function findRate(
  organizationId: string,
  baseCurrency: string,
  targetCurrency: string
): Promise<ExchangeRateRow | null> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("base_currency", baseCurrency)
    .eq("target_currency", targetCurrency)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function listRates(
  organizationId: string,
  baseCurrency: string
): Promise<ExchangeRateRow[]> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("base_currency", baseCurrency)
    .order("target_currency", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function upsertRate(
  organizationId: string,
  baseCurrency: string,
  targetCurrency: string,
  rate: number,
  source: "auto" | "manual"
): Promise<ExchangeRateRow> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .upsert(
      {
        organization_id: organizationId,
        base_currency: baseCurrency,
        target_currency: targetCurrency,
        rate,
        source,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,base_currency,target_currency" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
