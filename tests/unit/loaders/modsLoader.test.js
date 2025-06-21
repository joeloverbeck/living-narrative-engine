// Jest is assumed as the test runner

describe('ModsLoader', () => {
  it('calls cache.clear once (pre) when loadMods is called', async () => {
    const clearSpy = jest.fn();
    const cache = { clear: clearSpy, snapshot: jest.fn(), restore: jest.fn() };
    const session = { run: jest.fn().mockRejectedValue(new Error('fail')) };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const registry = { store: jest.fn(), get: jest.fn(), clear: jest.fn() };
    const { default: ModsLoader } = await import('../../../src/loaders/modsLoader.js');
    const loader = new ModsLoader({ logger, cache, session, registry });
    await expect(loader.loadMods('foo', ['bar'])).rejects.toThrow('fail');
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('calls cache.clear once (pre) on success and returns LoadReport', async () => {
    const clearSpy = jest.fn();
    const cache = { clear: clearSpy, snapshot: jest.fn(), restore: jest.fn() };
    const mockContext = {
      worldName: 'foo',
      requestedMods: ['bar'],
      finalModOrder: [],
      incompatibilities: 0,
      totals: {},
      registry: { store: jest.fn(), get: jest.fn(), clear: jest.fn() },
    };
    const session = { run: jest.fn().mockResolvedValue(mockContext) };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const registry = { store: jest.fn(), get: jest.fn(), clear: jest.fn() };
    const { default: ModsLoader } = await import('../../../src/loaders/modsLoader.js');
    const loader = new ModsLoader({ logger, cache, session, registry });
    const result = await loader.loadMods('foo', ['bar']);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      finalModOrder: [],
      totals: {},
      incompatibilities: 0,
    });
  });

  it('calls session.run with the correct context', async () => {
    const cache = { clear: jest.fn(), snapshot: jest.fn(), restore: jest.fn() };
    const mockContext = {
      worldName: 'foo',
      requestedMods: ['bar'],
      finalModOrder: [],
      incompatibilities: 0,
      totals: {},
      registry: { store: jest.fn(), get: jest.fn(), clear: jest.fn() },
    };
    const session = { run: jest.fn().mockResolvedValue(mockContext) };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const registry = { store: jest.fn(), get: jest.fn(), clear: jest.fn() };
    const { default: ModsLoader } = await import('../../../src/loaders/modsLoader.js');
    const loader = new ModsLoader({ logger, cache, session, registry });
    const worldName = 'foo';
    const requestedMods = ['bar'];
    await loader.loadMods(worldName, requestedMods);
    expect(session.run).toHaveBeenCalledWith({
      worldName,
      requestedMods,
      finalModOrder: [],
      incompatibilities: 0,
      totals: {},
      registry,
    });
  });

  it('returns LoadReport with correct structure when session completes successfully', async () => {
    const cache = { clear: jest.fn(), snapshot: jest.fn(), restore: jest.fn() };
    const mockContext = {
      worldName: 'test-world',
      requestedMods: ['mod1', 'mod2'],
      finalModOrder: ['mod1', 'mod2'],
      incompatibilities: 1,
      totals: { schemas: { count: 5, overrides: 0, errors: 0 } },
      registry: { store: jest.fn(), get: jest.fn(), clear: jest.fn() },
    };
    const session = { run: jest.fn().mockImplementation(async (ctx) => {
      // Simulate the session modifying the context
      ctx.finalModOrder = mockContext.finalModOrder;
      ctx.incompatibilities = mockContext.incompatibilities;
      ctx.totals = mockContext.totals;
      return ctx;
    }) };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const registry = { store: jest.fn(), get: jest.fn(), clear: jest.fn() };
    const { default: ModsLoader } = await import('../../../src/loaders/modsLoader.js');
    const loader = new ModsLoader({ logger, cache, session, registry });
    
    const result = await loader.loadMods('test-world', ['mod1', 'mod2']);
    
    expect(result).toEqual({
      finalModOrder: ['mod1', 'mod2'],
      totals: { schemas: { count: 5, overrides: 0, errors: 0 } },
      incompatibilities: 1,
    });
    
    // Verify the returned object is immutable
    expect(Object.isFrozen(result.totals)).toBe(true);
    expect(Array.isArray(result.finalModOrder)).toBe(true);
  });
}); 