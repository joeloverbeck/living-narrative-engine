/**
 * @file Unit tests for registerCharacterBuilder dependency registrations.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { actionTracingTokens } from '../../../src/dependencyInjection/tokens/actionTracingTokens.js';

const createClassMock = (name) =>
  jest.fn().mockImplementation((config) => ({ __mockName: name, config }));

jest.mock('../../../src/characterBuilder/storage/characterDatabase.js', () => ({
  CharacterDatabase: createClassMock('CharacterDatabase'),
}));
jest.mock(
  '../../../src/characterBuilder/services/characterStorageService.js',
  () => ({
    CharacterStorageService: createClassMock('CharacterStorageService'),
  })
);
jest.mock(
  '../../../src/characterBuilder/services/thematicDirectionGenerator.js',
  () => ({
    ThematicDirectionGenerator: createClassMock('ThematicDirectionGenerator'),
  })
);
jest.mock('../../../src/characterBuilder/services/ClicheGenerator.js', () => ({
  ClicheGenerator: createClassMock('ClicheGenerator'),
}));
jest.mock(
  '../../../src/characterBuilder/services/CoreMotivationsGenerator.js',
  () => ({
    CoreMotivationsGenerator: createClassMock('CoreMotivationsGenerator'),
  })
);
jest.mock(
  '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js',
  () => ({
    CoreMotivationsDisplayEnhancer: createClassMock(
      'CoreMotivationsDisplayEnhancer'
    ),
  })
);
jest.mock('../../../src/characterBuilder/services/TraitsGenerator.js', () => ({
  TraitsGenerator: createClassMock('TraitsGenerator'),
}));
jest.mock(
  '../../../src/characterBuilder/services/TraitsDisplayEnhancer.js',
  () => ({
    TraitsDisplayEnhancer: createClassMock('TraitsDisplayEnhancer'),
  })
);
jest.mock(
  '../../../src/characterBuilder/services/SpeechPatternsGenerator.js',
  () => ({
    SpeechPatternsGenerator: createClassMock('SpeechPatternsGenerator'),
  })
);
jest.mock(
  '../../../src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js',
  () => ({
    SpeechPatternsDisplayEnhancer: createClassMock(
      'SpeechPatternsDisplayEnhancer'
    ),
  })
);
jest.mock(
  '../../../src/characterBuilder/services/SpeechPatternsResponseProcessor.js',
  () => ({
    SpeechPatternsResponseProcessor: createClassMock(
      'SpeechPatternsResponseProcessor'
    ),
  })
);
jest.mock(
  '../../../src/characterBuilder/services/TraitsRewriterGenerator.js',
  () => ({
    TraitsRewriterGenerator: createClassMock('TraitsRewriterGenerator'),
  })
);
jest.mock(
  '../../../src/characterBuilder/services/TraitsRewriterResponseProcessor.js',
  () => ({
    TraitsRewriterResponseProcessor: createClassMock(
      'TraitsRewriterResponseProcessor'
    ),
  })
);
jest.mock(
  '../../../src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js',
  () => ({
    TraitsRewriterDisplayEnhancer: createClassMock(
      'TraitsRewriterDisplayEnhancer'
    ),
  })
);
jest.mock(
  '../../../src/characterBuilder/services/characterBuilderService.js',
  () => ({
    CharacterBuilderService: createClassMock('CharacterBuilderService'),
  })
);

import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { ThematicDirectionGenerator } from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import { ClicheGenerator } from '../../../src/characterBuilder/services/ClicheGenerator.js';
import { CoreMotivationsGenerator } from '../../../src/characterBuilder/services/CoreMotivationsGenerator.js';
import { CoreMotivationsDisplayEnhancer } from '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';
import { TraitsGenerator } from '../../../src/characterBuilder/services/TraitsGenerator.js';
import { TraitsDisplayEnhancer } from '../../../src/characterBuilder/services/TraitsDisplayEnhancer.js';
import { SpeechPatternsGenerator } from '../../../src/characterBuilder/services/SpeechPatternsGenerator.js';
import { SpeechPatternsDisplayEnhancer } from '../../../src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js';
import { SpeechPatternsResponseProcessor } from '../../../src/characterBuilder/services/SpeechPatternsResponseProcessor.js';
import { TraitsRewriterGenerator } from '../../../src/characterBuilder/services/TraitsRewriterGenerator.js';
import { TraitsRewriterResponseProcessor } from '../../../src/characterBuilder/services/TraitsRewriterResponseProcessor.js';
import { TraitsRewriterDisplayEnhancer } from '../../../src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { registerCharacterBuilder } from '../../../src/dependencyInjection/registrations/characterBuilderRegistrations.js';

class TestContainer {
  constructor(registrationMap, baseDependencies) {
    this.registrationMap = registrationMap;
    this.cache = new Map(baseDependencies);
  }

  resolve(token) {
    if (this.cache.has(token)) {
      return this.cache.get(token);
    }

    const registration = this.registrationMap.get(token);
    if (!registration) {
      throw new Error(`No registration found for token ${String(token)}`);
    }

    const instance = registration.factory(this);
    this.cache.set(token, instance);
    return instance;
  }
}

describe('registerCharacterBuilder', () => {
  let logger;
  let container;

  const createBaseDependencies = () => {
    const llmJsonService = { service: 'llmJsonService' };
    const llmStrategyFactory = { service: 'llmStrategyFactory' };
    const llmConfigManager = { service: 'llmConfigManager' };
    const eventBus = { service: 'eventBus' };
    const tokenEstimator = { service: 'tokenEstimator' };
    const schemaValidator = { service: 'schemaValidator' };
    const retryManager = { service: 'retryManager' };

    return {
      map: new Map([
        [tokens.ILogger, logger],
        [tokens.LlmJsonService, llmJsonService],
        [tokens.LLMAdapter, llmStrategyFactory],
        [tokens.ILLMConfigurationManager, llmConfigManager],
        [tokens.ISafeEventDispatcher, eventBus],
        [tokens.ITokenEstimator, tokenEstimator],
        [tokens.ISchemaValidator, schemaValidator],
        [actionTracingTokens.IRetryManager, retryManager],
      ]),
      values: {
        logger,
        llmJsonService,
        llmStrategyFactory,
        llmConfigManager,
        eventBus,
        tokenEstimator,
        schemaValidator,
        retryManager,
      },
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { debug: jest.fn() };
    container = {
      register: jest.fn(),
      resolve: jest.fn((token) => {
        if (token === tokens.ILogger) {
          return logger;
        }
        throw new Error(`Unexpected resolve call for token ${String(token)}`);
      }),
    };
  });

  it('registers and wires all character builder services', () => {
    registerCharacterBuilder(container);

    expect(container.resolve).toHaveBeenCalledTimes(1);
    expect(container.resolve).toHaveBeenCalledWith(tokens.ILogger);
    // Production code now registers 24 services:
    // 8 infrastructure (AsyncUtilitiesToolkit, DOMElementManager, EventListenerRegistry,
    //                   ControllerLifecycleOrchestrator, ErrorHandlingStrategy, PerformanceMonitor,
    //                   ValidationService, MemoryManager)
    // 2 storage (CharacterDatabase, CharacterStorageService)
    // 14 character builder services (ThematicDirectionGenerator, ClicheGenerator, CoreMotivationsGenerator,
    //                                 CoreMotivationsDisplayEnhancer, TraitsGenerator, TraitsDisplayEnhancer,
    //                                 SpeechPatternsResponseProcessor, SpeechPatternsGenerator, SpeechPatternsDisplayEnhancer,
    //                                 TraitsRewriterGenerator, TraitsRewriterResponseProcessor, TraitsRewriterDisplayEnhancer,
    //                                 CharacterBuilderService, ICharacterBuilderService)
    expect(container.register).toHaveBeenCalledTimes(24);
    container.register.mock.calls.forEach(([, , options]) => {
      expect(options).toEqual({ lifecycle: 'singletonFactory' });
    });

    // Debug call count: 1 start + 8 infrastructure + 2 storage + 13 character builder + 1 complete
    // (CharacterBuilderService and ICharacterBuilderService share 1 debug call)
    // = 25 total debug calls
    expect(logger.debug).toHaveBeenCalledTimes(25);
    expect(logger.debug.mock.calls[0][0]).toContain('Starting');
    expect(logger.debug.mock.calls.at(-1)[0]).toContain(
      'All registrations complete'
    );

    const registrationMap = new Map(
      container.register.mock.calls.map(([token, factory, options]) => [
        token,
        { factory, options },
      ])
    );

    const { map: baseDependencyMap, values: baseDeps } =
      createBaseDependencies();
    const testContainer = new TestContainer(registrationMap, baseDependencyMap);

    const resolvedServices = new Map();
    const tokensToResolve = [
      tokens.CharacterDatabase,
      tokens.CharacterStorageService,
      tokens.ThematicDirectionGenerator,
      tokens.ClicheGenerator,
      tokens.CoreMotivationsGenerator,
      tokens.CoreMotivationsDisplayEnhancer,
      tokens.TraitsGenerator,
      tokens.TraitsDisplayEnhancer,
      tokens.SpeechPatternsResponseProcessor,
      tokens.SpeechPatternsGenerator,
      tokens.SpeechPatternsDisplayEnhancer,
      tokens.TraitsRewriterGenerator,
      tokens.TraitsRewriterResponseProcessor,
      tokens.TraitsRewriterDisplayEnhancer,
      tokens.CharacterBuilderService,
      tokens.ICharacterBuilderService,
    ];

    tokensToResolve.forEach((token) => {
      resolvedServices.set(token, testContainer.resolve(token));
    });

    expect(CharacterDatabase).toHaveBeenCalledTimes(1);
    expect(CharacterDatabase).toHaveBeenCalledWith({ logger: baseDeps.logger });

    expect(CharacterStorageService).toHaveBeenCalledTimes(1);
    expect(CharacterStorageService).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      database: resolvedServices.get(tokens.CharacterDatabase),
      schemaValidator: baseDeps.schemaValidator,
    });

    expect(ThematicDirectionGenerator).toHaveBeenCalledTimes(1);
    expect(ThematicDirectionGenerator).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      llmJsonService: baseDeps.llmJsonService,
      llmStrategyFactory: baseDeps.llmStrategyFactory,
      llmConfigManager: baseDeps.llmConfigManager,
    });

    expect(ClicheGenerator).toHaveBeenCalledTimes(1);
    expect(ClicheGenerator).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      llmJsonService: baseDeps.llmJsonService,
      llmStrategyFactory: baseDeps.llmStrategyFactory,
      llmConfigManager: baseDeps.llmConfigManager,
    });

    expect(CoreMotivationsGenerator).toHaveBeenCalledTimes(1);
    expect(CoreMotivationsGenerator).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      llmJsonService: baseDeps.llmJsonService,
      llmStrategyFactory: baseDeps.llmStrategyFactory,
      llmConfigManager: baseDeps.llmConfigManager,
      eventBus: baseDeps.eventBus,
      tokenEstimator: baseDeps.tokenEstimator,
    });

    expect(CoreMotivationsDisplayEnhancer).toHaveBeenCalledTimes(1);
    expect(CoreMotivationsDisplayEnhancer).toHaveBeenCalledWith({
      logger: baseDeps.logger,
    });

    expect(TraitsGenerator).toHaveBeenCalledTimes(1);
    expect(TraitsGenerator).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      llmJsonService: baseDeps.llmJsonService,
      llmStrategyFactory: baseDeps.llmStrategyFactory,
      llmConfigManager: baseDeps.llmConfigManager,
      eventBus: baseDeps.eventBus,
      tokenEstimator: baseDeps.tokenEstimator,
      retryManager: baseDeps.retryManager,
    });

    expect(TraitsDisplayEnhancer).toHaveBeenCalledTimes(1);
    expect(TraitsDisplayEnhancer).toHaveBeenCalledWith({
      logger: baseDeps.logger,
    });

    expect(SpeechPatternsResponseProcessor).toHaveBeenCalledTimes(1);
    expect(SpeechPatternsResponseProcessor).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      llmJsonService: baseDeps.llmJsonService,
      schemaValidator: baseDeps.schemaValidator,
    });

    expect(SpeechPatternsGenerator).toHaveBeenCalledTimes(1);
    expect(SpeechPatternsGenerator).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      llmJsonService: baseDeps.llmJsonService,
      llmStrategyFactory: baseDeps.llmStrategyFactory,
      llmConfigManager: baseDeps.llmConfigManager,
      eventBus: baseDeps.eventBus,
      tokenEstimator: baseDeps.tokenEstimator,
      schemaValidator: baseDeps.schemaValidator,
    });

    expect(SpeechPatternsDisplayEnhancer).toHaveBeenCalledTimes(1);
    expect(SpeechPatternsDisplayEnhancer).toHaveBeenCalledWith({
      logger: baseDeps.logger,
    });

    expect(TraitsRewriterGenerator).toHaveBeenCalledTimes(1);
    expect(TraitsRewriterGenerator).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      llmJsonService: baseDeps.llmJsonService,
      llmStrategyFactory: baseDeps.llmStrategyFactory,
      llmConfigManager: baseDeps.llmConfigManager,
      eventBus: baseDeps.eventBus,
      tokenEstimator: baseDeps.tokenEstimator,
    });

    expect(TraitsRewriterResponseProcessor).toHaveBeenCalledTimes(1);
    expect(TraitsRewriterResponseProcessor).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      llmJsonService: baseDeps.llmJsonService,
      schemaValidator: baseDeps.schemaValidator,
    });

    expect(TraitsRewriterDisplayEnhancer).toHaveBeenCalledTimes(1);
    expect(TraitsRewriterDisplayEnhancer).toHaveBeenCalledWith({
      logger: baseDeps.logger,
    });

    expect(CharacterBuilderService).toHaveBeenCalledTimes(1);
    expect(CharacterBuilderService).toHaveBeenCalledWith({
      logger: baseDeps.logger,
      storageService: resolvedServices.get(tokens.CharacterStorageService),
      directionGenerator: resolvedServices.get(
        tokens.ThematicDirectionGenerator
      ),
      eventBus: baseDeps.eventBus,
      database: resolvedServices.get(tokens.CharacterDatabase),
      schemaValidator: baseDeps.schemaValidator,
      clicheGenerator: resolvedServices.get(tokens.ClicheGenerator),
      traitsGenerator: resolvedServices.get(tokens.TraitsGenerator),
      speechPatternsGenerator: resolvedServices.get(
        tokens.SpeechPatternsGenerator
      ),
    });

    expect(resolvedServices.get(tokens.ICharacterBuilderService)).toBe(
      resolvedServices.get(tokens.CharacterBuilderService)
    );
  });
});
