# Ticket 2: Rule Context Enhancement

## Overview

Enhance rule execution context to resolve placeholder names ("primary", "secondary", "tertiary") to actual entity IDs using the enhanced event payload from Ticket 1. This is the critical second step that enables rules to access resolved target information and eliminates "Unnamed Character" output.

## Problem Statement

**Current Issue**: Rules use `GET_NAME` operations with placeholder references like "primary" and "secondary", but the entity resolution system doesn't recognize these as valid entity IDs, causing lookups to fail and return "Unnamed Character".

**Root Cause**: Entity reference resolution logic doesn't understand placeholder names and can't map them to the actual resolved entity IDs available in the enhanced event payload.

**Target Behavior**: When a rule uses `{"type": "GET_NAME", "parameters": {"entity_ref": "primary"}}`, it should resolve "primary" to the actual entity ID from `event.payload.primaryId` or `event.payload.targets.primary.entityId`.

## Dependencies

- **Ticket 1**: Enhanced event payload structure with resolved target IDs
- Existing rule execution system and operation handlers  
- Entity reference resolution logic
- `GET_NAME` and other operation handlers that use entity references
- Rule context management system

## Implementation Details

### 1. Analyze Current Entity Reference Resolution

First, examine the current entity reference resolution in operation handlers:

```javascript
// Current problematic resolution (example from GET_NAME operation)
function resolveEntityReference(entityRef, context) {
  // Current logic only handles:
  // - Direct entity IDs: "core:player"
  // - Keywords: "actor", "target"  
  // - Object references: {"entity_id": "some_id"}
  
  if (typeof entityRef === 'string') {
    if (entityRef === 'actor') {
      return context.eventPayload.actorId;
    }
    if (entityRef === 'target') {
      return context.eventPayload.targetId; // Single target only
    }
    // Direct entity ID
    return entityRef;
  }
  
  if (typeof entityRef === 'object' && entityRef.entity_id) {
    return entityRef.entity_id;
  }
  
  // PROBLEM: No handling for placeholder names like "primary", "secondary"
  throw new Error(`Invalid entity reference: ${entityRef}`);
}
```

### 2. Enhance Entity Reference Resolution

**Step 2.1**: Add placeholder name recognition and resolution

