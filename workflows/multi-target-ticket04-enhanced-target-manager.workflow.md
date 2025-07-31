# Ticket 4: Enhanced Target Manager

## Overview

Extend the existing `TargetManager` with placeholder-to-entity-ID mapping APIs and enhanced target management capabilities. This provides the necessary interface for the `ActionFormattingStage` to extract target information and creates a comprehensive target management system that supports the multi-target action enhancement.

## Problem Statement

**Current Issue**: The existing `TargetManager` focuses on target resolution during the multi-target resolution stage but doesn't provide the APIs needed by other components to access resolved target information in a structured way.

**Root Cause**: `TargetManager` lacks methods to:
- Retrieve resolved targets with metadata 
- Map placeholder names to entity IDs
- Validate target resolution completeness
- Provide target information for event payload enhancement

**Target Enhancement**: Extend `TargetManager` with comprehensive APIs that support the multi-target action system while maintaining backward compatibility.

## Dependencies

- Existing `TargetManager` implementation in `MultiTargetResolutionStage`
- **Ticket 1**: Event payload enhancement requirements
- **Ticket 3**: Target reference resolver service integration
- Entity query manager for entity information
- Logging system for debugging

## Implementation Details

### 1. Analyze Current TargetManager Structure

First, examine the existing `TargetManager` implementation:

```javascript
// Current TargetManager structure (example)
class TargetManager {
  constructor({ logger }) {
    this.#logger = logger;
    this.targets = []; // Array of resolved targets
  }
  
  addTarget(target) {
    this.targets.push(target);
  }
  
  getTargets() {
    return this.targets;
  }
  
  // Need to add more comprehensive APIs...
}
```

### 2. Enhanced Target Manager API

**Step 2.1**: Extend with comprehensive target management methods

