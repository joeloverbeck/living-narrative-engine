# Ticket 1: Event Payload Enhancement

## Overview

Enhance multi-target event payload structure to include resolved target IDs, addressing the core issue where rules cannot access resolved entity information from the multi-target resolution stage. This is the critical first step in fixing "Unnamed Character" output in multi-target actions like `intimacy:adjust_clothing`.

## Problem Statement

**Current Issue**: Multi-target actions resolve targets correctly during resolution stage but fail during rule execution because the event payload doesn't contain the resolved entity IDs that rules need to reference placeholder names ("primary", "secondary").

**Root Cause**: Event payload contains only placeholder references in `actionText` but lacks the actual resolved entity IDs needed by rule operations like `GET_NAME`.

**Impact**: Results in "Unnamed Character" output instead of actual entity names in narrative text.

## Dependencies

- Existing `ActionFormattingStage.js` implementation
- Multi-target resolution pipeline in `MultiTargetResolutionStage.js`
- Event bus system and event validation
- Target manager for resolved target information
- Rule execution system that consumes events

## Implementation Details

### 1. Analyze Current ActionFormattingStage Structure

First, examine the current event creation logic in `src/actions/pipeline/stages/ActionFormattingStage.js`:

```javascript
// Current problematic structure (example)
const event = {
  type: 'core:attempt_action',
  payload: {
    actorId: context.actorId,
    actionId: context.actionId,
    actionText: context.formattedText, // Contains "adjust primary's secondary"
    // MISSING: Resolved target IDs
  }
};
```

### 2. Enhance Event Payload Structure

**Target Event Payload Structure**:
```javascript
{
  "type": "core:attempt_action",
  "payload": {
    "actorId": "amaia_castillo_instance",
    "actionId": "intimacy:adjust_clothing",
    "actionText": "adjust Iker Aguirre's denim trucker jacket",
    
    // Backward compatibility fields (Priority 1)
    "primaryId": "p_erotica:iker_aguirre_instance",
    "secondaryId": "fd6a1e00-36b7-47cc-bdb2-4b65473614eb",
    "tertiaryId": null,
    
    // Forward compatibility comprehensive structure (Priority 2)
    "targets": {
      "primary": {
        "entityId": "p_erotica:iker_aguirre_instance",
        "placeholder": "primary",
        "description": "Iker Aguirre",
        "resolvedFromContext": false
      },
      "secondary": {
        "entityId": "fd6a1e00-36b7-47cc-bdb2-4b65473614eb",
        "placeholder": "secondary", 
        "description": "denim trucker jacket",
        "resolvedFromContext": true,
        "contextSource": "primary"
      }
    },
    
    // Metadata for debugging and validation
    "resolvedTargetCount": 2,
    "hasContextDependencies": true
  }
}
```

### 3. Modify ActionFormattingStage.js

**Step 3.1**: Add target resolution extraction logic

```javascript
/**
 * Extract resolved target information from context
 * @private
 * @param {Object} context - Action execution context
 * @returns {Object} - Target information for event payload
 */
#extractTargetInformation(context) {
  const targetInfo = {
    legacy: {}, // primaryId, secondaryId, tertiaryId
    comprehensive: {}, // targets object
    metadata: {
      resolvedTargetCount: 0,
      hasContextDependencies: false
    }
  };

  // Get target manager from context
  const targetManager = context.targetManager;
  if (!targetManager) {
    this.#logger.warn('No target manager found in context', {
      actionId: context.actionId,
      stage: 'ActionFormattingStage'
    });
    return targetInfo;
  }

  // Extract resolved targets
  const resolvedTargets = targetManager.getResolvedTargets();
  
  resolvedTargets.forEach((target, index) => {
    const placeholderName = this.#getPlaceholderName(index);
    const entityId = target.entityId;
    
    // Legacy format
    const legacyFieldName = `${placeholderName}Id`;
    targetInfo.legacy[legacyFieldName] = entityId;
    
    // Comprehensive format
    targetInfo.comprehensive[placeholderName] = {
      entityId: entityId,
      placeholder: placeholderName,
      description: target.description || this.#getEntityDescription(entityId),
      resolvedFromContext: target.fromContext || false,
      contextSource: target.contextSource || null
    };
    
    targetInfo.metadata.resolvedTargetCount++;
    if (target.fromContext) {
      targetInfo.metadata.hasContextDependencies = true;
    }
  });

  return targetInfo;
}

/**
 * Get placeholder name for target index
 * @private
 * @param {number} index - Target index
 * @returns {string} - Placeholder name
 */
#getPlaceholderName(index) {
  const placeholders = ['primary', 'secondary', 'tertiary'];
  if (index < placeholders.length) {
    return placeholders[index];
  }
  throw new Error(`Target index ${index} exceeds supported placeholder count`);
}

/**
 * Get entity description for display
 * @private  
 * @param {string} entityId - Entity ID
 * @returns {string} - Entity description
 */
#getEntityDescription(entityId) {
  try {
    // Use entity query manager to get entity name
    const entity = this.#entityQueryManager.getEntity(entityId);
    return entity?.name || 'Unknown Entity';
  } catch (error) {
    this.#logger.warn(`Failed to get description for entity ${entityId}`, error);
    return 'Unknown Entity';
  }
}
```

