# AXIGAPDETSPE-002: Add IAxisGapAnalyzer DI Token

## Description

Add the `IAxisGapAnalyzer` token to the diagnostics tokens file. This token will be used for dependency injection of the `AxisGapAnalyzer` service referenced in `specs/axis-gap-detection-spec.md`.

### Assumptions Reassessed

- The spec claims `IAxisGapAnalyzer` already exists at line 48; current `src/dependencyInjection/tokens/tokens-diagnostics.js` has no `IAxisGapAnalyzer` entry anywhere. The token must be added.
- The line reference in the spec does not match the current file layout; placement should follow the existing V3 Services grouping rather than a fixed line number.
- Existing unit coverage for diagnostics tokens lives in `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js`; add a targeted assertion there instead of introducing a new test file.

## Files to Modify

- `src/dependencyInjection/tokens/tokens-diagnostics.js`
  - Add `IAxisGapAnalyzer` token to the V3 Services section
- `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js`
  - Add assertion for `diagnosticsTokens.IAxisGapAnalyzer`

## Out of Scope

- Creating the AxisGapAnalyzer service (AXIGAPDETSPE-003)
- Registering the service in DI container (AXIGAPDETSPE-009)
- Any service implementation
- Modifying any other token files
- Config changes (AXIGAPDETSPE-001)

## Implementation Details

### Token to Add

Add to the V3 Services section (around line 119, before the closing `}`):

```javascript
  // V3 Services (PROANAOVEV3 series)
  ISharedContextPoolGenerator: 'ISharedContextPoolGenerator',
  IPrototypeVectorEvaluator: 'IPrototypeVectorEvaluator',
  IWilsonInterval: 'IWilsonInterval',
  IAgreementMetricsCalculator: 'IAgreementMetricsCalculator',
  IPrototypeProfileCalculator: 'IPrototypeProfileCalculator',
  IGateASTNormalizer: 'IGateASTNormalizer',
  IActionableSuggestionEngine: 'IActionableSuggestionEngine',

  // Axis Gap Detection (AXIGAPDETSPE series)
  IAxisGapAnalyzer: 'IAxisGapAnalyzer',
});
```

## Acceptance Criteria

### Tests That Must Pass

1. Token can be imported: `import { diagnosticsTokens } from './tokens-diagnostics.js'`
2. `diagnosticsTokens.IAxisGapAnalyzer` equals `'IAxisGapAnalyzer'`
3. Token is included in the frozen diagnosticsTokens object

### Invariants That Must Remain True

1. `diagnosticsTokens` remains frozen (`Object.isFrozen() === true`)
2. All existing tokens remain unchanged
3. `npm run typecheck` passes
4. `npx eslint src/dependencyInjection/tokens/tokens-diagnostics.js` passes
5. Token naming follows existing pattern (`I[ServiceName]`)

## Dependencies

None - can be done in parallel with AXIGAPDETSPE-001.

## Estimated Diff Size

~10 lines total (token + unit test assertion)

## Status

- [x] Completed

## Outcome

Added the `IAxisGapAnalyzer` diagnostics token and a focused unit test assertion in the existing diagnostics token coverage. No DI registrations or service code were added because the ticket scope is limited to the token itself.