```javascript
/**
 * Enhanced TargetManager with placeholder-to-entity-ID mapping
 */
class EnhancedTargetManager {
  constructor({ logger, entityQueryManager }) {
    this.#logger = ensureValidLogger(logger);
    this.#entityQueryManager = validateDependency(entityQueryManager, 'IEntityQueryManager');
    
    // Internal target storage
    this.#targets = new Map(); // Map<placeholderName, TargetInfo>
    this.#resolutionMetadata = {
      totalTargets: 0,
      resolvedTargets: 0,
      contextDependencies: 0,
      resolutionStartTime: null,
      resolutionEndTime: null
    };
  }
  
  #logger;
  #entityQueryManager;
  #targets;
  #resolutionMetadata;
  
  /**
   * Add a resolved target with comprehensive information
   * @param {string} placeholderName - Placeholder name (e.g., "primary", "secondary")
   * @param {string} entityId - Resolved entity ID
   * @param {Object} metadata - Additional target metadata
   */
  addResolvedTarget(placeholderName, entityId, metadata = {}) {
    assertNonBlankString(placeholderName, 'Placeholder name');
    assertNonBlankString(entityId, 'Entity ID');
    
    const targetInfo = {
      placeholderName,
      entityId,
      description: metadata.description || null,
      resolvedFromContext: metadata.resolvedFromContext || false,
      contextSource: metadata.contextSource || null,
      resolutionMethod: metadata.resolutionMethod || 'direct',
      timestamp: Date.now(),
      ...metadata
    };
    
    // Store target info
    this.#targets.set(placeholderName, targetInfo);
    this.#resolutionMetadata.resolvedTargets++;
    
    if (targetInfo.resolvedFromContext) {
      this.#resolutionMetadata.contextDependencies++;
    }
    
    this.#logger.debug('Target added to manager', {
      placeholder: placeholderName,
      entityId,
      fromContext: targetInfo.resolvedFromContext,
      method: targetInfo.resolutionMethod
    });
  }
  
  /**
   * Get entity ID by placeholder name
   * @param {string} placeholderName - Placeholder name (e.g., "primary")
   * @returns {string|null} - Entity ID or null if not found
   */
  getEntityIdByPlaceholder(placeholderName) {
    const targetInfo = this.#targets.get(placeholderName);
    return targetInfo ? targetInfo.entityId : null;
  }
  
  /**
   * Get complete target information by placeholder name
   * @param {string} placeholderName - Placeholder name
   * @returns {TargetInfo|null} - Complete target information or null
   */
  getTargetInfo(placeholderName) {
    return this.#targets.get(placeholderName) || null;
  }
  
  /**
   * Get all target mappings as placeholder-to-entityId object
   * @returns {Object} - Object mapping placeholder names to entity IDs
   */
  getTargetMappings() {
    const mappings = {};
    for (const [placeholder, targetInfo] of this.#targets.entries()) {
      mappings[placeholder] = targetInfo.entityId;
    }
    return mappings;
  }
  
  /**
   * Get all resolved targets with metadata for ActionFormattingStage
   * @returns {Array<TargetInfo>} - Array of target information objects
   */
  getResolvedTargets() {
    return Array.from(this.#targets.values());
  }
  
  /**
   * Get count of resolved targets
   * @returns {number} - Number of resolved targets
   */
  getResolvedTargetCount() {
    return this.#targets.size;
  }
  
  /**
   * Check if target resolution has context dependencies
   * @returns {boolean} - True if any target was resolved from context
   */
  hasContextDependencies() {
    return this.#resolutionMetadata.contextDependencies > 0;
  }
  
  /**
   * Validate that all required placeholders have resolved targets
   * @param {Array<string>} requiredPlaceholders - Array of required placeholder names
   * @returns {ValidationResult} - Validation result with details
   */
  validateRequiredTargets(requiredPlaceholders) {
    const result = {
      valid: true,
      resolved: [],
      missing: [],
      available: this.getAvailablePlaceholders(),
      details: []
    };
    
    requiredPlaceholders.forEach(placeholder => {
      const targetInfo = this.#targets.get(placeholder);
      
      if (targetInfo) {
        result.resolved.push(placeholder);
        result.details.push({
          placeholder,
          status: 'resolved',
          entityId: targetInfo.entityId,
          method: targetInfo.resolutionMethod
        });
      } else {
        result.missing.push(placeholder);
        result.valid = false;
        result.details.push({
          placeholder,
          status: 'missing',
          error: 'No target resolved for placeholder'
        });
      }
    });
    
    this.#logger.debug('Target validation completed', {
      requiredCount: requiredPlaceholders.length,
      resolvedCount: result.resolved.length,
      missingCount: result.missing.length,
      valid: result.valid
    });
    
    return result;
  }
  
  /**
   * Get list of available placeholder names
   * @returns {Array<string>} - Array of available placeholder names
   */
  getAvailablePlaceholders() {
    return Array.from(this.#targets.keys()).sort();
  }
  
  /**
   * Check if a specific placeholder has been resolved
   * @param {string} placeholderName - Placeholder name to check
   * @returns {boolean} - True if placeholder has been resolved
   */
  hasResolvedTarget(placeholderName) {
    return this.#targets.has(placeholderName);
  }
  
  /**
   * Get comprehensive resolution metadata
   * @returns {Object} - Resolution metadata and statistics
   */
  getResolutionMetadata() {
    const duration = this.#resolutionMetadata.resolutionEndTime && this.#resolutionMetadata.resolutionStartTime
      ? this.#resolutionMetadata.resolutionEndTime - this.#resolutionMetadata.resolutionStartTime
      : null;
    
    return {
      ...this.#resolutionMetadata,
      availablePlaceholders: this.getAvailablePlaceholders(),
      resolutionDuration: duration,
      hasContextDependencies: this.hasContextDependencies(),
      resolutionComplete: this.#resolutionMetadata.resolvedTargets > 0
    };
  }
  
  /**
   * Mark resolution process as started
   * @param {number} expectedTargetCount - Expected number of targets to resolve
   */
  startResolution(expectedTargetCount = 0) {
    this.#resolutionMetadata.resolutionStartTime = Date.now();
    this.#resolutionMetadata.totalTargets = expectedTargetCount;
    
    this.#logger.debug('Target resolution started', {
      expectedTargets: expectedTargetCount
    });
  }
  
  /**
   * Mark resolution process as completed
   */
  completeResolution() {
    this.#resolutionMetadata.resolutionEndTime = Date.now();
    
    const metadata = this.getResolutionMetadata();
    this.#logger.info('Target resolution completed', {
      resolvedTargets: metadata.resolvedTargets,
      contextDependencies: metadata.contextDependencies,
      duration: metadata.resolutionDuration,
      placeholders: metadata.availablePlaceholders
    });
  }
  
  /**
   * Clear all resolved targets (for reuse or testing)
   */
  clear() {
    const previousCount = this.#targets.size;
    this.#targets.clear();
    this.#resolutionMetadata = {
      totalTargets: 0,
      resolvedTargets: 0,
      contextDependencies: 0,
      resolutionStartTime: null,
      resolutionEndTime: null
    };
    
    this.#logger.debug('Target manager cleared', { previousCount });
  }
  
  /**
   * Get target information formatted for event payload
   * @returns {Object} - Target information in event payload format
   */
  getTargetInfoForEventPayload() {
    const legacyFormat = {};
    const comprehensiveFormat = {};
    
    // Build both formats
    for (const [placeholder, targetInfo] of this.#targets.entries()) {
      // Legacy format
      const legacyField = `${placeholder}Id`;
      legacyFormat[legacyField] = targetInfo.entityId;
      
      // Comprehensive format
      comprehensiveFormat[placeholder] = {
        entityId: targetInfo.entityId,
        placeholder: targetInfo.placeholderName,
        description: targetInfo.description,
        resolvedFromContext: targetInfo.resolvedFromContext,
        contextSource: targetInfo.contextSource
      };
    }
    
    return {
      legacy: legacyFormat,
      comprehensive: comprehensiveFormat,
      metadata: {
        resolvedTargetCount: this.#targets.size,
        hasContextDependencies: this.hasContextDependencies()
      }
    };
  }
}

/**
 * Target information structure
 * @typedef {Object} TargetInfo
 * @property {string} placeholderName - Placeholder name (e.g., "primary")
 * @property {string} entityId - Resolved entity ID
 * @property {string|null} description - Human-readable description of target
 * @property {boolean} resolvedFromContext - Whether target was resolved from context
 * @property {string|null} contextSource - Source placeholder if resolved from context
 * @property {string} resolutionMethod - Method used for resolution
 * @property {number} timestamp - When target was resolved
 */
```

