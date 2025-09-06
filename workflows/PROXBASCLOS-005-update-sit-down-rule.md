# PROXBASCLOS-005: Update Sit Down Rule for Automatic Closeness

**Phase**: Integration Layer  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: PROXBASCLOS-001, PROXBASCLOS-002, PROXBASCLOS-003  
**Estimated Time**: 4-6 hours

## Summary

Update the existing `handle_sit_down.rule.json` to automatically establish closeness relationships when an actor successfully sits in a spot adjacent to other actors. This integrates the new `ESTABLISH_SITTING_CLOSENESS` operation into the existing sit down workflow.

## Technical Requirements

### File to Modify
- `data/mods/positioning/rules/handle_sit_down.rule.json`

### Current Rule Structure Analysis
The existing rule handles atomic spot allocation through sequential IF conditions:
1. Try to claim spot 0 with `ATOMIC_MODIFY_COMPONENT`
2. If successful, add `sitting_on` component and lock movement
3. Try spot 1 if spot 0 was occupied, etc.
4. End with `core:logSuccessAndEndTurn` macro for success logging

### Required Modifications

#### Add Closeness Establishment After Successful Sitting
For each successful spot claim, add the `ESTABLISH_SITTING_CLOSENESS` operation:

```json
{
  "comment": "After successful sitting, establish closeness with adjacent actors",
  "type": "ESTABLISH_SITTING_CLOSENESS",
  "parameters": {
    "furniture_id": "{event.payload.targetId}",
    "actor_id": "{event.payload.actorId}", 
    "spot_index": 0,
    "result_variable": "closenessResult"
  }
}
```

#### Integration Point Strategy
**Option A: Add After Each Spot Success**
- Add `ESTABLISH_SITTING_CLOSENESS` operation immediately after each successful spot claim
- Use dynamic spot_index based on which IF condition succeeded
- Requires context variable to track successful spot

**Option B: Add After All Spot Logic**
- Add single `ESTABLISH_SITTING_CLOSENESS` operation at end of rule
- Use context variable from successful spot claim to determine spot_index
- Cleaner rule structure, requires context management

### Recommended Approach: Option B

#### Context Variable Management
```json
{
  "comment": "Context variable to track which spot was successfully claimed",
  "type": "SET_CONTEXT_VARIABLE", 
  "parameters": {
    "variable_name": "successfulSpotIndex",
    "value": 0
  },
  "conditions": [
    {
      "type": "ATOMIC_MODIFY_COMPONENT_SUCCESS",
      "parameters": {
        "entity_ref": "target",
        "component_type": "positioning:allows_sitting", 
        "field": "spots.0"
      }
    }
  ]
}
```

#### Closeness Establishment Integration
```json
{
  "comment": "Establish closeness with adjacent actors after successful sitting",
  "type": "ESTABLISH_SITTING_CLOSENESS",
  "parameters": {
    "furniture_id": "{event.payload.targetId}",
    "actor_id": "{event.payload.actorId}",
    "spot_index": "{context.successfulSpotIndex}",
    "result_variable": "closenessEstablished"
  },
  "conditions": [
    {
      "comment": "Only if sitting was successful",
      "type": "CONTEXT_VARIABLE_EQUALS",
      "parameters": {
        "variable_name": "sittingSuccessful", 
        "expected_value": true
      }
    }
  ]
}
```

## Acceptance Criteria

### Integration Requirements
- [ ] **Backward Compatibility**: Existing sit down behavior remains unchanged
- [ ] **Conditional Execution**: Closeness establishment only occurs after successful sitting
- [ ] **Context Integration**: Uses existing context variables and patterns
- [ ] **Error Handling**: Closeness operation failure doesn't break sitting workflow
- [ ] **Performance**: No significant impact on sitting operation performance

### Functional Requirements
- [ ] **Adjacent Detection**: Automatically detects and establishes closeness with adjacent actors
- [ ] **Spot Flexibility**: Works for all spot positions (0-9) without hardcoding
- [ ] **Empty Spots**: Handles furniture with no adjacent actors gracefully
- [ ] **Full Furniture**: Handles cases where sitting fails due to full capacity

