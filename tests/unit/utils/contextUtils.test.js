/**
 * @file Test suite to cover contextUtils.js
 * @see tests/utils/contextUtils.test.js
 */

/**
 * @jest-environment node
 */
import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import {
  resolveEntityNameFallback,
  resolvePlaceholders,
} from '../../../src/utils/contextUtils.js';
import { PlaceholderResolver } from '../../../src/utils/placeholderResolverUtils.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';

// Mock dependencies
jest.mock('../../../src/utils/placeholderResolverUtils.js');
jest.mock('../../../src/utils/entityUtils.js');

const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
};

// getEntityDisplayName is now a mock function due to the jest.mock call above.
const mockGetEntityDisplayName = getEntityDisplayName;

describe('contextUtils.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Provide a default implementation for the mocked getEntityDisplayName for most tests
    mockGetEntityDisplayName.mockImplementation(
      (entity) => entity?.getComponentData(NAME_COMPONENT_ID)?.text
    );
  });

  describe('resolveEntityNameFallback', () => {
    test('should return undefined if resolutionRoot is null or undefined', () => {
      expect(
        resolveEntityNameFallback('actor.name', null, mockLogger)
      ).toBeUndefined();
      expect(
        resolveEntityNameFallback('actor.name', undefined, mockLogger)
      ).toBeUndefined();
    });

    test('should return undefined for a placeholder path that is not a recognized shorthand', () => {
      const resolutionRoot = { actor: {} };
      expect(
        resolveEntityNameFallback(
          'inventory.item.name',
          resolutionRoot,
          mockLogger
        )
      ).toBeUndefined();
    });

    test("should return undefined if 'actor.name' is requested but actor is not in the resolution root", () => {
      const resolutionRoot = { target: {} };
      expect(
        resolveEntityNameFallback('actor.name', resolutionRoot, mockLogger)
      ).toBeUndefined();
    });

    test("should return undefined if 'target.name' is requested but target is not in the resolution root", () => {
      const resolutionRoot = { actor: {} };
      expect(
        resolveEntityNameFallback('target.name', resolutionRoot, mockLogger)
      ).toBeUndefined();
    });

    test("should correctly call getEntityDisplayName for 'actor.name'", () => {
      const mockActor = {
        id: 'actor-1',
        getComponentData: jest.fn().mockReturnValue({ text: 'Hero' }),
      };
      const resolutionRoot = { actor: mockActor };
      mockGetEntityDisplayName.mockReturnValue('Hero');

      const result = resolveEntityNameFallback(
        'actor.name',
        resolutionRoot,
        mockLogger
      );

      expect(result).toBe('Hero');
      expect(mockGetEntityDisplayName).toHaveBeenCalledWith(
        mockActor,
        undefined,
        mockLogger
      );
    });

    test("should correctly call getEntityDisplayName for 'target.name'", () => {
      const mockTarget = {
        id: 'target-1',
        getComponentData: jest.fn().mockReturnValue({ text: 'Villain' }),
      };
      const resolutionRoot = { target: mockTarget };
      mockGetEntityDisplayName.mockReturnValue('Villain');

      const result = resolveEntityNameFallback(
        'target.name',
        resolutionRoot,
        mockLogger
      );

      expect(result).toBe('Villain');
      expect(mockGetEntityDisplayName).toHaveBeenCalledWith(
        mockTarget,
        undefined,
        mockLogger
      );
    });

    test('should adapt a plain object entity that does not have a getComponentData method', () => {
      const plainObjectTarget = {
        id: 'target-plain',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Plain Jane' },
        },
      };
      const resolutionRoot = { target: plainObjectTarget };
      mockGetEntityDisplayName.mockReturnValue('Plain Jane');

      const result = resolveEntityNameFallback(
        'target.name',
        resolutionRoot,
        mockLogger
      );

      expect(result).toBe('Plain Jane');
      expect(mockGetEntityDisplayName).toHaveBeenCalled();

      // Check the adapted entity passed to the mock
      const adaptedEntity = mockGetEntityDisplayName.mock.calls[0][0];
      expect(adaptedEntity.id).toBe('target-plain');
      expect(typeof adaptedEntity.getComponentData).toBe('function');
      expect(adaptedEntity.getComponentData(NAME_COMPONENT_ID)).toEqual({
        text: 'Plain Jane',
      });
    });

    test('should log a debug message upon successful name resolution', () => {
      const mockActor = {
        id: 'actor-1',
        getComponentData: jest.fn(),
      };
      const resolutionRoot = { actor: mockActor };
      mockGetEntityDisplayName.mockReturnValue('Logged Hero');

      resolveEntityNameFallback('actor.name', resolutionRoot, mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Resolved placeholder "actor.name" to "Logged Hero" via NAME_COMPONENT_ID component fallback.'
      );
    });

    test('should return undefined if getEntityDisplayName does not resolve to a string', () => {
      const mockActor = { id: 'actor-1', getComponentData: jest.fn() };
      const resolutionRoot = { actor: mockActor };
      mockGetEntityDisplayName.mockReturnValue(null); // Simulate name not found

      const result = resolveEntityNameFallback(
        'actor.name',
        resolutionRoot,
        mockLogger
      );

      expect(result).toBeUndefined();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  // --- Suite for Unit Tests (mocking PlaceholderResolver) ---
  describe('resolvePlaceholders (Unit Tests)', () => {
    let mockResolverInstance;
    let mockBuildResolutionSources;

    beforeEach(() => {
      // This setup is specific to the unit tests for resolvePlaceholders
      mockResolverInstance = {
        resolveStructure: jest.fn((input) => input), // Default to returning original input
      };
      PlaceholderResolver.mockImplementation(() => mockResolverInstance);

      mockBuildResolutionSources = jest.fn().mockReturnValue({
        sources: [{ a: 1 }],
        fallback: { b: 2 },
      });
      PlaceholderResolver.buildResolutionSources = mockBuildResolutionSources;
    });

    test('should instantiate PlaceholderResolver with the provided logger', () => {
      resolvePlaceholders({}, {}, mockLogger);
      expect(PlaceholderResolver).toHaveBeenCalledWith(mockLogger);
    });

    test('should call buildResolutionSources with the execution context', () => {
      const executionContext = { actor: { id: 'actor-1' } };
      resolvePlaceholders({}, executionContext, mockLogger);
      expect(mockBuildResolutionSources).toHaveBeenCalledWith(executionContext);
    });

    test('should call resolveStructure with the correct arguments', () => {
      const input = { message: 'Hello {actor.name}' };
      const executionContext = { actor: { id: 'actor-1' } };
      const skipKeys = ['someKeyToSkip'];

      resolvePlaceholders(input, executionContext, mockLogger, '', skipKeys);

      expect(mockResolverInstance.resolveStructure).toHaveBeenCalledTimes(1);
      expect(mockResolverInstance.resolveStructure).toHaveBeenCalledWith(
        input,
        [{ a: 1 }],
        { b: 2 },
        skipKeys
      );
    });

    test('should return the result from resolver.resolveStructure', () => {
      const resolvedStructure = { message: 'Hello World' };
      mockResolverInstance.resolveStructure.mockReturnValue(resolvedStructure);

      const result = resolvePlaceholders({}, {}, mockLogger);

      expect(result).toBe(resolvedStructure);
    });
  });
});