### 3. Integration with MultiTargetResolutionStage

**Step 3.1**: Update MultiTargetResolutionStage to use enhanced TargetManager

```javascript
/**
 * Enhanced MultiTargetResolutionStage using new TargetManager APIs
 */
class MultiTargetResolutionStage {
  constructor({ logger, entityQueryManager, targetReferenceResolver }) {
    this.#logger = logger;
    this.#entityQueryManager = entityQueryManager;
    this.#targetReferenceResolver = targetReferenceResolver;
  }
  
  async execute(context) {
    // Create enhanced target manager
    const targetManager = new EnhancedTargetManager({
      logger: this.#logger,
      entityQueryManager: this.#entityQueryManager
    });
    
    // Start resolution tracking
    const expectedTargets = this.#getExpectedTargetCount(context);
    targetManager.startResolution(expectedTargets);
    
    try {
      // Perform target resolution
      await this.#resolveTargets(context, targetManager);
      
      // Complete resolution tracking
      targetManager.completeResolution();
      
      // Add target manager to context for next stages
      context.targetManager = targetManager;
      
      // Log resolution summary
      const metadata = targetManager.getResolutionMetadata();
      this.#logger.info('Multi-target resolution completed', {
        stage: 'MultiTargetResolutionStage',
        ...metadata
      });
      
      return context;
      
    } catch (error) {
      this.#logger.error('Multi-target resolution failed', {
        error: error.message,
        stage: 'MultiTargetResolutionStage'
      });
      throw error;
    }
  }
  
  /**
   * Resolve all required targets using enhanced TargetManager
   * @private
   * @param {Object} context - Action execution context
   * @param {EnhancedTargetManager} targetManager - Target manager instance
   */
  async #resolveTargets(context, targetManager) {
    const action = context.actionDefinition;
    const requiredTargets = action.targets || [];
    
    for (const targetDef of requiredTargets) {
      try {
        const resolvedInfo = await this.#resolveTarget(targetDef, context);
        
        if (resolvedInfo) {
          targetManager.addResolvedTarget(
            targetDef.name,
            resolvedInfo.entityId,
            {
              description: resolvedInfo.description,
              resolvedFromContext: resolvedInfo.fromContext,
              contextSource: resolvedInfo.contextSource,
              resolutionMethod: resolvedInfo.method
            }
          );
        } else {
          this.#logger.warn('Failed to resolve required target', {
            targetName: targetDef.name,
            actionId: context.actionId
          });
        }
      } catch (error) {
        this.#logger.error('Target resolution error', {
          targetName: targetDef.name,
          error: error.message,
          actionId: context.actionId
        });
        
        // Continue with other targets rather than failing completely
      }
    }
    
    // Validate that all required targets were resolved
    const requiredPlaceholders = requiredTargets.map(t => t.name);
    const validation = targetManager.validateRequiredTargets(requiredPlaceholders);
    
    if (!validation.valid) {
      throw new Error(
        `Required targets not resolved: ${validation.missing.join(', ')}`
      );
    }
  }
  
  /**
   * Resolve individual target with enhanced metadata
   * @private
   * @param {Object} targetDef - Target definition from action
   * @param {Object} context - Action execution context
   * @returns {Promise<Object|null>} - Resolved target information
   */
  async #resolveTarget(targetDef, context) {
    // Implementation depends on existing target resolution logic
    // This is an example of how to capture enhanced metadata
    
    let entityId = null;
    let description = null;
    let fromContext = false;
    let contextSource = null;
    let method = 'direct';
    
    // Direct target resolution
    if (targetDef.directEntityId) {
      entityId = targetDef.directEntityId;
      method = 'direct';
    }
    // Context-based resolution (contextFrom)
    else if (targetDef.contextFrom) {
      const contextEntity = await this.#resolveContextTarget(targetDef.contextFrom, context);
      if (contextEntity) {
        entityId = contextEntity.id;
        fromContext = true;
        contextSource = targetDef.contextFrom;
        method = 'context';
      }
    }
    // Interactive selection or other methods...
    
    // Get entity description if resolved
    if (entityId) {
      try {
        const entity = await this.#entityQueryManager.getEntity(entityId);
        description = entity?.name || 'Unknown Entity';
      } catch (error) {
        this.#logger.warn(`Failed to get description for entity ${entityId}`, error);
        description = 'Unknown Entity';
      }
    }
    
    return entityId ? {
      entityId,
      description,
      fromContext,
      contextSource,
      method
    } : null;
  }
  
  /**
   * Get expected number of targets for tracking
   * @private
   * @param {Object} context - Action execution context
   * @returns {number} - Expected target count
   */
  #getExpectedTargetCount(context) {
    const action = context.actionDefinition;
    return action.targets ? action.targets.length : 0;
  }
}
```

