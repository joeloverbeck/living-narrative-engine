# Multi-Target Action System Enhancement Specification

**Version**: 1.0  
**Date**: 2025-07-31  
**Status**: Draft  
**Priority**: High

## Executive Summary

This specification addresses critical architectural issues in the Living Narrative Engine's multi-target action processing system. The current implementation produces malformed output due to a fundamental mismatch between target resolution and rule execution, causing actions like `adjust_clothing` to display "Unnamed Character" instead of actual entity names.

**Core Problem**: Multi-target actions resolve targets correctly during the resolution stage but fail during rule execution because rules attempt to reference entities using placeholder names ("primary", "secondary") instead of actual resolved entity IDs.

**Solution**: Enhance the event payload structure and rule execution context to bridge resolved target information from the multi-target resolution stage to the rule execution stage.

## Problem Definition

### Current Behavior

When executing the `intimacy:adjust_clothing` action:

- **Expected Output**: "Amaia Castillo smooths Iker Aguirre's denim trucker jacket with possessive care"
- **Actual Output**: "Amaia Castillo smooths Unnamed Character's Unnamed Character with possessive care"

### Technical Root Cause

1. **Target Resolution Works Correctly**:
   - Primary target resolves to actual entity ID (e.g., `p_erotica:iker_aguirre_instance`)
   - Secondary target resolves to garment entity ID with proper `contextFrom` dependency
   - Target manager correctly tracks resolved entities

2. **Rule Execution Fails**:
   - Rules use `GET_NAME` operations with placeholder references ("primary", "secondary")
   - These placeholders are not valid entity IDs in the system
   - `EntityQueryManager` cannot find entities with IDs "primary" or "secondary"
   - Returns "Unnamed Character" as fallback

3. **Missing Integration Layer**:
   - No mechanism to map placeholder names to resolved entity IDs
   - Event payload lacks resolved target ID fields expected by rules
   - Rule execution context doesn't have access to target resolution results

### Impact Assessment

- **Severity**: High - Breaks narrative immersion
- **Scope**: All multi-target actions with `contextFrom` dependencies
- **User Experience**: Severely degraded game narrative quality
- **Technical Debt**: Reveals fundamental architectural inconsistency

## Architecture Requirements

### Core Architectural Principles

1. **Placeholder-to-Entity Resolution**: Rules must be able to resolve placeholder names to actual entity IDs
2. **Event Payload Consistency**: Multi-target events must contain all resolved target IDs
3. **Backward Compatibility**: Existing single-target actions must continue working
4. **Performance**: No significant performance degradation
5. **Maintainability**: Clear separation of concerns between resolution and execution

### System Components Affected

- **MultiTargetResolutionStage**: Target resolution pipeline stage
- **ActionFormattingStage**: Action formatting and event creation
- **Rule System**: Rule execution and context management
- **Event System**: Event payload structure and validation
- **Operation Handlers**: Specifically `GET_NAME` operation

## Implementation Solutions

### Priority 1: Critical Fixes (Immediate Implementation)

#### Solution A: Event Payload Enhancement

**Requirement**: Enhance multi-target event payload to include resolved target IDs.

**Current Event Structure** (problematic):

```json
{
  "type": "core:attempt_action",
  "payload": {
    "actorId": "amaia_castillo_instance",
    "actionId": "intimacy:adjust_clothing",
    "actionText": "adjust primary's secondary"
  }
}
```

**Enhanced Event Structure** (required):

```json
{
  "type": "core:attempt_action",
  "payload": {
    "actorId": "amaia_castillo_instance",
    "actionId": "intimacy:adjust_clothing",
    "actionText": "adjust Iker Aguirre's denim trucker jacket",
    "primaryId": "p_erotica:iker_aguirre_instance",
    "secondaryId": "fd6a1e00-36b7-47cc-bdb2-4b65473614eb",
    "targets": {
      "primary": {
        "entityId": "p_erotica:iker_aguirre_instance",
        "placeholder": "primary"
      },
      "secondary": {
        "entityId": "fd6a1e00-36b7-47cc-bdb2-4b65473614eb",
        "placeholder": "secondary"
      }
    }
  }
}
```

**Implementation Requirements**:

- Modify `ActionFormattingStage` to include resolved target IDs in event payload
- Add `primaryId`, `secondaryId`, `tertiaryId` fields for backward compatibility
- Include comprehensive `targets` object for forward compatibility
- Maintain existing payload fields for backward compatibility

#### Solution B: Rule Context Enhancement

