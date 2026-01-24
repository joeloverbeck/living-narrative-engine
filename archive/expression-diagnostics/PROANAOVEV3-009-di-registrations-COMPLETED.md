# PROANAOVEV3-009: DI Registrations for V3 Services

## Status: ✅ COMPLETED

## Summary

Add DI tokens and factory registrations for all v3 services, wiring them into the dependency injection container.

## Motivation

All v3 services need to be registered in the DI container to be injected into consumers. This includes:
- Token definitions
- Factory registrations with proper dependencies

## Files to Modify

### Tokens
- `src/dependencyInjection/tokens/tokens-diagnostics.js`

### Registrations
- `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js`

## Implementation Details

### Tokens to Add

```javascript
// In tokens-diagnostics.js
export const diagnosticsTokens = freeze({
  // ... existing tokens ...

  // V3 Services (PROANAOVEV3 series)
  ISharedContextPoolGenerator: 'ISharedContextPoolGenerator',
  IPrototypeVectorEvaluator: 'IPrototypeVectorEvaluator',
  IWilsonInterval: 'IWilsonInterval',
  IAgreementMetricsCalculator: 'IAgreementMetricsCalculator',
  IPrototypeProfileCalculator: 'IPrototypeProfileCalculator',
  IGateASTNormalizer: 'IGateASTNormalizer',
  IActionableSuggestionEngine: 'IActionableSuggestionEngine',
});
```

### Factory Registrations

Based on actual constructor signatures from the service implementations:

```javascript
// In prototypeOverlapRegistrations.js
import SharedContextPoolGenerator from '../../expressionDiagnostics/services/prototypeOverlap/SharedContextPoolGenerator.js';
import PrototypeVectorEvaluator from '../../expressionDiagnostics/services/prototypeOverlap/PrototypeVectorEvaluator.js';
import { wilsonInterval } from '../../expressionDiagnostics/services/prototypeOverlap/WilsonInterval.js';
import AgreementMetricsCalculator from '../../expressionDiagnostics/services/prototypeOverlap/AgreementMetricsCalculator.js';
import PrototypeProfileCalculator from '../../expressionDiagnostics/services/prototypeOverlap/PrototypeProfileCalculator.js';
import GateASTNormalizer from '../../expressionDiagnostics/services/prototypeOverlap/GateASTNormalizer.js';
import ActionableSuggestionEngine from '../../expressionDiagnostics/services/prototypeOverlap/ActionableSuggestionEngine.js';

// V3 Service Registrations

// SharedContextPoolGenerator:
// - randomStateGenerator: IRandomStateGenerator
// - contextBuilder: IMonteCarloContextBuilder
// - logger: ILogger
// - Config options passed directly from PROTOTYPE_OVERLAP_CONFIG
registrar.singletonFactory(
  diagnosticsTokens.ISharedContextPoolGenerator,
  (c) => new SharedContextPoolGenerator({
    randomStateGenerator: c.resolve(diagnosticsTokens.IRandomStateGenerator),
    contextBuilder: c.resolve(diagnosticsTokens.IMonteCarloContextBuilder),
    logger: c.resolve(tokens.ILogger),
    poolSize: PROTOTYPE_OVERLAP_CONFIG.sharedPoolSize,
    stratified: PROTOTYPE_OVERLAP_CONFIG.enableStratifiedSampling,
    stratumCount: PROTOTYPE_OVERLAP_CONFIG.stratumCount,
    stratificationStrategy: PROTOTYPE_OVERLAP_CONFIG.stratificationStrategy,
    randomSeed: PROTOTYPE_OVERLAP_CONFIG.poolRandomSeed,
  })
);

// PrototypeVectorEvaluator:
// - prototypeGateChecker: IPrototypeGateChecker
// - prototypeIntensityCalculator: IPrototypeIntensityCalculator
// - logger: ILogger
registrar.singletonFactory(
  diagnosticsTokens.IPrototypeVectorEvaluator,
  (c) => new PrototypeVectorEvaluator({
    prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
    prototypeIntensityCalculator: c.resolve(diagnosticsTokens.IPrototypeIntensityCalculator),
    logger: c.resolve(tokens.ILogger),
  })
);

// WilsonInterval: Pure function, registered as value
registrar.singletonFactory(
  diagnosticsTokens.IWilsonInterval,
  () => wilsonInterval
);

// AgreementMetricsCalculator:
// - wilsonInterval: function
// - confidenceLevel: from config
// - minSamplesForReliableCorrelation: from config
// - logger: ILogger
registrar.singletonFactory(
  diagnosticsTokens.IAgreementMetricsCalculator,
  (c) => new AgreementMetricsCalculator({
    wilsonInterval: c.resolve(diagnosticsTokens.IWilsonInterval),
    confidenceLevel: PROTOTYPE_OVERLAP_CONFIG.confidenceLevel,
    minSamplesForReliableCorrelation: PROTOTYPE_OVERLAP_CONFIG.minSamplesForReliableCorrelation,
    logger: c.resolve(tokens.ILogger),
  })
);

// PrototypeProfileCalculator:
// - config: object with profile thresholds
// - logger: ILogger
registrar.singletonFactory(
  diagnosticsTokens.IPrototypeProfileCalculator,
  (c) => new PrototypeProfileCalculator({
    config: {
      lowVolumeThreshold: PROTOTYPE_OVERLAP_CONFIG.lowVolumeThreshold,
      lowNoveltyThreshold: PROTOTYPE_OVERLAP_CONFIG.lowNoveltyThreshold,
      singleAxisFocusThreshold: PROTOTYPE_OVERLAP_CONFIG.singleAxisFocusThreshold,
      clusterCount: PROTOTYPE_OVERLAP_CONFIG.clusterCount,
      clusteringMethod: PROTOTYPE_OVERLAP_CONFIG.clusteringMethod,
    },
    logger: c.resolve(tokens.ILogger),
  })
);

// GateASTNormalizer:
// - logger: ILogger
registrar.singletonFactory(
  diagnosticsTokens.IGateASTNormalizer,
  (c) => new GateASTNormalizer({
    logger: c.resolve(tokens.ILogger),
  })
);

// ActionableSuggestionEngine:
// - config: object with suggestion thresholds
// - logger: ILogger
// - contextAxisNormalizer: IContextAxisNormalizer (CORRECTED - was missing in original ticket)
registrar.singletonFactory(
  diagnosticsTokens.IActionableSuggestionEngine,
  (c) => new ActionableSuggestionEngine({
    config: {
      minSamplesForStump: PROTOTYPE_OVERLAP_CONFIG.minSamplesForStump,
      minInfoGainForSuggestion: PROTOTYPE_OVERLAP_CONFIG.minInfoGainForSuggestion,
      divergenceThreshold: PROTOTYPE_OVERLAP_CONFIG.divergenceThreshold,
      maxSuggestionsPerPair: PROTOTYPE_OVERLAP_CONFIG.maxSuggestionsPerPair,
      minOverlapReductionForSuggestion: PROTOTYPE_OVERLAP_CONFIG.minOverlapReductionForSuggestion,
      minActivationRateAfterSuggestion: PROTOTYPE_OVERLAP_CONFIG.minActivationRateAfterSuggestion,
    },
    logger: c.resolve(tokens.ILogger),
    contextAxisNormalizer: c.resolve(diagnosticsTokens.IContextAxisNormalizer),
  })
);
```

