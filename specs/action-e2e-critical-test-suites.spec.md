# Action E2E Critical Test Suites Specification

**Date:** 2025-01-28  
**Version:** 1.1.0  
**Status:** Ready for Implementation  
**Priority:** HIGHEST - Critical for System Stability

**Update Note (v1.1.0)**: This specification has been updated to align with the actual codebase structure, including:

- Use of facade pattern for E2E tests (following existing patterns)
- Correct pipeline stage names (ComponentFilteringStage, PrerequisiteEvaluationStage, etc.)
- Realistic persistence capabilities (basic save/load, not comprehensive action state serialization)
- Current AI integration scope (AI memory/notes exist, but action decisions need implementation)
- Alignment with existing test utilities in `/tests/common/`

## Executive Summary

This specification defines requirements and implementation guidelines for three critical E2E test suites identified in the Action Pipeline E2E Test Coverage Gap Analysis. These tests address the highest-risk gaps in the action system's test coverage, focusing on failure recovery, persistence integration, and AI decision-making workflows.

### Test Suites to Implement

1. **ActionFailureRecovery.e2e.test.js** - Failure scenarios and recovery mechanisms
2. **ActionPersistenceIntegration.e2e.test.js** - Save/load operations during action processing
3. **AIActionDecisionIntegration.e2e.test.js** - AI actor decision-making workflows

### Impact Assessment

- **Risk Mitigation**: Addresses 50% of identified high-risk gaps
- **Coverage Improvement**: Adds critical workflow coverage for production scenarios
- **Estimated Effort**: 9-12 days total implementation time
- **Business Value**: Prevents data corruption and system failures in production

## Test Suite 1: ActionFailureRecovery.e2e.test.js

### Purpose

Comprehensive testing of action system failure scenarios and recovery mechanisms to ensure game state consistency and graceful degradation under failure conditions.

### Requirements

#### Functional Requirements

1. **State Rollback Capability**
   - Must validate automatic state rollback when actions fail mid-execution
   - Must preserve pre-action state integrity
   - Must handle partial state changes correctly

2. **Pipeline Stage Failure Handling**
   - Must test failures at each pipeline stage:
     - ComponentFilteringStage
     - PrerequisiteEvaluationStage
     - TargetResolutionStage (including MultiTargetResolutionStage)
     - ActionFormattingStage (including MultiTargetActionFormatter)
   - Must verify error propagation through pipeline stages
   - Must validate stage-specific recovery mechanisms

3. **Service Unavailability Handling**
   - Must gracefully handle unavailable entity manager
   - Must handle event bus failures without crashing
   - Must provide fallback behavior for missing services

4. **Error Communication**
   - Must provide clear, actionable error messages
   - Must dispatch appropriate error events
   - Must maintain error context through recovery process

#### Technical Requirements

1. **State Consistency Validation**
   - Pre-failure state snapshot capability
   - Post-recovery state comparison
   - Entity integrity verification

2. **Transaction-Like Behavior**
   - Atomic action execution validation
   - All-or-nothing state changes
   - Rollback mechanism verification

3. **Performance Under Failure**
   - Recovery must complete within 500ms
   - No memory leaks during failure scenarios
   - Graceful degradation without performance impact

### Test Scenarios