```javascript
/**
 * Enhanced entity reference resolution with placeholder support
 * @param {string|Object} entityRef - Entity reference to resolve
 * @param {Object} context - Rule execution context with event payload
 * @returns {string|null} - Resolved entity ID or null if not found
 */
function resolveEntityReference(entityRef, context) {
  try {
    // Handle object references first
    if (typeof entityRef === 'object' && entityRef.entity_id) {
      return entityRef.entity_id;
    }
    
    if (typeof entityRef !== 'string') {
      throw new Error(`Invalid entity reference type: ${typeof entityRef}`);
    }
    
    // Handle traditional keywords
    if (entityRef === 'actor') {
      return context.eventPayload.actorId;
    }
    
    if (entityRef === 'target') {
      // Legacy single-target support
      return context.eventPayload.targetId || context.eventPayload.primaryId;
    }
    
    // NEW: Handle placeholder names for multi-target actions
    if (isPlaceholderName(entityRef)) {
      return resolveTargetPlaceholder(entityRef, context.eventPayload);
    }
    
    // Handle direct entity IDs
    if (isValidEntityId(entityRef)) {
      return entityRef;
    }
    
    throw new Error(`Unrecognized entity reference: ${entityRef}`);
    
  } catch (error) {
    // Enhanced error context for debugging
    context.logger?.warn('Entity reference resolution failed', {
      entityRef,
      error: error.message,
      availableTargets: getAvailableTargets(context.eventPayload),
      ruleId: context.ruleId,
      operationType: context.operationType
    });
    
    return null; // Let operation handler decide how to handle null
  }
}

/**
 * Check if a string is a recognized placeholder name
 * @param {string} name - Name to check
 * @returns {boolean} - True if it's a placeholder name
 */
function isPlaceholderName(name) {
  const PLACEHOLDER_NAMES = ['primary', 'secondary', 'tertiary'];
  return PLACEHOLDER_NAMES.includes(name);
}

/**
 * Resolve placeholder name to entity ID using event payload
 * @param {string} placeholder - Placeholder name (e.g., "primary")
 * @param {Object} eventPayload - Event payload with target information
 * @returns {string|null} - Resolved entity ID or null if not found
 */
function resolveTargetPlaceholder(placeholder, eventPayload) {
  // Try new comprehensive format first
  if (eventPayload.targets && eventPayload.targets[placeholder]) {
    const targetInfo = eventPayload.targets[placeholder];
    if (targetInfo.entityId) {
      return targetInfo.entityId;
    }
  }
  
  // Fall back to legacy format for backward compatibility
  const legacyFieldName = `${placeholder}Id`;
  const legacyEntityId = eventPayload[legacyFieldName];
  if (legacyEntityId) {
    return legacyEntityId;
  }
  
  // No resolution found
  return null;
}

/**
 * Get list of available targets for debugging
 * @param {Object} eventPayload - Event payload
 * @returns {Array<string>} - List of available target placeholder names
 */
function getAvailableTargets(eventPayload) {
  const available = [];
  
  // Check legacy format
  if (eventPayload.primaryId) available.push('primary');
  if (eventPayload.secondaryId) available.push('secondary');
  if (eventPayload.tertiaryId) available.push('tertiary');
  
  // Check comprehensive format
  if (eventPayload.targets) {
    Object.keys(eventPayload.targets).forEach(key => {
      if (!available.includes(key)) {
        available.push(key);
      }
    });
  }
  
  return available;
}

/**
 * Validate that entity ID format is valid
 * @param {string} entityId - Entity ID to validate
 * @returns {boolean} - True if valid format
 */
function isValidEntityId(entityId) {
  // Entity IDs can be:
  // - Namespaced: "mod:identifier"
  // - UUID: "fd6a1e00-36b7-47cc-bdb2-4b65473614eb"
  // - Special keywords: "none", "self"
  
  if (entityId === 'none' || entityId === 'self') {
    return true;
  }
  
  // UUID pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(entityId)) {
    return true;
  }
  
  // Namespaced pattern (mod:identifier)
  const namespacedPattern = /^[a-zA-Z0-9_]+:[a-zA-Z0-9_-]+$/;
  if (namespacedPattern.test(entityId)) {
    return true;
  }
  
  return false;
}
```

### 3. Update Operation Handlers

**Step 3.1**: Update GET_NAME operation handler

```javascript
/**
 * Enhanced GET_NAME operation handler with placeholder support
 * @param {Object} parameters - Operation parameters
 * @param {Object} context - Rule execution context
 * @returns {Object} - Operation result
 */
async function handleGetNameOperation(parameters, context) {
  const { entity_ref, result_variable } = parameters;
  
  // Validate required parameters
  if (!entity_ref) {
    throw new Error('GET_NAME operation requires entity_ref parameter');
  }
  
  if (!result_variable) {
    throw new Error('GET_NAME operation requires result_variable parameter');
  }
  
  try {
    // Resolve entity reference (now supports placeholders)
    const entityId = resolveEntityReference(entity_ref, context);
    
    if (!entityId) {
      // Enhanced error handling for placeholder resolution failures
      const errorMessage = isPlaceholderName(entity_ref) 
        ? `Failed to resolve placeholder '${entity_ref}' to entity ID. Available targets: ${getAvailableTargets(context.eventPayload).join(', ')}`
        : `Failed to resolve entity reference '${entity_ref}'`;
      
      context.logger?.error('GET_NAME operation failed', {
        entityRef: entity_ref,
        error: errorMessage,
        ruleId: context.ruleId,
        availableTargets: getAvailableTargets(context.eventPayload)
      });
      
      // Set fallback value instead of throwing
      context.setVariable(result_variable, 'Unnamed Character');
      return {
        success: false,
        error: errorMessage,
        fallbackUsed: true
      };
    }
    
    // Get entity name using resolved ID
    const entityName = await getEntityName(entityId, context);
    
    if (!entityName) {
      context.logger?.warn('Entity name not found', {
        entityId,
        originalRef: entity_ref,
        ruleId: context.ruleId
      });
      
      context.setVariable(result_variable, 'Unnamed Character');
      return {
        success: false,
        error: `Entity not found: ${entityId}`,
        fallbackUsed: true
      };
    }
    
    // Success: Set the resolved name
    context.setVariable(result_variable, entityName);
    
    context.logger?.debug('GET_NAME operation successful', {
      entityRef: entity_ref,
      resolvedId: entityId,
      resolvedName: entityName,
      resultVariable: result_variable
    });
    
    return {
      success: true,
      resolvedEntityId: entityId,
      resolvedName: entityName
    };
    
  } catch (error) {
    context.logger?.error('GET_NAME operation exception', {
      entityRef: entity_ref,
      error: error.message,
      ruleId: context.ruleId
    });
    
    // Graceful fallback
    context.setVariable(result_variable, 'Unnamed Character');
    return {
      success: false,
      error: error.message,
      fallbackUsed: true
    };
  }
}

/**
 * Get entity name by ID with caching
 * @param {string} entityId - Entity ID
 * @param {Object} context - Rule execution context
 * @returns {Promise<string|null>} - Entity name or null
 */
async function getEntityName(entityId, context) {
  // Check cache first
  if (context.entityNameCache && context.entityNameCache.has(entityId)) {
    return context.entityNameCache.get(entityId);
  }
  
  try {
    // Query entity from entity manager
    const entity = await context.entityQueryManager.getEntity(entityId);
    const name = entity?.name || null;
    
    // Cache result
    if (!context.entityNameCache) {
      context.entityNameCache = new Map();
    }
    context.entityNameCache.set(entityId, name);
    
    return name;
    
  } catch (error) {
    context.logger?.warn(`Failed to get entity name for ${entityId}`, error);
    return null;
  }
}
```

