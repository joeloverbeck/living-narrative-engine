import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { GameDataRepository } from '../../src/data/gameDataRepository.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

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
  getContentSource: jest.fn(() => 'modA'),
  listContentByMod: jest.fn(() => ({ actions: ['a1'] })),
  get: jest.fn(),
  getAll: jest.fn(),
  clear: jest.fn(),
  store: jest.fn(),
});

describe('GameDataRepository additional coverage', () => {
  let registry;
  let logger;
  let repo;

  beforeEach(() => {
    registry = createRegistry();
    logger = createLogger();
    repo = new GameDataRepository(registry, logger);
    jest.clearAllMocks();
  });

  it('handles invalid entity, event, and component IDs', () => {
    expect(repo.getEntityDefinition('')).toBeNull();
    expect(repo.getEventDefinition('   ')).toBeNull();
    expect(repo.getComponentDefinition(null)).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(3);
  });

  it('returns definitions from registry when IDs are valid', () => {
    registry.getEntityDefinition.mockReturnValue({ id: 'e2' });
    registry.getEventDefinition.mockReturnValue({ id: 'ev2' });
    registry.getComponentDefinition.mockReturnValue({ id: 'c2' });

    expect(repo.getEntityDefinition('e2')).toEqual({ id: 'e2' });
    expect(repo.getEventDefinition('ev2')).toEqual({ id: 'ev2' });
    expect(repo.getComponentDefinition('c2')).toEqual({ id: 'c2' });
  });

  it('retrieves all definition collections from the registry', () => {
    expect(repo.getAllEntityDefinitions()).toEqual([{ id: 'e1' }]);
    expect(repo.getAllEventDefinitions()).toEqual([{ id: 'ev1' }]);
    expect(repo.getAllComponentDefinitions()).toEqual([{ id: 'c1' }]);
  });

  it('delegates getContentSource and listContentByMod when supported', () => {
    expect(repo.getContentSource('actions', 'a1')).toBe('modA');
    expect(registry.getContentSource).toHaveBeenCalledWith('actions', 'a1');

    expect(repo.listContentByMod('modA')).toEqual({ actions: ['a1'] });
    expect(registry.listContentByMod).toHaveBeenCalledWith('modA');
  });

  it('constructor throws if registry missing required methods', () => {
    const badRegistry = { getStartingPlayerId: jest.fn() };
    expect(() => new GameDataRepository(badRegistry, logger)).toThrow();
  });
});
