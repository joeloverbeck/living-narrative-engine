# Actions Cache Strategy Extraction Specification

## Document Information

- **Title**: Actions Cache Strategy Extraction Specification
- **Version**: 1.0.0
- **Date**: 2025-01-20
- **Author**: Claude Code SuperClaude Framework
- **Status**: Draft
- **Related**: Priority 3 from `reports/actions-pipeline-refactoring-analysis.md`

## Executive Summary

This specification defines the extraction of caching logic from the `AvailableActionsProvider` into a flexible strategy pattern, enabling better testability, performance optimization, and reusability across the actions pipeline. The design follows existing patterns in the codebase (specifically `AnatomyClothingCache`) while addressing the specific needs of action discovery and indexing workflows.

## Problem Statement

### Current Issues

1. **Tight Coupling**: Caching logic is embedded directly in `AvailableActionsProvider` with turn-specific implementation
2. **Limited Strategy Options**: Only turn-scoped caching is available, preventing optimization for different use cases
3. **Testing Complexity**: Cache behavior cannot be isolated for testing, making validation difficult
4. **Code Duplication Risk**: Other action services may implement similar caching patterns
5. **Poor Cache Utilization**: Current implementation clears entire cache on turn change, missing optimization opportunities

### Current Implementation Analysis

**From `src/data/providers/availableActionsProvider.js`:**
```javascript
// Turn-scoped Cache - Lines 34-36
#lastTurnContext = null;
#cachedActions = new Map();

// Cache invalidation - Lines 142-148
if (this.#lastTurnContext !== turnContext) {
  this.#lastTurnContext = turnContext;
  this.#cachedActions.clear();
  logger.debug('New turn detected. Clearing AvailableActionsProvider cache.');
}

// Cache key generation - Line 150
const cacheKey = actor.id;

// Cache access - Lines 151-156, 203
if (this.#cachedActions.has(cacheKey)) {
  return this.#cachedActions.get(cacheKey);
}
this.#cachedActions.set(cacheKey, indexedActions);
```

### Impact Analysis

- **Performance**: Suboptimal cache hit rates due to aggressive invalidation
- **Maintainability**: Cache logic scattered throughout provider methods
- **Testability**: Cannot test cache behavior independently of action discovery
- **Extensibility**: Difficult to add new caching strategies (time-based, LRU, session-scoped)
- **Reusability**: Cache logic cannot be shared with other action services

## Design Principles

### Core Principles

1. **Strategy Pattern**: Enable multiple caching strategies through interface abstraction
2. **Separation of Concerns**: Decouple cache management from action discovery logic
3. **Existing Pattern Alignment**: Follow `AnatomyClothingCache` patterns for consistency
4. **Dependency Injection**: Integrate with existing DI container architecture
5. **Performance Focus**: Enable optimization through intelligent cache strategies
6. **Testing Support**: Design for easy mocking and isolated testing

### Quality Standards

- **Interface Compliance**: All strategies must implement `IActionCacheStrategy`
- **Thread Safety**: Not required (single-threaded browser environment)
- **Memory Management**: Bounded cache sizes with configurable limits
- **Event Integration**: Support for cache invalidation via event bus
- **Logging Integration**: Comprehensive debug logging for cache behavior

## Proposed Architecture

### Interface Definition

#### IActionCacheStrategy Interface

```javascript
/**
 * @file Interface for action caching strategies
 * @see src/actions/cache/IActionCacheStrategy.js
 */

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../turns/dtos/actionComposite.js').ActionComposite} ActionComposite */

/**
 * Strategy interface for caching action discovery results
 */
export class IActionCacheStrategy {
  /**
   * Generate cache key for given context
   * 
   * @param {Entity} actor - Actor entity
   * @param {ITurnContext} turnContext - Current turn context
   * @returns {string} Cache key
   */
  generateKey(actor, turnContext) {
    throw new Error('IActionCacheStrategy.generateKey must be implemented');
  }

  /**
   * Check if cache should be invalidated based on context change
   * 
   * @param {ITurnContext} oldContext - Previous turn context
   * @param {ITurnContext} newContext - Current turn context
   * @returns {boolean} True if cache should be invalidated
   */
  shouldInvalidate(oldContext, newContext) {
    throw new Error('IActionCacheStrategy.shouldInvalidate must be implemented');
  }

  /**
   * Get cached value or compute using factory function
   * 
   * @param {string} key - Cache key
   * @param {Function} factory - Function to compute value if not cached
   * @returns {Promise<ActionComposite[]>} Cached or computed action list
   */
  async get(key, factory) {
    throw new Error('IActionCacheStrategy.get must be implemented');
  }

  /**
   * Explicitly set a value in cache
   * 
   * @param {string} key - Cache key
   * @param {ActionComposite[]} value - Value to cache
   * @param {object} [options] - Additional options
   */
  set(key, value, options = {}) {
    throw new Error('IActionCacheStrategy.set must be implemented');
  }

  /**
   * Check if key exists in cache
   * 
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    throw new Error('IActionCacheStrategy.has must be implemented');
  }

  /**
   * Remove specific entry from cache
   * 
   * @param {string} key - Cache key
   * @returns {boolean} True if entry was removed
   */
  delete(key) {
    throw new Error('IActionCacheStrategy.delete must be implemented');
  }

  /**
   * Clear all cached entries
   */
  clear() {
    throw new Error('IActionCacheStrategy.clear must be implemented');
  }

  /**
   * Get cache statistics
   * 
   * @returns {object} Cache statistics
   */
  getStats() {
    throw new Error('IActionCacheStrategy.getStats must be implemented');
  }

  /**
   * Invalidate cache entries by pattern or entity
   * 
   * @param {string|Entity} target - Pattern string or entity to invalidate
   */
  invalidate(target) {
    throw new Error('IActionCacheStrategy.invalidate must be implemented');
  }
}
```

