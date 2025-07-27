# Multi-Target Action Event System Implementation Specification

## Version 1.0 - Bridging the Formatting-Event Gap

### Executive Summary

This specification addresses the critical architectural gap identified in the Living Narrative Engine between the sophisticated multi-target action formatting system and the limited single-target event/rules system. While the engine can format complex multi-target actions like "adjust Alice's red dress", the event system currently only passes a single target to rules, preventing proper execution of these actions.

**The core issue**: Multi-target data flows through the formatting pipeline but is lost at the command processor bottleneck, preventing rules from accessing all necessary targets for proper action execution.

### Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Problem Statement](#problem-statement)
3. [Solution Architecture](#solution-architecture)
4. [Schema Enhancements](#schema-enhancements)
5. [Command Processor Updates](#command-processor-updates)
6. [Rules System Integration](#rules-system-integration)
7. [Backward Compatibility Strategy](#backward-compatibility-strategy)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Testing Strategy](#testing-strategy)
10. [Migration Guide](#migration-guide)
11. [Performance Considerations](#performance-considerations)

## Current Architecture Analysis

### ✅ Working Components

#### Multi-Target Action Formatting System
The formatting system is fully functional:

- **MultiTargetActionFormatter**: Supports multi-placeholder templates
- **ActionFormattingStage**: Extracts `targetIds` from resolved data
- **Target Resolution**: Generates complex target combinations
- **Template Processing**: Creates rich formatted actions

**Example Working Flow**:
```javascript
// Input template: "adjust {person}'s {clothing}"
// Resolved targets: { person: [alice_entity], clothing: [red_dress_entity] }
// Formatted output: "adjust Alice's red dress"
// Action params: { 
//   targetIds: { person: ["alice_123"], clothing: ["dress_456"] },
//   isMultiTarget: true 
// }
```

### ❌ Gap Components

#### Single-Target Event System
The event system is limited to single targets:

**Event Schema** (`attempt_action.event.json`):
```json
{
  "eventName": "core:attempt_action",
  "actorId": "string (required)",
  "actionId": "string (required)", 
  "targetId": "string (optional)",     // ← SINGLE TARGET ONLY
  "originalInput": "string (required)"
}
```

**Command Processor Bottleneck** (`commandProcessor.js:186-196`):
```javascript
#createAttemptActionPayload(actor, turnAction) {
  const { actionDefinitionId, resolvedParameters, commandString } = turnAction;
  return {
    eventName: ATTEMPT_ACTION_ID,
    actorId: actor.id,
    actionId: actionDefinitionId,
    targetId: resolvedParameters?.targetId || null,  // ← SINGLE TARGET ONLY
    originalInput: commandString || actionDefinitionId,
  };
}
```

#### Rules System Limitation
All rules can only access single targets:

```json
{
  "event_type": "core:attempt_action",
  "actions": [
    {
      "type": "CHECK_FOLLOW_CYCLE",
      "parameters": {
        "follower_id": "{event.payload.actorId}",
        "leader_id": "{event.payload.targetId}"    // ← SINGLE TARGET ACCESS
      }
    }
  ]
}
```

## Problem Statement

### Data Flow Disconnect

```
1. Action Discovery Pipeline
   ├── MultiTargetResolutionStage → Resolves multiple targets ✅
   ├── ActionFormattingStage → Formats with multiple placeholders ✅
   └── Creates action with targetIds: { person: ["alice"], clothing: ["dress"] } ✅

2. Command Processing
   ├── CommandProcessor receives formatted action ✅
   ├── Takes ONLY primary target: resolvedParameters?.targetId ❌
   └── Creates event payload with single targetId: "alice" ❌

3. Rule Processing  
   ├── Rules receive attempt_action event ❌
   ├── Can ONLY access {event.payload.targetId}: "alice" ❌
   └── Cannot access secondary target "dress" ❌
```

### Impact Examples

1. **"adjust Alice's red dress"**
   - ✅ Formatted correctly
   - ❌ Rules cannot determine which dress to adjust

2. **"throw knife at goblin"**
   - ✅ Formatted correctly  
   - ❌ Rules cannot determine throw target

3. **"give coin to merchant"**
   - ✅ Formatted correctly
   - ❌ Rules cannot determine recipient

## Solution Architecture

### Enhanced Event System Design

```
Multi-Target Data Flow (Enhanced)

1. Action Discovery Pipeline
   ├── MultiTargetResolutionStage → Resolves multiple targets ✅
   ├── ActionFormattingStage → Formats with multiple placeholders ✅
   └── Creates action with targetIds: { person: ["alice"], clothing: ["dress"] } ✅

2. Enhanced Command Processing
   ├── CommandProcessor receives formatted action ✅
   ├── Extracts ALL targets from resolvedParameters.targetIds ✅ NEW
   └── Creates event payload with targets object AND backward-compatible targetId ✅ NEW

3. Enhanced Rule Processing
   ├── Rules receive attempt_action event with targets object ✅ NEW
   ├── Can access {event.payload.targets.person}: "alice" ✅ NEW
   ├── Can access {event.payload.targets.clothing}: "dress" ✅ NEW
   └── Can access {event.payload.targetId}: "alice" for backward compatibility ✅ NEW
```

### Component Interaction Diagram

```
┌─────────────────────────┐    ┌──────────────────────────┐
│   ActionFormattingStage │    │    CommandProcessor      │
│                         │    │                          │
│ Multi-target formatting │───▶│ Enhanced payload creation│
│ - targetIds extraction  │    │ - Multi-target support   │
│ - Template substitution │    │ - Backward compatibility │
└─────────────────────────┘    └──────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────┐    ┌──────────────────────────┐
│      Event Bus          │    │     Enhanced Event       │
│                         │    │                          │
│ Event distribution      │◀───│ - targets: {}           │
│ - Multi-target events   │    │ - targetId (legacy)     │
│ - Backward compatibility│    │ - Full context          │
└─────────────────────────┘    └──────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│     Rules System        │
│                         │
│ Enhanced target access  │
│ - Multi-target patterns │
│ - Legacy compatibility  │
│ - Context-aware logic   │
└─────────────────────────┘
```

## Schema Enhancements

### Enhanced Event Schema

**File**: `data/mods/core/events/attempt_action.event.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "core:attempt_action",
  "eventName": "core:attempt_action",
  "description": "Enhanced event for both single and multi-target actions",
  "dataSchema": {
    "type": "object",
    "properties": {
      "eventName": {
        "type": "string",
        "const": "core:attempt_action"
      },
      "actorId": {
        "type": "string",
        "description": "ID of the entity performing the action"
      },
      "actionId": {
        "type": "string", 
        "description": "ID of the action being performed"
      },
      "targets": {
        "type": "object",
        "description": "Multi-target structure with named targets",
        "additionalProperties": {
          "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
        },
        "examples": [
          {
            "primary": "entity_123",
            "secondary": "entity_456"
          },
          {
            "person": "alice_789",
            "clothing": "dress_012"
          },
          {
            "item": "knife_345",
            "target": "goblin_678"
          }
        ]
      },
      "targetId": {
        "type": ["string", "null"],
        "description": "Primary target for backward compatibility with legacy rules",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "originalInput": {
        "type": "string",
        "description": "Original command text entered by user"
      },
      "timestamp": {
        "type": "number",
        "description": "Event creation timestamp"
      }
    },
    "required": ["eventName", "actorId", "actionId", "originalInput"],
    "additionalProperties": false
  }
}
```

### Multi-Target Validation Rules

```json
{
  "allOf": [
    {
      "description": "Must have either targets object or legacy targetId",
      "anyOf": [
        { "required": ["targets"] },
        { "required": ["targetId"] }
      ]
    },
    {
      "description": "If targets exist, targetId should be primary target",
      "if": {
        "properties": {
          "targets": { "type": "object" }
        },
        "required": ["targets"]
      },
      "then": {
        "properties": {
          "targetId": {
            "description": "Should match primary target when targets object exists"
          }
        }
      }
    }
  ]
}
```

## Command Processor Updates

### Enhanced Payload Creation

**File**: `src/commands/commandProcessor.js`

**Current Implementation** (Lines 186-196):
```javascript
#createAttemptActionPayload(actor, turnAction) {
  const { actionDefinitionId, resolvedParameters, commandString } = turnAction;
  return {
    eventName: ATTEMPT_ACTION_ID,
    actorId: actor.id,
    actionId: actionDefinitionId,
    targetId: resolvedParameters?.targetId || null,  // ← SINGLE TARGET
    originalInput: commandString || actionDefinitionId,
  };
}
```

**Enhanced Implementation**:
```javascript
#createAttemptActionPayload(actor, turnAction) {
  const { actionDefinitionId, resolvedParameters, commandString } = turnAction;
  
  // Extract multi-target data from formatting stage
  const multiTargetData = this.#extractMultiTargetData(resolvedParameters);
  
  const payload = {
    eventName: ATTEMPT_ACTION_ID,
    actorId: actor.id,
    actionId: actionDefinitionId,
    originalInput: commandString || actionDefinitionId,
    timestamp: Date.now()
  };

  // Add multi-target support
  if (multiTargetData.hasMultipleTargets) {
    payload.targets = multiTargetData.targets;
    payload.targetId = multiTargetData.primaryTarget; // Backward compatibility
  } else {
    // Legacy single-target behavior
    payload.targetId = resolvedParameters?.targetId || null;
  }

  return payload;
}

#extractMultiTargetData(resolvedParameters) {
  // Check if this came from multi-target formatting
  if (resolvedParameters?.targetIds && typeof resolvedParameters.targetIds === 'object') {
    const targets = {};
    let primaryTarget = null;

    // Extract all targets from the targetIds object
    for (const [key, targetList] of Object.entries(resolvedParameters.targetIds)) {
      if (Array.isArray(targetList) && targetList.length > 0) {
        targets[key] = targetList[0]; // Take first target from each category
        
        // Set primary target (prefer 'primary' key, fallback to first key)
        if (key === 'primary' || primaryTarget === null) {
          primaryTarget = targetList[0];
        }
      }
    }

    return {
      hasMultipleTargets: Object.keys(targets).length > 1,
      targets,
      primaryTarget
    };
  }

  // Handle legacy single-target case
  return {
    hasMultipleTargets: false,
    targets: {},
    primaryTarget: resolvedParameters?.targetId || null
  };
}
```

### Target Data Extraction Logic

```javascript
/**
 * Extracts target data from the action formatting stage output
 * 
 * @param {Object} resolvedParameters - Parameters from action formatting
 * @param {Object} resolvedParameters.targetIds - Multi-target data from formatting
 * @param {string} resolvedParameters.targetId - Legacy single target
 * @param {boolean} resolvedParameters.isMultiTarget - Multi-target flag
 * @returns {Object} Structured target data
 */
#extractMultiTargetData(resolvedParameters) {
  const logger = this.#logger;
  
  // Validate input
  if (!resolvedParameters) {
    logger.debug('No resolved parameters provided');
    return { hasMultipleTargets: false, targets: {}, primaryTarget: null };
  }

  // Multi-target path
  if (resolvedParameters.isMultiTarget && resolvedParameters.targetIds) {
    try {
      const targets = this.#processTargetIds(resolvedParameters.targetIds);
      const primaryTarget = this.#determinePrimaryTarget(targets);
      
      logger.debug('Extracted multi-target data', { 
        targetCount: Object.keys(targets).length,
        primaryTarget,
        targets 
      });

      return {
        hasMultipleTargets: Object.keys(targets).length > 1,
        targets,
        primaryTarget
      };
    } catch (error) {
      logger.error('Failed to extract multi-target data', error);
      // Fall back to legacy behavior
    }
  }

  // Legacy single-target path
  const legacyTarget = resolvedParameters.targetId || null;
  logger.debug('Using legacy single-target data', { targetId: legacyTarget });

  return {
    hasMultipleTargets: false,
    targets: legacyTarget ? { primary: legacyTarget } : {},
    primaryTarget: legacyTarget
  };
}

#processTargetIds(targetIds) {
  const targets = {};
  
  for (const [key, targetList] of Object.entries(targetIds)) {
    if (Array.isArray(targetList) && targetList.length > 0) {
      // Take the first target from each category
      // Note: Combination generation should handle multiple targets per category
      targets[key] = targetList[0];
    } else if (typeof targetList === 'string') {
      // Handle single target as string
      targets[key] = targetList;
    }
  }
  
  return targets;
}

#determinePrimaryTarget(targets) {
  // Prefer explicit 'primary' key
  if (targets.primary) {
    return targets.primary;
  }
  
  // Fallback to first available target
  const firstKey = Object.keys(targets)[0];
  return firstKey ? targets[firstKey] : null;
}
```

## Rules System Integration

### Multi-Target Rule Access Patterns

#### Pattern 1: Backward Compatible Access
```json
{
  "id": "example:legacy_compatible_rule",
  "event_type": "core:attempt_action",
  "conditions": [
    {
      "description": "Works with both legacy and multi-target events",
      "logic": {
        "!=": [
          {"var": "event.payload.targets.primary"},
          null
        ]
      }
    }
  ],
  "actions": [
    {
      "type": "modifyComponent",
      "parameters": {
        "entityId": "{event.payload.targets.primary || event.payload.targetId}",
        "componentId": "core:health",
        "changes": {
          "current": {"math": ["-", {"var": "current"}, 5]}
        }
      }
    }
  ]
}
```

#### Pattern 2: Multi-Target Specific Access
```json
{
  "id": "example:multi_target_rule",
  "event_type": "core:attempt_action",
  "conditions": [
    {
      "description": "Requires both item and target",
      "logic": {
        "and": [
          {"!=": [{"var": "event.payload.targets.item"}, null]},
          {"!=": [{"var": "event.payload.targets.target"}, null]}
        ]
      }
    }
  ],
  "actions": [
    {
      "type": "transferItem",
      "parameters": {
        "itemId": "{event.payload.targets.item}",
        "fromEntityId": "{event.payload.actorId}",
        "toEntityId": "{event.payload.targets.target}"
      }
    }
  ]
}
```

#### Pattern 3: Conditional Multi-Target Access
```json
{
  "id": "example:flexible_target_rule", 
  "event_type": "core:attempt_action",
  "conditions": [
    {
      "description": "Handle both single and multi-target scenarios",
      "logic": {
        "or": [
          {"!=": [{"var": "event.payload.targetId"}, null]},
          {"!=": [{"var": "event.payload.targets.primary"}, null]}
        ]
      }
    }
  ],
  "actions": [
    {
      "type": "conditionalAction",
      "parameters": {
        "primaryTarget": "{event.payload.targets.primary || event.payload.targetId}",
        "secondaryTarget": "{event.payload.targets.secondary}",
        "hasMultipleTargets": "{event.payload.targets && Object.keys(event.payload.targets).length > 1}"
      }
    }
  ]
}
```

### Rule Helper Functions

To simplify multi-target rule creation, we can provide helper operations:

```json
{
  "customOperations": {
    "getTarget": {
      "description": "Get target by name with fallback to primary/legacy",
      "parameters": {
        "targetName": "string",
        "fallbackToLegacy": "boolean"
      },
      "logic": {
        "if": [
          {"!=": [{"var": "event.payload.targets"}, null]},
          {"var": ["event.payload.targets", {"var": "targetName"}]},
          {"if": [
            {"var": "fallbackToLegacy"},
            {"var": "event.payload.targetId"},
            null
          ]}
        ]
      }
    },
    "hasMultipleTargets": {
      "description": "Check if event has multiple targets",
      "logic": {
        "and": [
          {"!=": [{"var": "event.payload.targets"}, null]},
          {">": [{"length": {"objectKeys": {"var": "event.payload.targets"}}}, 1]}
        ]
      }
    }
  }
}
```

## Backward Compatibility Strategy

### Compatibility Guarantees

1. **Existing Rules**: All existing single-target rules continue to work unchanged
2. **Event Structure**: Legacy `targetId` field maintained for backward compatibility
3. **Validation**: Enhanced validation ensures legacy events remain valid
4. **Performance**: No performance regression for existing single-target actions

### Compatibility Implementation

#### Legacy Event Support
```javascript
// In rule processing, both patterns work:

// Legacy pattern (continues to work)
const target = event.payload.targetId;

// Enhanced pattern (new capability)
const primaryTarget = event.payload.targets?.primary || event.payload.targetId;
const secondaryTarget = event.payload.targets?.secondary;
```

#### Migration Path
```javascript
// Phase 1: Rules work with both legacy and enhanced events
{
  "parameters": {
    "target": "{event.payload.targets.primary || event.payload.targetId}"
  }
}

// Phase 2: Rules can utilize multi-target capabilities
{
  "parameters": {
    "primaryTarget": "{event.payload.targets.primary || event.payload.targetId}",
    "secondaryTarget": "{event.payload.targets.secondary}",
    "allTargets": "{event.payload.targets}"
  }
}
```

### Validation Strategy

```javascript
/**
 * Validates event payload for both legacy and enhanced formats
 */
function validateAttemptActionPayload(payload) {
  const errors = [];
  
  // Required fields
  if (!payload.eventName || !payload.actorId || !payload.actionId) {
    errors.push('Missing required fields');
  }
  
  // Must have either targets or targetId
  if (!payload.targets && !payload.targetId) {
    errors.push('Must specify either targets object or legacy targetId');
  }
  
  // If targets exist, validate structure
  if (payload.targets) {
    if (typeof payload.targets !== 'object') {
      errors.push('targets must be an object');
    } else {
      // Validate target IDs
      for (const [key, targetId] of Object.entries(payload.targets)) {
        if (typeof targetId !== 'string' || !targetId.trim()) {
          errors.push(`Invalid target ID for ${key}`);
        }
      }
    }
  }
  
  // Consistency check: targetId should match primary target
  if (payload.targets && payload.targetId) {
    const primaryTarget = payload.targets.primary || Object.values(payload.targets)[0];
    if (primaryTarget !== payload.targetId) {
      // This is a warning, not an error, for flexibility
      console.warn('targetId does not match primary target in targets object');
    }
  }
  
  return { isValid: errors.length === 0, errors };
}
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Priority: Critical - Must Fix**

#### Week 1: Schema and Validation
- [ ] **Update Event Schema** (`attempt_action.event.json`)
  - Add `targets` object with validation rules
  - Maintain backward-compatible `targetId` field
  - Add schema documentation and examples
  - Validate schema with existing event data

- [ ] **Create Validation Tests**
  - Test legacy event format compatibility
  - Test enhanced event format validation
  - Test edge cases and error conditions
  - Performance test with large target sets

#### Week 2: Command Processor Enhancement
- [ ] **Enhance CommandProcessor** (`commandProcessor.js`)
  - Implement `#extractMultiTargetData()` method
  - Update `#createAttemptActionPayload()` for multi-target support
  - Add error handling and logging
  - Ensure backward compatibility

- [ ] **Add Unit Tests**
  - Test multi-target data extraction
  - Test legacy compatibility
  - Test error handling and edge cases
  - Test payload creation with various input formats

### Phase 2: Rule Enhancement (Week 3-4)
**Priority: System Enhancement**

#### Week 3: Core Rule Updates
- [ ] **Update 2-3 Core Rules**
  - Select representative rules for multi-target enhancement
  - Implement backward-compatible multi-target access patterns
  - Document rule update patterns
  - Test rule execution with enhanced events

- [ ] **Create Rule Examples**
  - Example multi-target action definitions
  - Corresponding rule implementations
  - Documentation of access patterns
  - Best practices guide

#### Week 4: Integration Testing
- [ ] **End-to-End Validation**
  - Test complete multi-target action flow
  - Validate action formatting → event creation → rule execution
  - Test backward compatibility with existing actions
  - Performance testing with complex multi-target scenarios

### Phase 3: Documentation & Ecosystem (Week 5-6)
**Priority: Documentation and Migration**

#### Week 5: Documentation
- [ ] **Update Modding Documentation**
  - Multi-target action creation guide
  - Rule development patterns
  - Migration guide for existing mods
  - API reference updates

- [ ] **Create Developer Tools**
  - Debug logging for multi-target flow
  - Validation tools for action/rule compatibility
  - Testing utilities for multi-target scenarios

#### Week 6: Migration Support
- [ ] **Migration Tools**
  - Automated analysis of existing rules
  - Compatibility checking tools
  - Migration script templates
  - Rollback procedures

### Phase 4: Optimization & Advanced Features (Week 7-8)
**Priority: Future Enhancements**

#### Week 7: Performance Optimization
- [ ] **Performance Enhancements**
  - Optimize target data extraction
  - Implement caching for complex target resolution
  - Memory usage optimization
  - Benchmark and performance testing

#### Week 8: Advanced Features
- [ ] **Developer Experience**
  - Advanced debugging tools
  - Visual target flow debugging
  - Rule template generator
  - Comprehensive test suite

### Success Criteria

#### Phase 1 Success Criteria
- [ ] All existing single-target actions continue to work
- [ ] Enhanced event schema validates correctly
- [ ] Command processor creates valid multi-target events
- [ ] Zero performance regression for single-target actions

#### Phase 2 Success Criteria  
- [ ] At least 3 working multi-target action examples
- [ ] Rules can access both primary and secondary targets
- [ ] Complete action flow works end-to-end
- [ ] Integration tests pass with >95% coverage

#### Phase 3 Success Criteria
- [ ] Comprehensive documentation available
- [ ] Migration guide tested with sample mods
- [ ] Developer tools functional and documented
- [ ] Community feedback incorporated

#### Phase 4 Success Criteria
- [ ] Performance benchmarks meet targets
- [ ] Advanced developer tools available
- [ ] System ready for community adoption
- [ ] Full test coverage and validation

## Testing Strategy

### Unit Tests

#### Schema Validation Tests
```javascript
describe('Enhanced Attempt Action Event Schema', () => {
  test('validates legacy single-target events', () => {
    const legacyEvent = {
      eventName: 'core:attempt_action',
      actorId: 'actor_123',
      actionId: 'core:follow',
      targetId: 'target_456',
      originalInput: 'follow Alice'
    };
    
    expect(validateEventSchema(legacyEvent)).toBe(true);
  });

  test('validates enhanced multi-target events', () => {
    const enhancedEvent = {
      eventName: 'core:attempt_action',
      actorId: 'actor_123', 
      actionId: 'combat:throw',
      targets: {
        item: 'knife_789',
        target: 'goblin_012'
      },
      targetId: 'knife_789',
      originalInput: 'throw knife at goblin'
    };
    
    expect(validateEventSchema(enhancedEvent)).toBe(true);
  });

  test('rejects invalid multi-target structure', () => {
    const invalidEvent = {
      eventName: 'core:attempt_action',
      actorId: 'actor_123',
      actionId: 'invalid:action',
      targets: 'invalid_string', // Should be object
      originalInput: 'invalid action'
    };
    
    expect(validateEventSchema(invalidEvent)).toBe(false);
  });
});
```

#### Command Processor Tests
```javascript
describe('CommandProcessor Multi-Target Enhancement', () => {
  test('extracts multi-target data correctly', () => {
    const resolvedParameters = {
      isMultiTarget: true,
      targetIds: {
        person: ['alice_123'],
        clothing: ['dress_456']
      }
    };

    const result = commandProcessor.extractMultiTargetData(resolvedParameters);
    
    expect(result.hasMultipleTargets).toBe(true);
    expect(result.targets).toEqual({
      person: 'alice_123',
      clothing: 'dress_456'
    });
    expect(result.primaryTarget).toBe('alice_123');
  });

  test('handles legacy single-target data', () => {
    const resolvedParameters = {
      targetId: 'legacy_target_123'
    };

    const result = commandProcessor.extractMultiTargetData(resolvedParameters);
    
    expect(result.hasMultipleTargets).toBe(false);
    expect(result.primaryTarget).toBe('legacy_target_123');
  });

  test('creates enhanced event payload', () => {
    const actor = { id: 'actor_123' };
    const turnAction = {
      actionDefinitionId: 'test:multi_action',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: { item: ['item_456'], target: ['target_789'] }
      },
      commandString: 'throw item at target'
    };

    const payload = commandProcessor.createAttemptActionPayload(actor, turnAction);
    
    expect(payload.targets).toEqual({
      item: 'item_456',
      target: 'target_789'
    });
    expect(payload.targetId).toBe('item_456'); // Primary for backward compatibility
  });
});
```

### Integration Tests

#### End-to-End Multi-Target Flow
```javascript
describe('Multi-Target Action End-to-End Flow', () => {
  test('complete throw action with item and target', async () => {
    // Setup: Create actor with knife, goblin in location
    const testBed = new ActionTestBed();
    const { actor, knife, goblin } = await testBed.setupThrowScenario();

    // Execute: Process "throw knife at goblin" command
    const result = await testBed.processCommand(actor, 'throw knife at goblin');

    // Verify: Action formatted correctly
    expect(result.formattedActions).toContain('throw knife at goblin');

    // Verify: Event created with multi-target data
    const events = testBed.getDispatchedEvents();
    const attemptEvent = events.find(e => e.eventName === 'core:attempt_action');
    
    expect(attemptEvent.targets).toEqual({
      item: knife.id,
      target: goblin.id
    });
    expect(attemptEvent.targetId).toBe(knife.id); // Backward compatibility

    // Verify: Rules can access both targets
    const ruleExecutions = testBed.getRuleExecutions();
    const throwRule = ruleExecutions.find(r => r.ruleId === 'combat:throw_item');
    
    expect(throwRule.parameters.item).toBe(knife.id);
    expect(throwRule.parameters.target).toBe(goblin.id);
  });

  test('backward compatibility with legacy single-target actions', async () => {
    const testBed = new ActionTestBed();
    const { actor, target } = await testBed.setupFollowScenario();

    // Execute legacy single-target action
    const result = await testBed.processCommand(actor, 'follow Alice');

    // Verify: Legacy behavior preserved
    const events = testBed.getDispatchedEvents();
    const attemptEvent = events.find(e => e.eventName === 'core:attempt_action');
    
    expect(attemptEvent.targetId).toBe(target.id);
    expect(attemptEvent.targets).toBeUndefined(); // Legacy format

    // Verify: Legacy rules still work
    const ruleExecutions = testBed.getRuleExecutions();
    expect(ruleExecutions.length).toBeGreaterThan(0);
  });
});
```

### Performance Tests

```javascript
describe('Multi-Target Performance', () => {
  test('no performance regression for single-target actions', async () => {
    const testBed = new PerformanceTestBed();
    
    // Baseline: Legacy single-target performance
    const legacyTime = await testBed.measureActionProcessing('legacy_single_target');
    
    // Enhanced: Same action with enhanced processor
    const enhancedTime = await testBed.measureActionProcessing('enhanced_single_target');
    
    // Verify: Less than 5% performance regression
    expect(enhancedTime).toBeLessThan(legacyTime * 1.05);
  });

  test('multi-target processing within performance budget', async () => {
    const testBed = new PerformanceTestBed();
    
    // Test: Complex multi-target action processing
    const processingTime = await testBed.measureMultiTargetProcessing({
      targetCount: 3,
      combinationCount: 10
    });
    
    // Verify: Within 100ms performance budget
    expect(processingTime).toBeLessThan(100);
  });
});
```

## Migration Guide

### For Modders

#### No Action Required
Existing single-target actions continue to work without modification:

```json
// This continues to work unchanged
{
  "id": "my_mod:simple_action",
  "scope": "my_mod:valid_targets", 
  "template": "interact with {target}"
}
```

#### Enhanced Capabilities Available
New multi-target actions can be created:

```json
// New multi-target action
{
  "id": "my_mod:complex_action",
  "targets": {
    "primary": {
      "scope": "my_mod:items_in_inventory",
      "placeholder": "item"
    },
    "secondary": {
      "scope": "my_mod:valid_recipients",
      "placeholder": "recipient"
    }
  },
  "template": "give {item} to {recipient}",
  "generateCombinations": true
}
```

#### Rule Updates (Optional)
Rules can optionally use enhanced target access:

```json
// Legacy compatible rule (works with both formats)
{
  "parameters": {
    "target": "{event.payload.targets.primary || event.payload.targetId}"
  }
}

// Enhanced rule (utilizes multi-target data)  
{
  "parameters": {
    "item": "{event.payload.targets.item}",
    "recipient": "{event.payload.targets.recipient}"
  }
}
```

### For Engine Developers

#### Required Updates
1. **Event Handlers**: Update to handle enhanced event structure
2. **Validation**: Use enhanced event validation
3. **Testing**: Include multi-target scenarios in tests

#### Optional Updates
1. **Custom Formatters**: Enhance for multi-placeholder support
2. **Debug Tools**: Add multi-target debugging capabilities
3. **Performance**: Optimize for multi-target scenarios

### Migration Checklist

#### Phase 1: Preparation
- [ ] Review existing actions for multi-target potential
- [ ] Audit rules for compatibility requirements
- [ ] Plan testing approach for enhanced events
- [ ] Backup existing configurations

#### Phase 2: Implementation
- [ ] Update engine to latest version with multi-target support
- [ ] Test existing actions for continued functionality
- [ ] Validate event processing with enhanced payloads
- [ ] Monitor performance metrics

#### Phase 3: Enhancement
- [ ] Identify actions that benefit from multi-target capability
- [ ] Create enhanced action definitions
- [ ] Update corresponding rules for multi-target access
- [ ] Test enhanced actions end-to-end

#### Phase 4: Optimization
- [ ] Review performance with multi-target actions
- [ ] Optimize any performance bottlenecks
- [ ] Document custom patterns and best practices
- [ ] Share learnings with community

## Performance Considerations

### Performance Targets

#### Single-Target Actions
- **No Regression**: Enhanced system should not slow down existing actions
- **Target**: <5% performance overhead for legacy actions
- **Monitoring**: Continuous performance testing with existing actions

#### Multi-Target Actions  
- **Target Resolution**: <50ms for typical multi-target scenarios
- **Event Creation**: <10ms for enhanced payload creation
- **Rule Processing**: <100ms for complex multi-target rules
- **Memory Overhead**: <1MB additional memory for typical game session

### Optimization Strategies

#### Data Extraction Optimization
```javascript
// Cache target extraction results within single action processing
class CommandProcessor {
  #targetExtractionCache = new Map();

  #extractMultiTargetData(resolvedParameters) {
    // Use cache key based on parameters structure
    const cacheKey = this.#createCacheKey(resolvedParameters);
    
    if (this.#targetExtractionCache.has(cacheKey)) {
      return this.#targetExtractionCache.get(cacheKey);
    }
    
    const result = this.#performTargetExtraction(resolvedParameters);
    this.#targetExtractionCache.set(cacheKey, result);
    
    return result;
  }

  #createCacheKey(params) {
    // Create lightweight cache key
    return JSON.stringify({
      isMultiTarget: params.isMultiTarget,
      targetIds: params.targetIds,
      targetId: params.targetId
    });
  }
}
```

#### Event Payload Optimization
```javascript
// Minimize payload size while maintaining functionality
#createOptimizedPayload(actor, turnAction, multiTargetData) {
  const payload = {
    eventName: ATTEMPT_ACTION_ID,
    actorId: actor.id,
    actionId: turnAction.actionDefinitionId,
    originalInput: turnAction.commandString,
    timestamp: Date.now()
  };

  // Only include targets object if multiple targets exist
  if (multiTargetData.hasMultipleTargets) {
    payload.targets = multiTargetData.targets;
  }
  
  // Always include targetId for backward compatibility
  payload.targetId = multiTargetData.primaryTarget;

  return payload;
}
```

### Performance Monitoring

```javascript
// Performance tracking for multi-target processing
class MultiTargetPerformanceMonitor {
  #metrics = {
    singleTargetProcessing: [],
    multiTargetProcessing: [],
    eventCreation: [],
    ruleExecution: []
  };

  trackActionProcessing(actionType, processingTime) {
    const metric = actionType === 'single' 
      ? this.#metrics.singleTargetProcessing 
      : this.#metrics.multiTargetProcessing;
    
    metric.push({
      timestamp: Date.now(),
      processingTime,
      actionType
    });

    // Alert if performance degrades
    if (this.#detectPerformanceRegression(metric)) {
      this.#alertPerformanceIssue(actionType, processingTime);
    }
  }

  #detectPerformanceRegression(metrics) {
    if (metrics.length < 10) return false;
    
    const recent = metrics.slice(-5);
    const baseline = metrics.slice(-15, -5);
    
    const recentAvg = recent.reduce((sum, m) => sum + m.processingTime, 0) / recent.length;
    const baselineAvg = baseline.reduce((sum, m) => sum + m.processingTime, 0) / baseline.length;
    
    return recentAvg > baselineAvg * 1.2; // 20% regression threshold
  }
}
```

## Conclusion

This specification provides a comprehensive solution to bridge the critical gap between the Living Narrative Engine's sophisticated multi-target action formatting system and its currently limited single-target event/rules system. 

### Key Benefits

1. **Unlocks Multi-Target Actions**: Enables proper execution of complex actions like "adjust Alice's red dress" or "throw knife at goblin"
2. **Maintains Backward Compatibility**: All existing single-target actions and rules continue to work unchanged
3. **Modder-Friendly**: Clear patterns for creating multi-target actions and rules
4. **Performance Conscious**: No regression for existing actions, optimized for new capabilities
5. **Future-Proof**: Extensible architecture for advanced multi-target scenarios

### Critical Path

The core bottleneck is in the command processor where multi-target data from the formatting stage is lost. By enhancing the event schema and command processor to pass multi-target data while maintaining backward compatibility, we unlock the full potential of the existing multi-target formatting system.

### Success Metrics

- ✅ All existing actions continue to work
- ✅ Multi-target actions execute correctly end-to-end  
- ✅ Rules can access all necessary targets
- ✅ No performance regression
- ✅ Clear migration path for modders

This implementation will transform the Living Narrative Engine from having sophisticated action formatting with limited execution to having a fully functional multi-target action system that matches the complexity and richness of its formatting capabilities.