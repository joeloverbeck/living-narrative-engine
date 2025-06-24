import { describe, expect, it, jest } from '@jest/globals';
import { PlaceholderResolver } from '../../../src/utils/placeholderResolverUtils.js';
const _extractContextPath =
  PlaceholderResolver.extractContextPath.bind(PlaceholderResolver);
const _resolvePlaceholderPath =
  PlaceholderResolver.resolvePlaceholderPath.bind(PlaceholderResolver);
import { safeResolvePath } from '../../../src/utils/objectUtils.js';
import { resolveEntityNameFallback } from '../../../src/utils/entityNameFallbackUtils.js';

jest.mock('../../../src/utils/objectUtils.js');
jest.mock('../../../src/utils/entityNameFallbackUtils.js');

const mockLogger = { warn: jest.fn() };

describe('contextUtils private helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('_extractContextPath', () => {
    it('returns root executionContext when path has no context prefix', () => {
      const exec = { foo: 'bar' };
      expect(_extractContextPath('actor.id', exec)).toEqual({
        path: 'actor.id',
        root: exec,
      });
    });

    it('extracts path and context from evaluationContext', () => {
      const ctx = { varA: 1 };
      const exec = { evaluationContext: { context: ctx } };
      expect(_extractContextPath('context.varA', exec)).toEqual({
        path: 'varA',
        root: ctx,
      });
    });

    it('returns null when context prefix used but missing', () => {
      const exec = { evaluationContext: {} };
      expect(_extractContextPath('context.varA', exec)).toBeNull();
    });
  });

  describe('_resolvePlaceholderPath', () => {
    it('warns and returns undefined for empty path', () => {
      expect(_resolvePlaceholderPath('', {}, mockLogger)).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to extract path from placeholder at '
      );
    });

    it('warns and returns undefined for invalid execution context', () => {
      expect(_resolvePlaceholderPath('a.b', null, mockLogger)).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot resolve placeholder path "a.b" at : executionContext is not a valid object.'
      );
    });

    it('warns when context prefix missing in executionContext', () => {
      const exec = { evaluationContext: {} };
      expect(
        _resolvePlaceholderPath('context.x', exec, mockLogger)
      ).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('resolves path via safeResolvePath', () => {
      safeResolvePath.mockReturnValue({ value: 42, error: undefined });
      const exec = { actor: { id: 5 } };
      expect(_resolvePlaceholderPath('actor.id', exec, mockLogger)).toBe(42);
      expect(safeResolvePath).toHaveBeenCalledWith(
        exec,
        'actor.id',
        mockLogger,
        'resolvePlaceholderPath for "actor.id" at '
      );
    });

    it('uses resolveEntityNameFallback when safe resolution fails', () => {
      safeResolvePath.mockReturnValue({
        value: undefined,
        error: new Error('x'),
      });
      resolveEntityNameFallback.mockReturnValue('Bob');
      const exec = { actor: { id: 'a1' } };
      expect(_resolvePlaceholderPath('actor.name', exec, mockLogger)).toBe(
        'Bob'
      );
      expect(resolveEntityNameFallback).toHaveBeenCalledWith(
        'actor.name',
        exec,
        mockLogger
      );
    });
  });
});