**Step 3.2**: Update event creation method

```javascript
/**
 * Create action attempt event with enhanced payload
 * @private
 * @param {Object} context - Action execution context
 * @returns {Object} - Event with enhanced payload
 */
#createActionAttemptEvent(context) {
  // Extract target information
  const targetInfo = this.#extractTargetInformation(context);
  
  // Build enhanced payload
  const payload = {
    actorId: context.actorId,
    actionId: context.actionId,
    actionText: context.formattedText,
    
    // Add legacy fields for backward compatibility
    ...targetInfo.legacy,
    
    // Add comprehensive targets object
    targets: targetInfo.comprehensive,
    
    // Add metadata
    resolvedTargetCount: targetInfo.metadata.resolvedTargetCount,
    hasContextDependencies: targetInfo.metadata.hasContextDependencies
  };

  const event = {
    type: 'core:attempt_action',
    payload: payload
  };

  // Log enhanced payload for debugging
  this.#logger.debug('Created enhanced action event', {
    actionId: context.actionId,
    targetCount: targetInfo.metadata.resolvedTargetCount,
    hasContextDeps: targetInfo.metadata.hasContextDependencies,
    legacyFields: Object.keys(targetInfo.legacy),
    targets: Object.keys(targetInfo.comprehensive)
  });

  return event;
}
```

**Step 3.3**: Add validation and error handling

```javascript
/**
 * Validate target information consistency
 * @private
 * @param {Object} targetInfo - Target information to validate
 * @param {Object} context - Action execution context
 * @throws {Error} - If validation fails
 */
#validateTargetInformation(targetInfo, context) {
  // Ensure required targets are present
  const action = context.actionDefinition;
  const requiredTargets = action.targets || [];
  
  const missingTargets = [];
  requiredTargets.forEach(targetDef => {
    const placeholder = targetDef.name;
    if (!targetInfo.comprehensive[placeholder]) {
      missingTargets.push(placeholder);
    }
  });
  
  if (missingTargets.length > 0) {
    throw new Error(
      `Missing required targets for action ${context.actionId}: ${missingTargets.join(', ')}`
    );
  }
  
  // Validate entity IDs exist
  const invalidEntities = [];
  Object.entries(targetInfo.comprehensive).forEach(([placeholder, info]) => {
    if (!this.#entityQueryManager.entityExists(info.entityId)) {
      invalidEntities.push({ placeholder, entityId: info.entityId });
    }
  });
  
  if (invalidEntities.length > 0) {
    const invalidList = invalidEntities.map(e => `${e.placeholder}:${e.entityId}`).join(', ');
    throw new Error(
      `Invalid entity IDs in target resolution for action ${context.actionId}: ${invalidList}`
    );
  }
}

/**
 * Handle target information extraction errors gracefully
 * @private
 * @param {Error} error - Error that occurred
 * @param {Object} context - Action execution context
 * @returns {Object} - Fallback target information
 */
#handleTargetExtractionError(error, context) {
  this.#logger.error('Failed to extract target information', {
    error: error.message,
    actionId: context.actionId,
    actorId: context.actorId,
    stage: 'ActionFormattingStage'
  });
  
  // Return minimal target info to prevent total failure
  return {
    legacy: {},
    comprehensive: {},
    metadata: {
      resolvedTargetCount: 0,
      hasContextDependencies: false,
      extractionError: error.message
    }
  };
}
```

