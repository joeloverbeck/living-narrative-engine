Operator usage and redundancy review (src/logic/operators)

Scope: focused on clothing-related operators and their references across gameplay data (data/mods), code, and tests using ripgrep sampling on 2024-xx-xx.

Findings
- hasClothingInSlot: Present in three seduction action prerequisites (data/mods/seduction/actions/draw_attention_to_ass.action.json, draw_attention_to_breasts.action.json, grab_crotch_draw_attention.action.json). No other live scopes use it. Semantics overlap with !isSlotExposed when layers include underwear/accessories. Additional references live in prerequisite debugging helpers and tests. Not redundant yet, but usage is sparse; could consolidate into isSlotExposed if we want one slot-coverage API.
- hasClothingInSlotLayer: No active runtime usage; only commented-out legacy lines in data/mods/first-aid/scopes/wounded_*_body_parts.scope and test/doc coverage. Its behavior (slot + specific layer) is now achievable by !isSlotExposed with an explicit layers array. This is the clearest candidate for removal.
- isSlotExposed: Used in two torso-clothing scopes (data/mods/distress/scopes/close_actors_facing_each_other_with_torso_clothing.scope and data/mods/caressing/scopes/close_actors_facing_each_other_with_torso_clothing.scope). Provides the modern “covered vs exposed by layer set” semantics; not redundant.
- isSocketCovered vs socketExposure: socketExposure is widely used across coverage-related scopes (sex-core, breastplay, dry-intimacy, etc.) and wraps isSocketCovered. isSocketCovered still appears directly in multiple actions (sex-* actions) for single-socket checks and tracing. Keep both; migrate remaining direct calls to socketExposure only if we want consistency, not because the base is redundant.
- isRemovalBlocked: Used in clothing removal rules (data/mods/clothing/rules/handle_remove_clothing.rule.json, handle_remove_others_clothing.rule.json). Unique functionality; not redundant.

Redundancy assessment and suggested deprecations
- Deprecate hasClothingInSlotLayer:
  - Replace test fixtures and any future scopes with !isSlotExposed plus an explicit layers option (e.g., {"!": {"isSlotExposed": ["actor", "torso_upper", {layers: ["base"]}]}}).
  - Remove the operator class, DI registration, whitelist entries, and unit/integration tests.
  - Update docs/examples that still mention it (docs/goap/*, docs/architecture/hardcoded-references-audit.md, debugging guides).
- Consider consolidating hasClothingInSlot into isSlotExposed:
  - Migrate the three seduction actions to !isSlotExposed with includeUnderwear/includeAccessories as needed to match current behavior.
  - Update prerequisiteDebugger messaging and any tests that assert on hasClothingInSlot.
  - After migration, remove the operator file and registration; ensure whitelist and custom-operator registration tests are updated.
  - This reduces slot coverage checks to a single operator family (isSlotExposed) while leaving socket coverage untouched.

Removal checklist (if proceeding)
- Update data scopes/actions to the replacement logic, keeping behavior parity (validate via targeted integration tests, e.g., seduction discovery suites).
- Delete redundant operator implementations and prune registrations in src/logic/jsonLogicCustomOperators.js plus allowed-ops lists.
- Drop operator-specific unit/integration tests or rewrite them to cover the replacement operator options.
- Refresh docs and troubleshooting notes that reference the removed operators.
- Run scoped test suites (--runInBand recommended): unit operator tests, jsonLogic operator registration tests, seduction/torso clothing scope integration tests.
