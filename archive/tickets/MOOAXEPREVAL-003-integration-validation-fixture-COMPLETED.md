# MOOAXEPREVAL-003: Integration Validation Coverage for Fractional Mood Axes

## Summary

Add integration coverage to ensure `npm run validate` reports fractional mood axis thresholds in expression prerequisites via the mod validation report.

## Background

Unit tests cover validator behavior, but the validation pipeline must also surface these issues when running the CLI validation flow against mod content.

## Assumptions Check

- `ModValidationOrchestrator` integration tests currently build temp mods in the test itself and use a mocked manifest loader.
- The mocked loader does not read `mod-manifest.json`, so any integration fixture must inject `content.expressions` via the mock.
- There is no existing `tests/fixtures/mods` directory to host a mod fixture.

## File List (Expected to Touch)

### Existing Files
- `tests/integration/validation/modValidationOrchestrator.integration.test.js`

## Out of Scope (MUST NOT Change)

- Production mod data under `data/mods/`
- Validator implementation in `src/validation/`
- Unit tests unrelated to mod validation orchestration

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:integration -- --runInBand --testPathPattern="modValidationOrchestrator.integration.test.js"`

### Invariants That Must Remain True

1. The integration test uses local fixtures only and does not require network access.
2. The validation report includes an `expression_prerequisite` issue for the fractional mood axis threshold fixture.
3. Existing integration tests for ModValidationOrchestrator continue to pass without modifying their fixtures.

## Scope Update

- Implement the integration coverage by adding a new test case that writes a temporary expression file and injects a manifest with `content.expressions` through the mocked loader.
- No new static fixture files will be added unless the test harness requires them.

## Status

Completed.

## Outcome

- Added an integration test that builds a temporary mod with a fractional `moodAxes` prerequisite and asserts the expression prerequisite violation is surfaced by the validation report.
- No standalone fixture files were added; the test writes the expression file at runtime and injects the manifest content via the mocked manifest loader.
