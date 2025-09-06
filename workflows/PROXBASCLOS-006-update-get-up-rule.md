# PROXBASCLOS-006: Update Get Up From Furniture Rule for Closeness Removal

**Phase**: Integration Layer  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: PROXBASCLOS-001, PROXBASCLOS-002, PROXBASCLOS-004  
**Estimated Time**: 4-6 hours

## Summary

Update the existing `handle_get_up_from_furniture.rule.json` to automatically remove sitting-based closeness relationships when an actor stands up from furniture, while preserving manually-established closeness created through `get_close` actions.

## Technical Requirements

### File to Modify
- `data/mods/positioning/rules/handle_get_up_from_furniture.rule.json`

### Current Rule Structure Analysis
The existing rule handles getting up with these steps:
1. Query actor's `sitting_on` component to get furniture and spot info
2. Use `ATOMIC_MODIFY_COMPONENT` to clear the spot in furniture's `allows_sitting` array
3. Remove `sitting_on` component from actor
4. Unlock movement with `UNLOCK_MOVEMENT`
5. End with `core:logSuccessAndEndTurn` macro

### Required Modifications

#### Add Closeness Removal Before Component Cleanup
Insert the `REMOVE_SITTING_CLOSENESS` operation after querying sitting info but before removing components:

```json
{
  "comment": "Remove automatic closeness relationships based on sitting proximity",
  "type": "REMOVE_SITTING_CLOSENESS", 
  "parameters": {
    "furniture_id": "{context.sittingInfo.furniture_id}",
    "actor_id": "{event.payload.actorId}",
    "spot_index": "{context.sittingInfo.spot_index}",
    "result_variable": "closenessRemovalResult"
  }
}
```

### Integration Point Strategy

#### Current Rule Flow
```json
{
  "actions": [
    // Query sitting_on component
    // Clear furniture spot 
    // Remove sitting_on component
    // Unlock movement
    // Log success
  ]
}
```

#### Enhanced Rule Flow
```json
{
  "actions": [
    // Query sitting_on component (unchanged)
    
    // NEW: Remove sitting-based closeness relationships
    {
      "type": "REMOVE_SITTING_CLOSENESS",
      "parameters": {
        "furniture_id": "{context.sittingInfo.furniture_id}",
        "actor_id": "{event.payload.actorId}",
        "spot_index": "{context.sittingInfo.spot_index}",
        "result_variable": "closenessRemoved"
      }
    },
    
    // Clear furniture spot (unchanged)
    // Remove sitting_on component (unchanged)
    // Unlock movement (unchanged)
    // Log success (unchanged)
  ]
}
```

### Context Variable Integration

#### Leveraging Existing Context
The current rule already queries the `sitting_on` component and stores info in context:

```json
{
  "type": "QUERY_COMPONENT",
  "parameters": {
    "entity_id": "{event.payload.actorId}",
    "component_type": "positioning:sitting_on",
    "result_variable": "sittingInfo"
  }
}
```

This provides `context.sittingInfo.furniture_id` and `context.sittingInfo.spot_index` needed for the closeness removal operation.

#### Error Handling Integration
```json
{
  "type": "REMOVE_SITTING_CLOSENESS",
  "parameters": {
    "furniture_id": "{context.sittingInfo.furniture_id}",
    "actor_id": "{event.payload.actorId}",
    "spot_index": "{context.sittingInfo.spot_index}",
    "result_variable": "closenessRemoved"
  },
  "conditions": [
    {
      "comment": "Only if sitting info was successfully retrieved",
      "type": "CONTEXT_VARIABLE_EXISTS",
      "parameters": {
        "variable_name": "sittingInfo"
      }
    }
  ]
}
```

## Acceptance Criteria

### Integration Requirements
- [ ] **Backward Compatibility**: Existing get up behavior remains unchanged
- [ ] **Conditional Execution**: Closeness removal only occurs when actor was actually sitting
- [ ] **Context Integration**: Uses existing `sittingInfo` context variable
- [ ] **Error Resilience**: Closeness operation failure doesn't prevent standing up
- [ ] **Performance**: No significant impact on get up operation performance

