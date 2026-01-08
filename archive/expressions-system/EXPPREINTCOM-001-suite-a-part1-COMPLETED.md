# EXPPREINTCOM-001: Complex expression prereq integration tests (Suite A1-A3)

Build the base integration test harness and cover the first three complex emotion prerequisite cases that rely on previous-state deltas and nested JSON logic.

## Background (Reassessed)
- IntegrationTestBed registers a mocked IEmotionCalculatorService by default, so tests must override it with a real EmotionCalculatorService instance before building contexts.
- ExpressionContextBuilder consumes previousState as `{ emotions, sexualStates, moodAxes }` and exposes it on the context as `previousEmotions`, `previousSexualStates`, and `previousMoodAxes`.
- ExpressionRegistry caches on first access, so each test should load the target expression before any evaluation call to avoid stale registry contents.
- The container resolves JsonLogicCustomOperators (via LightingStateService) during expression evaluator setup, so the entity manager stub must provide `getEntitiesInLocation`.

# File list
- tests/integration/expressions/expressionPrerequisites.complex.integration.test.js

## Out of scope
- Changing any expression JSON definitions under data/mods/emotions/expressions/
- Modifying expression evaluation logic or core emotion/sexual calculation services
- UI simulator changes or fixture updates outside the new integration test file

## Specific tests that must pass
- npm run test:integration -- --runInBand tests/integration/expressions/expressionPrerequisites.complex.integration.test.js

## Invariants that must remain true
- Lookups are loaded from data/mods/core/lookups/emotion_prototypes.lookup.json and data/mods/core/lookups/sexual_prototypes.lookup.json via the data registry
- Expression evaluation uses ExpressionContextBuilder + EmotionCalculatorService with raw mood axis inputs (no stubs)
- Tests assert both prerequisite numeric checks and that expressionEvaluatorService.evaluateAll(context) includes the target id

### Scope details
- Create IntegrationTestBed-backed setup in the new test file.
- Override tokens.IEmotionCalculatorService with a real EmotionCalculatorService instance.
- Load only the target expression JSON per test into the registry to avoid evaluation collisions.
- Add tests for:
  - emotions-positive-affect:awed_transfixion (A1)
  - emotions:horror_revulsion (A2)
  - emotions:steeled_courage (A3)
- Each test should build previous/current contexts and pass previousState values from the previous context.

## Status

Completed.

## Outcome

- Added Suite A1-A3 integration coverage using IntegrationTestBed, real EmotionCalculatorService, and per-test expression loading as planned.
- Adjusted the harness assumptions to include the entityManager `getEntitiesInLocation` stub requirement discovered during container setup.
