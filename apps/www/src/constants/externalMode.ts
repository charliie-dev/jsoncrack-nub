/**
 * Whether the upstream-hosted promo surfaces are shown: the external-mode dialog, the
 * "Upgrade to Pro Editor" toolbar link, and the "Choose your editor" onboarding modal.
 *
 * Single source of truth on purpose. The three call sites previously tested
 * `NEXT_PUBLIC_DISABLE_EXTERNAL_MODE` with two opposite conventions — `=== "false"` in
 * one and `!== "true"` in the other two — so deleting the line, or writing `0`, `no` or
 * an empty value, left the dialog suppressed while switching the upsell and the
 * onboarding modal *on*. A self-hosted instance would start pointing its users at a paid
 * third-party product with no dialog to explain why.
 *
 * Fail closed: promos appear only when the flag explicitly says the feature is not
 * disabled. Anything else, including unset, keeps them off.
 */
const NOT_DISABLED = ["false", "0", "no", "off"];

export const PROMO_SURFACES_ENABLED = NOT_DISABLED.includes(
  (process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_MODE ?? "").trim().toLowerCase()
);