### Data Consistency Requirements
- [ ] **Component Sync**: `sitting_on` component creation and closeness establishment are consistent
- [ ] **Movement Locks**: Movement remains locked after both sitting and closeness establishment
- [ ] **Event Order**: Operations execute in correct order without race conditions
- [ ] **Failure Recovery**: Partial failures don't leave actors in inconsistent states

## Detailed Implementation

### Rule Structure Enhancement

#### Current Rule Flow (Simplified)
```json
{
  "ruleName": "handle_sit_down",
  "actions": [
    // IF conditions for spot 0, 1, 2, etc.
    // ADD_COMPONENT for sitting_on
    // LOCK_MOVEMENT
    // core:logSuccessAndEndTurn
  ]
}
```

#### Enhanced Rule Flow  
```json
{
  "ruleName": "handle_sit_down", 
  "actions": [
    // Existing spot claiming logic (unchanged)
    
    // NEW: Set success flag for closeness operation
    {
      "type": "SET_CONTEXT_VARIABLE",
      "parameters": {
        "variable_name": "sittingSuccessful",
        "value": true
      },
      "conditions": [
        {
          "comment": "Any spot claim was successful",
          "type": "OR",
          "conditions": [
            // Success conditions for each spot
          ]
        }
      ]
    },
    
    // NEW: Track which spot was claimed
    {
      "type": "SET_CONTEXT_VARIABLE",
      "parameters": {
        "variable_name": "claimedSpotIndex", 
        "value": "{context.successfulSpotIndex}"
      }
    },
    
    // NEW: Establish closeness with adjacent actors
    {
      "comment": "Automatically establish closeness with adjacent actors",
      "type": "ESTABLISH_SITTING_CLOSENESS",
      "parameters": {
        "furniture_id": "{event.payload.targetId}",
        "actor_id": "{event.payload.actorId}",
        "spot_index": "{context.claimedSpotIndex}",
        "result_variable": "closenessEstablished"
      },
      "conditions": [
        {
          "type": "CONTEXT_VARIABLE_EQUALS",
          "parameters": {
            "variable_name": "sittingSuccessful",
            "expected_value": true
          }
        }
      ]
    },
    
    // Existing success logging (unchanged)
    {
      "type": "core:logSuccessAndEndTurn",
      // ... existing parameters
    }
  ]
}
```

### Context Variable Strategy

#### Tracking Successful Spot Claims
Each spot claim IF condition needs to set a context variable:

```json
{
  "type": "IF",
  "conditions": [
    {
      "type": "ATOMIC_MODIFY_COMPONENT",
      "parameters": {
        "entity_ref": "target",
        "component_type": "positioning:allows_sitting",
        "field": "spots.0",
        "expected_value": null,
        "new_value": "{event.payload.actorId}"
      }
    }
  ],
  "then": [
    // Existing actions: ADD_COMPONENT, LOCK_MOVEMENT
    
    // NEW: Track successful spot
    {
      "type": "SET_CONTEXT_VARIABLE",
      "parameters": {
        "variable_name": "successfulSpotIndex",
        "value": 0
      }
    },
    {
      "type": "SET_CONTEXT_VARIABLE", 
      "parameters": {
        "variable_name": "sittingSuccessful",
        "value": true
      }
    }
  ]
}
```

## Testing Strategy

### Unit Tests
File: `tests/unit/rules/positioning/handleSitDown.test.js` (modify existing)

#### New Test Cases to Add
```javascript
describe('handle_sit_down - Closeness Integration', () => {
  it('should establish closeness when sitting adjacent to another actor', async () => {
    // Setup: Alice already sitting in spot 0
    // Action: Bob sits down (should claim spot 1)
    // Verify: ESTABLISH_SITTING_CLOSENESS operation was called
    // Verify: Both actors have closeness relationship
  });
  
  it('should not establish closeness when sitting in isolated spot', async () => {
    // Setup: Empty furniture
    // Action: Alice sits down (should claim spot 0)
    // Verify: ESTABLISH_SITTING_CLOSENESS called but no relationships created
  });
  
  it('should handle closeness operation failure gracefully', async () => {
    // Setup: Mock ESTABLISH_SITTING_CLOSENESS to fail
    // Action: Bob sits next to Alice
    // Verify: Sitting still succeeds, actor has sitting_on component
    // Verify: Error event dispatched for closeness failure
  });
});
```

