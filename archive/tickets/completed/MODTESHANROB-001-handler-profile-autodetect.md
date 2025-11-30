# MODTESHANROB-001 Handler profile autodetect for ModTestHandlerFactory
Status: Completed
## Reality check / corrected assumptions
- `ModTestHandlerFactory.getHandlerFactoryForCategory` is still a hardcoded switch that defaults to `createStandardHandlers`; no scanning of mod data happens today.
- `ModTestFixture` passes the mod id as the category into the factory and already has all rule definitions loaded before handler creation, but those rules are not consulted when choosing handlers.
- Unit/integration tests currently assert the manual mappings (unknown → standard, positioning → perception logging) rather than any auto-detected profile; no test exercises a new mod category with component mutations beyond the hand-written map.
- Failure mode remains the same as the original bug: a new mod using operations like `ADD_COMPONENT` relies on a manual map entry to avoid `MissingHandlerError`.

## Updated scope
- Add an operation scanner for mod rule files (and referenced macros where available) that derives the handler capabilities needed by a mod id.
- Use the scan to assemble a handler profile: default to a perception-logging/component superset, augment with item and mouth-engagement handlers when their operations are referenced, and keep the public factory API synchronous/stable.
- Keep manual mappings only as a fallback; unknown categories with mutation operations should pick up the superset automatically.
- Update the factory/unit tests to assert the new autodetection defaults (unknown/new category gets mutation+perception support; item-heavy mods pull item handlers) while preserving existing public method signatures.

## File list to touch
- tests/common/mods/ModTestHandlerFactory.js
- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js
- tests/integration/infrastructure/modTestHandlerFactory.validation.test.js (align expectations)
- tests/common/mods/ModTestFixture.js (only if fixture wiring needs minor adjustments for the new profile builder)

## Out of scope
- Changing production interpreter APIs or public `ModTestFixture` / `ModTestHandlerFactory` method signatures.
- Editing canonical mod data under `data/mods/**`; only read/scan.
- Altering schema files or introducing new manifest fields for mod authors.

## Acceptance criteria
- Tests: `npm run test:unit -- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js` reflects the auto-detection behavior and passes; `npm run test:integration -- tests/integration/mods/distress/throw_self_to_ground.test.js` (or equivalent distress flow) continues to pass without a hand-maintained category map entry.
- Invariants: handler selection is deterministic for identical mod datasets; registry state remains isolated per fixture; APIs `ModTestFixture.forAction` and `ModTestHandlerFactory.getHandlerFactoryForCategory` stay stable.

## Outcome
- Implemented filesystem-backed operation scanning (rules + macros) to derive handler needs, defaulting to perception-logging/component superset with optional item and mouth augments; manual map remains only as a fallback.
- Updated unit/integration tests to assert autodetected coverage (including unknown-category superset behavior) and ran targeted suites with coverage disabled for subset runs.
