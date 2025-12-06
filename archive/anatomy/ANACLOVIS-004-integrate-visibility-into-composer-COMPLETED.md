# Goal

Prove and guard the existing clothing visibility integration in `BodyDescriptionComposer` so hidden parts are omitted without disturbing formatting.

# Reality check

- `BodyDescriptionComposer` already filters parts via `anatomy:visibility_rules` + `clothing:slot_metadata`/`clothing:equipment`; no structural change is needed unless tests surface a regression.
- Genital/pubic and torso entities already carry `anatomy:visibility_rules` (runtime `anatomy:joint` components are injected during anatomy generation, not stored in the raw definitions).
- Slot coverage comes from blueprint `clothingSlotMappings` -> `clothing:slot_metadata`; missing metadata intentionally leaves parts visible.

# File list

- `tests/integration/anatomy/` (add composer output coverage for blocked vs underwear-only vs futa scenarios)
- `src/anatomy/bodyDescriptionComposer.js` (only adjust if tests expose a visibility gap)

# Out of scope

- Adjusting equipment/activity section formatting or prefixes
- Altering `data/mods/anatomy/anatomy-formatting/default.json` ordering
- Broad refactors of anatomy composition beyond visibility gating

# Acceptance criteria

- Integration tests show: genital/pubic lines omitted when `torso_lower` has blocking layers; the same lines appear with underwear-only; futanari anatomy is hidden under blocking layers and revealed when the blocking layer is removed.
- No blank lines or malformed grouping when parts are skipped; existing sections (including `Wearing:`/`Activity:`) remain in place.
- Non-genital parts without visibility rules are still described; equipment/activity rendering remains unchanged from current behavior.

# Status

Completed.

# Outcome

- Confirmed `BodyDescriptionComposer` already applies `anatomy:visibility_rules` with clothing metadata; no composer logic changes were required.
- Added integration coverage that exercises blocking base/outer layers, underwear-only visibility, and futanari reveal to guard formatting and visibility behavior.
