/**
 * @file Edge case coverage tests for SpeechPatternsGeneratorController
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import {
  SpeechPatternsGeneratorController,
} from '../../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

jest.mock(
  '../../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js',
  () => ({
    EnhancedSpeechPatternsValidator: jest.fn(),
  })
);

const {
  EnhancedSpeechPatternsValidator,
} = jest.requireMock(
  '../../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js'
);

const longText =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

const createValidCharacterJson = () =>
  JSON.stringify({
    components: {
      'core:name': { text: 'Aventine Scholar' },
      'core:personality': { description: `${longText}${longText}` },
      'core:profile': { biography: `${longText}${longText}` },
      'core:likes': { summary: longText },
    },
  });

const baseCharacterBuilderService = {
  initialize: jest.fn(),
  getAllCharacterConcepts: jest.fn(),
  createCharacterConcept: jest.fn(),
  updateCharacterConcept: jest.fn(),
  deleteCharacterConcept: jest.fn(),
  getCharacterConcept: jest.fn(),
  generateThematicDirections: jest.fn(),
  getThematicDirections: jest.fn(),
};

const baseEventBus = {
  dispatch: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};

const setupDom = () => {
  document.body.innerHTML = `
    <div id="app">
      <textarea id="character-definition"></textarea>
      <div id="character-input-error" class="cb-error"></div>
      <button id="generate-btn" disabled>Generate</button>
      <button id="export-btn" disabled>Export</button>
      <button id="clear-all-btn" disabled>Clear</button>
      <button id="back-btn">Back</button>
      <div id="loading-state"></div>
      <div id="results-state"></div>
      <div id="error-state"></div>
      <div id="speech-patterns-container"></div>
      <div id="loading-indicator"></div>
      <span id="loading-message"></span>
      <div id="progress-container"><div id="progress-bar"></div></div>
      <span id="time-estimate"></span>
      <div id="empty-state"></div>
      <div id="pattern-count"></div>
      <div id="screen-reader-announcement"></div>
      <div id="error-message"></div>
      <button id="retry-btn">Retry</button>
      <select id="export-format"><option value="txt">txt</option></select>
      <select id="export-template"><option value="default">default</option></select>
    </div>
  `;
};

const createDependencies = ({
  withGenerator = true,
  loggerOverrides = {},
  container,
} = {}) => {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...loggerOverrides,
  };

  const dependencies = {
    logger,
    characterBuilderService: { ...baseCharacterBuilderService },
    eventBus: { ...baseEventBus },
    schemaValidator: { validate: jest.fn().mockReturnValue({ isValid: true }) },
  };

  if (withGenerator) {
    dependencies.speechPatternsGenerator = {
      generateSpeechPatterns: jest.fn().mockResolvedValue({
        characterName: 'Aventine Scholar',
        generatedAt: Date.now(),
        speechPatterns: [],
      }),
      getServiceInfo: jest.fn().mockReturnValue({ name: 'generator', version: '1.0.0' }),
    };
  }

  if (container) {
    dependencies.container = container;
  }

  return { dependencies, logger };
};

const flushPromises = async () => new Promise((resolve) => setImmediate(resolve));

describe('SpeechPatternsGeneratorController edge cases', () => {
  let validatorInstance;

  beforeEach(() => {
    jest.useRealTimers();
    setupDom();
    validatorInstance = {
      validateInput: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        quality: { overallScore: 0.9 },
      }),
    };
    EnhancedSpeechPatternsValidator.mockImplementation(() => validatorInstance);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

const initializeController = (dependencies) => {
  const controller = new SpeechPatternsGeneratorController(dependencies);
  controller._cacheElements();
  controller._setupEventListeners();
  return controller;
};

const initializeControllerWithListenerSpy = (dependencies) => {
  const controller = new SpeechPatternsGeneratorController(dependencies);
  const listenerSpy = jest.spyOn(controller, '_addEventListener');
  controller._cacheElements();
  controller._setupEventListeners();
  return { controller, listenerSpy };
};

  it('warns when container lookup for speech generator fails', () => {
    const container = {
      resolve: jest.fn(() => {
        throw new Error('missing service');
      }),
    };

    const { dependencies, logger } = createDependencies({
      withGenerator: false,
      container,
    });

    new SpeechPatternsGeneratorController(dependencies);

    expect(container.resolve).toHaveBeenCalledWith(tokens.SpeechPatternsGenerator);
    expect(logger.warn).toHaveBeenCalledWith(
      'SpeechPatternsGenerator not available:',
      'missing service'
    );
  });

  it('navigates back to index when back button is clicked', () => {
    const { dependencies } = createDependencies();
    const { listenerSpy } = initializeControllerWithListenerSpy(dependencies);

    const backListenerCall = listenerSpy.mock.calls.find(
      ([target, event]) => target === 'backBtn' && event === 'click'
    );
    expect(backListenerCall).toBeDefined();

    const backHandler = backListenerCall[2];

    expect(() => backHandler()).not.toThrow();
  });

  it('disables enhanced validation and falls back to basic validation paths', () => {
    const { dependencies } = createDependencies();
    const controller = initializeController(dependencies);

    const textarea = document.getElementById('character-definition');
    textarea.value = createValidCharacterJson();

    controller._disableEnhancedValidation();

    textarea.dispatchEvent(new Event('blur'));

    const generateBtn = document.getElementById('generate-btn');
    expect(generateBtn.disabled).toBe(false);
  });

  it('clears enhanced validation UI when input is empty', async () => {
    const { dependencies } = createDependencies();
    initializeController(dependencies);

    const textarea = document.getElementById('character-definition');
    textarea.value = '   ';

    textarea.dispatchEvent(new Event('blur'));
    await flushPromises();

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.style.display).toBe('none');
    const generateBtn = document.getElementById('generate-btn');
    expect(generateBtn.disabled).toBe(true);
  });

  it('reports JSON syntax errors with enhanced validation feedback', async () => {
    const { dependencies } = createDependencies();
    initializeController(dependencies);

    const textarea = document.getElementById('character-definition');
    textarea.value = '{ bad json }';

    textarea.dispatchEvent(new Event('blur'));
    await flushPromises();

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.innerHTML).toContain('JSON Syntax Error');
    expect(errorContainer.style.display).toBe('block');
  });

  it('falls back gracefully when enhanced validator throws', async () => {
    validatorInstance.validateInput.mockRejectedValueOnce(new Error('downstream failure'));

    const { dependencies } = createDependencies();
    const controller = initializeController(dependencies);

    const textarea = document.getElementById('character-definition');
    textarea.value = createValidCharacterJson();

    textarea.dispatchEvent(new Event('blur'));
    await flushPromises();

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.innerHTML).toContain('Validation system error: downstream failure');
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Enhanced validation failed:',
      expect.any(Error)
    );
  });

  it('flags missing components during basic validation', () => {
    const { dependencies } = createDependencies();
    const controller = initializeController(dependencies);

    controller._disableEnhancedValidation();

    const textarea = document.getElementById('character-definition');
    textarea.value = '{}';

    textarea.dispatchEvent(new Event('blur'));

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.innerHTML).toContain('No character components found');
  });

  it('guards generation trigger when no character definition is present', () => {
    const { dependencies } = createDependencies();
    const { listenerSpy } = initializeControllerWithListenerSpy(dependencies);

    const generateHandlerCall = listenerSpy.mock.calls.find(
      ([target, event]) => target === 'generateBtn' && event === 'click'
    );
    expect(generateHandlerCall).toBeDefined();

    const generateHandler = generateHandlerCall[2];
    generateHandler();

    expect(
      dependencies.speechPatternsGenerator.generateSpeechPatterns
    ).not.toHaveBeenCalled();
  });

  it('shows error when exporting without generated patterns', () => {
    const { dependencies } = createDependencies();
    initializeController(dependencies);

    const exportBtn = document.getElementById('export-btn');
    exportBtn.disabled = false;
    exportBtn.click();

    const errorMessage = document.getElementById('error-message');
    expect(errorMessage.textContent).toBe('No speech patterns to export');
  });

  it('shows success message for good quality validation results', async () => {
    validatorInstance.validateInput.mockResolvedValueOnce({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.65 },
    });

    const { dependencies } = createDependencies();
    initializeController(dependencies);

    const textarea = document.getElementById('character-definition');
    textarea.value = createValidCharacterJson();

    textarea.dispatchEvent(new Event('blur'));
    await flushPromises();

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.textContent).toContain('Good character definition');
  });

  it('hides validation container for lower quality success cases', async () => {
    validatorInstance.validateInput.mockResolvedValueOnce({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.55 },
    });

    const { dependencies } = createDependencies();
    initializeController(dependencies);

    const textarea = document.getElementById('character-definition');
    textarea.value = createValidCharacterJson();

    textarea.dispatchEvent(new Event('blur'));
    await flushPromises();

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.style.display).toBe('none');
  });

  it('applies warning class when validation warnings are returned', async () => {
    validatorInstance.validateInput.mockResolvedValueOnce({
      isValid: false,
      errors: [],
      warnings: ['Tweak supporting details'],
      suggestions: ['Add more background depth'],
      quality: { overallScore: 0.42 },
    });

    const { dependencies } = createDependencies();
    initializeController(dependencies);

    const textarea = document.getElementById('character-definition');
    textarea.value = createValidCharacterJson();

    textarea.dispatchEvent(new Event('blur'));
    await flushPromises();

    expect(textarea.classList.contains('warning')).toBe(true);
  });

  it.each([
    [0.7, 'good'],
    [0.45, 'fair'],
    [0.25, 'poor'],
    [0.1, 'inadequate'],
  ])('renders quality badge using %s score level', async (score, expectedClass) => {
    validatorInstance.validateInput.mockResolvedValueOnce({
      isValid: false,
      errors: ['Minor issue'],
      warnings: [],
      suggestions: [],
      quality: { overallScore: score },
    });

    const { dependencies } = createDependencies();
    initializeController(dependencies);

    const textarea = document.getElementById('character-definition');
    textarea.value = createValidCharacterJson();

    textarea.dispatchEvent(new Event('blur'));
    await flushPromises();

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.innerHTML).toContain(`quality-score ${expectedClass}`);
  });

  describe('pattern navigation shortcuts', () => {
    let controller;
    let patterns;

    beforeEach(() => {
      jest.useFakeTimers();
      const { dependencies } = createDependencies();
      controller = initializeController(dependencies);

      const container = document.getElementById('speech-patterns-container');
      patterns = Array.from({ length: 3 }).map((_, index) => {
        const el = document.createElement('article');
        el.className = 'speech-pattern-item';
        el.setAttribute('tabindex', index === 0 ? '0' : '-1');
        el.innerHTML = `<div class="pattern-number">${index + 1}</div>`;
        el.focus = jest.fn();
        container.appendChild(el);
        return el;
      });
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    const dispatchKey = (element, key) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      element.dispatchEvent(event);
    };

    it('moves focus to the next pattern with ArrowDown', () => {
      dispatchKey(patterns[0], 'ArrowDown');

      expect(patterns[0].getAttribute('tabindex')).toBe('-1');
      expect(patterns[1].getAttribute('tabindex')).toBe('0');
      expect(patterns[1].focus).toHaveBeenCalled();

      const announcement = document.getElementById('screen-reader-announcement');
      expect(announcement.textContent).toBe('Pattern 2 focused');
    });

    it('moves focus to the previous pattern with ArrowUp', () => {
      patterns[1].setAttribute('tabindex', '0');
      dispatchKey(patterns[1], 'ArrowUp');

      expect(patterns[0].getAttribute('tabindex')).toBe('0');
      expect(patterns[0].focus).toHaveBeenCalled();
    });

    it('moves focus to the first pattern with Home', () => {
      patterns[2].setAttribute('tabindex', '0');
      dispatchKey(patterns[2], 'Home');

      expect(patterns[0].getAttribute('tabindex')).toBe('0');
      expect(patterns[0].focus).toHaveBeenCalled();
    });

    it('moves focus to the last pattern with End', () => {
      dispatchKey(patterns[0], 'End');

      expect(patterns[2].getAttribute('tabindex')).toBe('0');
      expect(patterns[2].focus).toHaveBeenCalled();
    });
  });
});