### 4. Backward Compatibility Support

**Step 4.1**: Ensure existing code continues to work

```javascript
/**
 * Backward compatibility wrapper for existing TargetManager usage
 */
class TargetManagerCompatibilityLayer {
  constructor(enhancedTargetManager) {
    this.#enhanced = enhancedTargetManager;
  }
  
  #enhanced;
  
  // Legacy methods that existing code might use
  
  /**
   * Legacy method: Add target (simplified)
   * @param {Object} target - Target object with basic information
   */
  addTarget(target) {
    const placeholderName = target.name || 'primary';
    const entityId = target.entityId || target.id;
    
    this.#enhanced.addResolvedTarget(placeholderName, entityId, {
      description: target.description,
      resolvedFromContext: target.fromContext || false
    });
  }
  
  /**
   * Legacy method: Get targets as array
   * @returns {Array} - Array of target objects
   */
  getTargets() {
    return this.#enhanced.getResolvedTargets().map(targetInfo => ({
      name: targetInfo.placeholderName,
      entityId: targetInfo.entityId,
      description: targetInfo.description,
      fromContext: targetInfo.resolvedFromContext
    }));
  }
  
  /**
   * Legacy method: Get target count
   * @returns {number} - Number of targets
   */
  getTargetCount() {
    return this.#enhanced.getResolvedTargetCount();
  }
  
  // Expose enhanced methods directly
  getEntityIdByPlaceholder(placeholder) {
    return this.#enhanced.getEntityIdByPlaceholder(placeholder);
  }
  
  getTargetMappings() {
    return this.#enhanced.getTargetMappings();
  }
  
  validateRequiredTargets(placeholders) {
    return this.#enhanced.validateRequiredTargets(placeholders);
  }
  
  getResolutionMetadata() {
    return this.#enhanced.getResolutionMetadata();
  }
  
  hasContextDependencies() {
    return this.#enhanced.hasContextDependencies();
  }
}
```

