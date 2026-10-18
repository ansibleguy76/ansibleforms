/******************************************************************/
/*                                                                */
/*  How the API shows a stored secret : a password, a token, a    */
/*  client secret or key never leaves in clear, it is sent as the */
/*  mask. A form sends the mask back unchanged when the secret    */
/*  was not retyped : on a write, any run of asterisks of the     */
/*  mask's length or longer means "keep the stored one". Older    */
/*  clients, and the runners, still use eight asterisks : both    */
/*  are read as the mask.                                         */
/*                                                                */
/******************************************************************/

// the mask a secret is shown as
export const SECRET_MASK = "**********";

/**
 * Whether a value sent is the mask : a run of 8 or more asterisks ('**********', or the
 * '********' the runners and older clients send).
 *
 * Args:
 *   value (any): the value sent.
 *
 * Returns:
 *   boolean: true when it is the mask, so the stored secret stays.
 */
export function isMasked(value) {
  return typeof value === "string" && /^\*{8,}$/.test(value);
}

/**
 * A secret as the API shows it : the mask when there is one, else what it is (empty or none).
 *
 * Args:
 *   value (any): the stored secret.
 *
 * Returns:
 *   any: the mask, or the value when it is empty.
 */
export function masked(value) {
  return value ? SECRET_MASK : value;
}

export default { SECRET_MASK, isMasked, masked };
