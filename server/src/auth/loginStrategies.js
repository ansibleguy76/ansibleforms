// The SSO login strategies (Entra ID, OIDC) rebuilt from what is configured now : a provider
// saved, a database restored, a provider switched on or off or the Entra ID authority
// changed. Each strategy is built once, so the login page offering a provider is not enough -
// without a rebuild its button leads to "Unknown authentication strategy".
import { runsWeb } from "../lib/role.js";

/**
 * Rebuilds the Entra ID and the OIDC strategies, on a process that serves the web app.
 */
export async function rebuildLoginStrategies() {
  // a worker serves no login : it never loads the strategies
  if (!runsWeb) return;
  // imported here : the strategies and their models stay out of the modules importing this
  const { default: authEntraId } = await import("./auth_entraid.js");
  const { default: authOidc } = await import("./auth_oidc.js");
  await authEntraId.initialize();
  await authOidc.initialize();
}