### 5. Performance Optimization

**Step 5.1**: Add caching and batch operations

```javascript
/**
 * Performance optimizations for EnhancedTargetManager
 */
class EnhancedTargetManagerOptimizations {
  /**
   * Batch entity description loading for multiple targets
   * @param {Array<string>} entityIds - Entity IDs to load descriptions for
   * @returns {Promise<Map<string, string>>} - Map of entity ID to description
   */
  async #loadEntityDescriptionsBatch(entityIds) {
    const descriptions = new Map();
    
    // Use batch loading if available
    if (this.#entityQueryManager.getEntitiesBatch) {
      try {
        const entities = await this.#entityQueryManager.getEntitiesBatch(entityIds);
        entities.forEach(entity => {
          descriptions.set(entity.id, entity.name || 'Unknown Entity');
        });
      } catch (error) {
        this.#logger.warn('Batch entity loading failed, falling back to individual queries', error);
        
        // Fallback to individual queries
        for (const entityId of entityIds) {
          try {
            const entity = await this.#entityQueryManager.getEntity(entityId);
            descriptions.set(entityId, entity?.name || 'Unknown Entity');
          } catch (err) {
            descriptions.set(entityId, 'Unknown Entity');
          }
        }
      }
    } else {
      // Individual queries
      for (const entityId of entityIds) {
        try {
          const entity = await this.#entityQueryManager.getEntity(entityId);
          descriptions.set(entityId, entity?.name || 'Unknown Entity');
        } catch (error) {
          descriptions.set(entityId, 'Unknown Entity');
        }
      }
    }
    
    return descriptions;
  }
  
  /**
   * Optimized method to add multiple targets with batch description loading
   * @param {Array<Object>} targetsToAdd - Array of target information
   */
  async addMultipleTargets(targetsToAdd) {
    // Extract entity IDs for batch loading
    const entityIds = targetsToAdd.map(t => t.entityId);
    
    // Load descriptions in batch
    const descriptions = await this.#loadEntityDescriptionsBatch(entityIds);
    
    // Add all targets with loaded descriptions
    targetsToAdd.forEach(targetData => {
      const description = descriptions.get(targetData.entityId);
      
      this.addResolvedTarget(
        targetData.placeholderName,
        targetData.entityId,
        {
          ...targetData.metadata,
          description
        }
      );
    });
    
    this.#logger.debug('Multiple targets added with batch optimization', {
      targetCount: targetsToAdd.length,
      descriptionsLoaded: descriptions.size
    });
  }
}
```

### 6. Testing Support

**Step 6.1**: Add testing utilities and helpers

```javascript
/**
 * Testing utilities for EnhancedTargetManager
 */
class EnhancedTargetManagerTestUtils {
  /**
   * Create mock target manager for testing
   * @param {Object} options - Configuration options
   * @returns {EnhancedTargetManager} - Mock target manager
   */
  static createMockTargetManager(options = {}) {
    const mockLogger = options.logger || {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    const mockEntityQueryManager = options.entityQueryManager || {
      getEntity: jest.fn().mockImplementation((id) => 
        Promise.resolve({ id, name: `Mock Entity ${id}` })
      )
    };
    
    return new EnhancedTargetManager({
      logger: mockLogger,
      entityQueryManager: mockEntityQueryManager
    });
  }
  
  /**
   * Setup target manager with test data
   * @param {EnhancedTargetManager} targetManager - Target manager to setup
   * @param {Object} testData - Test data configuration
   */
  static setupTestTargets(targetManager, testData = {}) {
    const defaults = {
      primary: { entityId: 'test_primary', description: 'Test Primary Entity' },
      secondary: { entityId: 'test_secondary', description: 'Test Secondary Entity', fromContext: true },
      tertiary: { entityId: 'test_tertiary', description: 'Test Tertiary Entity' }
    };
    
    const targets = { ...defaults, ...testData };
    
    Object.entries(targets).forEach(([placeholder, info]) => {
      targetManager.addResolvedTarget(placeholder, info.entityId, {
        description: info.description,
        resolvedFromContext: info.fromContext || false,
        contextSource: info.contextSource
      });
    });
    
    return targetManager;
  }
  
  /**
   * Assert target manager state
   * @param {EnhancedTargetManager} targetManager - Target manager to verify
   * @param {Object} expectations - Expected state
   */
  static assertTargetManagerState(targetManager, expectations) {
    if (expectations.targetCount !== undefined) {
      expect(targetManager.getResolvedTargetCount()).toBe(expectations.targetCount);
    }
    
    if (expectations.hasContextDependencies !== undefined) {
      expect(targetManager.hasContextDependencies()).toBe(expectations.hasContextDependencies);
    }
    
    if (expectations.placeholders) {
      const available = targetManager.getAvailablePlaceholders();
      expect(available).toEqual(expect.arrayContaining(expectations.placeholders));
    }
    
    if (expectations.mappings) {
      const mappings = targetManager.getTargetMappings();
      Object.entries(expectations.mappings).forEach(([placeholder, expectedId]) => {
        expect(mappings[placeholder]).toBe(expectedId);
      });
    }
  }
}
```

