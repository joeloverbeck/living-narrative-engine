// src/dependencyInjection/registrations/infrastructureRegistrations.js

import EventBus from '../../events/eventBus.js';
import SpatialIndexManager from '../../entities/spatialIndexManager.js';
// import ModsLoader from '../../loaders/modsLoader.js';
// import PromptTextLoader from '../../loaders/promptTextLoader.js';
import { GameDataRepository } from '../../data/gameDataRepository.js'; // Concrete class
import ValidatedEventDispatcher from '../../events/validatedEventDispatcher.js'; // Concrete Class Import
import { SafeEventDispatcher } from '../../events/safeEventDispatcher.js';
import ModDependencyValidator from '../../modding/modDependencyValidator.js';
import validateModEngineVersions from '../../modding/modVersionValidator.js';
import * as ModLoadOrderResolver from '../../modding/modLoadOrderResolver.js';
import { tokens } from '../tokens.js';
import { actionTracingTokens } from '../tokens/actionTracingTokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import { ActionIndexingService } from '../../turns/services/actionIndexingService.js';
import ScopeRegistry from '../../scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../scopeDsl/engine.js';
import DefaultDslParser from '../../scopeDsl/parser/defaultDslParser.js';
import errorFactory from '../../scopeDsl/core/errorFactory.js';
import ScopeDslErrorHandler from '../../scopeDsl/core/scopeDslErrorHandler.js';
import { ServiceSetup } from '../../utils/serviceInitializerUtils.js';
import { EventDispatchService } from '../../utils/eventDispatchService.js';
import { ProductionPathConfiguration } from '../../configuration/productionPathConfiguration.js';
import { TraceConfigLoader } from '../../configuration/traceConfigLoader.js';
import CriticalLogNotifier from '../../logging/criticalLogNotifier.js';
import UnifiedCache from '../../cache/UnifiedCache.js';
import CacheInvalidationManager from '../../cache/CacheInvalidationManager.js';
import CacheMetrics from '../../cache/CacheMetrics.js';
import FacadeFactory from '../../shared/facades/FacadeFactory.js';
import FacadeRegistry from '../../shared/facades/FacadeRegistry.js';
import IClothingSystemFacade from '../../clothing/facades/IClothingSystemFacade.js';
import IAnatomySystemFacade from '../../anatomy/facades/IAnatomySystemFacade.js';
import { LightingStateService } from '../../locations/services/lightingStateService.js';
import { BrowserStorageProvider } from '../../storage/browserStorageProvider.js';
import PlaytimeTracker from '../../engine/playtimeTracker.js';
import SensoryCapabilityService from '../../perception/services/sensoryCapabilityService.js';
import PerceptionFilterService from '../../perception/services/perceptionFilterService.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../loaders/schemaLoader.js').default} SchemaLoader
 * @typedef {import('../../loaders/componentLoader.js').default} ComponentLoader
 * @typedef {import('../../loaders/ruleLoader.js').default} RuleLoader
 * @typedef {import('../../loaders/actionLoader.js').default} ActionLoader
 * @typedef {import('../../loaders/eventLoader.js').default} EventLoader
 * @typedef {import('../../loaders/macroLoader.js').default} MacroLoader
 * @typedef {import('../../loaders/entityDefinitionLoader.js').default} EntityLoader
 * @typedef {import('../../loaders/gameConfigLoader.js').default} GameConfigLoader
 * @typedef {import('../../loaders/promptTextLoader.js').default} PromptTextLoader
 * @typedef {import('../../modding/modManifestLoader.js').default} ModManifestLoader
 * @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository
 * @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 */

/**
 * Registers foundational infrastructure services.
 *
 * @param container
 */
