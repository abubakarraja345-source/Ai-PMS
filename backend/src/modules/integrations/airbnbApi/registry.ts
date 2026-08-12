import { airbnbApiAdapter } from "./adapter";
import { airbnbMockAdapter, isMockAdapterAllowed } from "./mockAdapter";
import { AirbnbApiAdapter } from "./types";

/** The mock adapter is only ever selected under the explicit,
 * non-production guard in mockAdapter.ts — everywhere else this
 * resolves to the real adapter, which itself fails closed until
 * genuine Airbnb credentials AND a verified API contract exist. */
export function getAirbnbApiAdapter(): AirbnbApiAdapter {
  return isMockAdapterAllowed() ? airbnbMockAdapter : airbnbApiAdapter;
}
