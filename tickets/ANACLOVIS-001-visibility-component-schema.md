# Goal
Introduce a new anatomy visibility rules component and validate it through schemas so clothing-based hiding can be data-driven.

# File list
- `data/mods/anatomy/components/anatomy-visibility-rules.component.json` (new component definition with fields `clothingSlotId`, `nonBlockingLayers`, optional `notes`/`reason`)
- `data/mods/anatomy/components/schema/*.json` (component schema updates to register and validate the new component)
- `tests/**/*` (any schema/validator fixtures needed to cover the new component)

# Out of scope
- Changing existing anatomy entity definitions to reference the new component
- Modifying runtime visibility logic or description generation
- Renaming or restructuring existing clothing slot metadata or equipment schemas

# Acceptance criteria
- Tests
  - `npm run validate:ecosystem` passes
  - Any new/updated schema tests covering the component fields pass (document the exact test command if not covered by `validate:ecosystem`)
- Invariants
  - Existing component schemas continue to validate unchanged payloads
  - No changes to runtime code paths; only schema/component definition additions