**Step 3.2**: Update other operation handlers using entity references

```javascript
/**
 * Enhanced GET_PROPERTY operation handler with placeholder support
 */
async function handleGetPropertyOperation(parameters, context) {
  const { entity_ref, property_name, result_variable } = parameters;
  
  // Resolve entity reference (now supports placeholders)
  const entityId = resolveEntityReference(entity_ref, context);
  
  if (!entityId) {
    context.logger?.error('GET_PROPERTY: Failed to resolve entity reference', {
      entityRef: entity_ref,
      propertyName: property_name
    });
    
    context.setVariable(result_variable, null);
    return { success: false, error: 'Entity reference resolution failed' };
  }
  
  // Get property value using resolved entity ID
  const propertyValue = await getEntityProperty(entityId, property_name, context);
  context.setVariable(result_variable, propertyValue);
  
  return { success: true, resolvedEntityId: entityId, propertyValue };
}

/**
 * Enhanced CHECK_RELATIONSHIP operation handler with placeholder support
 */
async function handleCheckRelationshipOperation(parameters, context) {
  const { entity1_ref, entity2_ref, relationship_type, result_variable } = parameters;
  
  // Resolve both entity references (now supports placeholders)
  const entity1Id = resolveEntityReference(entity1_ref, context);
  const entity2Id = resolveEntityReference(entity2_ref, context);
  
  if (!entity1Id || !entity2Id) {
    context.logger?.error('CHECK_RELATIONSHIP: Failed to resolve entity references', {
      entity1Ref: entity1_ref,
      entity2Ref: entity2_ref,
      resolved1: entity1Id,
      resolved2: entity2Id
    });
    
    context.setVariable(result_variable, false);
    return { success: false, error: 'Entity reference resolution failed' };
  }
  
  // Check relationship using resolved entity IDs
  const hasRelationship = await checkEntityRelationship(entity1Id, entity2Id, relationship_type, context);
  context.setVariable(result_variable, hasRelationship);
  
  return { 
    success: true, 
    resolvedEntity1Id: entity1Id,
    resolvedEntity2Id: entity2Id,
    hasRelationship 
  };
}
```

### 4. Enhance Rule Context Management

**Step 4.1**: Extend rule context with placeholder resolution capabilities

