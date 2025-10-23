/**
 * @file Integration tests for initializeAnatomyFormattingStage using real container and services.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { initializeAnatomyFormattingStage } from '../../../src/bootstrapper/stages/anatomyFormattingStage.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';
import EventBus from '../../../src/events/eventBus.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import StageError from '../../../src/bootstrapper/StageError.js';

const FINAL_MOD_ORDER_KEY = 'final_mod_order';

/**
 * @returns {{logger: any}} Logger that records structured log arguments by level.
 */
function createCapturingLogger() {
  const entries = { info: [], debug: [], warn: [], error: [] };
  const logger = {
    info: (...args) => entries.info.push(args),
    debug: (...args) => entries.debug.push(args),
    warn: (...args) => entries.warn.push(args),
    error: (...args) => entries.error.push(args),
    entries,
  };
  return logger;
}

describe('initializeAnatomyFormattingStage integration', () => {
  let container;
  let registrar;
  let logger;
  let dataRegistry;
  let safeEventDispatcher;

  beforeEach(() => {
    container = new AppContainer();
    registrar = new Registrar(container);
    logger = createCapturingLogger();

    dataRegistry = new InMemoryDataRegistry({ logger });
    const eventBus = new EventBus({ logger });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: eventBus,
      logger,
    });

    registrar.instance(tokens.ILogger, logger);
    registrar.instance(tokens.IDataRegistry, dataRegistry);
    registrar.instance(tokens.ISafeEventDispatcher, safeEventDispatcher);
  });

  /**
   * Registers the real AnatomyFormattingService using the prepared dependencies.
   */
  function registerAnatomyFormattingService() {
    registrar.singletonFactory(tokens.AnatomyFormattingService, () =>
      new AnatomyFormattingService({
        dataRegistry,
        logger,
        safeEventDispatcher,
      })
    );
  }

  it('initializes the real AnatomyFormattingService and merges mod configuration', async () => {
    registerAnatomyFormattingService();

    const modLoadOrder = ['baseMod', 'addonMod'];
    dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, modLoadOrder);

    dataRegistry.store('anatomyFormatting', 'base-config', {
      id: 'base-config',
      _modId: 'baseMod',
      descriptionOrder: ['torso', 'head'],
      groupedParts: ['arms'],
      pairedParts: ['eyes'],
      irregularPlurals: { foot: 'feet' },
      noArticleParts: ['torso'],
      descriptorOrder: ['size', 'tone'],
      descriptorValueKeys: ['value'],
      equipmentIntegration: {
        enabled: true,
        prefix: 'Core: ',
        itemSeparator: ' & ',
      },
    });

    dataRegistry.store('anatomyFormatting', 'addon-config', {
      id: 'addon-config',
      _modId: 'addonMod',
      descriptionOrder: ['wings', 'torso'],
      groupedParts: ['wings'],
      pairedParts: ['wings'],
      irregularPlurals: { tooth: 'teeth' },
      noArticleParts: ['wings'],
      descriptorOrder: ['color'],
      descriptorValueKeys: ['shade'],
      equipmentIntegration: {
        suffix: '!',
        placement: 'before_anatomy',
      },
      mergeStrategy: {
        replaceArrays: true,
      },
    });

    const result = await initializeAnatomyFormattingStage(
      container,
      logger,
      tokens
    );

    expect(result.success).toBe(true);
    const service = result.payload.anatomyFormattingService;
    expect(service).toBe(container.resolve(tokens.AnatomyFormattingService));

    expect(service.getDescriptionOrder()).toEqual(['wings', 'torso']);
    expect([...service.getGroupedParts()]).toEqual(['wings']);
    expect([...service.getPairedParts()]).toEqual(['wings']);
    expect(service.getIrregularPlurals()).toEqual({
      foot: 'feet',
      tooth: 'teeth',
    });
    expect([...service.getNoArticleParts()]).toEqual(['wings']);
    expect(service.getDescriptorOrder()).toEqual(['color']);
    expect(service.getDescriptorValueKeys()).toEqual(['shade']);
    expect(service.getEquipmentIntegrationConfig()).toEqual({
      enabled: true,
      prefix: 'Core: ',
      suffix: '!',
      itemSeparator: ' & ',
      placement: 'before_anatomy',
    });

    const infoMessages = logger.entries.info.map((args) => args[0]);
    expect(infoMessages).toContain(
      'Bootstrap Stage: Starting Anatomy Formatting Service Initialization...'
    );
    expect(infoMessages).toContain(
      'Bootstrap Stage: Anatomy Formatting Service Initialization completed successfully.'
    );
  });

  it('wraps initialization failures in a StageError and surfaces context', async () => {
    class ExplodingAnatomyFormattingService extends AnatomyFormattingService {
      initialize() {
        super.initialize();
        throw new Error('Injected failure for stage coverage');
      }
    }

    registrar.singletonFactory(tokens.AnatomyFormattingService, () =>
      new ExplodingAnatomyFormattingService({
        dataRegistry,
        logger,
        safeEventDispatcher,
      })
    );

    dataRegistry.store('meta', FINAL_MOD_ORDER_KEY, ['onlyMod']);
    dataRegistry.store('anatomyFormatting', 'only-config', {
      id: 'only-config',
      _modId: 'onlyMod',
      descriptionOrder: ['torso'],
      descriptorOrder: ['size'],
      descriptorValueKeys: ['value'],
      groupedParts: [],
      pairedParts: ['arms'],
      irregularPlurals: {},
      noArticleParts: [],
    });

    const result = await initializeAnatomyFormattingStage(
      container,
      logger,
      tokens
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.phase).toBe('Anatomy Formatting Service Initialization');
    expect(result.error.message).toContain(
      'Failed to initialize AnatomyFormattingService: Injected failure for stage coverage'
    );
    expect(result.error.cause).toBeInstanceOf(Error);
    expect(result.error.cause.message).toBe('Injected failure for stage coverage');

    const errorLog = logger.entries.error.find(
      ([message]) =>
        typeof message === 'string' &&
        message.includes('Bootstrap Stage: Anatomy Formatting Service Initialization failed.')
    );
    expect(errorLog).toBeTruthy();
    expect(errorLog[1]).toBeInstanceOf(Error);
  });

  it('surfaces a StageError when the container resolves an invalid service instance', async () => {
    registrar.singletonFactory(tokens.AnatomyFormattingService, () => null);

    const result = await initializeAnatomyFormattingStage(
      container,
      logger,
      tokens
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.message).toContain(
      'Failed to initialize AnatomyFormattingService: AnatomyFormattingService resolved to an invalid object.'
    );

    const [errorMessage, errorValue] = logger.entries.error[0];
    expect(typeof errorMessage).toBe('string');
    expect(errorMessage).toContain(
      'Bootstrap Stage: Anatomy Formatting Service Initialization failed.'
    );
    expect(errorValue).toBeInstanceOf(Error);
  });
});