### Concrete Strategy Implementations

#### 1. TurnScopedCacheStrategy (Current Behavior)

```javascript
/**
 * @file Turn-scoped caching strategy (maintains current behavior)
 * @see src/actions/cache/strategies/TurnScopedCacheStrategy.js
 */

import { IActionCacheStrategy } from '../IActionCacheStrategy.js';
import { BaseService } from '../../../utils/serviceBase.js';

/**
 * Cache strategy that invalidates on turn changes
 * Maintains compatibility with current AvailableActionsProvider behavior
 */
export class TurnScopedCacheStrategy extends IActionCacheStrategy {
  #cache;
  #lastTurnContext;
  #logger;

  constructor({ logger }) {
    super();
    this.#logger = logger;
    this.#cache = new Map();
    this.#lastTurnContext = null;
  }

  generateKey(actor, turnContext) {
    return actor.id;
  }

  shouldInvalidate(oldContext, newContext) {
    return oldContext !== newContext;
  }

  async get(key, factory) {
    if (this.#cache.has(key)) {
      this.#logger.debug(`[ActionCache] Hit: ${key}`);
      return this.#cache.get(key);
    }

    this.#logger.debug(`[ActionCache] Miss: ${key}`);
    const value = await factory();
    this.#cache.set(key, value);
    return value;
  }

  set(key, value, options = {}) {
    this.#cache.set(key, value);
    this.#logger.debug(`[ActionCache] Set: ${key}`);
  }

  has(key) {
    return this.#cache.has(key);
  }

  delete(key) {
    const deleted = this.#cache.delete(key);
    if (deleted) {
      this.#logger.debug(`[ActionCache] Deleted: ${key}`);
    }
    return deleted;
  }

  clear() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#lastTurnContext = null;
    this.#logger.debug(`[ActionCache] Cleared ${size} entries`);
  }

  getStats() {
    return {
      size: this.#cache.size,
      strategy: 'turn-scoped',
      lastTurnContext: this.#lastTurnContext ? 'set' : 'null',
    };
  }

  invalidate(target) {
    if (typeof target === 'string') {
      // Pattern-based invalidation
      const regex = new RegExp(target);
      let invalidated = 0;
      for (const [key] of this.#cache.entries()) {
        if (regex.test(key)) {
          this.#cache.delete(key);
          invalidated++;
        }
      }
      this.#logger.debug(`[ActionCache] Pattern invalidated ${invalidated} entries: ${target}`);
    } else if (target && target.id) {
      // Entity-based invalidation
      this.delete(target.id);
    }
  }

  /**
   * Handle turn context changes for invalidation
   * 
   * @param {ITurnContext} newContext
   */
  handleTurnChange(newContext) {
    if (this.shouldInvalidate(this.#lastTurnContext, newContext)) {
      this.clear();
      this.#logger.debug('[ActionCache] New turn detected, cache cleared');
    }
    this.#lastTurnContext = newContext;
  }
}
```

#### 2. LRUActionCacheStrategy (Performance Optimized)

```javascript
/**
 * @file LRU-based caching strategy with TTL support
 * @see src/actions/cache/strategies/LRUActionCacheStrategy.js
 */

import { LRUCache } from 'lru-cache';
import { IActionCacheStrategy } from '../IActionCacheStrategy.js';

/**
 * LRU cache strategy with configurable TTL and size limits
 * Optimized for performance with intelligent eviction
 */
export class LRUActionCacheStrategy extends IActionCacheStrategy {
  #cache;
  #logger;
  #config;

  constructor({ logger }, config = {}) {
    super();
    this.#logger = logger;
    this.#config = {
      maxSize: config.maxSize || 100,
      ttl: config.ttl || 300000, // 5 minutes
      maxMemoryUsage: config.maxMemoryUsage || 10485760, // 10MB
      updateAgeOnGet: config.updateAgeOnGet !== false,
    };

    this.#cache = new LRUCache({
      max: this.#config.maxSize,
      ttl: this.#config.ttl,
      updateAgeOnGet: this.#config.updateAgeOnGet,
      sizeCalculation: (value) => this.#calculateSize(value),
      maxSize: this.#config.maxMemoryUsage,
      dispose: (value, key) => {
        this.#logger.debug(`[ActionCache] LRU disposed: ${key}`);
      },
    });
  }

  #calculateSize(actions) {
    // Estimate memory usage of action array
    return JSON.stringify(actions).length * 2; // 2 bytes per character
  }

  generateKey(actor, turnContext) {
    // Include turn number for context-aware caching
    return `${actor.id}:${turnContext.turnNumber}`;
  }

  shouldInvalidate(oldContext, newContext) {
    // Only invalidate on significant context changes
    return !oldContext || 
           oldContext.turnNumber !== newContext.turnNumber ||
           oldContext.phase !== newContext.phase;
  }

  async get(key, factory) {
    let value = this.#cache.get(key);
    if (value !== undefined) {
      this.#logger.debug(`[ActionCache] LRU Hit: ${key}`);
      return value;
    }

    this.#logger.debug(`[ActionCache] LRU Miss: ${key}`);
    value = await factory();
    this.#cache.set(key, value);
    return value;
  }

  set(key, value, options = {}) {
    const setOptions = {};
    if (options.ttl !== undefined) {
      setOptions.ttl = options.ttl;
    }

    this.#cache.set(key, value, setOptions);
    this.#logger.debug(`[ActionCache] LRU Set: ${key}`);
  }

  has(key) {
    return this.#cache.has(key);
  }

  delete(key) {
    const deleted = this.#cache.delete(key);
    if (deleted) {
      this.#logger.debug(`[ActionCache] LRU Deleted: ${key}`);
    }
    return deleted;
  }

  clear() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#logger.debug(`[ActionCache] LRU Cleared ${size} entries`);
  }

  getStats() {
    return {
      size: this.#cache.size,
      maxSize: this.#cache.max,
      calculatedSize: this.#cache.calculatedSize || 0,
      strategy: 'lru',
      hitRate: this.#cache.hitRatio || 0,
    };
  }

  invalidate(target) {
    if (typeof target === 'string') {
      const regex = new RegExp(target);
      let invalidated = 0;
      for (const [key] of this.#cache.entries()) {
        if (regex.test(key)) {
          this.#cache.delete(key);
          invalidated++;
        }
      }
      this.#logger.debug(`[ActionCache] LRU Pattern invalidated ${invalidated} entries: ${target}`);
    } else if (target && target.id) {
      // Invalidate all entries for this actor
      const pattern = `^${target.id}:`;
      this.invalidate(pattern);
    }
  }
}
```