```javascript
/**
 * Enhanced rule execution context with multi-target support
 */
class EnhancedRuleContext {
  constructor({ eventPayload, logger, entityQueryManager, ruleId }) {
    this.eventPayload = eventPayload;
    this.logger = logger;
    this.entityQueryManager = entityQueryManager;
    this.ruleId = ruleId;
    this.variables = new Map();
    this.entityNameCache = new Map();
    this.operationResults = [];
  }
  
  /**
   * Resolve entity reference with enhanced multi-target support
   * @param {string|Object} entityRef - Entity reference to resolve
   * @returns {string|null} - Resolved entity ID
   */
  resolveEntityReference(entityRef) {
    return resolveEntityReference(entityRef, this);
  }
  
  /**
   * Get available target placeholders for debugging
   * @returns {Array<string>} - Available placeholder names
   */
  getAvailableTargets() {
    return getAvailableTargets(this.eventPayload);
  }
  
  /**
   * Validate that required targets are available
   * @param {Array<string>} requiredPlaceholders - Required placeholder names
   * @returns {Object} - Validation result
   */
  validateRequiredTargets(requiredPlaceholders) {
    const missing = [];
    const resolved = {};
    
    requiredPlaceholders.forEach(placeholder => {
      const entityId = resolveTargetPlaceholder(placeholder, this.eventPayload);
      if (entityId) {
        resolved[placeholder] = entityId;
      } else {
        missing.push(placeholder);
      }
    });
    
    return {
      valid: missing.length === 0,
      missing,
      resolved,
      available: this.getAvailableTargets()
    };
  }
  
  /**
   * Set variable value with type tracking
   * @param {string} name - Variable name
   * @param {any} value - Variable value
   */
  setVariable(name, value) {
    this.variables.set(name, {
      value,
      type: typeof value,
      setAt: Date.now()
    });
  }
  
  /**
   * Get variable value
   * @param {string} name - Variable name
   * @returns {any} - Variable value
   */
  getVariable(name) {
    const variable = this.variables.get(name);
    return variable ? variable.value : undefined;
  }
  
  /**
   * Add operation result for debugging
   * @param {string} operationType - Type of operation
   * @param {Object} result - Operation result
   */
  addOperationResult(operationType, result) {
    this.operationResults.push({
      operationType,
      result,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get execution summary for debugging
   * @returns {Object} - Execution summary
   */
  getExecutionSummary() {
    return {
      ruleId: this.ruleId,
      eventType: this.eventPayload.type,
      actionId: this.eventPayload.actionId,
      availableTargets: this.getAvailableTargets(),
      variablesSet: Array.from(this.variables.keys()),
      operationsExecuted: this.operationResults.length,
      cacheHits: this.entityNameCache.size
    };
  }
}
```

### 5. Error Handling and Debugging

**Step 5.1**: Implement comprehensive error handling

```javascript
/**
 * Enhanced error handling for placeholder resolution
 */
class TargetResolutionError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = 'TargetResolutionError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Handle entity reference resolution errors gracefully
 * @param {Error} error - Error that occurred
 * @param {string} entityRef - Original entity reference
 * @param {Object} context - Rule execution context
 * @returns {string|null} - Fallback entity ID or null
 */
function handleEntityResolutionError(error, entityRef, context) {
  const errorContext = {
    entityRef,
    ruleId: context.ruleId,
    availableTargets: getAvailableTargets(context.eventPayload),
    eventType: context.eventPayload.type,
    actionId: context.eventPayload.actionId
  };
  
  if (isPlaceholderName(entityRef)) {
    // Specific handling for placeholder resolution failures
    context.logger?.error('Placeholder resolution failed', {
      ...errorContext,
      error: error.message,
      placeholderName: entityRef,
      errorType: 'TARGET_PLACEHOLDER_NOT_FOUND'
    });
    
    // Dispatch error event for monitoring
    if (context.eventBus) {
      context.eventBus.dispatch({
        type: 'RULE_EXECUTION_ERROR',
        payload: {
          errorType: 'TARGET_PLACEHOLDER_NOT_FOUND',
          placeholder: entityRef,
          ruleId: context.ruleId,
          actionId: context.eventPayload.actionId,
          availableTargets: getAvailableTargets(context.eventPayload)
        }
      });
    }
  } else {
    // General entity resolution error
    context.logger?.error('Entity reference resolution failed', {
      ...errorContext,
      error: error.message,
      errorType: 'ENTITY_REFERENCE_INVALID'
    });
  }
  
  return null; // Let operation handler decide fallback behavior
}

/**
 * Create detailed error for placeholder resolution failure
 * @param {string} placeholder - Placeholder that failed to resolve
 * @param {Object} eventPayload - Event payload
 * @returns {TargetResolutionError} - Detailed error
 */
function createPlaceholderResolutionError(placeholder, eventPayload) {
  const available = getAvailableTargets(eventPayload);
  
  return new TargetResolutionError(
    'TARGET_PLACEHOLDER_NOT_FOUND',
    `Unable to resolve placeholder '${placeholder}' to entity ID`,
    {
      placeholder,
      availableTargets: available,
      hasTargets: available.length > 0,
      eventType: eventPayload.type,
      actionId: eventPayload.actionId,
      suggestions: available.length > 0 
        ? `Available targets: ${available.join(', ')}`
        : 'No targets available in event payload'
    }
  );
}
```

