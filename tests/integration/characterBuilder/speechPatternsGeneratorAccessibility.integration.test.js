import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { SpeechPatternsGeneratorController } from '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import SpeechPatternsDisplayEnhancer from '../../../src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js';
import { EnhancedSpeechPatternsValidator } from '../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js';

const activeControllers = new Set();

class ExportAwareSpeechPatternsGeneratorController extends SpeechPatternsGeneratorController {
  /**
   * Ensure export controls are cached for the tests.
   * @protected
   */
  _cacheElements() {
    super._cacheElements();
    this._cacheElementsFromMap({
      exportFormat: '#exportFormat',
      exportTemplate: '#exportTemplate',
      templateGroup: '#templateGroup',
    });
  }
}

function ensureAnimationFramePolyfill() {
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 16);
    global.cancelAnimationFrame = (handle) => clearTimeout(handle);
  }
}

function setupDom(includeExportControls = true) {
  ensureAnimationFramePolyfill();

  document.body.innerHTML = `
    <div id="app">
      <textarea id="character-definition"></textarea>
      <div id="character-input-error" style="display: none"></div>
      <button id="generate-btn" disabled>Generate</button>
      <button id="export-btn" disabled>Export</button>
      <button id="clear-all-btn" disabled>Clear</button>
      <button id="back-btn">Back</button>
      <div id="loading-state" class="cb-loading-state" style="display: none"></div>
      <div id="results-state" class="cb-results-state" style="display: none"></div>
      <div id="error-state" class="cb-error-state" style="display: none">
        <div id="error-message"></div>
        <button id="retry-btn">Retry</button>
      </div>
      <div id="empty-state" class="cb-empty-state"></div>
      <div id="speech-patterns-container"></div>
      <div id="loading-indicator"></div>
      <div id="loading-message"></div>
      <div id="progress-container" style="display: none"></div>
      <div id="progress-bar" class="progress-bar"></div>
      <div id="time-estimate" style="display: none"></div>
      <div id="pattern-count"></div>
      <div id="screen-reader-announcement"></div>
      ${
        includeExportControls
          ? `
        <div id="templateGroup" style="display: none"></div>
        <select id="exportFormat"></select>
        <select id="exportTemplate"></select>
      `
          : ''
      }
    </div>
  `;
}

function dispatchFromBody(event) {
  const target = document.body || document;
  target.dispatchEvent(event);
}

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function createSchemaValidator() {
  return {
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    isSchemaLoaded: jest.fn().mockReturnValue(false),
  };
}

function createCharacterBuilderService() {
  return {
    initialize: jest.fn().mockResolvedValue(),
    getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
    createCharacterConcept: jest.fn().mockResolvedValue({ id: 'integration-id' }),
    updateCharacterConcept: jest.fn().mockResolvedValue(),
    deleteCharacterConcept: jest.fn().mockResolvedValue(),
    getCharacterConcept: jest.fn().mockResolvedValue(null),
    generateThematicDirections: jest.fn().mockResolvedValue([]),
    getThematicDirections: jest.fn().mockResolvedValue([]),
  };
}

function createEventBus() {
  return {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };
}

function createDependencies({
  speechPatternsGenerator,
  schemaValidator,
  displayEnhancer,
}) {
  const logger = createLogger();
  const displayEnhancerInstance =
    displayEnhancer || new SpeechPatternsDisplayEnhancer({ logger });

  return {
    logger,
    characterBuilderService: createCharacterBuilderService(),
    eventBus: createEventBus(),
    schemaValidator,
    speechPatternsGenerator,
    speechPatternsDisplayEnhancer: displayEnhancerInstance,
  };
}

function createDisplayEnhancerStub() {
  return {
    enhanceForDisplay: jest.fn((patterns) => {
      const entries =
        patterns && Array.isArray(patterns.speechPatterns)
          ? patterns.speechPatterns
          : [];
      return {
        patterns: entries.map((pattern, index) => ({
          index: index + 1,
          htmlSafePattern: pattern.pattern,
          htmlSafeExample: pattern.example,
          circumstances: pattern.circumstances || '',
        })),
        characterName: patterns?.characterName || 'Character',
        totalCount: entries.length,
        generatedAt: patterns?.generatedAt,
      };
    }),
    formatForExport: jest.fn(() => 'formatted-content'),
    generateExportFilename: jest.fn(() => 'speech_patterns.txt'),
    getSupportedExportFormats: jest.fn(() => [
      { id: 'txt', name: 'Plain Text', description: 'Text export', extension: 'txt' },
      { id: 'json', name: 'JSON', description: 'JSON export', extension: 'json' },
    ]),
    getAvailableTemplates: jest.fn(() => [
      { id: 'default', name: 'Default', description: 'Default template' },
    ]),
    formatAsJson: jest.fn(() => '{ "patterns": [] }'),
    formatAsMarkdown: jest.fn(() => '# Speech Patterns'),
    formatAsCsv: jest.fn(() => 'pattern,example'),
  };
}

