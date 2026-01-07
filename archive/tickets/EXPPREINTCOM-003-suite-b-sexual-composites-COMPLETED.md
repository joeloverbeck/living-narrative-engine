# EXPPREINTCOM-003: Complex expression prereq integration tests (Suite B1 sexual composites)

Add the sexual-state composite prerequisite coverage to ensure expression evaluation uses real sexual state calculations alongside emotions.

## Status
Completed

# File list
- tests/integration/expressions/expressionPrerequisites.complex.integration.test.js

## Out of scope
- Changes to sexual state prototype data or expression definition JSON
- Modifications to ExpressionContextBuilder or EmotionCalculatorService implementation
- Any UI or simulator updates

## Specific tests that must pass
- npm run test:integration -- --runInBand tests/integration/expressions/expressionPrerequisites.complex.integration.test.js

## Invariants that must remain true
- Sexual lookups are loaded into the data registry before the expression registry is resolved
- Sexual state calculations use raw sexual axis inputs in [0..100] integers (no normalized inputs, stubs, or hardcoded values)
- Tests assert sexual state prerequisite values before asserting expression matches

### Scope details
- Add Suite B test for emotions:aroused_but_ashamed_conflict (B1).
- Assert context.sexualArousal and context.sexualStates.* computed values plus the evaluator match.
- Provide sexual state component data via `sex_excitation`, `sex_inhibition`, and `baseline_libido` fields.
- Use a slightly negative valence (e.g., -10) and higher engagement (e.g., 90) to avoid a borderline `aroused_with_shame` value of 0.649999... failing the strict >= 0.65 gate.

## Outcome
- Added Suite B1 integration coverage for sexual composites, including computed sexual arousal/state assertions.
- Adjusted the B1 mood inputs (valence, engagement) to avoid floating-point edge cases that would have failed strict gates.