## Acceptance Criteria

### Core API Criteria
1. ✅ **Placeholder-to-Entity Mapping**: `getEntityIdByPlaceholder()` method returns correct entity IDs
2. ✅ **Target Information Retrieval**: `getTargetInfo()` provides comprehensive target metadata  
3. ✅ **Mapping Object Generation**: `getTargetMappings()` creates placeholder-to-ID mappings
4. ✅ **Resolved Targets Access**: `getResolvedTargets()` returns array of complete target information
5. ✅ **Target Count Tracking**: `getResolvedTargetCount()` accurately reports resolved target count

### Validation Criteria
6. ✅ **Required Target Validation**: `validateRequiredTargets()` identifies missing and resolved targets
7. ✅ **Placeholder Availability**: `getAvailablePlaceholders()` lists all resolved placeholder names
8. ✅ **Target Existence Check**: `hasResolvedTarget()` correctly identifies resolved placeholders
9. ✅ **Context Dependency Detection**: `hasContextDependencies()` identifies context-based resolutions
10. ✅ **Resolution Metadata**: `getResolutionMetadata()` provides comprehensive resolution statistics

### Integration Criteria
11. ✅ **ActionFormattingStage Integration**: Provides `getTargetInfoForEventPayload()` for enhanced events
12. ✅ **MultiTargetResolutionStage Integration**: Works seamlessly with existing resolution pipeline
13. ✅ **Backward Compatibility**: Existing code continues working through compatibility layer
14. ✅ **Dependency Injection**: Properly registered and injected with required dependencies
15. ✅ **Error Handling**: Graceful handling of entity lookup failures and invalid inputs

### Performance Criteria
16. ✅ **Batch Operations**: `addMultipleTargets()` efficiently handles multiple target additions
17. ✅ **Entity Description Caching**: Avoids duplicate entity queries through intelligent caching
18. ✅ **Memory Efficiency**: Uses appropriate data structures without excessive memory overhead
19. ✅ **Resolution Tracking**: Efficiently tracks resolution progress and completion
20. ✅ **Cleanup Support**: `clear()` method properly resets state for reuse

## Testing Requirements