### 6. Integration with Rule Engine

**Step 6.1**: Update rule execution engine to use enhanced context

```javascript
/**
 * Enhanced rule execution with multi-target context
 */
class EnhancedRuleExecutor {
  constructor({ logger, entityQueryManager, eventBus }) {
    this.logger = logger;
    this.entityQueryManager = entityQueryManager;
    this.eventBus = eventBus;
  }
  
  /**
   * Execute rule with enhanced context
   * @param {Object} rule - Rule to execute
   * @param {Object} eventPayload - Event payload with target information
   * @returns {Promise<Object>} - Execution result
   */
  async executeRule(rule, eventPayload) {
    const startTime = Date.now();
    
    // Create enhanced context
    const context = new EnhancedRuleContext({
      eventPayload,
      logger: this.logger,
      entityQueryManager: this.entityQueryManager,
      ruleId: rule.id
    });
    
    try {
      // Pre-execution validation
      const preValidation = this.validateRuleContext(rule, context);
      if (!preValidation.valid) {
        return {
          success: false,
          error: 'Rule context validation failed',
          details: preValidation
        };
      }
      
      // Execute rule operations
      const result = await this.executeRuleOperations(rule.operations, context);
      
      // Post-execution logging
      const executionTime = Date.now() - startTime;
      this.logger.info('Rule execution completed', {
        ruleId: rule.id,
        success: result.success,
        executionTimeMs: executionTime,
        operationsExecuted: context.operationResults.length,
        variablesSet: context.variables.size,
        summary: context.getExecutionSummary()
      });
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('Rule execution failed', {
        ruleId: rule.id,
        error: error.message,
        executionTimeMs: executionTime,
        context: context.getExecutionSummary()
      });
      
      return {
        success: false,
        error: error.message,
        context: context.getExecutionSummary()
      };
    }
  }
  
  /**
   * Validate rule context before execution
   * @param {Object} rule - Rule to validate
   * @param {EnhancedRuleContext} context - Rule context
   * @returns {Object} - Validation result
   */
  validateRuleContext(rule, context) {
    // Extract placeholder references from rule operations
    const placeholderRefs = this.extractPlaceholderReferences(rule.operations);
    
    if (placeholderRefs.length === 0) {
      // No placeholders used, validation passes
      return { valid: true };
    }
    
    // Validate that all placeholder references can be resolved
    const validation = context.validateRequiredTargets(placeholderRefs);
    
    if (!validation.valid) {
      this.logger.warn('Rule validation failed: missing targets', {
        ruleId: rule.id,
        requiredTargets: placeholderRefs,
        missingTargets: validation.missing,
        availableTargets: validation.available
      });
    }
    
    return validation;
  }
  
  /**
   * Extract placeholder references from rule operations
   * @param {Array} operations - Rule operations
   * @returns {Array<string>} - Placeholder names used
   */
  extractPlaceholderReferences(operations) {
    const placeholders = new Set();
    
    operations.forEach(operation => {
      // Check operation parameters for entity references
      Object.values(operation.parameters || {}).forEach(param => {
        if (typeof param === 'string' && isPlaceholderName(param)) {
          placeholders.add(param);
        }
        // Handle nested parameters
        if (typeof param === 'object' && param.entity_ref && isPlaceholderName(param.entity_ref)) {
          placeholders.add(param.entity_ref);
        }
      });
    });
    
    return Array.from(placeholders);
  }
}
```

