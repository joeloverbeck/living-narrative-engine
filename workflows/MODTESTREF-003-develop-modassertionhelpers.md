# MODTESTREF-003: Develop ModAssertionHelpers

## Overview

Create specialized assertion utilities for mod test scenarios to standardize event validation, component checking, and workflow verification across 48 mod integration tests. This eliminates repetitive assertion patterns and provides reliable validation for common mod test scenarios.

## Problem Statement

### Current Assertion Duplication

Every mod test contains repetitive assertion patterns:

```javascript
// Standard action success assertions repeated everywhere
const successEvent = testEnv.events.find(
  (e) => e.eventType === 'core:display_successful_action_result'
);
expect(successEvent).toBeDefined();

const perceptibleEvent = testEnv.events.find(
  (e) => e.eventType === 'core:perceptible_event'
);
expect(perceptibleEvent).toBeDefined();

const turnEndedEvent = testEnv.events.find(
  (e) => e.eventType === 'core:turn_ended'
);
expect(turnEndedEvent).toBeDefined();

// Component addition verification for positioning
const actor = testEnv.entityManager.getEntityInstance('test:actor1');
expect(actor.components['positioning:kneeling_before']).toBeDefined();

// Message content validation
expect(successEvent.payload.message).toContain('Alice leans in to kiss');
```

### Assertion Inconsistencies

- **Event Finding**: Different approaches to finding events in test arrays
- **Error Messages**: Inconsistent error descriptions for failed assertions
- **Component Validation**: Various patterns for checking component addition/modification
- **Event Sequence**: No standardized way to validate event ordering
- **Missing Validations**: Some tests skip important assertions due to complexity

### Impact

- **240+ lines** of repetitive assertion code (5 lines × 48 files)
- **Test brittleness** from hardcoded event finding logic
- **Inconsistent validation** leading to missed edge cases
- **Maintenance burden** when event structures change

## Technical Requirements

### Assertion Helper Interface

**File Location**: `tests/common/mods/ModAssertionHelpers.js`

**Dependencies**:
```javascript
// Jest matchers
import { expect } from '@jest/globals';

// Event type constants
import { 
  DISPLAY_SUCCESSFUL_ACTION_RESULT,
  PERCEPTIBLE_EVENT,
  TURN_ENDED,
  SYSTEM_ERROR_OCCURRED 
} from '../../src/constants/eventTypes.js';

// Validation utilities
import { assertPresent } from '../../src/utils/validationCore.js';
```

### Helper Class Design

```javascript
class ModAssertionHelpers {
  // Action workflow validation
  static assertActionSuccess(events, expectedMessage = null) {
    // Validates successful action execution workflow
  }

  static assertActionFailure(events, expectedError = null) {
    // Validates action failure scenarios
  }

  static assertCompleteActionWorkflow(events, expectedFlow) {
    // Validates complete action execution sequence
  }

  // Event-specific assertions
  static assertSuccessEvent(events, expectedMessage = null) {
    // Finds and validates display_successful_action_result event
  }

  static assertPerceptibleEvent(events, expectedContent = null) {
    // Finds and validates perceptible_event
  }

  static assertTurnEndedEvent(events) {
    // Validates turn_ended event presence
  }

  static assertErrorEvent(events, expectedError = null) {
    // Validates system_error_occurred events
  }

  // Component assertions
  static assertComponentAdded(entityManager, entityId, componentId, expectedData = null) {
    // Validates component was added to entity
  }

  static assertComponentModified(entityManager, entityId, componentId, expectedChanges) {
    // Validates component data changes
  }

  static assertComponentRemoved(entityManager, entityId, componentId) {
    // Validates component was removed from entity
  }

  // Entity relationship assertions
  static assertClosenessEstablished(entityManager, actorId, targetId) {
    // Validates positioning:closeness relationship
  }

  static assertPositionChanged(entityManager, entityId, expectedPosition) {
    // Validates positioning component changes
  }

  // Event sequence validation
  static assertEventSequence(events, expectedSequence) {
    // Validates events occurred in correct order
  }

  static assertEventCount(events, eventType, expectedCount) {
    // Validates specific event type count
  }

  // Message content validation
  static assertMessageContains(event, expectedSubstring) {
    // Validates message content includes expected text
  }

  static assertMessageMatches(event, expectedPattern) {
    // Validates message content matches regex pattern
  }

  // Utility methods
  static findEventByType(events, eventType) {
    // Finds first event of specified type
  }

  static findAllEventsByType(events, eventType) {
    // Finds all events of specified type
  }

  static getEventPayload(events, eventType) {
    // Gets payload from first matching event
  }
}
```

