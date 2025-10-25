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

let performanceSequence = [];
let performanceIndex = 0;
let rafIdCounter = 0;
let rafTimers = new Map();

const setPerformanceSequence = (sequence) => {
  performanceSequence = sequence;
  performanceIndex = 0;
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
    const controller = new SpeechPatternsGeneratorController(dependencies);

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

    const controller = new SpeechPatternsGeneratorController(dependencies);
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

    const controller = new SpeechPatternsGeneratorController(dependencies);
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

    const controller = new SpeechPatternsGeneratorController(dependencies);
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
});