function createValidCharacterDefinition() {
  const background = 'An academic with a passion for linguistics and storytelling.'.repeat(2);
  return {
    components: {
      'core:name': { text: 'Professor Ada Lovette' },
      'core:personality': {
        traits: ['curious', 'methodical', 'compassionate'],
        description: background,
      },
      'core:profile': {
        biography: background,
        occupation: 'Linguistics Professor',
      },
    },
  };
}

function createSuccessfulResult() {
  return {
    characterName: 'Professor Ada Lovette',
    generatedAt: new Date('2024-02-20T10:00:00Z').toISOString(),
    speechPatterns: [
      {
        pattern: 'Speaks in precise academic terminology.',
        example: 'Allow me to delineate the underlying hypothesis at play.',
        circumstances: 'Formal lectures',
      },
      {
        pattern: 'Offers encouraging metaphors when mentoring.',
        example: 'Your thesis glows like a lantern guiding travelers home.',
        circumstances: 'Mentorship sessions',
      },
      {
        pattern: 'Adds whimsical alliteration when excited.',
        example: 'This scintillating solution sings with scholarly style!',
        circumstances: 'Unexpected discoveries',
      },
    ],
  };
}

async function enterValidCharacterDefinition({ useFakeTimers = false } = {}) {
  const textarea = document.getElementById('character-definition');
  textarea.value = JSON.stringify(createValidCharacterDefinition(), null, 2);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  if (useFakeTimers) {
    await jest.advanceTimersByTimeAsync(350);
    await Promise.resolve();
  } else {
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

async function waitForGeneration({ duration = 650, useFakeTimers = false } = {}) {
  if (useFakeTimers) {
    await jest.advanceTimersByTimeAsync(duration);
    await Promise.resolve();
  } else {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }
}

beforeEach(() => {
  if (!global.URL.createObjectURL) {
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  } else {
    jest.spyOn(global.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  }

  if (!global.URL.revokeObjectURL) {
    global.URL.revokeObjectURL = jest.fn();
  } else {
    jest.spyOn(global.URL, 'revokeObjectURL').mockImplementation(() => {});
  }
});

afterEach(() => {
  for (const controller of activeControllers) {
    try {
      if (typeof controller.destroy === 'function') {
        controller.destroy();
      }
    } catch (error) {
      // Swallow cleanup failures to avoid masking earlier test errors.
    }
  }
  activeControllers.clear();

  jest.clearAllMocks();
  jest.useRealTimers();
  document.body.innerHTML = '';
});

describe('SpeechPatternsGeneratorController integration - error handling and accessibility', () => {
  it('retries generation via retry button and surfaces generator-specific errors', async () => {
    jest.useFakeTimers();
    setupDom();

    const schemaValidator = createSchemaValidator();
    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.reject(Object.assign(new Error('Service crashed'), {
            name: 'SpeechPatternsGenerationError',
          }))
        )
        .mockResolvedValueOnce(createSuccessfulResult()),
    };
    const displayEnhancerStub = createDisplayEnhancerStub();

    const announcementHistory = [];
    const announcer = document.getElementById('screen-reader-announcement');
    Object.defineProperty(announcer, 'textContent', {
      configurable: true,
      get() {
        return this._value || '';
      },
      set(value) {
        this._value = value;
        announcementHistory.push(value);
      },
    });

    const controller = new ExportAwareSpeechPatternsGeneratorController(
      createDependencies({
        speechPatternsGenerator,
        schemaValidator,
        displayEnhancer: displayEnhancerStub,
      })
    );
    activeControllers.add(controller);
    controller._disableEnhancedValidation();
    await controller.initialize();

    await enterValidCharacterDefinition({ useFakeTimers: true });

    document.getElementById('generate-btn').click();
    await waitForGeneration({ duration: 800, useFakeTimers: true });
    await jest.advanceTimersByTimeAsync(50);
    await Promise.resolve();

    expect(speechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalledTimes(1);
    expect(document.getElementById('error-message').textContent).toContain(
      'Failed to generate speech patterns: Service crashed'
    );

    document.getElementById('retry-btn').click();
    await waitForGeneration({ duration: 800, useFakeTimers: true });
    await jest.advanceTimersByTimeAsync(50);
    await Promise.resolve();

    expect(speechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalledTimes(2);
    expect(document.getElementById('results-state').style.display).toBe('block');
    expect(
      announcementHistory.some((msg) =>
        msg.includes('Generated 3 speech patterns')
      )
    ).toBe(true);
    await jest.runOnlyPendingTimersAsync();
  });

  it.each([
    [
      { name: 'SpeechPatternsResponseProcessingError', message: 'Malformed response received' },
      'Failed to process response: Malformed response received',
    ],
    [
      { name: 'SpeechPatternsValidationError', message: 'Output did not pass schema validation' },
      'Generated content validation failed: Output did not pass schema validation',
    ],
    [
      { name: 'Error', message: 'Service temporarily unavailable due to maintenance' },
      'Speech pattern service is currently unavailable. Please try again later.',
    ],
    [
      { name: 'Error', message: 'Request timeout after 30s' },
      'Generation timed out. Please try again.',
    ],
    [
      { name: 'Error', message: 'Post-generation validation failed at rule set 3' },
      'Generated content did not meet quality standards. Please try again.',
    ],
  ])('maps %o to the expected user-facing error message', async (error, expectedMessage) => {
    jest.useRealTimers();
    setupDom();

    const schemaValidator = createSchemaValidator();
    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn().mockRejectedValueOnce(error),
    };

    const controller = new ExportAwareSpeechPatternsGeneratorController(
      createDependencies({ speechPatternsGenerator, schemaValidator })
    );
    activeControllers.add(controller);
    controller._disableEnhancedValidation();
    await controller.initialize();

    await enterValidCharacterDefinition();

    document.getElementById('generate-btn').click();
    await waitForGeneration({ duration: 700 });

    expect(document.getElementById('error-message').textContent).toContain(expectedMessage);
  });

  it('displays validation errors with formatting and clears them when input becomes valid', async () => {
    jest.useRealTimers();
    setupDom();

    const schemaValidator = createSchemaValidator();
    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn().mockResolvedValue(createSuccessfulResult()),
    };

    const controller = new ExportAwareSpeechPatternsGeneratorController(
      createDependencies({ speechPatternsGenerator, schemaValidator })
    );
    activeControllers.add(controller);
    controller._disableEnhancedValidation();
    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    textarea.value = '{ invalid json }';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    await waitForGeneration({ duration: 400 });

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.style.display).toBe('block');
    expect(errorContainer.innerHTML).toContain('JSON Syntax Error');
    expect(textarea.classList.contains('error')).toBe(true);

    await enterValidCharacterDefinition();

    expect(errorContainer.style.display).toBe('none');
    expect(textarea.classList.contains('error')).toBe(false);
  });
});

