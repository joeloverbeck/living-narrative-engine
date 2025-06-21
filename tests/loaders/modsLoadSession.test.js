const ModsLoadSession = require('../../src/loaders/ModsLoadSession.js').default;

describe('ModsLoadSession', () => {
  it('executes phases in order', async () => {
    const callOrder = [];
    const ctx = { foo: 'bar' };
    // Stub phases
    const phase1 = {
      name: 'P1',
      execute: async (context) => {
        callOrder.push('P1');
        return context;
      },
    };
    const phase2 = {
      name: 'P2',
      execute: async (context) => {
        callOrder.push('P2');
        return context;
      },
    };
    // Fake cache
    const fakeCache = {
      clear: () => {},
      snapshot: () => ({}),
      restore: () => {},
    };
    // Null logger
    const nullLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const session = new ModsLoadSession({
      phases: [phase1, phase2],
      cache: fakeCache,
      logger: nullLogger,
    });
    await session.run(ctx);
    expect(callOrder).toEqual(['P1', 'P2']);
  });
});
