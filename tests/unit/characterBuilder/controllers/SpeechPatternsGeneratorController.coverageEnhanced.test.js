/**
 * @file Additional high-coverage tests for SpeechPatternsGeneratorController
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  SpeechPatternsGeneratorController,
} from '../../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';

globalThis.__validatorInstances = [];
globalThis.__validatorFactoryBehavior = () => ({ validateInput: jest.fn() });

jest.mock(
  '../../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js',
  () => ({
    EnhancedSpeechPatternsValidator: jest.fn(() => {
      const instance = globalThis.__validatorFactoryBehavior();
      globalThis.__validatorInstances.push(instance);
      return instance;
    }),
  })
);

const setValidatorBehavior = (factory) => {
  globalThis.__validatorFactoryBehavior = factory;
};

const clearValidatorInstances = () => {
  globalThis.__validatorInstances.length = 0;
};

const getLatestValidatorInstance = () =>
  globalThis.__validatorInstances[globalThis.__validatorInstances.length - 1];

const activeControllers = new Set();

const createControllerInstance = (dependencies) => {
  const controller = new SpeechPatternsGeneratorController(dependencies);
  activeControllers.add(controller);
  return controller;
};

let performanceSequence = [];
let performanceIndex = 0;
let rafIdCounter = 0;
let rafTimers = new Map();

const setPerformanceSequence = (sequence) => {
  performanceSequence = sequence;
  performanceIndex = 0;
  if (global.performance && typeof global.performance === 'object') {
    global.performance.now = jest.fn(() => getPerformanceNow());
  }
};

const getPerformanceNow = () => {
  if (performanceIndex < performanceSequence.length) {
    return performanceSequence[performanceIndex++];
  }
  if (performanceSequence.length > 0) {
    return performanceSequence[performanceSequence.length - 1];
  }
  return Date.now();
};

const createDependencies = ({ withDisplayEnhancer = false } = {}) => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const characterBuilderService = {
    initialize: jest.fn().mockResolvedValue(undefined),
    getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
    createCharacterConcept: jest.fn(),
    updateCharacterConcept: jest.fn(),
    deleteCharacterConcept: jest.fn(),
    getCharacterConcept: jest.fn(),
    generateThematicDirections: jest.fn(),
    getThematicDirections: jest.fn(),
  };

  const eventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };

  const schemaValidator = {
    validate: jest.fn().mockReturnValue({ isValid: true }),
  };

  const speechPatternsGenerator = {
    generateSpeechPatterns: jest.fn(),
    getServiceInfo: jest.fn().mockReturnValue({ name: 'generator', version: '1.0.0' }),
  };

  const dependencies = {
    logger,
    characterBuilderService,
    eventBus,
    schemaValidator,
    speechPatternsGenerator,
  };

  if (withDisplayEnhancer) {
    dependencies.speechPatternsDisplayEnhancer = {
      enhanceForDisplay: jest.fn(),
      formatForExport: jest.fn(),
      generateExportFilename: jest.fn(),
      getSupportedExportFormats: jest.fn(),
      getAvailableTemplates: jest.fn(),
      formatAsJson: jest.fn(),
      formatAsMarkdown: jest.fn(),
      formatAsCsv: jest.fn(),
      applyTemplate: jest.fn(),
    };
  }

  return {
    dependencies,
    mocks: {
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
      speechPatternsGenerator,
      displayEnhancer: dependencies.speechPatternsDisplayEnhancer,
    },
  };
};

const setupControllerDOM = () => {
  document.body.innerHTML = `
    <div id="app">
      <textarea id="character-definition"></textarea>
      <div id="character-input-error" class="cb-error"></div>
      <button id="generate-btn" disabled>Generate</button>
      <button id="export-btn" disabled>Export</button>
      <button id="clear-all-btn">Clear</button>
      <button id="back-btn">Back</button>
      <div id="loading-state" class="cb-loading-state" style="display: none">
        <div id="loading-indicator">
          <div class="spinner"></div>
          <span id="loading-message">Loading</span>
          <div id="progress-container" style="display: none">
            <div class="progress-bar-container">
              <div id="progress-bar" style="width: 0%"></div>
            </div>
            <span id="time-estimate" style="display: none"></span>
          </div>
        </div>
      </div>
      <div id="results-state" class="cb-results-state" style="display: none"></div>
      <div id="error-state" class="cb-error-state" style="display: none">
        <div id="error-message"></div>
        <button id="retry-btn">Retry</button>
      </div>
      <div id="empty-state" class="cb-empty-state" style="display: none"></div>
      <div id="speech-patterns-container"></div>
      <div id="pattern-count"></div>
      <div id="screen-reader-announcement"></div>
      <select id="export-format">
        <option value="txt">Text</option>
        <option value="json">JSON</option>
        <option value="markdown">Markdown</option>
        <option value="csv">CSV</option>
      </select>
      <div id="template-group" style="display: none">
        <select id="export-template">
          <option value="default">Default</option>
          <option value="detailed">Detailed</option>
        </select>
      </div>
    </div>
  `;
};

const createValidCharacterData = (nameComponent) => ({
  components: {
    'core:name': nameComponent,
    'core:personality': {
      description:
        'A well developed personality description that easily exceeds the minimum detail requirements for validation purposes.',
    },
    'core:profile': {
      background:
        'A lengthy background that provides significant narrative context, ensuring the validation logic sees rich content.',
    },
    'core:likes': {
      items: [
        'Exploring ancient ruins',
        'Studying arcane languages',
        'Helping lost travelers find their way home',
      ],
    },
  },
});

const flushMicrotasks = async () => {
  await Promise.resolve();
};

const enterCharacterDefinition = async ({
  characterData,
  validatorInstance,
}) => {
  const textarea = document.getElementById('character-definition');
  textarea.value = JSON.stringify(characterData);
  textarea.dispatchEvent(new Event('blur', { bubbles: true }));
  await flushMicrotasks();

  const results = validatorInstance?.validateInput?.mock?.results;
  if (results?.length) {
    const latestCall = results[results.length - 1];
    await latestCall?.value;
  }

  await flushMicrotasks();
};

const waitForValidationAndGeneration = async ({
  characterData,
  validatorInstance,
  waitMs = 700,
}) => {
  const textarea = document.getElementById('character-definition');
  const generateBtn = document.getElementById('generate-btn');

  textarea.value = JSON.stringify(characterData);
  textarea.dispatchEvent(new Event('blur', { bubbles: true }));
  await flushMicrotasks();

  if (validatorInstance?.validateInput) {
    const latestCall =
      validatorInstance.validateInput.mock.results[
        validatorInstance.validateInput.mock.results.length - 1
      ];
    await latestCall?.value;
  }

  await flushMicrotasks();

  expect(generateBtn.disabled).toBe(false);
  generateBtn.dispatchEvent(new Event('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  await flushMicrotasks();
};

beforeEach(() => {
  setupControllerDOM();
  setPerformanceSequence([]);

  global.performance = {
    now: jest.fn(() => getPerformanceNow()),
    mark: jest.fn(),
    measure: jest.fn(() => ({ duration: 100 })),
  };

  rafIdCounter = 0;
  rafTimers = new Map();
  global.requestAnimationFrame = jest.fn((callback) => {
    const id = ++rafIdCounter;
    const timeout = setTimeout(() => {
      rafTimers.delete(id);
      callback(Date.now());
    }, 0);
    rafTimers.set(id, timeout);
    return id;
  });
  global.cancelAnimationFrame = jest.fn((id) => {
    const timeout = rafTimers.get(id);
    if (timeout) {
      clearTimeout(timeout);
      rafTimers.delete(id);
    }
  });

  class FakeAbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
    }
  }
  global.AbortController = FakeAbortController;

  global.URL = {
    createObjectURL: jest.fn(() => 'blob://url'),
    revokeObjectURL: jest.fn(),
  };

  global.Blob = jest.fn(function (content, options) {
    this.content = content;
    this.options = options;
  });

  clearValidatorInstances();
  setValidatorBehavior(() => ({ validateInput: jest.fn() }));
  jest
    .requireMock('../../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js')
    .EnhancedSpeechPatternsValidator.mockClear();
});

afterEach(() => {
  activeControllers.forEach((controller) => {
    try {
      controller.destroy?.();
    } catch (error) {
      // Ignore destruction errors in tests to avoid masking primary failures
    }
  });
  activeControllers.clear();
  document.body.innerHTML = '';
  jest.clearAllMocks();
  rafTimers.forEach((timeout) => clearTimeout(timeout));
  rafTimers.clear();
});

describe('SpeechPatternsGeneratorController - advanced coverage', () => {
  it('validates character names using fallback validator paths when enhanced validator is unavailable', async () => {
    setValidatorBehavior(() => {
      throw new Error('validator unavailable');
    });

    const { dependencies } = createDependencies();
    const controller = createControllerInstance(dependencies);

    const originalCache = controller._cacheElements.bind(controller);
    controller._cacheElements = function () {
      originalCache();
      this._cacheElementsFromMap({
        exportFormat: '#export-format',
        exportTemplate: '#export-template',
        templateGroup: '#template-group',
      });
    };

    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    const generateBtn = document.getElementById('generate-btn');
    const errorContainer = document.getElementById('character-input-error');

    const validVariants = [
      { text: 'Hero Text' },
      { name: 'Hero Name' },
      { value: 'Hero Value' },
      { personal: { firstName: 'Hero', lastName: 'Braveheart' } },
    ];

    for (const variant of validVariants) {
      textarea.value = JSON.stringify(createValidCharacterData(variant));
      textarea.dispatchEvent(new Event('blur', { bubbles: true }));
      await flushMicrotasks();
      expect(generateBtn.disabled).toBe(false);
    }

    textarea.value = JSON.stringify(
      createValidCharacterData({ text: '   ' })
    );
    textarea.dispatchEvent(new Event('blur', { bubbles: true }));
    await flushMicrotasks();
    expect(errorContainer.innerHTML).toContain('Character name component exists but does not contain a valid name');

    textarea.value = JSON.stringify({ 'core:name': { text: 'Lonely' } });
    textarea.dispatchEvent(new Event('blur', { bubbles: true }));
    await flushMicrotasks();
    expect(errorContainer.innerHTML).toContain('Character components appear to lack detail');
  });

  it('clears validation errors and disables generation when empty input is blurred', async () => {
    setValidatorBehavior(() => {
      throw new Error('validator unavailable');
    });

    const { dependencies } = createDependencies();
    const controller = createControllerInstance(dependencies);

    const originalCache = controller._cacheElements.bind(controller);
    controller._cacheElements = function () {
      originalCache();
      this._cacheElementsFromMap({
        exportFormat: '#export-format',
        exportTemplate: '#export-template',
        templateGroup: '#template-group',
      });
    };

    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    const generateBtn = document.getElementById('generate-btn');
    const errorContainer = document.getElementById('character-input-error');

    generateBtn.disabled = false;
    errorContainer.style.display = 'block';
    errorContainer.innerHTML = '<p>Old error</p>';

    textarea.value = '   ';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('blur', { bubbles: true }));
    await flushMicrotasks();

    expect(generateBtn.disabled).toBe(true);
    expect(errorContainer.style.display).toBe('none');
    expect(errorContainer.innerHTML).toBe('');
  });

  it('reports detailed validation errors for malformed character definitions', async () => {
    setValidatorBehavior(() => {
      throw new Error('validator unavailable');
    });

    const { dependencies } = createDependencies();
    const controller = createControllerInstance(dependencies);

    const originalCache = controller._cacheElements.bind(controller);
    controller._cacheElements = function () {
      originalCache();
      this._cacheElementsFromMap({
        exportFormat: '#export-format',
        exportTemplate: '#export-template',
        templateGroup: '#template-group',
      });
    };

    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    const errorContainer = document.getElementById('character-input-error');

    const triggerValidation = async (value) => {
      textarea.value = value;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('blur', { bubbles: true }));
      await flushMicrotasks();
    };

    await triggerValidation('123');
    expect(errorContainer.innerHTML).toContain(
      'Character definition must be a JSON object'
    );

    const missingCoreComponents = {
      components: {
        'core:likes': {
          description: 'Loves expansive adventures across the lands '.repeat(3),
        },
      },
    };
    await triggerValidation(JSON.stringify(missingCoreComponents));
    expect(errorContainer.innerHTML).toContain('Missing essential components');

    const blankNameDefinition = {
      components: {
        'core:name': { text: '   ' },
        'core:personality': {
          description: 'A deeply written description that easily exceeds validation thresholds.'.repeat(
            2
          ),
        },
        'core:profile': {
          background:
            'An equally detailed background to keep the validator satisfied with content length.'.repeat(
              2
            ),
        },
      },
    };
    await triggerValidation(JSON.stringify(blankNameDefinition));
    expect(errorContainer.innerHTML).toContain(
      'Character name component exists but does not contain a valid name'
    );

    const nonObjectNameDefinition = {
      components: {
        'core:name': 'Althea',
        'core:personality': {
          description: 'Extensive personality notes to satisfy validation depth.'.repeat(
            2
          ),
        },
        'core:profile': {
          background: 'Extensive history with plenty of details to avoid depth warnings.'.repeat(
            2
          ),
        },
      },
    };
    await triggerValidation(JSON.stringify(nonObjectNameDefinition));
    expect(errorContainer.innerHTML).toContain(
      'Character name component exists but does not contain a valid name'
    );

    const missingFieldsNameDefinition = {
      components: {
        'core:name': { alias: 'The Wanderer' },
        'core:personality': {
          description: 'Another long personality description to keep validations satisfied.'.repeat(
            2
          ),
        },
        'core:profile': {
          background:
            'Rich narrative history to satisfy component depth requirements across the validator.'.repeat(
              2
            ),
        },
      },
    };
    await triggerValidation(JSON.stringify(missingFieldsNameDefinition));
    expect(errorContainer.innerHTML).toContain(
      'Character name component exists but does not contain a valid name'
    );
  });

  it('runs the full generation workflow with enhanced validation, progress updates, and rich export options', async () => {
    const { dependencies, mocks } = createDependencies({
      withDisplayEnhancer: true,
    });

    const displayEnhancer = mocks.displayEnhancer;
    displayEnhancer.getSupportedExportFormats.mockReturnValue([
      {
        id: 'txt',
        name: 'Text',
        extension: '.txt',
        mimeType: 'text/plain',
        description: 'Plain text export',
      },
      {
        id: 'json',
        name: 'JSON',
        extension: '.json',
        mimeType: 'application/json',
        description: 'Machine readable format',
      },
      {
        id: 'markdown',
        name: 'Markdown',
        extension: '.md',
        mimeType: 'text/markdown',
        description: 'Markdown export',
      },
      {
        id: 'csv',
        name: 'CSV',
        extension: '.csv',
        mimeType: 'text/csv',
        description: 'Spreadsheet friendly',
      },
    ]);
    displayEnhancer.getAvailableTemplates.mockReturnValue([
      { id: 'default', name: 'Default', description: 'Standard layout' },
      { id: 'detailed', name: 'Detailed', description: 'Extended details' },
    ]);
    displayEnhancer.enhanceForDisplay.mockImplementation((patterns) => ({
      characterName: patterns.characterName,
      metadata: { patternCount: patterns.speechPatterns.length },
      totalCount: patterns.speechPatterns.length,
      patterns: patterns.speechPatterns.map((pattern, index) => ({
        index: index + 1,
        htmlSafePattern: pattern.pattern,
        htmlSafeExample: pattern.example,
        circumstances: pattern.circumstances,
      })),
    }));
    displayEnhancer.formatForExport.mockReturnValue('Formatted export text');
    displayEnhancer.generateExportFilename.mockReturnValue('hero.txt');
    displayEnhancer.formatAsJson.mockReturnValue('{"patterns":[]}');
    displayEnhancer.formatAsMarkdown.mockReturnValue('# Patterns');
    displayEnhancer.formatAsCsv.mockReturnValue('pattern,example');
    displayEnhancer.applyTemplate.mockReturnValue('templated export');

    mocks.speechPatternsGenerator.generateSpeechPatterns.mockImplementation(
      async (_definition, options) => {
        options?.progressCallback?.(80);
        return {
          speechPatterns: [
            {
              pattern: '<strong>Energetic</strong> greeting styles',
              example: '<em>Hello there!</em>',
              circumstances: 'When meeting new allies',
            },
          ],
          characterName: 'Hero',
          generatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
        };
      }
    );

    setPerformanceSequence([
      0,
      1000,
      15000,
      20000,
      140000,
      150000,
      160000,
      170000,
      180000,
    ]);

    const controller = createControllerInstance(dependencies);
    const originalCache = controller._cacheElements.bind(controller);
    controller._cacheElements = function () {
      originalCache();
      this._cacheElementsFromMap({
        exportFormat: '#export-format',
        exportTemplate: '#export-template',
        templateGroup: '#template-group',
      });
    };

    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: ['Looks great'],
      quality: { overallScore: 0.92 },
    });

    await waitForValidationAndGeneration({
      characterData: createValidCharacterData({ text: 'Heroic Traveler' }),
      validatorInstance,
    });

    expect(validatorInstance.validateInput).toHaveBeenCalled();
    expect(mocks.speechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalled();

    const container = document.getElementById('speech-patterns-container');
    const renderedHtml = container.innerHTML;
    expect(renderedHtml).toContain('Energetic');
    expect(renderedHtml).toContain('pattern-description');
    expect(document.getElementById('pattern-count').textContent).toContain('1');
    expect(document.getElementById('progress-container').style.display).toBe(
      'block'
    );

    const exportFormat = document.getElementById('export-format');
    const templateGroup = document.getElementById('template-group');

    exportFormat.value = 'json';
    exportFormat.dispatchEvent(new Event('change', { bubbles: true }));
    expect(templateGroup.style.display).toBe('none');

    exportFormat.value = 'txt';
    exportFormat.dispatchEvent(new Event('change', { bubbles: true }));
    expect(templateGroup.style.display).toBe('flex');

    exportFormat.value = 'json';
    document
      .getElementById('export-btn')
      .dispatchEvent(new Event('click', { bubbles: true }));
    expect(displayEnhancer.formatAsJson).toHaveBeenCalled();

    exportFormat.value = 'markdown';
    document
      .getElementById('export-btn')
      .dispatchEvent(new Event('click', { bubbles: true }));
    expect(displayEnhancer.formatAsMarkdown).toHaveBeenCalled();

    exportFormat.value = 'csv';
    document
      .getElementById('export-btn')
      .dispatchEvent(new Event('click', { bubbles: true }));
    expect(displayEnhancer.formatAsCsv).toHaveBeenCalled();

    exportFormat.value = 'txt';
    document.getElementById('export-template').value = 'detailed';
    document
      .getElementById('export-btn')
      .dispatchEvent(new Event('click', { bubbles: true }));
    expect(displayEnhancer.applyTemplate).toHaveBeenCalled();

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(document.getElementById('screen-reader-announcement').textContent)
      .toContain('Speech patterns exported as');
  });

  it('adds medium confidence styling to the progress bar during mid-stage updates', async () => {
    const { dependencies, mocks } = createDependencies();

    mocks.speechPatternsGenerator.generateSpeechPatterns.mockImplementation(
      async (_definition, options) => {
        options?.progressCallback?.(0.6);
        return {
          speechPatterns: [
            {
              pattern: 'Carefully considers each response',
              example: '"Let us think this through before we commit."',
              circumstances: 'During strategic planning sessions',
            },
          ],
          characterName: 'Deliberate Strategist',
          generatedAt: new Date('2024-01-05T00:00:00Z').toISOString(),
        };
      }
    );

    setPerformanceSequence([0, 2500, 5000, 8000, 12000, 15000, 18000]);

    const controller = createControllerInstance(dependencies);
    const originalCache = controller._cacheElements.bind(controller);
    controller._cacheElements = function () {
      originalCache();
      this._cacheElementsFromMap({
        exportFormat: '#export-format',
        exportTemplate: '#export-template',
        templateGroup: '#template-group',
      });
    };

    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.9 },
    });

    await waitForValidationAndGeneration({
      characterData: createValidCharacterData({ text: 'Deliberate Strategist' }),
      validatorInstance,
      waitMs: 800,
    });

    const progressBar = document.getElementById('progress-bar');
    expect(progressBar.classList.contains('medium-confidence')).toBe(true);
  });

  it('falls back to text export when no display enhancer is provided', async () => {
    const { dependencies, mocks } = createDependencies();

    mocks.speechPatternsGenerator.generateSpeechPatterns.mockResolvedValue({
      speechPatterns: [
        {
          pattern: 'Observes before speaking',
          example:
            '"We should consider every angle before we respond."',
          circumstances: 'During tense negotiations',
        },
      ],
      characterName: 'Fallback Hero',
      generatedAt: new Date('2024-01-02T00:00:00Z').toISOString(),
    });

    setPerformanceSequence([0, 1000, 15000, 20000, 30000, 40000, 50000, 60000, 70000]);

    const controller = createControllerInstance(dependencies);
    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.88 },
    });

    await waitForValidationAndGeneration({
      characterData: createValidCharacterData({ text: 'Fallback Hero' }),
      validatorInstance,
    });

    expect(validatorInstance.validateInput).toHaveBeenCalled();
    const exportTrigger = document.getElementById('export-btn');
    expect(exportTrigger.disabled).toBe(false);
    const originalCreateElement = document.createElement.bind(document);
    const anchorClicks = [];
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        element.click = () => anchorClicks.push('clicked');
      }
      return element;
    });

    document
      .getElementById('export-btn')
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(global.Blob).toHaveBeenCalled();
    const blobArgs = global.Blob.mock.calls[0];
    expect(blobArgs[0][0]).toContain('Speech Patterns for Fallback Hero');
    expect(blobArgs[1].type).toContain('text/plain');
    expect(anchorClicks).toContain('clicked');

    document.createElement.mockRestore();
  });

  it('handles generation errors and supports retrying the workflow', async () => {
    const { dependencies, mocks } = createDependencies({
      withDisplayEnhancer: true,
    });

    const successResult = {
      speechPatterns: [
        {
          pattern: 'Speaks softly when delivering difficult news',
          example: 'I need to tell you something important...',
          circumstances: 'When discussing sensitive topics',
        },
      ],
      characterName: 'Resilient Hero',
      generatedAt: new Date('2024-01-03T00:00:00Z').toISOString(),
    };

    mocks.speechPatternsGenerator.generateSpeechPatterns
      .mockRejectedValueOnce(new Error('Service timeout'))
      .mockResolvedValueOnce(successResult);

    mocks.displayEnhancer.enhanceForDisplay.mockReturnValue({
      characterName: successResult.characterName,
      patterns: successResult.speechPatterns.map((pattern, index) => ({
        index: index + 1,
        htmlSafePattern: pattern.pattern,
        htmlSafeExample: pattern.example,
        circumstances: pattern.circumstances,
      })),
    });
    mocks.displayEnhancer.getSupportedExportFormats.mockReturnValue([
      { id: 'txt', name: 'Text', extension: '.txt', mimeType: 'text/plain' },
    ]);
    mocks.displayEnhancer.getAvailableTemplates.mockReturnValue([
      { id: 'default', name: 'Default', description: 'Default template' },
    ]);
    mocks.displayEnhancer.formatForExport.mockReturnValue('Formatted');
    mocks.displayEnhancer.generateExportFilename.mockReturnValue('resilient.txt');

    setPerformanceSequence([0, 1000, 1200, 1500, 2000, 2500, 3000, 3500, 4000]);

    const controller = createControllerInstance(dependencies);
    const originalCache = controller._cacheElements.bind(controller);
    controller._cacheElements = function () {
      originalCache();
      this._cacheElementsFromMap({
        exportFormat: '#export-format',
        exportTemplate: '#export-template',
        templateGroup: '#template-group',
      });
    };

    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.85 },
    });

    await waitForValidationAndGeneration({
      characterData: createValidCharacterData({ text: 'Resilient Hero' }),
      validatorInstance,
    });

    expect(validatorInstance.validateInput).toHaveBeenCalled();
    expect(document.getElementById('error-message').textContent).toContain(
      'Generation timed out. Please try again.'
    );
    expect(document.getElementById('screen-reader-announcement').textContent)
      .toContain('Generation timed out. Please try again.');

    document
      .getElementById('retry-btn')
      .dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 700));
    await flushMicrotasks();

    expect(
      mocks.speechPatternsGenerator.generateSpeechPatterns
    ).toHaveBeenCalledTimes(2);
    expect(document.getElementById('speech-patterns-container').innerHTML)
      .toContain('Speaks softly when delivering difficult news');
  });

  it('announces minute-level time estimates for low and high confidence stages', async () => {
    const { dependencies, mocks } = createDependencies();

    const controller = createControllerInstance(dependencies);
    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.92 },
    });

    await enterCharacterDefinition({
      characterData: createValidCharacterData({ text: 'Minute Hero' }),
      validatorInstance,
    });

    setPerformanceSequence([
      0,
      0,
      120000,
      180000,
      240000,
      300000,
      360000,
      420000,
      480000,
      540000,
      600000,
      660000,
      720000,
      780000,
      840000,
    ]);

    let resolveGeneration;
    let capturedProgress;
    mocks.speechPatternsGenerator.generateSpeechPatterns.mockImplementation(
      (_definition, options) => {
        capturedProgress = options?.progressCallback;
        return new Promise((resolve) => {
          resolveGeneration = resolve;
        });
      }
    );

    document
      .getElementById('generate-btn')
      .dispatchEvent(new Event('click', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 200));
    await flushMicrotasks();

    expect(typeof capturedProgress).toBe('function');

    const timeEstimate = document.getElementById('time-estimate');

    capturedProgress(0);
    await flushMicrotasks();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(timeEstimate.textContent).toMatch(/\d+-\d+ minutes remaining/);

    capturedProgress(100);
    await flushMicrotasks();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(timeEstimate.textContent).toMatch(/About \d+ minute/);

    resolveGeneration({
      speechPatterns: [
        {
          pattern: 'Deliberate pacing in dialogue',
          example: '"Give me a moment to ponder our options."',
        },
      ],
      characterName: 'Minute Hero',
      generatedAt: new Date('2024-01-04T00:00:00Z').toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('announces cancellation when generation is aborted', async () => {
    jest.useFakeTimers();

    try {
      const { dependencies, mocks } = createDependencies();

      setPerformanceSequence([0, 50, 100, 200, 400, 600]);

      const controller = createControllerInstance(dependencies);
      await controller.initialize();

      const validatorInstance = getLatestValidatorInstance();
      validatorInstance.validateInput.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        quality: { overallScore: 0.9 },
      });

      await enterCharacterDefinition({
        characterData: createValidCharacterData({ text: 'Abort Hero' }),
        validatorInstance,
      });

      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      mocks.speechPatternsGenerator.generateSpeechPatterns.mockRejectedValueOnce(
        abortError
      );

      document
        .getElementById('generate-btn')
        .dispatchEvent(new Event('click', { bubbles: true }));

      await jest.advanceTimersByTimeAsync(500);
      await flushMicrotasks();

      expect(
        document.getElementById('screen-reader-announcement').textContent
      ).toBe('Generation cancelled');
    } finally {
      jest.useRealTimers();
    }
  });

  it('drops will-change optimization after pattern animation completes', async () => {
    const { dependencies, mocks } = createDependencies();

    setPerformanceSequence([
      0,
      1000,
      1200,
      1500,
      2000,
      2500,
      3000,
      3500,
      4000,
      4500,
      5000,
      5500,
    ]);

    const controller = createControllerInstance(dependencies);
    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.86 },
    });

    mocks.speechPatternsGenerator.generateSpeechPatterns.mockResolvedValue({
      speechPatterns: [
        {
          pattern: 'Measured tone when explaining plans',
          example: 'We move at dawn after careful scouting.',
          circumstances: 'Sharing tactical updates',
        },
      ],
      characterName: 'Animated Hero',
      generatedAt: new Date('2024-01-05T00:00:00Z').toISOString(),
    });

    await waitForValidationAndGeneration({
      characterData: createValidCharacterData({ text: 'Animated Hero' }),
      validatorInstance,
    });

    const pattern = document.querySelector('.speech-pattern-item');
    expect(pattern.style.willChange).toBe('transform, opacity');

    pattern.dispatchEvent(new Event('animationend'));
    expect(pattern.style.willChange).toBe('auto');
  });

  it('uses enhancer export text when template remains default', async () => {
    const { dependencies, mocks } = createDependencies({
      withDisplayEnhancer: true,
    });

    const displayEnhancer = mocks.displayEnhancer;
    displayEnhancer.getSupportedExportFormats.mockReturnValue([
      {
        id: 'txt',
        name: 'Text',
        extension: '.txt',
        mimeType: 'text/plain',
        description: 'Plain text export',
      },
    ]);
    displayEnhancer.getAvailableTemplates.mockReturnValue([
      { id: 'default', name: 'Default', description: 'Default layout' },
    ]);
    displayEnhancer.enhanceForDisplay.mockImplementation((patterns) => ({
      characterName: patterns.characterName,
      totalCount: patterns.speechPatterns.length,
      patterns: patterns.speechPatterns.map((pattern, index) => ({
        index: index + 1,
        htmlSafePattern: pattern.pattern,
        htmlSafeExample: pattern.example,
        circumstances: pattern.circumstances,
      })),
    }));
    displayEnhancer.formatForExport.mockReturnValue('Enhanced export text');
    displayEnhancer.generateExportFilename.mockReturnValue('default.txt');
    displayEnhancer.applyTemplate.mockReturnValue('templated text');

    const controller = createControllerInstance(dependencies);
    const originalCache = controller._cacheElements.bind(controller);
    controller._cacheElements = function () {
      originalCache();
      this._cacheElementsFromMap({
        exportFormat: '#export-format',
        exportTemplate: '#export-template',
        templateGroup: '#template-group',
      });
    };

    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.9 },
    });

    mocks.speechPatternsGenerator.generateSpeechPatterns.mockResolvedValue({
      speechPatterns: [
        {
          pattern: 'Enthusiastic greetings',
          example: 'It is wonderful to see you again!',
          circumstances: 'Meeting allies',
        },
      ],
      characterName: 'Template Hero',
      generatedAt: new Date('2024-01-06T00:00:00Z').toISOString(),
    });

    await waitForValidationAndGeneration({
      characterData: createValidCharacterData({ text: 'Template Hero' }),
      validatorInstance,
    });

    const exportFormat = document.getElementById('export-format');
    exportFormat.value = 'txt';
    const exportTemplate = document.getElementById('export-template');
    exportTemplate.value = 'default';

    displayEnhancer.applyTemplate.mockClear();

    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        element.click = jest.fn();
      }
      return element;
    });

    document
      .getElementById('export-btn')
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(displayEnhancer.applyTemplate).not.toHaveBeenCalled();
    const blobContent = global.Blob.mock.calls[global.Blob.mock.calls.length - 1][0][0];
    expect(blobContent).toBe('Enhanced export text');

    document.createElement.mockRestore();
  });

  it('reports export failures and surfaces message in error state', async () => {
    const { dependencies, mocks } = createDependencies({
      withDisplayEnhancer: true,
    });

    const displayEnhancer = mocks.displayEnhancer;
    displayEnhancer.getSupportedExportFormats.mockReturnValue([
      {
        id: 'txt',
        name: 'Text',
        extension: '.txt',
        mimeType: 'text/plain',
        description: 'Plain text export',
      },
    ]);
    displayEnhancer.getAvailableTemplates.mockReturnValue([
      { id: 'default', name: 'Default', description: 'Default layout' },
    ]);
    displayEnhancer.enhanceForDisplay.mockImplementation((patterns) => ({
      characterName: patterns.characterName,
      totalCount: patterns.speechPatterns.length,
      patterns: patterns.speechPatterns.map((pattern, index) => ({
        index: index + 1,
        htmlSafePattern: pattern.pattern,
        htmlSafeExample: pattern.example,
        circumstances: pattern.circumstances,
      })),
    }));
    displayEnhancer.generateExportFilename.mockReturnValue('error.txt');
    displayEnhancer.formatForExport.mockImplementation(() => {
      throw new Error('export broke');
    });

    setPerformanceSequence([0, 1000, 1200, 1500, 2000, 2500, 3000, 3500]);

    const controller = createControllerInstance(dependencies);
    const originalCache = controller._cacheElements.bind(controller);
    controller._cacheElements = function () {
      originalCache();
      this._cacheElementsFromMap({
        exportFormat: '#export-format',
        exportTemplate: '#export-template',
        templateGroup: '#template-group',
      });
    };

    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.9 },
    });

    mocks.speechPatternsGenerator.generateSpeechPatterns.mockResolvedValue({
      speechPatterns: [
        {
          pattern: 'Unexpected pauses',
          example: 'Um... let me think about that.',
          circumstances: 'When faced with surprises',
        },
      ],
      characterName: 'Export Failure Hero',
      generatedAt: new Date('2024-01-07T00:00:00Z').toISOString(),
    });

    await waitForValidationAndGeneration({
      characterData: createValidCharacterData({ text: 'Export Failure Hero' }),
      validatorInstance,
    });

    document
      .getElementById('export-btn')
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Export failed:',
      expect.any(Error)
    );
    expect(document.getElementById('error-message').textContent).toBe(
      'Failed to export speech patterns'
    );
  });

  it('clear-all shortcut and escape key abort active generation flows', async () => {
    jest.useFakeTimers();

    const OriginalAbortController = global.AbortController;

    try {
      const abortControllers = [];
      global.AbortController = class {
        constructor() {
          this.signal = { aborted: false };
          abortControllers.push(this);
        }

        abort() {
          this.signal.aborted = true;
        }
      };

      const { dependencies, mocks } = createDependencies();
      setPerformanceSequence([0, 100, 200, 300, 400, 500, 600, 700]);

      const controller = createControllerInstance(dependencies);
      await controller.initialize();

      const validatorInstance = getLatestValidatorInstance();
      validatorInstance.validateInput.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        quality: { overallScore: 0.88 },
      });

      await enterCharacterDefinition({
        characterData: createValidCharacterData({ text: 'Abort Hero' }),
        validatorInstance,
      });

      let resolveGeneration;
      mocks.speechPatternsGenerator.generateSpeechPatterns.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          })
      );

      document
        .getElementById('generate-btn')
        .dispatchEvent(new Event('click', { bubbles: true }));

      await jest.advanceTimersByTimeAsync(200);
      await flushMicrotasks();

      expect(abortControllers).toHaveLength(1);

      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Delete',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        })
      );

      expect(abortControllers[0].signal.aborted).toBe(true);
      expect(document.getElementById('character-definition').value).toBe('');

      resolveGeneration({
        speechPatterns: [
          { pattern: 'Post-clear speech', example: 'All clear!' },
        ],
        characterName: 'Abort Hero',
        generatedAt: new Date('2024-01-08T00:00:00Z').toISOString(),
      });

      await flushMicrotasks();
      await jest.advanceTimersByTimeAsync(400);

      await enterCharacterDefinition({
        characterData: createValidCharacterData({ text: 'Escape Hero' }),
        validatorInstance,
      });

      let resolveSecondGeneration;
      mocks.speechPatternsGenerator.generateSpeechPatterns.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondGeneration = resolve;
          })
      );

      document
        .getElementById('generate-btn')
        .dispatchEvent(new Event('click', { bubbles: true }));

      await jest.advanceTimersByTimeAsync(200);

      expect(abortControllers).toHaveLength(2);

      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
        })
      );

      expect(abortControllers[1].signal.aborted).toBe(true);

      resolveSecondGeneration({
        speechPatterns: [
          { pattern: 'Cancelled speech', example: 'Stopping now.' },
        ],
        characterName: 'Escape Hero',
        generatedAt: new Date('2024-01-09T00:00:00Z').toISOString(),
      });

      await flushMicrotasks();
      await jest.advanceTimersByTimeAsync(400);

    } finally {
      global.AbortController = OriginalAbortController;
      jest.useRealTimers();
    }
  });

  it.each([
    [
      { name: 'SpeechPatternsGenerationError', message: 'LLM offline' },
      'Failed to generate speech patterns: LLM offline',
    ],
    [
      {
        name: 'SpeechPatternsResponseProcessingError',
        message: 'Malformed payload',
      },
      'Failed to process response: Malformed payload',
    ],
    [
      { name: 'SpeechPatternsValidationError', message: 'Quality gate failed' },
      'Generated content validation failed: Quality gate failed',
    ],
    [{ message: 'Service unavailable right now' },
      'Speech pattern service is currently unavailable. Please try again later.'],
    [{ message: 'Downstream validation mismatch' },
      'Generated content did not meet quality standards. Please try again.'],
  ])(
    'maps %p to descriptive error output',
    async (errorLike, expectedMessage) => {
      const { dependencies, mocks } = createDependencies();

      setPerformanceSequence([0, 1000, 1200, 1500, 2000, 2500, 3000, 3500]);

      const controller = createControllerInstance(dependencies);
      await controller.initialize();

      const validatorInstance = getLatestValidatorInstance();
      validatorInstance.validateInput.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        quality: { overallScore: 0.82 },
      });

      mocks.speechPatternsGenerator.generateSpeechPatterns.mockRejectedValueOnce(
        errorLike
      );

      await waitForValidationAndGeneration({
        characterData: createValidCharacterData({ text: 'Error Hero' }),
        validatorInstance,
        waitMs: 800,
      });

      expect(document.getElementById('error-message').textContent).toBe(
        expectedMessage
      );
    }
  );

  it('displays inline validation errors when enhanced validator is unavailable', async () => {
    setValidatorBehavior(() => {
      throw new Error('enhanced validator offline');
    });

    const { dependencies } = createDependencies();

    const controller = createControllerInstance(dependencies);
    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    const generateBtn = document.getElementById('generate-btn');
    const errorContainer = document.getElementById('character-input-error');

    textarea.value = '{ invalid json';
    textarea.dispatchEvent(new Event('blur', { bubbles: true }));
    await flushMicrotasks();

    expect(generateBtn.disabled).toBe(true);
    expect(errorContainer.innerHTML).toContain('JSON Syntax Error');
    expect(textarea.classList.contains('error')).toBe(true);
  });

  it('auto hides validation success message after display timeout', async () => {
    jest.useFakeTimers();

    try {
      const { dependencies, mocks } = createDependencies();
      const controller = createControllerInstance(dependencies);
      await controller.initialize();

      const validatorInstance = getLatestValidatorInstance();
      validatorInstance.validateInput.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        quality: { overallScore: 0.9 },
      });

      await enterCharacterDefinition({
        characterData: createValidCharacterData({ text: 'Success Hero' }),
        validatorInstance,
      });

      const errorContainer = document.getElementById('character-input-error');
      expect(errorContainer.innerHTML).toContain('Excellent character definition');

      await jest.advanceTimersByTimeAsync(3100);
      expect(errorContainer.style.display).toBe('none');
    } finally {
      jest.useRealTimers();
    }
  });

  it('supports collapsing validation feedback sections via pointer and keyboard', async () => {
    const { dependencies, mocks } = createDependencies();
    const controller = createControllerInstance(dependencies);
    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: false,
      errors: ['Blocking issue'],
      warnings: ['Consider adding more history'],
      suggestions: ['Maybe include favorite sayings'],
      quality: { overallScore: 0.45 },
    });

    await enterCharacterDefinition({
      characterData: createValidCharacterData({ text: 'Feedback Hero' }),
      validatorInstance,
    });

    const warningsSectionTitle = document.querySelector(
      '.validation-warnings .validation-section-title'
    );
    const warningsList = document.querySelector(
      '.validation-warnings .validation-list'
    );

    expect(warningsSectionTitle.getAttribute('aria-expanded')).toBe('true');

    warningsSectionTitle.dispatchEvent(new Event('click', { bubbles: true }));
    expect(warningsSectionTitle.getAttribute('aria-expanded')).toBe('false');
    expect(warningsList.style.display).toBe('none');

    const keyEvent = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
    });
    warningsSectionTitle.dispatchEvent(keyEvent);
    expect(warningsSectionTitle.getAttribute('aria-expanded')).toBe('true');
    expect(warningsList.style.display).toBe('block');
  });

  it('keyboard shortcuts trigger generation and export actions', async () => {
    const { dependencies, mocks } = createDependencies({
      withDisplayEnhancer: true,
    });

    const displayEnhancer = mocks.displayEnhancer;
    displayEnhancer.getSupportedExportFormats.mockReturnValue([
      {
        id: 'txt',
        name: 'Text',
        extension: '.txt',
        mimeType: 'text/plain',
        description: 'Plain text export',
      },
    ]);
    displayEnhancer.getAvailableTemplates.mockReturnValue([
      { id: 'default', name: 'Default', description: 'Default layout' },
    ]);
    displayEnhancer.enhanceForDisplay.mockImplementation((patterns) => ({
      characterName: patterns.characterName,
      totalCount: patterns.speechPatterns.length,
      patterns: patterns.speechPatterns.map((pattern, index) => ({
        index: index + 1,
        htmlSafePattern: pattern.pattern,
        htmlSafeExample: pattern.example,
        circumstances: pattern.circumstances,
      })),
    }));
    displayEnhancer.formatForExport.mockReturnValue('Keyboard export');
    displayEnhancer.generateExportFilename.mockReturnValue('keyboard.txt');

    setPerformanceSequence([0, 1000, 1200, 1500, 2000, 2500, 3000, 3500]);

    const controller = createControllerInstance(dependencies);
    const originalCache = controller._cacheElements.bind(controller);
    controller._cacheElements = function () {
      originalCache();
      this._cacheElementsFromMap({
        exportFormat: '#export-format',
        exportTemplate: '#export-template',
        templateGroup: '#template-group',
      });
    };

    await controller.initialize();

    const validatorInstance = getLatestValidatorInstance();
    validatorInstance.validateInput.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: { overallScore: 0.87 },
    });

    await enterCharacterDefinition({
      characterData: createValidCharacterData({ text: 'Shortcut Hero' }),
      validatorInstance,
    });

    mocks.speechPatternsGenerator.generateSpeechPatterns.mockImplementation(
      async () => ({
        speechPatterns: [
          {
            pattern: 'Confident replies',
            example: 'We are ready to proceed.',
            circumstances: 'When a plan is set',
          },
        ],
        characterName: 'Shortcut Hero',
        generatedAt: new Date('2024-01-10T00:00:00Z').toISOString(),
      })
    );

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
    });
    Object.defineProperty(enterEvent, 'preventDefault', {
      value: jest.fn(),
      configurable: true,
    });
    document.body.dispatchEvent(enterEvent);

    await new Promise((resolve) => setTimeout(resolve, 700));
    await flushMicrotasks();

    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(mocks.speechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalledTimes(
      1
    );

    const exportEvent = new KeyboardEvent('keydown', {
      key: 'e',
      ctrlKey: true,
      bubbles: true,
    });
    Object.defineProperty(exportEvent, 'preventDefault', {
      value: jest.fn(),
      configurable: true,
    });
    const originalCreateElementShortcuts = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = originalCreateElementShortcuts(tag);
      if (tag === 'a') {
        element.click = jest.fn();
      }
      return element;
    });

    document.body.dispatchEvent(exportEvent);

    expect(exportEvent.preventDefault).toHaveBeenCalled();
    expect(global.Blob).toHaveBeenCalled();

    document.createElement.mockRestore();
  });
});
