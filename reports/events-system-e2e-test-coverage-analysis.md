# Events System E2E Test Coverage Analysis

## Executive Summary

This report analyzes the event system architecture in the Living Narrative Engine, identifies existing workflows, assesses current test coverage, and provides prioritized recommendations for end-to-end test creation.

**Critical Finding**: The events system has **LIMITED end-to-end test coverage** despite being a core architectural component that handles all inter-system communication. While a comprehensive lifecycle test exists (`completeEventLifecycle.e2e.test.js`), specialized workflow scenarios remain untested.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Identified Workflows](#identified-workflows)
3. [Current Test Coverage](#current-test-coverage)
4. [Existing E2E Test Coverage](#existing-e2e-test-coverage)
5. [Coverage Gap Analysis](#coverage-gap-analysis)
6. [Prioritized E2E Test Recommendations](#prioritized-e2e-test-recommendations)
7. [Implementation Guidelines](#implementation-guidelines)

## Architecture Overview

### Core Components

The events system consists of four main components in a layered architecture:

```
Application Layer
     ↓
SafeEventDispatcher (Error handling & logging)
     ↓
ValidatedEventDispatcher (Schema validation)
     ↓
EventBus (Core pub/sub mechanism)
     ↓
EventDispatchTracer (Monitoring & tracing)
```

### Key Files

- **`src/events/eventBus.js`**: Core event bus with pub/sub, recursion prevention, batch mode
- **`src/events/validatedEventDispatcher.js`**: Schema validation layer for event payloads
- **`src/events/safeEventDispatcher.js`**: Error handling wrapper preventing exceptions
- **`src/events/tracing/eventDispatchTracer.js`**: Event tracing and monitoring

## Identified Workflows

### 1. Basic Event Dispatch Workflow
```
Component → dispatch(event) → SafeEventDispatcher → ValidatedEventDispatcher → EventBus → Listeners
```
- **Purpose**: Standard event publishing with validation and error handling
- **Used By**: All components that emit events
- **Critical Events**: `core:component_added`, `core:component_removed`, `core:entity_created`

### 2. Batch Mode Workflow
```
GameEngine → setBatchMode(true) → EventBus → Adjusted recursion limits → Bulk operations → setBatchMode(false)
```
- **Purpose**: Handle high-volume events during game initialization
- **Context**: Loading saved games, initializing large entity sets
- **Configuration**: 
  - Default limits: 10 recursion depth, 25 global recursion
  - Customizable via `maxRecursionDepth` and `maxGlobalRecursion` options
  - Higher limits for workflow events (25 depth) and component lifecycle (100 depth)
- **Safety**: Auto-timeout after 30 seconds (configurable via `timeoutMs`)

### 3. Recursion Prevention Workflow
```
Event A → Handler → Event B → Handler → Event A (blocked at depth limit)
```
- **Purpose**: Prevent infinite loops and stack overflow
- **Limits** (dynamically determined by event type): 
  - Normal mode:
    - Standard events: 10 depth per event, 200 global
    - Workflow events: 20 depth per event, 200 global
    - Component lifecycle: 100 depth (special case)
  - Batch mode (configurable):
    - Default: 10 depth, 25 global
    - Workflow events: 25 depth
    - Component lifecycle: 100 depth
    - Can be customized via `maxRecursionDepth` and `maxGlobalRecursion` options

### 4. Wildcard Subscription Workflow
```
subscribe('*', handler) → Receives ALL events → Universal monitoring/logging
```
- **Purpose**: Global event monitoring, debugging, analytics
- **Use Cases**: Alert router, system monitoring, debug logging

### 5. Error Event Workflow
```
Error occurs → dispatch('core:system_error_occurred') → SafeEventDispatcher (console logging) → Alert system
```
- **Purpose**: Error reporting without recursion
- **Special Handling**: Uses console.error to prevent logger recursion

### 6. Turn Management Workflow  
```
TurnManager → dispatch('core:turn_started') → Actor handlers → dispatch('core:turn_ended') → Next turn
```
- **Purpose**: Game turn lifecycle management
- **Events**: `turn_started`, `turn_processing_started`, `turn_processing_ended`, `turn_ended`, `player_turn_prompt`, `action_decided`, `attempt_action`
- **Special Handling**: Workflow events receive elevated recursion limits (20 in normal mode, 25 in batch mode) to allow legitimate game loops
- **Event Classification**: These are classified as "workflow events" and tracked separately from standard events

### 7. Component Mutation Workflow
```
Various Systems → Component operations → dispatch('core:component_added') → Systems react
```
- **Purpose**: Entity component lifecycle notifications
- **Events**: `core:component_added`, `core:component_removed`
- **Note**: Component events are dispatched by multiple systems throughout the codebase, not just ComponentMutationService
- **Special Handling**: Component lifecycle events have elevated recursion limits (100) to handle deep component hierarchies

### 8. Validation Failure Workflow
```
dispatch(invalid_event) → ValidatedEventDispatcher → Schema validation fails → Log error → Block dispatch
```
- **Purpose**: Prevent invalid events from propagating
- **Validation Process**:
  - ValidatedEventDispatcher checks event against loaded schemas from GameDataRepository
  - Uses AJV-based SchemaValidator for JSON Schema validation
  - Returns validation result with detailed error messages if validation fails
- **Outcome**: Event blocked, error logged with schema validation details

### 9. Event Tracing Workflow
```
Event dispatch → EventDispatchTracer → Create trace → Capture timing → Write to storage
```
- **Purpose**: Performance monitoring and debugging
- **Data**: Event name, payload, timing, success/failure

### 10. Initialization Bootstrap Workflow
```
System startup → Bootstrap events (before schemas loaded) → Special handling → Normal operation
```
- **Purpose**: Handle critical events during system initialization
- **Special Events**: `core:system_error_occurred`, `core:critical_notification_shown`
- **Bootstrap Handling**: 
  - These events can be dispatched before schemas are fully loaded
  - ValidatedEventDispatcher has special logic to allow these events through without validation
  - Ensures error reporting works even during early initialization phases

## Current Test Coverage

### Unit Tests (23 files)
- **Location**: `tests/unit/events/`
- **Coverage**: Good unit-level coverage of individual components
- **Focus**: Validation, error handling, interface compliance

### Integration Tests (7 files)
- **Location**: `tests/integration/events/`
- **Coverage**: Limited integration scenarios
- **Focus**: Batch mode, recursion warnings, lifecycle events

### Performance Tests (1 file)
- **Location**: `tests/performance/events/`
- **Coverage**: Only `attemptActionEventSchemaPerformance.test.js`
- **Gap**: No performance tests for dispatch throughput, recursion overhead

### E2E Tests (1 file)
- **Location**: `tests/e2e/events/`
- **Coverage**: **PARTIAL END-TO-END COVERAGE**
- **Existing Test**: `completeEventLifecycle.e2e.test.js` (579 lines, comprehensive lifecycle testing)
- **Gap**: Missing specialized workflow tests for batch mode, recursion prevention, and error handling

### Memory Tests (0 files)
- **Location**: `tests/memory/events/` (DOES NOT EXIST)
- **Coverage**: **NO MEMORY LEAK TESTING**
- **Risk**: Potential memory leaks in event listeners

## Existing E2E Test Coverage

### Complete Event Lifecycle E2E Test ✅ IMPLEMENTED
**File**: `tests/e2e/events/completeEventLifecycle.e2e.test.js` (579 lines)

#### What This Test Covers:
1. **Event System Initialization**
   - EventBus initialization and configuration
   - Core event schema loading and validation
   - Batch mode support and configuration

2. **Event Registration and Subscription**
   - Listener subscription and unsubscription
   - Invalid subscription handling
   - Multiple listeners for different event types

3. **Event Dispatch Flow**
   - Schema validation during dispatch
   - Synchronous and asynchronous event handlers
   - Proper handler execution order

4. **Complex Event Chains**
   - Cascading entity lifecycle events (`ENTITY_CREATED_ID` → `COMPONENT_ADDED_ID` → `COMPONENT_REMOVED_ID` → `ENTITY_REMOVED_ID`)
   - Entity speech event scenarios with multiple targets
   - Turn-based event sequencing (`TURN_STARTED_ID` → `ATTEMPT_ACTION_ID` → `ACTION_DECIDED_ID` → `TURN_ENDED_ID`)

5. **Error Handling and Recovery**
   - Invalid event dispatch handling
   - Handler failure recovery (one handler fails, others continue)
   - Basic recursion protection testing

6. **Cleanup and Resource Management**
   - Listener cleanup verification
   - Batch mode state management
   - Resource cleanup during active event processing

#### Test Quality Assessment:
- **Comprehensiveness**: High - covers core event system functionality end-to-end
- **Real-world Scenarios**: Good - tests actual game event patterns
- **Error Scenarios**: Adequate - basic error handling tested
- **Performance**: Limited - no performance or load testing

#### Implementation Approach:
- Uses direct component instantiation (EventBus, ConsoleLogger)
- Simplified schema validation (minimal AJV setup)
- Mock event handlers using Jest functions
- Event capture via wildcard subscription for verification

## Coverage Gap Analysis

### Critical Gaps (Priority 1)
1. **Missing specialized workflow tests** - Batch mode, recursion prevention, validation failure workflows lack dedicated E2E coverage
2. **No multi-system event flows** - Cross-component interactions beyond basic event chains unvalidated
3. **Limited error recovery scenarios** - Advanced system resilience testing needed beyond basic handler failure
4. **No performance under load** - Scalability and high-volume dispatch testing missing

### Major Gaps (Priority 2)
1. **Memory leak testing** - Listener cleanup unverified
2. **Concurrent dispatch handling** - Race conditions possible
3. **Tracing system integration** - Monitoring untested
4. **Schema migration scenarios** - Evolution handling unclear

### Minor Gaps (Priority 3)
1. **Edge case handling** - Unusual event patterns
2. **Documentation tests** - API contract validation
3. **Cross-browser compatibility** - Browser-specific issues

## Prioritized E2E Test Recommendations

### Priority 1: Critical Workflow Tests (MUST HAVE)

#### ✅ 1. Complete Event Lifecycle E2E Test - IMPLEMENTED
**File**: `tests/e2e/events/completeEventLifecycle.e2e.test.js`
**Status**: ✅ **ALREADY EXISTS** (579 lines of comprehensive testing)
**Coverage**: Event initialization, subscription, dispatch, complex chains, error handling, cleanup

#### 2. Batch Mode Game Loading E2E Test
**File**: `tests/e2e/events/BatchModeGameLoading.e2e.test.js`
```javascript
- Load complex game state with 100+ entities
- Verify batch mode enables/disables correctly
- Confirm no recursion warnings for legitimate bulk ops
- Validate timeout safety mechanism
```

#### 3. Recursion Prevention E2E Test
**File**: `tests/e2e/events/RecursionPrevention.e2e.test.js`
```javascript
- Create intentional event loops
- Verify recursion limits enforced
- Test different event type limits
- Confirm error messages and recovery
```

#### 4. Error Event Handling E2E Test
**File**: `tests/e2e/events/ErrorEventHandling.e2e.test.js`
```javascript
- Trigger system errors
- Verify error events don't cause recursion
- Test console fallback mechanism
- Validate error propagation to UI
```

#### 5. Turn Management Event Flow E2E Test
**File**: `tests/e2e/events/TurnManagementFlow.e2e.test.js`
```javascript
- Complete turn cycle with multiple actors
- Verify event sequence correctness
- Test turn interruption scenarios
- Validate state consistency
```

### Priority 2: System Integration Tests (SHOULD HAVE)

#### 6. Component Mutation Events E2E Test
**File**: `tests/e2e/events/ComponentMutationEvents.e2e.test.js`
```javascript
- Add/remove components on entities
- Verify event dispatch and handler reactions
- Test bulk component operations
- Validate index updates
```

#### 7. Multi-System Event Cascade E2E Test
**File**: `tests/e2e/events/MultiSystemCascade.e2e.test.js`
```javascript
- Action → Entity update → Component change → System reaction
- Verify complete cascade execution
- Test cascade interruption
- Validate final state
```

#### 8. Wildcard Subscription Monitoring E2E Test
**File**: `tests/e2e/events/WildcardMonitoring.e2e.test.js`
```javascript
- Subscribe to all events with wildcard
- Verify receipt of all event types
- Test filtering and routing
- Validate monitoring overhead
```

#### 9. Validation Failure Recovery E2E Test
**File**: `tests/e2e/events/ValidationFailureRecovery.e2e.test.js`
```javascript
- Dispatch invalid events
- Verify validation blocks propagation
- Test error reporting
- Confirm system continues normally
```

#### 10. Event Tracing Integration E2E Test
**File**: `tests/e2e/events/EventTracingIntegration.e2e.test.js`
```javascript
- Enable tracing for event flow
- Verify trace data accuracy
- Test performance impact
- Validate storage and retrieval
```

### Priority 3: Performance and Reliability Tests (NICE TO HAVE)

#### 11. High Volume Event Throughput E2E Test
**File**: `tests/e2e/events/HighVolumeThroughput.e2e.test.js`
```javascript
- Dispatch 1000+ events rapidly
- Measure throughput and latency
- Test queue behavior
- Verify no event loss
```

#### 12. Concurrent Event Dispatch E2E Test
**File**: `tests/e2e/events/ConcurrentDispatch.e2e.test.js`
```javascript
- Multiple simultaneous dispatches
- Test race conditions
- Verify event ordering
- Validate handler safety
```

#### 13. Memory Leak Detection E2E Test
**File**: `tests/e2e/events/MemoryLeakDetection.e2e.test.js`
```javascript
- Subscribe/unsubscribe repeatedly
- Monitor memory usage
- Test listener cleanup
- Verify no retention
```

#### 14. Event System Recovery E2E Test
**File**: `tests/e2e/events/SystemRecovery.e2e.test.js`
```javascript
- Simulate handler failures
- Test circuit breaker behavior
- Verify system recovery
- Validate state consistency
```

#### 15. Cross-Module Event Communication E2E Test
**File**: `tests/e2e/events/CrossModuleCommunication.e2e.test.js`
```javascript
- Events between different mods
- Test namespace handling
- Verify isolation
- Validate mod interactions
```

## Implementation Guidelines

### Test Structure Template

```javascript
/**
 * @file [TestName].e2e.test.js
 * @description End-to-end test for [workflow description]
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventSystemTestBed } from '../common/eventSystemTestBed.js';

describe('[Workflow Name] E2E', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new EventSystemTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('[Scenario]', () => {
    it('should [expected behavior]', async () => {
      // Arrange
      const events = await testBed.setupScenario();
      
      // Act
      const result = await testBed.executeWorkflow();
      
      // Assert
      expect(result).toMatchExpectedBehavior();
      await testBed.verifyEventSequence();
      await testBed.verifySystemState();
    });
  });
});
```

### Common Test Bed Requirements

Create `tests/e2e/events/common/eventSystemTestBed.js`:

```javascript
import { IntegrationTestBed } from '../../../common/integrationTestBed.js';

export class EventSystemTestBed extends IntegrationTestBed {
  async initialize() {
    await super.initialize();
    // Additional event-specific setup
    // Setup event monitoring and tracing
  }

  async setupScenario() {
    // Create test entities
    // Configure event handlers
    // Setup expected behaviors
  }

  async executeWorkflow() {
    // Trigger workflow
    // Capture events
    // Record timing
  }

  async verifyEventSequence() {
    // Check event order
    // Validate payloads
    // Verify handler execution
  }

  async cleanup() {
    // Remove listeners
    // Clear state
    await super.cleanup();
  }
}
```

**Note**: Leverage existing test bed infrastructure from `tests/common/` including:
- `IntegrationTestBed` for full DI container setup
- `BaseTestBed` for common test utilities
- Other specialized test beds as reference patterns

### Testing Best Practices

1. **Isolation**: Each test should be independent
2. **Determinism**: Tests must be reproducible
3. **Timing**: Use proper async/await patterns
4. **Validation**: Check both positive and negative cases
5. **Documentation**: Clear descriptions of what's being tested
6. **Performance**: Keep tests fast (< 5 seconds each)

## Conclusion

The events system is a critical architectural component with **partial E2E test coverage**. While a comprehensive lifecycle test already exists, specialized workflow testing represents remaining gaps that could impact system reliability and maintainability.

**Current Status**: 
✅ **Complete Event Lifecycle E2E Test** - IMPLEMENTED (579 lines of comprehensive testing)

**Immediate Action Required**:
1. Implement remaining Priority 1 tests (2-5) for specialized workflows
2. Add Priority 2 tests (6-10) within the next sprint  
3. Consider Priority 3 tests (11-15) for comprehensive coverage

**Expected Benefits**:
- Reduced production bugs
- Faster development cycles
- Improved system reliability
- Better documentation through tests
- Easier refactoring

## Appendix: Event Catalog

### Core System Events
- `core:system_error_occurred`
- `core:critical_notification_shown`
- `core:component_added`
- `core:component_removed`
- `core:entity_created`
- `core:entity_removed`

### Turn Management Events
- `core:turn_started`
- `core:turn_processing_started`
- `core:turn_processing_ended`
- `core:turn_ended`
- `core:player_turn_prompt`
- `core:action_decided`
- `core:attempt_action`

### Game State Events
- `core:game_loaded`
- `core:game_saved`
- `core:state_changed`

---

*Report Generated: 2025-09-12*
*Author: Claude Code Analysis System*
*Version: 1.0*