### Core Implementation Details

**Action Success Assertion**:
```javascript
static assertActionSuccess(events, expectedMessage = null) {
  assertPresent(events, 'Events array is required');
  
  const successEvent = this.findEventByType(events, DISPLAY_SUCCESSFUL_ACTION_RESULT);
  expect(successEvent).toBeDefined();
  expect(successEvent.payload).toBeDefined();
  
  if (expectedMessage) {
    expect(successEvent.payload.message).toContain(expectedMessage);
  }
  
  // Validate related events
  this.assertPerceptibleEvent(events);
  this.assertTurnEndedEvent(events);
  
  return successEvent;
}
```

**Complete Workflow Validation**:
```javascript
static assertCompleteActionWorkflow(events, expectedFlow = {}) {
  const {
    successMessage = null,
    perceptibleContent = null,
    componentChanges = [],
    errorExpected = false
  } = expectedFlow;
  
  if (errorExpected) {
    return this.assertActionFailure(events);
  }
  
  // Validate success workflow
  const successEvent = this.assertActionSuccess(events, successMessage);
  
  if (perceptibleContent) {
    this.assertPerceptibleEvent(events, perceptibleContent);
  }
  
  // Validate component changes if specified
  componentChanges.forEach(change => {
    this.assertComponentAdded(change.entityManager, change.entityId, change.componentId, change.expectedData);
  });
  
  return {
    successEvent,
    perceptibleEvent: this.findEventByType(events, PERCEPTIBLE_EVENT),
    turnEndedEvent: this.findEventByType(events, TURN_ENDED)
  };
}
```

**Component Addition Validation**:
```javascript
static assertComponentAdded(entityManager, entityId, componentId, expectedData = null) {
  assertPresent(entityManager, 'EntityManager is required');
  assertPresent(entityId, 'Entity ID is required');
  assertPresent(componentId, 'Component ID is required');
  
  const entity = entityManager.getEntityInstance(entityId);
  expect(entity).toBeDefined();
  expect(entity.components).toBeDefined();
  
  const component = entity.components[componentId];
  expect(component).toBeDefined();
  
  if (expectedData) {
    expect(component).toMatchObject(expectedData);
  }
  
  return component;
}
```

**Event Sequence Validation**:
```javascript
static assertEventSequence(events, expectedSequence) {
  assertPresent(events, 'Events array is required');
  assertPresent(expectedSequence, 'Expected sequence is required');
  
  expect(events.length).toBeGreaterThanOrEqual(expectedSequence.length);
  
  expectedSequence.forEach((expectedType, index) => {
    expect(events[index]).toBeDefined();
    expect(events[index].eventType).toBe(expectedType);
  });
  
  return events.slice(0, expectedSequence.length);
}
```

**Smart Event Finding**:
```javascript
static findEventByType(events, eventType) {
  assertPresent(events, 'Events array is required');
  assertPresent(eventType, 'Event type is required');
  
  return events.find(event => event.eventType === eventType);
}

static findAllEventsByType(events, eventType) {
  assertPresent(events, 'Events array is required');
  assertPresent(eventType, 'Event type is required');
  
  return events.filter(event => event.eventType === eventType);
}

static getEventPayload(events, eventType) {
  const event = this.findEventByType(events, eventType);
  return event ? event.payload : null;
}
```

### Category-Specific Assertions

**Positioning-Specific Helpers**:
```javascript
static assertPositioningComponentAdded(entityManager, entityId, positionType, targetId = null) {
  const componentId = `positioning:${positionType}`;
  const component = this.assertComponentAdded(entityManager, entityId, componentId);
  
  if (targetId) {
    expect(component.target).toBe(targetId);
  }
  
  return component;
}

static assertKneelingPosition(entityManager, actorId, targetId) {
  return this.assertPositioningComponentAdded(entityManager, actorId, 'kneeling_before', targetId);
}

static assertStandingPosition(entityManager, actorId, targetId) {
  return this.assertPositioningComponentAdded(entityManager, actorId, 'standing_behind', targetId);
}
```

