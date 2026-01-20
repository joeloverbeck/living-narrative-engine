# PROOVEANA-006: DI Registration

## Description

Register all Prototype Overlap Analyzer services in the dependency injection container. This ticket creates a dedicated registration module and integrates it with the existing expression diagnostics registrations.

## Files to Create

- `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js`

## Files to Modify

- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

## Out of Scope

- Service implementations (already done in PROOVEANA-001 through PROOVEANA-005)
- UI controller registration (part of PROOVEANA-009)
- Integration tests - PROOVEANA-010

## Implementation Details

### prototypeOverlapRegistrations.js

```javascript
/**
 * @file DI registrations for Prototype Overlap Analyzer services
 * @see specs/prototype-overlap-analyzer.md
 */

import { diagnosticsTokens } from '../tokens/tokens-diagnostics.js';
import { coreTokens } from '../tokens/tokens-core.js';
import { PROTOTYPE_OVERLAP_CONFIG } from '../../expressionDiagnostics/config/prototypeOverlapConfig.js';

import CandidatePairFilter from '../../expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js';
import BehavioralOverlapEvaluator from '../../expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';
import OverlapClassifier from '../../expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js';
import OverlapRecommendationBuilder from '../../expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js';
import PrototypeOverlapAnalyzer from '../../expressionDiagnostics/services/PrototypeOverlapAnalyzer.js';

/**
 * Register prototype overlap analysis services.
 *
 * @param {object} registrar - DI registrar
 */
export function registerPrototypeOverlapServices(registrar) {
  // CandidatePairFilter
  registrar.singletonFactory(
    diagnosticsTokens.ICandidatePairFilter,
    (c) => new CandidatePairFilter({
      config: PROTOTYPE_OVERLAP_CONFIG,
      logger: c.resolve(coreTokens.ILogger),
    })
  );

  // BehavioralOverlapEvaluator
  // NOTE: contextAxisNormalizer was incorrectly included in original ticket.
  // The service does NOT use it - verified from actual constructor signature.
  registrar.singletonFactory(
    diagnosticsTokens.IBehavioralOverlapEvaluator,
    (c) => new BehavioralOverlapEvaluator({
      prototypeIntensityCalculator: c.resolve(diagnosticsTokens.IPrototypeIntensityCalculator),
      randomStateGenerator: c.resolve(diagnosticsTokens.IRandomStateGenerator),
      contextBuilder: c.resolve(diagnosticsTokens.IMonteCarloContextBuilder),
      prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
      config: PROTOTYPE_OVERLAP_CONFIG,
      logger: c.resolve(coreTokens.ILogger),
    })
  );

  // OverlapClassifier
  registrar.singletonFactory(
    diagnosticsTokens.IOverlapClassifier,
    (c) => new OverlapClassifier({
      config: PROTOTYPE_OVERLAP_CONFIG,
      logger: c.resolve(coreTokens.ILogger),
    })
  );

  // OverlapRecommendationBuilder
  registrar.singletonFactory(
    diagnosticsTokens.IOverlapRecommendationBuilder,
    (c) => new OverlapRecommendationBuilder({
      config: PROTOTYPE_OVERLAP_CONFIG,
      logger: c.resolve(coreTokens.ILogger),
    })
  );

  // PrototypeOverlapAnalyzer (main orchestrator)
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeOverlapAnalyzer,
    (c) => new PrototypeOverlapAnalyzer({
      prototypeRegistryService: c.resolve(diagnosticsTokens.IPrototypeRegistryService),
      candidatePairFilter: c.resolve(diagnosticsTokens.ICandidatePairFilter),
      behavioralOverlapEvaluator: c.resolve(diagnosticsTokens.IBehavioralOverlapEvaluator),
      overlapClassifier: c.resolve(diagnosticsTokens.IOverlapClassifier),
      recommendationBuilder: c.resolve(diagnosticsTokens.IOverlapRecommendationBuilder),
      config: PROTOTYPE_OVERLAP_CONFIG,
      logger: c.resolve(coreTokens.ILogger),
    })
  );
}

export default registerPrototypeOverlapServices;
```

### Update expressionDiagnosticsRegistrations.js

```javascript
// Add import
import { registerPrototypeOverlapServices } from './prototypeOverlapRegistrations.js';

// In registerExpressionDiagnosticsServices function, add:
registerPrototypeOverlapServices(registrar);
```

## Acceptance Criteria

1. `registerPrototypeOverlapServices(container)` function created
2. All 5 services registered as singletons:
   - `ICandidatePairFilter` → CandidatePairFilter
   - `IBehavioralOverlapEvaluator` → BehavioralOverlapEvaluator
   - `IOverlapClassifier` → OverlapClassifier
   - `IOverlapRecommendationBuilder` → OverlapRecommendationBuilder
   - `IPrototypeOverlapAnalyzer` → PrototypeOverlapAnalyzer
3. Registration called from `registerExpressionDiagnosticsServices()`
4. `npm run typecheck` passes
5. Container can resolve all new tokens without error
6. Application starts successfully

### Invariants

- Registration order respects service dependencies
- All required services resolved from container
- `npx eslint <modified-files>` passes

## Verification Commands

```bash
npm run typecheck

npx eslint src/dependencyInjection/registrations/prototypeOverlapRegistrations.js \
           src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js
```

## Dependencies

- PROOVEANA-000 (tokens and config)
- PROOVEANA-001 through PROOVEANA-005 (service implementations)

## Estimated Diff Size

- New registration file: ~80 lines
- expressionDiagnosticsRegistrations.js: ~5 lines
- **Total: ~85 lines**
