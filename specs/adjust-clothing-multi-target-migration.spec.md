# Multi-Target adjust_clothing Migration Specification

**Document Version**: 1.0  
**Created**: January 2025  
**Purpose**: Specification for migrating `intimacy:adjust_clothing` from single-target to multi-target action format

## 1. Executive Summary

This specification defines the migration of the `intimacy:adjust_clothing` action from single-target to multi-target format. The migration enables dynamic garment selection and display, allowing the action template to show specific garment names (e.g., "adjust John's silk shirt") instead of generic clothing references (e.g., "adjust John's clothing").

### 1.1 Key Benefits

- **Enhanced User Experience**: Players see specific garment names in action descriptions
- **Dynamic Target Resolution**: Secondary target (garment) is contextually resolved from primary target (person)
- **Improved Immersion**: More detailed and realistic interaction descriptions
- **Better Action Formatting**: Leverages multi-target system's formatting capabilities

### 1.2 Migration Scope

- **Files Modified**: 2 core files, 2 test files, plus new specification
- **Compatibility**: Maintains existing intimacy interaction semantics
- **Performance**: Adheres to multi-target action performance guidelines (≤150ms discovery)

## 2. Current State Analysis

### 2.1 Existing Single-Target Structure

**Current Action Definition** (`intimacy:adjust_clothing`):

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:adjust_clothing",
  "name": "Adjust Clothing",
  "description": "Smooth their collar or adjust a displaced garment with possessive care.",
  "scope": "intimacy:close_actors_facing_each_other_with_torso_clothing",
  "template": "adjust {target}'s clothing",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  }
}
```

**Current Scope Logic**:

```dsl
// close_actors_facing_each_other_with_torso_clothing.scope
intimacy:close_actors_facing_each_other_with_torso_clothing := actor.intimacy:closeness.partners[][{
  "and": [
    {"condition_ref": "intimacy:both-actors-facing-each-other"},
    {"hasClothingInSlot": [".", "torso_upper"]}
  ]
}]
```

**Current Rule Structure**:

- Single target resolution (`target` entity reference)
- Generic success message mentioning "displaced garment"
- Standard intimacy interaction handling

### 2.2 Limitations of Current Implementation

1. **Generic Template**: Cannot display specific garment names
2. **Static Description**: Always refers to "clothing" generically
3. **Missed Opportunity**: Doesn't leverage the clothing system's detailed item data
4. **Limited Context**: No access to specific garment being adjusted in the action stage

## 3. Target Multi-Target Architecture

### 3.1 Multi-Target Structure Design

**Primary Target**: Person whose clothing is being adjusted

- **Scope**: `intimacy:close_actors_facing_each_other_with_torso_clothing`
- **Role**: Maintains existing intimacy proximity and facing requirements
- **Validation**: Existing prerequisites continue to apply

**Secondary Target**: Specific garment to be adjusted

- **Scope**: `primary.topmost_clothing.torso_upper` (context-dependent)
- **Role**: Provides specific garment entity for detailed naming
- **Context**: Resolved from primary target's equipped clothing

### 3.2 Template Enhancement

**Before**: `"adjust {target}'s clothing"`
**After**: `"adjust {primary}'s {secondary}"`

**Example Transformations**:

- `"adjust Sarah's clothing"` → `"adjust Sarah's silk blouse"`
- `"adjust Michael's clothing"` → `"adjust Michael's cotton shirt"`
- `"adjust Emma's clothing"` → `"adjust Emma's linen blazer"`

### 3.3 Context Dependency Implementation

```json
{
  "targets": {
    "primary": {
      "scope": "intimacy:close_actors_facing_each_other_with_torso_clothing",
      "placeholder": "primary",
      "description": "Person whose clothing to adjust"
    },
    "secondary": {
      "scope": "primary.topmost_clothing.torso_upper",
      "placeholder": "secondary",
      "description": "Specific garment to adjust",
      "contextFrom": "primary"
    }
  }
}
```

## 4. Implementation Requirements

### 4.1 Action Definition Migration

**File**: `data/mods/intimacy/actions/adjust_clothing.action.json`

**Required Changes**:

1. Replace `"scope"` with `"targets"` object
2. Define primary target with existing scope logic
3. Define secondary target with clothing-specific scope and context dependency
4. Update template to use new placeholder names
5. Maintain all existing components and prerequisites

**New Structure**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:adjust_clothing",
  "name": "Adjust Clothing",
  "description": "Smooth their collar or adjust a displaced garment with possessive care.",
  "targets": {
    "primary": {
      "scope": "intimacy:close_actors_facing_each_other_with_torso_clothing",
      "placeholder": "primary",
      "description": "Person whose clothing to adjust"
    },
    "secondary": {
      "scope": "primary.topmost_clothing.torso_upper",
      "placeholder": "secondary",
      "description": "Specific garment to adjust",
      "contextFrom": "primary"
    }
  },
  "template": "adjust {primary}'s {secondary}",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "intimacy:actor-is-in-closeness"
      },
      "failure_message": "You can only do that with the person you are currently close to."
    }
  ]
}
```