### 7. Testing and Validation Utilities

**Step 7.1**: Add testing utilities for rule context

```javascript
/**
 * Test utilities for enhanced rule context
 */
class RuleContextTestUtils {
  /**
   * Create mock enhanced context for testing
   * @param {Object} options - Context options
   * @returns {EnhancedRuleContext} - Mock context
   */
  static createMockContext(options = {}) {
    const defaultPayload = {
      type: 'core:attempt_action',
      actorId: 'test_actor',
      actionId: 'test:action',
      primaryId: 'test_primary_entity',
      secondaryId: 'test_secondary_entity',
      targets: {
        primary: {
          entityId: 'test_primary_entity',
          placeholder: 'primary',
          description: 'Test Primary Entity'
        },
        secondary: {
          entityId: 'test_secondary_entity', 
          placeholder: 'secondary',
          description: 'Test Secondary Entity'
        }
      }
    };
    
    const mockEntityQueryManager = {
      getEntity: jest.fn().mockImplementation((id) => ({
        id,
        name: `Mock Entity ${id}`
      }))
    };
    
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    return new EnhancedRuleContext({
      eventPayload: { ...defaultPayload, ...options.eventPayload },
      logger: options.logger || mockLogger,
      entityQueryManager: options.entityQueryManager || mockEntityQueryManager,
      ruleId: options.ruleId || 'test_rule'
    });
  }
  
  /**
   * Create mock rule with placeholder references
   * @param {Array<string>} placeholders - Placeholder names to use
   * @returns {Object} - Mock rule
   */
  static createMockRuleWithPlaceholders(placeholders = ['primary']) {
    const operations = placeholders.map(placeholder => ({
      type: 'GET_NAME',
      parameters: {
        entity_ref: placeholder,
        result_variable: `${placeholder}Name`
      }
    }));
    
    return {
      id: 'test_rule_with_placeholders',
      operations
    };
  }
  
  /**
   * Assert that context can resolve all placeholders
   * @param {EnhancedRuleContext} context - Context to test
   * @param {Array<string>} expectedPlaceholders - Expected placeholders
   */
  static assertPlaceholderResolution(context, expectedPlaceholders) {
    expectedPlaceholders.forEach(placeholder => {
      const resolved = context.resolveEntityReference(placeholder);
      expect(resolved).toBeTruthy();
      expect(resolved).not.toBe('Unnamed Character');
    });
  }
}
```

## Acceptance Criteria

### Primary Success Criteria
1. ✅ **Placeholder Recognition**: Entity reference resolution recognizes "primary", "secondary", "tertiary" as placeholder names
2. ✅ **Placeholder Resolution**: Placeholder names resolve to actual entity IDs from enhanced event payload
3. ✅ **GET_NAME Operation**: GET_NAME operations with placeholder references return actual entity names instead of "Unnamed Character"
4. ✅ **Multiple Operation Support**: All operation handlers using entity references support placeholder resolution
5. ✅ **Backward Compatibility**: Existing entity reference types (keywords, direct IDs, objects) continue working

### Error Handling Criteria
6. ✅ **Graceful Fallback**: Failed placeholder resolution results in fallback behavior rather than system crash
7. ✅ **Detailed Error Messages**: Error messages provide specific information about resolution failures
8. ✅ **Available Target Reporting**: Error messages include list of available targets for debugging
9. ✅ **Error Event Dispatching**: Resolution failures dispatch error events for monitoring
10. ✅ **Context Validation**: Rule context validates required targets before execution

### Performance Criteria
11. ✅ **Entity Name Caching**: Entity names are cached within rule execution context to avoid duplicate queries
12. ✅ **Resolution Performance**: Placeholder resolution adds <1ms overhead to operation execution
13. ✅ **Memory Efficiency**: Enhanced context uses reasonable memory for caching and state
14. ✅ **Error Handling Performance**: Error handling doesn't significantly impact performance

