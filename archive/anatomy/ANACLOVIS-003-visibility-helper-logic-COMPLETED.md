# Goal
Validate and harden the existing clothing visibility gating in `BodyDescriptionComposer` so it matches `specs/anatomy-clothing-visibility.md`. The helper already lives inside the composer (`#isPartVisible`/`#filterVisibleParts`); this task is about aligning its documented assumptions and ensuring the unit coverage matches the spec.

# Current findings
- The visibility logic is already implemented inside `src/anatomy/bodyDescriptionComposer.js` and is invoked during part filtering; no standalone helper module is missing.
- A unit suite exists (`tests/unit/anatomy/bodyDescriptionComposer.visibilityRules.test.js`) but only covers blocking-layer, non-blocking-layer, and secondary-coverage cases. It does not exercise empty slots, mixed layers, or missing metadata defaults required by the spec.

# Updated scope
- Keep the existing in-composer helper; do not introduce a new module unless a bug is uncovered.
- Add/adjust tests so the helper behaviors match `specs/anatomy-clothing-visibility.md` (empty slot visible, blocking base hides, underwear-only visible, mixed layers hides, secondary coverage hides, missing metadata/joint defaults to visible).
- Make minimal code tweaks only if a gap is exposed while adding tests.

# File list
- `src/anatomy/bodyDescriptionComposer.js` (only if a functional gap is found while testing)
- `tests/unit/anatomy/bodyDescriptionComposer.visibilityRules.test.js` (expand coverage to the spec scenarios)

# Out of scope
- Changing description ordering or grouping behavior
- Modifying equipment/activity formatting
- Adding or editing anatomy entity data

# Acceptance criteria
- Tests
  - Unit coverage for the helper includes: empty slot visible, blocking base layer hides, underwear-only visible, mixed layers hides, secondary coverage hides, missing slot metadata or missing joint defaults to visible.
- Invariants
  - Parts without the visibility component default to visible.
  - Helper does not throw when joint or slot metadata is absent; current behavior stays intact otherwise.

# Status
Completed.

# Outcome
- Confirmed the visibility helper already lives inside `BodyDescriptionComposer`; no new module was added.
- Expanded `tests/unit/anatomy/bodyDescriptionComposer.visibilityRules.test.js` to cover all spec scenarios, including empty slot, mixed layers, missing metadata/joint, and missing visibility component defaults.