**Requirement**: Enhance rule execution context to resolve placeholder names to entity IDs.

**Current GET_NAME Operation Usage** (problematic):

```json
{
  "type": "GET_NAME",
  "parameters": {
    "entity_ref": "primary",
    "result_variable": "primaryName"
  }
}
```

**Enhanced Resolution Mechanism** (required):

1. **Extend Entity Reference Resolution**:
   - Modify `entityReference` resolution to check for placeholder names
   - If placeholder name found, resolve to actual entity ID from event payload
   - Fall back to existing behavior if not a recognized placeholder

2. **Implementation Pattern**:

   ```javascript
   // In operation handler context resolution
   function resolveEntityReference(entityRef, eventPayload) {
     // Check if it's a placeholder
     if (isPlaceholderName(entityRef)) {
       return resolveTargetPlaceholder(entityRef, eventPayload);
     }

     // Existing logic for direct entity IDs and keywords
     return resolveDirectEntityReference(entityRef);
   }

   function resolveTargetPlaceholder(placeholder, eventPayload) {
     // Try new format first
     if (eventPayload.targets && eventPayload.targets[placeholder]) {
       return eventPayload.targets[placeholder].entityId;
     }

     // Fall back to legacy format
     const targetIdField = `${placeholder}Id`;
     return eventPayload[targetIdField] || null;
   }
   ```

**Placeholder Names to Support**:

- `primary` → `event.payload.primaryId` or `event.payload.targets.primary.entityId`
- `secondary` → `event.payload.secondaryId` or `event.payload.targets.secondary.entityId`
- `tertiary` → `event.payload.tertiaryId` or `event.payload.targets.tertiary.entityId`

### Priority 2: Architectural Improvements (Short-term)

#### Solution C: Target Reference Resolver Service

**Requirement**: Create dedicated service for mapping placeholder names to resolved entity IDs.

**Service Interface**:

```javascript
class TargetReferenceResolver {
  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Resolves a placeholder name to an entity ID using event payload
   * @param {string} placeholder - Placeholder name (e.g., "primary", "secondary")
   * @param {Object} eventPayload - Event payload containing target information
   * @returns {string|null} - Resolved entity ID or null if not found
   */
  resolvePlaceholder(placeholder, eventPayload) {
    // Implementation details in Priority 1 Solution B
  }

  /**
   * Validates that all required placeholders can be resolved
   * @param {string[]} placeholders - Array of placeholder names to validate
   * @param {Object} eventPayload - Event payload to validate against
   * @returns {boolean} - True if all placeholders can be resolved
   */
  validatePlaceholders(placeholders, eventPayload) {
    return placeholders.every(
      (p) => this.resolvePlaceholder(p, eventPayload) !== null
    );
  }
}
```

**Integration Points**:

- Rule execution context initialization
- Operation handler entity reference resolution
- Action validation and error reporting

#### Solution D: Enhanced Target Manager

**Requirement**: Extend `TargetManager` to provide placeholder-to-entity-ID mapping API.

**API Extensions**:

```javascript
class TargetManager {
  // Existing methods...

  /**
   * Get entity ID by placeholder name
   * @param {string} placeholderName - Placeholder name (e.g., "primary")
   * @returns {string|null} - Entity ID or null if not found
   */
  getEntityIdByPlaceholder(placeholderName) {
    const target = this.targets.find((t) => t.name === placeholderName);
    return target ? target.entityId : null;
  }

  /**
   * Get all target mappings as placeholder-to-entityId object
   * @returns {Object} - Object mapping placeholder names to entity IDs
   */
  getTargetMappings() {
    const mappings = {};
    this.targets.forEach((target) => {
      mappings[target.name] = target.entityId;
    });
    return mappings;
  }

  /**
   * Validate that all required placeholders have resolved targets
   * @param {string[]} requiredPlaceholders - Array of required placeholder names
   * @returns {boolean} - True if all placeholders have resolved targets
   */
  validateRequiredTargets(requiredPlaceholders) {
    return requiredPlaceholders.every(
      (placeholder) => this.getEntityIdByPlaceholder(placeholder) !== null
    );
  }
}
```

### Priority 3: Testing and Validation (Medium-term)

#### Solution E: End-to-End Test Suite

**Requirement**: Create comprehensive E2E tests validating complete action workflows.

**Test Scenarios**:

