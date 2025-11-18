/**
 * @file tests/common/anatomy/enhancedAnatomyTestBed.js
 * @description Enhanced test bed for complex anatomy blueprint processing scenarios
 * Extends AnatomyIntegrationTestBed with complex blueprint support, error injection,
 * and detailed validation capabilities
 */

import AnatomyIntegrationTestBed from './anatomyIntegrationTestBed.js';
import ComplexBlueprintDataGenerator from './complexBlueprintDataGenerator.js';
import { ClothingManagementService } from '../../../src/clothing/services/clothingManagementService.js';
import { EquipmentOrchestrator } from '../../../src/clothing/orchestration/equipmentOrchestrator.js';
import { ClothingSlotValidator } from '../../../src/clothing/validation/clothingSlotValidator.js';
import { ClothingInstantiationService } from '../../../src/clothing/services/clothingInstantiationService.js';

/**
 * Enhanced test bed for complex anatomy testing scenarios
 * Provides complex blueprint loading, error injection, validation helpers,
 * and clothing integration testing capabilities
 */
export default class EnhancedAnatomyTestBed extends AnatomyIntegrationTestBed {
  constructor(options = {}) {
    super(options);
    this.dataGenerator = new ComplexBlueprintDataGenerator();
    this.processingLog = [];
    this.errorInjection = new Map();
    this.performanceMetrics = new Map();
    this.clothingIntegrationData = new Map();
    this.cacheStateHistory = [];

    // Store options for description service configuration
    this.useRealisticDescriptions = options.useRealisticDescriptions !== false; // default true
    this.useLightweightMocks = options.useLightweightMocks === true; // default false
    this.minimalMode = options.minimalMode === true; // default false - skips heavy service initialization
    this.options = options; // Store all options for later use

    // Initialize clothing integration services only if not in minimal mode
    if (!this.minimalMode) {
      this._initializeClothingIntegration();
    } else {
      // Create mock clothing management service for minimal mode
      this.clothingManagementService = this.createMockClothingManagementService();
    }

    // Override anatomy description service with appropriate mocking strategy
    this._overrideDescriptionService();
  }

  /**
   * Override anatomy description service with configurable mocking strategy
   *
   * @private
   */
  _overrideDescriptionService() {
    if (this.useLightweightMocks) {
      // Use simple, minimal mocks for pure memory leak detection
      this.anatomyDescriptionService = {
        generateAllDescriptions: jest.fn().mockResolvedValue({
          bodyDescription: 'Simple test body.',
          partDescriptions: new Map([['part-1', 'Simple part.']])
        }),
        generateBodyDescription: jest.fn().mockResolvedValue('Simple test body.'),
        generatePartDescription: jest.fn().mockResolvedValue('Simple part.'),
      };
    } else {
      // Use realistic mocks that simulate production memory patterns
      this.anatomyDescriptionService = {
        generateAllDescriptions: jest.fn().mockImplementation(async (bodyEntity) => {
          const bodyDescription = this._generateRealisticBodyDescription(bodyEntity);
          const partDescriptions = this._generateRealisticPartDescriptions(bodyEntity);
          
          return { bodyDescription, partDescriptions };
        }),
        generateBodyDescription: jest.fn().mockImplementation(async (bodyEntity) => {
          return this._generateRealisticBodyDescription(bodyEntity);
        }),
        generatePartDescription: jest.fn().mockImplementation((partId) => {
          return this._generateRealisticPartDescription(partId);
        }),
      };
    }
  }

  /**
   * Generate a realistic body description that simulates production memory usage
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Realistic body description
   * @private
   */
  _generateRealisticBodyDescription(bodyEntity) {
    const entityId = bodyEntity?.id || 'unknown';
    
    // Simulate realistic description generation with moderate complexity
    // Reduced template count for better memory balance
    const templates = [
      `This anatomical structure represents a complex biological entity (${entityId}) with interconnected systems.`,
      `The framework consists of articulated segments arranged in hierarchical patterns.`,
      `Surface characteristics include varied textural elements and structural modifications.`,
      `The overall configuration reflects adaptations for environmental requirements.`,
      `Integrated systems provide functionality across the entire structure.`
    ];
    
    // Simulate basic template processing
    const processedSections = templates.map((template, index) => {
      return `${index + 1}. ${template}`;
    });
    
    // Assemble final description with minimal metadata
    const baseDescription = processedSections.join(' ');
    const final = `${baseDescription} [Entity: ${entityId}]`;
    
    return final;
  }