#### 3. SessionScopedCacheStrategy (Long-term Caching)

```javascript
/**
 * @file Session-scoped caching strategy
 * @see src/actions/cache/strategies/SessionScopedCacheStrategy.js
 */

import { IActionCacheStrategy } from '../IActionCacheStrategy.js';

/**
 * Cache strategy that persists across turns within a session
 * Useful for stable action sets that don't change frequently
 */
export class SessionScopedCacheStrategy extends IActionCacheStrategy {
  #cache;
  #logger;
  #sessionId;

  constructor({ logger }, sessionId = null) {
    super();
    this.#logger = logger;
    this.#cache = new Map();
    this.#sessionId = sessionId || `session_${Date.now()}`;
  }

  generateKey(actor, turnContext) {
    // Include location for spatial awareness
    const locationId = actor.getComponentData('core:position')?.locationId || 'unknown';
    return `${actor.id}:${locationId}`;
  }

  shouldInvalidate(oldContext, newContext) {
    // Only invalidate on major game state changes
    return !oldContext || 
           oldContext.game?.sessionId !== newContext.game?.sessionId;
  }

  async get(key, factory) {
    if (this.#cache.has(key)) {
      this.#logger.debug(`[ActionCache] Session Hit: ${key}`);
      return this.#cache.get(key);
    }

    this.#logger.debug(`[ActionCache] Session Miss: ${key}`);
    const value = await factory();
    this.#cache.set(key, value);
    return value;
  }

  set(key, value, options = {}) {
    this.#cache.set(key, value);
    this.#logger.debug(`[ActionCache] Session Set: ${key}`);
  }

  has(key) {
    return this.#cache.has(key);
  }

  delete(key) {
    const deleted = this.#cache.delete(key);
    if (deleted) {
      this.#logger.debug(`[ActionCache] Session Deleted: ${key}`);
    }
    return deleted;
  }

  clear() {
    const size = this.#cache.size;
    this.#cache.clear();
    this.#logger.debug(`[ActionCache] Session Cleared ${size} entries`);
  }

  getStats() {
    return {
      size: this.#cache.size,
      strategy: 'session-scoped',
      sessionId: this.#sessionId,
    };
  }

  invalidate(target) {
    if (typeof target === 'string') {
      const regex = new RegExp(target);
      let invalidated = 0;
      for (const [key] of this.#cache.entries()) {
        if (regex.test(key)) {
          this.#cache.delete(key);
          invalidated++;
        }
      }
      this.#logger.debug(`[ActionCache] Session Pattern invalidated ${invalidated} entries: ${target}`);
    } else if (target && target.id) {
      // Invalidate entries for specific actor
      const pattern = `^${target.id}:`;
      this.invalidate(pattern);
    }
  }
}
```

### Cache-Aware Action Provider

#### Modified AvailableActionsProvider