1. **Basic Multi-Target Action Test**:

   ```javascript
   describe('Multi-Target Action E2E - adjust_clothing', () => {
     it('should produce correct narrative output for multi-target action', async () => {
       // Setup: Create actors with intimacy relationship and clothing
       const testBed = new E2ETestBed();
       const { amaia, iker } = await testBed.setupIntimacyScenario();

       // Execute: Trigger adjust_clothing action
       const result = await testBed.executeAction({
         actorId: amaia.id,
         actionId: 'intimacy:adjust_clothing',
         targets: {
           primary: iker.id,
           secondary: iker.clothing.jacket.id,
         },
       });

       // Assert: Verify correct narrative output
       expect(result.narrativeText).toBe(
         "Amaia Castillo smooths Iker Aguirre's denim trucker jacket with possessive care."
       );
       expect(result.success).toBe(true);
     });
   });
   ```

2. **Placeholder Resolution Test**:

   ```javascript
   it('should resolve placeholder names to actual entity IDs in rules', async () => {
     // Verify that GET_NAME operations work with placeholder references
     const ruleResult = await testBed.executeRule({
       ruleId: 'intimacy:handle_adjust_clothing',
       eventPayload: {
         actorId: 'amaia_id',
         primaryId: 'iker_id',
         secondaryId: 'jacket_id',
       },
     });

     expect(ruleResult.context.primaryName).toBe('Iker Aguirre');
     expect(ruleResult.context.garmentName).toBe('denim trucker jacket');
   });
   ```

3. **Error Handling Test**:

   ```javascript
   it('should handle missing target IDs gracefully', async () => {
     const result = await testBed.executeAction({
       actorId: 'amaia_id',
       actionId: 'intimacy:adjust_clothing',
       // Missing target information
     });

     expect(result.success).toBe(false);
     expect(result.error).toContain('Unable to resolve target');
   });
   ```

#### Solution F: Integration Test Enhancement

**Requirement**: Add tests verifying rule-action integration.

**Test Categories**:

1. **Event Payload Structure Tests**:
   - Verify multi-target events contain all required target ID fields
   - Validate backward compatibility with existing event consumers
   - Test payload validation and error handling

2. **Target Resolution Context Tests**:
   - Verify placeholder resolution in rule execution context
   - Test GET_NAME operation with placeholder references
   - Validate fallback behavior for unresolved placeholders

3. **Pipeline Integration Tests**:
   - Test complete pipeline from action definition to rule execution
   - Verify target resolution results are properly passed to rules
   - Test multi-target actions with various `contextFrom` configurations

## Technical Specifications

### Event Payload Schema