### 4. Integration with MultiTargetResolutionStage

**Step 4.1**: Ensure target manager provides necessary information

```javascript
// In MultiTargetResolutionStage.js - ensure context contains target manager
#passToNextStage(context) {
  // Ensure target manager is available for ActionFormattingStage
  if (!context.targetManager) {
    throw new Error('Target manager missing from context');
  }
  
  // Validate target manager has resolved targets
  const resolvedCount = context.targetManager.getResolvedTargetCount();
  if (resolvedCount === 0) {
    this.#logger.warn('No targets resolved in MultiTargetResolutionStage', {
      actionId: context.actionId
    });
  }
  
  this.#logger.debug('Passing context with resolved targets', {
    resolvedTargetCount: resolvedCount,
    hasTargetManager: !!context.targetManager
  });
  
  return context;
}
```

**Step 4.2**: Add target manager interface requirements

```javascript
// Interface that target manager must implement
/**
 * Target manager interface for ActionFormattingStage integration
 */
class ITargetManager {
  /**
   * Get all resolved targets with metadata
   * @returns {Array<{entityId: string, description?: string, fromContext?: boolean, contextSource?: string}>}
   */
  getResolvedTargets() {
    throw new Error('Method must be implemented');
  }
  
  /**
   * Get count of resolved targets
   * @returns {number}
   */
  getResolvedTargetCount() {
    throw new Error('Method must be implemented');
  }
  
  /**
   * Check if target resolution has context dependencies
   * @returns {boolean}
   */
  hasContextDependencies() {
    throw new Error('Method must be implemented');
  }
}
```

### 5. Error Handling and Fallback Strategies

**Step 5.1**: Implement comprehensive error handling

```javascript
/**
 * Create action event with error handling and fallbacks
 * @param {Object} context - Action execution context
 * @returns {Object} - Action event
 */
createActionEvent(context) {
  try {
    // Validate context
    this.#validateContext(context);
    
    // Extract target information with error handling
    let targetInfo;
    try {
      targetInfo = this.#extractTargetInformation(context);
      this.#validateTargetInformation(targetInfo, context);
    } catch (targetError) {
      targetInfo = this.#handleTargetExtractionError(targetError, context);
    }
    
    // Create enhanced event
    const event = this.#createActionAttemptEvent(context, targetInfo);
    
    // Validate event structure
    this.#validateEventStructure(event);
    
    return event;
    
  } catch (error) {
    this.#logger.error('Failed to create action event', {
      error: error.message,
      actionId: context.actionId,
      actorId: context.actorId
    });
    
    // Create minimal fallback event
    return this.#createFallbackEvent(context, error);
  }
}

/**
 * Create fallback event when primary creation fails
 * @private
 * @param {Object} context - Action execution context
 * @param {Error} originalError - Original error
 * @returns {Object} - Minimal fallback event
 */
#createFallbackEvent(context, originalError) {
  return {
    type: 'core:attempt_action',
    payload: {
      actorId: context.actorId,
      actionId: context.actionId,
      actionText: context.formattedText || 'Action text unavailable',
      targets: {},
      resolvedTargetCount: 0,
      hasContextDependencies: false,
      error: 'Event creation failed',
      originalError: originalError.message
    }
  };
}
```

### 6. Backward Compatibility Measures

**Step 6.1**: Ensure existing consumers continue working

```javascript
/**
 * Ensure backward compatibility with existing event consumers
 * @private
 * @param {Object} payload - Event payload
 * @returns {Object} - Payload with backward compatibility
 */
#ensureBackwardCompatibility(payload) {
  // Always include legacy fields even if empty
  if (!payload.primaryId) payload.primaryId = null;
  if (!payload.secondaryId) payload.secondaryId = null;
  if (!payload.tertiaryId) payload.tertiaryId = null;
  
  // Ensure targets object exists
  if (!payload.targets) payload.targets = {};
  
  // Add fallback values for required fields
  if (!payload.resolvedTargetCount) payload.resolvedTargetCount = 0;
  if (typeof payload.hasContextDependencies === 'undefined') {
    payload.hasContextDependencies = false;
  }
  
  return payload;
}
```

### 7. Comprehensive Testing Integration

**Step 7.1**: Add internal validation methods

