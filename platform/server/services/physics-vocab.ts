/**
 * Shared physique vocabulary for the physics-engine — one definition, used by the validator
 * (L03), the importer (parseBuildSpec) and the emitter (build injection) so they never diverge.
 */

/**
 * Signals that a character is BUILD-SENSITIVE (the model will beautify/slim them, B2) — used only
 * as a FALLBACK when an element doesn't declare `build.unflattering` explicitly. Deliberately
 * conservative: only unambiguous overweight terms (not "broad"/"bulky"/"stocky", which can be
 * athletic), and negation-guarded so "not overweight" / "not bulky" don't trip it.
 */
export const UNFLATTERING_RE =
  /(?<!not )(?<!never )\b(overweight|out of shape|out-of-shape|obese|paunch\w*|pot-?belly|soft belly|sagging belly|flabby|doughy|heavyset|portly|rotund|corpulent)\b/i;

/** Any physique descriptor — used to detect whether a prompt asserts the build AT ALL (presence). */
export const BUILD_TOKEN =
  /\b(overweight|heavyset|bulky|stocky|portly|rotund|doughy|paunch\w*|belly|heavy|thick|soft|fat|sagging|broad|round|barrel|slump\w*|out of shape|out-of-shape)\b/i;

/** Default beautification terms to forbid for an unflattering build (weak negative + lint). */
export const DEFAULT_FORBIDDEN = ["lean", "fit", "slim", "slimmed", "athletic", "toned", "muscular"];
