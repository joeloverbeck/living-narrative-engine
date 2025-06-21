import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

/**
 * Creates a mock registry with all methods required by GameDataRepository.
 *
 * @returns {import('../../../src/interfaces/coreServices.js').IDataRegistry}
 */
const createMockRegistry = () => ({
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
  get: jest.fn(),
  getAll: jest.fn(),
  clear: jest.fn(),
  store: jest.fn(),
  getContentSource: jest.fn(),
  listContentByMod: jest.fn(),
});

describe('GameDataRepository', () => {
  let mockRegistry;
  let mockLogger;

  beforeEach(() => {
    mockRegistry = createMockRegistry();
    mockLogger = createMockLogger();
  });

  describe('constructor', () => {
    test('should create an instance with a valid registry and logger', () => {
      expect(
        () => new GameDataRepository(mockRegistry, mockLogger)
      ).not.toThrow();
    });

    test('should throw an error if the registry is missing getGoalDefinition', () => {
      delete mockRegistry.getGoalDefinition;
      expect(() => new GameDataRepository(mockRegistry, mockLogger)).toThrow(
        /Missing or invalid: getGoalDefinition/
      );
    });

    test('should throw an error if the registry is missing getAllGoalDefinitions', () => {
      delete mockRegistry.getAllGoalDefinitions;
      expect(() => new GameDataRepository(mockRegistry, mockLogger)).toThrow(
        /Missing or invalid: getAllGoalDefinitions/
      );
    });

    test('should throw an error if logger is invalid', () => {
      expect(() => new GameDataRepository(mockRegistry, {})).toThrow(
        /requires a valid ILogger/
      );
    });
  });

  describe('Goal Definitions', () => {
    let repository;

    beforeEach(() => {
      repository = new GameDataRepository(mockRegistry, mockLogger);
    });

    describe('getGoalDefinition(id)', () => {
      test('should call registry.getGoalDefinition with the correct id', () => {
        repository.getGoalDefinition('core:goal_survive');
        expect(mockRegistry.getGoalDefinition).toHaveBeenCalledWith(
          'core:goal_survive'
        );
        expect(mockRegistry.getGoalDefinition).toHaveBeenCalledTimes(1);
      });

      test('should return the goal definition from the registry', () => {
        const goalDef = { id: 'core:goal_survive', priority: 100 };
        mockRegistry.getGoalDefinition.mockReturnValue(goalDef);

        const result = repository.getGoalDefinition('core:goal_survive');
        expect(result).toBe(goalDef);
      });

      test('should return null if the registry returns null', () => {
        mockRegistry.getGoalDefinition.mockReturnValue(null);
        const result = repository.getGoalDefinition('core:does_not_exist');
        expect(result).toBeNull();
      });

      test.each([
        ['', 'empty string'],
        ['  ', 'whitespace'],
        [null, 'null'],
        [undefined, 'undefined'],
      ])(
        'should return null and log a warning for invalid id: %s (%s)',
        (invalidId) => {
          const result = repository.getGoalDefinition(invalidId);
          expect(result).toBeNull();
          expect(mockLogger.warn).toHaveBeenCalledWith(
            `GameDataRepository: getGoalDefinition called with invalid ID: ${invalidId}`
          );
          expect(mockRegistry.getGoalDefinition).not.toHaveBeenCalled();
        }
      );
    });

    describe('getAllGoalDefinitions()', () => {
      test('should call registry.getAllGoalDefinitions', () => {
        repository.getAllGoalDefinitions();
        expect(mockRegistry.getAllGoalDefinitions).toHaveBeenCalledTimes(1);
      });

      test('should return all goal definitions from the registry', () => {
        const allGoals = [
          { id: 'core:goal_survive', priority: 100 },
          { id: 'quests:goal_find_amulet', priority: 50 },
        ];
        mockRegistry.getAllGoalDefinitions.mockReturnValue(allGoals);

        const result = repository.getAllGoalDefinitions();
        expect(result).toBe(allGoals);
        expect(result.length).toBe(2);
      });

      test('should return an empty array if the registry has no goals', () => {
        mockRegistry.getAllGoalDefinitions.mockReturnValue([]);
        const result = repository.getAllGoalDefinitions();
        expect(result).toEqual([]);
      });
    });
  });
});
