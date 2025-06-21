const { makeRegistryCache } = require('../../src/loaders/registryCacheAdapter');

describe('makeRegistryCache', () => {
  it('snapshot/clear/restore round-trip keeps deep-equal data', () => {
    // Fake registry with .data as a Map
    const registry = {
      data: new Map([
        ['foo', new Map([['bar', { bar: 1, baz: [2, 3] }]])],
      ]),
      clear() {
        this.data.clear();
      },
      store(type, id, value) {
        if (!this.data.has(type)) this.data.set(type, new Map());
        this.data.get(type).set(id, value);
      },
      get(type, id) {
        return this.data.has(type) ? this.data.get(type).get(id) : undefined;
      },
    };
    const cache = makeRegistryCache(registry);
    // Take snapshot
    const snap = cache.snapshot();
    // Clear registry
    cache.clear();
    expect(Array.from(registry.data.keys())).toEqual([]);
    // Restore
    cache.restore(snap);
    // Should be deep-equal to original
    expect(registry.get('foo', 'bar')).toEqual({ bar: 1, baz: [2, 3] });
    // Mutate registry after restore, snapshot should not change
    registry.get('foo', 'bar').bar = 42;
    expect(snap.foo.bar.bar).toBe(1);
  });
}); 