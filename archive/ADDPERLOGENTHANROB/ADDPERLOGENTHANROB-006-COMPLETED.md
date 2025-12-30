# ADDPERLOGENTHANROB-006: Update DI Registrations for New Services - COMPLETED

## Summary

Register the new `PerceptionEntryBuilder` and `SensorialPropagationService` in the dependency injection container. Update `AddPerceptionLogEntryHandler` registration to inject the new services.

## Phase

Phase 3: Service Extraction (Step 3 of 3)

## Status

**COMPLETED** - 2025-12-30

## Outcome

All DI registrations completed successfully. Both services are properly wired into the handler via dependency injection.

### Discrepancies Found During Implementation

| Ticket Assumption | Actual Reality | Resolution |
|-------------------|----------------|------------|
| Handler already accepts `perceptionEntryBuilder` parameter | Handler created it inline at line 135 | Modified constructor to accept injected service |
| Handler already accepts `sensorialPropagationService` parameter | Handler created it inline at lines 136-140 | Modified constructor to accept injected service |
| Line ~574 for infra registration | RecipientSetBuilder ends at line 598 | Used line 598 as insertion point |
| Only 3 files to touch | Many test files needed updates | Updated 10+ test files with new mock dependencies |

### Files Modified

#### DI Registrations (Core Changes)
| File | Change |
|------|--------|
| `src/dependencyInjection/tokens/tokens-core.js` | Added `IPerceptionEntryBuilder` and `ISensorialPropagationService` tokens |
| `src/dependencyInjection/registrations/infrastructureRegistrations.js` | Registered both services as singletons |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Updated handler factory to inject new services |
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | Updated constructor to accept/validate new dependencies, removed inline service creation |

#### Handler Tests
| File | Change |
|------|--------|
| `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js` | Added mock factories for new services, updated all test instantiations |
| `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.targetDescription.test.js` | Added new mock parameters to handler instantiation |

#### DI Registration Tests
| File | Change |
|------|--------|
| `tests/unit/dependencyInjection/registrations/operationHandlerRegistrations.test.js` | Added new service tokens to expected dependencies |
| `tests/unit/dependencyInjection/registrations/interpreterRegistrations.addPerceptionLogEntryHandler.test.js` | Added mock instances for new tokens |

#### Integration/E2E Tests
| File | Change |
|------|--------|
| `tests/common/mods/ModTestHandlerFactory.js` | Updated handler with IIFE pattern for new services |
| `tests/integration/core/rules/entitySpeechRule.integration.test.js` | Added imports and handler parameters |
| `tests/integration/core/rules/logPerceptibleEventsRule.integration.test.js` | Added imports and handler parameters with IIFE |
| `tests/integration/mods/movement/goActionPerceptionRouting.test.js` | Added imports and handler parameters |
| `tests/integration/mods/items/putInContainerRuleExecution.test.js` | Added imports and updated both handler instantiations |
| `tests/integration/perception/senseAwareFiltering.integration.test.js` | Added imports and updated both handler instantiations |
| `tests/e2e/perception/SenseAwareFiltering.e2e.test.js` | Added imports and handler parameters with recipientSetBuilder |

### Test Results

```
Unit Tests:       41,153 passed, 41,153 total
Integration Tests: 17,579 passed, 17,579 total
```

### Verification Checklist

- [x] `IPerceptionEntryBuilder` token added to tokens-core.js
- [x] `ISensorialPropagationService` token added to tokens-core.js
- [x] PerceptionEntryBuilder registered in infrastructureRegistrations.js
- [x] SensorialPropagationService registered in infrastructureRegistrations.js
- [x] AddPerceptionLogEntryHandler factory updated with new dependencies
- [x] Handler constructor updated to accept/validate new dependencies
- [x] All unit tests pass
- [x] All integration tests pass
- [x] Lint completed (pre-existing warnings only)
- [x] All test files updated with new mock parameters

## Implementation Pattern Notes

### Handler Instantiation in Tests

Two patterns were used depending on context:

**Pattern 1: Direct (when recipientSetBuilder exists)**
```javascript
ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
  entityManager,
  logger,
  safeEventDispatcher: safeDispatcher,
  routingPolicyService,
  perceptionEntryBuilder: new PerceptionEntryBuilder({ logger }),
  sensorialPropagationService: new SensorialPropagationService({
    entityManager,
    recipientSetBuilder,
    logger,
  }),
}),
```

**Pattern 2: IIFE (when recipientSetBuilder needs creation)**
```javascript
ADD_PERCEPTION_LOG_ENTRY: (() => {
  const recipientSetBuilder = new RecipientSetBuilder({ entityManager, logger });
  return new AddPerceptionLogEntryHandler({
    entityManager,
    logger,
    safeEventDispatcher: safeDispatcher,
    routingPolicyService,
    perceptionEntryBuilder: new PerceptionEntryBuilder({ logger }),
    sensorialPropagationService: new SensorialPropagationService({
      entityManager,
      recipientSetBuilder,
      logger,
    }),
  });
})(),
```

### Mock Factories for Unit Tests

```javascript
const makePerceptionEntryBuilder = () => ({
  buildForRecipient: jest.fn().mockReturnValue({
    descriptionText: 'mocked',
    timestamp: Date.now(),
  }),
});

const makeSensorialPropagationService = () => ({
  shouldPropagate: jest.fn().mockReturnValue(false),
  getLinkedLocationsWithPrefixedEntries: jest.fn().mockReturnValue([]),
});
```

## Blocked By

- ADDPERLOGENTHANROB-004 ✅
- ADDPERLOGENTHANROB-005 ✅

## Blocks

- ADDPERLOGENTHANROB-007 (Implement strategy pattern - needs services wired)
- ADDPERLOGENTHANROB-008 (Add structured telemetry)
- ADDPERLOGENTHANROB-009 (Research splitting handler)