```javascript
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

describe('Action Failure Recovery E2E', () => {
  let facades;
  let actionService;
  let entityService;
  let turnExecutionFacade;

  beforeEach(() => {
    facades = createMockFacades({}, jest.fn);
    actionService = facades.actionService;
    entityService = facades.entityService;
    turnExecutionFacade = facades.turnExecutionFacade;
  });

  // Scenario 1: Mid-Pipeline Execution Failure
  test('should rollback state when action execution fails mid-pipeline', async () => {
    // Setup: Create game state with actor and target
    // Action: Execute action that fails during operation handler
    // Assert: Original state is preserved
    // Assert: Error event is dispatched
    // Assert: UI receives failure notification
  });

  // Scenario 2: Prerequisite Evaluation Failure
  test('should recover gracefully from prerequisite evaluation failures', async () => {
    // Setup: Create action with failing prerequisite
    // Action: Attempt to execute action
    // Assert: No state changes occur
    // Assert: Appropriate error message provided
    // Assert: Action remains available for retry
  });

  // Scenario 3: Entity Manager Failure
  test('should handle entity manager failures during action execution', async () => {
    // Setup: Mock entity manager to fail during update
    // Action: Execute action requiring entity updates
    // Assert: Transaction rollback occurs
    // Assert: Error recovery preserves consistency
    // Assert: System remains operational
  });

  // Scenario 4: Turn Consistency During Failures
  test('should maintain turn consistency when actions fail', async () => {
    // Setup: Multi-actor turn with failing action
    // Action: Process turn with failure
    // Assert: Turn state remains consistent
    // Assert: Other actors can still act
    // Assert: Failed actor can retry or skip
  });

  // Scenario 5: Cascading Failure Prevention
  test('should prevent cascading failures from corrupting game state', async () => {
    // Setup: Action triggering multiple side effects
    // Action: Initial action fails after some effects
    // Assert: All effects are rolled back
    // Assert: No orphaned state changes
    // Assert: Event cascade is properly terminated
  });
});
```

### Implementation Guidelines

#### Test Infrastructure Requirements

1. **State Snapshot Utilities**

   ```javascript
   // Utilize existing entity facade for state management
   const captureState = (entityService) => {
     return {
       entities: entityService.getAllEntities(),
       turnState: entityService.getCurrentTurnState(),
     };
   };

   const compareStates = (state1, state2) => {
     // Deep comparison logic
   };
   ```

2. **Failure Injection Mechanisms**

   ```javascript
   // Use mock facades to inject failures
   const injectFailure = (facade, methodName, error) => {
     facade[methodName].mockRejectedValueOnce(error);
   };

   const injectServiceFailure = (facades, serviceName, error) => {
     facades[serviceName].mockImplementationOnce(() => {
       throw error;
     });
   };
   ```

3. **Recovery Validation Helpers**
   ```javascript
   // Leverage existing test utilities
   const validateRecovery = (beforeState, afterState, errorEvents) => {
     expect(afterState).toEqual(beforeState);
     expect(errorEvents).toHaveLength(1);
     expect(errorEvents[0].type).toBe('ACTION_EXECUTION_FAILED');
   };
   ```

#### Integration Points

- **Entity Manager**: State rollback hooks
- **Event Bus**: Error event monitoring
- **Turn Manager**: Turn state preservation
- **UI Components**: Error notification handling

#### Test Data Requirements

- Pre-configured failure scenarios
- Complex game states for rollback testing
- Multi-entity action definitions
- Error injection configurations

### Success Criteria

1. **Coverage**: 100% of identified failure scenarios tested
2. **Reliability**: Zero flaky tests, 100% pass rate
3. **Performance**: All recovery operations < 500ms
4. **Maintainability**: Clear test structure, reusable utilities

## Test Suite 2: ActionPersistenceIntegration.e2e.test.js

### Purpose

Ensure action system integrity during save/load operations, validating state consistency across game sessions and proper cache management.

### Requirements

#### Functional Requirements

1. **Save During Action Execution**
   - Must handle save operations interrupting action processing
   - Must preserve action execution state
   - Must allow resumption after load

2. **Load State Restoration**
   - Must restore action-related state correctly
   - Must rebuild action indices from saved data
   - Must maintain action availability consistency

3. **Cache Management**
   - Must invalidate action caches appropriately
   - Must rebuild caches from persistent state
   - Must handle stale cache detection

4. **Turn Continuity**
   - Must preserve turn state across save/load
   - Must maintain actor action history
   - Must restore turn order correctly

#### Technical Requirements

1. **Serialization Compatibility**
   - Action state must be serializable
   - Complex objects must round-trip correctly
   - Performance data excluded from saves

2. **Version Compatibility**
   - Must handle save format migrations
   - Must provide backward compatibility
   - Must validate save data integrity