### Functional Requirements
- [ ] **Selective Removal**: Only removes sitting-based closeness, preserves manual relationships
- [ ] **Adjacent Detection**: Correctly identifies formerly adjacent actors to remove relationships
- [ ] **Component Cleanup**: Removes empty closeness components when no partners remain
- [ ] **Chain Handling**: Maintains proper closeness circles after actor removal

### Data Consistency Requirements
- [ ] **Operation Order**: Closeness removal occurs before component cleanup
- [ ] **Movement Unlocking**: Movement unlocks appropriately after closeness changes
- [ ] **Bidirectional Cleanup**: Removes actor from all affected partners' closeness lists
- [ ] **Atomic Behavior**: All updates succeed or all fail (no partial states)

## Detailed Implementation

### Rule Structure Enhancement

#### Current Rule Structure (Simplified)
```json
{
  "ruleName": "handle_get_up_from_furniture",
  "actions": [
    {
      "comment": "Get sitting information",
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_id": "{event.payload.actorId}",
        "component_type": "positioning:sitting_on",
        "result_variable": "sittingInfo"
      }
    },
    {
      "comment": "Clear the spot in furniture",
      "type": "ATOMIC_MODIFY_COMPONENT",
      "parameters": {
        "entity_ref": "context.sittingInfo.furniture_id",
        "component_type": "positioning:allows_sitting",
        "field": "spots.{context.sittingInfo.spot_index}",
        "expected_value": "{event.payload.actorId}",
        "new_value": null
      }
    },
    {
      "comment": "Remove sitting component from actor",
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_id": "{event.payload.actorId}",
        "component_type": "positioning:sitting_on"
      }
    },
    {
      "comment": "Unlock movement",
      "type": "UNLOCK_MOVEMENT",
      "parameters": {
        "entity_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "core:logSuccessAndEndTurn",
      "parameters": {
        "message": "Actor stood up from furniture"
      }
    }
  ]
}
```

#### Enhanced Rule Structure
```json
{
  "ruleName": "handle_get_up_from_furniture",
  "actions": [
    // Existing: Get sitting information
    {
      "comment": "Get sitting information",
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_id": "{event.payload.actorId}",
        "component_type": "positioning:sitting_on", 
        "result_variable": "sittingInfo"
      }
    },
    
    // NEW: Remove sitting-based closeness relationships
    {
      "comment": "Remove automatic closeness based on sitting proximity",
      "type": "REMOVE_SITTING_CLOSENESS",
      "parameters": {
        "furniture_id": "{context.sittingInfo.furniture_id}",
        "actor_id": "{event.payload.actorId}",
        "spot_index": "{context.sittingInfo.spot_index}",
        "result_variable": "closenessRemoved"
      },
      "conditions": [
        {
          "comment": "Only if sitting info was found",
          "type": "CONTEXT_VARIABLE_EXISTS",
          "parameters": {
            "variable_name": "sittingInfo"
          }
        }
      ]
    },
    
    // Existing: Clear furniture spot (unchanged)
    {
      "comment": "Clear the spot in furniture",
      "type": "ATOMIC_MODIFY_COMPONENT",
      "parameters": {
        "entity_ref": "context.sittingInfo.furniture_id",
        "component_type": "positioning:allows_sitting",
        "field": "spots.{context.sittingInfo.spot_index}",
        "expected_value": "{event.payload.actorId}",
        "new_value": null
      }
    },
    
    // Existing: Remove sitting component (unchanged)
    {
      "comment": "Remove sitting component from actor",
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_id": "{event.payload.actorId}",
        "component_type": "positioning:sitting_on"
      }
    },
    
    // Existing: Unlock movement (unchanged)
    {
      "comment": "Unlock movement",
      "type": "UNLOCK_MOVEMENT",
      "parameters": {
        "entity_id": "{event.payload.actorId}"
      }
    },
    
    // Existing: Success logging (unchanged)
    {
      "type": "core:logSuccessAndEndTurn",
      "parameters": {
        "message": "Actor stood up from furniture"
      }
    }
  ]
}
```

