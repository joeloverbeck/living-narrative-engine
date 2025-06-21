// Jest is assumed as the test runner

describe('ModsLoader', () => {
  it('calls cache.clear once (pre) when loadMods is called', async () => {
    const clearSpy = jest.fn();
    const cache = { clear: clearSpy, snapshot: jest.fn(), restore: jest.fn() };
    const registry = { store: jest.fn(), get: jest.fn(), clear: jest.fn() };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    // One phase that throws to test finally
    const phases = [
      {
        constructor: { name: 'TestPhase' },
        execute: async () => { throw new Error('fail'); },
      },
    ];
    const { default: ModsLoader } = await import('../../../src/loaders/modsLoader.js');
    const loader = new ModsLoader({ logger, registry, phases, cache });
    await expect(loader.loadMods('foo', ['bar'])).rejects.toThrow('fail');
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('calls cache.clear once (pre) on success', async () => {
    const clearSpy = jest.fn();
    const cache = { clear: clearSpy, snapshot: jest.fn(), restore: jest.fn() };
    const registry = { store: jest.fn(), get: jest.fn(), clear: jest.fn() };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    // One phase that succeeds
    const phases = [
      {
        constructor: { name: 'TestPhase' },
        execute: async () => {},
      },
    ];
    const { default: ModsLoader } = await import('../../../src/loaders/modsLoader.js');
    const loader = new ModsLoader({ logger, registry, phases, cache });
    await loader.loadMods('foo', ['bar']);
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
}); 