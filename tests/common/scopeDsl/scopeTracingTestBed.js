/**
 * @file Scope Tracing Test Bed
 * @description Lightweight test infrastructure for scope tracing performance tests.
 * Provides minimal setup for scope resolution without the overhead of full action/rule loading.
 */

import { createMinimalTestContainer } from './minimalTestContainer.js';
import { ScopeEvaluationTracer } from '../mods/scopeEvaluationTracer.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../mods/scopeResolverHelpers.js';
import UnifiedScopeResolver from '../../../src/actions/scopes/unifiedScopeResolver.js';

/**
 * Lightweight test bed for scope tracing performance tests.
 * Provides minimal infrastructure for scope resolution without the overhead
 * of ModTestFixture.forAction() which loads full action/rule infrastructure.
 *
 * @class
 * @example
 * const testBed = await ScopeTracingTestBed.create();
 * await testBed.registerCustomScope('positioning', 'close_actors');
 * const scenario = testBed.createCloseActors(['Alice', 'Bob']);
 * testBed.enableScopeTracing();
 * testBed.testEnv.unifiedScopeResolver.resolveSync('positioning:close_actors', scenario.actor);
 * const trace = testBed.getScopeTraceData();
 */
export class ScopeTracingTestBed {
  /**
   * @private
   */
  #container;
  #services;
  #entityManager;
  #unifiedScopeResolver;
  #scopeTracer;
  #cleanup;

  /**
   * Creates a new ScopeTracingTestBed.
   * Use the static create() factory method instead.
   *
   * @private
   * @param {object} config - Configuration from create()
   */
  constructor(config) {
    this.#container = config.container;
    this.#services = config.services;
    this.#entityManager = config.entityManager;
    this.#unifiedScopeResolver = config.unifiedScopeResolver;
    this.#scopeTracer = config.scopeTracer;
    this.#cleanup = config.cleanup;
  }

  /**
   * Factory method to create a ScopeTracingTestBed.
   *
   * @param {object} [options] - Configuration options
   * @param {boolean} [options.enableTracing] - Enable tracing on creation
   * @returns {Promise<ScopeTracingTestBed>} Configured test bed
   */
  static async create(options = {}) {
    const { enableTracing = false } = options;

    // Create minimal container with core services
    const { container, services, cleanup } = await createMinimalTestContainer({
      enableTracing,
    });

    // Create scope tracer
    const scopeTracer = new ScopeEvaluationTracer();

    // Create minimal ActionErrorContextBuilder mock
    const actionErrorContextBuilder = {
      buildErrorContext: (action, error, context) => ({
        actionId: action?.id || 'unknown',
        error: error?.message || String(error),
        context,
      }),
    };

    // Create UnifiedScopeResolver with minimal dependencies
    const unifiedScopeResolver = new UnifiedScopeResolver({
      scopeRegistry: services.scopeRegistry,
      scopeEngine: services.scopeEngine,
      entityManager: services.entityManager,
      jsonLogicEvaluationService: services.jsonLogicEval,
      dslParser: services.dslParser,
      logger: services.logger,
      actionErrorContextBuilder,
      container,
    });

    return new ScopeTracingTestBed({
      container,
      services,
      entityManager: services.entityManager,
      unifiedScopeResolver,
      scopeTracer,
      cleanup,
    });
  }

  // ============================================================================
  // Test Environment Access
  // ============================================================================

  /**
   * Cached test environment instance.
   *
   * @private
   */
  #cachedTestEnv = null;

  /**
   * Get the test environment with key services.
   * Matches ModTestFixture.testEnv interface.
   * Cached to ensure ScopeResolverHelpers._registerResolvers can properly
   * store _originalResolveSync and _registeredResolvers on the same object.
   *
   * @returns {object} Test environment with entityManager, unifiedScopeResolver, and other services
   */
  get testEnv() {
    // Return cached instance if available
    if (this.#cachedTestEnv) {
      return this.#cachedTestEnv;
    }

    // Create a wrapper for unifiedScopeResolver that properly injects tracer
    const self = this;
    const wrappedResolver = {
      resolveSync: (scopeName, actorEntity, options = {}) => {
        // Build proper context with actor and tracer
        const context = {
          actor: actorEntity,
          actorLocation:
            actorEntity?.components?.['core:position']?.locationId || 'room1',
          tracer: self.#scopeTracer,
        };
        return self.#unifiedScopeResolver.resolveSync(
          scopeName,
          context,
          options
        );
      },
      resolve: (scopeName, actorEntity, options = {}) => {
        const context = {
          actor: actorEntity,
          actorLocation:
            actorEntity?.components?.['core:position']?.locationId || 'room1',
          tracer: self.#scopeTracer,
        };
        return self.#unifiedScopeResolver.resolve(scopeName, context, options);
      },
    };