describe('SpeechPatternsGeneratorController integration - enhanced validation feedback', () => {
  it('renders success feedback with auto-hide behaviour when validation passes cleanly', async () => {
    jest.useFakeTimers();
    setupDom();

    const schemaValidator = createSchemaValidator();
    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn().mockResolvedValue(createSuccessfulResult()),
    };

    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.82 },
    };

    const validateInputSpy = jest
      .spyOn(EnhancedSpeechPatternsValidator.prototype, 'validateInput')
      .mockResolvedValue(validationResult);

    const controller = new ExportAwareSpeechPatternsGeneratorController(
      createDependencies({ speechPatternsGenerator, schemaValidator })
    );
    activeControllers.add(controller);
    await controller.initialize();

    await enterValidCharacterDefinition({ useFakeTimers: true });

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.style.display).toBe('block');
    expect(errorContainer.textContent).toContain('Excellent character definition!');

    const textarea = document.getElementById('character-definition');
    expect(textarea.classList.contains('success')).toBe(true);

    await jest.advanceTimersByTimeAsync(3100);
    expect(errorContainer.style.display).toBe('none');

    validateInputSpy.mockRestore();
  });

  it('displays categorized feedback, quality metrics, and toggleable sections when issues are present', async () => {
    jest.useFakeTimers();
    setupDom();

    const schemaValidator = createSchemaValidator();
    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn().mockResolvedValue(createSuccessfulResult()),
    };

    const validationResult = {
      isValid: false,
      errors: [],
      warnings: ['Add more detail about long-term motivations.'],
      suggestions: ['Include specific speaking quirks for tense situations.'],
      quality: { overallScore: 0.45 },
    };

    const validateInputSpy = jest
      .spyOn(EnhancedSpeechPatternsValidator.prototype, 'validateInput')
      .mockResolvedValue(validationResult);

    const controller = new ExportAwareSpeechPatternsGeneratorController(
      createDependencies({ speechPatternsGenerator, schemaValidator })
    );
    activeControllers.add(controller);
    await controller.initialize();

    await enterValidCharacterDefinition({ useFakeTimers: true });

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.querySelector('.validation-section')).not.toBeNull();
    expect(errorContainer.querySelector('.quality-score.fair').textContent).toContain('45%');
    expect(errorContainer.querySelector('.quality-level').textContent).toContain('Fair');

    const textarea = document.getElementById('character-definition');
    expect(textarea.classList.contains('warning')).toBe(true);

    const warningSectionTitle = errorContainer.querySelector(
      '.validation-section.validation-warnings .validation-section-title'
    );
    const warningList = errorContainer.querySelector(
      '.validation-section.validation-warnings .validation-list'
    );

    expect(warningSectionTitle.getAttribute('aria-expanded')).toBe('true');

    warningSectionTitle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    expect(warningSectionTitle.getAttribute('aria-expanded')).toBe('false');
    expect(warningList.style.display).toBe('none');

    warningSectionTitle.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    );
    expect(warningSectionTitle.getAttribute('aria-expanded')).toBe('true');
    expect(warningList.style.display).toBe('block');

    validateInputSpy.mockRestore();
  });

  it('shows a good validation success message when the quality score is high but not excellent', async () => {
    jest.useFakeTimers();
    setupDom();

    const schemaValidator = createSchemaValidator();
    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn().mockResolvedValue(createSuccessfulResult()),
    };

    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.7 },
    };

    const validateInputSpy = jest
      .spyOn(EnhancedSpeechPatternsValidator.prototype, 'validateInput')
      .mockResolvedValue(validationResult);

    const controller = new ExportAwareSpeechPatternsGeneratorController(
      createDependencies({ speechPatternsGenerator, schemaValidator })
    );
    activeControllers.add(controller);
    await controller.initialize();

    await enterValidCharacterDefinition({ useFakeTimers: true });

    const errorContainer = document.getElementById('character-input-error');
    expect(errorContainer.textContent).toContain('Good character definition');

    const textarea = document.getElementById('character-definition');
    expect(textarea.classList.contains('success')).toBe(true);

    validateInputSpy.mockRestore();
  });

  it('renders excellent quality metrics when warnings are present', async () => {
    jest.useFakeTimers();
    setupDom();

    const schemaValidator = createSchemaValidator();
    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn().mockResolvedValue(createSuccessfulResult()),
    };

    const validationResult = {
      isValid: false,
      errors: [],
      warnings: ['Consider adding more context for tense scenes.'],
      suggestions: [],
      quality: { overallScore: 0.88 },
    };

    const validateInputSpy = jest
      .spyOn(EnhancedSpeechPatternsValidator.prototype, 'validateInput')
      .mockResolvedValue(validationResult);

    const controller = new ExportAwareSpeechPatternsGeneratorController(
      createDependencies({ speechPatternsGenerator, schemaValidator })
    );
    activeControllers.add(controller);
    await controller.initialize();

    await enterValidCharacterDefinition({ useFakeTimers: true });

    const errorContainer = document.getElementById('character-input-error');
    const qualityScore = errorContainer.querySelector('.quality-score.excellent');
    expect(qualityScore.textContent).toContain('88%');
    expect(errorContainer.querySelector('.quality-level').textContent).toContain('Excellent');

    const textarea = document.getElementById('character-definition');
    expect(textarea.classList.contains('warning')).toBe(true);

    validateInputSpy.mockRestore();
  });
});

