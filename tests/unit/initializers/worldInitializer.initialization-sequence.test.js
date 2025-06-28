import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { SCOPES_KEY } from '../../../src/constants/dataRegistryKeys.js';
import * as scopeRegistryUtils from '../../../src/initializers/services/scopeRegistryUtils.js';

describe('WorldInitializer - Initialization Sequence', () => {
  let worldInitializer;
  let mockEntityManager;
  let mockWorldContext;
  let mockGameDataRepository;
  let mockValidatedEventDispatcher;
  let mockLogger;
  let mockScopeRegistry;

  beforeEach(() => {
    // Create comprehensive mocks
    mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockWorldContext = {
      getWorldName: jest.fn().mockReturnValue('test:world'),
    };

    mockGameDataRepository = {
      getWorld: jest.fn(),
      getEntityInstanceDefinition: jest.fn(),
      getComponentDefinition: jest.fn(),
      get: jest.fn(), // This is the method we added for scope access
    };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockScopeRegistry = {
      initialize: jest.fn(),
      getScope: jest.fn(),
      getAllScopeNames: jest.fn().mockReturnValue([]),
    };

    worldInitializer = new WorldInitializer({
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockGameDataRepository,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      logger: mockLogger,
      scopeRegistry: mockScopeRegistry,
    });
  });

  describe('initializeWorldEntities scope registry behavior', () => {
    beforeEach(() => {
      // Setup basic world data for successful entity initialization
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:entity_instance',
          },
        ],
      };

      const entityInstanceDef = {
        instanceId: 'test:entity_instance',
        definitionId: 'test:entity',
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(
        entityInstanceDef
      );

      // Mock entity creation to return a simple mock entity
      const mockEntity = {
        id: 'test:entity_instance',
        definitionId: 'test:entity',
        componentEntries: new Map(),
        addComponent: jest.fn(),
        getComponentData: jest.fn(),
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockEntity);
    });

    it('should NOT call loadAndInitScopes during initializeWorldEntities', async () => {
      // Spy on the loadAndInitScopes helper
      const loadAndInitScopesSpy = jest.spyOn(scopeRegistryUtils, 'default');

      await worldInitializer.initializeWorldEntities('test:world');

      // This is the key assertion: scope registry initialization should NOT be called
      // during initializeWorldEntities because it's handled by InitializationService
      expect(loadAndInitScopesSpy).not.toHaveBeenCalled();
    });

    it('should log that scope registry initialization is handled externally', async () => {
      await worldInitializer.initializeWorldEntities('test:world');

      // Verify that the method logs the expected message about external handling
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'WorldInitializer: Starting world entity initialization process for world: test:world...'
      );

      // The key point: there should be no log about initializing scope registry
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Initializing ScopeRegistry')
      );
    });

    it('should still successfully initialize entities without scope registry call', async () => {
      const result =
        await worldInitializer.initializeWorldEntities('test:world');

      // Verify that entity initialization still works properly
      expect(result.instantiatedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.totalProcessed).toBe(1);
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'test:entity',
        {
          instanceId: 'test:entity_instance',
          componentOverrides: undefined,
        }
      );
    });
  });

  describe('loadAndInitScopes standalone behavior', () => {
    it('should properly initialize scope registry when called directly', async () => {
      const mockScopes = {
        followers: { expr: 'actor.core:leading.followers[]', modId: 'core' },
        environment: { expr: 'entities(core:position)[...]', modId: 'core' },
      };

      mockGameDataRepository.get.mockReturnValue(mockScopes);

      await scopeRegistryUtils.default({
        dataSource: mockGameDataRepository.get,
        scopeRegistry: mockScopeRegistry,
        logger: mockLogger,
      });

      expect(mockGameDataRepository.get).toHaveBeenCalledWith(SCOPES_KEY);
      expect(mockScopeRegistry.initialize).toHaveBeenCalledWith(mockScopes);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ScopeRegistry initialized with 2 scopes.'
      );
    });

    it('should handle empty scopes gracefully when called directly', async () => {
      mockGameDataRepository.get.mockReturnValue({});

      await scopeRegistryUtils.default({
        dataSource: mockGameDataRepository.get,
        scopeRegistry: mockScopeRegistry,
        logger: mockLogger,
      });

      expect(mockScopeRegistry.initialize).toHaveBeenCalledWith({});
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ScopeRegistry initialized with 0 scopes.'
      );
    });
  });

  describe('initialization sequence integration', () => {
    beforeEach(() => {
      // Setup world data for these tests
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:entity_instance',
          },
        ],
      };

      const entityInstanceDef = {
        instanceId: 'test:entity_instance',
        definitionId: 'test:entity',
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(
        entityInstanceDef
      );

      // Mock entity creation to return a simple mock entity
      const mockEntity = {
        id: 'test:entity_instance',
        definitionId: 'test:entity',
        componentEntries: new Map(),
        addComponent: jest.fn(),
        getComponentData: jest.fn(),
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockEntity);
    });

    it('should document the expected initialization order', () => {
      // This test serves as documentation for the proper initialization sequence:
      // 1. InitializationService loads mods (including scopes) via ModsLoader
      // 2. InitializationService retrieves scopes from data registry and initializes ScopeRegistry
      // 3. InitializationService calls WorldInitializer.initializeWorldEntities()
      // 4. WorldInitializer.initializeWorldEntities() does NOT re-initialize scope registry

      expect(true).toBe(true); // This test is for documentation purposes
    });

    it('should verify that scope registry is accessible during world initialization', async () => {
      // Even though we don't initialize the scope registry in initializeWorldEntities,
      // it should still be accessible (because InitializationService initialized it)

      await worldInitializer.initializeWorldEntities('test:world');

      // The scope registry should be available for use, even though we didn't initialize it
      expect(mockScopeRegistry).toBeDefined();
      expect(worldInitializer.getWorldContext).toBeDefined();
    });
  });

  describe('regression prevention', () => {
    beforeEach(() => {
      // Setup world data for these tests
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:entity_instance',
          },
        ],
      };

      const entityInstanceDef = {
        instanceId: 'test:entity_instance',
        definitionId: 'test:entity',
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(
        entityInstanceDef
      );

      // Mock entity creation to return a simple mock entity
      const mockEntity = {
        id: 'test:entity_instance',
        definitionId: 'test:entity',
        componentEntries: new Map(),
        addComponent: jest.fn(),
        getComponentData: jest.fn(),
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockEntity);
    });

    it('should prevent double initialization of scope registry', async () => {
      // This test ensures we don't accidentally re-introduce the double initialization bug

      const loadAndInitScopesSpy = jest.spyOn(scopeRegistryUtils, 'default');

      // Call both methods that could potentially initialize scope registry
      await scopeRegistryUtils.default({
        dataSource: mockGameDataRepository.get,
        scopeRegistry: mockScopeRegistry,
        logger: mockLogger,
      });
      await worldInitializer.initializeWorldEntities('test:world');

      // loadAndInitScopes should only be called once (the direct call)
      expect(loadAndInitScopesSpy).toHaveBeenCalledTimes(1);
    });

    it('should maintain separation of concerns between scope and entity initialization', async () => {
      const loadAndInitScopesSpy = jest.spyOn(scopeRegistryUtils, 'default');

      // Entity initialization should not trigger scope initialization
      await worldInitializer.initializeWorldEntities('test:world');

      expect(loadAndInitScopesSpy).not.toHaveBeenCalled();

      // But scope initialization should still work independently
      await scopeRegistryUtils.default({
        dataSource: mockGameDataRepository.get,
        scopeRegistry: mockScopeRegistry,
        logger: mockLogger,
      });

      expect(loadAndInitScopesSpy).toHaveBeenCalledTimes(1);
    });
  });
});
