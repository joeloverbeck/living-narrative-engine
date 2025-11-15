import { beforeEach, describe, it, afterEach, expect, jest } from '@jest/globals';
import { SpeechPatternsGeneratorController } from '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import SpeechPatternsDisplayEnhancer from '../../../src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js';

class ExportAwareSpeechPatternsGeneratorController extends SpeechPatternsGeneratorController {
  /**
   * Extend element caching so export-specific controls are tracked during tests.
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

function buildDom(includeExportControls = true) {
  document.body.innerHTML = `
    <div id="app">
      <textarea id="character-definition"></textarea>
      <div id="character-input-error" style="display: none"></div>
      <button id="generate-btn" disabled>Generate</button>
      <button id="export-btn" disabled>Export</button>
      <button id="clear-all-btn" disabled>Clear</button>
      <button id="back-btn">Back</button>
      <div id="loading-state" style="display: none"></div>
      <div id="results-state" style="display: none"></div>
      <div id="error-state" style="display: none"></div>
      <div id="empty-state"></div>
      <div id="speech-patterns-container"></div>
      <div id="loading-indicator"></div>
      <div id="loading-message"></div>
      <div id="progress-container" style="display: none"></div>
      <div id="progress-bar" class="progress-bar"></div>
      <div id="time-estimate" style="display: none"></div>
      <div id="pattern-count"></div>
      <div id="error-message"></div>
      <button id="retry-btn">Retry</button>
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

function createMinimalDependencies(overrides = {}) {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const characterBuilderService = {
    initialize: jest.fn().mockResolvedValue(),
    getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
    createCharacterConcept: jest.fn().mockResolvedValue({ id: 'test-id' }),
    updateCharacterConcept: jest.fn().mockResolvedValue(),
    deleteCharacterConcept: jest.fn().mockResolvedValue(),
    getCharacterConcept: jest.fn().mockResolvedValue(null),
    generateThematicDirections: jest.fn().mockResolvedValue([]),
    getThematicDirections: jest.fn().mockResolvedValue([]),
  };

  const eventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };

  const schemaValidator = {
    validate: jest.fn(),
  };

  const baseDependencies = {
    logger,
    characterBuilderService,
    eventBus,
    schemaValidator,
    ...overrides,
  };

  return baseDependencies;
}

function createValidCharacterDefinition() {
  const detailedProfile = 'A character with deeply developed background and motivations '.repeat(5);
  return {
    components: {
      'core:name': { text: 'Professor Ada Lovette' },
      'core:personality': {
        traits: ['curious', 'methodical', 'compassionate'],
        description: detailedProfile,
      },
      'core:profile': {
        biography: detailedProfile,
        occupation: 'Linguistics Professor',
      },
    },
  };
}

async function readBlobAsText(blob) {
  if (blob && typeof blob.text === 'function') {
    return blob.text();
  }

  if (typeof FileReader !== 'undefined' && blob) {
    try {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
    } catch (error) {
      // Ignore and continue to other fallbacks
    }
  }

  if (blob && typeof blob.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }

  return String(blob);
}

async function advanceTimersByTime(duration) {
  await jest.advanceTimersByTimeAsync(duration);
}

async function waitForCondition(predicate, { interval = 50, timeout = 2000 } = {}) {
  const attempts = Math.ceil(timeout / interval);
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) {
      return;
    }
    await advanceTimersByTime(interval);
  }

  throw new Error('Timed out waiting for condition in integration test');
}

describe('SpeechPatternsGeneratorController integration UI flows', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders generated patterns using the fallback display path and updates progress UI', async () => {
    buildDom(false);

    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn().mockImplementation(async (_definition, options = {}) => {
        if (options.progressCallback) {
          [10, 55, 100].forEach((value) => {
            options.progressCallback(value);
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 50));

        const generatedAt = new Date('2024-01-01T12:00:00Z').toISOString();
        const speechPatterns = [
          {
            pattern: 'Speaks in precise academic terminology.',
            example: 'Allow me to delineate the primary hypothesis underpinning this study.',
            circumstances: 'During formal lectures',
          },
          {
            pattern: 'Uses warm encouragement when mentoring students.',
            example: 'You have articulated your argument beautifully; keep refining it.',
            circumstances: 'Mentorship sessions',
          },
          {
            pattern: 'Adds a whimsical metaphor when excited.',
            example: 'This discovery sparkles like a prism catching morning light!',
            circumstances: 'Upon unexpected breakthroughs',
          },
        ];

        return {
          characterName: 'Professor Ada Lovette',
          generatedAt,
          speechPatterns,
        };
      }),
    };

    const dependencies = createMinimalDependencies({ speechPatternsGenerator });
    const controller = new ExportAwareSpeechPatternsGeneratorController(dependencies);
    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    textarea.value = JSON.stringify(createValidCharacterDefinition(), null, 2);

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await advanceTimersByTime(350);

    const generateBtn = document.getElementById('generate-btn');
    await waitForCondition(() => !generateBtn.disabled);
    expect(generateBtn.disabled).toBe(false);

    generateBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await advanceTimersByTime(800);

    const resultsState = document.getElementById('results-state');
    expect(resultsState.style.display).toBe('block');

    const renderedPatterns = document.querySelectorAll('.speech-pattern-item');
    expect(renderedPatterns).toHaveLength(3);
    expect(renderedPatterns[0].innerHTML).toContain('Speaks in precise academic terminology');
    expect(renderedPatterns[1].innerHTML).toContain('Mentorship sessions');

    const patternCount = document.getElementById('pattern-count');
    expect(patternCount.textContent).toBe('3 patterns generated');

    const progressBar = document.getElementById('progress-bar');
    expect(progressBar.style.width).toBe('100%');
    expect(progressBar.classList.contains('high-confidence')).toBe(true);

    const progressContainer = document.getElementById('progress-container');
    expect(progressContainer.style.display).toBe('block');

    const timeEstimate = document.getElementById('time-estimate');
    expect(['none', 'block']).toContain(timeEstimate.style.display);

    const announcement = document.getElementById('screen-reader-announcement');
    expect(announcement.textContent).toContain('Generated 3 speech patterns for Professor Ada Lovette');

    expect(speechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalledTimes(1);
  });

  it('exports generated content using the display enhancer formatting options', async () => {
    buildDom(true);

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const displayEnhancer = new SpeechPatternsDisplayEnhancer({ logger });

    const speechPatternsGenerator = {
      getServiceInfo: jest.fn(),
      generateSpeechPatterns: jest.fn().mockResolvedValue({
        characterName: 'Ada Lovette',
        generatedAt: new Date('2024-03-15T18:00:00Z').toISOString(),
        speechPatterns: [
          {
            pattern: 'Delivers precise academic statements.',
            example: 'The evidence strongly corroborates our initial thesis.',
            circumstances: 'During research presentations',
          },
          {
            pattern: 'Includes historical anecdotes when teaching.',
            example: 'In 1843, Ada Lovelace anticipated modern computing in her notes.',
            circumstances: 'Undergraduate lectures',
          },
        ],
      }),
    };

    const dependencies = createMinimalDependencies({
      logger,
      speechPatternsGenerator,
      speechPatternsDisplayEnhancer: displayEnhancer,
    });

    const formatsSpy = jest.spyOn(displayEnhancer, 'getSupportedExportFormats');
    const templatesSpy = jest.spyOn(displayEnhancer, 'getAvailableTemplates');
    const formatJsonSpy = jest.spyOn(displayEnhancer, 'formatAsJson');
    const applyTemplateSpy = jest.spyOn(displayEnhancer, 'applyTemplate');

    const controller = new ExportAwareSpeechPatternsGeneratorController(dependencies);
    await controller.initialize();

    const exportFormat = document.getElementById('exportFormat');
    const exportTemplate = document.getElementById('exportTemplate');
    const templateGroup = document.getElementById('templateGroup');

    expect(formatsSpy).toHaveBeenCalledTimes(1);
    expect(templatesSpy).toHaveBeenCalledTimes(1);
    expect(templateGroup.style.display).toBe('flex');

    const textarea = document.getElementById('character-definition');
    textarea.value = JSON.stringify(createValidCharacterDefinition(), null, 2);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await advanceTimersByTime(350);

    document.getElementById('generate-btn').dispatchEvent(new Event('click', { bubbles: true }));
    await advanceTimersByTime(500);

    const urlSpy = jest.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      urlSpy.mock.blob = blob;
      return 'blob:integration';
    });
    const revokeSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    let capturedDownloadName = '';
    const clickSpy = jest
      .spyOn(window.HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function clickStub() {
        capturedDownloadName = this.download;
      });

    exportFormat.value = 'json';
    exportFormat.dispatchEvent(new Event('change', { bubbles: true }));
    expect(templateGroup.style.display).toBe('none');

    document.getElementById('export-btn').dispatchEvent(new Event('click', { bubbles: true }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(capturedDownloadName).toMatch(/ada_lovette/);

    expect(formatJsonSpy).toHaveBeenCalledTimes(1);

    urlSpy.mockClear();
    clickSpy.mockClear();

    exportFormat.value = 'txt';
    exportFormat.dispatchEvent(new Event('change', { bubbles: true }));
    exportTemplate.value = 'summary';

    document.getElementById('export-btn').dispatchEvent(new Event('click', { bubbles: true }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(applyTemplateSpy).toHaveBeenCalledWith(
      expect.any(Object),
      'summary',
      expect.objectContaining({ includeCharacterData: true })
    );

    const announcement = document.getElementById('screen-reader-announcement');
    expect(announcement.textContent).toContain('Speech patterns exported as');

    clickSpy.mockRestore();
    urlSpy.mockRestore();
    revokeSpy.mockRestore();
    formatsSpy.mockRestore();
    templatesSpy.mockRestore();
    formatJsonSpy.mockRestore();
    applyTemplateSpy.mockRestore();
  });

  it('displays service errors, allows retry, and clears all UI state', async () => {
    buildDom(true);

    let attempt = 0;
    const speechPatternsGenerator = {
      getServiceInfo: jest.fn(),
      generateSpeechPatterns: jest.fn().mockImplementation(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('Generation timeout occurred');
        }

        return {
          characterName: 'Retry Hero',
          generatedAt: new Date('2024-04-01T09:30:00Z').toISOString(),
          speechPatterns: [
            {
              pattern: 'Speaks succinctly after setbacks.',
              example: 'Let us try once more with renewed focus.',
              circumstances: 'Immediately after recovering from an error',
            },
          ],
        };
      }),
    };

    const dependencies = createMinimalDependencies({ speechPatternsGenerator });
    const controller = new SpeechPatternsGeneratorController(dependencies);
    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    textarea.value = JSON.stringify(createValidCharacterDefinition(), null, 2);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await advanceTimersByTime(350);

    document.getElementById('generate-btn').dispatchEvent(new Event('click', { bubbles: true }));
    await advanceTimersByTime(400);

    const errorState = document.getElementById('error-state');
    expect(['block', 'flex']).toContain(errorState.style.display);

    const errorMessage = document.getElementById('error-message');
    expect(errorMessage.textContent).toBe('Generation timed out. Please try again.');

    const announcement = document.getElementById('screen-reader-announcement');
    expect(announcement.textContent).toContain('Generation timed out');

    document.getElementById('retry-btn').dispatchEvent(new Event('click', { bubbles: true }));
    await advanceTimersByTime(600);

    const resultsState = document.getElementById('results-state');
    expect(resultsState.style.display).toBe('block');
    expect(document.querySelectorAll('.speech-pattern-item')).toHaveLength(1);

    document.getElementById('clear-all-btn').dispatchEvent(new Event('click', { bubbles: true }));
    await advanceTimersByTime(50);

    expect(textarea.value).toBe('');
    expect(document.getElementById('results-state').style.display).toBe('none');
    expect(['block', 'flex']).toContain(
      document.getElementById('empty-state').style.display
    );
    expect(document.getElementById('generate-btn').disabled).toBe(true);
  });

  it('prevents overlapping generation when the generate button is activated repeatedly', async () => {
    buildDom(false);

    const generationResult = {
      characterName: 'Double Click Hero',
      generatedAt: new Date('2024-05-02T09:00:00Z').toISOString(),
      speechPatterns: [
        {
          pattern: 'Responds with careful pauses.',
          example: 'Allow me a heartbeat to collect the proper phrasing.',
          circumstances: 'When asked tough questions',
        },
      ],
    };

    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(generationResult), 250);
            })
        ),
    };

    const dependencies = createMinimalDependencies({ speechPatternsGenerator });
    const controller = new SpeechPatternsGeneratorController(dependencies);
    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    textarea.value = JSON.stringify(createValidCharacterDefinition(), null, 2);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await advanceTimersByTime(350);
    textarea.dispatchEvent(new Event('blur', { bubbles: true }));
    await advanceTimersByTime(400);

    const generateBtn = document.getElementById('generate-btn');
    expect(generateBtn.disabled).toBe(false);
    generateBtn.dispatchEvent(new Event('click', { bubbles: true }));
    generateBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await advanceTimersByTime(400);
    expect(speechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalledTimes(1);

    await advanceTimersByTime(600);

    const resultsState = document.getElementById('results-state');
    expect(resultsState.style.display).toBe('block');
    expect(document.querySelectorAll('.speech-pattern-item')).toHaveLength(1);
  });

  it('exports fallback text when no display enhancer is provided', async () => {
    buildDom(true);

    const generatedAt = new Date('2024-06-01T12:00:00Z').toISOString();
    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn().mockResolvedValue({
        characterName: 'Professor Ada Lovette',
        generatedAt,
        speechPatterns: [
          {
            pattern: 'Speaks in precise academic terminology.',
            example: 'Allow me to delineate the underlying hypothesis.',
            circumstances: 'Formal lectures',
          },
          {
            pattern: 'Adds whimsical metaphors when excited.',
            example: 'This breakthrough sparkles brighter than morning dew.',
            circumstances: 'Unexpected discoveries',
          },
        ],
      }),
    };

    const dependencies = createMinimalDependencies({ speechPatternsGenerator });
    const controller = new ExportAwareSpeechPatternsGeneratorController(dependencies);
    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    textarea.value = JSON.stringify(createValidCharacterDefinition(), null, 2);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await advanceTimersByTime(350);

    document.getElementById('generate-btn').dispatchEvent(new Event('click', { bubbles: true }));
    await advanceTimersByTime(700);

    const firstPattern = document.querySelector('.speech-pattern-item');
    expect(firstPattern.style.willChange).toBe('transform, opacity');
    firstPattern.dispatchEvent(new Event('animationend'));
    expect(firstPattern.style.willChange).toBe('auto');

    const exportBtn = document.getElementById('export-btn');
    expect(exportBtn.disabled).toBe(false);

    const exportFormat = document.getElementById('exportFormat');
    if (exportFormat) {
      exportFormat.value = 'txt';
    }

    let capturedBlob = null;
    const OriginalBlob = global.Blob;
    class CapturingBlob {
      constructor(parts, options = {}) {
        this.type = options?.type || '';
        this._text = parts
          .map((part) => (typeof part === 'string' ? part : String(part)))
          .join('');
      }

      text() {
        return Promise.resolve(this._text);
      }
    }

    global.Blob = CapturingBlob;

    const urlSpy = jest
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:fallback';
      });
    const revokeSpy = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    let capturedDownloadName = '';
    const clickSpy = jest
      .spyOn(window.HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function clickStub() {
        capturedDownloadName = this.download;
      });

    try {
      exportBtn.dispatchEvent(new Event('click', { bubbles: true }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(capturedDownloadName).toMatch(/speech_patterns_professor_ada_lovette_/);
      expect(capturedBlob).not.toBeNull();
      expect(capturedBlob.type).toBe('text/plain;charset=utf-8');

      const exportedText = await capturedBlob.text();
      expect(exportedText).toContain('Character Definition:');
      expect(exportedText).toContain('Speaks in precise academic terminology.');

      const announcement = document.getElementById('screen-reader-announcement');
      expect(announcement.textContent).toContain('Speech patterns exported as TXT');
    } finally {
      clickSpy.mockRestore();
      urlSpy.mockRestore();
      revokeSpy.mockRestore();
      global.Blob = OriginalBlob;
    }
  });

  it('surfaces an inline error if export is triggered without generated patterns', async () => {
    buildDom(true);

    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn(),
    };

    const dependencies = createMinimalDependencies({ speechPatternsGenerator });
    const controller = new ExportAwareSpeechPatternsGeneratorController(dependencies);
    await controller.initialize();

    const exportBtn = document.getElementById('export-btn');
    exportBtn.disabled = false;
    exportBtn.dispatchEvent(new Event('click', { bubbles: true }));

    const errorMessage = document.getElementById('error-message');
    expect(errorMessage.textContent).toBe('No speech patterns to export');
  });

  it('logs and displays an error when the display enhancer fails to export', async () => {
    buildDom(true);

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const displayEnhancer = new SpeechPatternsDisplayEnhancer({ logger });
    const formatSpy = jest
      .spyOn(displayEnhancer, 'formatForExport')
      .mockImplementation(() => {
        throw new Error('Formatting exploded');
      });

    const speechPatternsGenerator = {
      getServiceInfo: jest.fn().mockReturnValue({ version: 'integration' }),
      generateSpeechPatterns: jest.fn().mockResolvedValue({
        characterName: 'Export Failure Subject',
        generatedAt: new Date('2024-07-10T15:00:00Z').toISOString(),
        speechPatterns: [
          {
            pattern: 'Uses clipped sentences when anxious.',
            example: 'Need facts. No fluff.',
            circumstances: 'During tense negotiations',
          },
        ],
      }),
    };

    const dependencies = createMinimalDependencies({
      logger,
      speechPatternsGenerator,
      speechPatternsDisplayEnhancer: displayEnhancer,
    });

    const controller = new ExportAwareSpeechPatternsGeneratorController(dependencies);
    await controller.initialize();

    const textarea = document.getElementById('character-definition');
    textarea.value = JSON.stringify(createValidCharacterDefinition(), null, 2);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await advanceTimersByTime(350);

    document.getElementById('generate-btn').dispatchEvent(new Event('click', { bubbles: true }));
    await advanceTimersByTime(600);

    document.getElementById('export-btn').dispatchEvent(new Event('click', { bubbles: true }));

    expect(logger.error).toHaveBeenCalledWith('Export failed:', expect.any(Error));
    const errorMessage = document.getElementById('error-message');
    expect(errorMessage.textContent).toBe('Failed to export speech patterns');

    formatSpy.mockRestore();
  });
});
