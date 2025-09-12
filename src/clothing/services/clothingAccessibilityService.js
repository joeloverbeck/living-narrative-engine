/**
 * @file Unified clothing accessibility service
 * @description Centralizes all clothing accessibility logic including coverage blocking,
 * priority calculation, and business rule validation.
 */

import { validateDependency, assertNonBlankString } from '../../utils/dependencyUtils.js';
import { createCoverageAnalyzer } from '../analysis/index.js';
import { 
  COVERAGE_PRIORITY, 
  LAYER_PRIORITY_WITHIN_COVERAGE,
  PRIORITY_CONFIG 
} from '../../scopeDsl/prioritySystem/priorityConstants.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntitiesGateway.js').IEntitiesGateway} IEntitiesGateway */

/**
 * Service for managing clothing accessibility queries and coverage blocking logic
 * 
 * @example
 * const service = new ClothingAccessibilityService({
 *   logger,
 *   entityManager,
 *   entitiesGateway
 * });
 * 
 * const accessibleItems = service.getAccessibleItems('entity-123');
 * const isAccessible = service.isItemAccessible('entity-123', 'item-456');
 */
export class ClothingAccessibilityService {
  /** @type {ILogger} */
  #logger;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {object|null} */
  #coverageAnalyzer;
  /** @type {Map} */
  #cache;
  /** @type {Map|null} */
  #priorityCache;
  /** @type {number} */
  #maxPriorityCacheSize;

