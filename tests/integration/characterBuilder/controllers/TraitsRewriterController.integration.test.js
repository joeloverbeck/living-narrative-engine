/**
 * @file Integration tests for the TraitsRewriterController
 * @description Exercises the production controller with real collaborator
 * implementations to verify validation, generation, export, and event flows.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { TraitsRewriterController } from '../../../../src/characterBuilder/controllers/TraitsRewriterController.js';
import { TraitsRewriterGenerator } from '../../../../src/characterBuilder/services/TraitsRewriterGenerator.js';
import { TraitsRewriterDisplayEnhancer } from '../../../../src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js';
import { DOMElementManager } from '../../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../../src/characterBuilder/services/eventListenerRegistry.js';
import { ControllerLifecycleOrchestrator } from '../../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { AsyncUtilitiesToolkit } from '../../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { PerformanceMonitor } from '../../../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../../../src/characterBuilder/services/memoryManager.js';
import { ErrorHandlingStrategy } from '../../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { ValidationService } from '../../../../src/characterBuilder/services/validationService.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

class MinimalCharacterBuilderService {
  constructor(logger) {
    this.logger = logger;
  }

  async initialize() {
    this.logger.debug('MinimalCharacterBuilderService initialized');
  }

  async getAllCharacterConcepts() {
    return [];
  }

  async createCharacterConcept() {
    return { id: 'created' };
  }

  async updateCharacterConcept() {
    return { id: 'updated' };
  }

  async deleteCharacterConcept() {
    return true;
  }

  async getCharacterConcept() {
    return null;
  }

  async generateThematicDirections() {
    return [];
  }

  async getThematicDirections() {
    return [];
  }
}

const flushPromises = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const renderTraitsRewriterDom = () => {
  document.body.innerHTML = `
    <main id="app">
      <section>
        <textarea id="character-definition"></textarea>
        <div id="character-input-error" style="display:none"></div>
        <button id="rewrite-traits-button" class="cb-button cb-button--disabled"></button>
        <button id="export-json-button" style="display:none"></button>
        <button id="export-text-button" style="display:none"></button>
        <button id="copy-traits-button" style="display:none"></button>
        <button id="clear-input-button"></button>
        <button id="retry-button"></button>
      </section>
      <section>
        <div id="generation-progress" style="display:none">
          <p class="progress-text"></p>
        </div>
        <div id="loading-state" class="cb-loading-state" style="display:none"></div>
        <div id="results-state" class="cb-results-state" style="display:none"></div>
        <div id="error-state" class="cb-error-state" style="display:none"></div>
        <div id="empty-state" class="cb-empty-state" style="display:flex"></div>
        <div id="rewritten-traits-container" style="display:none"></div>
        <div id="generation-error" style="display:none">
          <div class="error-message"></div>
        </div>
        <div id="character-name-display"></div>
        <div id="traits-sections"></div>
        <div id="screen-reader-announcement"></div>
      </section>
    </main>
  `;
};

class TestLlmConfigManager {
  constructor() {
    this.activeId = 'default-llm';
    this.configuration = { id: this.activeId, name: 'Test LLM' };
  }

  getActiveConfiguration() {
    return this.configuration;
  }

  async getActiveConfigId() {
    return this.activeId;
  }

  async setActiveConfiguration(newId) {
    this.activeId = newId;
    this.configuration = { id: newId, name: `Test LLM ${newId}` };
  }
}

const createGenerator = ({ logger, eventBus, llmResponseOverride } = {}) => {
  const llmJsonService = {
    clean: jest.fn((value) => value),
    parseAndRepair: jest.fn((raw) => {
      if (typeof raw === 'string') {
        return JSON.parse(raw);
      }
      return raw;
    }),
  };

  const llmStrategyFactory = {
    getAIDecision: jest.fn(async () => {
      if (llmResponseOverride) {
        return llmResponseOverride;
      }

      return {
        content: JSON.stringify({
          characterName: 'Ava Redwood',
          rewrittenTraits: {
            'core:personality':
              'I narrate my story with a keen eye for subtle emotional shifts.',
            'core:likes': 'I savor carefully brewed coffee before writing.',
          },
        }),
      };
    }),
  };

  const tokenEstimator = {
    estimateTokens: jest.fn(() => 128),
  };

  const generator = new TraitsRewriterGenerator({
    logger,
    llmJsonService,
    llmStrategyFactory,
    llmConfigManager: new TestLlmConfigManager(),
    eventBus,
    tokenEstimator,
  });

  return { generator, llmJsonService, llmStrategyFactory };
};

const createCoreDependencies = () => {
  const logger = new ConsoleLogger('ERROR');
  logger.setLogLevel('ERROR');

  const registry = new InMemoryDataRegistry({ logger });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new AjvSchemaValidator({ logger });
  const eventBus = new EventBus({ logger });
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });

  const characterBuilderService = new MinimalCharacterBuilderService(logger);

  return { logger, schemaValidator, eventBus: safeDispatcher, characterBuilderService };
};

const createControllerInfrastructure = (core) => {
  const asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({ logger: core.logger });
  const eventListenerRegistry = new EventListenerRegistry({
    logger: core.logger,
    asyncUtilities: {
      debounce: asyncUtilitiesToolkit.debounce.bind(asyncUtilitiesToolkit),
      throttle: asyncUtilitiesToolkit.throttle.bind(asyncUtilitiesToolkit),
    },
  });

  const controllerLifecycleOrchestrator = new ControllerLifecycleOrchestrator({
    logger: core.logger,
    eventBus: core.eventBus,
  });

  const domElementManager = new DOMElementManager({
    logger: core.logger,
    documentRef: document,
    performanceRef: performance,
  });

  const performanceMonitor = new PerformanceMonitor({
    logger: core.logger,
    eventBus: core.eventBus,
  });

  const memoryManager = new MemoryManager({ logger: core.logger });

  const errorHandlingStrategy = new ErrorHandlingStrategy({
    logger: core.logger,
    eventBus: core.eventBus,
    controllerName: 'TraitsRewriterController',
    errorCategories: ERROR_CATEGORIES,
    errorSeverity: ERROR_SEVERITY,
  });

  const validationService = new ValidationService({
    schemaValidator: core.schemaValidator,
    logger: core.logger,
    handleError: (error) => {
      throw error;
    },
    errorCategories: ERROR_CATEGORIES,
  });

  return {
    controllerLifecycleOrchestrator,
    domElementManager,
    eventListenerRegistry,
    asyncUtilitiesToolkit,
    performanceMonitor,
    memoryManager,
    errorHandlingStrategy,
    validationService,
  };
};

const buildController = async () => {
  renderTraitsRewriterDom();
  const core = createCoreDependencies();
  const generatorSetup = createGenerator({ logger: core.logger, eventBus: core.eventBus });
  const displayEnhancer = new TraitsRewriterDisplayEnhancer({ logger: core.logger });
  const infrastructure = createControllerInfrastructure(core);

  const controller = new TraitsRewriterController({
    logger: core.logger,
    schemaValidator: core.schemaValidator,
    eventBus: core.eventBus,
    characterBuilderService: core.characterBuilderService,
    traitsRewriterGenerator: generatorSetup.generator,
    traitsRewriterDisplayEnhancer: displayEnhancer,
    controllerLifecycleOrchestrator: infrastructure.controllerLifecycleOrchestrator,
    domElementManager: infrastructure.domElementManager,
    eventListenerRegistry: infrastructure.eventListenerRegistry,
    asyncUtilitiesToolkit: infrastructure.asyncUtilitiesToolkit,
    performanceMonitor: infrastructure.performanceMonitor,
    memoryManager: infrastructure.memoryManager,
    errorHandlingStrategy: infrastructure.errorHandlingStrategy,
    validationService: infrastructure.validationService,
  });

  await controller.initialize();

  const elements = {
    characterDefinition: document.getElementById('character-definition'),
    rewriteButton: document.getElementById('rewrite-traits-button'),
    exportJsonButton: document.getElementById('export-json-button'),
    exportTextButton: document.getElementById('export-text-button'),
    copyButton: document.getElementById('copy-traits-button'),
    clearButton: document.getElementById('clear-input-button'),
    characterNameDisplay: document.getElementById('character-name-display'),
    traitsSections: document.getElementById('traits-sections'),
    rewrittenTraitsContainer: document.getElementById('rewritten-traits-container'),
    emptyState: document.getElementById('empty-state'),
    generationError: document.getElementById('generation-error'),
    errorMessage: document.querySelector('.error-message'),
    characterInputError: document.getElementById('character-input-error'),
    progressText: document.querySelector('.progress-text'),
  };

  return {
    controller,
    displayEnhancer,
    generatorSetup,
    core,
    elements,
  };
};

const setCharacterDefinition = async (element, definition) => {
  element.value = JSON.stringify(definition);
  element.dispatchEvent(new Event('blur'));
  await flushPromises();
};

const validDefinition = {
  components: {
    'core:name': { text: 'Ava Redwood' },
    'core:personality': { text: 'Observant narrator' },
    'core:likes': { text: 'Coffee and sunrise walks' },
  },
};

describe('TraitsRewriterController (integration)', () => {
  let clipboardWriteSpy;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});

    if (!navigator.clipboard) {
      navigator.clipboard = { writeText: jest.fn().mockResolvedValue() };
    } else {
      navigator.clipboard.writeText = jest.fn().mockResolvedValue();
    }
    clipboardWriteSpy = navigator.clipboard.writeText;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('processes valid input through generation, display, and export flows', async () => {
    const setup = await buildController();
    const { controller, elements, core } = setup;

    await setCharacterDefinition(elements.characterDefinition, validDefinition);
    expect(elements.rewriteButton.disabled).toBe(false);

    elements.rewriteButton.click();
    await flushPromises();

    expect(elements.characterNameDisplay.textContent).toBe('Ava Redwood');
    const sections = elements.traitsSections.querySelectorAll('.trait-section');
    expect(sections.length).toBeGreaterThan(0);
    expect(
      sections[0].querySelector('.trait-content').textContent
    ).toContain('I narrate my story');

    expect(elements.exportJsonButton.style.display).toBe('block');
    expect(elements.exportTextButton.style.display).toBe('block');
    expect(elements.copyButton.style.display).toBe('block');

    await core.eventBus.dispatch(
      CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_STARTED,
      { message: 'LLM is thinking...' }
    );
    await flushPromises();
    expect(elements.progressText.textContent).toBe('LLM is thinking...');

    const objectUrlSpy = jest
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:traits');
    const revokeSpy = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const nativeCreateElement = document.createElement.bind(document);
    const downloadSpy = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = nativeCreateElement(tagName);
      if (tagName === 'a') {
        element.click = downloadSpy;
      }
      return element;
    });

    elements.exportJsonButton.click();
    expect(objectUrlSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();
    expect(downloadSpy).toHaveBeenCalled();

    elements.exportTextButton.click();
    expect(objectUrlSpy).toHaveBeenCalledTimes(2);

    elements.copyButton.click();
    expect(clipboardWriteSpy).toHaveBeenCalledTimes(1);

    await controller.destroy();
  });

  it('validates character definitions and resets UI with the clear action', async () => {
    const { controller, elements } = await buildController();

    elements.characterDefinition.value = '{"components"';
    elements.characterDefinition.dispatchEvent(new Event('blur'));
    await flushPromises();
    expect(elements.characterInputError.textContent).toContain(
      'Invalid JSON format'
    );
    expect(elements.rewriteButton.disabled).toBe(true);

    await setCharacterDefinition(elements.characterDefinition, { unrelated: true });
    expect(elements.characterInputError.textContent).toContain(
      'must include a "components" property'
    );
    expect(elements.rewriteButton.disabled).toBe(true);

    await setCharacterDefinition(elements.characterDefinition, {
      components: { 'core:personality': { text: 'Only trait' } },
    });
    expect(elements.characterInputError.textContent).toContain(
      'must include core:name'
    );
    expect(elements.rewriteButton.disabled).toBe(true);

    await setCharacterDefinition(elements.characterDefinition, {
      components: { 'core:name': { text: 'Nameless' } },
    });
    expect(elements.characterInputError.textContent).toContain(
      'at least one trait'
    );
    expect(elements.rewriteButton.disabled).toBe(true);

    await setCharacterDefinition(elements.characterDefinition, validDefinition);
    expect(elements.rewriteButton.disabled).toBe(false);

    elements.clearButton.click();
    expect(elements.characterDefinition.value).toBe('');
    expect(elements.rewriteButton.disabled).toBe(true);
    expect(elements.emptyState.style.display).toBe('block');
    expect(elements.rewrittenTraitsContainer.style.display).toBe('none');

    await controller.destroy();
  });

  it('surfaces display, export, and copy failures through TraitsRewriterError flows', async () => {
    const setup = await buildController();
    const { controller, displayEnhancer, elements } = setup;

    const enhanceSpy = jest
      .spyOn(displayEnhancer, 'enhanceForDisplay')
      .mockImplementationOnce(() => {
        throw new Error('Unable to format sections');
      });

    await setCharacterDefinition(elements.characterDefinition, validDefinition);
    elements.rewriteButton.click();
    await flushPromises();

    expect(elements.errorMessage.textContent).toBe('Failed to display results');
    expect(elements.generationError.style.display).toBe('block');

    await setCharacterDefinition(elements.characterDefinition, validDefinition);
    elements.rewriteButton.click();
    await flushPromises();
    expect(enhanceSpy).toHaveBeenCalled();
    expect(elements.rewrittenTraitsContainer.style.display).toBe('block');

    const formatSpy = jest
      .spyOn(displayEnhancer, 'formatForExport')
      .mockImplementationOnce(() => {
        throw new Error('json fail');
      })
      .mockImplementationOnce(() => {
        throw new Error('text fail');
      });

    elements.exportJsonButton.click();
    expect(elements.errorMessage.textContent).toBe('Export failed');
    expect(elements.generationError.style.display).toBe('block');

    elements.exportTextButton.click();
    expect(elements.errorMessage.textContent).toBe('Export failed');

    clipboardWriteSpy.mockRejectedValueOnce(new Error('clipboard unavailable'));
    elements.copyButton.click();
    await flushPromises();
    expect(elements.errorMessage.textContent).toBe('Copy failed');

    await controller.destroy();
  });
});