### Unit Tests
```javascript
describe('EnhancedTargetManager', () => {
  let targetManager;
  let mockLogger;
  let mockEntityQueryManager;
  
  beforeEach(() => {
    targetManager = EnhancedTargetManagerTestUtils.createMockTargetManager();
  });
  
  describe('Target Addition and Retrieval', () => {
    it('should add and retrieve resolved targets', () => {
      targetManager.addResolvedTarget('primary', 'entity_123', {
        description: 'Test Entity',
        resolvedFromContext: true
      });
      
      expect(targetManager.getEntityIdByPlaceholder('primary')).toBe('entity_123');
      expect(targetManager.getResolvedTargetCount()).toBe(1);
      expect(targetManager.hasContextDependencies()).toBe(true);
    });
    
    it('should provide comprehensive target information', () => {
      targetManager.addResolvedTarget('secondary', 'entity_456', {
        description: 'Another Entity',
        contextSource: 'primary'
      });
      
      const targetInfo = targetManager.getTargetInfo('secondary');
      expect(targetInfo.placeholderName).toBe('secondary');
      expect(targetInfo.entityId).toBe('entity_456');
      expect(targetInfo.description).toBe('Another Entity');
      expect(targetInfo.contextSource).toBe('primary');
    });
  });
  
  describe('Target Mappings', () => {
    it('should create placeholder-to-entity mappings', () => {
      EnhancedTargetManagerTestUtils.setupTestTargets(targetManager);
      
      const mappings = targetManager.getTargetMappings();
      expect(mappings.primary).toBe('test_primary');
      expect(mappings.secondary).toBe('test_secondary');
      expect(mappings.tertiary).toBe('test_tertiary');
    });
    
    it('should provide event payload formatted information', () => {
      EnhancedTargetManagerTestUtils.setupTestTargets(targetManager);
      
      const payloadInfo = targetManager.getTargetInfoForEventPayload();
      
      expect(payloadInfo.legacy.primaryId).toBe('test_primary');
      expect(payloadInfo.comprehensive.primary.entityId).toBe('test_primary');
      expect(payloadInfo.metadata.resolvedTargetCount).toBe(3);
      expect(payloadInfo.metadata.hasContextDependencies).toBe(true);
    });
  });
  
  describe('Validation', () => {
    it('should validate required targets successfully', () => {
      EnhancedTargetManagerTestUtils.setupTestTargets(targetManager);
      
      const validation = targetManager.validateRequiredTargets(['primary', 'secondary']);
      
      expect(validation.valid).toBe(true);
      expect(validation.resolved).toEqual(['primary', 'secondary']);
      expect(validation.missing).toEqual([]);
    });
    
    it('should detect missing required targets', () => {
      targetManager.addResolvedTarget('primary', 'entity_123');
      
      const validation = targetManager.validateRequiredTargets(['primary', 'secondary', 'missing']);
      
      expect(validation.valid).toBe(false);
      expect(validation.resolved).toEqual(['primary']);
      expect(validation.missing).toEqual(['secondary', 'missing']);
    });
  });
  
  describe('Resolution Tracking', () => {
    it('should track resolution progress', () => {
      targetManager.startResolution(2);
      targetManager.addResolvedTarget('primary', 'entity_1');
      targetManager.addResolvedTarget('secondary', 'entity_2');
      targetManager.completeResolution();
      
      const metadata = targetManager.getResolutionMetadata();
      expect(metadata.totalTargets).toBe(2);
      expect(metadata.resolvedTargets).toBe(2);
      expect(metadata.resolutionComplete).toBe(true);
      expect(metadata.resolutionDuration).toBeDefined();
    });
  });
  
  describe('Cleanup and State Management', () => {
    it('should clear all targets and reset state', () => {
      EnhancedTargetManagerTestUtils.setupTestTargets(targetManager);
      
      expect(targetManager.getResolvedTargetCount()).toBeGreaterThan(0);
      
      targetManager.clear();
      
      expect(targetManager.getResolvedTargetCount()).toBe(0);
      expect(targetManager.getAvailablePlaceholders()).toEqual([]);
      expect(targetManager.hasContextDependencies()).toBe(false);
    });
  });
});

describe('TargetManagerCompatibilityLayer', () => {
  it('should maintain backward compatibility with legacy API', () => {
    const enhanced = EnhancedTargetManagerTestUtils.createMockTargetManager();
    const compat = new TargetManagerCompatibilityLayer(enhanced);
    
    // Legacy usage
    compat.addTarget({
      name: 'primary',
      entityId: 'entity_123',
      description: 'Test Entity'
    });
    
    const targets = compat.getTargets();
    expect(targets).toHaveLength(1);
    expect(targets[0].name).toBe('primary');
    expect(targets[0].entityId).toBe('entity_123');
    
    // Enhanced features should still work
    expect(compat.getEntityIdByPlaceholder('primary')).toBe('entity_123');
  });
});
```