  /**
   * Creates an instance of ClothingAccessibilityService
   * 
   * @param {object} deps - Constructor dependencies
   * @param {ILogger} deps.logger - Logger instance for debugging and error reporting
   * @param {IEntityManager} deps.entityManager - Entity manager for accessing entity data
   * @param {IEntitiesGateway} [deps.entitiesGateway] - Optional entities gateway for coverage analysis
   */
  constructor({ logger, entityManager, entitiesGateway }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData', 'hasComponent']
    });
    
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#cache = new Map();
    
    // Initialize priority cache if caching enabled
    if (PRIORITY_CONFIG.enableCaching) {
      this.#priorityCache = new Map();
      this.#maxPriorityCacheSize = PRIORITY_CONFIG.maxCacheSize || 1000;
    } else {
      this.#priorityCache = null;
      this.#maxPriorityCacheSize = 0;
    }
    
    // Initialize coverage analyzer if entitiesGateway provided
    if (entitiesGateway) {
      try {
        this.#coverageAnalyzer = createCoverageAnalyzer({ 
          entitiesGateway, 
          errorHandler: null 
        });
        this.#logger.debug('ClothingAccessibilityService: Coverage analyzer initialized');
      } catch (error) {
        this.#logger.warn('Failed to initialize coverage analyzer', { 
          error: error.message 
        });
        this.#coverageAnalyzer = null;
      }
    } else {
      this.#coverageAnalyzer = null;
    }
    
    this.#logger.info('ClothingAccessibilityService: Initialized');
  }

  /**
   * Get equipment state from entity
   * 
   * @private
   * @param {string} entityId - Entity ID
   * @returns {object} Equipment state or empty object
   */
  #getEquipmentState(entityId) {
    try {
      const equipment = this.#entityManager.getComponentData(entityId, 'clothing:equipment');
      if (!equipment || !equipment.equipped) {
        return {};
      }
      return equipment.equipped;
    } catch (error) {
      this.#logger.warn('Failed to get equipment state', { entityId, error: error.message });
      return {};
    }
  }

  /**
   * Parse equipment slots into flat array of items
   * 
   * @private
   * @param {object} equipment - Equipment state object
   * @returns {Array} Array of { itemId, slot, layer }
   */
  #parseEquipmentSlots(equipment) {
    const items = [];
    
    for (const [slotName, slotData] of Object.entries(equipment)) {
      if (!slotData || typeof slotData !== 'object') {
        continue;
      }
      
      for (const [layer, itemData] of Object.entries(slotData)) {
        // Handle both string (single item) and array (multiple items) formats
        if (typeof itemData === 'string') {
          items.push({
            itemId: itemData,
            slot: slotName,
            layer
          });
        } else if (Array.isArray(itemData)) {
          // Some layers like accessories can have multiple items
          for (const itemId of itemData) {
            if (typeof itemId === 'string') {
              items.push({
                itemId,
                slot: slotName,
                layer
              });
            }
          }
        }
      }
    }
    
    return items;
  }


  /**
   * Generate cache key for query
   * 
   * @private
   * @param {string} entityId - Entity ID
   * @param {object} options - Query options
   * @returns {string} Cache key
   */
  #generateCacheKey(entityId, options) {
    return `${entityId}:${JSON.stringify(options)}`;
  }

  /**
   * Get cached result if available and not expired
   * 
   * @private
   * @param {string} cacheKey - Cache key
   * @returns {Array|null} Cached result or null if not available/expired
   */
  #getCachedResult(cacheKey) {
    if (this.#cache.has(cacheKey)) {
      const cached = this.#cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5000) { // 5 second TTL
        return cached.result;
      }
    }
    return null;
  }

  /**
   * Cache result and return it
   * 
   * @private
   * @param {string} cacheKey - Cache key
   * @param {Array} result - Result to cache
   * @returns {Array} The cached result
   */
  #cacheAndReturn(cacheKey, result) {
    this.#cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    return result;
  }

  /**
   * Filter items by body area
   * 
   * @private
   * @param {Array} items - Array of items with slot information
   * @param {string} bodyArea - Body area to filter by
   * @returns {Array} Filtered items
   */
  #filterByBodyArea(items, bodyArea) {
    // For now, use slot name as proxy for body area
    // Future implementation could use coverage_mapping component
    return items.filter(item => item.slot === bodyArea);
  }

  /**
   * Apply coverage blocking analysis to items
   * 
   * @private
   * @param {Array} items - Array of equipped items
   * @param {string} entityId - Entity ID
   * @param {object} equipment - Equipment state
   * @param {string} mode - Query mode
   * @returns {Array} Filtered items based on coverage
   */
  #applyCoverageBlocking(items, entityId, equipment, mode) {
    // Only apply coverage blocking for topmost modes
    const shouldApplyBlocking = mode === 'topmost' || mode === 'topmost_no_accessories';
    
    if (!shouldApplyBlocking || !this.#coverageAnalyzer) {
      return items;
    }
    
    try {
      const coverageAnalysis = this.#coverageAnalyzer.analyzeCoverageBlocking(
        equipment, 
        entityId
      );
      
      // Filter out blocked items
      return items.filter(item => 
        coverageAnalysis.isAccessible(item.itemId, item.slot, item.layer)
      );
    } catch (error) {
      this.#logger.warn('Coverage analysis failed, returning all items', {
        entityId,
        error: error.message
      });
      return items;
    }
  }

  /**
   * Calculate unified priority for an item
   *
   * @private
   * @param {object} item - Item with slot, layer, coveragePriority
   * @param {string} context - Context (removal, equipping, inspection)
   * @returns {number} Calculated priority (lower = higher priority)
   */
  #calculateItemPriority(item, context = 'removal') {
    const cacheKey = `${item.itemId}:${item.layer}:${context}`;
    
    // Check priority cache
    if (this.#priorityCache && this.#priorityCache.has(cacheKey)) {
      return this.#priorityCache.get(cacheKey);
    }
    
    // Get coverage priority from item or fallback to layer
    const coveragePriority = this.#getItemCoveragePriority(item);
    const coverageValue = COVERAGE_PRIORITY[coveragePriority] || 
                          COVERAGE_PRIORITY.direct;
    
    // Get layer priority for tie-breaking
    const layerValue = LAYER_PRIORITY_WITHIN_COVERAGE[item.layer] || 
                       LAYER_PRIORITY_WITHIN_COVERAGE.base;
    
    // Calculate composite priority
    let priority = coverageValue + (layerValue / 100); // Layer as decimal for tie-breaking
    
    // Apply context modifiers
    priority = this.#applyContextModifiers(priority, item, context);
    
    // Cache the result
    if (this.#priorityCache) {
      this.#priorityCache.set(cacheKey, priority);
      this.#managePriorityCacheSize();
    }
    
    return priority;
  }

  /**
   * Get coverage priority for an item
   *
   * @private
   * @param {object} item - Item with itemId and layer
   * @returns {string} Coverage priority type
   */
  #getItemCoveragePriority(item) {
    try {
      // Try to get from coverage_mapping component
      const coverageMapping = this.#entityManager.getComponentData(
        item.itemId, 
        'clothing:coverage_mapping'
      );
      
      if (coverageMapping && coverageMapping.coveragePriority) {
        return coverageMapping.coveragePriority;
      }
    } catch (error) {
      this.#logger.debug('Could not get coverage mapping', { 
        itemId: item.itemId,
        error: error.message 
      });
    }
    
    // Fallback to layer-based priority
    const layerToCoverage = {
      outer: 'outer',
      base: 'base',
      underwear: 'underwear',
      accessories: 'direct'  // Default to 'direct' for accessories
    };
    
    return layerToCoverage[item.layer] || 'direct';
  }

  /**
   * Apply context-specific priority modifiers
   *
   * @private
   * @param {number} basePriority - Base priority value
   * @param {object} item - Item object
   * @param {string} context - Context for priority calculation
   * @returns {number} Modified priority
   */
  #applyContextModifiers(basePriority, item, context) {
    // Context modifiers can adjust priority based on use case
    switch (context) {
      case 'removal':
        // For removal, outer items should be more accessible
        if (item.layer === 'outer') {
          return basePriority * 0.9; // 10% priority boost
        }
        break;
        
      case 'equipping':
        // For equipping, empty slots have highest priority
        // This is handled elsewhere, just return base
        break;
        
      case 'inspection':
        // For inspection, all items equally accessible
        // Could return a flat priority
        break;
    }
    
    return basePriority;
  }

  /**
   * Sort items by priority with stable tie-breaking
   *
   * @private
   * @param {Array} items - Items to sort
   * @param {string} context - Context for priority calculation
   * @returns {Array} Sorted items
   */
  #sortByPriority(items, context) {
    // Calculate priorities for all items
    const itemsWithPriority = items.map((item, index) => ({
      ...item,
      priority: this.#calculateItemPriority(item, context),
      originalIndex: index // For stable sort
    }));
    
    // Sort by priority, then by original index for stability
    itemsWithPriority.sort((a, b) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return a.originalIndex - b.originalIndex;
    });
    
    // Remove temporary fields
    return itemsWithPriority.map(({ priority: _priority, originalIndex: _originalIndex, ...item }) => item);
  }

  /**
   * Manage priority cache size
   *
   * @private
   */
  #managePriorityCacheSize() {
    if (!this.#priorityCache || 
        this.#priorityCache.size <= this.#maxPriorityCacheSize) {
      return;
    }
    
    // Remove oldest entries (FIFO)
    const entriesToRemove = this.#priorityCache.size - this.#maxPriorityCacheSize;
    const keys = Array.from(this.#priorityCache.keys());
    
    for (let i = 0; i < entriesToRemove; i++) {
      this.#priorityCache.delete(keys[i]);
    }
  }

  /**
   * Apply mode-specific filtering logic
   * 
   * @private
   * @param {Array} items - Array of items to filter
   * @param {string} mode - Query mode
   * @returns {Array} Filtered items based on mode
   */
  #applyModeLogic(items, mode) {
    const LAYER_PRIORITY = {
      topmost: ['outer', 'base', 'underwear'],
      topmost_no_accessories: ['outer', 'base', 'underwear'],
      all: ['outer', 'base', 'underwear', 'accessories'],
      outer: ['outer'],
      base: ['base'],
      underwear: ['underwear'],
    };
    
    const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;
    
    if (mode === 'topmost' || mode === 'topmost_no_accessories') {
      // For topmost, only return the highest priority item per slot
      const slotMap = new Map();
      
      for (const item of items) {
        const layerIndex = layers.indexOf(item.layer);
        if (layerIndex === -1) continue;
        
        const existing = slotMap.get(item.slot);
        if (!existing || layers.indexOf(existing.layer) > layerIndex) {
          slotMap.set(item.slot, item);
        }
      }
      
      return Array.from(slotMap.values());
    }
    
    // For other modes, filter by allowed layers
    return items.filter(item => layers.includes(item.layer));
  }

  /**
   * Get all accessible clothing items for an entity
   * 
   * @param {string} entityId - Entity to query for accessible items
   * @param {object} options - Query options
   * @param {string} [options.mode] - Query mode: 'topmost', 'all', 'outer', 'base', 'underwear'
   * @param {string} [options.bodyArea] - Filter by specific body area/slot
   * @param {string} [options.layer] - Filter by specific clothing layer
   * @param {string} [options.context] - Context for the query (e.g., 'removal', 'equipping', 'inspection')
   * @param {boolean} [options.sortByPriority] - Whether to sort results by priority
   * @returns {Array} Array of accessible item IDs
   * @example
   * const items = service.getAccessibleItems('entity-123');
   * // Returns: ['clothing:shirt', 'clothing:pants']
   * 
   * const itemsWithOptions = service.getAccessibleItems('entity-123', {
   *   mode: 'topmost',
   *   layer: 'base'
   * });
   */
  getAccessibleItems(entityId, options = {}) {
    const {
      mode = 'topmost',
      bodyArea = null,
      layer = null,
      context = 'removal',
      sortByPriority = true
    } = options;
    
    assertNonBlankString(entityId, 'entityId', 'getAccessibleItems', this.#logger);
    
    // Check cache
    const cacheKey = this.#generateCacheKey(entityId, options);
    const cached = this.#getCachedResult(cacheKey);
    if (cached) return cached;
    
    // Get equipment state
    const equipment = this.#getEquipmentState(entityId);
    const equippedItems = this.#parseEquipmentSlots(equipment);
    
    if (equippedItems.length === 0) {
      return this.#cacheAndReturn(cacheKey, []);
    }
    
    // Filter by layer if specified
    let filteredItems = layer 
      ? equippedItems.filter(item => item.layer === layer)
      : equippedItems;
    
    // Filter by body area if specified
    if (bodyArea) {
      filteredItems = this.#filterByBodyArea(filteredItems, bodyArea);
    }
    
    // Apply coverage blocking
    const accessibleItems = this.#applyCoverageBlocking(
      filteredItems, 
      entityId, 
      equipment, 
      mode
    );
    
    // Apply mode-specific logic
    let result = this.#applyModeLogic(accessibleItems, mode);
    
    // Sort by priority if requested
    if (sortByPriority) {
      result = this.#sortByPriority(result, context);
    }
    
    return this.#cacheAndReturn(cacheKey, result.map(item => item.itemId));
  }

  /**
   * Check if a specific item is accessible on an entity
   * 
   * @param {string} entityId - Entity to check
   * @param {string} itemId - Item to check accessibility for
   * @returns {object} Accessibility information with accessible flag and reason
   * @example
   * const result = service.isItemAccessible('entity-123', 'item-456');
   * // Returns: { accessible: true, reason: 'Item is accessible', blockingItems: [] }
   */
  isItemAccessible(entityId, itemId) {
    assertNonBlankString(entityId, 'entityId', 'isItemAccessible', this.#logger);
    assertNonBlankString(itemId, 'itemId', 'isItemAccessible', this.#logger);
    
    if (!this.#coverageAnalyzer) {
      return { 
        accessible: true, 
        reason: 'No coverage analyzer available',
        blockingItems: []
      };
    }
    
    const equipment = this.#getEquipmentState(entityId);
    
    try {
      const coverageAnalysis = this.#coverageAnalyzer.analyzeCoverageBlocking(
        equipment, 
        entityId
      );
      
      const accessible = coverageAnalysis.isAccessible(itemId);
      const blockingItems = coverageAnalysis.getBlockingItems(itemId);
      
      return {
        accessible,
        reason: accessible 
          ? 'Item is accessible' 
          : `Blocked by: ${blockingItems.join(', ')}`,
        blockingItems: blockingItems || []
      };
    } catch (error) {
      this.#logger.warn('Failed to check accessibility', { 
        entityId, 
        itemId, 
        error: error.message 
      });
      return { 
        accessible: true, 
        reason: 'Coverage check failed, assuming accessible',
        blockingItems: []
      };
    }
  }

  /**
   * Get the item that is blocking access to another item
   * 
   * @param {string} entityId - Entity to check
   * @param {string} itemId - Item that may be blocked
   * @returns {string|null} ID of blocking item, or null if not blocked
   * @example
   * const blockingItem = service.getBlockingItem('entity-123', 'item-456');
   * // Returns: 'clothing:jacket' or null
   */
  getBlockingItem(entityId, itemId) {
    assertNonBlankString(entityId, 'entityId', 'getBlockingItem', this.#logger);
    assertNonBlankString(itemId, 'itemId', 'getBlockingItem', this.#logger);
    
    const result = this.isItemAccessible(entityId, itemId);
    
    if (result.accessible) {
      return null;
    }
    
    // Return first blocking item
    return result.blockingItems && result.blockingItems.length > 0 
      ? result.blockingItems[0] 
      : null;
  }

  /**
   * Clear the cache for a specific entity
   * 
   * @param {string} entityId - Entity ID to clear cache for
   * @example
   * service.clearCache('entity-123');
   */
  clearCache(entityId) {
    assertNonBlankString(entityId, 'entityId', 'clearCache', this.#logger);
    
    // Clear query cache
    const keysToDelete = [];
    for (const key of this.#cache.keys()) {
      if (key.includes(entityId)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.#cache.delete(key);
    }
    
    // Clear priority cache for entity's items
    if (this.#priorityCache) {
      const equipment = this.#getEquipmentState(entityId);
      const items = this.#parseEquipmentSlots(equipment);
      for (const item of items) {
        for (const key of this.#priorityCache.keys()) {
          if (key.startsWith(`${item.itemId}:`)) {
            this.#priorityCache.delete(key);
          }
        }
      }
    }
    
    this.#logger.debug('ClothingAccessibilityService: Cache cleared for entity', {
      entityId,
      entriesCleared: keysToDelete.length
    });
  }

  /**
   * Clear all cache entries (useful for testing)
   * 
   * @private
   */
  clearAllCache() {
    this.#cache.clear();
  }
}

export default ClothingAccessibilityService;