**Enhanced Multi-Target Event Payload**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Multi-Target Action Event Payload",
  "type": "object",
  "properties": {
    "actorId": {
      "type": "string",
      "description": "ID of the actor performing the action"
    },
    "actionId": {
      "type": "string",
      "description": "ID of the action being performed"
    },
    "actionText": {
      "type": "string",
      "description": "Formatted action text with resolved target names"
    },
    "primaryId": {
      "type": "string",
      "description": "Entity ID of primary target (backward compatibility)"
    },
    "secondaryId": {
      "type": "string",
      "description": "Entity ID of secondary target (backward compatibility)"
    },
    "tertiaryId": {
      "type": "string",
      "description": "Entity ID of tertiary target (backward compatibility)"
    },
    "targets": {
      "type": "object",
      "description": "Comprehensive target information",
      "properties": {
        "primary": {
          "$ref": "#/definitions/targetInfo"
        },
        "secondary": {
          "$ref": "#/definitions/targetInfo"
        },
        "tertiary": {
          "$ref": "#/definitions/targetInfo"
        }
      }
    }
  },
  "required": ["actorId", "actionId", "actionText"],
  "definitions": {
    "targetInfo": {
      "type": "object",
      "properties": {
        "entityId": {
          "type": "string",
          "description": "Resolved entity ID"
        },
        "placeholder": {
          "type": "string",
          "description": "Original placeholder name"
        },
        "description": {
          "type": "string",
          "description": "Human-readable target description"
        }
      },
      "required": ["entityId", "placeholder"]
    }
  }
}
```

### Entity Reference Resolution Enhancement

**Enhanced Entity Reference Schema**:

```json
{
  "entityReference": {
    "description": "Specifies an entity. Can be a keyword ('actor', 'target'), a placeholder name ('primary', 'secondary', 'tertiary'), a direct entity ID, or an object containing the entity ID.",
    "oneOf": [
      {
        "type": "string",
        "description": "Keyword, placeholder name, or direct entity ID",
        "minLength": 1,
        "pattern": "^\\S(.*\\S)?$",
        "examples": [
          "actor",
          "target",
          "primary",
          "secondary",
          "tertiary",
          "core:player"
        ]
      },
      {
        "type": "object",
        "properties": {
          "entity_id": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": ["entity_id"],
        "additionalProperties": false
      }
    ]
  }
}
```

**Placeholder Name Recognition**:

- Reserved placeholder names: `primary`, `secondary`, `tertiary`
- Case-sensitive matching required
- No additional placeholder names allowed (for clarity and validation)

### Error Handling Specifications

**Error Categories**:

1. **Target Resolution Errors**:
   - `TARGET_PLACEHOLDER_NOT_FOUND`: Placeholder name not in event payload
   - `TARGET_ENTITY_NOT_FOUND`: Resolved entity ID doesn't exist in system
   - `INVALID_PLACEHOLDER_NAME`: Unrecognized placeholder name used

2. **Event Payload Errors**:
   - `MISSING_TARGET_INFO`: Required target information missing from payload
   - `MALFORMED_EVENT_PAYLOAD`: Event payload doesn't match expected schema
   - `INCOMPATIBLE_ACTION_TYPE`: Action type doesn't support multi-target format

**Error Handling Strategy**:

```javascript
// Graceful degradation with informative logging
function resolveEntityReference(entityRef, context) {
  try {
    if (isPlaceholderName(entityRef)) {
      const resolvedId = resolveTargetPlaceholder(
        entityRef,
        context.eventPayload
      );
      if (!resolvedId) {
        throw new TargetResolutionError(
          `TARGET_PLACEHOLDER_NOT_FOUND`,
          `Unable to resolve placeholder '${entityRef}' to entity ID`,
          {
            placeholder: entityRef,
            availableTargets: Object.keys(context.eventPayload.targets || {}),
          }
        );
      }
      return resolvedId;
    }

    return resolveDirectEntityReference(entityRef);
  } catch (error) {
    context.logger.error(`Entity reference resolution failed`, {
      entityRef,
      error: error.message,
      context: 'rule_execution',
    });

    // Return fallback value or re-throw based on operation requirements
    if (error.code === 'TARGET_PLACEHOLDER_NOT_FOUND') {
      return null; // Let operation handler decide how to handle
    }
    throw error;
  }
}
```

## Implementation Guidelines

### Step-by-Step Implementation Sequence

#### Phase 1: Event Payload Enhancement (Priority 1A)

**Step 1.1**: Modify `ActionFormattingStage.js`

- Update event creation to include resolved target IDs
- Add `primaryId`, `secondaryId`, `tertiaryId` fields
- Include comprehensive `targets` object
- Maintain backward compatibility

**Step 1.2**: Update Event Validation

- Extend event schema validation for new payload structure
- Add validation for target ID presence and format
- Test payload structure with existing event consumers

**Step 1.3**: Integration Testing

- Test new event format with existing rules
- Verify backward compatibility with single-target actions
- Validate event serialization and deserialization

#### Phase 2: Rule Context Enhancement (Priority 1B)

**Step 2.1**: Enhance Entity Reference Resolution

- Modify core entity reference resolution logic
- Add placeholder name recognition and resolution
- Implement fallback mechanisms for missing targets

**Step 2.2**: Update Operation Handlers

- Modify `GET_NAME` operation handler to use enhanced resolution
- Update other operation handlers that use entity references
- Add comprehensive error handling and logging

**Step 2.3**: Rule Execution Testing

- Test placeholder resolution with multi-target actions
- Verify error handling for missing or invalid placeholders
- Validate rule execution produces correct results

#### Phase 3: Validation and Testing (Priority 3)

**Step 3.1**: End-to-End Test Implementation

- Create `adjust_clothing` E2E test suite
- Implement comprehensive scenario testing
- Add performance and error handling tests

**Step 3.2**: Integration Test Enhancement

- Add rule-action integration tests
- Test event payload validation
- Verify pipeline integration

**Step 3.3**: Regression Testing

- Test existing single-target actions for backward compatibility
- Verify existing multi-target actions (if any) still work
- Performance regression testing

### Migration Path for Existing Actions

**Current Multi-Target Actions**:

- Audit existing actions for multi-target usage
- Identify actions using placeholder references in rules
- Test each action with enhanced system

**Migration Steps**:

1. **No changes required** for action definitions (backward compatible)
2. **No changes required** for rules using placeholder references (enhanced resolution)
3. **Test and validate** each existing multi-target action
4. **Update documentation** for new capabilities

### Validation Checkpoints and Success Criteria

**Checkpoint 1: Event Payload Enhancement**

- ✅ Multi-target events include all resolved target IDs
- ✅ Backward compatibility maintained for existing event consumers
- ✅ Event validation accepts new payload structure
- ✅ Serialization/deserialization works correctly

**Checkpoint 2: Rule Context Enhancement**

- ✅ Placeholder names resolve to actual entity IDs
- ✅ GET_NAME operation works with placeholder references
- ✅ Error handling provides informative messages
- ✅ Fallback behavior prevents system crashes

**Checkpoint 3: Integration Validation**

- ✅ `adjust_clothing` action produces correct narrative output
- ✅ Other multi-target actions (if any) continue working
- ✅ Single-target actions remain unaffected
- ✅ Performance impact is negligible (<5% overhead)

**Final Success Criteria**:

- ✅ Output: "Amaia Castillo smooths Iker Aguirre's denim trucker jacket with possessive care"
- ✅ No "Unnamed Character" fallback text in multi-target actions
- ✅ All existing functionality preserved
- ✅ Comprehensive test coverage (>95% for new code)
- ✅ Documentation updated with new capabilities

### Performance Considerations

**Performance Requirements**:

- Event payload size increase: <50% (acceptable for enhanced functionality)
- Rule execution overhead: <5% increase
- Memory usage increase: <10% for target resolution caching
- Action discovery performance: No degradation

**Optimization Strategies**:

- Cache placeholder resolution results within rule execution context
- Lazy evaluation of target information when not needed
- Efficient event payload serialization using existing msgpack compression
- Target validation short-circuiting for performance-critical paths

**Monitoring and Metrics**:

- Track event payload size distribution
- Monitor rule execution performance
- Alert on placeholder resolution failures
- Track success rate of multi-target action execution

## Risk Assessment and Mitigation

### High-Risk Areas

1. **Backward Compatibility**: Changes to event payload and entity resolution could break existing functionality
   - **Mitigation**: Comprehensive regression testing, feature flags for gradual rollout
   - **Rollback Plan**: Revert entity resolution changes, maintain legacy event format

2. **Performance Impact**: Additional payload fields and resolution logic may impact performance
   - **Mitigation**: Performance testing, optimization of critical paths, caching strategies
   - **Monitoring**: Real-time performance metrics, alerting on degradation

3. **Data Consistency**: Mismatch between resolved targets and actual entity state
   - **Mitigation**: Validation at event creation, entity existence checking, error handling
   - **Recovery**: Graceful degradation, fallback to safe defaults

### Medium-Risk Areas

1. **Rule Complexity**: Enhanced entity resolution may introduce subtle bugs
   - **Mitigation**: Comprehensive unit and integration testing
   - **Validation**: Code review focusing on edge cases

2. **Event System Load**: Larger event payloads may impact event bus performance
   - **Mitigation**: Event payload optimization, compression strategies
   - **Monitoring**: Event processing latency metrics

### Low-Risk Areas

1. **Schema Evolution**: Adding optional fields to existing schemas
   - **Mitigation**: Standard schema versioning practices
   - **Impact**: Minimal, handled by existing validation framework

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)

- Event payload enhancement implementation
- Basic placeholder resolution logic
- Unit tests for core functionality

### Phase 2: Integration (Week 3-4)

- Rule context enhancement
- Operation handler updates
- Integration testing and debugging

### Phase 3: Validation (Week 5-6)

- End-to-end test implementation
- Performance testing and optimization
- Documentation updates

### Phase 4: Deployment (Week 7-8)

- Production readiness validation
- Gradual rollout with monitoring
- Bug fixes and performance tuning

## Dependencies and Prerequisites

### System Dependencies

- Existing multi-target action infrastructure
- Event bus system
- Rule execution engine
- Entity management system

### Development Dependencies

- Testing framework setup for E2E tests
- Performance monitoring and profiling tools
- Documentation generation tools

### Knowledge Prerequisites

- Understanding of ECS architecture
- Event-driven system design principles
- JSON schema design and validation
- Living Narrative Engine codebase familiarity

## Conclusion

This specification provides a comprehensive solution to the multi-target action processing issue while establishing a robust foundation for future multi-target action development. The proposed changes maintain backward compatibility while significantly enhancing the system's capability to handle complex multi-target scenarios.

The implementation prioritizes critical fixes first, ensuring immediate resolution of the narrative quality issue, followed by architectural improvements that will benefit long-term system maintainability and extensibility.

Success will be measured by the elimination of "Unnamed Character" fallback text in multi-target actions and the production of correct, immersive narrative output that enhances the player experience.