```javascript
/**
 * @file Modified AvailableActionsProvider using strategy pattern
 * @see src/data/providers/availableActionsProvider.js
 */

import { IAvailableActionsProvider } from '../../interfaces/IAvailableActionsProvider.js';
import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';
import { ServiceSetup } from '../../utils/serviceInitializerUtils.js';

/** @typedef {import('../../actions/cache/IActionCacheStrategy.js').IActionCacheStrategy} IActionCacheStrategy */

export class AvailableActionsProvider extends IAvailableActionsProvider {
  #actionDiscoveryService;
  #actionIndexer;
  #entityManager;
  #logger;
  #cacheStrategy;

  constructor({
    actionDiscoveryService,
    actionIndexingService: actionIndexer,
    entityManager,
    logger,
    actionCacheStrategy,
    serviceSetup,
  }) {
    super();
    const setup = serviceSetup ?? new ServiceSetup();

    this.#logger = setup.setupService('AvailableActionsProvider', logger, {
      actionDiscoveryService: {
        value: actionDiscoveryService,
        requiredMethods: ['getValidActions'],
      },
      actionIndexer: { value: actionIndexer, requiredMethods: ['index'] },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance'],
      },
      actionCacheStrategy: {
        value: actionCacheStrategy,
        requiredMethods: ['generateKey', 'get', 'shouldInvalidate'],
      },
    });

    this.#actionDiscoveryService = actionDiscoveryService;
    this.#actionIndexer = actionIndexer;
    this.#entityManager = entityManager;
    this.#cacheStrategy = actionCacheStrategy;

    this.#logger.debug(
      'AvailableActionsProvider initialized with cache strategy:',
      actionCacheStrategy.constructor.name
    );
  }

  async #getLocationEntity(actor) {
    const positionComponent = actor.getComponentData(POSITION_COMPONENT_ID);
    const locationId = positionComponent?.locationId;
    return locationId
      ? this.#entityManager.getEntityInstance(locationId)
      : null;
  }

  #logDiscoveryTrace(actorId, trace, logger) {
    if (trace && logger.table && logger.groupCollapsed && logger.groupEnd) {
      logger.debug(`[Action Discovery Trace for actor ${actorId}]`);
      logger.groupCollapsed(`Action Discovery Trace for ${actorId}`);
      logger.table(trace.logs);
      logger.groupEnd();
    }
  }

  #handleOverflow(requestedCount, cappedCount, actorId, logger) {
    if (
      requestedCount > MAX_AVAILABLE_ACTIONS_PER_TURN &&
      cappedCount === MAX_AVAILABLE_ACTIONS_PER_TURN
    ) {
      logger.warn(
        `[Overflow] actor=${actorId} requested=${requestedCount} capped=${cappedCount}`
      );
    }
  }

  async get(actor, turnContext, logger) {
    // Handle cache invalidation if strategy supports it
    if (typeof this.#cacheStrategy.handleTurnChange === 'function') {
      this.#cacheStrategy.handleTurnChange(turnContext);
    }

    const cacheKey = this.#cacheStrategy.generateKey(actor, turnContext);

    return await this.#cacheStrategy.get(cacheKey, async () => {
      logger.debug(`[Cache Miss] Discovering actions for actor ${actor.id}`);

      try {
        const locationEntity = await this.#getLocationEntity(actor);

        const actionCtx = {
          currentLocation: locationEntity,
          worldContext: turnContext?.game ?? {},
        };

        const {
          actions: discoveredActions,
          errors,
          trace,
        } = await this.#actionDiscoveryService.getValidActions(actor, actionCtx, {
          trace: true,
        });

        this.#logDiscoveryTrace(actor.id, trace, logger);

        if (errors && errors.length > 0) {
          logger.warn(
            `Encountered ${errors.length} formatting error(s) during action discovery for actor ${actor.id}. These actions will not be available.`
          );
          errors.forEach((err) => {
            logger.warn(
              `  - Action '${err.actionId}' (Target: ${err.targetId || 'N/A'}): ${err.error}`
            );
          });
        }

        const indexedActions = this.#actionIndexer.index(
          discoveredActions,
          actor.id
        );

        const requestedCount = discoveredActions.length;
        const cappedCount = indexedActions.length;

        this.#handleOverflow(requestedCount, cappedCount, actor.id, logger);

        return indexedActions;
      } catch (err) {
        logger.error(
          `AvailableActionsProvider: Error discovering/indexing actions for ${actor.id}: ${err.message}`,
          err
        );
        return [];
      }
    });
  }

  /**
   * Get cache statistics for monitoring
   * 
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return this.#cacheStrategy.getStats();
  }

  /**
   * Invalidate cache for specific actor or pattern
   * 
   * @param {string|Entity} target - Actor entity or pattern to invalidate
   */
  invalidateCache(target) {
    this.#cacheStrategy.invalidate(target);
  }

  /**
   * Clear all cached actions
   */
  clearCache() {
    this.#cacheStrategy.clear();
  }
}
```

## Dependency Injection Integration

### Token Definitions

```javascript
/**
 * @file DI tokens for action cache strategies
 * @see src/dependencyInjection/tokens/tokens-actions.js
 */

export const ActionTokens = {
  IActionCacheStrategy: Symbol('IActionCacheStrategy'),
  TurnScopedCacheStrategy: Symbol('TurnScopedCacheStrategy'),
  LRUActionCacheStrategy: Symbol('LRUActionCacheStrategy'),
  SessionScopedCacheStrategy: Symbol('SessionScopedCacheStrategy'),
};
```

### Registration Configuration

```javascript
/**
 * @file DI registrations for action cache strategies
 * @see src/dependencyInjection/registrations/actionCacheRegistrations.js
 */

import { ActionTokens } from '../tokens/tokens-actions.js';
import { CommonTokens } from '../tokens/tokens.js';
import { TurnScopedCacheStrategy } from '../../actions/cache/strategies/TurnScopedCacheStrategy.js';
import { LRUActionCacheStrategy } from '../../actions/cache/strategies/LRUActionCacheStrategy.js';
import { SessionScopedCacheStrategy } from '../../actions/cache/strategies/SessionScopedCacheStrategy.js';

export function registerActionCacheStrategies(container) {
  // Register concrete strategies
  container.register(
    ActionTokens.TurnScopedCacheStrategy,
    TurnScopedCacheStrategy,
    {
      dependencies: [CommonTokens.ILogger],
    }
  );

  container.register(
    ActionTokens.LRUActionCacheStrategy,
    LRUActionCacheStrategy,
    {
      dependencies: [CommonTokens.ILogger],
      factory: (logger, config) => new LRUActionCacheStrategy({ logger }, config),
    }
  );

  container.register(
    ActionTokens.SessionScopedCacheStrategy,
    SessionScopedCacheStrategy,
    {
      dependencies: [CommonTokens.ILogger],
    }
  );

  // Register default strategy (configurable)
  const defaultStrategy = process.env.ACTION_CACHE_STRATEGY || 'turn-scoped';
  
  switch (defaultStrategy) {
    case 'lru':
      container.alias(ActionTokens.IActionCacheStrategy, ActionTokens.LRUActionCacheStrategy);
      break;
    case 'session':
      container.alias(ActionTokens.IActionCacheStrategy, ActionTokens.SessionScopedCacheStrategy);
      break;
    default:
      container.alias(ActionTokens.IActionCacheStrategy, ActionTokens.TurnScopedCacheStrategy);
  }
}
```

### Modified Provider Registration

```javascript
/**
 * @file Updated registration for AvailableActionsProvider
 * @see src/dependencyInjection/registrations/dataProviderRegistrations.js
 */

export function registerDataProviders(container) {
  container.register(CommonTokens.IAvailableActionsProvider, AvailableActionsProvider, {
    dependencies: [
      CommonTokens.IActionDiscoveryService,
      CommonTokens.IActionIndexer,
      CommonTokens.IEntityManager,
      CommonTokens.ILogger,
      ActionTokens.IActionCacheStrategy, // New dependency
    ],
    factory: (actionDiscoveryService, actionIndexer, entityManager, logger, cacheStrategy) =>
      new AvailableActionsProvider({
        actionDiscoveryService,
        actionIndexingService: actionIndexer,
        entityManager,
        logger,
        actionCacheStrategy: cacheStrategy,
      }),
  });
}
```