**Intimacy-Specific Helpers**:
```javascript
static assertIntimateActionSuccess(events, actorName, targetName, actionDescription) {
  const expectedMessage = `${actorName} ${actionDescription} ${targetName}`;
  return this.assertActionSuccess(events, expectedMessage);
}

static assertClosenessRequired(events) {
  // Validates that action failed due to lack of closeness
  const errorEvent = this.findEventByType(events, SYSTEM_ERROR_OCCURRED);
  expect(errorEvent).toBeDefined();
  expect(errorEvent.payload.error).toContain('closeness');
}
```

### Usage Patterns

**Before (manual assertions)**:
```javascript
const successEvent = testEnv.events.find(
  (e) => e.eventType === 'core:display_successful_action_result'
);
expect(successEvent).toBeDefined();
expect(successEvent.payload.message).toContain('Alice leans in to kiss');

const perceptibleEvent = testEnv.events.find(
  (e) => e.eventType === 'core:perceptible_event'
);
expect(perceptibleEvent).toBeDefined();

const turnEndedEvent = testEnv.events.find(
  (e) => e.eventType === 'core:turn_ended'
);
expect(turnEndedEvent).toBeDefined();

const actor = testEnv.entityManager.getEntityInstance('test:actor1');
expect(actor.components['positioning:kneeling_before']).toBeDefined();
```

**After (helper-based assertions)**:
```javascript
import { ModAssertionHelpers } from '../common/mods/ModAssertionHelpers.js';

// Simple success assertion
ModAssertionHelpers.assertActionSuccess(testEnv.events, 'Alice leans in to kiss');

// Complete workflow validation
ModAssertionHelpers.assertCompleteActionWorkflow(testEnv.events, {
  successMessage: 'Alice leans in to kiss',
  componentChanges: [{
    entityManager: testEnv.entityManager,
    entityId: 'test:actor1',
    componentId: 'positioning:kneeling_before'
  }]
});

// Positioning-specific assertion
ModAssertionHelpers.assertKneelingPosition(testEnv.entityManager, 'actor1', 'target1');
```

### Error Handling and Validation

```javascript
static assertActionSuccess(events, expectedMessage = null) {
  if (!Array.isArray(events)) {
    throw new Error('ModAssertionHelpers.assertActionSuccess: events must be an array');
  }
  
  if (events.length === 0) {
    throw new Error('ModAssertionHelpers.assertActionSuccess: events array cannot be empty');
  }
  
  try {
    const successEvent = this.findEventByType(events, DISPLAY_SUCCESSFUL_ACTION_RESULT);
    // ... rest of implementation
  } catch (error) {
    throw new Error(`ModAssertionHelpers.assertActionSuccess failed: ${error.message}`);
  }
}
```

## Implementation Steps

### Step 1: Create Core Helper Structure
1. Create `tests/common/mods/ModAssertionHelpers.js`
2. Implement static class with core assertion methods
3. Add basic event finding utilities: `findEventByType`, `findAllEventsByType`
4. Implement parameter validation for all public methods

### Step 2: Implement Standard Action Assertions
1. Implement `assertActionSuccess` with full workflow validation
2. Add `assertActionFailure` for error scenario testing
3. Create `assertCompleteActionWorkflow` for comprehensive validation
4. Add individual event assertions: success, perceptible, turn ended

### Step 3: Add Component Validation Methods
1. Implement `assertComponentAdded` with flexible data matching
2. Add `assertComponentModified` for component change validation
3. Create `assertComponentRemoved` for deletion scenarios
4. Add entity relationship validators for positioning/closeness

### Step 4: Create Sequence and Pattern Validators
1. Implement `assertEventSequence` for event ordering validation
2. Add `assertEventCount` for event frequency validation
3. Create message content validators with pattern matching
4. Add timing and performance assertion helpers

### Step 5: Add Category-Specific Extensions
1. Create positioning-specific assertion methods
2. Add intimacy-specific validation helpers
3. Implement sex/violence category assertions
4. Create exercise-specific validators

## Validation & Testing

### Unit Tests Required

**File**: `tests/unit/common/mods/ModAssertionHelpers.test.js`