  /**
   * Generate realistic part descriptions that simulate production memory usage
   *
   * @param {object} bodyEntity - The body entity
   * @returns {Map<string, string>} Map of part IDs to descriptions
   * @private
   */
  _generateRealisticPartDescriptions(bodyEntity) {
    const partDescriptions = new Map();
    
    // Simulate generating descriptions for multiple parts (reduced from 10 to 3 for better balance)
    for (let i = 1; i <= 3; i++) {
      const partId = `part-${i}-${bodyEntity?.id || 'unknown'}`;
      partDescriptions.set(partId, this._generateRealisticPartDescription(partId));
    }
    
    return partDescriptions;
  }

  /**
   * Generate a realistic part description
   *
   * @param {string} partId - The part ID
   * @returns {string} Realistic part description
   * @private
   */
  _generateRealisticPartDescription(partId) {
    // Simulate realistic part description with balanced complexity
    const descriptors = ['articulated', 'flexible', 'reinforced', 'responsive'];
    const functions = ['structural support', 'movement facilitation', 'system coordination'];
    
    // Select descriptors to simulate dynamic generation (reduced randomness for memory efficiency)
    const descriptor = descriptors[Math.floor(Math.random() * descriptors.length)];
    const func = functions[Math.floor(Math.random() * functions.length)];
    
    // Build concise but realistic description
    const baseDesc = `This ${descriptor} component (${partId}) provides ${func}.`;
    const detailDesc = `Configuration enables optimal performance with system integration.`;
    
    return `${baseDesc} ${detailDesc}`;
  }

  /**
   * Initialize clothing integration services
   *
   * @private
   */
  _initializeClothingIntegration() {
    try {
      // Create clothing slot validator
      this.clothingSlotValidator = new ClothingSlotValidator({
        logger: this.logger,
        anatomyBlueprintRepository: this.anatomyBlueprintRepository || this.createMockAnatomyBlueprintRepository(),
      });

      // Create clothing instantiation service
      this.clothingInstantiationService = new ClothingInstantiationService({
        entityManager: this.entityManager,
        logger: this.logger,
        eventDispatcher: this.eventDispatcher,
        idGenerator: this.idGenerator,
      });

      // Create equipment orchestrator
      this.equipmentOrchestrator = new EquipmentOrchestrator({
        entityManager: this.entityManager,
        logger: this.logger,
        eventDispatcher: this.eventDispatcher,
        clothingInstantiationService: this.clothingInstantiationService,
        anatomySocketIndex: this.anatomySocketIndex,
      });

      // Create clothing management service
      this.clothingManagementService = new ClothingManagementService({
        entityManager: this.entityManager,
        logger: this.logger,
        eventDispatcher: this.eventDispatcher,
        equipmentOrchestrator: this.equipmentOrchestrator,
        anatomyBlueprintRepository: this.anatomyBlueprintRepository || this.createMockAnatomyBlueprintRepository(),
        clothingSlotValidator: this.clothingSlotValidator,
        bodyGraphService: this.bodyGraphService,
        anatomyClothingCache: this.anatomyClothingCache,
      });

      this.processingLog.push({
        action: 'clothingIntegrationInitialized',
        timestamp: Date.now(),
        servicesCreated: [
          'clothingSlotValidator',
          'clothingInstantiationService',
          'equipmentOrchestrator',
          'clothingManagementService'
        ]
      });
    } catch (error) {
      this.processingLog.push({
        action: 'clothingIntegrationInitializationFailed',
        timestamp: Date.now(),
        error: error.message
      });
      
      // Create mock clothing management service as fallback
      this.clothingManagementService = this.createMockClothingManagementService();
    }
  }

  /**
   * Create a mock anatomy blueprint repository for testing
   *
   * @returns {object} Mock anatomy blueprint repository
   * @private
   */
  createMockAnatomyBlueprintRepository() {
    return {
      getBlueprint: jest.fn().mockReturnValue(null),
      loadBlueprint: jest.fn().mockResolvedValue({}),
      hasBlueprint: jest.fn().mockReturnValue(false),
      getAllBlueprints: jest.fn().mockReturnValue(new Map()),
      clearCache: jest.fn(),
    };
  }

  /**
   * Create a mock clothing management service for testing
   *
   * @returns {object} Mock clothing management service
   * @private
   */
  createMockClothingManagementService() {
    return {
      equipClothing: jest.fn().mockResolvedValue({ 
        success: true, 
        equipped: true,
        clothingItemId: 'mock-clothing-item',
        targetSlot: 'mock-slot'
      }),
      unequipClothing: jest.fn().mockResolvedValue({ 
        success: true,
        unequipped: true
      }),
      getEquippedItems: jest.fn().mockResolvedValue(new Map()),
      validateCompatibility: jest.fn().mockResolvedValue({ 
        compatible: true,
        conflicts: []
      }),
      getAvailableSlots: jest.fn().mockResolvedValue(new Map()),
      transferClothing: jest.fn().mockResolvedValue({ success: true }),
    };
  }

