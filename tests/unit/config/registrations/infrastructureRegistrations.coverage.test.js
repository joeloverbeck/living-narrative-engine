import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { actionTracingTokens } from '../../../../src/dependencyInjection/tokens/actionTracingTokens.js';

jest.mock('../../../../src/utils/eventDispatchService.js', () => {
  const mockCtor = jest
    .fn()
    .mockImplementation((deps) => ({ type: 'EventDispatchService', deps }));
  return { __esModule: true, EventDispatchService: mockCtor };
});

jest.mock('../../../../src/logging/criticalLogNotifier.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps) => ({
    type: 'CriticalLogNotifier',
    deps,
  })),
}));

jest.mock('../../../../src/cache/UnifiedCache.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps, config) => ({
    type: 'UnifiedCache',
    deps,
    config,
  })),
}));

jest.mock('../../../../src/cache/CacheInvalidationManager.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps) => ({
    type: 'CacheInvalidationManager',
    deps,
  })),
}));

jest.mock('../../../../src/cache/CacheMetrics.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps) => ({
    type: 'CacheMetrics',
    deps,
  })),
}));

jest.mock('../../../../src/shared/facades/FacadeFactory.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps) => ({
    ...deps,
    registerFacade: jest.fn(),
  })),
}));

jest.mock('../../../../src/shared/facades/FacadeRegistry.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps) => ({
    ...deps,
    register: jest.fn(),
  })),
}));

jest.mock('../../../../src/clothing/facades/IClothingSystemFacade.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps) => ({
    type: 'ClothingFacade',
    deps,
  })),
}));

jest.mock('../../../../src/anatomy/facades/IAnatomySystemFacade.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps) => ({
    type: 'AnatomyFacade',
    deps,
  })),
}));

jest.mock('../../../../src/events/validatedEventDispatcher.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps) => ({
    type: 'ValidatedEventDispatcher',
    deps,
  })),
}));

jest.mock('../../../../src/events/safeEventDispatcher.js', () => ({
  __esModule: true,
  SafeEventDispatcher: jest.fn().mockImplementation((deps) => ({
    type: 'SafeEventDispatcher',
    deps,
  })),
}));

jest.mock('../../../../src/data/gameDataRepository.js', () => ({
  __esModule: true,
  GameDataRepository: jest.fn().mockImplementation((registry, logger) => ({
    type: 'GameDataRepository',
    registry,
    logger,
  })),
}));

jest.mock('../../../../src/events/eventBus.js', () => {
  const ctor = jest.fn().mockImplementation((deps) => ({ type: 'EventBus', deps }));
  return { __esModule: true, default: ctor };
});

jest.mock('../../../../src/turns/services/actionIndexingService.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((deps) => ({
    type: 'ActionIndexingService',
    deps,
  })),
}));

import { registerInfrastructure } from '../../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import { EventDispatchService } from '../../../../src/utils/eventDispatchService.js';
import CriticalLogNotifier from '../../../../src/logging/criticalLogNotifier.js';
import UnifiedCache from '../../../../src/cache/UnifiedCache.js';
import CacheInvalidationManager from '../../../../src/cache/CacheInvalidationManager.js';
import CacheMetrics from '../../../../src/cache/CacheMetrics.js';
import FacadeFactory from '../../../../src/shared/facades/FacadeFactory.js';
import FacadeRegistry from '../../../../src/shared/facades/FacadeRegistry.js';
import IClothingSystemFacade from '../../../../src/clothing/facades/IClothingSystemFacade.js';
import IAnatomySystemFacade from '../../../../src/anatomy/facades/IAnatomySystemFacade.js';

const createDomStub = () => ({
  className: '',
  style: {},
  hidden: false,
  setAttribute: jest.fn(),
  appendChild: jest.fn(),
  remove: jest.fn(),
});

const createDocumentContextStub = () => ({
  query: jest.fn(() => ({
    remove: jest.fn(),
  })),
  create: jest.fn(() => createDomStub()),
});

