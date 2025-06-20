import { describe, it, expect } from '@jest/globals';
import MapManager from '../../../src/utils/mapManagerUtils.js';

describe('MapManager', () => {
  it('manages values with valid ids', () => {
    const mgr = new MapManager();
    mgr.add('id1', 42);
    expect(mgr.get('id1')).toBe(42);
    expect(mgr.has('id1')).toBe(true);
    expect(Array.from(mgr.keys())).toEqual(['id1']);
    expect(Array.from(mgr.values())).toEqual([42]);
    expect(Array.from(mgr.entries())).toEqual([['id1', 42]]);
    expect(mgr.remove('id1')).toBe(true);
    expect(mgr.has('id1')).toBe(false);
    mgr.add('id2', 'x');
    mgr.clear();
    expect(Array.from(mgr.keys()).length).toBe(0);
  });

  it('throws on invalid ids when validation enabled', () => {
    const mgr = new MapManager();
    expect(() => mgr.add('', 1)).toThrow('MapManager.add: Invalid id');
    expect(() => mgr.get('')).toThrow('MapManager.get: Invalid id');
    expect(() => mgr.has(null)).toThrow('MapManager.has: Invalid id');
    expect(() => mgr.remove(undefined)).toThrow(
      'MapManager.remove: Invalid id'
    );
  });

  it('ignores invalid ids when validation disabled', () => {
    const mgr = new MapManager({ throwOnInvalidId: false });
    mgr.add('', 1);
    expect(mgr.get('')).toBeUndefined();
    expect(mgr.has('')).toBe(false);
    expect(mgr.remove('')).toBe(false);
  });
});
