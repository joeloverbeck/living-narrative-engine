/**
 * @file tests/common/anatomy/enhancedAnatomyTestBed.js
 * @description Enhanced test bed for complex anatomy blueprint processing scenarios
 * Extends AnatomyIntegrationTestBed with complex blueprint support, error injection,
 * and detailed validation capabilities
 */

import AnatomyIntegrationTestBed from './anatomyIntegrationTestBed.js';
import ComplexBlueprintDataGenerator from './complexBlueprintDataGenerator.js';

/**
 * Enhanced test bed for complex anatomy testing scenarios
 * Provides complex blueprint loading, error injection, and validation helpers
 */
export default class EnhancedAnatomyTestBed extends AnatomyIntegrationTestBed {
  constructor(options = {}) {
    super(options);
    this.dataGenerator = new ComplexBlueprintDataGenerator();
    this.processingLog = [];
    this.errorInjection = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Loads complex blueprint hierarchies into the test environment
   * @param {Object} blueprintData - Generated blueprint test data
   * @returns {Promise<void>}
   */
  async loadComplexBlueprints(blueprintData) {
    if (!blueprintData || !blueprintData.blueprints) {
      throw new Error('Invalid blueprint data structure');
    }

    // Load blueprints using test bed loader methods
    if (blueprintData.blueprints) {
      this.loadBlueprints(blueprintData.blueprints);
    }

    // Load entity definitions using test bed loader methods  
    if (blueprintData.entityDefinitions) {
      this.loadEntityDefinitions(blueprintData.entityDefinitions);
    }

    // Load parts using test bed loader methods (backwards compatibility)
    if (blueprintData.parts) {
      this.loadBlueprintParts(blueprintData.parts);
    }

    // Load recipe using test bed loader methods
    if (blueprintData.recipe) {
      const recipeData = {};
      recipeData[blueprintData.recipe.id] = blueprintData.recipe;
      this.loadRecipes(recipeData);
    }

    this.processingLog.push({
      action: 'loadComplexBlueprints',
      timestamp: Date.now(),
      blueprintCount: Object.keys(blueprintData.blueprints).length,
      partCount: blueprintData.parts ? Object.keys(blueprintData.parts).length : 0
    });
  }

  /**
   * Injects constraint violations at specific stages for testing error recovery
   * @param {string} stage - Processing stage ('blueprint_load', 'part_creation', 'constraint_eval')
   * @param {string} errorType - Type of error to inject
   * @param {Object} errorConfig - Error configuration
   */
  injectConstraintViolation(stage, errorType, errorConfig = {}) {
    this.errorInjection.set(`${stage}_${errorType}`, {
      stage,
      errorType,
      config: errorConfig,
      triggered: false,
      timestamp: Date.now()
    });

    this.processingLog.push({
      action: 'injectConstraintViolation',
      timestamp: Date.now(),
      stage,
      errorType,
      config: errorConfig
    });
  }

  /**
   * Validates complex slot resolution scenarios
   * @param {string} entityId - Root entity ID
   * @param {Object} expectedStructure - Expected anatomy structure
   * @returns {Object} Validation results
   */
  async validateSlotResolution(entityId, expectedStructure) {
    const startTime = Date.now();
    const validation = {
      success: true,
      errors: [],
      warnings: [],
      metrics: {},
      structure: null
    };

    try {
      // Get anatomy structure
      const anatomyData = this.entityManager.getComponentData(entityId, 'anatomy:body');
      if (!anatomyData || !anatomyData.body) {
        validation.success = false;
        validation.errors.push('No anatomy body data found');
        return validation;
      }

      validation.structure = anatomyData.body;

      // Validate root entity exists
      const rootEntity = this.entityManager.getEntityInstance(anatomyData.body.root);
      if (!rootEntity) {
        validation.success = false;
        validation.errors.push(`Root entity ${anatomyData.body.root} not found`);
        return validation;
      }

      // Validate expected structure
      if (expectedStructure) {
        await this._validateStructureRecursive(
          anatomyData.body.root,
          expectedStructure,
          validation,
          0
        );
      }

      // Check for slot conflicts
      await this._validateSlotConflicts(entityId, validation);

      // Validate constraint consistency
      await this._validateConstraintConsistency(entityId, validation);

      validation.metrics.processingTime = Date.now() - startTime;
      validation.metrics.partCount = Object.keys(anatomyData.body.parts || {}).length;

    } catch (error) {
      validation.success = false;
      validation.errors.push(`Validation error: ${error.message}`);
    }

    this.processingLog.push({
      action: 'validateSlotResolution',
      timestamp: Date.now(),
      entityId,
      success: validation.success,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      processingTime: validation.metrics.processingTime
    });

    return validation;
  }

  /**
   * Enables detailed blueprint processing tracking
   * @param {boolean} enabled - Enable/disable tracking
   */
  trackBlueprintProcessing(enabled = true) {
    this.processingTracking = enabled;
    
    if (enabled && this.eventDispatcher && typeof this.eventDispatcher.on === 'function') {
      // Hook into processing events if supported
      this.eventDispatcher.on('BLUEPRINT_PROCESSING_STARTED', (event) => {
        this.processingLog.push({
          action: 'blueprintProcessingStarted',
          timestamp: Date.now(),
          blueprintId: event.payload.blueprintId,
          entityId: event.payload.entityId
        });
      });

      this.eventDispatcher.on('BLUEPRINT_SLOT_PROCESSED', (event) => {
        this.processingLog.push({
          action: 'blueprintSlotProcessed',
          timestamp: Date.now(),
          slotId: event.payload.slotId,
          success: event.payload.success,
          processingTime: event.payload.processingTime
        });
      });

      this.eventDispatcher.on('CONSTRAINT_VIOLATION', (event) => {
        this.processingLog.push({
          action: 'constraintViolation',
          timestamp: Date.now(),
          violationType: event.payload.violationType,
          context: event.payload.context
        });
      });
    } else if (enabled) {
      // Fallback: just enable basic tracking without event hooks
      this.processingLog.push({
        action: 'trackingEnabled',
        timestamp: Date.now(),
        note: 'Event hooks not available, using basic tracking'
      });
    }
  }

  /**
   * Gets processing log entries
   * @param {string} [actionFilter] - Filter by action type
   * @returns {Array} Processing log entries
   */
  getProcessingLog(actionFilter = null) {
    if (!actionFilter) {
      return [...this.processingLog];
    }
    return this.processingLog.filter(entry => entry.action === actionFilter);
  }

  /**
   * Clears processing log and resets tracking state
   */
  clearProcessingLog() {
    this.processingLog = [];
    this.errorInjection.clear();
    this.performanceMetrics.clear();
  }

  /**
   * Validates blueprint processing performance meets thresholds
   * @param {string} operation - Operation name
   * @param {Object} thresholds - Performance thresholds
   * @returns {Object} Performance validation results
   */
  validatePerformanceThresholds(operation, thresholds) {
    const metrics = this.performanceMetrics.get(operation);
    if (!metrics) {
      return { success: false, error: `No metrics found for operation: ${operation}` };
    }

    const validation = {
      success: true,
      violations: [],
      metrics: metrics
    };

    if (thresholds.maxProcessingTime && metrics.processingTime > thresholds.maxProcessingTime) {
      validation.success = false;
      validation.violations.push({
        type: 'processingTime',
        actual: metrics.processingTime,
        threshold: thresholds.maxProcessingTime
      });
    }

    if (thresholds.maxMemoryUsage && metrics.memoryUsage > thresholds.maxMemoryUsage) {
      validation.success = false;
      validation.violations.push({
        type: 'memoryUsage',
        actual: metrics.memoryUsage,
        threshold: thresholds.maxMemoryUsage
      });
    }

    return validation;
  }

  /**
   * Records performance metrics for an operation
   * @param {string} operation - Operation name
   * @param {Object} metrics - Performance metrics
   */
  recordPerformanceMetrics(operation, metrics) {
    this.performanceMetrics.set(operation, {
      ...metrics,
      timestamp: Date.now()
    });
  }

  /**
   * Validates structure recursively against expected pattern
   * @private
   */
  async _validateStructureRecursive(entityId, expectedStructure, validation, depth) {
    if (depth > 10) {
      validation.warnings.push(`Maximum validation depth reached at entity ${entityId}`);
      return;
    }

    const entity = this.entityManager.getEntityInstance(entityId);
    if (!entity) {
      validation.errors.push(`Entity ${entityId} not found at depth ${depth}`);
      return;
    }

    // Validate part type if specified
    if (expectedStructure.partType) {
      const partData = entity.getComponentData('anatomy:part');
      if (!partData || partData.subType !== expectedStructure.partType) {
        validation.errors.push(
          `Expected part type ${expectedStructure.partType} at ${entityId}, got ${partData?.subType || 'none'}`
        );
      }
    }

    // Validate children if specified
    if (expectedStructure.children) {
      const childEntities = this.entityManager.getEntitiesWithComponent('anatomy:part')
        .filter(e => e.getComponentData('anatomy:part')?.parentId === entityId);

      for (const [childKey, childExpected] of Object.entries(expectedStructure.children)) {
        const matchingChild = childEntities.find(e => 
          e.getComponentData('anatomy:part')?.subType === childExpected.partType
        );

        if (!matchingChild && childExpected.required !== false) {
          validation.errors.push(`Required child ${childKey} not found under ${entityId}`);
        } else if (matchingChild) {
          await this._validateStructureRecursive(
            matchingChild.id,
            childExpected,
            validation,
            depth + 1
          );
        }
      }
    }
  }

  /**
   * Validates slot conflicts in anatomy structure
   * @private
   */
  async _validateSlotConflicts(entityId, validation) {
    const anatomyData = this.entityManager.getComponentData(entityId, 'anatomy:body');
    const socketUsage = new Map();

    // Track socket usage across all parts
    for (const partId of Object.keys(anatomyData.body.parts || {})) {
      const partEntity = this.entityManager.getEntityInstance(partId);
      if (!partEntity) continue;

      const socketsData = partEntity.getComponentData('anatomy:sockets');
      if (!socketsData) continue;

      for (const [socketId, socketInfo] of Object.entries(socketsData.sockets || {})) {
        if (!socketUsage.has(socketId)) {
          socketUsage.set(socketId, { capacity: socketInfo.capacity || 1, used: [] });
        }
        socketUsage.get(socketId).used.push(partId);
      }
    }

    // Check for conflicts
    for (const [socketId, usage] of socketUsage.entries()) {
      if (usage.used.length > usage.capacity) {
        validation.errors.push(
          `Socket ${socketId} over capacity: ${usage.used.length} used, ${usage.capacity} max`
        );
      }
    }
  }

  /**
   * Validates constraint consistency across anatomy
   * @private
   */
  async _validateConstraintConsistency(entityId, validation) {
    // Implementation would check constraint rules
    // For now, we'll add a placeholder that can be expanded
    validation.warnings.push('Constraint consistency validation not fully implemented');
  }

  /**
   * Cleanup enhanced test bed resources
   */
  cleanup() {
    super.cleanup();
    this.dataGenerator.clear();
    this.clearProcessingLog();
  }
}