# MULHITSIMROB-003: Add CI Coverage Threshold for MultiHitSimulator

## Summary

Add a file-specific coverage threshold for `MultiHitSimulator.js` to prevent coverage regression below 100%.

## Status

- [x] Completed

## Background

The `MultiHitSimulator` unit tests achieved 100% coverage after significant effort. This ticket adds a CI safeguard to ensure coverage never drops below 100% when changes are made.

**Reference**: `specs/multi-hit-simulator-robustness.md` lines 364-369

## Assumptions (Reassessed)

- `jest.config.unit.js` currently disables all coverage thresholds for targeted runs (single-file, pattern, or CSS-only runs).
- File-specific thresholds only apply when coverage thresholds are enabled (full unit runs), unless `--coverageThreshold` is passed explicitly on the CLI.

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `jest.config.unit.js` | MODIFY | Add file-specific coverage threshold |

## Out of Scope

- NOT modifying source code files
- NOT modifying test files
- NOT modifying CI workflow files (`.github/workflows/`)
- NOT changing global coverage thresholds
- NOT adding new npm scripts

## Implementation Details

### Current Configuration (jest.config.unit.js lines 42-50)

```javascript
coverageThreshold: {
  global: {
    branches: 92,
    functions: 97,
    lines: 98,
    statements: 97,
  },
},
```

### Target Configuration

```javascript
coverageThreshold: {
  global: {
    branches: 92,
    functions: 97,
    lines: 98,
    statements: 97,
  },
  // File-specific threshold for MultiHitSimulator
  './src/domUI/damage-simulator/MultiHitSimulator.js': {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
  },
},
```

### Jest Coverage Threshold Behavior

- File-specific thresholds are checked when that file is in the coverage report
- If `MultiHitSimulator.js` drops below 100% on any metric, the test run fails
- This only applies when coverage is collected (not with `--no-coverage`)
- Targeted test runs (`--testPathPattern`, single files) skip all thresholds due to `jest.config.unit.js` gating unless `--coverageThreshold` is provided

## Acceptance Criteria

### Tests That Must Pass

- [ ] `npm run test:unit` passes with current 100% coverage
- [ ] Artificially reducing coverage (e.g., commenting out a test) causes CI to fail
- [ ] Other test files are not affected by this threshold
- [ ] Targeted runs with `--no-coverage` still work
- [ ] Targeted runs without CLI overrides still skip coverage thresholds

### Invariants That Must Remain True

- Global coverage thresholds remain at current levels (92/97/98/97)
- No other files get file-specific thresholds from this change
- Test execution time is not significantly impacted

### Verification Test

```bash
# This should pass (current state)
npm run test:unit

# This command should fail if coverage drops (because of CLI threshold override)
# (Test by temporarily commenting out a test case)
npm run test:unit -- --testPathPattern="MultiHitSimulator" --coverage
  --coverageThreshold='{"global":{"statements":100,"branches":100,"functions":100,"lines":100}}'
```

## Implementation Notes

1. The file path in `coverageThreshold` must match Jest's coverage report path format
2. Use forward slashes even on Windows
3. Path is relative to project root
4. Consider using glob pattern if TargetSelector is extracted later: `'./src/domUI/damage-simulator/*.js'`

## Verification Commands

```bash
# Verify configuration is valid
npm run test:unit -- --coverage --collectCoverageFrom='src/domUI/damage-simulator/MultiHitSimulator.js' --verbose

# Full unit test run with coverage
npm run test:unit

# Verify threshold is enforced (after change)
# Temporarily comment out a test in MultiHitSimulator.test.js and run:
npm run test:unit
# Expected: FAIL due to coverage threshold
# Remember to undo the test comment!
```

## Dependencies

- **Blocks**: None (but should be done after MULHITSIMROB-001 and MULHITSIMROB-002)
- **Blocked by**: None
- **Related**: MULHITSIMROB-001 (property tests), MULHITSIMROB-002 (integration tests)

## Estimated Effort

Trivial - single configuration change to `jest.config.unit.js`.

## Reference Files

- Config: `jest.config.unit.js`
- Jest docs: https://jestjs.io/docs/configuration#coveragethreshold-object

## Outcome

Added a file-specific 100% coverage threshold for `MultiHitSimulator.js` in `jest.config.unit.js`, plus updated ticket assumptions to reflect current targeted-run gating; no source or test files changed.
