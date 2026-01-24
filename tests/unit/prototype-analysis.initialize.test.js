import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockBootstrap = jest.fn();
const mockDisplayFatalStartupError = jest.fn();
const mockRegisterExpressionServices = jest.fn();
const mockRegisterExpressionDiagnosticsServices = jest.fn();
const mockRegisterPrototypeOverlapServices = jest.fn();

const mockTokens = {
  ILogger: 'ILogger',
};

const mockDiagnosticsTokens = {
  IPrototypeAnalysisController: 'IPrototypeAnalysisController',
};

jest.mock('../../src/bootstrapper/CommonBootstrapper.js', () => ({
  __esModule: true,
  CommonBootstrapper: jest.fn().mockImplementation(() => ({
    bootstrap: mockBootstrap,
    displayFatalStartupError: mockDisplayFatalStartupError,
  })),
}));

jest.mock(
  '../../src/dependencyInjection/registrations/expressionsRegistrations.js',
  () => ({
    __esModule: true,
    registerExpressionServices: mockRegisterExpressionServices,
  })
);

jest.mock(
  '../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js',
  () => ({
    __esModule: true,
    registerExpressionDiagnosticsServices:
      mockRegisterExpressionDiagnosticsServices,
  })
);

jest.mock(
  '../../src/dependencyInjection/registrations/prototypeOverlapRegistrations.js',
  () => ({
    __esModule: true,
    registerPrototypeOverlapServices: mockRegisterPrototypeOverlapServices,
  })
);

jest.mock('../../src/utils/environmentUtils.js', () => ({
  shouldAutoInitializeDom: jest.fn(() => false),
}));

jest.mock('../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: mockTokens,
}));

jest.mock('../../src/dependencyInjection/tokens/tokens-diagnostics.js', () => ({
  __esModule: true,
  diagnosticsTokens: mockDiagnosticsTokens,
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockBootstrap.mockImplementation(() => {
    throw new Error('bootstrap mock not configured for this test');
  });
});

describe('prototype-analysis initialize', () => {
  it('registers diagnostics once and avoids duplicate prototype overlap registrations', async () => {
    const logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    const controller = { initialize: jest.fn() };

    const container = {
      resolve: jest.fn((token) => {
        if (token === mockTokens.ILogger) {
          return logger;
        }
        if (token === mockDiagnosticsTokens.IPrototypeAnalysisController) {
          return controller;
        }
        throw new Error(`Unexpected token: ${String(token)}`);
      }),
    };

    mockBootstrap.mockImplementation(async ({ postInitHook, ...options }) => {
      expect(options).toEqual(
        expect.objectContaining({
          containerConfigType: 'minimal',
          worldName: 'default',
        })
      );

      await postInitHook({ logger }, container);
      return { container, services: { logger } };
    });

    const { initialize } = await import('../../src/prototype-analysis.js');
    await initialize();

    expect(mockRegisterExpressionServices).toHaveBeenCalledWith(container);
    expect(mockRegisterExpressionDiagnosticsServices).toHaveBeenCalledWith(
      container
    );
    expect(mockRegisterPrototypeOverlapServices).not.toHaveBeenCalled();
    expect(controller.initialize).toHaveBeenCalled();
  });
});
