import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  jest,
} from '@jest/globals';

const mockBootstrap = jest.fn();
const mockDisplayFatalStartupError = jest.fn();
const mockRegisterVisualizerComponents = jest.fn();
const mockRegisterDamageSimulatorComponents = jest.fn();
const mockTokens = {
  ILogger: 'ILogger',
  IRecipeSelectorService: 'IRecipeSelectorService',
  IEntityLoadingService: 'IEntityLoadingService',
  IAnatomyDataExtractor: 'IAnatomyDataExtractor',
  DamageSimulatorUI: 'DamageSimulatorUI',
  DamageHistoryTracker: 'DamageHistoryTracker',
  HierarchicalAnatomyRenderer: 'HierarchicalAnatomyRenderer',
  DamageCapabilityComposer: 'DamageCapabilityComposer',
  DamageExecutionService: 'DamageExecutionService',
};

jest.mock('../../src/bootstrapper/CommonBootstrapper.js', () => ({
  __esModule: true,
  CommonBootstrapper: jest.fn().mockImplementation(() => ({
    bootstrap: mockBootstrap,
    displayFatalStartupError: mockDisplayFatalStartupError,
  })),
}));

jest.mock(
  '../../src/dependencyInjection/registrations/visualizerRegistrations.js',
  () => ({
    __esModule: true,
    registerVisualizerComponents: mockRegisterVisualizerComponents,
  })
);

jest.mock(
  '../../src/dependencyInjection/registrations/damageSimulatorRegistrations.js',
  () => ({
    __esModule: true,
    registerDamageSimulatorComponents: mockRegisterDamageSimulatorComponents,
  })
);

jest.mock('../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: mockTokens,
}));

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'readyState'
);
let mockedReadyState = 'loading';

beforeAll(() => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => mockedReadyState,
  });
});

afterAll(() => {
  if (originalReadyStateDescriptor) {
    Object.defineProperty(document, 'readyState', originalReadyStateDescriptor);
  } else {
    delete document.readyState;
  }
});

beforeEach(() => {
  jest.resetModules();
  mockBootstrap.mockReset();
  mockDisplayFatalStartupError.mockReset();
  mockRegisterVisualizerComponents.mockReset();
  mockRegisterDamageSimulatorComponents.mockReset();
  mockBootstrap.mockImplementation(() => {
    throw new Error('bootstrapMock not implemented for this test');
  });
  document.body.innerHTML = '';
  mockedReadyState = 'loading';
});

afterEach(() => {
  jest.clearAllTimers();
});

