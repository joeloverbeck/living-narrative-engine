/**
 * @file Integration test suite to cover contextUtils.js
 * @see tests/integration/contextUtils.integration.test.js
 */


/**
 * @jest-environment node
 */
import {
  describe,
  expect,
  jest,
  test,
  beforeEach,
} from '@jest/globals';
import { resolvePlaceholders } from '../../src/utils/contextUtils.js';
import { getEntityDisplayName } from '../../src/utils/entityUtils.js';

// Mock ONLY the dependencies we want to control, not the system under integration.
jest.mock('../../src/utils/entityUtils.js');

const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
};

// getEntityDisplayName is a mock function due to the jest.mock call above.
const mockGetEntityDisplayName = getEntityDisplayName;

describe('contextUtils.js', () => {
  beforeEach(() => {
    // We still clear mocks to ensure tests are isolated from each other.
    jest.clearAllMocks();
  });

  // --- Suite for Integration Tests (using real PlaceholderResolver) ---
  describe('resolvePlaceholders (Integration Tests)', () => {
    beforeEach(() => {
      // The unmock call is no longer needed.

      // Set the desired mock behavior for the dependency we are still mocking.
      mockGetEntityDisplayName.mockImplementation((entity, fallback) => {
        if (entity?.name) return entity.name;
        if (entity?.id) return entity.id;
        return fallback;
      });
    });

    test('should resolve a simple path from the root of executionContext', () => {
      const input = { text: 'Actor ID is {actor.id}' };
      const executionContext = { actor: { id: 'a-1' } };
      const result = resolvePlaceholders(input, executionContext, mockLogger);
      expect(result).toEqual({ text: 'Actor ID is a-1' });
    });

    test('should resolve a path with the "context." prefix from evaluationContext', () => {
      const input = { text: 'The value is {context.myVar}' };
      const executionContext = {
        evaluationContext: {
          context: { myVar: 123 }
        }
      };
      const result = resolvePlaceholders(input, executionContext, mockLogger);
      expect(result).toEqual({ text: 'The value is 123' });
    });

    test('should warn if "context." is used but evaluationContext.context is missing', () => {
      const input = { text: 'Value: {context.myVar}' };
      const executionContext = { evaluationContext: {} };
      resolvePlaceholders(input, executionContext, mockLogger);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Placeholder "{context.myVar}" not found'));
    });

    test('should use entity name fallback for {actor.name}', () => {
      const input = "The hero is {actor.name}.";
      const executionContext = { actor: { id: 'a-1', name: 'Sir Clucks-a-Lot' } };
      const result = resolvePlaceholders(input, executionContext, mockLogger);
      expect(result).toBe("The hero is Sir Clucks-a-Lot.");
    });

    test('should replace a full-string placeholder with its native type', () => {
      const input = '{context.isPlayer}';
      const executionContext = { evaluationContext: { context: { isPlayer: true } } };
      const result = resolvePlaceholders(input, executionContext, mockLogger);
      expect(result).toBe(true);
    });

    test('should resolve placeholders in nested objects and arrays', () => {
      const input = {
        title: 'Report for {actor.name}',
        data: [
          { key: 'ID', value: '{actor.id}' },
          { key: 'Status', value: '{context.status}' }
        ]
      };
      const executionContext = {
        actor: { id: 'a-1', name: 'Test Actor' },
        evaluationContext: { context: { status: 'Active' } }
      };

      const result = resolvePlaceholders(input, executionContext, mockLogger);

      expect(result).toEqual({
        title: 'Report for Test Actor',
        data: [
          { key: 'ID', value: 'a-1' },
          { key: 'Status', value: 'Active' }
        ]
      });
    });

    test('should respect the skipKeys parameter', () => {
      const input = {
        unresolved: 'Data is {context.data}',
        resolved: 'Name is {actor.name}'
      };
      const executionContext = {
        actor: { id: 'a-1', name: 'DoNotResolve' },
        evaluationContext: { context: { data: 'should-be-ignored' } }
      };

      const result = resolvePlaceholders(input, executionContext, mockLogger, '', ['unresolved']);
      expect(result).toEqual({
        unresolved: 'Data is {context.data}',
        resolved: 'Name is DoNotResolve'
      });
    });
  });
});