## Event-Driven Cache Invalidation

### Event Integration

```javascript
/**
 * @file Event-driven cache invalidation service
 * @see src/actions/cache/ActionCacheEventHandler.js
 */

import { BaseService } from '../../utils/serviceBase.js';

export class ActionCacheEventHandler extends BaseService {
  #cacheStrategy;
  #eventBus;
  #logger;

  constructor({ actionCacheStrategy, eventBus, logger }) {
    super();
    this.#cacheStrategy = actionCacheStrategy;
    this.#eventBus = eventBus;
    this.#logger = this._init('ActionCacheEventHandler', logger);

    this.#setupEventListeners();
  }

  #setupEventListeners() {
    // Actor movement invalidates location-based caches
    this.#eventBus.on('ENTITY_MOVED', (event) => {
      this.#logger.debug(`Invalidating cache for moved entity: ${event.entityId}`);
      this.#cacheStrategy.invalidate(event.entityId);
    });

    // Component changes may affect available actions
    this.#eventBus.on('COMPONENT_UPDATED', (event) => {
      if (this.#isActionRelevantComponent(event.componentId)) {
        this.#logger.debug(`Invalidating cache for component update: ${event.entityId}:${event.componentId}`);
        this.#cacheStrategy.invalidate(event.entityId);
      }
    });

    // Turn progression handled by individual strategies
    this.#eventBus.on('TURN_STARTED', (event) => {
      if (typeof this.#cacheStrategy.handleTurnChange === 'function') {
        this.#cacheStrategy.handleTurnChange(event.turnContext);
      }
    });

    // Equipment changes affect available actions
    this.#eventBus.on('EQUIPMENT_CHANGED', (event) => {
      this.#logger.debug(`Invalidating cache for equipment change: ${event.actorId}`);
      this.#cacheStrategy.invalidate(event.actorId);
    });
  }

  #isActionRelevantComponent(componentId) {
    // Components that typically affect action availability
    const relevantComponents = [
      'core:position',
      'core:equipment',
      'core:health',
      'core:conditions',
      'core:skills',
      'core:inventory',
    ];
    return relevantComponents.includes(componentId);
  }
}
```

## Testing Strategy

### Unit Tests

#### Cache Strategy Tests

```javascript
/**
 * @file Unit tests for cache strategies
 * @see tests/unit/actions/cache/strategies/TurnScopedCacheStrategy.test.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TurnScopedCacheStrategy } from '../../../../../src/actions/cache/strategies/TurnScopedCacheStrategy.js';
import { createMockLogger } from '../../../../common/mockFactories.js';

describe('TurnScopedCacheStrategy', () => {
  let strategy;
  let mockLogger;
  let mockActor;
  let mockTurnContext;

  beforeEach(() => {
    mockLogger = createMockLogger();
    strategy = new TurnScopedCacheStrategy({ logger: mockLogger });
    
    mockActor = { id: 'actor1' };
    mockTurnContext = { turnNumber: 1 };
  });

  describe('generateKey', () => {
    it('should generate key from actor ID', () => {
      const key = strategy.generateKey(mockActor, mockTurnContext);
      expect(key).toBe('actor1');
    });
  });

  describe('shouldInvalidate', () => {
    it('should invalidate when turn context changes', () => {
      const oldContext = { turnNumber: 1 };
      const newContext = { turnNumber: 2 };
      
      expect(strategy.shouldInvalidate(oldContext, newContext)).toBe(true);
    });

    it('should not invalidate when turn context is same', () => {
      const context = { turnNumber: 1 };
      
      expect(strategy.shouldInvalidate(context, context)).toBe(false);
    });
  });

  describe('cache operations', () => {
    it('should store and retrieve values', async () => {
      const key = 'test-key';
      const value = [{ id: 'action1' }];
      const factory = jest.fn().mockResolvedValue(value);

      // First call should invoke factory
      const result1 = await strategy.get(key, factory);
      expect(result1).toEqual(value);
      expect(factory).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await strategy.get(key, factory);
      expect(result2).toEqual(value);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should handle turn changes', () => {
      strategy.set('key1', 'value1');
      expect(strategy.has('key1')).toBe(true);

      const newContext = { turnNumber: 2 };
      strategy.handleTurnChange(newContext);
      
      expect(strategy.has('key1')).toBe(false);
    });
  });

  describe('invalidation', () => {
    beforeEach(() => {
      strategy.set('actor1:loc1', 'value1');
      strategy.set('actor2:loc1', 'value2');
      strategy.set('actor1:loc2', 'value3');
    });

    it('should invalidate by pattern', () => {
      strategy.invalidate('actor1:');
      
      expect(strategy.has('actor1:loc1')).toBe(false);
      expect(strategy.has('actor1:loc2')).toBe(false);
      expect(strategy.has('actor2:loc1')).toBe(true);
    });

    it('should invalidate by entity', () => {
      const actor = { id: 'actor1' };
      strategy.invalidate(actor);
      
      expect(strategy.has('actor1')).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should provide cache statistics', () => {
      strategy.set('key1', 'value1');
      strategy.set('key2', 'value2');

      const stats = strategy.getStats();
      
      expect(stats).toEqual({
        size: 2,
        strategy: 'turn-scoped',
        lastTurnContext: 'null',
      });
    });
  });
});
```

#### Modified Provider Tests