  /**
   * Loads complex blueprint hierarchies into the test environment
   *
   * @param {object} blueprintData - Generated blueprint test data
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
   *
   * @param {string} stage - Processing stage ('blueprint_load', 'part_creation', 'constraint_eval')
   * @param {string} errorType - Type of error to inject
   * @param {object} errorConfig - Error configuration
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
   *
   * @param {string} entityId - Root entity ID
   * @param {object} expectedStructure - Expected anatomy structure
   * @returns {object} Validation results
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
   *
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
   *
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
   *
   * @param {string} operation - Operation name
   * @param {object} thresholds - Performance thresholds
   * @returns {object} Performance validation results
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
   *
   * @param {string} operation - Operation name
   * @param {object} metrics - Performance metrics
   */
  recordPerformanceMetrics(operation, metrics) {
    this.performanceMetrics.set(operation, {
      ...metrics,
      timestamp: Date.now()
    });
  }

  /**
   * Validates structure recursively against expected pattern
   *
   * @param entityId
   * @param expectedStructure
   * @param validation
   * @param depth
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
   *
   * @param entityId
   * @param validation
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
   *
   * @param entityId
   * @param validation
   * @private
   */
  async _validateConstraintConsistency(entityId, validation) {
    // Implementation would check constraint rules
    // For now, we'll add a placeholder that can be expanded
    validation.warnings.push('Constraint consistency validation not fully implemented');
  }

  /**
   * Load clothing integration test data into the test environment
   *
   * @param {object} clothingIntegrationData - Generated clothing integration test data
   * @returns {Promise<void>}
   */
  async loadClothingIntegrationData(clothingIntegrationData) {
    if (!clothingIntegrationData) {
      throw new Error('Invalid clothing integration data structure');
    }

    // Load base anatomy data if present
    if (clothingIntegrationData.blueprints) {
      this.loadBlueprints(clothingIntegrationData.blueprints);
    }

    if (clothingIntegrationData.entityDefinitions) {
      this.loadEntityDefinitions(clothingIntegrationData.entityDefinitions);
    }

    if (clothingIntegrationData.recipe) {
      const recipeData = {};
      recipeData[clothingIntegrationData.recipe.id] = clothingIntegrationData.recipe;
      this.loadRecipes(recipeData);
    }

    // Load clothing items
    if (clothingIntegrationData.clothingItems) {
      const clothingEntityDefinitions = {};
      for (const item of clothingIntegrationData.clothingItems) {
        clothingEntityDefinitions[item.id] = {
          id: item.id,
          description: item.description || `Test clothing item ${item.id}`,
          components: {
            'clothing:wearable': {
              slot: item.targetSlot,
              layer: item.layer || 'base',
              socketMappings: item.socketMappings || {},
            },
            'core:name': {
              name: item.name || item.id,
            },
            'core:description': {
              description: item.description || `A ${item.id} for testing`,
            },
            'core:material': {
              materialType: item.materialType || 'cotton',
              texture: item.texture || 'smooth',
            },
          },
        };
      }
      this.loadEntityDefinitions(clothingEntityDefinitions);
    }

    // Store integration data for reference
    this.clothingIntegrationData.set('current', clothingIntegrationData);

    this.processingLog.push({
      action: 'loadClothingIntegrationData',
      timestamp: Date.now(),
      recipesLoaded: clothingIntegrationData.recipe ? 1 : 0,
      clothingItemsLoaded: clothingIntegrationData.clothingItems ? clothingIntegrationData.clothingItems.length : 0,
      blueprintsLoaded: clothingIntegrationData.blueprints ? Object.keys(clothingIntegrationData.blueprints).length : 0,
    });
  }