**Test Coverage**:
```javascript
describe('ModAssertionHelpers', () => {
  describe('assertActionSuccess', () => {
    it('should find and validate success event');
    it('should validate message content when provided');
    it('should assert related perceptible and turn ended events');
    it('should throw error when success event missing');
    it('should throw error for invalid events array');
  });

  describe('assertCompleteActionWorkflow', () => {
    it('should validate complete success workflow');
    it('should handle error scenarios when errorExpected is true');
    it('should validate component changes when specified');
    it('should return event objects for further validation');
  });

  describe('assertComponentAdded', () => {
    it('should validate component existence on entity');
    it('should match component data when expectedData provided');
    it('should throw error when component missing');
    it('should throw error when entity not found');
  });

  describe('findEventByType', () => {
    it('should find first event of specified type');
    it('should return undefined when event type not found');
    it('should throw error for invalid parameters');
  });

  describe('assertEventSequence', () => {
    it('should validate events occur in correct order');
    it('should handle partial sequence validation');
    it('should throw error when sequence doesn\'t match');
  });

  describe('positioning-specific assertions', () => {
    it('should validate kneeling position component');
    it('should validate standing position component');
    it('should validate positioning target relationships');
  });
});
```

### Integration Testing
1. Test helpers with actual mod test events and entities
2. Verify assertion messages provide helpful debugging information
3. Test performance impact of helper usage vs manual assertions
4. Validate helpers work with all mod categories

### Error Scenario Testing
1. Test assertion failures provide clear error messages
2. Verify edge cases are handled gracefully
3. Test helper behavior with malformed event data
4. Validate parameter validation catches common mistakes

## Acceptance Criteria

### Functional Requirements
- [ ] All common assertion patterns abstracted into helper methods
- [ ] Helpers provide clear, actionable error messages
- [ ] Event finding logic robust and consistent
- [ ] Component validation supports flexible data matching
- [ ] Event sequence validation handles partial and complete sequences
- [ ] Category-specific helpers cover specialized assertion needs

### Quality Requirements
- [ ] 100% unit test coverage for all assertion methods
- [ ] Integration tests demonstrate helpers work with real test data
- [ ] JSDoc documentation complete for all public methods
- [ ] Error handling comprehensive with helpful messages
- [ ] Performance comparable to manual assertion patterns

### Usability Requirements
- [ ] Helper method names clearly describe their purpose
- [ ] Parameter patterns consistent across all methods
- [ ] Optional parameters provide flexibility without complexity
- [ ] Error messages guide developers to resolution

### Reliability Requirements
- [ ] Helpers reduce false positive/negative assertion failures
- [ ] Consistent validation across all mod test categories
- [ ] Robust handling of edge cases and malformed data
- [ ] No performance regression in test execution

## Success Metrics

### Code Reduction
- **Target**: Eliminate 240+ lines of repetitive assertion code
- **Measurement**: Line count comparison in assertion sections
- **Success**: >70% reduction in manual assertion code

### Test Reliability Improvement
- **Target**: More consistent and reliable test assertions
- **Measurement**: Test failure rates due to assertion issues
- **Success**: 60%+ reduction in assertion-related test failures

### Developer Experience Improvement
- **Target**: Faster test writing with clearer error messages
- **Measurement**: Developer feedback and test writing time
- **Success**: 40%+ reduction in time to write and debug assertions

### Maintenance Improvement
- **Target**: Single location for assertion pattern updates
- **Measurement**: Time to update assertion patterns across tests
- **Success**: Update time reduced from hours to minutes

## Integration Points

### ModEntityBuilder Integration
- Helpers must validate entities created by MODTESTREF-002
- Component assertions must work with builder-created entities

### ModTestHandlerFactory Integration
- Assertions must validate events from handlers created by MODTESTREF-001
- Helper methods must understand handler event patterns

### ModActionTestBase Integration
- Base classes from MODTESTREF-004 will use helpers for standard assertions
- Helpers must support inheritance and customization

## Next Steps

Upon completion, these helpers will be ready for:
1. **MODTESTREF-004**: Integration with ModActionTestBase and ModRuleTestBase classes
2. **MODTESTREF-005**: Usage in ModTestFixture factory for automated validation
3. **MODTESTREF-007**: Migration of assertion patterns in all 48 test files
4. **Future**: Extension for new mod categories and assertion patterns

This helper library will standardize assertion patterns across all mod integration tests and provide a reliable foundation for test validation as the project scales to thousands of mod test files.