import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ReferenceResolver from '../../../src/initializers/services/referenceResolver.js';

/**
 * Creates a mock logger with Jest stubs for the standard log methods.
 *
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 *   Object containing Jest mock functions.
 */
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ReferenceResolver', () => {
  let mockEntityManager;
  let mockLogger;
  let resolver;

  beforeEach(() => {
    mockEntityManager = {
      getPrimaryInstanceByDefinitionId: jest.fn(),
    };
    mockLogger = createMockLogger();
    resolver = new ReferenceResolver({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('throws when entityManager is missing', () => {
      expect(() => new ReferenceResolver({ logger: mockLogger })).toThrow(
        'ReferenceResolver requires an EntityManager.'
      );
    });

    it('throws when logger is missing', () => {
      expect(
        () => new ReferenceResolver({ entityManager: mockEntityManager })
      ).toThrow('ReferenceResolver requires an ILogger.');
    });
  });

  describe('resolve', () => {
    it('resolves direct definition id', () => {
      mockEntityManager.getPrimaryInstanceByDefinitionId.mockReturnValue({
        id: 'uuid-1',
      });
      const data = { target: 'core:item' };
      const result = resolver.resolve(
        data,
        { dataPath: 'target', resolutionStrategy: { type: 'direct' } },
        'ent1',
        'compA'
      );
      expect(
        mockEntityManager.getPrimaryInstanceByDefinitionId
      ).toHaveBeenCalledWith('core:item');
      expect(result).toEqual({
        resolvedValue: 'uuid-1',
        valueChanged: true,
        dataPath: 'target',
        dataPathIsSelf: false,
      });
    });

    it('returns unchanged value and logs when definition id not found', () => {
      mockEntityManager.getPrimaryInstanceByDefinitionId.mockReturnValue(
        undefined
      );
      const data = { target: 'core:item' };
      const res = resolver.resolve(
        data,
        { dataPath: 'target', resolutionStrategy: { type: 'direct' } },
        'ent1',
        'compA'
      );
      expect(res).toEqual({
        resolvedValue: undefined,
        valueChanged: false,
        dataPath: 'target',
        dataPathIsSelf: false,
      });
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('resolves an array of definition ids', () => {
      mockEntityManager.getPrimaryInstanceByDefinitionId.mockImplementation(
        (id) => {
          if (id === 'core:item1') return { id: 'uuid-1' };
          if (id === 'core:item3') return { id: 'uuid-3' };
          return undefined;
        }
      );
      const data = { items: ['core:item1', 'uuid-2', 'core:item3'] };
      const res = resolver.resolve(
        data,
        {
          dataPath: 'items',
          resolutionStrategy: { type: 'arrayOfDefinitionIds' },
        },
        'ent1',
        'compA'
      );
      expect(res.resolvedValue).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);
      expect(res.valueChanged).toBe(true);
    });

    it('resolves ids inside array of objects', () => {
      mockEntityManager.getPrimaryInstanceByDefinitionId.mockImplementation(
        (id) => {
          if (id === 'core:item1') return { id: 'uuid-1' };
          return undefined;
        }
      );
      const data = {
        slots: [
          { itemId: 'core:item1', qty: 1 },
          { itemId: 'uuid-2', qty: 2 },
        ],
      };
      const res = resolver.resolve(
        data,
        {
          dataPath: 'slots',
          resolutionStrategy: { type: 'arrayOfObjects', idField: 'itemId' },
        },
        'ent1',
        'compA'
      );
      expect(res.valueChanged).toBe(true);
      expect(res.resolvedValue).toEqual([
        { itemId: 'uuid-1', qty: 1 },
        { itemId: 'uuid-2', qty: 2 },
      ]);
    });

    it('handles dataPathIsSelf option', () => {
      mockEntityManager.getPrimaryInstanceByDefinitionId.mockReturnValue({
        id: 'uuid-5',
      });
      const dataValue = 'core:item5';
      const res = resolver.resolve(
        dataValue,
        { dataPathIsSelf: true, resolutionStrategy: { type: 'direct' } },
        'ent1',
        'compA'
      );
      expect(res.resolvedValue).toBe('uuid-5');
      expect(res.dataPath).toBeUndefined();
      expect(res.dataPathIsSelf).toBe(true);
    });
  });
});