```javascript
/**
 * Validate enhanced event structure
 * @private
 * @param {Object} event - Event to validate
 * @throws {Error} - If validation fails
 */
#validateEventStructure(event) {
  // Basic structure validation
  if (!event.type || !event.payload) {
    throw new Error('Invalid event structure: missing type or payload');
  }
  
  const payload = event.payload;
  
  // Required fields
  const requiredFields = ['actorId', 'actionId', 'actionText'];
  requiredFields.forEach(field => {
    if (!payload[field]) {
      throw new Error(`Invalid event payload: missing ${field}`);
    }
  });
  
  // Validate targets object structure
  if (payload.targets) {
    Object.entries(payload.targets).forEach(([placeholder, info]) => {
      if (!info.entityId || !info.placeholder) {
        throw new Error(`Invalid target info for ${placeholder}: missing entityId or placeholder`);
      }
    });
  }
  
  // Validate consistency between legacy and comprehensive formats
  this.#validateTargetConsistency(payload);
}

/**
 * Validate consistency between legacy and comprehensive target formats
 * @private
 * @param {Object} payload - Event payload
 * @throws {Error} - If inconsistency found
 */
#validateTargetConsistency(payload) {
  const legacyFields = ['primaryId', 'secondaryId', 'tertiaryId'];
  const placeholders = ['primary', 'secondary', 'tertiary'];
  
  legacyFields.forEach((field, index) => {
    const placeholder = placeholders[index];
    const legacyValue = payload[field];
    const comprehensiveValue = payload.targets[placeholder]?.entityId;
    
    // If both exist, they must match
    if (legacyValue && comprehensiveValue && legacyValue !== comprehensiveValue) {
      throw new Error(
        `Target consistency error: ${field}=${legacyValue} but targets.${placeholder}.entityId=${comprehensiveValue}`
      );
    }
  });
}
```

### 8. Performance Considerations

**Step 8.1**: Implement efficient target information extraction

```javascript
/**
 * Optimized target information extraction with caching
 * @private
 * @param {Object} context - Action execution context
 * @returns {Object} - Cached or computed target information
 */
#extractTargetInformationOptimized(context) {
  // Check if target info is already cached in context
  if (context._targetInfoCache) {
    this.#logger.debug('Using cached target information');
    return context._targetInfoCache;
  }
  
  // Extract target information
  const targetInfo = this.#extractTargetInformation(context);
  
  // Cache for potential reuse
  context._targetInfoCache = targetInfo;
  
  return targetInfo;
}

/**
 * Batch entity description retrieval for performance
 * @private
 * @param {Array<string>} entityIds - Entity IDs to describe
 * @returns {Map<string, string>} - Map of entity ID to description
 */
#getEntityDescriptionsBatch(entityIds) {
  const descriptions = new Map();
  
  // Use batch query if available
  if (this.#entityQueryManager.getEntitiesBatch) {
    const entities = this.#entityQueryManager.getEntitiesBatch(entityIds);
    entities.forEach(entity => {
      descriptions.set(entity.id, entity.name || 'Unknown Entity');
    });
  } else {
    // Fallback to individual queries
    entityIds.forEach(id => {
      try {
        const entity = this.#entityQueryManager.getEntity(id);
        descriptions.set(id, entity?.name || 'Unknown Entity');
      } catch (error) {
        descriptions.set(id, 'Unknown Entity');
      }
    });
  }
  
  return descriptions;
}
```

### 9. Logging and Monitoring

**Step 9.1**: Add comprehensive logging for debugging

```javascript
/**
 * Log target resolution details for debugging
 * @private
 * @param {Object} context - Action execution context
 * @param {Object} targetInfo - Extracted target information
 */
#logTargetResolutionDetails(context, targetInfo) {
  const logData = {
    actionId: context.actionId,
    actorId: context.actorId,
    stage: 'ActionFormattingStage',
    targetResolution: {
      resolvedCount: targetInfo.metadata.resolvedTargetCount,
      hasContextDeps: targetInfo.metadata.hasContextDependencies,
      targets: {}
    }
  };
  
  // Log each target with details
  Object.entries(targetInfo.comprehensive).forEach(([placeholder, info]) => {
    logData.targetResolution.targets[placeholder] = {
      entityId: info.entityId,
      description: info.description,
      fromContext: info.resolvedFromContext,
      contextSource: info.contextSource
    };
  });
  
  this.#logger.info('Target resolution completed', logData);
}

/**
 * Log event creation metrics
 * @private
 * @param {Object} event - Created event
 * @param {number} processingTime - Time taken to create event
 */
#logEventCreationMetrics(event, processingTime) {
  const payload = event.payload;
  
  this.#logger.info('Action event created', {
    type: event.type,
    actionId: payload.actionId,
    targetCount: payload.resolvedTargetCount,
    hasContextDeps: payload.hasContextDependencies,
    processingTimeMs: processingTime,
    payloadSize: JSON.stringify(payload).length
  });
}
```

