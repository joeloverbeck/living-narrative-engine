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
  // Added condition registry methods for new ConditionLoader feature
  getConditionDefinition: jest.fn((id) => ({ id })),
  getAllConditionDefinitions: jest.fn(() => [{ id: 'cond1' }]),
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
    repo = new GameDataRepository(registry, logger);
    jest.clearAllMocks();
  });

  test('constructor validates logger and registry', () => {
    expect(() => new GameDataRepository(registry, {})).toThrow();
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
    repo = new GameDataRepository(registry, logger);
    const result = repo.getContentSource('actions', 'a1');
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'GameDataRepository: getContentSource not supported by registry'
    );
  });

  test('listContentByMod warns when method missing', () => {
    delete registry.listContentByMod;
    repo = new GameDataRepository(registry, logger);
    const result = repo.listContentByMod('modA');
    expect(result).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(
      'GameDataRepository: listContentByMod not supported by registry'
    );
  });
});
