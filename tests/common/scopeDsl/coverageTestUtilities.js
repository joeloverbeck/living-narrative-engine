/**
 * @file Coverage Test Utilities
 * @description Utilities for coverage resolution performance testing
 */

import { tokens } from '../../../src/dependencyInjection/tokens.js';

/**
 * Utilities for coverage resolution performance testing
 */
export class CoverageTestUtilities {
  constructor(container) {
    this.container = container;
    this.entityManager = container.resolve(tokens.IEntityManager);
    this.dataRegistry = container.resolve(tokens.IDataRegistry);
  }

  /**
   * Generate equipment configurations for performance testing
   *
   * @param {number} totalItems - Total number of equipment items to generate
   * @param {object} options - Generation options
   * @returns {object} Generated equipment configuration
   */
  generateEquipment(totalItems, options = {}) {
    const { coverageItems = 0, noCoverage = false, variety = false } = options;
    const equipment = { equipped: {} };

    const slots = ['torso_upper', 'torso_lower', 'legs', 'feet', 'hands'];
    const layers = ['outer', 'base', 'underwear', 'accessories'];

    let itemCount = 0;
    let coverageCount = 0;

    for (const slot of slots) {
      if (itemCount >= totalItems) break;

      equipment.equipped[slot] = {};

      for (const layer of layers) {
        if (itemCount >= totalItems) break;

        const itemId = `test:item_${itemCount}`;
        equipment.equipped[slot][layer] = itemId;

        // Create entity with coverage component if needed
        if (!noCoverage && coverageCount < coverageItems) {
          const coverageSlot = variety
            ? slots[Math.floor(Math.random() * slots.length)]
            : 'torso_lower';

          const entity = {
            id: itemId,
            components: {
              'clothing:coverage_mapping': {
                covers: [coverageSlot],
                coveragePriority: layer === 'outer' ? 'outer' : 'base',
              },
            },
          };

          // Store entity definition
          this.dataRegistry.store('entityDefinitions', itemId, entity);

          coverageCount++;
        } else {
          const entity = {
            id: itemId,
            components: {},
          };

          this.dataRegistry.store('entityDefinitions', itemId, entity);
        }

        itemCount++;
      }
    }

    return equipment;
  }

  /**
   * Create a test character with equipment
   *
   * @param {object} options - Character creation options
   * @returns {Promise<object>} Created character with equipment
   */
  async createCharacter(options = {}) {
    const characterId = `test:character_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const equipment = options.equipment || { equipped: {} };

    const entity = {
      id: characterId,
      components: {
        'clothing:equipment': equipment,
        'core:actor': { name: 'Test Character' },
      },
    };

    // Store entity definition
    this.dataRegistry.store('entityDefinitions', characterId, entity);

    // Create entity instance
    await this.entityManager.createEntityInstance(characterId, {
      instanceId: characterId,
      definitionId: characterId,
    });

    return { id: characterId, equipment };
  }

  /**
   * Create test bed for slot access resolver testing
   *
   * @returns {object} Test bed with mock dependencies
   */
  createSlotAccessTestBed() {
    const mockEntitiesGateway = {
      getEntity: (entityId) => {
        const entity = this.entityManager.getEntity(entityId);
        return entity;
      },
      getComponentData: (entityId, componentId) => {
        return this.entityManager.getComponentData(entityId, componentId);
      },
      hasComponent: (entityId, componentId) => {
        return this.entityManager.hasComponent(entityId, componentId);
      },
      getEntityInstance: (entityId) => {
        return this.entityManager.getEntityInstance(entityId);
      },
      getEntitiesWithComponent: (componentId) => {
        return this.entityManager.getEntitiesWithComponent(componentId);
      },
      getEntities: () => {
        return this.entityManager.getEntities();
      },
    };

    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    return {
      entitiesGateway: mockEntitiesGateway,
      logger: mockLogger,
    };
  }

  /**
   * Create mock context for slot access resolution
   *
   * @param {object} equipment - Equipment configuration
   * @param {string} mode - Resolution mode
   * @param {boolean} enableTrace - Whether to enable tracing
   * @param {string} entityId - Entity ID for the context
   * @returns {object} Mock context for testing
   */
  createMockContext(
    equipment,
    mode = 'topmost',
    enableTrace = false,
    entityId = 'test_character'
  ) {
    const clothingAccess = {
      __clothingSlotAccess: true,
      equipped: equipment,
      mode: mode,
      entityId: entityId,
      type: 'clothing_slot_access',
    };

    const mockTrace = enableTrace
      ? {
          addLog: (_level, _message, _source) => {
            // Mock trace logging
          },
          coverageResolution: {
            strategy: this.determineStrategy(equipment),
            priorityCalculation: {
              cacheHits: Math.floor(Math.random() * 10),
              cacheMisses: Math.floor(Math.random() * 3),
            },
          },
        }
      : null;

    return {
      getValue: () => ({ entityId: entityId, mode }),
      dispatcher: {
        resolve: () => new Set([clothingAccess]),
      },
      trace: mockTrace,
    };
  }

  /**
   * Determine resolution strategy based on equipment complexity
   *
   * @param {object} equipment - Equipment to analyze
   * @returns {string} Resolution strategy ('legacy' or 'coverage')
   */
  determineStrategy(equipment) {
    if (!equipment) return 'legacy';

    let totalItems = 0;
    for (const slot in equipment) {
      for (const _layer in equipment[slot]) {
        totalItems++;
      }
    }

    // Simple cases with 1 item use legacy, complex cases use coverage
    return totalItems === 1 ? 'legacy' : 'coverage';
  }
}

/**
 * Performance tracking utility
 */
export class PerformanceTracker {
  constructor() {
    this.baselines = {};
    this.coverageResults = {};
  }

  setBaselines(baselines) {
    this.baselines = baselines;
  }

  setCoverageResults(results) {
    this.coverageResults = results;
  }

  getBaselines() {
    return this.baselines;
  }

  getPerformanceIncrease(scenario) {
    const baseline = this.baselines[scenario];
    const coverage = this.coverageResults[scenario];

    if (!baseline || !coverage) return null;

    return ((coverage - baseline) / baseline) * 100;
  }
}

/**
 * Cache efficiency tracking
 */
export class CacheEfficiencyTracker {
  constructor() {
    this.hits = 0;
    this.misses = 0;
  }

  record(priorityCalculationTrace) {
    this.hits += priorityCalculationTrace.cacheHits || 0;
    this.misses += priorityCalculationTrace.cacheMisses || 0;
  }

  getEfficiency() {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
}

/**
 * Performance configuration constants
 */
export const PERFORMANCE_CONFIG = {
  warmupRuns: 10, // Runs before measurement
  measurementRuns: 1000, // Runs for measurement
  memoryCheckInterval: 100, // Check memory every N runs
  timeoutMs: 30000, // Test timeout
  gcBetweenTests: true, // Force GC between tests
};

/**
 * Performance targets for validation
 */
export const PERFORMANCE_TARGETS = {
  simple: 2, // <2ms for simple cases (1 item)
  moderate: 5, // <5ms for moderate cases (5 items)
  complex: 15, // <15ms for complex cases (15 items)
  coverageOverhead: 50, // <50% increase vs legacy
  memoryIncrease: 20 * 1024 * 1024, // <20MB increase after 10k operations
  cacheHitRate: 0.7, // >70% hit rate in typical scenarios
};

export default CoverageTestUtilities;