3. **Performance Requirements**
   - Save operations < 100ms impact on actions
   - Load restoration < 1s for action system
   - Cache rebuild < 500ms

### Test Scenarios

```javascript
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

describe('Action Persistence Integration E2E', () => {
  let facades;
  let actionService;
  let entityService;
  let persistenceCoordinator;

  beforeEach(() => {
    facades = createMockFacades({}, jest.fn);
    actionService = facades.actionService;
    entityService = facades.entityService;
    // Note: persistenceCoordinator would need to be injected or mocked
  });

  // Scenario 1: Save During Action
  test('should handle save operation during action execution', async () => {
    // Setup: Start complex multi-stage action
    // Action: Trigger save mid-execution
    // Assert: Save completes without corruption
    // Assert: Action state is captured
    // Assert: Game remains playable
  });

  // Scenario 2: Load Restoration
  test('should restore action state correctly after load', async () => {
    // Setup: Save game with partial action state
    // Action: Load saved game
    // Assert: Action indices rebuilt correctly
    // Assert: Available actions match pre-save
    // Assert: Action history preserved
  });

  // Scenario 3: Cache Invalidation
  test('should invalidate caches appropriately after load', async () => {
    // Setup: Save with populated action caches
    // Action: Load and modify game state
    // Assert: Caches detect staleness
    // Assert: Caches rebuild with new state
    // Assert: No stale data used
  });

  // Scenario 4: Turn State Persistence
  test('should maintain turn continuity across save/load', async () => {
    // Setup: Save mid-turn with actions taken
    // Action: Load saved game
    // Assert: Turn resumes correctly
    // Assert: Action history intact
    // Assert: Remaining actors can act
  });
});
```

### Implementation Guidelines

#### Serialization Strategy

```javascript
// Note: The actual persistence system is less comprehensive than originally assumed.
// The persistenceCoordinator handles basic save/load, but action-specific
// serialization would need to be implemented.

const serializeActionState = (actionService, turnManager) => {
  // Current implementation would need enhancement for action state
  return {
    version: '1.0.0',
    availableActions: actionService.getAvailableActions(),
    turnState: turnManager.getCurrentState(),
    // Note: Action indices and caches are not currently persisted
  };
};

const deserializeActionState = (data, actionService, turnManager) => {
  // Validate version compatibility
  if (data.version !== '1.0.0') {
    throw new Error('Incompatible save version');
  }
  // Restore what is currently supported
  return data;
};
```

#### Cache Management

```javascript
// Note: Action caches are not currently persisted
// This would be a new implementation requirement

const rebuildActionCaches = async (actionService, entityManager) => {
  // Force cache rebuild after load
  actionService.invalidateAllCaches();
  await actionService.discoverAllActions(entityManager);
};
```

#### Integration Points

- **Save System**: Action state serialization hooks
- **Load System**: State restoration callbacks
- **Cache System**: Invalidation and rebuild triggers
- **Turn Manager**: Turn state persistence

### Success Criteria

1. **Data Integrity**: 100% state preservation across save/load
2. **Cache Accuracy**: Zero stale cache usage
3. **Performance**: Load restoration < 1s
4. **Compatibility**: Backward compatibility with existing saves

## Test Suite 3: AIActionDecisionIntegration.e2e.test.js

### Purpose

Validate AI actor decision-making workflows, including LLM integration, fallback mechanisms, and decision validation to ensure AI actors behave correctly and gracefully handle service failures.

**Note**: The current codebase has AI services focused on memory and notes (in `/src/ai/`), but AI-driven action decisions are not yet fully implemented. This test suite would need to work with the existing `llm-proxy-server` and potentially new AI decision-making components.

### Requirements

#### Functional Requirements

1. **LLM Decision Making**
   - Must integrate with LLM service for decisions
   - Must parse and validate LLM responses
   - Must handle malformed responses

2. **Fallback Mechanisms**
   - Must provide default actions when LLM unavailable
   - Must use rule-based fallbacks appropriately
   - Must maintain gameplay flow during failures