describe('SpeechPatternsGeneratorController integration - keyboard accessibility and navigation', () => {
  it('supports keyboard shortcuts for generation, export, clearing, and aborting workflows', async () => {
    jest.useFakeTimers();
    setupDom();

    const schemaValidator = createSchemaValidator();

    const generationCalls = [];
    const generationPromises = [];
    const generateSpeechPatternsMock = jest
      .fn()
      .mockImplementationOnce((definition, options = {}) => {
        generationCalls.push({ definition, options });
        const result = createSuccessfulResult();
        const promise = Promise.resolve(result);
        generationPromises.push(promise);
        return promise;
      })
      .mockImplementationOnce((definition, options = {}) => {
        generationCalls.push({ definition, options });
        let abortHandler;
        const rawPromise = new Promise((resolve, reject) => {
          abortHandler = () =>
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          if (options.abortSignal) {
            options.abortSignal.addEventListener('abort', abortHandler);
          }
        });
        const cleanedPromise = rawPromise.finally(() => {
          if (abortHandler && options.abortSignal) {
            options.abortSignal.removeEventListener('abort', abortHandler);
          }
        });
        const handledPromise = cleanedPromise.catch((error) => {
          throw error;
        });
        generationPromises.push(handledPromise);
        return handledPromise;
      })
      .mockImplementation(() => Promise.resolve(createSuccessfulResult()));

    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: generateSpeechPatternsMock,
    };

    const displayEnhancerStub = createDisplayEnhancerStub();

    const dependencies = createDependencies({
      speechPatternsGenerator,
      schemaValidator,
      displayEnhancer: displayEnhancerStub,
    });

    const controller = new ExportAwareSpeechPatternsGeneratorController(dependencies);
    activeControllers.add(controller);
    controller._disableEnhancedValidation();
    await controller.initialize();

    await enterValidCharacterDefinition({ useFakeTimers: true });

    dispatchFromBody(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })
    );
    await waitForGeneration({ duration: 1200, useFakeTimers: true });
    await expect(generationPromises[0]).resolves.toMatchObject({
      speechPatterns: expect.any(Array),
    });

    await jest.runOnlyPendingTimersAsync();

    expect(speechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalledTimes(1);

    dispatchFromBody(
      new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true, cancelable: true })
    );
    expect(displayEnhancerStub.formatForExport).toHaveBeenCalledTimes(1);
    expect(displayEnhancerStub.generateExportFilename).toHaveBeenCalledTimes(2);
    expect(displayEnhancerStub.enhanceForDisplay).toHaveBeenCalled();

    dispatchFromBody(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })
    );
    await jest.advanceTimersByTimeAsync(500);

    dispatchFromBody(
      new KeyboardEvent('keydown', {
        key: 'Delete',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );

    const textarea = document.getElementById('character-definition');
    expect(textarea.value).toBe('');
    expect(document.getElementById('screen-reader-announcement').textContent).toBe(
      'All content cleared'
    );

    await jest.advanceTimersByTimeAsync(1000);

    expect(generationCalls[1].options.abortSignal.aborted).toBe(true);
    await expect(generationPromises[1]).rejects.toThrow('Aborted');
  });

  it('announces navigation between patterns and handles escape to cancel generation', async () => {
    jest.useFakeTimers();
    setupDom();

    const schemaValidator = createSchemaValidator();

    let pendingAbortSignal;
    const navigationPromises = [];
    const generatePatternsForNavigation = jest
      .fn()
      .mockImplementationOnce(() => {
        const promise = Promise.resolve(createSuccessfulResult());
        navigationPromises.push(promise);
        return promise;
      })
      .mockImplementationOnce((_definition, options = {}) => {
        pendingAbortSignal = options.abortSignal;
        const rawPromise = new Promise((resolve, reject) => {
          if (options.abortSignal) {
            options.abortSignal.addEventListener('abort', () =>
              reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
            );
          }
        });
        const handledPromise = rawPromise.catch((error) => {
          throw error;
        });
        navigationPromises.push(handledPromise);
        return handledPromise;
      });

    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: generatePatternsForNavigation,
    };

    const controller = new ExportAwareSpeechPatternsGeneratorController(
      createDependencies({ speechPatternsGenerator, schemaValidator })
    );
    activeControllers.add(controller);
    controller._disableEnhancedValidation();
    await controller.initialize();

    await enterValidCharacterDefinition({ useFakeTimers: true });

    dispatchFromBody(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })
    );
    await waitForGeneration({ duration: 1200, useFakeTimers: true });
    await Promise.resolve();

    const patterns = document.querySelectorAll('.speech-pattern-item');
    expect(patterns.length).toBeGreaterThan(1);

    const firstPattern = patterns[0];
    firstPattern.focus();

    firstPattern.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(patterns[1]);
    expect(document.getElementById('screen-reader-announcement').textContent).toContain('Pattern 2');

    patterns[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(patterns[2]);

    patterns[2].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(patterns[1]);

    patterns[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(firstPattern);

    firstPattern.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(patterns[patterns.length - 1]);

    document.activeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(patterns[0]);

    dispatchFromBody(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })
    );
    await jest.advanceTimersByTimeAsync(400);

    dispatchFromBody(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(navigationPromises[0]).resolves.toMatchObject({
      speechPatterns: expect.any(Array),
    });
    await expect(navigationPromises[1]).rejects.toThrow('Aborted');

    expect(pendingAbortSignal.aborted).toBe(true);
    expect(document.getElementById('screen-reader-announcement').textContent).toBe(
      'Generation cancelled'
    );
  });
});
