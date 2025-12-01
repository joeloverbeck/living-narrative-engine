# Goal
Integrate the visibility helper into anatomy description generation so hidden parts are skipped without breaking formatting.

# File list
- `src/anatomy/bodyDescriptionComposer.js` (apply visibility filtering before emitting part descriptions)
- `src/anatomy/BodyPartDescriptionBuilder.js` or related generator modules (ensure they accept visibility decisions without side effects)
- `tests/` (integration tests for composer output covering pants-hidden genitalia, underwear-visible genitalia, and futanari secrecy)

# Out of scope
- Adjusting equipment/activity section formatting or prefixes
- Altering `data/mods/anatomy/anatomy-formatting/default.json` ordering
- Broad refactors of anatomy composition beyond visibility gating

# Acceptance criteria
- Tests
  - Integration tests demonstrate: genital lines omitted when `torso_lower` has blocking layers; genital lines appear with underwear-only; futanari actor hidden by blocking layers and revealed when removed
  - No blank lines or malformed grouping when parts are skipped; existing sections (including `Wearing:`/`Activity:`) remain in place
- Invariants
  - Non-genital parts without visibility rules are still described
  - Equipment/activity rendering remains unchanged from current behavior
