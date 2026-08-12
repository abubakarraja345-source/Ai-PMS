import dns from "dns";
import net from "net";
import { env } from "../../config/env";

/**
 * SSRF guard for user-supplied iCal feed URLs. Used both by the new
 * test-before-save endpoint and by the real fetch path
 * (providers/ical.adapter.ts), so a malicious feed URL can never reach
 * an internal service regardless of which code path fetches it —
 * closing a gap the existing adapter never covered (it only checked
 * the protocol).
 *
 * Resolves the hostname via DNS and checks every returned address,
 * not just a literal IP in the URL — a hostname that looks public can
 * still resolve to a private address (DNS rebinding), so validating
 * the literal string alone isn't sufficient.
 *
 * Loopback (127.0.0.0/8, ::1, "localhost") is allowed outside
 * production — reusing the same `env.nodeEnv !== "production"` gate
 * app.ts already uses to expose /api/test, rather than inventing a
 * new environment variable. This backend runs locally only for now
 * (never NODE_ENV=production), which is what lets this phase's live
 * tests exercise the real fetch+parse path against a local `.ics`
 * server, exactly as every previous phase's tests have. Every other
 * private/reserved range (10.x, 172.16–31.x, 192.168.x, link-local)
 * stays blocked unconditionally, in every environment — only "my own
 * loopback" is relaxed, never the wider private network.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL is not valid");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https");
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowLoopback = env.nodeEnv !== "production";

  if (isLoopbackHostname(hostname)) {
    if (!allowLoopback) {
      throw new Error("URL may not point to a local or private address");
    }
    return parsed;
  }

  if (net.isIP(hostname)) {
    // A literal IP in the URL — checked directly, no DNS lookup needed.
    assertPublicAddress(hostname, allowLoopback);
  } else {
    let addresses: { address: string }[];

    try {
      addresses = await dns.promises.lookup(hostname, { all: true });
    } catch {
      throw new Error("URL host could not be resolved");
    }

    if (addresses.length === 0) {
      throw new Error("URL host could not be resolved");
    }

    for (const { address } of addresses) {
      assertPublicAddress(address, allowLoopback);
    }
  }

  return parsed;
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    (net.isIP(hostname) !== 0 && isLoopbackAddress(hostname))
  );
}

function assertPublicAddress(address: string, allowLoopback: boolean): void {
  if (allowLoopback && isLoopbackAddress(address)) {
    return;
  }

  if (isPrivateOrReservedAddress(address)) {
    throw new Error("URL may not point to a local or private address");
  }
}

function isLoopbackAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    return address.split(".")[0] === "127";
  }

  if (net.isIPv6(address)) {
    return address.toLowerCase() === "::1";
  }

  return false;
}

function isPrivateOrReservedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const octets = address.split(".").map(Number);
    const a = octets[0] ?? 0;
    const b = octets[1] ?? 0;

    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local
    if (a === 0) return true; // "this network"
    if (a >= 224) return true; // multicast/reserved

    return false;
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();

    if (normalized === "::1") return true; // loopback
    if (normalized === "::") return true; // unspecified
    if (normalized.startsWith("fe80:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded IPv4 too.
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice("::ffff:".length);
      if (net.isIPv4(mapped)) return isPrivateOrReservedAddress(mapped);
    }

    return false;
  }

  // Not a recognizable IP literal — fail closed.
  return true;
}