### Integration Criteria
15. ✅ **Enhanced Event Payload**: Successfully consumes enhanced event payload from Ticket 1
16. ✅ **Rule Engine Integration**: Integrates seamlessly with existing rule execution engine
17. ✅ **Operation Handler Updates**: All relevant operation handlers updated to support placeholders
18. ✅ **Debugging Support**: Comprehensive logging enables troubleshooting of resolution issues

## Testing Requirements

### Unit Tests
```javascript
describe('Enhanced Entity Reference Resolution', () => {
  describe('Placeholder Recognition', () => {
    it('should recognize valid placeholder names', () => {
      expect(isPlaceholderName('primary')).toBe(true);
      expect(isPlaceholderName('secondary')).toBe(true);
      expect(isPlaceholderName('tertiary')).toBe(true);
      expect(isPlaceholderName('invalid')).toBe(false);
      expect(isPlaceholderName('actor')).toBe(false);
    });
  });
  
  describe('Placeholder Resolution', () => {
    it('should resolve placeholder from comprehensive format', () => {
      const eventPayload = {
        targets: {
          primary: { entityId: 'entity_123', placeholder: 'primary' }
        }
      };
      
      const resolved = resolveTargetPlaceholder('primary', eventPayload);
      expect(resolved).toBe('entity_123');
    });
    
    it('should resolve placeholder from legacy format', () => {
      const eventPayload = {
        primaryId: 'entity_456'
      };
      
      const resolved = resolveTargetPlaceholder('primary', eventPayload);
      expect(resolved).toBe('entity_456');
    });
    
    it('should return null for unresolvable placeholder', () => {
      const eventPayload = {};
      const resolved = resolveTargetPlaceholder('primary', eventPayload);
      expect(resolved).toBeNull();
    });
  });
  
  describe('Full Entity Reference Resolution', () => {
    let mockContext;
    
    beforeEach(() => {
      mockContext = RuleContextTestUtils.createMockContext();
    });
    
    it('should resolve placeholder entity references', () => {
      const resolved = resolveEntityReference('primary', mockContext);
      expect(resolved).toBe('test_primary_entity');
    });
    
    it('should resolve traditional entity references', () => {
      const resolved = resolveEntityReference('actor', mockContext);
      expect(resolved).toBe('test_actor');
    });
    
    it('should resolve direct entity IDs', () => {
      const resolved = resolveEntityReference('core:player', mockContext);
      expect(resolved).toBe('core:player');
    });
    
    it('should handle object entity references', () => {
      const resolved = resolveEntityReference({ entity_id: 'test_entity' }, mockContext);
      expect(resolved).toBe('test_entity');
    });
  });
});

describe('Enhanced GET_NAME Operation', () => {
  let mockContext;
  
  beforeEach(() => {
    mockContext = RuleContextTestUtils.createMockContext();
  });
  
  it('should resolve placeholder reference to entity name', async () => {
    const result = await handleGetNameOperation(
      { entity_ref: 'primary', result_variable: 'primaryName' },
      mockContext
    );
    
    expect(result.success).toBe(true);
    expect(result.resolvedName).toBe('Mock Entity test_primary_entity');
    expect(mockContext.getVariable('primaryName')).toBe('Mock Entity test_primary_entity');
  });
  
  it('should handle failed placeholder resolution gracefully', async () => {
    const contextWithoutTargets = RuleContextTestUtils.createMockContext({
      eventPayload: { type: 'core:attempt_action', actorId: 'test_actor' }
    });
    
    const result = await handleGetNameOperation(
      { entity_ref: 'primary', result_variable: 'primaryName' },
      contextWithoutTargets
    );
    
    expect(result.success).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(contextWithoutTargets.getVariable('primaryName')).toBe('Unnamed Character');
  });
});

describe('EnhancedRuleContext', () => {
  it('should validate required targets correctly', () => {
    const context = RuleContextTestUtils.createMockContext();
    
    const validation = context.validateRequiredTargets(['primary', 'secondary']);
    expect(validation.valid).toBe(true);
    expect(validation.resolved.primary).toBe('test_primary_entity');
    expect(validation.resolved.secondary).toBe('test_secondary_entity');
  });
  
  it('should detect missing targets', () => {
    const context = RuleContextTestUtils.createMockContext({
      eventPayload: { type: 'core:attempt_action', actorId: 'test_actor' }
    });
    
    const validation = context.validateRequiredTargets(['primary', 'secondary']);
    expect(validation.valid).toBe(false);
    expect(validation.missing).toEqual(['primary', 'secondary']);
  });
});
```

