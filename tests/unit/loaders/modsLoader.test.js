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

  it('calls cache.clear once (pre) on success', async () => {
    const clearSpy = jest.fn();
    const cache = { clear: clearSpy, snapshot: jest.fn(), restore: jest.fn() };
    const session = { run: jest.fn().mockResolvedValue({}) };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const registry = { store: jest.fn(), get: jest.fn(), clear: jest.fn() };
    const { default: ModsLoader } = await import('../../../src/loaders/modsLoader.js');
    const loader = new ModsLoader({ logger, cache, session, registry });
    await loader.loadMods('foo', ['bar']);
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('calls session.run with the correct context', async () => {
    const cache = { clear: jest.fn(), snapshot: jest.fn(), restore: jest.fn() };
    const session = { run: jest.fn().mockResolvedValue({}) };
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
}); 