3. **Timeout Handling**
   - Must enforce decision timeouts
   - Must provide timeout-based fallbacks
   - Must prevent infinite waiting

4. **Decision Validation**
   - Must validate AI-selected actions
   - Must reject invalid action choices
   - Must provide correction mechanisms

#### Technical Requirements

1. **LLM Integration**
   - Mock LLM service for testing
   - Configurable response delays
   - Error injection capability

2. **Performance Requirements**
   - Decision timeout: 5 seconds max
   - Fallback activation: < 100ms
   - Validation overhead: < 50ms

3. **Robustness Requirements**
   - Handle network failures gracefully
   - Manage malformed JSON responses
   - Prevent decision loops

### Test Scenarios

```javascript
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

describe('AI Action Decision Integration E2E', () => {
  let facades;
  let actionService;
  let entityService;
  let llmService; // from llmServiceFacade

  beforeEach(() => {
    facades = createMockFacades({}, jest.fn);
    actionService = facades.actionService;
    entityService = facades.entityService;
    llmService = facades.llmService;
  });

  // Scenario 1: Successful LLM Decision
  test('should make valid action decisions using LLM', async () => {
    // Setup: AI actor with available actions
    // Action: Request AI decision via LLM
    // Assert: Valid action selected
    // Assert: Action executes successfully
    // Assert: Decision logged appropriately
  });

  // Scenario 2: LLM Failure Fallback
  test('should fallback to default actions when LLM fails', async () => {
    // Setup: Configure LLM to fail
    // Action: Request AI decision
    // Assert: Fallback mechanism activates
    // Assert: Valid default action selected
    // Assert: Gameplay continues smoothly
  });

  // Scenario 3: Timeout Handling
  test('should handle LLM timeout scenarios gracefully', async () => {
    // Setup: Configure LLM with long delay
    // Action: Request AI decision with timeout
    // Assert: Timeout triggers at 5s
    // Assert: Fallback action selected
    // Assert: No blocking of game flow
  });

  // Scenario 4: Invalid Decision Correction
  test('should validate AI-selected actions before execution', async () => {
    // Setup: Configure LLM to return invalid action
    // Action: Process AI decision
    // Assert: Invalid action detected
    // Assert: Correction mechanism activated
    // Assert: Valid action ultimately executed
  });
});
```

### Implementation Guidelines

#### LLM Service Mocking

```javascript
// Using the existing llmServiceFacade from test utilities
const configureLLMResponse = (llmService, response, delay = 100) => {
  llmService.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve(response), delay))
  );
};

const configureLLMFailure = (llmService, errorType) => {
  switch (errorType) {
    case 'timeout':
      llmService.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 6000))
      );
      break;
    case 'error':
      llmService.mockRejectedValue(new Error('LLM service unavailable'));
      break;
    case 'invalid':
      llmService.mockResolvedValue({ invalid: 'response' });
      break;
  }
};
```

#### Decision Validation Framework

```javascript
class AIDecisionValidator {
  validateAction(actionId, availableActions)
  validateTargets(targets, validTargets)
  validateParameters(params, actionSchema)
  suggestCorrection(invalidDecision)
}
```

#### Fallback Strategy

```javascript
class AIFallbackStrategy {
  selectFallbackAction(actor, context) {
    // Priority order:
    // 1. Previous successful action
    // 2. Default safe action (wait/defend)
    // 3. Random valid action
  }
}
```

#### Integration Points

- **LLM Proxy Service**: Decision request handling
- **Action Discovery**: Available action queries
- **Action Execution**: Decision execution pipeline
- **Logging System**: AI decision tracking

### Success Criteria

1. **Reliability**: 95% successful AI decisions
2. **Robustness**: 100% graceful failure handling
3. **Performance**: All decisions < 5s timeout
4. **Gameplay**: Smooth AI behavior under all conditions

## Common Implementation Guidelines

### Test Infrastructure Setup

