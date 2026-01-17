# PROREGGATALI-005: Integration Tests for Prototype Gate Alignment Report

## Summary

Create integration tests that verify the Monte Carlo report pipeline with the Prototype Gate Alignment analyzer: prerequisites parsing → analyzer execution → report section generation. Tests use realistic expression prerequisites and the core emotion prototype lookup data to verify report output.

## Background

Unit tests (PROREGGATALI-004) verify the analyzer in isolation. Integration tests verify:
1. Analyzer integrates with `MonteCarloReportGenerator`
2. Prerequisite parsing feeds the analyzer correctly
3. Report section appears when contradictions exist
4. Report section omitted when no contradictions

## File List (Expected to Touch)

### New Files
- `tests/integration/expression-diagnostics/prototypeGateAlignmentReport.integration.test.js`

### Existing Files (Read-Only Reference)
- `tests/integration/expression-diagnostics/prototypeReachability.integration.test.js` — reference pattern for InMemoryDataRegistry + report generator
- `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js` — report generator setup patterns

## Out of Scope (MUST NOT Change)

- The analyzer implementation (`PrototypeGateAlignmentAnalyzer.js`)
- The report generator implementation (`MonteCarloReportGenerator.js`)
- DI registration files
- Unit tests
- Any production source code outside test scope
- Any mod data under `data/mods/`

## Implementation Details

### Test Setup

Integration tests should:
1. Create a report generator with a real `PrototypeGateAlignmentAnalyzer`
2. Load `core:emotion_prototypes` into an `InMemoryDataRegistry` (uses `getLookupData`)
3. Use JSON-Logic prerequisites with `emotions.*` conditions so `ReportDataExtractor` can find them
4. Verify report markdown output contains expected sections

### Test Cases (from Spec)

| Test Case | Setup | Expected |
|-----------|-------|----------|
| Full pipeline with conflicting expression | Regime: `agency_control >= 0.30`, emotion requires `quiet_absorption >= 0.55`, prototype gate: `agency_control <= 0.25` | Report contains "Prototype Gate Alignment" section with contradiction |
| Report section appears when contradictions exist | Any expression with detectable contradiction | Section header "## Prototype Gate Alignment" present |
| Report section omitted when no contradictions | Expression with compatible regime/gates | Section header NOT present |
| Severity badge in output | Any contradiction | Report contains "**CONTRADICTION**" badge |

### Test File Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import required services for integration
import PrototypeGateAlignmentAnalyzer from '../../../src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
// ... other required imports

describe('Prototype Gate Alignment Report Integration', () => {
  let reportGenerator;
  let analyzer;
  let mockDataRegistry;
  let mockLogger;

  const testPrototypes = {
    quiet_absorption: {
      weights: { valence: 0.2, arousal: -0.3, agency_control: -0.5 },
      gates: ['agency_control <= 0.10', 'threat <= 0.35'],
    },
    // ... more prototypes
  };

  beforeEach(() => {
    // Setup mock data registry
    mockDataRegistry = {
      get: jest.fn(),
      getLookupData: jest.fn((key) => {
        if (key === 'core:emotion_prototypes') {
          return { entries: testPrototypes };
        }
        return null;
      }),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

  // Create analyzer (uses dataRegistry.getLookupData)
  analyzer = new PrototypeGateAlignmentAnalyzer({
    dataRegistry: mockDataRegistry,
    logger: mockLogger,
  });

  // Create report generator with analyzer injected
  reportGenerator = new MonteCarloReportGenerator({
    logger: mockLogger,
    prototypeGateAlignmentAnalyzer: analyzer,
  });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('report generation with contradictions', () => { ... });
  describe('report generation without contradictions', () => { ... });
  describe('severity display', () => { ... });
});
```

### Key Integration Scenarios

#### Scenario 1: Conflicting Expression

```javascript
it('should include Prototype Gate Alignment section when contradictions exist', () => {
  const prerequisites = [
    { and: [
      { '>=': [{ var: 'mood.agency_control' }, 0.30] },
      { '>=': [{ var: 'emotions.quiet_absorption' }, 0.55] },
    ]}
  ];

  const simulatorResult = {
    // Minimal simulator result structure
    triggerRate: 0.0,
    prerequisites,
    // ... other required fields
  };

  const report = reportGenerator.generate(simulatorResult);

  expect(report).toContain('## Prototype Gate Alignment');
  expect(report).toContain('quiet_absorption');
  expect(report).toContain('agency_control <= 0.25');
  expect(report).toContain('**CONTRADICTION**');
  expect(report).toContain('0.050'); // distance
});
```

#### Scenario 2: Compatible Expression

```javascript
it('should NOT include Prototype Gate Alignment section when no contradictions', () => {
  const prerequisites = [
    { and: [
      { '<=': [{ var: 'mood.threat' }, 0.20] },
      { '>=': [{ var: 'emotions.quiet_absorption' }, 0.30] },
    ]}
  ];

  const simulatorResult = {
    triggerRate: 0.5,
    prerequisites,
    // ... other required fields
  };

  const report = reportGenerator.generate(simulatorResult);

  expect(report).not.toContain('## Prototype Gate Alignment');
});
```

#### Scenario 3: Recommendation Text

```javascript
it('should include actionable recommendations for critical contradictions', () => {
  // Setup with contradiction
  const prerequisites = [...];
  const simulatorResult = { prerequisites, ... };

  const report = reportGenerator.generate(simulatorResult);

  expect(report).toContain('Unreachable emotion under regime');
  expect(report).toContain('Fix: Relax regime on');
});
```

## Acceptance Criteria

### Tests That Must Pass

1. All integration tests pass: `npm run test:integration -- --runInBand --testPathPatterns="prototypeGateAlignmentReport" --coverage=false`
2. ESLint: `npx eslint tests/integration/expression-diagnostics/prototypeGateAlignmentReport.integration.test.js`

### Invariants That Must Remain True

1. Tests verify end-to-end behavior, not internal implementation
2. Report markdown format matches implementation:
   - Section header: `## Prototype Gate Alignment`
   - Table columns: Emotion, Prototype Gate, Regime (axis), Status, Distance
   - Recommendation blockquotes for critical contradictions
3. Tests are independent and idempotent
4. No network access; repository file reads are acceptable for lookup data
5. Data registry uses `core:emotion_prototypes` lookup structure
6. Section position in report remains near prototype/gap sections and before static cross-reference

## Dependencies

- **Requires**: PROREGGATALI-001 (analyzer implementation)
- **Requires**: PROREGGATALI-002 (DI registration for full container test)
- **Requires**: PROREGGATALI-003 (report generator integration)

## Estimated Size

~100-150 lines of test code (focused integration scenarios).

## Status

Completed

## Outcome

Added an integration test covering Prototype Gate Alignment report output using core lookup data and real prerequisite parsing. No production code changes were needed; the section output and recommendations were validated in the report generator flow.
