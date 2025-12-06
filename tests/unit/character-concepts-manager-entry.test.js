import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  it,
  expect,
  jest,
} from '@jest/globals';

jest.mock('../../src/character-concepts-manager-main.js', () => ({
  __esModule: true,
  initializeApp: jest.fn(),
}));

let readyStateValue = 'complete';
const originalDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'readyState'
);

const setReadyState = (value) => {
  readyStateValue = value;
};

beforeAll(() => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => readyStateValue,
  });
});

afterAll(() => {
  if (originalDescriptor) {
    Object.defineProperty(document, 'readyState', originalDescriptor);
  } else {
    delete document.readyState;
  }
});

describe('character-concepts-manager-entry', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    setReadyState('complete');
  });

  it('initializes immediately when the DOM is already ready', async () => {
    const { initializeApp } = await import(
      '../../src/character-concepts-manager-main.js'
    );
    initializeApp.mockResolvedValue();
    setReadyState('complete');

    await import('../../src/character-concepts-manager-entry.js');
    // Allow queued microtasks to run so the promise chain resolves
    await Promise.resolve();

    expect(initializeApp).toHaveBeenCalledTimes(1);
  });

  it('waits for DOMContentLoaded when the DOM is still loading', async () => {
    const { initializeApp } = await import(
      '../../src/character-concepts-manager-main.js'
    );
    initializeApp.mockResolvedValue();
    setReadyState('loading');

    await import('../../src/character-concepts-manager-entry.js');
    // Module should have registered listener but not called initializer yet
    expect(initializeApp).not.toHaveBeenCalled();

    // Simulate DOM content loading finishing
    setReadyState('interactive');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Flush microtasks queued by waitForDOM
    await Promise.resolve();
    await Promise.resolve();

    expect(initializeApp).toHaveBeenCalledTimes(1);
  });

  it('logs an error when initialization fails', async () => {
    const error = new Error('boom');
    const { initializeApp } = await import(
      '../../src/character-concepts-manager-main.js'
    );
    initializeApp.mockRejectedValue(error);
    setReadyState('complete');

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await import('../../src/character-concepts-manager-entry.js');
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize application:',
      error
    );

    consoleErrorSpy.mockRestore();
  });
});
