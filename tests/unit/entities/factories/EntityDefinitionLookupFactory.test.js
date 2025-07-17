/**
 * @file Unit tests for EntityDefinitionLookupFactory
 * @see src/entities/factories/EntityDefinitionLookupFactory.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityDefinitionLookupFactory from '../../../../src/entities/factories/EntityDefinitionLookupFactory.js';
import { DefinitionNotFoundError } from '../../../../src/errors/definitionNotFoundError.js';
import { createMockLogger } from '../../../common/mockFactories.js';

// Mock the definitionLookup utility
jest.mock('../../../../src/entities/utils/definitionLookup.js', () => ({
  getDefinition: jest.fn(),
}));

import { getDefinition as mockGetDefinition } from '../../../../src/entities/utils/definitionLookup.js';

describe('EntityDefinitionLookupFactory', () => {
  let factory;
  let mockLogger;
  let mockRegistry;
  let mockDefinition;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockRegistry = {
      getEntityDefinition: jest.fn(),
    };
    mockDefinition = {
      id: 'test:definition',
      name: 'Test Definition',
      components: [],
    };

    factory = new EntityDefinitionLookupFactory({
      logger: mockLogger,
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      const testLogger = createMockLogger();
      const testFactory = new EntityDefinitionLookupFactory({
        logger: testLogger,
      });

      expect(testFactory).toBeInstanceOf(EntityDefinitionLookupFactory);
      expect(testLogger.debug).toHaveBeenCalledWith(
        'EntityDefinitionLookupFactory initialized.'
      );
    });

    it('should validate logger with required methods', () => {
      const invalidLogger = { log: jest.fn() }; // Missing required methods

      expect(() => {
        new EntityDefinitionLookupFactory({ logger: invalidLogger });
      }).toThrow("Invalid or missing method 'info' on dependency 'ILogger'.");
    });
  });

  describe('getDefinition', () => {
    it('should return definition when valid inputs provided', () => {
      mockGetDefinition.mockReturnValue(mockDefinition);

      const result = factory.getDefinition('test:definition', mockRegistry);

      expect(result).toBe(mockDefinition);
      expect(mockGetDefinition).toHaveBeenCalledWith(
        'test:definition',
        mockRegistry,
        mockLogger
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[EntityDefinitionLookupFactory] Successfully retrieved definition 'test:definition'"
      );
    });

    it('should return null and log warning when definitionId is invalid', () => {
      const result = factory.getDefinition('', mockRegistry);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[EntityDefinitionLookupFactory] Invalid definitionId provided: '
      );
      expect(mockGetDefinition).not.toHaveBeenCalled();
    });

    it('should return null and log warning when definitionId is null', () => {
      const result = factory.getDefinition(null, mockRegistry);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[EntityDefinitionLookupFactory] Invalid definitionId provided: null'
      );
      expect(mockGetDefinition).not.toHaveBeenCalled();
    });

    it('should return null and log warning when definitionId is not a string', () => {
      const result = factory.getDefinition(123, mockRegistry);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[EntityDefinitionLookupFactory] Invalid definitionId provided: 123'
      );
      expect(mockGetDefinition).not.toHaveBeenCalled();
    });

    it('should return null and log error when registry is invalid', () => {
      const result = factory.getDefinition('test:definition', null);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EntityDefinitionLookupFactory] Invalid registry provided for definition 'test:definition'"
      );
      expect(mockGetDefinition).not.toHaveBeenCalled();
    });

    it('should return null and log error when registry is not an object', () => {
      const result = factory.getDefinition('test:definition', 'invalid');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EntityDefinitionLookupFactory] Invalid registry provided for definition 'test:definition'"
      );
      expect(mockGetDefinition).not.toHaveBeenCalled();
    });

    it('should return null and log debug when definition is not found', () => {
      mockGetDefinition.mockReturnValue(null);

      const result = factory.getDefinition('test:definition', mockRegistry);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[EntityDefinitionLookupFactory] Definition 'test:definition' not found in registry"
      );
    });

    it('should return null and log error when lookupDefinition throws', () => {
      const error = new Error('Lookup failed');
      mockGetDefinition.mockImplementation(() => {
        throw error;
      });

      const result = factory.getDefinition('test:definition', mockRegistry);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EntityDefinitionLookupFactory] Error retrieving definition 'test:definition': Lookup failed"
      );
    });
  });

  describe('getDefinitionOrThrow', () => {
    it('should return definition when found', () => {
      mockGetDefinition.mockReturnValue(mockDefinition);

      const result = factory.getDefinitionOrThrow(
        'test:definition',
        mockRegistry
      );

      expect(result).toBe(mockDefinition);
    });

    it('should throw DefinitionNotFoundError when definition not found', () => {
      mockGetDefinition.mockReturnValue(null);

      expect(() => {
        factory.getDefinitionOrThrow('test:definition', mockRegistry);
      }).toThrow(DefinitionNotFoundError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EntityDefinitionLookupFactory] Definition 'test:definition' not found in registry"
      );
    });

    it('should throw DefinitionNotFoundError when getDefinition returns null due to invalid inputs', () => {
      expect(() => {
        factory.getDefinitionOrThrow('', mockRegistry);
      }).toThrow(DefinitionNotFoundError);
    });
  });

  describe('hasDefinition', () => {
    it('should return true when definition exists', () => {
      mockGetDefinition.mockReturnValue(mockDefinition);

      const result = factory.hasDefinition('test:definition', mockRegistry);

      expect(result).toBe(true);
    });

    it('should return false when definition does not exist', () => {
      mockGetDefinition.mockReturnValue(null);

      const result = factory.hasDefinition('test:definition', mockRegistry);

      expect(result).toBe(false);
    });

    it('should return false when inputs are invalid', () => {
      const result = factory.hasDefinition('', mockRegistry);

      expect(result).toBe(false);
    });
  });

  describe('getMultipleDefinitions', () => {
    it('should return map with multiple definitions', () => {
      const definition1 = { id: 'test:def1', name: 'Definition 1' };
      const definition2 = { id: 'test:def2', name: 'Definition 2' };

      mockGetDefinition
        .mockReturnValueOnce(definition1)
        .mockReturnValueOnce(definition2);

      const result = factory.getMultipleDefinitions(
        ['test:def1', 'test:def2'],
        mockRegistry
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.get('test:def1')).toBe(definition1);
      expect(result.get('test:def2')).toBe(definition2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[EntityDefinitionLookupFactory] Retrieved 2 definitions, 2 successful'
      );
    });

    it('should return map with mixed success/failure results', () => {
      const definition1 = { id: 'test:def1', name: 'Definition 1' };

      mockGetDefinition
        .mockReturnValueOnce(definition1)
        .mockReturnValueOnce(null);

      const result = factory.getMultipleDefinitions(
        ['test:def1', 'test:def2'],
        mockRegistry
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.get('test:def1')).toBe(definition1);
      expect(result.get('test:def2')).toBe(null);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[EntityDefinitionLookupFactory] Retrieved 2 definitions, 1 successful'
      );
    });

    it('should return empty map and log warning when definitionIds is not an array', () => {
      const result = factory.getMultipleDefinitions(
        'not-an-array',
        mockRegistry
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[EntityDefinitionLookupFactory] getMultipleDefinitions: definitionIds must be an array'
      );
      expect(mockGetDefinition).not.toHaveBeenCalled();
    });

    it('should return empty map when empty array provided', () => {
      const result = factory.getMultipleDefinitions([], mockRegistry);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[EntityDefinitionLookupFactory] Retrieved 0 definitions, 0 successful'
      );
    });
  });

  describe('validateRegistry', () => {
    it('should not throw when registry is valid', () => {
      expect(() => {
        factory.validateRegistry(mockRegistry);
      }).not.toThrow();
    });

    it('should throw error when registry is null', () => {
      expect(() => {
        factory.validateRegistry(null);
      }).toThrow('EntityDefinitionLookupFactory: registry must be an object');
    });

    it('should throw error when registry is undefined', () => {
      expect(() => {
        factory.validateRegistry(undefined);
      }).toThrow('EntityDefinitionLookupFactory: registry must be an object');
    });

    it('should throw error when registry is not an object', () => {
      expect(() => {
        factory.validateRegistry('not-an-object');
      }).toThrow('EntityDefinitionLookupFactory: registry must be an object');
    });

    it('should throw error when registry missing getEntityDefinition method', () => {
      const invalidRegistry = { someOtherMethod: jest.fn() };

      expect(() => {
        factory.validateRegistry(invalidRegistry);
      }).toThrow(
        'EntityDefinitionLookupFactory: registry must have getEntityDefinition method'
      );
    });

    it('should throw error when getEntityDefinition is not a function', () => {
      const invalidRegistry = { getEntityDefinition: 'not-a-function' };

      expect(() => {
        factory.validateRegistry(invalidRegistry);
      }).toThrow(
        'EntityDefinitionLookupFactory: registry must have getEntityDefinition method'
      );
    });
  });
});
