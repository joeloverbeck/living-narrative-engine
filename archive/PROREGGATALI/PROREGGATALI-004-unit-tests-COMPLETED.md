# PROREGGATALI-004: Unit Tests for PrototypeGateAlignmentAnalyzer

## Summary

Create comprehensive unit tests for the `PrototypeGateAlignmentAnalyzer` service, covering contradiction detection, distance calculation, severity assignment, and edge cases.

## Background

The spec defines specific test cases that must pass. This ticket implements unit tests following established patterns in the codebase (Jest, mock dependencies, test structure).

## File List (Expected to Touch)

### New Files
- `tests/unit/expressionDiagnostics/services/prototypeGateAlignmentAnalyzer.test.js`

### Existing Files (Read-Only Reference)
- `tests/unit/expressionDiagnostics/services/prototypeConstraintAnalyzer.test.js` — reference pattern
- `tests/unit/expressionDiagnostics/models/AxisInterval.test.js` — reference for interval testing
- `tests/unit/expressionDiagnostics/models/GateConstraint.test.js` — reference for gate testing

## Out of Scope (MUST NOT Change)

- The analyzer implementation (`PrototypeGateAlignmentAnalyzer.js`)
- Any other test files
- Any production source code
- Integration tests (handled in PROREGGATALI-005)
- Any mod data under `data/mods/`

## Implementation Details

### Test File Structure

```javascript
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import PrototypeGateAlignmentAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js';

describe('PrototypeGateAlignmentAnalyzer', () => {
  let analyzer;
  let mockDataRegistry;
  let mockLogger;

  // Test prototype data
  const testPrototypes = {
    quiet_absorption: {
      weights: { valence: 0.2, arousal: -0.3, agency_control: -0.5 },
      gates: ['agency_control <= 0.10', 'threat <= 0.35'],
    },
    anger: {
      weights: { valence: -0.8, arousal: 0.8 },
      gates: ['valence <= -0.15', 'arousal >= 0.10'],
    },
    joy: {
      weights: { valence: 1.0, arousal: 0.5 },
      gates: ['valence >= 0.35'],
    },
  };

  beforeEach(() => { ... });
  afterEach(() => { ... });

  describe('constructor', () => { ... });
  describe('analyze', () => { ... });
});
```

### Required Test Cases (from Spec)

| Test Case | Input | Expected |
|-----------|-------|----------|
| Detect contradiction | Regime: `agency_control >= 0.15`, Gate: `agency_control <= 0.10` | 1 contradiction, distance 0.05, severity critical |
| No contradiction when overlapping | Regime: `threat <= 0.20`, Gate: `threat <= 0.35` | No contradiction |
| Strict inequality edge | Regime: `arousal >= 0.10`, Gate: `arousal < 0.10` | Contradiction (empty intersection) |
| Unbounded regime axis | Regime: no constraint on valence, Gate: `valence >= 0.15` | No contradiction |
| Multiple gates per prototype | Gates: `[threat <= 0.20, valence >= 0.30]` | Check each gate independently |
| Empty prerequisites | `[]` | Empty result |
| No emotion conditions | Valid prerequisites but no emotion thresholds | Empty result |

### Additional Test Cases

| Test Case | Input | Expected |
|-----------|-------|----------|
| Info severity for non-threshold emotion | Emotion with `threshold: 0` | `severity: 'info'` |
| Critical severity for threshold emotion | Emotion with `threshold: 0.55` | `severity: 'critical'` |
| Distance calculation gap above | Regime: `[0.15, 1]`, Gate: `[-1, 0.10]` | `distance: 0.05` |
| Distance calculation gap below | Regime: `[-1, -0.20]`, Gate: `[0.10, 1]` | `distance: 0.30` |
| Missing prototype graceful handling | Unknown prototype ID | Logs warning, returns no contradiction |
| Multiple emotions analyzed | 3 emotion conditions | All analyzed, results aggregated |
| hasIssues true when critical | Any critical contradiction | `hasIssues: true` |
| hasIssues false when empty | No contradictions | `hasIssues: false` |
| Sexual axis uses [0,1] default | Gate on sexual axis | Uses correct default bounds |

### Test Describe Blocks

```javascript
describe('constructor', () => {
  it('should create instance with valid dependencies');
  it('should throw when dataRegistry is missing required methods');
  it('should throw when logger is missing required methods');
});

describe('analyze', () => {
  describe('contradiction detection', () => {
    it('should detect contradiction when regime.min > gate.max');
    it('should detect contradiction when gate.min > regime.max');
    it('should detect contradiction with strict inequality edge case');
    it('should NOT detect contradiction when intervals overlap');
    it('should NOT detect contradiction when regime axis is unbounded');
  });

  describe('distance calculation', () => {
    it('should calculate correct distance when regime above gate');
    it('should calculate correct distance when gate above regime');
    it('should return 0 distance when intervals overlap');
  });

  describe('severity assignment', () => {
    it('should assign critical severity when threshold > 0');
    it('should assign info severity when threshold is 0');
  });

  describe('edge cases', () => {
    it('should return empty result for empty prerequisites');
    it('should return empty result for empty emotion conditions');
    it('should handle missing prototype gracefully');
    it('should handle prototype without gates array');
    it('should analyze multiple gates per prototype independently');
    it('should aggregate results from multiple emotions');
  });

  describe('result structure', () => {
    it('should return correct shape: contradictions, tightPassages, hasIssues');
    it('should set hasIssues true when any critical contradiction exists');
    it('should set hasIssues false when no contradictions');
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. All tests pass: `npm run test:unit -- --runInBand --testPathPatterns="prototypeGateAlignmentAnalyzer" --coverage=false`
2. Coverage meets threshold: `npm run test:unit -- --runInBand --testPathPatterns="prototypeGateAlignmentAnalyzer" --collectCoverageFrom="src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js"`
   - Branch coverage ≥ 80%
   - Function coverage ≥ 90%
   - Line coverage ≥ 90%
3. ESLint: `npx eslint tests/unit/expressionDiagnostics/services/prototypeGateAlignmentAnalyzer.test.js`

### Invariants That Must Remain True

1. Test file follows established patterns from `prototypeConstraintAnalyzer.test.js`
2. Mock setup creates isolated test environment
3. Each test case is independent (no shared mutable state)
4. Test descriptions are clear and match expected behavior
5. No real data registry calls (all mocked)
6. All spec test cases (T1-T7 equivalent) are covered
7. Edge cases handle null/undefined inputs gracefully

## Dependencies

- **Requires**: PROREGGATALI-001 (analyzer implementation must exist to test)

## Estimated Size

~200-300 lines of test code (moderate test file).
