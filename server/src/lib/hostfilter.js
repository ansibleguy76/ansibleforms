// Host allow/deny filter for outbound HTTP calls (fnRestAdvanced).
//
// Two env vars (comma-separated, hostnames or CIDRs):
//   REST_ALLOWED_HOSTS  — if set, ONLY listed targets are allowed (whitelist).
//   REST_DENIED_HOSTS   — always blocked (blacklist). Wins over allow-list.
//
// Matching:
//   - Hostnames are matched case-insensitively against the URL host.
//   - CIDRs are matched against every IP returned by dns.lookup() for the host.
//   - A bare IP literal in the URL is matched both ways (host equality + CIDR).
//
// If neither env var is set, no restriction is applied.
import dns from "dns";
import { promisify } from "util";
import ip from "./ip.js";
import logger from "./logger.js";

const dnsLookup = promisify(dns.lookup);

function parseList(raw) {
  return (raw || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function classify(entry) {
  if (entry.includes("/")) return { type: "cidr", value: entry };
  if (ip.isV4Format(entry) || ip.isV6Format(entry)) return { type: "ip", value: entry };
  return { type: "host", value: entry.toLowerCase() };
}

function matches(entry, hostname, addresses) {
  const e = classify(entry);
  if (e.type === "host") return hostname.toLowerCase() === e.value;
  if (e.type === "ip")   return addresses.includes(e.value);
  if (e.type === "cidr") {
    try {
      const subnet = ip.cidrSubnet(e.value);
      return addresses.some(a => {
        try { return subnet.contains(a); } catch { return false; }
      });
    } catch (err) {
      logger.warning(`[hostfilter] invalid CIDR in env: ${e.value}: ${err.message}`);
      return false;
    }
  }
  return false;
}

export async function assertUrlAllowed(url) {
  const allowRaw = process.env.REST_ALLOWED_HOSTS;
  const denyRaw  = process.env.REST_DENIED_HOSTS;
  if (!allowRaw && !denyRaw) return; // no policy configured

  let parsed;
  try { parsed = new URL(url); }
  catch { throw new Error(`[hostfilter] invalid URL: ${url}`); }
  const hostname = parsed.hostname;

  // Resolve all addresses for the hostname; if it is already a literal IP
  // dns.lookup just returns it.
  let addresses = [];
  try {
    const all = await dnsLookup(hostname, { all: true });
    addresses = all.map(a => a.address);
  } catch (err) {
    throw new Error(`[hostfilter] cannot resolve ${hostname}: ${err.message}`);
  }

  const denyList  = parseList(denyRaw);
  const allowList = parseList(allowRaw);

  for (const entry of denyList) {
    if (matches(entry, hostname, addresses)) {
      throw new Error(`[hostfilter] destination ${hostname} (${addresses.join(",")}) blocked by REST_DENIED_HOSTS entry "${entry}"`);
    }
  }

  if (allowList.length > 0) {
    const ok = allowList.some(entry => matches(entry, hostname, addresses));
    if (!ok) {
      throw new Error(`[hostfilter] destination ${hostname} (${addresses.join(",")}) is not in REST_ALLOWED_HOSTS`);
    }
  }
}

export default { assertUrlAllowed };