## Acceptance Criteria

### Primary Success Criteria
1. ✅ **Enhanced Event Payload**: Multi-target events include both legacy fields (`primaryId`, `secondaryId`, `tertiaryId`) and comprehensive `targets` object
2. ✅ **Resolved Entity IDs**: Event payload contains actual resolved entity IDs from multi-target resolution stage
3. ✅ **Backward Compatibility**: Existing event consumers continue working without modification
4. ✅ **Target Metadata**: Events include metadata about resolution (count, context dependencies)
5. ✅ **Error Handling**: Graceful handling of target extraction failures with fallback events

### Validation Criteria
6. ✅ **Consistency Validation**: Legacy and comprehensive target formats are consistent within same event
7. ✅ **Entity Validation**: All resolved entity IDs exist in the system
8. ✅ **Required Targets**: All action-required targets are present in event payload
9. ✅ **Event Structure**: Events conform to expected schema and structure
10. ✅ **Performance**: Target information extraction adds <5ms overhead to event creation

### Integration Criteria
11. ✅ **Target Manager Integration**: ActionFormattingStage successfully extracts information from TargetManager
12. ✅ **Pipeline Integration**: Enhanced events flow correctly through action pipeline
13. ✅ **Rule Compatibility**: Enhanced events provide necessary information for rule execution
14. ✅ **Debugging Support**: Comprehensive logging enables troubleshooting of target resolution issues

## Testing Requirements

### Unit Tests
```javascript
describe('ActionFormattingStage - Enhanced Event Payload', () => {
  describe('Target Information Extraction', () => {
    it('should extract target information with legacy and comprehensive formats', () => {
      const mockContext = createMockContext({
        targets: [
          { entityId: 'entity1', description: 'Entity One' },
          { entityId: 'entity2', description: 'Entity Two', fromContext: true }
        ]
      });
      
      const stage = new ActionFormattingStage(dependencies);
      const targetInfo = stage.extractTargetInformation(mockContext);
      
      expect(targetInfo.legacy.primaryId).toBe('entity1');
      expect(targetInfo.legacy.secondaryId).toBe('entity2');
      expect(targetInfo.comprehensive.primary.entityId).toBe('entity1');
      expect(targetInfo.comprehensive.secondary.resolvedFromContext).toBe(true);
      expect(targetInfo.metadata.resolvedTargetCount).toBe(2);
      expect(targetInfo.metadata.hasContextDependencies).toBe(true);
    });
    
    it('should handle missing target manager gracefully', () => {
      const mockContext = { actionId: 'test:action' };
      const stage = new ActionFormattingStage(dependencies);
      
      const targetInfo = stage.extractTargetInformation(mockContext);
      
      expect(targetInfo.metadata.resolvedTargetCount).toBe(0);
      expect(Object.keys(targetInfo.comprehensive)).toHaveLength(0);
    });
  });
  
  describe('Event Creation', () => {
    it('should create enhanced event with all required fields', () => {
      const mockContext = createMockContextWithTargets();
      const stage = new ActionFormattingStage(dependencies);
      
      const event = stage.createActionEvent(mockContext);
      
      expect(event.type).toBe('core:attempt_action');
      expect(event.payload.actorId).toBeDefined();
      expect(event.payload.actionId).toBeDefined();
      expect(event.payload.actionText).toBeDefined();
      expect(event.payload.targets).toBeDefined();
      expect(event.payload.resolvedTargetCount).toBeGreaterThan(0);
    });
    
    it('should maintain backward compatibility fields', () => {
      const mockContext = createMockContextWithTargets();
      const stage = new ActionFormattingStage(dependencies);
      
      const event = stage.createActionEvent(mockContext);
      
      expect(event.payload).toHaveProperty('primaryId');
      expect(event.payload).toHaveProperty('secondaryId');
      expect(event.payload).toHaveProperty('tertiaryId');
    });
  });
  
  describe('Error Handling', () => {
    it('should create fallback event when target extraction fails', () => {
      const mockContext = createMockContextWithInvalidTargets();
      const stage = new ActionFormattingStage(dependencies);
      
      const event = stage.createActionEvent(mockContext);
      
      expect(event.payload.error).toBeDefined();
      expect(event.payload.resolvedTargetCount).toBe(0);
      expect(event.payload.targets).toEqual({});
    });
  });
  
  describe('Validation', () => {
    it('should validate target consistency between formats', () => {
      const invalidPayload = {
        primaryId: 'entity1',
        targets: { primary: { entityId: 'entity2', placeholder: 'primary' } }
      };
      
      const stage = new ActionFormattingStage(dependencies);
      
      expect(() => stage.validateTargetConsistency(invalidPayload)).toThrow();
    });
  });
});
```