1. **Facade-Based Testing**

   ```javascript
   // Use the existing facade pattern for all E2E tests
   import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

   const setupE2ETest = () => {
     const facades = createMockFacades({}, jest.fn);
     return {
       ...facades,
       // Additional E2E specific utilities
       captureMetrics: createMetricsCapture(),
       injectFailures: createFailureInjector(facades),
     };
   };
   ```

2. **Common Test Utilities**

   ```javascript
   // Leverage existing test utilities from /tests/common/
   import { createTestAction } from '../../common/actions/actionBuilderHelpers.js';
   import { setupTestEnvironment } from '../../common/buildTestEnvironment.js';

   // State management utilities
   const createComplexGameState = (entityService) => {
     // Use existing entity factories
     return entityService.createTestScenario('complex');
   };

   const snapshotState = (entityService, turnManager) => ({
     entities: entityService.getAllEntities(),
     turnState: turnManager.getCurrentState(),
   });

   // Action execution monitoring
   const executeActionWithMonitoring = async (actionService, action) => {
     const startTime = Date.now();
     const result = await actionService.executeAction(action);
     const duration = Date.now() - startTime;
     return { result, duration };
   };
   ```

3. **Performance Monitoring**
   ```javascript
   class E2EPerformanceMonitor {
     startMetric(name)
     endMetric(name)
     assertPerformance(name, maxMs)
     generateReport()
   }
   ```

### Testing Patterns

1. **Arrange-Act-Assert-Cleanup**
   - Comprehensive setup with test data
   - Clear action execution
   - Multiple assertion points
   - Proper cleanup to prevent test pollution

2. **Error Injection Patterns**
   - Service-level failures
   - Network timeouts
   - Data corruption scenarios
   - Resource exhaustion

3. **Validation Patterns**
   - State consistency checks
   - Event sequence validation
   - Performance threshold verification
   - Error message clarity

### CI/CD Integration

1. **Test Execution Strategy**
   - Run after unit and integration tests
   - Parallel execution where possible
   - Failure screenshots/state dumps
   - Performance report generation

2. **Resource Requirements**
   - Enhanced memory for complex states
   - Network mocking capabilities
   - Persistent storage for save/load tests
   - LLM service mocking

3. **Monitoring and Reporting**
   - Test execution metrics
   - Coverage reports
   - Performance trends
   - Failure analysis

## Implementation Timeline

### Week 1: Foundation

- Set up enhanced E2E test infrastructure
- Implement ActionFailureRecovery.e2e.test.js
- Create common failure injection utilities

### Week 2: Persistence

- Implement ActionPersistenceIntegration.e2e.test.js
- Enhance save/load test utilities
- Validate with existing save files

### Week 3: AI Integration

- Implement AIActionDecisionIntegration.e2e.test.js
- Create LLM mocking framework
- Integrate with existing AI systems

### Week 4: Optimization

- Performance optimization
- Test stability improvements
- Documentation and knowledge transfer

## Success Metrics

1. **Test Coverage**
   - 100% coverage of identified critical gaps
   - Zero uncovered failure scenarios
   - Complete workflow validation

2. **Test Quality**
   - <2% test flakiness
   - 100% reproducible failures
   - Clear failure diagnostics

3. **Performance Impact**
   - <5 minute total execution time
   - <10% CI pipeline increase
   - Parallel execution capability

4. **Business Impact**
   - 90% reduction in production action failures
   - Zero data corruption incidents
   - Improved AI actor reliability

## Maintenance and Evolution

1. **Regular Updates**
   - Update tests with new action types
   - Enhance failure scenarios
   - Performance baseline updates

2. **Knowledge Sharing**
   - Test pattern documentation
   - Failure scenario catalog
   - Best practices guide

3. **Continuous Improvement**
   - Monthly test effectiveness review
   - Quarterly performance optimization
   - Annual architecture assessment

---

This specification provides comprehensive requirements and implementation guidelines for three critical E2E test suites that will significantly improve the Living Narrative Engine's action system reliability and robustness.