  /**
   * Get current cache state for validation
   *
   * @returns {object} Cache state information
   */
  getCacheState() {
    const state = {
      isValid: true,
      anatomyCache: { isValid: true },
      clothingCache: { isValid: true },
      descriptionCache: { isValid: true },
      timestamp: Date.now(),
    };

    try {
      // Check anatomy cache if available
      if (this.anatomyCacheManager && typeof this.anatomyCacheManager.isValid === 'function') {
        state.anatomyCache.isValid = this.anatomyCacheManager.isValid();
      }

      // Check clothing cache if available
      if (this.anatomyClothingCache && typeof this.anatomyClothingCache.isValid === 'function') {
        state.clothingCache.isValid = this.anatomyClothingCache.isValid();
      }

      // Overall validity
      state.isValid = state.anatomyCache.isValid && state.clothingCache.isValid && state.descriptionCache.isValid;

    } catch (error) {
      state.isValid = false;
      state.error = error.message;
    }

    // Store state history for debugging
    this.cacheStateHistory.push(state);
    if (this.cacheStateHistory.length > 10) {
      this.cacheStateHistory.shift(); // Keep only last 10 states
    }

    return state;
  }

  /**
   * Record performance metrics for testing
   *
   * @param {string} metricName - Name of the metric
   * @param {object} metricData - Metric data
   */
  recordMetric(metricName, metricData) {
    if (!this.performanceMetrics.has(metricName)) {
      this.performanceMetrics.set(metricName, []);
    }

    const metric = {
      ...metricData,
      timestamp: Date.now(),
    };

    this.performanceMetrics.get(metricName).push(metric);

    this.processingLog.push({
      action: 'metricRecorded',
      timestamp: Date.now(),
      metricName,
      data: metricData,
    });
  }

  /**
   * Get recorded performance metrics
   *
   * @param {string} [metricName] - Optional specific metric name
   * @returns {object | Array} Metrics data
   */
  getMetrics(metricName = null) {
    if (metricName) {
      return this.performanceMetrics.get(metricName) || [];
    }
    
    const allMetrics = {};
    for (const [name, metrics] of this.performanceMetrics.entries()) {
      allMetrics[name] = metrics;
    }
    return allMetrics;
  }

  /**
   * Validate clothing integration state across systems
   *
   * @param {string} entityId - Entity to validate
   * @returns {object} Integration validation results
   */
  async validateClothingIntegration(entityId) {
    const validation = {
      success: true,
      errors: [],
      warnings: [],
      checks: {
        anatomyPresent: false,
        slotMetadataPresent: false,
        clothingItemsEquipped: false,
        slotConsistency: false,
        cacheConsistency: false,
      },
    };

    try {
      // Check anatomy presence
      const bodyComponent = this.entityManager.getComponentData(entityId, 'anatomy:body');
      validation.checks.anatomyPresent = !!bodyComponent;
      if (!bodyComponent) {
        validation.errors.push('Anatomy body component not found');
      }

      // Check slot metadata
      const slotMetadata = this.entityManager.getComponentData(entityId, 'clothing:slot_metadata');
      validation.checks.slotMetadataPresent = !!slotMetadata;
      if (!slotMetadata) {
        validation.warnings.push('Clothing slot metadata not found');
      }

      // Check clothing items
      const clothingComponents = this.entityManager.getEntitiesWithComponent('clothing:wearable');
      validation.checks.clothingItemsEquipped = clothingComponents.length > 0;

      // Check slot consistency
      if (slotMetadata && slotMetadata.slots) {
        validation.checks.slotConsistency = true;
        for (const slotId of Object.keys(slotMetadata.slots)) {
          const slot = slotMetadata.slots[slotId];
          if (!slot.socketIds || slot.socketIds.length === 0) {
            validation.warnings.push(`Slot ${slotId} has no socket mappings`);
          }
        }
      }

      // Check cache consistency
      const cacheState = this.getCacheState();
      validation.checks.cacheConsistency = cacheState.isValid;
      if (!cacheState.isValid) {
        validation.errors.push('Cache consistency check failed');
      }

      // Overall success
      validation.success = validation.errors.length === 0;

    } catch (error) {
      validation.success = false;
      validation.errors.push(`Integration validation error: ${error.message}`);
    }

    return validation;
  }

  /**
   * Clear processing log
   */
  clearProcessingLog() {
    this.processingLog = [];
    this.errorInjection.clear();
    this.performanceMetrics.clear();
    this.clothingIntegrationData.clear();
    this.cacheStateHistory = [];
  }

  /**
   * Get processing log for debugging
   *
   * @returns {Array} Processing log entries
   */
  getProcessingLog() {
    return [...this.processingLog];
  }