## Assumptions Corrected

The original ticket made several incorrect assumptions about service dependencies:

1. **SharedContextPoolGenerator**: Originally assumed `config` object. Actual constructor takes individual options (`poolSize`, `stratified`, etc.) plus `randomStateGenerator`, `contextBuilder`, and `logger`.

2. **AgreementMetricsCalculator**: Originally assumed `config` object. Actual constructor takes `wilsonInterval` function, optional numeric parameters (`confidenceLevel`, `minSamplesForReliableCorrelation`), and `logger`.

3. **ActionableSuggestionEngine**: Originally assumed only `config` and `logger`. **CRITICAL CORRECTION**: Also requires `contextAxisNormalizer` dependency (IContextAxisNormalizer).

## Out of Scope

- Creating the services themselves (tickets 001-007)
- Integrating services into existing classes (tickets 010-014)

## Acceptance Criteria

- [x] Tokens defined for all 7 v3 services/utilities
- [x] Factory registrations wire correct dependencies
- [x] Registrations use standard DI patterns from project
- [x] No circular dependencies introduced
- [x] Existing registrations unchanged
- [x] Container resolves all new tokens successfully
- [x] `npm run typecheck` passes
- [x] `npx eslint src/dependencyInjection/tokens/tokens-diagnostics.js src/dependencyInjection/registrations/prototypeOverlapRegistrations.js` passes
- [x] Unit tests added for new registrations

## Dependencies

- PROANAOVEV3-001 through PROANAOVEV3-007 (services must exist) ✓ All exist

## Estimated Complexity

Low - standard DI registration patterns.

## Outcome

### Implementation Summary

Successfully implemented DI registrations for all 7 V3 services:

1. **Tokens Added** (`tokens-diagnostics.js`):
   - `ISharedContextPoolGenerator`
   - `IPrototypeVectorEvaluator`
   - `IWilsonInterval`
   - `IAgreementMetricsCalculator`
   - `IPrototypeProfileCalculator`
   - `IGateASTNormalizer`
   - `IActionableSuggestionEngine`

2. **Factory Registrations Added** (`prototypeOverlapRegistrations.js`):
   - All 7 services registered with correct dependencies
   - Singleton lifecycle pattern used consistently
   - Configuration values pulled from `PROTOTYPE_OVERLAP_CONFIG`

### Assumption Corrections Applied

Three critical assumption corrections were made during implementation:

1. **SharedContextPoolGenerator**: Constructor takes individual config options (`poolSize`, `stratified`, etc.) rather than a config object
2. **AgreementMetricsCalculator**: Constructor takes `wilsonInterval` function plus individual numeric config values
3. **ActionableSuggestionEngine**: Requires `contextAxisNormalizer` dependency (IContextAxisNormalizer) - **critical dependency that was missing from original ticket**

### Tests Added

7 new unit tests added to `prototypeOverlapRegistrations.test.js`:

| Test | Rationale |
|------|-----------|
| `should register SharedContextPoolGenerator correctly` | Validates singleton registration and class instantiation |
| `should register PrototypeVectorEvaluator correctly` | Validates singleton registration and class instantiation |
| `should register WilsonInterval as a function correctly` | Validates pure function registration pattern |
| `should register AgreementMetricsCalculator correctly` | Validates singleton registration and class instantiation |
| `should register PrototypeProfileCalculator correctly` | Validates singleton registration and class instantiation |
| `should register GateASTNormalizer correctly` | Validates singleton registration and class instantiation |
| `should register ActionableSuggestionEngine correctly` | Validates singleton registration with corrected contextAxisNormalizer dependency |

Additionally, the existing "resolve all without circular dependencies" test was extended to verify all V3 services resolve without circular dependency issues.

### Verification

- ✅ All 24 tests pass (17 existing + 7 new)
- ✅ ESLint passes with no errors
- ✅ All services resolve successfully from container
- ✅ No circular dependencies introduced
