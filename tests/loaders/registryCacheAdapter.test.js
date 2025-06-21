const { makeRegistryCache } = require('../../src/loaders/registryCacheAdapter');

describe('makeRegistryCache', () => {
  it('snapshot/clear/restore round-trip keeps deep-equal data', () => {
    // Fake registry with clear and some data
    const registry = {
      foo: { bar: 1, baz: [2, 3] },
      clear() {
        Object.keys(this).forEach(k => {
          if (k !== 'clear') delete this[k];
        });
      },
    };
    const cache = makeRegistryCache(registry);
    // Take snapshot
    const snap = cache.snapshot();
    // Clear registry
    cache.clear();
    expect(Object.keys(registry)).toEqual(['clear']);
    // Restore
    cache.restore(snap);
    // Should be deep-equal to original
    expect(registry).toEqual({ foo: { bar: 1, baz: [2, 3] }, clear: registry.clear });
    // Changing restored registry does not affect snapshot
    registry.foo.bar = 42;
    expect(snap.foo.bar).toBe(1);
  });
}); 