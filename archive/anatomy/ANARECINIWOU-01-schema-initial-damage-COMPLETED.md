# Summary
Define an optional `initialDamage` section on anatomy recipes (per-slot seeded wounds) in the JSON schema so authors can declare starting damage using positive amounts. Align schema/tests with the anatomy seeded-wounds spec in `specs/anatomy-recipe-initial-wounds.md`.

# Status
Completed

# Current state check
- `data/schemas/anatomy.recipe.schema.json` has `additionalProperties: false` at the root and no `initialDamage` property, so recipes with seeded wounds are currently rejected outright.
- `data/schemas/damage-capability-entry.schema.json` models entries as `{ name, amount, penetration?, bleed?, fracture?, burn?, poison?, dismember?, flags? }` with `amount` `minimum: 0` and **no** `metadata`/`damage_tags`/`damage_multiplier` fields referenced in the spec. We need per-slot damage entries with `amount > 0` without expanding this shared schema globally.
- `tests/unit/schemas/anatomy.recipe.schema.test.js` has no coverage for `initialDamage` or seeded-wound shapes.

# Updated scope
- Extend `anatomy.recipe.schema.json` with optional `initialDamage`: an object keyed by slot ids. Each slot value either:
  - `{ "damage_entries": [<damage capability entry>] }` with at least one entry and `amount` enforced as `> 0` via an override, or
  - shorthand `{ "amount": number > 0, "name"?: string, "damage_type"?: string }` to mirror legacy damage type naming (one of `name` or `damage_type` required). Forbid extra properties in both shapes.
- Keep all existing recipe fields/validation untouched; schema still cannot validate slot keys against blueprints or pattern expansion—that remains runtime-only.
- Add unit schema tests covering valid/invalid `initialDamage` payloads and amount positivity. No runtime damage application changes.

# File list (expected to touch)
- data/schemas/anatomy.recipe.schema.json
- tests/unit/schemas/anatomy.recipe.schema.test.js

# Out of scope
- Runtime damage resolution, anatomy generation, or description changes.
- Modifying recipe/gameplay data beyond schema fixtures inside tests.

# Acceptance criteria
- `initialDamage` validates per the shapes above; non-positive amounts and unknown properties are rejected.
- `tests/unit/schemas/anatomy.recipe.schema.test.js` includes coverage for allowed and disallowed `initialDamage` shapes (including shorthand) and passes.
- Recipes without `initialDamage` continue to validate as before.

# Outcome
- Added `initialDamage` to the anatomy recipe schema with per-slot seeded damage (explicit entries or shorthand) enforcing positive amounts and rejecting extra properties.
- Introduced unit schema coverage for valid/invalid `initialDamage` payloads.
- Left runtime damage application untouched and did not broaden `damage-capability-entry` fields beyond current shape.
