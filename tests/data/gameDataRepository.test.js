/**
 * @file Tests for GameDataRepository.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { GameDataRepository } from '../../src/data/gameDataRepository.js';

// Helper to create a logger mock
const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Helper to create a registry mock with default implementations
const createRegistry = () => ({
  getStartingPlayerId: jest.fn(() => 'player1'),
  getStartingLocationId: jest.fn(() => 'location1'),
  getActionDefinition: jest.fn((id) => ({ id })),
  getAllActionDefinitions: jest.fn(() => [{ id: 'a1' }]),
  getEntityDefinition: jest.fn((id) => ({ id })),
  getAllEntityDefinitions: jest.fn(() => [{ id: 'e1' }]),
  getEventDefinition: jest.fn((id) => ({ id })),
  getAllEventDefinitions: jest.fn(() => [{ id: 'ev1' }]),
  getComponentDefinition: jest.fn((id) => ({ id })),
  getAllComponentDefinitions: jest.fn(() => [{ id: 'c1' }]),
  getConditionDefinition: jest.fn((id) => ({ id })),
  getAllConditionDefinitions: jest.fn(() => [{ id: 'cond1' }]),
  getEntityInstanceDefinition: jest.fn((id) => ({ instanceId: id })),
  getAllEntityInstanceDefinitions: jest.fn(() => [{ instanceId: 'inst-01' }]),
  getGoalDefinition: jest.fn((id) => ({ id })),
  getAllGoalDefinitions: jest.fn(() => [{ id: 'g1' }]),
  getContentSource: jest.fn(() => 'modA'),
  listContentByMod: jest.fn(() => ({ actions: ['a1'] })),
  get: jest.fn(),
  getAll: jest.fn(),
  clear: jest.fn(),
  store: jest.fn(),
});

describe('GameDataRepository', () => {
  /** @type {ReturnType<typeof createRegistry>} */
  let registry;
  /** @type {ReturnType<typeof createLogger>} */
  let logger;
  /** @type {GameDataRepository} */
  let repo;

  beforeEach(() => {
    registry = createRegistry();
    logger = createLogger();
    // This instantiation will now succeed
    repo = new GameDataRepository(registry, logger);
    jest.clearAllMocks();
  });

  test('constructor validates logger and registry', () => {
    expect(() => new GameDataRepository(registry, {})).toThrow();
    // Re-create a valid registry for the second check
    const validRegistry = createRegistry();
    expect(() => new GameDataRepository({}, logger)).toThrow();
  });

  test('getWorldName returns DEMO_WORLD', () => {
    expect(repo.getWorldName()).toBe('DEMO_WORLD');
  });

  test('delegates to registry for basic getters', () => {
    expect(repo.getStartingPlayerId()).toBe('player1');
    expect(registry.getStartingPlayerId).toHaveBeenCalled();
    expect(repo.getStartingLocationId()).toBe('location1');
    expect(registry.getStartingLocationId).toHaveBeenCalled();
    expect(repo.getAllActionDefinitions()).toEqual([{ id: 'a1' }]);
    expect(registry.getAllActionDefinitions).toHaveBeenCalled();
  });

  test('getActionDefinition warns on invalid id', () => {
    expect(repo.getActionDefinition('')).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('getActionDefinition returns value from registry', () => {
    registry.getActionDefinition.mockReturnValue({ id: 'core:move' });
    expect(repo.getActionDefinition('core:move')).toEqual({ id: 'core:move' });
  });

  test('getContentSource warns when method missing', () => {
    delete registry.getContentSource;
    // We can't re-create the repo here without a valid registry.
    // So we test the behavior on the existing repo when the method is not available on its registry.
    // To do this properly, we need a registry without the method from the start.
    const deficientRegistry = createRegistry();
    delete deficientRegistry.getContentSource;
    const deficientRepo = new GameDataRepository(deficientRegistry, logger);

    const result = deficientRepo.getContentSource('actions', 'a1');
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'GameDataRepository: getContentSource not supported by registry'
    );
  });

  test('listContentByMod warns when method missing', () => {
    // Similar to the test above, create a specific registry for this test case.
    const deficientRegistry = createRegistry();
    delete deficientRegistry.listContentByMod;
    const deficientRepo = new GameDataRepository(deficientRegistry, logger);

    const result = deficientRepo.listContentByMod('modA');
    expect(result).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(
      'GameDataRepository: listContentByMod not supported by registry'
    );
  });
});