### Integration Tests
```javascript
describe('ActionFormattingStage Integration', () => {
  it('should integrate with MultiTargetResolutionStage output', async () => {
    const testBed = new ActionPipelineTestBed();
    await testBed.setupMultiTargetScenario();
    
    const context = await testBed.runThroughMultiTargetResolution({
      actionId: 'intimacy:adjust_clothing',
      targets: ['primary', 'secondary']
    });
    
    const formattingStage = new ActionFormattingStage(testBed.dependencies);
    const event = formattingStage.createActionEvent(context);
    
    expect(event.payload.primaryId).toBeTruthy();
    expect(event.payload.targets.primary.entityId).toBe(event.payload.primaryId);
    expect(event.payload.resolvedTargetCount).toBe(2);
  });
  
  it('should handle adjust_clothing action specifically', async () => {
    const testBed = new ActionPipelineTestBed();
    const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();
    
    const context = await testBed.createActionContext({
      actorId: amaia.id,
      actionId: 'intimacy:adjust_clothing',
      resolvedTargets: [
        { entityId: iker.id, description: 'Iker Aguirre' },
        { entityId: jacket.id, description: 'denim trucker jacket', fromContext: true }
      ]
    });
    
    const formattingStage = new ActionFormattingStage(testBed.dependencies);
    const event = formattingStage.createActionEvent(context);
    
    expect(event.payload.primaryId).toBe(iker.id);
    expect(event.payload.secondaryId).toBe(jacket.id);
    expect(event.payload.targets.primary.entityId).toBe(iker.id);
    expect(event.payload.targets.secondary.resolvedFromContext).toBe(true);
  });
});
```

## Performance Benchmarks

- Target information extraction: <2ms for typical multi-target action
- Event creation with enhanced payload: <5ms total overhead
- Memory usage increase: <1KB per enhanced event
- Payload size increase: 40-60% (acceptable for enhanced functionality)

## Dependencies and Prerequisites

### System Dependencies
- `src/actions/pipeline/stages/MultiTargetResolutionStage.js` - Provides resolved target information
- `src/entities/EntityQueryManager.js` - For entity validation and description retrieval
- `src/events/` - Event bus system for event dispatching
- Target manager implementation with required interface methods

### Testing Dependencies
- Jest testing framework with existing test utilities
- Mock implementations for dependencies
- Test bed classes for integration testing
- Performance testing utilities

## Notes and Considerations

### Implementation Order
1. **Phase 1**: Basic target information extraction and legacy field population
2. **Phase 2**: Comprehensive targets object implementation
3. **Phase 3**: Error handling and validation
4. **Phase 4**: Performance optimization and caching
5. **Phase 5**: Integration testing and validation

### Risk Mitigation
- **Backward Compatibility**: Always include legacy fields to ensure existing consumers work
- **Performance Impact**: Use caching and batch operations to minimize overhead
- **Error Resilience**: Graceful fallback ensures actions don't fail completely
- **Data Consistency**: Validate consistency between different target format representations

### Future Enhancements
- Support for more than 3 targets (quaternary, quinary, etc.)
- Target relationship mapping (e.g., which targets are related)
- Enhanced target metadata (types, categories, capabilities)
- Caching of frequently accessed target information
- Performance metrics and monitoring integration

This ticket establishes the foundation for solving the multi-target action issue by ensuring that resolved target information flows from the resolution stage to the rule execution stage through enhanced event payloads.