### Error Handling Strategy

#### Graceful Degradation
```json
{
  "comment": "Remove sitting closeness with error tolerance",
  "type": "REMOVE_SITTING_CLOSENESS",
  "parameters": {
    "furniture_id": "{context.sittingInfo.furniture_id}",
    "actor_id": "{event.payload.actorId}",
    "spot_index": "{context.sittingInfo.spot_index}",
    "result_variable": "closenessRemoved"
  },
  "conditions": [
    {
      "comment": "Only if sitting info exists",
      "type": "CONTEXT_VARIABLE_EXISTS", 
      "parameters": {
        "variable_name": "sittingInfo"
      }
    }
  ],
  "on_error": {
    "comment": "Continue with standing even if closeness removal fails",
    "action": "CONTINUE",
    "log_level": "WARN"
  }
}
```

#### Success/Failure Tracking
```json
{
  "comment": "Log closeness removal outcome for debugging",
  "type": "IF",
  "conditions": [
    {
      "type": "CONTEXT_VARIABLE_EQUALS",
      "parameters": {
        "variable_name": "closenessRemoved",
        "expected_value": false
      }
    }
  ],
  "then": [
    {
      "type": "LOG",
      "parameters": {
        "level": "WARN",
        "message": "Closeness removal failed during stand up",
        "context": {
          "actorId": "{event.payload.actorId}",
          "furnitureId": "{context.sittingInfo.furniture_id}"
        }
      }
    }
  ]
}
```

## Testing Strategy

### Unit Tests
File: `tests/unit/rules/positioning/handleGetUpFromFurniture.test.js` (modify existing)

#### New Test Cases to Add
```javascript
describe('handle_get_up_from_furniture - Closeness Integration', () => {
  it('should remove closeness when standing up from adjacent position', async () => {
    // Setup: Alice and Bob sitting adjacent with established closeness
    // Action: Alice stands up
    // Verify: REMOVE_SITTING_CLOSENESS operation was called
    // Verify: Closeness relationship removed between Alice and Bob
    // Verify: Alice still able to stand up successfully
  });
  
  it('should preserve manual closeness when standing up', async () => {
    // Setup: Alice and Bob with both sitting AND manual closeness
    // Action: Alice stands up  
    // Verify: Only sitting-based closeness removed
    // Verify: Manual closeness preserved
  });
  
  it('should handle closeness removal failure gracefully', async () => {
    // Setup: Mock REMOVE_SITTING_CLOSENESS to fail
    // Action: Alice stands up
    // Verify: Standing still succeeds, sitting_on component removed
    // Verify: Error logged but operation continues
  });
  
  it('should handle actor with no closeness relationships', async () => {
    // Setup: Alice sitting alone with no closeness
    // Action: Alice stands up
    // Verify: REMOVE_SITTING_CLOSENESS called but no changes made
    // Verify: Standing succeeds normally
  });
});
```

### Integration Tests
File: `tests/integration/mods/positioning/getUpClosenessWorkflow.integration.test.js`

#### Complete Workflow Tests
```javascript
describe('Get Up Closeness Workflow', () => {
  it('should demonstrate complete Alice-Bob closeness removal', async () => {
    // 1. Setup: Alice and Bob sitting adjacent with closeness
    // 2. Verify: Both have closeness components with each other
    // 3. Alice stands up
    // 4. Verify: Alice no longer has sitting_on component
    // 5. Verify: Neither Alice nor Bob have closeness components
    // 6. Verify: Alice's movement is unlocked
    // 7. Verify: Bob's movement is unlocked (no closeness partners)
  });
  
  it('should handle middle position standing correctly', async () => {
    // Setup: Alice-Bob-Charlie sitting with Bob in middle, all close
    // Action: Bob stands up
    // Verify: Alice-Bob and Bob-Charlie closeness removed
    // Verify: Alice-Charlie relationship handled appropriately
    // Verify: All movement locks updated correctly
  });
  
  it('should preserve manual closeness after standing', async () => {
    // Setup: Alice-Bob sitting + manual closeness, Charlie sitting adjacent
    // Action: Alice stands up
    // Verify: Alice-Charlie sitting closeness removed
    // Verify: Alice-Bob manual closeness preserved
    // Verify: Movement locks reflect remaining relationships
  });
});
```