### Integration Tests
```javascript
describe('EnhancedTargetManager Integration', () => {
  it('should integrate with MultiTargetResolutionStage', async () => {
    const testBed = new MultiTargetResolutionTestBed();
    const action = testBed.createTestAction({
      targets: [
        { name: 'primary', type: 'direct' },
        { name: 'secondary', type: 'contextFrom', contextFrom: 'primary' }
      ]
    });
    
    const context = testBed.createContext({ actionDefinition: action });
    const stage = new MultiTargetResolutionStage(testBed.dependencies);
    
    const result = await stage.execute(context);
    
    expect(result.targetManager).toBeDefined();
    expect(result.targetManager.getResolvedTargetCount()).toBe(2);
    expect(result.targetManager.hasContextDependencies()).toBe(true);
  });
  
  it('should provide correct information for ActionFormattingStage', () => {
    const targetManager = EnhancedTargetManagerTestUtils.createMockTargetManager();
    EnhancedTargetManagerTestUtils.setupTestTargets(targetManager);
    
    const payloadInfo = targetManager.getTargetInfoForEventPayload();
    
    // Should provide both legacy and comprehensive formats
    expect(payloadInfo.legacy.primaryId).toBeDefined();
    expect(payloadInfo.comprehensive.primary.entityId).toBeDefined();
    expect(payloadInfo.metadata.resolvedTargetCount).toBeGreaterThan(0);
  });
  
  it('should work with adjust_clothing action scenario', async () => {
    const testBed = new ActionTestBed();
    const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();
    
    const targetManager = new EnhancedTargetManager(testBed.dependencies);
    
    // Simulate target resolution for adjust_clothing
    targetManager.startResolution(2);
    targetManager.addResolvedTarget('primary', iker.id, {
      description: 'Iker Aguirre',
      resolutionMethod: 'direct'
    });
    targetManager.addResolvedTarget('secondary', jacket.id, {
      description: 'denim trucker jacket',
      resolvedFromContext: true,
      contextSource: 'primary'
    });
    targetManager.completeResolution();
    
    // Verify target manager provides correct information
    expect(targetManager.getEntityIdByPlaceholder('primary')).toBe(iker.id);
    expect(targetManager.getEntityIdByPlaceholder('secondary')).toBe(jacket.id);
    expect(targetManager.hasContextDependencies()).toBe(true);
    
    const payloadInfo = targetManager.getTargetInfoForEventPayload();
    expect(payloadInfo.legacy.primaryId).toBe(iker.id);
    expect(payloadInfo.legacy.secondaryId).toBe(jacket.id);
  });
});
```

## Performance Benchmarks

- Target addition: <1ms per target
- Entity ID lookup by placeholder: <0.1ms
- Target mappings generation: <2ms for typical use cases
- Validation of required targets: <5ms for up to 10 targets
- Event payload information generation: <3ms

## Dependencies and Prerequisites

### System Dependencies
- Existing `MultiTargetResolutionStage` implementation
- Entity query manager for entity lookups and validation
- Logging system for debugging and monitoring
- Dependency injection system for service registration

### Testing Dependencies
- Jest testing framework with existing test utilities
- Mock implementations for dependencies
- Test bed classes for integration testing

## Notes and Considerations

### Implementation Order
1. **Phase 1**: Core enhanced API methods (getEntityIdByPlaceholder, getTargetMappings, etc.)
2. **Phase 2**: Resolution tracking and metadata collection
3. **Phase 3**: Integration with MultiTargetResolutionStage
4. **Phase 4**: Event payload information generation
5. **Phase 5**: Performance optimizations and batch operations
6. **Phase 6**: Backward compatibility layer
7. **Phase 7**: Comprehensive testing and validation

### Risk Mitigation
- **Backward Compatibility**: Compatibility layer ensures existing code continues working
- **Performance Impact**: Batch operations and caching minimize performance overhead
- **Memory Management**: Efficient data structures and cleanup methods prevent memory leaks
- **Error Resilience**: Graceful handling of entity lookup failures

### Future Enhancements
- Support for dynamic target types beyond primary/secondary/tertiary
- Target relationship tracking (dependencies between targets)
- Advanced validation rules for target combinations
- Integration with caching systems for frequently accessed targets
- Performance monitoring and metrics collection
- Support for target aliasing and custom placeholder names

This enhanced target manager provides the foundation for robust multi-target action support while maintaining compatibility with existing systems and enabling future extensibility.