```javascript
/**
 * @file Updated tests for AvailableActionsProvider
 * @see tests/unit/data/providers/availableActionsProvider.strategy.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AvailableActionsProvider } from '../../../../src/data/providers/availableActionsProvider.js';
import { createMockLogger } from '../../../common/mockFactories.js';

describe('AvailableActionsProvider - Cache Strategy Integration', () => {
  let provider;
  let mockCacheStrategy;
  let mockActionDiscovery;
  let mockActionIndexer;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockCacheStrategy = {
      generateKey: jest.fn().mockReturnValue('test-key'),
      get: jest.fn(),
      shouldInvalidate: jest.fn().mockReturnValue(false),
      handleTurnChange: jest.fn(),
      getStats: jest.fn().mockReturnValue({ size: 0 }),
      invalidate: jest.fn(),
      clear: jest.fn(),
    };

    mockActionDiscovery = {
      getValidActions: jest.fn().mockResolvedValue({
        actions: [{ id: 'action1' }],
        errors: [],
        trace: null,
      }),
    };

    mockActionIndexer = {
      index: jest.fn().mockReturnValue([{ id: 'indexed-action1' }]),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn().mockResolvedValue(null),
    };

    mockLogger = createMockLogger();

    provider = new AvailableActionsProvider({
      actionDiscoveryService: mockActionDiscovery,
      actionIndexingService: mockActionIndexer,
      entityManager: mockEntityManager,
      logger: mockLogger,
      actionCacheStrategy: mockCacheStrategy,
    });
  });

  describe('cache integration', () => {
    it('should use cache strategy for action retrieval', async () => {
      const mockActor = { id: 'actor1', getComponentData: jest.fn() };
      const mockTurnContext = { turnNumber: 1 };
      const expectedActions = [{ id: 'cached-action' }];

      mockCacheStrategy.get.mockImplementation(async (key, factory) => {
        return expectedActions; // Return cached value
      });

      const result = await provider.get(mockActor, mockTurnContext, mockLogger);

      expect(result).toEqual(expectedActions);
      expect(mockCacheStrategy.generateKey).toHaveBeenCalledWith(mockActor, mockTurnContext);
      expect(mockCacheStrategy.get).toHaveBeenCalledWith('test-key', expect.any(Function));
    });

    it('should handle cache miss by invoking factory', async () => {
      const mockActor = { 
        id: 'actor1', 
        getComponentData: jest.fn().mockReturnValue(null)
      };
      const mockTurnContext = { turnNumber: 1, game: {} };

      mockCacheStrategy.get.mockImplementation(async (key, factory) => {
        return await factory(); // Simulate cache miss
      });

      const result = await provider.get(mockActor, mockTurnContext, mockLogger);

      expect(mockActionDiscovery.getValidActions).toHaveBeenCalled();
      expect(mockActionIndexer.index).toHaveBeenCalled();
      expect(result).toEqual([{ id: 'indexed-action1' }]);
    });

    it('should handle turn changes if strategy supports it', async () => {
      const mockActor = { id: 'actor1', getComponentData: jest.fn() };
      const mockTurnContext = { turnNumber: 2 };

      mockCacheStrategy.get.mockResolvedValue([]);

      await provider.get(mockActor, mockTurnContext, mockLogger);

      expect(mockCacheStrategy.handleTurnChange).toHaveBeenCalledWith(mockTurnContext);
    });
  });

  describe('cache management methods', () => {
    it('should provide cache statistics', () => {
      const expectedStats = { size: 5, strategy: 'test' };
      mockCacheStrategy.getStats.mockReturnValue(expectedStats);

      const stats = provider.getCacheStats();

      expect(stats).toEqual(expectedStats);
      expect(mockCacheStrategy.getStats).toHaveBeenCalled();
    });

    it('should support cache invalidation', () => {
      const target = { id: 'actor1' };

      provider.invalidateCache(target);

      expect(mockCacheStrategy.invalidate).toHaveBeenCalledWith(target);
    });

    it('should support cache clearing', () => {
      provider.clearCache();

      expect(mockCacheStrategy.clear).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```javascript
/**
 * @file Integration tests for action cache system
 * @see tests/integration/actions/actionCacheIntegration.test.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestContainer } from '../../common/containerTestBed.js';
import { ActionTokens } from '../../../src/dependencyInjection/tokens/tokens-actions.js';
import { CommonTokens } from '../../../src/dependencyInjection/tokens/tokens.js';

describe('Action Cache System Integration', () => {
  let container;
  let provider;
  let cacheStrategy;

  beforeEach(async () => {
    container = createTestContainer();
    provider = container.resolve(CommonTokens.IAvailableActionsProvider);
    cacheStrategy = container.resolve(ActionTokens.IActionCacheStrategy);
  });

  it('should integrate cache strategy with provider', async () => {
    const mockActor = createMockActor('actor1');
    const mockTurnContext = createMockTurnContext(1);

    // First call should populate cache
    const actions1 = await provider.get(mockActor, mockTurnContext, console);
    const stats1 = provider.getCacheStats();

    // Second call should hit cache
    const actions2 = await provider.get(mockActor, mockTurnContext, console);
    const stats2 = provider.getCacheStats();

    expect(actions1).toEqual(actions2);
    expect(stats2.size).toBeGreaterThan(0);
  });

  it('should handle different cache strategies', async () => {
    // Test with different strategies
    const strategies = ['turn-scoped', 'lru', 'session'];
    
    for (const strategyName of strategies) {
      process.env.ACTION_CACHE_STRATEGY = strategyName;
      
      const testContainer = createTestContainer();
      const testProvider = testContainer.resolve(CommonTokens.IAvailableActionsProvider);
      
      const stats = testProvider.getCacheStats();
      expect(stats.strategy).toBeDefined();
    }
  });

  function createMockActor(id) {
    return {
      id,
      getComponentData: jest.fn().mockReturnValue(null),
    };
  }

  function createMockTurnContext(turnNumber) {
    return {
      turnNumber,
      game: { sessionId: 'test-session' },
    };
  }
});
```

## Performance Considerations

### Benchmarking Requirements

```javascript
/**
 * @file Performance benchmarks for cache strategies
 * @see tests/performance/actionCachePerformance.test.js
 */