    // Cache and return the test environment
    this.#cachedTestEnv = {
      entityManager: this.#entityManager,
      unifiedScopeResolver: wrappedResolver,
      dataRegistry: this.#services.dataRegistry,
      scopeRegistry: this.#services.scopeRegistry,
      logger: this.#services.logger,
      // Properties used by ScopeResolverHelpers.registerCustomScope
      _loadedConditions: this._loadedConditions || new Map(),
      // Expose tracer so _registerResolvers can inject it into context
      _scopeTracer: this.#scopeTracer,
    };

    return this.#cachedTestEnv;
  }

  /**
   * Internal storage for loaded conditions.
   *
   * @private
   */
  _loadedConditions = new Map();

  /**
   * Get the entity manager directly.
   *
   * @returns {object} Entity manager instance
   */
  get entityManager() {
    return this.#entityManager;
  }

  /**
   * Get the scope tracer.
   *
   * @returns {ScopeEvaluationTracer} Scope tracer instance
   */
  get scopeTracer() {
    return this.#scopeTracer;
  }

  // ============================================================================
  // Scope Registration
  // ============================================================================

  /**
   * Register a custom scope from a mod's scope file.
   *
   * @param {string} modId - The mod identifier
   * @param {string} scopeName - The scope name (without namespace)
   * @param {object} [options] - Additional options
   * @returns {Promise<void>}
   */
  async registerCustomScope(modId, scopeName, options = {}) {
    await ScopeResolverHelpers.registerCustomScope(
      this.testEnv,
      modId,
      scopeName,
      options
    );
  }

  // ============================================================================
  // Entity Creation
  // ============================================================================

  /**
   * Create close actors scenario (common for positioning and intimacy tests).
   * Creates actor and target with close proximity components.
   *
   * @param {Array<string>} [names] - Actor names (default: ['Alice', 'Bob'])
   * @param {object} [options] - Additional options
   * @returns {object} Object with actor and target entities
   */
  createCloseActors(names = ['Alice', 'Bob'], options = {}) {
    const scenario = ModEntityScenarios.createActorTargetPair({
      names,
      location: 'room1',
      closeProximity: true,
      ...options,
    });

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    const entities = [room, scenario.actor, scenario.target];

    // Reset entity manager with new entities
    this.reset(entities);

    return scenario;
  }

  /**
   * Create standard actor-target pair without close proximity.
   *
   * @param {Array<string>} [names] - Actor names
   * @param {object} [options] - Additional options
   * @returns {object} Object with actor and target entities
   */
  createStandardActorTarget(names = ['Alice', 'Bob'], options = {}) {
    const scenario = ModEntityScenarios.createActorTargetPair({
      names,
      location: 'room1',
      closeProximity: false,
      ...options,
    });

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    const entities = [room, scenario.actor, scenario.target];

    this.reset(entities);

    return scenario;
  }

  /**
   * Reset entity manager with provided entities.
   *
   * @param {Array<object>} entities - Entities to load
   */
  reset(entities) {
    // Clear existing entities
    for (const entityId of this.#entityManager.getEntityIds()) {
      if (this.#entityManager.deleteEntity) {
        this.#entityManager.deleteEntity(entityId);
      }
    }

    // Add new entities
    for (const entity of entities) {
      if (this.#entityManager.addEntity) {
        this.#entityManager.addEntity(entity);
      }
    }
  }

  // ============================================================================
  // Tracer Control
  // ============================================================================

  /**
   * Enable scope tracing.
   */
  enableScopeTracing() {
    this.#scopeTracer.enable();
  }

  /**
   * Disable scope tracing.
   */
  disableScopeTracing() {
    this.#scopeTracer.disable();
  }

  /**
   * Clear scope trace data.
   */
  clearScopeTrace() {
    this.#scopeTracer.clear();
  }

  /**
   * Get formatted scope trace output.
   *
   * @param {object} [options] - Formatting options
   * @returns {string} Formatted trace output
   */
  getScopeTrace(options = {}) {
    return this.#scopeTracer.format(options);
  }

  /**
   * Get raw scope trace data.
   *
   * @returns {object} Object with steps array and summary
   */
  getScopeTraceData() {
    return this.#scopeTracer.getTrace();
  }

  /**
   * Get scope performance metrics.
   *
   * @returns {object|null} Performance metrics or null if no data
   */
  getScopePerformanceMetrics() {
    return this.#scopeTracer.getPerformanceMetrics();
  }

  /**
   * Get formatted trace with performance focus.
   *
   * @returns {string} Performance-focused formatted trace
   */
  getScopeTraceWithPerformance() {
    return this.#scopeTracer.format({ performanceFocus: true });
  }

  /**
   * Resolve scope purely, without tracer injection.
   * Used for performance baselines to measure tracer overhead.
   * Handles custom scopes registered via ScopeResolverHelpers.
   *
   * @param {string} scopeName - Scope to resolve
   * @param {object} actorEntity - Actor entity
   * @returns {Set<string>} Resolved entity IDs
   */
  resolveSyncNoTracer(scopeName, actorEntity) {
    const env = this.testEnv;
    const originalTracer = env._scopeTracer;

    // Temporarily disable tracer to prevent injection in ScopeResolverHelpers
    env._scopeTracer = null;

    try {
      return env.unifiedScopeResolver.resolveSync(scopeName, actorEntity);
    } finally {
      env._scopeTracer = originalTracer;
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up test resources.
   */
  cleanup() {
    this.#scopeTracer.disable();
    this.#scopeTracer.clear();

    if (this.#cleanup) {
      this.#cleanup();
    }
  }
}

export default ScopeTracingTestBed;