### Rule Validation Tests
File: `tests/integration/rules/positioning/getUpRuleValidation.test.js`

#### Rule Structure Tests
```javascript
describe('Get Up Rule Validation', () => {
  it('should validate enhanced rule JSON structure', () => {
    const rule = loadRule('handle_get_up_from_furniture.rule.json');
    expect(rule).toHaveValidStructure();
    expect(rule.actions).toContainOperation('REMOVE_SITTING_CLOSENESS');
  });
  
  it('should validate operation ordering is correct', () => {
    const rule = loadRule('handle_get_up_from_furniture.rule.json');
    const operations = rule.actions.map(action => action.type);
    
    const queryIndex = operations.indexOf('QUERY_COMPONENT');
    const removeClosenessIndex = operations.indexOf('REMOVE_SITTING_CLOSENESS');
    const removeComponentIndex = operations.indexOf('REMOVE_COMPONENT');
    
    expect(queryIndex).toBeLessThan(removeClosenessIndex);
    expect(removeClosenessIndex).toBeLessThan(removeComponentIndex);
  });
});
```

## Risk Mitigation

### Backward Compatibility Risks
- **Risk**: Changes break existing stand up behavior
- **Mitigation**:
  - Closeness removal is additive, doesn't modify core standing logic
  - Conditional execution ensures operation only runs when appropriate
  - Comprehensive regression testing with existing scenarios

### Data Consistency Risks
- **Risk**: Closeness removal fails leaving inconsistent state
- **Mitigation**:
  - Operation continues even if closeness removal fails
  - Handler includes cleanup logic for bidirectional relationships
  - Integration tests verify consistency across complex scenarios

### Performance Risks
- **Risk**: Additional operation slows down standing
- **Mitigation**:
  - Closeness removal only executes when actor was sitting
  - Efficient adjacency calculations (O(1) complexity)
  - Performance benchmarking to ensure <10ms impact

## Implementation Checklist

### Phase 1: Rule Analysis and Planning
- [ ] Analyze current `handle_get_up_from_furniture.rule.json` structure
- [ ] Identify optimal integration point for closeness removal
- [ ] Plan error handling and conditional execution strategy
- [ ] Design context variable usage pattern

### Phase 2: Rule Modification
- [ ] Add `REMOVE_SITTING_CLOSENESS` operation with proper parameters
- [ ] Add conditional execution based on existing context variables
- [ ] Add error handling for graceful degradation
- [ ] Validate JSON syntax and structure

### Phase 3: Testing and Validation
- [ ] Create unit tests for new rule behavior
- [ ] Create integration tests for complete workflow
- [ ] Test backward compatibility with existing scenarios
- [ ] Test error handling and failure scenarios

### Phase 4: Documentation and Review
- [ ] Document rule changes and integration points
- [ ] Update mod documentation if needed
- [ ] Code review with focus on rule logic and error handling

## Definition of Done
- [ ] Rule modified to include closeness removal operation
- [ ] Closeness removal executes before component cleanup
- [ ] Conditional execution prevents unnecessary operations
- [ ] Error handling ensures standing succeeds even if closeness fails
- [ ] Backward compatibility maintained for existing get up behavior
- [ ] Unit tests added covering new functionality
- [ ] Integration tests demonstrate complete workflow including error cases
- [ ] Performance impact measured and acceptable (<10ms)
- [ ] Rule JSON validates correctly and loads without errors
- [ ] Code reviewed and meets project standards