# PROREDANAV2-013: Register New Services in DI

## Description

Wire up the new gate analysis services (GateConstraintExtractor, GateImplicationEvaluator) in the dependency injection registrations. This enables the services to be resolved and injected into the orchestrator.

## Files to Touch

### Modify
- `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js`

## Out of Scope

- GateBandingSuggestionBuilder registration (PROREDANAV2-015 will add this)
- Updating orchestrator to use new services (PROREDANAV2-016)
- Any service implementation changes
- Test creation (services have their own tests)

## Changes Required

### 1. Add Imports

```javascript
import GateConstraintExtractor from '../../expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js';
import GateImplicationEvaluator from '../../expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js';
```

### 2. Add IGateConstraintExtractor Factory

```javascript
// Gate structure analysis services
container.registerFactory(
  diagnosticsTokens.IGateConstraintExtractor,
  (c) => new GateConstraintExtractor({
    config: c.resolve(diagnosticsTokens.IPrototypeOverlapConfig),
    logger: c.resolve(coreTokens.ILogger)
  })
);
```

### 3. Add IGateImplicationEvaluator Factory

```javascript
container.registerFactory(
  diagnosticsTokens.IGateImplicationEvaluator,
  (c) => new GateImplicationEvaluator({
    logger: c.resolve(coreTokens.ILogger)
  })
);
```

### 4. Verify Token Imports

Ensure tokens are imported:
```javascript
import { diagnosticsTokens } from '../tokens/tokens-diagnostics.js';
```

## Acceptance Criteria

### Tests That Must Pass

1. **IGateConstraintExtractor resolvable**:
   - `container.resolve(diagnosticsTokens.IGateConstraintExtractor)` returns instance

2. **IGateImplicationEvaluator resolvable**:
   - `container.resolve(diagnosticsTokens.IGateImplicationEvaluator)` returns instance

3. **Config injected correctly**:
   - GateConstraintExtractor receives config with strictEpsilon

4. **Logger injected correctly**:
   - Both services receive logger dependency

5. **Existing registrations unchanged**:
   - ICandidatePairFilter still resolvable
   - IBehavioralOverlapEvaluator still resolvable
   - IOverlapClassifier still resolvable
   - IOverlapRecommendationBuilder still resolvable
   - IPrototypeOverlapAnalyzer still resolvable

6. **No circular dependencies**:
   - Services resolve without infinite loops

### Invariants That Must Remain True

- Existing service registrations unchanged
- Factory pattern consistent with other registrations
- Dependencies resolved from container, not hardcoded
- Registration order doesn't matter (no initialization side effects)

## Estimated Size

~40 lines of code changes

## Dependencies

- PROREDANAV2-002 (tokens must exist)
- PROREDANAV2-007 (GateConstraintExtractor class must exist)
- PROREDANAV2-008 (GateImplicationEvaluator class must exist)

## Verification Commands

```bash
# Run DI registration tests
npm run test:unit -- --testPathPattern=prototypeOverlapRegistrations

# Verify no circular dependencies by running full test suite
npm run test:unit

# Lint
npx eslint src/dependencyInjection/registrations/prototypeOverlapRegistrations.js
```