### Integration Tests  
File: `tests/integration/mods/positioning/sitDownClosenessWorkflow.integration.test.js`

#### Complete Workflow Tests
```javascript
describe('Sit Down Closeness Workflow', () => {
  it('should demonstrate Alice-Bob adjacency scenario', async () => {
    // 1. Setup furniture with multiple spots
    // 2. Alice sits down (claims spot 0)
    // 3. Verify Alice has sitting_on component, no closeness
    // 4. Bob sits down (should claim spot 1)  
    // 5. Verify Bob has sitting_on component
    // 6. Verify both Alice and Bob have closeness with each other
    // 7. Verify both actors have movement locked
  });
  
  it('should handle middle position bridging correctly', async () => {
    // Setup: Alicia in spot 0, Zelda in spot 2
    // Action: Bob sits (should claim spot 1)
    // Verify: Bob close to both Alicia and Zelda
    // Verify: Alicia and Zelda NOT directly close to each other
  });
});
```

### Rule Validation Tests
File: `tests/integration/rules/positioning/sitDownRuleValidation.test.js`

#### Rule Structure Tests
```javascript
describe('Sit Down Rule Validation', () => {
  it('should validate rule JSON structure is valid', () => {
    const rule = loadRule('handle_sit_down.rule.json');
    expect(rule).toHaveValidStructure();
    expect(rule.actions).toContainOperation('ESTABLISH_SITTING_CLOSENESS');
  });
  
  it('should validate context variable references', () => {
    // Verify all context variable references are valid
    // Check that successfulSpotIndex is set before being used
  });
});
```

## Risk Mitigation

### Backward Compatibility Risks
- **Risk**: Changes break existing sit down behavior
- **Mitigation**: 
  - Extensive integration testing with existing scenarios
  - Closeness operation is additive, doesn't modify core sitting logic
  - Feature flag for gradual rollout if needed

### Performance Risks  
- **Risk**: Additional operation slows down sitting
- **Mitigation**:
  - Closeness operation only executes after successful sitting
  - Minimal additional complexity (O(1) adjacency calculation)
  - Performance benchmarking to ensure <10ms impact

### Context Variable Complexity
- **Risk**: Complex context management introduces bugs
- **Mitigation**:
  - Clear naming conventions for context variables
  - Comprehensive unit tests for context variable logic
  - Documentation of context variable lifecycle

## Implementation Checklist

### Phase 1: Rule Analysis and Planning
- [ ] Analyze current `handle_sit_down.rule.json` structure
- [ ] Identify optimal integration points for new operation
- [ ] Plan context variable strategy
- [ ] Design conditional execution logic

### Phase 2: Rule Modification
- [ ] Add context variable tracking for successful spot claims  
- [ ] Add `ESTABLISH_SITTING_CLOSENESS` operation with proper conditions
- [ ] Update each spot claim IF condition to set context variables
- [ ] Validate JSON syntax and structure

### Phase 3: Testing and Validation
- [ ] Create unit tests for new rule behavior
- [ ] Create integration tests for complete workflow
- [ ] Test backward compatibility with existing scenarios
- [ ] Performance test sitting operation impact

### Phase 4: Documentation and Review
- [ ] Document rule changes and context variable usage
- [ ] Update mod documentation if needed
- [ ] Code review with focus on rule logic correctness

## Definition of Done
- [ ] Rule modified to include closeness establishment operation
- [ ] Context variables properly track successful spot claims
- [ ] Closeness operation executes conditionally after successful sitting
- [ ] Backward compatibility maintained for existing sit down behavior
- [ ] Unit tests added covering new functionality
- [ ] Integration tests demonstrate complete workflow
- [ ] Performance impact measured and acceptable (<10ms)
- [ ] Rule JSON validates correctly and loads without errors
- [ ] Code reviewed and meets project standards