describe('registerInfrastructure logging fallback', () => {
  let originalConsoleDebug;
  let container;

  beforeEach(() => {
    jest.clearAllMocks();
    container = new AppContainer();
    originalConsoleDebug = console.debug;
    console.debug = jest.fn();
  });

  afterEach(() => {
    console.debug = originalConsoleDebug;
  });

  test('falls back to console.debug when ILogger is missing', () => {
    registerInfrastructure(container);

    expect(console.debug).toHaveBeenCalledWith(
      'Infrastructure Registration: starting… (ILogger not yet available)'
    );

    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('[Infrastructure Registration] Registered')
    );
  });
});

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('registerInfrastructure extended coverage', () => {
  let container;
  let logger;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    container = new AppContainer();
    logger = createLogger();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    container.register(tokens.ILogger, () => logger);
    container.register(tokens.IDataRegistry, () => ({ type: 'DataRegistry' }));
    container.register(tokens.ISchemaValidator, () => ({
      validate: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      addSchema: jest.fn(),
    }));
    container.register(tokens.IDocumentContext, createDocumentContextStub);

    container.register(tokens.ClothingManagementService, () => ({ type: 'ClothingManagementService' }));
    container.register(tokens.EquipmentOrchestrator, () => ({ type: 'EquipmentOrchestrator' }));
    container.register(tokens.LayerCompatibilityService, () => ({ type: 'LayerCompatibilityService' }));
    container.register(tokens.ClothingSlotValidator, () => ({ type: 'ClothingSlotValidator' }));

    container.register(tokens.BodyGraphService, () => ({ type: 'BodyGraphService' }));
    container.register(tokens.AnatomyDescriptionService, () => ({ type: 'AnatomyDescriptionService' }));
    container.register(tokens.GraphIntegrityValidator, () => ({ type: 'GraphIntegrityValidator' }));
    container.register(tokens.AnatomyGenerationService, () => ({ type: 'AnatomyGenerationService' }));
    container.register(tokens.BodyBlueprintFactory, () => ({ type: 'BodyBlueprintFactory' }));
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    container = null;
  });

  test('resolves cache and facade services with optional dependencies handled', () => {
    registerInfrastructure(container);

    container.register(actionTracingTokens.IActionTraceFilter, () => {
      throw new Error('Trace filter unavailable');
    });

    const dispatchService = container.resolve(tokens.EventDispatchService);
    expect(EventDispatchService).toHaveBeenCalledTimes(1);
    expect(dispatchService.deps.actionTraceFilter).toBeNull();
    expect(dispatchService.deps.eventDispatchTracer).toBeNull();

    const notifier = container.resolve(tokens.ICriticalLogNotifier);
    expect(CriticalLogNotifier).toHaveBeenCalledWith(
      expect.objectContaining({
        logger,
        config: expect.objectContaining({ enableVisualNotifications: true }),
      })
    );

    const notifierAlias = container.resolve(tokens.CriticalLogNotifier);
    expect(notifierAlias).toBe(notifier);

    const unifiedCache = container.resolve(tokens.IUnifiedCache);
    expect(UnifiedCache).toHaveBeenCalledWith(
      expect.objectContaining({ logger }),
      expect.objectContaining({ enableMetrics: true, evictionPolicy: 'lru' })
    );
    expect(container.resolve(tokens.UnifiedCache)).toBe(unifiedCache);

    const invalidationManager = container.resolve(tokens.ICacheInvalidationManager);
    expect(CacheInvalidationManager).toHaveBeenCalledWith(
      expect.objectContaining({ logger })
    );
    expect(container.resolve(tokens.CacheInvalidationManager)).toBe(
      invalidationManager
    );

    const cacheMetrics = container.resolve(tokens.ICacheMetrics);
    expect(CacheMetrics).toHaveBeenCalledWith(expect.objectContaining({ logger }));
    expect(container.resolve(tokens.CacheMetrics)).toBe(cacheMetrics);

    const clothingFacade = container.resolve(tokens.IClothingSystemFacade);
    expect(IClothingSystemFacade).toHaveBeenCalledWith(
      expect.objectContaining({ circuitBreaker: null, logger })
    );
    expect(clothingFacade.deps.circuitBreaker).toBeNull();

    const anatomyFacade = container.resolve(tokens.IAnatomySystemFacade);
    expect(IAnatomySystemFacade).toHaveBeenCalledWith(
      expect.objectContaining({ circuitBreaker: null, logger })
    );
    expect(anatomyFacade.deps.circuitBreaker).toBeNull();

    const facadeFactory = container.resolve(tokens.IFacadeFactory);
    const facadeRegistry = container.resolve(tokens.IFacadeRegistry);

    container.executeCallbacks();

    expect(facadeFactory.registerFacade).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ClothingSystemFacade' })
    );
    expect(facadeFactory.registerFacade).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'AnatomySystemFacade' })
    );

    expect(facadeRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ClothingSystemFacade' }),
      expect.objectContaining({ name: 'ClothingSystemFacade' })
    );
    expect(facadeRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'AnatomySystemFacade' }),
      expect.objectContaining({ name: 'AnatomySystemFacade' })
    );
  });
});