describe('damage-simulator initialize', () => {
  it('registers components and logs initialization when DOM is loading', async () => {
    mockedReadyState = 'loading';
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    const mockDamageSimulatorUI = {
      initialize: jest.fn(),
      setChildComponent: jest.fn(),
    };
    const mockHistoryTracker = { render: jest.fn() };
    const mockAnatomyRenderer = { render: jest.fn() };
    const mockDamageComposer = { initialize: jest.fn() };
    const resolvedServices = {
      [mockTokens.IRecipeSelectorService]: { id: 'recipeSelectorService' },
      [mockTokens.IEntityLoadingService]: { id: 'entityLoadingService' },
      [mockTokens.IAnatomyDataExtractor]: { id: 'anatomyDataExtractor' },
      [mockTokens.DamageSimulatorUI]: mockDamageSimulatorUI,
      [mockTokens.DamageHistoryTracker]: () => mockHistoryTracker,
      [mockTokens.HierarchicalAnatomyRenderer]: () => mockAnatomyRenderer,
      [mockTokens.DamageCapabilityComposer]: () => mockDamageComposer,
      [mockTokens.DamageExecutionService]: { applyDamage: jest.fn() },
    };

    const container = {
      resolve: jest.fn((token) => {
        if (!(token in resolvedServices)) {
          throw new Error(`Unexpected token: ${String(token)}`);
        }
        return resolvedServices[token];
      }),
    };

    mockBootstrap.mockImplementation(async ({ postInitHook, ...options }) => {
      expect(options).toEqual(
        expect.objectContaining({
          containerConfigType: 'minimal',
          worldName: 'default',
          includeAnatomyFormatting: true,
        })
      );

      await postInitHook({ logger }, container);

      return {
        container,
        services: { logger },
      };
    });

    const { initialize } = await import('../../src/damage-simulator.js');

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const readyHandler = addEventListenerSpy.mock.calls[0][1];
    await readyHandler();

    // Verify both registration functions were called
    expect(mockRegisterVisualizerComponents).toHaveBeenCalledWith(container);
    expect(mockRegisterDamageSimulatorComponents).toHaveBeenCalledWith(
      container
    );

    // Verify visualizer components are registered before damage simulator components
    const visualizerCallOrder =
      mockRegisterVisualizerComponents.mock.invocationCallOrder[0];
    const damageSimulatorCallOrder =
      mockRegisterDamageSimulatorComponents.mock.invocationCallOrder[0];
    expect(visualizerCallOrder).toBeLessThan(damageSimulatorCallOrder);

    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.IRecipeSelectorService
    );
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.IEntityLoadingService
    );
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.IAnatomyDataExtractor
    );

    expect(logger.info).toHaveBeenCalledWith(
      '[DamageSimulator] Initialized with services:',
      expect.objectContaining({
        recipeSelectorService: true,
        entityLoadingService: true,
        anatomyDataExtractor: true,
      })
    );

    addEventListenerSpy.mockRestore();
    void initialize;
  });

  it('reports a fatal error when initialization fails', async () => {
    mockedReadyState = 'loading';

    const logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    const mockDamageSimulatorUI = {
      initialize: jest.fn(),
      setChildComponent: jest.fn(),
    };
    const mockHistoryTracker = { render: jest.fn() };
    const mockAnatomyRenderer = { render: jest.fn() };
    const mockDamageComposer = { initialize: jest.fn() };
    const resolvedServices = {
      [mockTokens.IRecipeSelectorService]: { id: 'recipeSelectorService' },
      [mockTokens.IEntityLoadingService]: { id: 'entityLoadingService' },
      [mockTokens.IAnatomyDataExtractor]: { id: 'anatomyDataExtractor' },
      [mockTokens.DamageSimulatorUI]: mockDamageSimulatorUI,
      [mockTokens.DamageHistoryTracker]: () => mockHistoryTracker,
      [mockTokens.HierarchicalAnatomyRenderer]: () => mockAnatomyRenderer,
      [mockTokens.DamageCapabilityComposer]: () => mockDamageComposer,
      [mockTokens.DamageExecutionService]: { applyDamage: jest.fn() },
    };

    const container = {
      resolve: jest.fn((token) => {
        if (!(token in resolvedServices)) {
          throw new Error(`Unexpected token: ${String(token)}`);
        }
        return resolvedServices[token];
      }),
    };

    const fatalError = new Error('Initialization failed');

    mockBootstrap.mockImplementation(async ({ postInitHook }) => {
      await postInitHook({ logger }, container);
      throw fatalError;
    });

    const { initialize } = await import('../../src/damage-simulator.js');

    await expect(initialize()).resolves.toBeUndefined();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledWith(
      'Failed to initialize damage simulator: Initialization failed',
      fatalError
    );
  });

  it('immediately initializes when DOM is already ready', async () => {
    mockedReadyState = 'complete';

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    const mockDamageSimulatorUI = {
      initialize: jest.fn(),
      setChildComponent: jest.fn(),
    };
    const mockHistoryTracker = { render: jest.fn() };
    const mockAnatomyRenderer = { render: jest.fn() };
    const mockDamageComposer = { initialize: jest.fn() };
    const resolvedServices = {
      [mockTokens.IRecipeSelectorService]: { id: 'recipeSelectorService' },
      [mockTokens.IEntityLoadingService]: { id: 'entityLoadingService' },
      [mockTokens.IAnatomyDataExtractor]: { id: 'anatomyDataExtractor' },
      [mockTokens.DamageSimulatorUI]: mockDamageSimulatorUI,
      [mockTokens.DamageHistoryTracker]: () => mockHistoryTracker,
      [mockTokens.HierarchicalAnatomyRenderer]: () => mockAnatomyRenderer,
      [mockTokens.DamageCapabilityComposer]: () => mockDamageComposer,
      [mockTokens.DamageExecutionService]: { applyDamage: jest.fn() },
    };

    const container = {
      resolve: jest.fn((token) => {
        if (!(token in resolvedServices)) {
          throw new Error(`Unexpected token: ${String(token)}`);
        }
        return resolvedServices[token];
      }),
    };

    mockBootstrap.mockImplementation(async ({ postInitHook }) => {
      await postInitHook({ logger }, container);
      return {
        container,
        services: { logger },
      };
    });

    await import('../../src/damage-simulator.js');

    await flushPromises();
    await flushPromises();

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.anything()
    );
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    expect(mockRegisterVisualizerComponents).toHaveBeenCalledTimes(1);
    expect(mockRegisterDamageSimulatorComponents).toHaveBeenCalledTimes(1);

    addEventListenerSpy.mockRestore();
  });
});
