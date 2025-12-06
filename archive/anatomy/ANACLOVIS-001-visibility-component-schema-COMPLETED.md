# Goal

Define a data-driven anatomy visibility rules component (per `specs/anatomy-clothing-visibility.md`) so clothing-based hiding can be validated by schemas.

# Status

Completed – component added, manifest wired, and schema test added; ecosystem validation still reports pre-existing cross-reference violations (fantasy: 1, locks: 3).

# Reality check / assumptions corrected

- Anatomy components live in `data/mods/anatomy/components/*.component.json` with inline `dataSchema` validated by `component.schema.json`; there is no `components/schema/` directory.
- Components are registered via `data/mods/anatomy/mod-manifest.json` → `content.components`; new definitions must be added there to be loaded/validated.
- No runtime visibility logic or entity wiring exists yet; this ticket only introduces the schema surface and validation coverage.

# Scope

- Add `data/mods/anatomy/components/visibility_rules.component.json` defining fields: `clothingSlotId` (string), `nonBlockingLayers` (string[] enum of clothing layers), optional `notes` / `reason`.
- Register the component in `data/mods/anatomy/mod-manifest.json` so SchemaPhase picks it up.
- Add a focused schema test that covers required fields and rejects invalid layers/omissions.
- Leave existing data/entities/behavior untouched.

# Out of scope

- Changing existing anatomy entity definitions to reference the new component
- Modifying runtime visibility logic or description generation
- Renaming or restructuring existing clothing slot metadata or equipment schemas

# Acceptance criteria

- Tests
  - `npm run validate:ecosystem` (currently fails due to existing fantasy/locks cross-ref issues unrelated to this ticket)
  - `npm run test:unit -- --runTestsByPath tests/unit/mods/anatomy/components/visibility_rules.component.test.js` passes
- Invariants
  - Existing component schemas continue to validate unchanged payloads
  - No changes to runtime code paths; only schema/component definition additions

# Outcome

- Added `data/mods/anatomy/components/visibility_rules.component.json` with clothing slot binding, explicit clothing-layer enum, and optional authoring notes.
- Registered the component in `data/mods/anatomy/mod-manifest.json` and covered it with `tests/unit/mods/anatomy/components/visibility_rules.component.test.js` (passes with `--runInBand`).
- Did not alter entities or runtime logic; `validate:ecosystem` still surfaces the existing fantasy (1) and locks (3) cross-reference violations.
