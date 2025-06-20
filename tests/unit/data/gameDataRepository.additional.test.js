// tests/data/gameDataRepository.additional.test.js

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';

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

describe('GameDataRepository additional coverage', () => {
  let registry;
  let logger;
  let repo;

  beforeEach(() => {
    registry = createRegistry();
    logger = createLogger();
    // This instantiation will now succeed
    repo = new GameDataRepository(registry, logger);
    jest.clearAllMocks();
  });

  it('handles invalid entity, event, and component IDs', () => {
    expect(repo.getEntityDefinition('')).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'GameDataRepository: getEntityDefinition called with invalid ID: '
    );

    expect(repo.getEventDefinition('   ')).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'GameDataRepository: getEventDefinition called with invalid ID:    '
    );

    expect(repo.getComponentDefinition(null)).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'GameDataRepository: getComponentDefinition called with invalid ID: null'
    );

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

  // --- NEW TESTS for entity instances ---
  it('handles invalid entity instance IDs', () => {
    expect(repo.getEntityInstanceDefinition(undefined)).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'GameDataRepository: getEntityInstanceDefinition called with invalid ID: undefined'
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('returns entity instance definitions from registry', () => {
    expect(repo.getEntityInstanceDefinition('inst-01')).toEqual({
      instanceId: 'inst-01',
    });
    expect(registry.getEntityInstanceDefinition).toHaveBeenCalledWith(
      'inst-01'
    );
  });

  it('retrieves all entity instance definitions from the registry', () => {
    expect(repo.getAllEntityInstanceDefinitions()).toEqual([
      { instanceId: 'inst-01' },
    ]);
    expect(registry.getAllEntityInstanceDefinitions).toHaveBeenCalled();
  });
  // --- END NEW TESTS ---

  it('delegates getContentSource and listContentByMod when supported', () => {
    expect(repo.getContentSource('actions', 'a1')).toBe('modA');
    expect(registry.getContentSource).toHaveBeenCalledWith('actions', 'a1');

    expect(repo.listContentByMod('modA')).toEqual({ actions: ['a1'] });
    expect(registry.listContentByMod).toHaveBeenCalledWith('modA');
  });

  it('constructor throws if registry missing required methods', () => {
    // This test is now more robust as it checks against a more complete interface
    const badRegistry = { getStartingPlayerId: jest.fn() };
    expect(() => new GameDataRepository(badRegistry, logger)).toThrow(
      'GameDataRepository requires a valid IDataRegistry with specific methods.'
    );
  });
});