export function registerInfrastructure(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  let log;

  try {
    log = container.resolve(tokens.ILogger);
    log.debug('Infrastructure Registration: starting…');
  } catch (error) {
    // ILogger not yet registered - use console fallback for debug messages
    console.debug(
      'Infrastructure Registration: starting… (ILogger not yet available)'
    );
    log = null;
  }

  // Helper function to safely log debug messages
  const safeDebug = (message) => {
    if (log) {
      log.debug(message);
    } else {
      console.debug(`[Infrastructure Registration] ${message}`);
    }
  };

  // Register ServiceSetup as a reusable utility
  registrar.instance(tokens.ServiceSetup, new ServiceSetup());
  safeDebug(`Registered ${String(tokens.ServiceSetup)}.`);

  // Register path configuration
  registrar.instance(
    tokens.IPathConfiguration,
    new ProductionPathConfiguration()
  );
  safeDebug(`Registered ${String(tokens.IPathConfiguration)}.`);

  // Register trace configuration loader
  container.register(
    tokens.ITraceConfigLoader,
    (c) =>
      new TraceConfigLoader({
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.ITraceConfigLoader)}.`);

  // ─── Shared ActionIndexingService ─────────────────────────────
  registrar.singletonFactory(
    tokens.ActionIndexingService,
    // ActionIndexingService needs { logger }
    (c) =>
      new ActionIndexingService({
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      })
  );
  safeDebug(`Registered ${String(tokens.ActionIndexingService)}.`);

  // Register EventBus with lazy logger resolution to handle missing ILogger
  container.register(
    tokens.EventBus,
    (c) => {
      const logger = c.resolve(tokens.ILogger);
      return new EventBus({ logger });
    },
    { lifecycle: 'singleton' }
  );
  container.register(tokens.IEventBus, (c) => c.resolve(tokens.EventBus), {
    lifecycle: 'singleton',
  });
  safeDebug(
    `Registered ${String(tokens.EventBus)} and ${String(tokens.IEventBus)}.`
  );

  container.register(
    tokens.ISpatialIndexManager,
    (c) => new SpatialIndexManager({ logger: c.resolve(tokens.ILogger) }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.ISpatialIndexManager)}.`);

  container.register(
    tokens.IGameDataRepository,
    (c) =>
      new GameDataRepository(
        /** @type {IDataRegistry} */ (c.resolve(tokens.IDataRegistry)),
        /** @type {ILogger} */ (c.resolve(tokens.ILogger))
      ),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.IGameDataRepository)}.`);

  // Some subsystems (notably GOAP) still resolve the concrete token while the
  // rest of the runtime relies on the interface to allow mocking in tests.
  // Bridge both tokens to the same singleton instance so newer registrations
  // (IGameDataRepository) and legacy ones (GameDataRepository) stay in sync.
  container.register(
    tokens.GameDataRepository,
    (c) => c.resolve(tokens.IGameDataRepository),
    { lifecycle: 'singleton' }
  );
  safeDebug(
    `Aliased ${String(tokens.GameDataRepository)} to ${String(
      tokens.IGameDataRepository
    )}.`
  );

  container.register(
    tokens.IValidatedEventDispatcher,
    (c) =>
      new ValidatedEventDispatcher({
        eventBus: c.resolve(tokens.EventBus),
        gameDataRepository: c.resolve(tokens.IGameDataRepository),
        schemaValidator: /** @type {ISchemaValidator} */ (
          c.resolve(tokens.ISchemaValidator)
        ),
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.IValidatedEventDispatcher)}.`);

  registrar.singletonFactory(
    tokens.ISafeEventDispatcher,
    (c) =>
      new SafeEventDispatcher({
        validatedEventDispatcher: /** @type {IValidatedEventDispatcher} */ (
          c.resolve(tokens.IValidatedEventDispatcher)
        ),
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      })
  );
  safeDebug(`Registered ${String(tokens.ISafeEventDispatcher)}.`);

  // Event Dispatch Service
  registrar.singletonFactory(tokens.EventDispatchService, (c) => {
    // Helper function to resolve optional dependencies
    const resolveOptional = (token) => {
      try {
        return c.isRegistered(token) ? c.resolve(token) : null;
      } catch {
        return null;
      }
    };

    return new EventDispatchService({
      safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (
        c.resolve(tokens.ISafeEventDispatcher)
      ),
      logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      actionTraceFilter: resolveOptional(
        actionTracingTokens.IActionTraceFilter
      ),
      eventDispatchTracer: resolveOptional(
        actionTracingTokens.IEventDispatchTracer
      ),
    });
  });
  safeDebug(`Registered ${String(tokens.EventDispatchService)}.`);

  // Scope DSL Engine - with scopeRegistry and errorHandler dependencies
  container.register(
    tokens.ScopeEngine,
    (c) =>
      new ScopeEngine({
        scopeRegistry: c.resolve(tokens.IScopeRegistry),
        errorHandler: c.resolve(tokens.IScopeDslErrorHandler),
      }),
    {
      lifecycle: 'singleton',
    }
  );
  safeDebug(`Registered ${String(tokens.ScopeEngine)}.`);

  // DSL Parser
  registrar.single(tokens.DslParser, DefaultDslParser);
  safeDebug(`Registered ${String(tokens.DslParser)}.`);

  // Register ScopeEngine as the IScopeEngine implementation
  container.register(
    tokens.IScopeEngine,
    (c) => c.resolve(tokens.ScopeEngine),
    {
      lifecycle: 'singleton',
    }
  );
  safeDebug(`Registered ${String(tokens.IScopeEngine)} -> ScopeEngine.`);

  // Scope DSL Error Factory (already an object, not a class)
  registrar.singletonFactory(tokens.IScopeDslErrorFactory, () => errorFactory);
  safeDebug(`Registered ${String(tokens.IScopeDslErrorFactory)}.`);

  // Scope DSL Error Handler with proper dependencies
  registrar.singletonFactory(
    tokens.IScopeDslErrorHandler,
    (c) =>
      new ScopeDslErrorHandler({
        logger: c.resolve(tokens.ILogger),
        errorFactory: c.resolve(tokens.IScopeDslErrorFactory),
        config: {
          isDevelopment:
            typeof globalThis.process !== 'undefined' &&
            globalThis.process.env?.NODE_ENV !== 'production',
          maxBufferSize: 100,
        },
      })
  );
  safeDebug(`Registered ${String(tokens.IScopeDslErrorHandler)}.`);

  // Critical Log Notifier for visual notifications
  container.register(
    tokens.ICriticalLogNotifier,
    (c) =>
      new CriticalLogNotifier({
        logger: c.resolve(tokens.ILogger),
        documentContext: c.resolve(tokens.IDocumentContext),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        config: {
          enableVisualNotifications: true,
          notificationPosition: 'top-right',
          maxRecentLogs: 20,
        },
      }),
    {
      lifecycle: 'singleton',
    }
  );
  safeDebug(`Registered ${String(tokens.ICriticalLogNotifier)}.`);

  // Register CriticalLogNotifier as the concrete implementation
  container.register(
    tokens.CriticalLogNotifier,
    (c) => c.resolve(tokens.ICriticalLogNotifier),
    {
      lifecycle: 'singleton',
    }
  );
  safeDebug(
    `Registered ${String(tokens.CriticalLogNotifier)} -> ICriticalLogNotifier.`
  );

  // ─── Unified Cache Infrastructure ─────────────────────────────

  // Register UnifiedCache as singleton
  container.register(
    tokens.IUnifiedCache,
    (c) =>
      new UnifiedCache(
        {
          logger: c.resolve(tokens.ILogger),
        },
        {
          maxSize: 1000,
          ttl: 300000, // 5 minutes
          enableMetrics: true,
          evictionPolicy: 'lru',
        }
      ),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.IUnifiedCache)}.`);

  // Register UnifiedCache as the concrete implementation
  container.register(
    tokens.UnifiedCache,
    (c) => c.resolve(tokens.IUnifiedCache),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.UnifiedCache)} -> IUnifiedCache.`);

  // Register CacheInvalidationManager
  container.register(
    tokens.ICacheInvalidationManager,
    (c) =>
      new CacheInvalidationManager({
        logger: c.resolve(tokens.ILogger),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.ICacheInvalidationManager)}.`);

  // Register CacheInvalidationManager as the concrete implementation
  container.register(
    tokens.CacheInvalidationManager,
    (c) => c.resolve(tokens.ICacheInvalidationManager),
    { lifecycle: 'singleton' }
  );
  safeDebug(
    `Registered ${String(tokens.CacheInvalidationManager)} -> ICacheInvalidationManager.`
  );

  // Register CacheMetrics
  container.register(
    tokens.ICacheMetrics,
    (c) =>
      new CacheMetrics({
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.ICacheMetrics)}.`);

  // Register CacheMetrics as the concrete implementation
  container.register(
    tokens.CacheMetrics,
    (c) => c.resolve(tokens.ICacheMetrics),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.CacheMetrics)} -> ICacheMetrics.`);

  // ─── Facade Infrastructure ─────────────────────────────

  // Register FacadeFactory
  container.register(
    tokens.IFacadeFactory,
    (c) =>
      new FacadeFactory({
        logger: c.resolve(tokens.ILogger),
        container: c,
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.IFacadeFactory)}.`);

  // Register FacadeFactory as the concrete implementation
  container.register(
    tokens.FacadeFactory,
    (c) => c.resolve(tokens.IFacadeFactory),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.FacadeFactory)} -> IFacadeFactory.`);

  // Register FacadeRegistry
  container.register(
    tokens.IFacadeRegistry,
    (c) =>
      new FacadeRegistry({
        logger: c.resolve(tokens.ILogger),
        eventBus: c.resolve(tokens.IEventBus),
        facadeFactory: c.resolve(tokens.IFacadeFactory),
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.IFacadeRegistry)}.`);

  // Register FacadeRegistry as the concrete implementation
  container.register(
    tokens.FacadeRegistry,
    (c) => c.resolve(tokens.IFacadeRegistry),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.FacadeRegistry)} -> IFacadeRegistry.`);

  // ─── System Facades ─────────────────────────────

  // Register ClothingSystemFacade
  container.register(
    tokens.IClothingSystemFacade,
    (c) =>
      new IClothingSystemFacade({
        clothingManagementService: c.resolve(tokens.ClothingManagementService),
        equipmentOrchestrator: c.resolve(tokens.EquipmentOrchestrator),
        layerCompatibilityService: c.resolve(tokens.LayerCompatibilityService),
        clothingSlotValidator: c.resolve(tokens.ClothingSlotValidator),
        logger: c.resolve(tokens.ILogger),
        eventBus: c.resolve(tokens.IEventBus),
        unifiedCache: c.resolve(tokens.IUnifiedCache),
        circuitBreaker: c.isRegistered(tokens.ICircuitBreaker)
          ? c.resolve(tokens.ICircuitBreaker)
          : null,
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.IClothingSystemFacade)}.`);

  // Register AnatomySystemFacade
  container.register(
    tokens.IAnatomySystemFacade,
    (c) =>
      new IAnatomySystemFacade({
        bodyGraphService: c.resolve(tokens.BodyGraphService),
        anatomyDescriptionService: c.resolve(tokens.AnatomyDescriptionService),
        graphIntegrityValidator: c.resolve(tokens.GraphIntegrityValidator),
        anatomyGenerationService: c.resolve(tokens.AnatomyGenerationService),
        bodyBlueprintFactory: c.resolve(tokens.BodyBlueprintFactory),
        logger: c.resolve(tokens.ILogger),
        eventBus: c.resolve(tokens.IEventBus),
        unifiedCache: c.resolve(tokens.IUnifiedCache),
        circuitBreaker: c.isRegistered(tokens.ICircuitBreaker)
          ? c.resolve(tokens.ICircuitBreaker)
          : null,
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.IAnatomySystemFacade)}.`);

  // ─── Facade Configuration ─────────────────────────────

  // Configure and register facade metadata in the registry
  container.registerCallback((c) => {
    const facadeFactory = c.resolve(tokens.IFacadeFactory);
    const facadeRegistry = c.resolve(tokens.IFacadeRegistry);

    // Register Clothing System Facade configuration
    const clothingFacadeConfig = {
      name: 'ClothingSystemFacade',
      constructor: IClothingSystemFacade,
      dependencies: [
        tokens.ClothingManagementService,
        tokens.EquipmentOrchestrator,
        tokens.LayerCompatibilityService,
        tokens.ClothingSlotValidator,
      ],
    };

    facadeFactory.registerFacade(clothingFacadeConfig);

    const clothingMetadata = {
      name: 'ClothingSystemFacade',
      category: 'clothing',
      version: '1.0.0',
      description: 'Simplified interface for clothing system operations',
      tags: ['clothing', 'equipment', 'layer-management'],
      capabilities: ['query', 'modification', 'validation', 'bulk', 'transfer'],
      singleton: true,
    };

    facadeRegistry.register(clothingMetadata, clothingFacadeConfig);

    // Register Anatomy System Facade configuration
    const anatomyFacadeConfig = {
      name: 'AnatomySystemFacade',
      constructor: IAnatomySystemFacade,
      dependencies: [
        tokens.BodyGraphService,
        tokens.AnatomyDescriptionService,
        tokens.GraphIntegrityValidator,
        tokens.AnatomyGenerationService,
        tokens.BodyBlueprintFactory,
      ],
    };

    facadeFactory.registerFacade(anatomyFacadeConfig);

    const anatomyMetadata = {
      name: 'AnatomySystemFacade',
      category: 'anatomy',
      version: '1.0.0',
      description: 'Simplified interface for anatomy system operations',
      tags: ['anatomy', 'body-parts', 'graph-operations', 'descriptions'],
      capabilities: [
        'query',
        'modification',
        'validation',
        'bulk',
        'graph',
        'description',
      ],
      singleton: true,
    };

    facadeRegistry.register(anatomyMetadata, anatomyFacadeConfig);

    safeDebug('Facade configurations registered in factory and registry.');
  });

  // ─── Location Services ─────────────────────────────
  container.register(
    tokens.ILightingStateService,
    (c) =>
      new LightingStateService({
        entityManager: c.resolve(tokens.IEntityManager),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.ILightingStateService)}.`);

  // ─── Perception Services (SENAWAPEREVE) ─────────────────────────────

  // SensoryCapabilityService - queries entity sensory capabilities from anatomy
  container.register(
    tokens.ISensoryCapabilityService,
    (c) =>
      new SensoryCapabilityService({
        entityManager: c.resolve(tokens.IEntityManager),
        bodyGraphService: c.resolve(tokens.BodyGraphService),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.ISensoryCapabilityService)}.`);

  // PerceptionFilterService - filters events for recipients based on senses
  container.register(
    tokens.IPerceptionFilterService,
    (c) =>
      new PerceptionFilterService({
        sensoryCapabilityService: c.resolve(tokens.ISensoryCapabilityService),
        lightingStateService: c.resolve(tokens.ILightingStateService),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  safeDebug(`Registered ${String(tokens.IPerceptionFilterService)}.`);

  // ─── Storage and Playtime (migrated from persistenceRegistrations) ─────────────────────────────
  registrar.single(tokens.IStorageProvider, BrowserStorageProvider, [
    tokens.ILogger,
    tokens.ISafeEventDispatcher,
  ]);
  safeDebug(`Registered ${String(tokens.IStorageProvider)}.`);

  registrar.single(tokens.PlaytimeTracker, PlaytimeTracker, [
    tokens.ILogger,
    tokens.ISafeEventDispatcher,
  ]);
  safeDebug(`Registered ${String(tokens.PlaytimeTracker)}.`);

  safeDebug('Infrastructure Registration: complete.');
}