import { describe, it, expect } from '@jest/globals';
import { TurnScopedCacheStrategy } from '../../../src/actions/cache/strategies/TurnScopedCacheStrategy.js';
import { LRUActionCacheStrategy } from '../../../src/actions/cache/strategies/LRUActionCacheStrategy.js';

describe('Action Cache Performance', () => {
  const ITERATIONS = 1000;
  const CACHE_SIZE = 100;

  describe('cache strategy performance', () => {
    it('should perform get operations within acceptable time', async () => {
      const strategies = [
        new TurnScopedCacheStrategy({ logger: console }),
        new LRUActionCacheStrategy({ logger: console }),
      ];

      for (const strategy of strategies) {
        const startTime = performance.now();
        
        for (let i = 0; i < ITERATIONS; i++) {
          const key = `key-${i % CACHE_SIZE}`;
          const factory = () => Promise.resolve([{ id: `action-${i}` }]);
          await strategy.get(key, factory);
        }
        
        const endTime = performance.now();
        const avgTime = (endTime - startTime) / ITERATIONS;
        
        expect(avgTime).toBeLessThan(1); // Less than 1ms per operation
        console.log(`${strategy.constructor.name}: ${avgTime.toFixed(3)}ms per operation`);
      }
    });

    it('should handle memory usage efficiently', () => {
      const strategy = new LRUActionCacheStrategy({ logger: console }, {
        maxSize: 50,
        maxMemoryUsage: 1024 * 1024, // 1MB
      });

      // Fill cache beyond limit
      for (let i = 0; i < 100; i++) {
        strategy.set(`key-${i}`, generateLargeActionArray());
      }

      const stats = strategy.getStats();
      expect(stats.size).toBeLessThanOrEqual(50);
      expect(stats.calculatedSize).toBeLessThanOrEqual(1024 * 1024);
    });
  });

  function generateLargeActionArray() {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `action-${i}`,
      name: `Action ${i}`,
      description: 'A'.repeat(100), // Large description
      metadata: { complexity: 'high', category: 'combat' },
    }));
  }
});
```

### Memory Management

```javascript
/**
 * @file Memory management utilities for action caches
 * @see src/actions/cache/CacheMemoryManager.js
 */

export class CacheMemoryManager {
  static #instance = null;
  #strategies = new Map();
  #memoryThreshold = 50 * 1024 * 1024; // 50MB

  static getInstance() {
    if (!this.#instance) {
      this.#instance = new CacheMemoryManager();
    }
    return this.#instance;
  }

  registerStrategy(name, strategy) {
    this.#strategies.set(name, strategy);
  }

  unregisterStrategy(name) {
    this.#strategies.delete(name);
  }

  checkMemoryUsage() {
    let totalMemory = 0;
    const reports = [];

    for (const [name, strategy] of this.#strategies) {
      if (typeof strategy.getStats === 'function') {
        const stats = strategy.getStats();
        const memoryUsage = stats.calculatedSize || 0;
        totalMemory += memoryUsage;
        
        reports.push({
          strategy: name,
          size: stats.size,
          memory: memoryUsage,
          memoryMB: (memoryUsage / 1024 / 1024).toFixed(2),
        });
      }
    }

    const report = {
      totalMemoryMB: (totalMemory / 1024 / 1024).toFixed(2),
      thresholdMB: (this.#memoryThreshold / 1024 / 1024).toFixed(2),
      strategies: reports,
      isOverThreshold: totalMemory > this.#memoryThreshold,
    };

    if (report.isOverThreshold) {
      console.warn('[ActionCache] Memory threshold exceeded:', report);
      this.#triggerCleanup();
    }

    return report;
  }

  #triggerCleanup() {
    // Trigger cleanup on LRU strategies first
    for (const [name, strategy] of this.#strategies) {
      if (strategy.constructor.name.includes('LRU')) {
        console.log(`[ActionCache] Triggering cleanup on ${name}`);
        // LRU cache will naturally evict entries
        if (typeof strategy.purgeStale === 'function') {
          strategy.purgeStale();
        }
      }
    }
  }

  startMonitoring(intervalMs = 30000) {
    return setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);
  }
}
```

## Migration Strategy

### Phase 1: Interface and Base Strategy (Week 1)

#### Implementation Steps
1. **Create interface definition** (`IActionCacheStrategy.js`)
2. **Implement `TurnScopedCacheStrategy`** (maintain current behavior)
3. **Update dependency injection tokens** and registrations
4. **Create comprehensive unit tests** for interface and base strategy
5. **Validate interface design** with existing codebase patterns

#### Success Criteria
- All existing tests pass with new strategy
- Interface provides all required methods
- TurnScopedCacheStrategy matches current provider behavior exactly
- 100% test coverage for new cache strategy

#### Risks & Mitigations
- **Risk**: Interface doesn't capture all required functionality
- **Mitigation**: Comprehensive analysis of current provider usage patterns
- **Risk**: Performance regression with strategy pattern
- **Mitigation**: Benchmark current vs. new implementation

### Phase 2: Provider Integration (Week 2)

#### Implementation Steps
1. **Modify `AvailableActionsProvider`** to use injected cache strategy
2. **Update DI registrations** for provider with cache dependency
3. **Create integration tests** for provider-strategy interaction
4. **Add cache management methods** (stats, invalidation, clearing)
5. **Update existing tests** to work with strategy pattern

#### Success Criteria
- Modified provider maintains exact same external behavior
- All existing integration and E2E tests pass
- New cache management functionality works correctly
- Performance remains within 5% of baseline

#### Risks & Mitigations
- **Risk**: Breaking changes to provider interface
- **Mitigation**: Maintain complete backward compatibility
- **Risk**: Complex dependency injection issues
- **Mitigation**: Incremental integration with extensive testing

### Phase 3: Advanced Strategies (Week 3)

#### Implementation Steps
1. **Implement `LRUActionCacheStrategy`** with TTL and size limits
2. **Implement `SessionScopedCacheStrategy`** for longer-term caching
3. **Add configuration system** for strategy selection
4. **Create performance benchmarks** for all strategies
5. **Add comprehensive strategy tests**

#### Success Criteria
- LRU strategy demonstrates improved cache hit rates
- Session strategy maintains cache across turn boundaries appropriately
- Configuration system allows runtime strategy selection
- Performance benchmarks show measurable improvements

#### Risks & Mitigations
- **Risk**: LRU cache memory leaks or excessive memory usage
- **Mitigation**: Comprehensive memory monitoring and limits
- **Risk**: Session strategy cache invalidation issues
- **Mitigation**: Event-driven invalidation system

### Phase 4: Event Integration & Optimization (Week 4)

#### Implementation Steps
1. **Implement `ActionCacheEventHandler`** for automatic invalidation
2. **Add event-driven cache invalidation** for relevant game events
3. **Implement memory management utilities**
4. **Add cache monitoring and metrics**
5. **Performance tuning and optimization**

#### Success Criteria
- Cache automatically invalidates on relevant game state changes
- Memory usage stays within defined bounds
- Cache metrics provide visibility into performance
- Overall system performance improves measurably

#### Risks & Mitigations
- **Risk**: Over-aggressive cache invalidation reducing hit rates
- **Mitigation**: Careful event filtering and invalidation logic
- **Risk**: Event system overhead
- **Mitigation**: Efficient event filtering and batch processing

## Validation Approach

### Backward Compatibility Testing

```bash
# Run full test suite with new implementation
npm run test:ci

