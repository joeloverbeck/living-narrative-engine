import { describe, it, expect } from '@jest/globals';
import FnLoadOrderResolverAdapter from '../../../src/adapters/fnLoadOrderResolverAdapter.js';

describe('FnLoadOrderResolverAdapter', () => {
  it('wraps a function and delegates resolve()', () => {
    const mockFn = jest.fn(() => ['b', 'a']);
    const adapter = new FnLoadOrderResolverAdapter(mockFn);
    const ids = ['a', 'b'];
    const manifests = new Map();
    const result = adapter.resolve(ids, manifests);
    expect(result).toEqual(['b', 'a']);
    expect(mockFn).toHaveBeenCalledWith(ids, manifests);
  });

  it('throws when constructed with a non-function', () => {
    expect(() => new FnLoadOrderResolverAdapter(null)).toThrow(
      'FnLoadOrderResolverAdapter requires a function.'
    );
    expect(() => new FnLoadOrderResolverAdapter(42)).toThrow(
      'FnLoadOrderResolverAdapter requires a function.'
    );
  });
});
