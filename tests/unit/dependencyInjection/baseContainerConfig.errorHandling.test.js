import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const registrationModulePaths = {
  registerLoaders:
    '../../../src/dependencyInjection/registrations/loadersRegistrations.js',
  registerInfrastructure:
    '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js',
  registerActionTracing:
    '../../../src/dependencyInjection/registrations/actionTracingRegistrations.js',
  registerPersistence:
    '../../../src/dependencyInjection/registrations/persistenceRegistrations.js',
  registerWorldAndEntity:
    '../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js',
  registerPipelineServices:
    '../../../src/dependencyInjection/registrations/pipelineServiceRegistrations.js',
  registerCommandAndAction:
    '../../../src/dependencyInjection/registrations/commandAndActionRegistrations.js',
  registerInterpreters:
    '../../../src/dependencyInjection/registrations/interpreterRegistrations.js',
  registerEventBusAdapters:
    '../../../src/dependencyInjection/registrations/eventBusAdapterRegistrations.js',
  registerInitializers:
    '../../../src/dependencyInjection/registrations/initializerRegistrations.js',
  registerRuntime:
    '../../../src/dependencyInjection/registrations/runtimeRegistrations.js',
  registerGoapServices:
    '../../../src/dependencyInjection/registrations/goapRegistrations.js',
  registerCombatServices:
    '../../../src/dependencyInjection/registrations/combatRegistrations.js',
  registerActionCategorization:
    '../../../src/dependencyInjection/registrations/actionCategorizationRegistrations.js',
  registerTurnLifecycle:
    '../../../src/dependencyInjection/registrations/turnLifecycleRegistrations.js',
  registerOrchestration:
    '../../../src/dependencyInjection/registrations/orchestrationRegistrations.js',
  registerCharacterBuilder:
    '../../../src/dependencyInjection/registrations/characterBuilderRegistrations.js',
};

const aiRegistrationModulePath =
  '../../../src/dependencyInjection/registrations/aiRegistrations.js';

/**
 * @description Dynamically imports the base container configuration module with mocked registrations.
 * @param {object} [options] - Configuration for the mocked import.
 * @param {string} [options.failKey] - Registration mock key that should throw during configuration.
 * @param {Error} [options.failureError] - Error instance to throw from the targeted mock.
 * @returns {Promise<{configureBaseContainer: Function, registrationMocks: Record<string, jest.Mock>}>}
 */
async function importBaseContainerWithMocks({ failKey, failureError } = {}) {
  const registrationMocks = Object.fromEntries(
    Object.keys(registrationModulePaths).map((key) => [key, jest.fn(() => undefined)])
  );

  const aiRegistrationMocks = {
    registerAI: jest.fn(() => undefined),
    registerMinimalAIForCharacterBuilder: jest.fn(() => undefined),
  };

  if (failKey) {
    if (registrationMocks[failKey]) {
      registrationMocks[failKey].mockImplementation(() => {
        throw failureError;
      });
    } else if (aiRegistrationMocks[failKey]) {
      aiRegistrationMocks[failKey].mockImplementation(() => {
        throw failureError;
      });
    } else {
      throw new Error(`Unknown registration key: ${failKey}`);
    }
  }

  await Promise.all(
    Object.entries(registrationModulePaths).map(([key, path]) =>
      jest.doMock(path, () => ({
        __esModule: true,
        [key]: registrationMocks[key],
      }))
    )
  );

  jest.doMock(aiRegistrationModulePath, () => ({
    __esModule: true,
    ...aiRegistrationMocks,
  }));

  const module = await import('../../../src/dependencyInjection/baseContainerConfig.js');

  return {
    configureBaseContainer: module.configureBaseContainer,
    registrationMocks: { ...registrationMocks, ...aiRegistrationMocks },
  };
}

const failureScenarios = [
  {
    key: 'registerLoaders',
    messagePrefix: 'Failed to register loaders',
  },
  {
    key: 'registerInfrastructure',
    messagePrefix: 'Failed to register infrastructure',
  },
  {
    key: 'registerActionTracing',
    messagePrefix: 'Failed to register action tracing',
  },
  {
    key: 'registerPersistence',
    messagePrefix: 'Failed to register persistence',
  },
  {
    key: 'registerWorldAndEntity',
    messagePrefix: 'Failed to register world and entity',
  },
  {
    key: 'registerPipelineServices',
    messagePrefix: 'Failed to register pipeline services',
  },
  {
    key: 'registerCommandAndAction',
    messagePrefix: 'Failed to register command and action',
  },
  {
    key: 'registerInterpreters',
    messagePrefix: 'Failed to register interpreters',
  },
  {
    key: 'registerGoapServices',
    messagePrefix: 'Failed to register GOAP services',
  },
  {
    key: 'registerCombatServices',
    messagePrefix: 'Failed to register combat services',
  },
  {
    key: 'registerActionCategorization',
    messagePrefix: 'Failed to register action categorization services',
  },
];

describe('configureBaseContainer error handling', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(failureScenarios)(
    'throws descriptive error and logs when $key fails',
    async ({ key, messagePrefix }) => {
      const failureError = new Error(`${key} failure`);
      const { configureBaseContainer } = await importBaseContainerWithMocks({
        failKey: key,
        failureError,
      });

      const container = {};
      const logger = {
        debug: jest.fn(),
        error: jest.fn(),
      };

      await expect(
        configureBaseContainer(container, { logger })
      ).rejects.toThrow(`${messagePrefix}: ${failureError.message}`);

      expect(logger.error).toHaveBeenCalledWith(
        `[BaseContainerConfig] ${messagePrefix}: ${failureError.message}`,
        failureError
      );

      expect(logger.error).toHaveBeenCalledWith(
        '[BaseContainerConfig] Configuration failed:',
        expect.any(Error)
      );
    }
  );

  it('logs to console when configuration fails without a logger', async () => {
    const failureError = new Error('loader failure');
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const { configureBaseContainer } = await importBaseContainerWithMocks({
      failKey: 'registerLoaders',
      failureError,
    });

    await expect(configureBaseContainer({}, {})).rejects.toThrow(
      `Failed to register loaders: ${failureError.message}`
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BaseContainerConfig] Configuration failed:',
      expect.any(Error)
    );
  });
});