### Integration Tests
```javascript
describe('Rule Context Integration', () => {
  it('should execute rule with placeholder references successfully', async () => {
    const rule = RuleContextTestUtils.createMockRuleWithPlaceholders(['primary', 'secondary']);
    const eventPayload = {
      type: 'core:attempt_action',
      actorId: 'amaia_castillo_instance',
      actionId: 'intimacy:adjust_clothing',
      primaryId: 'iker_aguirre_instance',
      secondaryId: 'jacket_instance',
      targets: {
        primary: {
          entityId: 'iker_aguirre_instance',
          placeholder: 'primary',
          description: 'Iker Aguirre'
        },
        secondary: {
          entityId: 'jacket_instance',
          placeholder: 'secondary',
          description: 'denim trucker jacket'
        }
      }
    };
    
    const executor = new EnhancedRuleExecutor({
      logger: mockLogger,
      entityQueryManager: mockEntityQueryManager,
      eventBus: mockEventBus
    });
    
    const result = await executor.executeRule(rule, eventPayload);
    
    expect(result.success).toBe(true);
    // Verify that placeholder resolution worked
    // (specific assertions depend on rule executor implementation)
  });
  
  it('should handle adjust_clothing rule specifically', async () => {
    const adjustClothingRule = {
      id: 'intimacy:handle_adjust_clothing',
      operations: [
        {
          type: 'GET_NAME',
          parameters: { entity_ref: 'primary', result_variable: 'primaryName' }
        },
        {
          type: 'GET_NAME', 
          parameters: { entity_ref: 'secondary', result_variable: 'garmentName' }
        }
      ]
    };
    
    // Test with realistic event payload
    const eventPayload = createAdjustClothingEventPayload();
    
    const executor = new EnhancedRuleExecutor(dependencies);
    const result = await executor.executeRule(adjustClothingRule, eventPayload);
    
    expect(result.success).toBe(true);
    // Verify that actual names are resolved, not "Unnamed Character"
  });
});
```

## Performance Benchmarks

- Placeholder resolution: <0.5ms per placeholder
- Enhanced entity reference resolution: <1ms overhead vs. original
- Rule context creation: <2ms with caching enabled
- Operation execution with placeholders: <5ms for typical GET_NAME operation

## Dependencies and Prerequisites

### System Dependencies
- **Ticket 1**: Enhanced event payload structure with resolved target IDs
- Existing rule execution engine and operation handlers
- Entity query manager for entity lookups
- Event bus system for error event dispatching

### Testing Dependencies  
- Jest testing framework with existing test utilities
- Mock implementations for dependencies
- Test bed classes for rule execution testing

## Notes and Considerations

### Implementation Order
1. **Phase 1**: Basic placeholder recognition and resolution logic
2. **Phase 2**: Enhanced entity reference resolution function
3. **Phase 3**: Update GET_NAME operation handler
4. **Phase 4**: Update other operation handlers using entity references
5. **Phase 5**: Enhanced rule context and executor
6. **Phase 6**: Error handling and debugging features
7. **Phase 7**: Integration testing and validation

### Risk Mitigation
- **Backward Compatibility**: All existing entity reference types continue working
- **Graceful Fallback**: Failed resolution results in "Unnamed Character" rather than system crash
- **Performance Impact**: Caching prevents duplicate entity queries
- **Error Visibility**: Comprehensive logging enables quick debugging

### Future Enhancements
- Support for dynamic placeholder names (beyond primary/secondary/tertiary)
- Placeholder aliasing (e.g., "target1" → "primary")
- Cross-reference resolution (e.g., "primary.owner" for relationship traversal)
- Performance optimization with global entity name cache
- Rule dependency analysis based on placeholder usage

This ticket enables rules to access resolved target information through placeholder names, directly addressing the core issue causing "Unnamed Character" output in multi-target actions.