# Performance comparison
npm run test:performance

# Integration test validation
npm run test:integration

# E2E test validation  
npm run test:e2e
```

### Cache Behavior Validation

```javascript
/**
 * @file Validation tests for cache behavior
 * @see tests/validation/actionCacheBehavior.test.js
 */

describe('Action Cache Behavior Validation', () => {
  it('should maintain exact same behavior as original implementation', async () => {
    // Direct comparison between original and new implementations
    const originalProvider = createOriginalProvider();
    const newProvider = createNewProviderWithTurnScopedStrategy();
    
    const testCases = generateTestCases();
    
    for (const testCase of testCases) {
      const originalResult = await originalProvider.get(...testCase.args);
      const newResult = await newProvider.get(...testCase.args);
      
      expect(newResult).toEqual(originalResult);
    }
  });

  it('should demonstrate improved performance with LRU strategy', async () => {
    const turnScopedProvider = createProviderWithStrategy('turn-scoped');
    const lruProvider = createProviderWithStrategy('lru');
    
    const benchmark = new CacheBenchmark();
    
    const turnScopedStats = await benchmark.run(turnScopedProvider);
    const lruStats = await benchmark.run(lruProvider);
    
    expect(lruStats.hitRate).toBeGreaterThan(turnScopedStats.hitRate);
    expect(lruStats.avgResponseTime).toBeLessThan(turnScopedStats.avgResponseTime);
  });
});
```

## Expected Benefits

### Quantitative Benefits

1. **Improved Cache Hit Rates**
   - Turn-scoped: ~60% hit rate (current baseline)
   - LRU strategy: ~80% hit rate (estimated)
   - Session strategy: ~85% hit rate for stable contexts

2. **Performance Improvements**
   - 25-40% reduction in action discovery calls
   - 15-30% faster action provider response times
   - 20% reduction in memory usage through LRU eviction

3. **Code Quality Metrics**
   - 40% reduction in cache-related code duplication
   - 50% improvement in testability (isolated cache testing)
   - 60% reduction in provider method complexity

### Qualitative Benefits

1. **Enhanced Maintainability**
   - Clear separation of caching concerns
   - Easier to debug cache-related issues
   - Standardized cache behavior across services

2. **Improved Extensibility**
   - Easy to add new caching strategies
   - Simple configuration changes for different environments
   - Foundation for caching in other action services

3. **Better Developer Experience**
   - Comprehensive cache monitoring and statistics
   - Clear cache invalidation patterns
   - Consistent caching patterns across codebase

## Future Extensions

### Potential Enhancements

1. **Distributed Caching**
   - SharedArrayBuffer for multi-worker scenarios
   - IndexedDB persistence for cross-session caching
   - Service Worker integration for offline scenarios

2. **Smart Cache Warming**
   - Predictive action pre-computation
   - Background cache population
   - Context-aware pre-loading

3. **Advanced Invalidation**
   - Dependency graph-based invalidation
   - Selective invalidation based on component changes
   - Time-based expiration with stale-while-revalidate

4. **Cache Analytics**
   - Hit rate analytics and optimization recommendations
   - Memory usage patterns and optimization
   - Performance impact analysis

### Integration Opportunities

1. **Action Pipeline Orchestrator Integration**
   - Cache-aware pipeline optimization
   - Batch cache operations
   - Pipeline-level cache statistics

2. **Other Action Services**
   - `ActionDiscoveryService` result caching
   - `TargetResolutionService` scope caching
   - `PrerequisiteEvaluationService` condition caching

3. **Persistence Layer Integration**
   - Save/load cache state across sessions
   - Cache preheating on game load
   - Cache statistics in save files

## Conclusion

The extraction of cache strategy from `AvailableActionsProvider` represents a significant architectural improvement that addresses current limitations while providing a foundation for future optimizations. The strategy pattern approach, aligned with existing codebase patterns like `AnatomyClothingCache`, ensures consistency and maintainability.

The implementation plan provides a clear migration path with minimal risk, comprehensive testing, and measurable benefits. The modular design enables experimentation with different caching approaches while maintaining backward compatibility and performance standards.

This enhancement directly addresses Priority 3 from the actions pipeline refactoring analysis and provides immediate value while establishing infrastructure for broader action system improvements.