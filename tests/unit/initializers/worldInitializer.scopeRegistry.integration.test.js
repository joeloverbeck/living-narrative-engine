import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { SCOPES_KEY } from '../../../src/constants/dataRegistryKeys.js';
import loadAndInitScopes from '../../../src/initializers/services/scopeRegistryUtils.js';
import { addMockAstsToScopes } from '../../common/scopeDsl/mockAstGenerator.js';

describe('WorldInitializer - ScopeRegistry Integration', () => {
  let worldInitializer;
  let gameDataRepository;
  let scopeRegistry;
  let mockRegistry;
  let mockLogger;
  let mockEntityManager;
  let mockWorldContext;
  let mockValidatedEventDispatcher;

  beforeEach(() => {
    // Create mock dependencies
    mockRegistry = {
      get: jest.fn(),
      getWorldDefinition: jest.fn(),
      getAllWorldDefinitions: jest.fn(),
      getStartingPlayerId: jest.fn(),
      getStartingLocationId: jest.fn(),
      getActionDefinition: jest.fn(),
      getAllActionDefinitions: jest.fn(),
      getEntityDefinition: jest.fn(),
      getAllEntityDefinitions: jest.fn(),
      getEventDefinition: jest.fn(),
      getAllEventDefinitions: jest.fn(),
      getComponentDefinition: jest.fn(),
      getAllComponentDefinitions: jest.fn(),
      getConditionDefinition: jest.fn(),
      getAllConditionDefinitions: jest.fn(),
      getGoalDefinition: jest.fn(),
      getAllGoalDefinitions: jest.fn(),
      getEntityInstanceDefinition: jest.fn(),
      getAllEntityInstanceDefinitions: jest.fn(),
      getAll: jest.fn(),
      clear: jest.fn(),
      store: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockWorldContext = {};

    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // Create real GameDataRepository and ScopeRegistry instances
    gameDataRepository = new GameDataRepository(mockRegistry, mockLogger);
    scopeRegistry = new ScopeRegistry();

    // Create WorldInitializer with real dependencies
    worldInitializer = new WorldInitializer({
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      logger: mockLogger,
      scopeRegistry,
    });
  });

  describe('loadAndInitScopes integration', () => {
    it('should successfully initialize ScopeRegistry with scopes from GameDataRepository', async () => {
      const mockScopes = addMockAstsToScopes({
        'core:all_characters': { expr: 'actor' },
        'core:nearby_items': { expr: 'item' },
        'mod:custom_scope': { expr: 'entity' },
      });
      mockRegistry.get.mockReturnValue(mockScopes);

      await loadAndInitScopes({
        dataSource: gameDataRepository.get.bind(gameDataRepository),
        scopeRegistry,
        logger: mockLogger,
      });

      // Verify GameDataRepository.get was called
      expect(mockRegistry.get).toHaveBeenCalledWith(SCOPES_KEY);

      // Verify ScopeRegistry was initialized with the correct data
      expect(scopeRegistry.getStats().initialized).toBe(true);
      expect(scopeRegistry.getStats().size).toBe(3);
      expect(scopeRegistry.hasScope('core:all_characters')).toBe(true);
      expect(scopeRegistry.hasScope('core:nearby_items')).toBe(true);
      expect(scopeRegistry.hasScope('mod:custom_scope')).toBe(true);

      // Verify logging
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Initializing ScopeRegistry...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ScopeRegistry initialized with 3 scopes.'
      );
    });

    it('should handle missing get method gracefully', async () => {
      // Simulate case where registry.get becomes unavailable after construction
      // This can happen if the registry implementation changes at runtime
      await loadAndInitScopes({
        dataSource: gameDataRepository.get.bind(gameDataRepository),
        scopeRegistry,
        logger: mockLogger,
      });

      // Now modify the underlying registry to not have get method
      mockRegistry.get = undefined;

      // Clear the scope registry for clean test
      scopeRegistry.clear();

      await loadAndInitScopes({
        dataSource: gameDataRepository.get.bind(gameDataRepository),
        scopeRegistry,
        logger: mockLogger,
      });

      // Should log warning about missing get method
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'GameDataRepository: get method not supported by registry'
      );

      // ScopeRegistry should still be initialized with empty scopes
      expect(scopeRegistry.getStats().initialized).toBe(true);
      expect(scopeRegistry.getStats().size).toBe(0);
    });

    it('should handle null/undefined scopes from registry', async () => {
      const testCases = [null, undefined];

      for (const scopesValue of testCases) {
        // Reset the registry
        scopeRegistry.clear();
        mockRegistry.get.mockReturnValue(scopesValue);

        await loadAndInitScopes({
          dataSource: gameDataRepository.get.bind(gameDataRepository),
          scopeRegistry,
          logger: mockLogger,
        });

        // Should initialize with empty object
        expect(scopeRegistry.getStats().initialized).toBe(true);
        expect(scopeRegistry.getStats().size).toBe(0);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'ScopeRegistry initialized with 0 scopes.'
        );

        jest.clearAllMocks();
      }
    });

    it('should handle ScopeRegistry initialization errors', async () => {
      const mockScopes = addMockAstsToScopes({ 'core:test_scope': { expr: 'actor' } });
      mockRegistry.get.mockReturnValue(mockScopes);

      // Mock ScopeRegistry to throw an error
      const originalInitialize = scopeRegistry.initialize;
      const initError = new Error('ScopeRegistry initialization failed');
      scopeRegistry.initialize = jest.fn().mockImplementation(() => {
        throw initError;
      });

      await loadAndInitScopes({
        dataSource: gameDataRepository.get.bind(gameDataRepository),
        scopeRegistry,
        logger: mockLogger,
      });

      // Should log error and not throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize ScopeRegistry:',
        initError
      );

      // Restore original method
      scopeRegistry.initialize = originalInitialize;
    });

    it('should handle empty scopes object', async () => {
      mockRegistry.get.mockReturnValue({});

      await loadAndInitScopes({
        dataSource: gameDataRepository.get.bind(gameDataRepository),
        scopeRegistry,
        logger: mockLogger,
      });

      expect(scopeRegistry.getStats().initialized).toBe(true);
      expect(scopeRegistry.getStats().size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ScopeRegistry initialized with 0 scopes.'
      );
    });

    it('should handle registry errors when getting scopes', async () => {
      const registryError = new Error('Registry access failed');
      mockRegistry.get.mockImplementation(() => {
        throw registryError;
      });

      await loadAndInitScopes({
        dataSource: gameDataRepository.get.bind(gameDataRepository),
        scopeRegistry,
        logger: mockLogger,
      });

      // Should catch the error and log it
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize ScopeRegistry:',
        registryError
      );
    });
  });

  describe('GameDataRepository get method requirements', () => {
    it('should require get method in registry validation', () => {
      const registryWithoutGet = { ...mockRegistry };
      delete registryWithoutGet.get;

      expect(() => {
        new GameDataRepository(registryWithoutGet, mockLogger);
      }).toThrow(
        'GameDataRepository requires a valid IDataRegistry with specific methods. Missing or invalid: get.'
      );
    });

    it('should validate get method exists and is callable', () => {
      expect(typeof gameDataRepository.get).toBe('function');
      expect(() => gameDataRepository.get('test')).not.toThrow();
    });
  });
});