### 4.2 Rule Definition Migration

**File**: `data/mods/intimacy/rules/adjust_clothing.rule.json`

**Required Changes**:

1. Update entity name resolution to handle both `primary` and `secondary` targets
2. Modify success messages to include specific garment names
3. Update event payload references from `targetId` to `primaryId` and `secondaryId`
4. Maintain existing intimacy interaction behavior

**Key Updates**:

```json
{
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "primary",
        "result_variable": "primaryName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "secondary",
        "result_variable": "garmentName"
      }
    }
    // ... rest of rule actions with updated references
  ]
}
```

### 4.3 Scope DSL Integration

**Primary Target Scope**: Leverage existing scope definition

- File: `data/mods/intimacy/scopes/close_actors_facing_each_other_with_torso_clothing.scope`
- No changes required - maintains existing logic

**Secondary Target Scope**: Context-dependent clothing resolution

- Uses inline scope definition: `primary.topmost_clothing.torso_upper`
- Leverages clothing system's topmost layer prioritization
- Automatically resolves to highest-priority torso_upper clothing item

### 4.4 Schema Compliance

**Action Schema Requirements**:

- Multi-target `targets` object with `primary` and `secondary` properties
- Context dependency specified via `contextFrom: "primary"`
- Proper placeholder naming matching template variables
- Schema validation against `action.schema.json`

**Rule Schema Requirements**:

- Event payload handling for `primaryId` and `secondaryId`
- Multiple entity reference variables in rule actions
- Maintained rule action type compliance

## 5. Technical Implementation Details

### 5.1 Context Resolution Flow

1. **Primary Target Discovery**:
   - Evaluate `intimacy:close_actors_facing_each_other_with_torso_clothing` scope
   - Apply proximity, facing, and clothing requirements
   - Return valid person entities

2. **Secondary Target Discovery**:
   - For each primary target, set as context entity
   - Evaluate `primary.topmost_clothing.torso_upper` scope with context
   - Return topmost clothing item from torso_upper slot
   - Apply layer priority (outer > base > underwear)

3. **Action Combination Generation**:
   - Create action instances for each valid (primary, secondary) pair
   - Generate formatted commands with specific garment names
   - Maintain prerequisite validation for each combination

### 5.2 Error Handling Requirements

**Missing Secondary Target**:

- If primary target has no torso_upper clothing, action should not be available
- Graceful handling of empty clothing slots
- No error logging for valid gameplay states

**Context Resolution Failures**:

- Log context resolution issues for debugging
- Fallback behavior should exclude the action rather than show generic text
- Maintain system stability during resolution failures

**Invalid Entity References**:

- Validate entity IDs during rule execution
- Handle missing entities gracefully in rule actions
- Use existing entity validation patterns

### 5.3 Performance Considerations

**Target Discovery Performance**:

- Context-dependent resolution adds ~20-30% processing time
- Expected total discovery time: <100ms for typical scenarios
- Memory overhead: ~2MB additional for context resolution

**Optimization Strategies**:

- Cache clothing access objects per turn
- Batch entity name resolution where possible
- Limit maximum combinations if needed (unlikely with clothing slots)

## 6. Testing Requirements

### 6.1 Existing Test Migration

**clothingSpecificScope.integration.test.js**:

- Update test expectations for multi-target action structure
- Modify mock data to support both primary and secondary targets
- Add context dependency validation tests
- Update action discovery result assertions

**adjustClothing.schema.test.js**:

- Update schema validation tests for new multi-target structure
- Verify `targets` object compliance with action schema
- Test context dependency schema validation

### 6.2 New Test Cases Required

**Multi-Target Context Resolution**:

```javascript
it('should resolve secondary target from primary context', async () => {
  // Test that secondary target correctly uses primary entity as context
  // Verify clothing item matches primary entity's torso_upper slot
});

it('should handle missing clothing gracefully', async () => {
  // Test behavior when primary target has no torso_upper clothing
  // Verify action is not available rather than failing
});
```

**Template Rendering Validation**:

```javascript
it('should render template with specific garment names', async () => {
  // Test that template shows actual garment names
  // Verify format: "adjust [person]'s [garment]"
});
```

**Context Dependency Edge Cases**:

```javascript
it('should handle context resolution failures', async () => {
  // Test behavior with invalid context entities
  // Verify graceful degradation
});
```

### 6.3 Performance Test Updates

**Discovery Performance**:

- Update performance expectations for multi-target discovery
- Test with multiple primary targets and clothing combinations
- Verify memory usage remains within acceptable bounds

**Load Testing**:

- Test with large numbers of intimacy participants
- Verify context resolution scales appropriately
- Monitor memory usage during extended play sessions

## 7. Validation and Quality Assurance

### 7.1 Schema Validation

**Action Definition Validation**:

- Compile against `action.schema.json`
- Verify multi-target structure compliance
- Test context dependency schema validation

**Rule Definition Validation**:

- Compile against `rule.schema.json`
- Verify entity reference handling
- Test rule action parameter validation

### 7.2 Integration Testing

**Action Discovery Pipeline**:

- Test complete discovery flow with multi-target resolution
- Verify context dependency handling
- Test prerequisite evaluation with multiple targets

**Rule Execution Pipeline**:

- Test complete rule execution with multi-target event payload
- Verify entity name resolution for both targets
- Test event dispatching with updated payload structure

### 7.3 Regression Testing

**Existing Intimacy Actions**:

- Verify other intimacy actions remain unaffected
- Test intimacy component interactions
- Verify closeness relationship handling

**Clothing System Integration**:

- Test clothing equipment access
- Verify topmost clothing resolution
- Test layer priority handling

## 8. Implementation Timeline

### Phase 1: Core Migration (Priority: High)

1. Create specification document ✓
2. Migrate action definition
3. Migrate rule definition
4. Basic schema validation

### Phase 2: Test Updates (Priority: Medium)

1. Update existing integration tests
2. Update schema validation tests
3. Add basic multi-target test cases

### Phase 3: Enhanced Testing (Priority: Medium)

1. Add context dependency test cases
2. Add performance validation tests
3. Add edge case handling tests

### Phase 4: Validation (Priority: High)

1. Complete integration testing
2. Performance validation
3. Regression testing
4. Final quality assurance

## 9. Risk Assessment and Mitigation

### 9.1 Technical Risks

**Context Resolution Complexity**:

- **Risk**: Context-dependent scope resolution may introduce bugs
- **Mitigation**: Comprehensive testing of context dependency edge cases
- **Monitoring**: Add debug logging for context resolution failures

**Performance Impact**:

- **Risk**: Multi-target resolution may impact action discovery performance
- **Mitigation**: Performance testing and optimization if needed
- **Monitoring**: Track action discovery timing in performance tests

**Schema Compliance**:

- **Risk**: New structure may not validate against existing schemas
- **Mitigation**: Thorough schema validation testing
- **Monitoring**: Automated schema validation in CI/CD pipeline

### 9.2 Gameplay Risks

**Action Availability Changes**:

- **Risk**: Action may become unavailable in previously valid scenarios
- **Mitigation**: Careful scope definition to maintain existing behavior
- **Monitoring**: Regression testing with existing game scenarios

**User Experience Impact**:

- **Risk**: Template changes may confuse existing players
- **Mitigation**: Natural language template that improves clarity
- **Monitoring**: User feedback collection and analysis

### 9.3 Maintenance Risks

**Increased Complexity**:

- **Risk**: Multi-target structure adds maintenance complexity
- **Mitigation**: Comprehensive documentation and test coverage
- **Monitoring**: Code review processes and testing standards

**Debugging Difficulty**:

- **Risk**: Context dependencies may make debugging more difficult
- **Mitigation**: Enhanced logging and diagnostic tools
- **Monitoring**: Debug log analysis and troubleshooting guides

## 10. Success Criteria

### 10.1 Functional Requirements

✅ **Action Discovery**: Multi-target action discovery works correctly  
✅ **Context Resolution**: Secondary target resolves from primary context  
✅ **Template Rendering**: Actions display specific garment names  
✅ **Rule Execution**: Rules handle multi-target event payload correctly  
✅ **Prerequisites**: Existing intimacy prerequisites continue to work

### 10.2 Technical Requirements

✅ **Schema Compliance**: All definitions validate against schemas  
✅ **Performance**: Discovery time ≤150ms for complex scenarios  
✅ **Memory Usage**: Memory overhead ≤5MB for context resolution  
✅ **Error Handling**: Graceful handling of missing clothing/entities  
✅ **Test Coverage**: ≥90% test coverage for new functionality

### 10.3 Quality Requirements

✅ **Regression Testing**: No impact on existing intimacy actions  
✅ **Integration Testing**: Complete action pipeline works correctly  
✅ **Edge Case Handling**: Robust handling of boundary conditions  
✅ **Documentation**: Complete specification and implementation docs  
✅ **Code Review**: Peer review and approval of all changes

## 11. Future Enhancements

### 11.1 Potential Extensions

**Multiple Clothing Items**:

- Support for adjusting multiple garments simultaneously
- Optional tertiary target for accessories

**Conditional Templates**:

- Different templates based on garment type
- Support for cultural/contextual variations

**Enhanced Scope Options**:

- Support for other clothing slots (torso_lower, accessories)
- Layer-specific targeting (outer layer only, etc.)

### 11.2 Integration Opportunities

**Clothing State System**:

- Track adjustment history per garment
- Support for persistent clothing modifications

**Social Interaction Expansion**:

- Use pattern for other clothing-related intimate actions
- Extend to grooming and styling actions

**AI Narrative Enhancement**:

- AI system awareness of specific garments being adjusted
- Enhanced narrative generation with clothing details

---

**Document Status**: Ready for Implementation  
**Next Steps**: Begin Phase 1 implementation tasks  
**Review Required**: Technical review before rule definition changes