  /**
   * Load core entity definitions needed for anatomy testing
   * Provides essential definitions like core:actor that anatomy tests depend on
   */
  loadCoreEntityDefinitions() {
    // Load core:actor entity definition that anatomy tests require
    this.loadEntityDefinitions({
      'core:actor': {
        id: 'core:actor',
        description: 'Core actor entity for anatomy testing',
        components: {
          'core:actor': {},
          'core:name': { text: 'Test Actor' },
          'core:description': { description: 'A test actor entity' }
        }
      },
      'test:simple_part': {
        id: 'test:simple_part',
        description: 'Simple anatomy part for testing',
        components: {
          'anatomy:part': {
            subType: 'generic_part',
          },
          'core:name': { text: 'Test Part' },
          'core:description': { description: 'A test anatomy part' }
        }
      },
      'anatomy:blueprint_slot': {
        id: 'anatomy:blueprint_slot',
        description: 'Blueprint slot entity for anatomy generation',
        components: {
          'anatomy:slot': {},
          'core:name': { text: 'Blueprint Slot' }
        }
      }
    });
  }

  /**
   * Load stress test components for performance testing
   */
  loadStressTestComponents() {
    // Load core definitions first
    this.loadCoreEntityDefinitions();
    // Load base anatomy components
    this.loadComponents({
      'anatomy:body': {
        id: 'anatomy:body',
        data: { rootPartId: null, recipeId: null, body: null },
      },
      'anatomy:joint': {
        id: 'anatomy:joint',
        data: { parentId: null, socketId: null, jointType: null },
      },
      'anatomy:part': {
        id: 'anatomy:part',
        data: { subType: null },
      },
      'anatomy:sockets': {
        id: 'anatomy:sockets',
        data: { sockets: [] },
      },
      'descriptors:body': {
        id: 'descriptors:body',
        data: { descriptors: {} },
      },
    });

    // Load stress test entity definitions
    this.loadEntityDefinitions({
      'stress:torso': {
        id: 'stress:torso',
        components: {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': {
            sockets: Array.from({ length: 10 }, (_, i) => ({
              id: `socket_${i}`,
              max: 5,
              allowedTypes: ['part'],
            })),
          },
        },
      },
      'stress:part': {
        id: 'stress:part',
        components: {
          'anatomy:part': { subType: 'part' },
          'anatomy:sockets': {
            sockets: Array.from({ length: 3 }, (_, i) => ({
              id: `sub_socket_${i}`,
              max: 2,
              allowedTypes: ['part'],
            })),
          },
        },
      },
    });
  }

  /**
   * Generate a simple anatomy for testing
   *
   * @returns {Promise<object>} Generated anatomy with rootId
   */
  async generateSimpleAnatomy() {
    // For memory tests, we should reuse the same entity definition to avoid accumulation
    // Only create unique definitions when testing definition-specific behavior
    const reuseDefinition = this.options?.reuseEntityDefinitions !== false;
    
    const entityDefId = reuseDefinition 
      ? 'test:simple_torso_reusable'
      : `test:simple_torso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Only load the definition if it doesn't exist or we're creating a unique one
    if (!reuseDefinition || !this.registry.get('entityDefinitions', entityDefId)) {
      const entityDef = {
        id: entityDefId,
        components: {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': {
            sockets: [
              { id: 'left_arm', max: 1, allowedTypes: ['arm'] },
              { id: 'right_arm', max: 1, allowedTypes: ['arm'] },
            ],
          },
        },
      };
      this.loadEntityDefinitions({ [entityDefId]: entityDef });
    }

    // Create a unique instance ID for the entity itself
    const instanceId = `torso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const torso = await this.entityManager.createEntityInstance(entityDefId, {
      instanceId: instanceId
    });
    
    await this.entityManager.addComponent(torso.id, 'anatomy:body', {
      rootPartId: torso.id,
      recipeId: 'test:simple_recipe',
      body: { root: torso.id },
    });

    return { rootId: torso.id, entityDefId: reuseDefinition ? null : entityDefId };
  }

  /**
   * Create an anatomy part for testing
   *
   * @param {string} partId - ID for the part
   * @returns {Promise<object>} Created part entity
   */
  async createAnatomyPart(partId) {
    const part = await this.entityManager.createEntityInstance('test:simple_part', {
      instanceId: partId,
    });
    await this.entityManager.addComponent(part.id, 'anatomy:part', {
      subType: 'generic_part',
    });
    await this.entityManager.addComponent(part.id, 'anatomy:sockets', {
      sockets: [],
    });
    return part;
  }

  /**
   * Attach a part to a parent
   *
   * @param {string} parentId - Parent entity ID
   * @param {string} childId - Child entity ID
   * @returns {Promise<void>}
   */
  async attachPart(parentId, childId) {
    await this.entityManager.addComponent(childId, 'anatomy:joint', {
      parentId,
      socketId: 'generic_socket',
      jointType: 'attached',
    });
  }

  /**
   * Calculate maximum depth of an anatomy hierarchy
   *
   * @param {string} rootId - Root entity ID
   * @returns {number} Maximum depth
   */
  calculateMaxDepth(rootId) {
    const visited = new Set();
    
    const calculateDepthRecursive = (entityId, currentDepth = 0) => {
      if (visited.has(entityId)) {
        return currentDepth;
      }
      visited.add(entityId);

      const children = this.bodyGraphService.getChildren(entityId);
      if (!children || children.length === 0) {
        return currentDepth;
      }

      let maxChildDepth = currentDepth;
      for (const child of children) {
        const childDepth = calculateDepthRecursive(child.id, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }

      return maxChildDepth;
    };

    return calculateDepthRecursive(rootId);
  }

  /**
   * Clean up an entity and all its children
   *
   * @param {string | object} entityInfo - Root entity ID to clean up, or object with rootId and entityDefId
   * @returns {Promise<void>}
   */
  async cleanupEntity(entityInfo) {
    try {
      const rootId = typeof entityInfo === 'string' ? entityInfo : entityInfo.rootId;
      const entityDefId = typeof entityInfo === 'object' ? entityInfo.entityDefId : null;
      
      // Get all parts in the anatomy
      // getAllParts expects a bodyComponent object, not a rootId string
      const bodyComponent = { root: rootId };
      const allParts = this.bodyGraphService.getAllParts(bodyComponent);
      
      // Delete all parts
      for (const part of allParts) {
        await this.entityManager.removeEntityInstance(part.id);
      }

      // Also delete the root if not in allParts
      if (!allParts.find(p => p.id === rootId)) {
        await this.entityManager.removeEntityInstance(rootId);
      }

      // Clean up entity definition if provided to prevent accumulation
      if (entityDefId && this.registry) {
        try {
          // Remove from entityDefinitions registry - must access data directly
          const entityDefsMap = this.registry.data.get('entityDefinitions');
          if (entityDefsMap) {
            entityDefsMap.delete(entityDefId);
          }
          // Also remove from anatomyParts registry if it was added there
          const anatomyPartsMap = this.registry.data.get('anatomyParts');
          if (anatomyPartsMap) {
            anatomyPartsMap.delete(entityDefId);
          }
        } catch (defError) {
          // Entity definition cleanup is optional - don't fail the whole cleanup
          this.logger?.debug(`Could not cleanup entity definition ${entityDefId}:`, defError);
        }
      }

      // Invalidate caches
      this.anatomyCacheManager?.invalidateCacheForRoot(rootId);
    } catch (error) {
      this.logger.warn(`Failed to fully cleanup entity ${typeof entityInfo === 'string' ? entityInfo : entityInfo.rootId}:`, error);
    }
  }

  /**
   * Create an entity with a specific component for memory testing
   *
   * @param {string} componentType - Component type to add
   * @returns {Promise<object>} Created entity
   */
  async createEntityWithComponent(componentType) {
    const entityId = `test_entity_${Date.now()}_${Math.random()}`;
    const entity = await this.entityManager.createEntityInstance('core:actor', {
      instanceId: entityId,
    });
    
    // Add the requested component with minimal data
    const componentData = this.getMinimalComponentData(componentType);
    await this.entityManager.addComponent(entity.id, componentType, componentData);
    
    return entity;
  }

  /**
   * Get minimal component data for a component type
   *
   * @param {string} componentType - Component type
   * @returns {object} Minimal component data
   * @private
   */
  getMinimalComponentData(componentType) {
    const minimalData = {
      'anatomy:body': { rootPartId: null, recipeId: null, body: null },
      'anatomy:part': { subType: 'generic' },
      'anatomy:joint': { parentId: null, socketId: null, jointType: null },
      'anatomy:sockets': { sockets: [] },
      'descriptors:body': { descriptors: {} },
    };

    return minimalData[componentType] || {};
  }

  /**
   * Inject a generation failure at a specific phase
   *
   * @param {string} phase - Phase to inject failure ('validation', 'generation', 'cache', 'description')
   * @param {Error} [error] - Custom error to throw
   */
  injectGenerationFailure(phase, error = null) {
    const failureError = error || new Error(`Injected failure at ${phase} phase`);
    
    switch (phase) {
      case 'validation':
        // Mock recipe validation to fail
        if (this.anatomyGenerationWorkflow && this.anatomyGenerationWorkflow.validateRecipe) {
          const original = this.anatomyGenerationWorkflow.validateRecipe;
          this.anatomyGenerationWorkflow.validateRecipe = jest.fn(() => {
            this.anatomyGenerationWorkflow.validateRecipe = original; // Restore after use
            throw failureError;
          });
        }
        break;
        
      case 'generation':
        // Mock anatomy generation to fail
        if (this.anatomyGenerationWorkflow && this.anatomyGenerationWorkflow.generate) {
          const original = this.anatomyGenerationWorkflow.generate;
          this.anatomyGenerationWorkflow.generate = jest.fn().mockRejectedValue(failureError);
          // Store original for restoration
          this.anatomyGenerationWorkflow._originalGenerate = original;
        }
        break;
        
      case 'cache':
        // Mock cache building to fail
        if (this.graphBuildingWorkflow && this.graphBuildingWorkflow.buildCache) {
          const original = this.graphBuildingWorkflow.buildCache;
          this.graphBuildingWorkflow.buildCache = jest.fn().mockRejectedValue(failureError);
          this.graphBuildingWorkflow._originalBuildCache = original;
        }
        break;
        
      case 'description':
        // Mock description generation to fail
        if (this.anatomyDescriptionService && this.anatomyDescriptionService.generateAll) {
          const original = this.anatomyDescriptionService.generateAll;
          this.anatomyDescriptionService.generateAll = jest.fn().mockRejectedValue(failureError);
          this.anatomyDescriptionService._originalGenerateAll = original;
        }
        break;
    }
    
    this.processingLog.push({
      action: 'injectedFailure',
      timestamp: Date.now(),
      phase,
      error: failureError.message,
    });
  }

  /**
   * Restore all mocked methods to original implementations
   */
  restoreOriginalMethods() {
    // Restore generation workflow
    if (this.anatomyGenerationWorkflow?._originalGenerate) {
      this.anatomyGenerationWorkflow.generate = this.anatomyGenerationWorkflow._originalGenerate;
      delete this.anatomyGenerationWorkflow._originalGenerate;
    }
    
    // Restore cache workflow
    if (this.graphBuildingWorkflow?._originalBuildCache) {
      this.graphBuildingWorkflow.buildCache = this.graphBuildingWorkflow._originalBuildCache;
      delete this.graphBuildingWorkflow._originalBuildCache;
    }
    
    // Restore description service
    if (this.anatomyDescriptionService?._originalGenerateAll) {
      this.anatomyDescriptionService.generateAll = this.anatomyDescriptionService._originalGenerateAll;
      delete this.anatomyDescriptionService._originalGenerateAll;
    }
  }

  /**
   * Simulate cache corruption
   *
   * @param {string} corruptionType - Type of corruption ('invalidReferences', 'missingNodes', 'circularDependency')
   */
  corruptCache(corruptionType) {
    if (!this.anatomyCacheManager) {
      throw new Error('Cache manager not available');
    }
    
    switch (corruptionType) {
      case 'invalidReferences':
        // Add fake entries to cache
        this.anatomyCacheManager.set('fake-entity-1', {
          entityId: 'fake-entity-1',
          partType: 'corrupted',
          parentId: 'non-existent-parent',
          children: ['non-existent-child'],
        });
        break;
        
      case 'missingNodes':
        // Remove some nodes but keep references
        const entries = Array.from(this.anatomyCacheManager.entries());
        if (entries.length > 1) {
          // Delete a middle node but keep its references
          const [nodeId] = entries[Math.floor(entries.length / 2)];
          this.anatomyCacheManager.delete(nodeId);
        }
        break;
        
      case 'circularDependency':
        // Create circular reference
        const firstEntry = Array.from(this.anatomyCacheManager.entries())[0];
        if (firstEntry) {
          const [firstId, firstNode] = firstEntry;
          // Make it reference itself as parent
          firstNode.parentId = firstId;
          this.anatomyCacheManager.set(firstId, firstNode);
        }
        break;
    }
    
    this.processingLog.push({
      action: 'corruptedCache',
      timestamp: Date.now(),
      corruptionType,
    });
  }

  /**
   * Validate that rollback completed successfully
   *
   * @param {string} entityId - Entity that was being generated
   * @returns {object} Validation results
   */
  validateRollbackCompleteness(entityId) {
    const validation = {
      success: true,
      orphanedEntities: [],
      remainingComponents: [],
      cacheEntries: [],
    };
    
    // Check for orphaned anatomy parts
    const anatomyParts = this.entityManager.getEntitiesWithComponent('anatomy:part');
    for (const part of anatomyParts) {
      const partData = part.getComponentData('anatomy:part');
      if (partData?.ownerId === entityId) {
        validation.orphanedEntities.push(part.id);
        validation.success = false;
      }
    }
    
    // Check if anatomy body was cleared
    const entity = this.entityManager.getEntityInstance(entityId);
    if (entity) {
      const anatomyData = entity.getComponentData('anatomy:body');
      if (anatomyData?.body) {
        validation.remainingComponents.push('anatomy:body still has body data');
        validation.success = false;
      }
    }
    
    // Check cache is clean
    if (this.anatomyCacheManager.size() > 0) {
      const entries = Array.from(this.anatomyCacheManager.entries());
      for (const [cacheId] of entries) {
        // Check if this cache entry is related to our entity
        validation.cacheEntries.push(cacheId);
      }
    }
    
    this.processingLog.push({
      action: 'validatedRollback',
      timestamp: Date.now(),
      entityId,
      success: validation.success,
      issues: {
        orphaned: validation.orphanedEntities.length,
        components: validation.remainingComponents.length,
        cache: validation.cacheEntries.length,
      },
    });
    
    return validation;
  }

  /**
   * Capture the sequence of entity deletions during rollback
   *
   * @returns {Array} Array to store deletion sequence
   */
  captureRollbackSequence() {
    const sequence = [];
    
    // Mock removeEntityInstance to capture sequence
    const originalRemove = this.entityManager.removeEntityInstance.bind(this.entityManager);
    this.entityManager.removeEntityInstance = jest.fn(async (entityId) => {
      sequence.push({
        entityId,
        timestamp: Date.now(),
      });
      return originalRemove(entityId);
    });
    
    // Store original for restoration
    this.entityManager._originalRemoveEntityInstance = originalRemove;
    
    return sequence;
  }

  /**
   * Restore entity manager methods
   */
  restoreEntityManager() {
    if (this.entityManager._originalRemoveEntityInstance) {
      this.entityManager.removeEntityInstance = this.entityManager._originalRemoveEntityInstance;
      delete this.entityManager._originalRemoveEntityInstance;
    }
  }

  /**
   * Create a constraint violation scenario
   *
   * @param {string} violationType - Type of violation ('missingRequired', 'exclusion', 'slotLimit')
   * @returns {object} Scenario configuration
   */
  createConstraintViolationScenario(violationType) {
    const scenario = {
      recipe: null,
      blueprint: null,
      expectedError: null,
    };
    
    switch (violationType) {
      case 'missingRequired':
        scenario.recipe = {
          id: 'test:missing_required',
          blueprintId: 'test:incomplete',
          constraints: {
            requires: [
              { partType: 'head', min: 1 },
              { partType: 'leg', min: 2 }, // Will be missing
            ],
          },
        };
        scenario.blueprint = {
          id: 'test:incomplete',
          root: 'test:humanoid_torso',
          slots: {
            head_socket: { partId: 'test:humanoid_head', required: true },
          },
        };
        scenario.expectedError = 'Required part type not satisfied';
        break;
        
      case 'exclusion':
        scenario.recipe = {
          id: 'test:exclusion',
          blueprintId: 'test:conflicting',
          constraints: {
            excludes: [
              { parts: ['arm', 'wing'], message: 'Cannot have both' },
            ],
          },
        };
        scenario.blueprint = {
          id: 'test:conflicting',
          root: 'test:humanoid_torso',
          slots: {
            arm_socket: { partId: 'test:humanoid_arm', required: true },
            wing_socket: { partId: 'test:wing', required: true },
          },
        };
        scenario.expectedError = 'Exclusion constraint violated';
        break;
        
      case 'slotLimit':
        scenario.recipe = {
          id: 'test:slot_limit',
          blueprintId: 'test:over_limit',
          slots: {
            arm: { max: 2 },
          },
        };
        scenario.blueprint = {
          id: 'test:over_limit',
          root: 'test:humanoid_torso',
          slots: {
            arm1: { partId: 'test:humanoid_arm', required: true },
            arm2: { partId: 'test:humanoid_arm', required: true },
            arm3: { partId: 'test:humanoid_arm', required: true }, // Exceeds limit
          },
        };
        scenario.expectedError = 'Slot limit exceeded';
        break;
    }
    
    this.processingLog.push({
      action: 'createdConstraintScenario',
      timestamp: Date.now(),
      violationType,
      recipeId: scenario.recipe?.id,
    });
    
    return scenario;
  }

  /**
   * Cleanup enhanced test bed resources
   */
  cleanup() {
    // Restore any mocked methods
    this.restoreOriginalMethods();
    this.restoreEntityManager();
    
    // Call parent cleanup
    super.cleanup();
    this.dataGenerator.clear();
    this.clearProcessingLog();
  }
}