/**
 * @file Unit tests for SpeechPatternsGeneratorController keyboard shortcuts and accessibility helpers
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SpeechPatternsGeneratorController } from '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { ControllerLifecycleOrchestrator } from '../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { DOMElementManager } from '../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../src/characterBuilder/services/eventListenerRegistry.js';
import { AsyncUtilitiesToolkit } from '../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { PerformanceMonitor } from '../../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../../src/characterBuilder/services/memoryManager.js';
import { ErrorHandlingStrategy } from '../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { ValidationService } from '../../../src/characterBuilder/services/validationService.js';
import {
  createMockSpeechPatterns,
} from '../../common/characterBuilder/speechPatternsTestHelpers.js';

describe('SpeechPatternsGeneratorController - keyboard shortcuts and accessibility', () => {
  let mockLogger;
  let mockEventBus;
  let mockSchemaValidator;
  let mockCharacterBuilderService;
  let mockSpeechPatternsGenerator;
  let mockDisplayEnhancer;
  let controllerLifecycleOrchestrator;
  let domElementManager;
  let eventListenerRegistry;
  let asyncUtilitiesToolkit;
  let performanceMonitor;
  let memoryManager;
  let errorHandlingStrategy;
  let validationService;
  let controller;
  let mockElements;

  const buildCharacterDefinition = () =>
    JSON.stringify(
      {
        $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'test:character',
        components: {
          'core:name': {
            text:
              'Test Character with a detailed backstory that exceeds validation thresholds for length and structure.',
          },
          'core:personality': {
            traits: ['brave', 'kind', 'curious'],
            description:
              'A richly described personality that provides enough depth to satisfy structural validation requirements.',
          },
          'core:profile': {
            background:
              'An extended narrative background that comfortably clears the detailed content checks within the validator logic.',
            age: 30,
            occupation: 'Explorer',
          },
          'core:goals': {
            ambitions:
              'Documenting forgotten histories across multiple regions with thorough notes and reflective commentary.',
          },
        },
      },
      null,
      2
    );

  beforeEach(async () => {
    jest.useFakeTimers();
    document.body.innerHTML = '';

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
      validateAgainstSchema: jest.fn().mockReturnValue({ isValid: true }),
      getSchema: jest.fn(),
      loadSchema: jest.fn(),
      loadSchemas: jest.fn(),
      hasSchema: jest.fn().mockReturnValue(true),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(true),
      getAllCharacterConcepts: jest.fn().mockReturnValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      setSpeechPatterns: jest.fn(),
      getSpeechPatterns: jest.fn(),
    };

    mockSpeechPatternsGenerator = {
      generateSpeechPatterns: jest.fn(),
      getServiceInfo: jest.fn().mockReturnValue({ version: '1.0.0' }),
    };

    mockDisplayEnhancer = {
      enhanceForDisplay: jest.fn((patterns) => ({
        characterName: patterns.characterName,
        generatedAt: patterns.generatedAt,
        patterns: patterns.speechPatterns.map((pattern, index) => ({
          index: index + 1,
          pattern: pattern.pattern || pattern.type || 'Pattern',
          example: pattern.example || pattern.examples?.[0] || 'example',
          circumstances: pattern.circumstances || pattern.contexts?.[0] || 'context',
          htmlSafeExamples: [pattern.example || pattern.examples?.[0] || 'example'],
          htmlSafeContexts: [
            pattern.circumstances || pattern.contexts?.[0] || 'context',
          ],
          metadata: {},
        })),
      })),
      formatForExport: jest.fn().mockReturnValue('export text'),
      generateExportFilename: jest.fn().mockReturnValue('speech_patterns.txt'),
      applyTemplate: jest.fn().mockReturnValue('templated export'),
      formatAsJson: jest.fn().mockReturnValue('{"json":true}'),
      formatAsMarkdown: jest.fn().mockReturnValue('# markdown'),
      formatAsCsv: jest.fn().mockReturnValue('csv,data'),
      getSupportedExportFormats: jest.fn().mockReturnValue([
        { id: 'txt', name: 'Text', description: 'Plain text', extension: 'txt', mimeType: 'text/plain' },
        { id: 'json', name: 'JSON', description: 'JSON export', extension: 'json', mimeType: 'application/json' },
      ]),
      getAvailableTemplates: jest.fn().mockReturnValue([
        { id: 'default', name: 'Default', description: 'Default template' },
        { id: 'short', name: 'Short', description: 'Condensed export' },
      ]),
    };

    mockElements = {
      characterDefinition: document.createElement('textarea'),
      characterInputError: document.createElement('div'),
      generateBtn: document.createElement('button'),
      exportBtn: document.createElement('button'),
      clearBtn: document.createElement('button'),
      backBtn: document.createElement('button'),
      loadingState: document.createElement('div'),
      resultsState: document.createElement('div'),
      errorState: document.createElement('div'),
      emptyState: document.createElement('div'),
      speechPatternsContainer: document.createElement('div'),
      loadingIndicator: document.createElement('div'),
      loadingMessage: document.createElement('div'),
      patternCount: document.createElement('span'),
      errorMessage: document.createElement('div'),
      retryBtn: document.createElement('button'),
      screenReaderAnnouncement: document.createElement('div'),
      exportFormat: document.createElement('select'),
      exportTemplate: document.createElement('select'),
      templateGroup: document.createElement('div'),
    };

    Object.entries(mockElements).forEach(([key, element]) => {
      element.id = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      document.body.appendChild(element);
    });

    asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({ logger: mockLogger });
    eventListenerRegistry = new EventListenerRegistry({
      logger: mockLogger,
      asyncUtilities: asyncUtilitiesToolkit,
    });
    domElementManager = new DOMElementManager({
      logger: mockLogger,
      documentRef: document,
      performanceRef: performance,
      elementsRef: {},
      contextName: 'SpeechPatternsGeneratorController:DOM',
    });

    // Cache export controls before initialization so the controller wires listeners
    domElementManager.cacheElement('exportFormat', '#export-format', false);
    domElementManager.cacheElement('exportTemplate', '#export-template', false);
    domElementManager.cacheElement('templateGroup', '#template-group', false);

    controllerLifecycleOrchestrator = new ControllerLifecycleOrchestrator({
      logger: mockLogger,
      eventBus: mockEventBus,
    });
    performanceMonitor = new PerformanceMonitor({
      logger: mockLogger,
      eventBus: mockEventBus,
    });
    memoryManager = new MemoryManager({ logger: mockLogger });
    errorHandlingStrategy = new ErrorHandlingStrategy({
      logger: mockLogger,
      eventBus: mockEventBus,
      controllerName: 'SpeechPatternsGeneratorController',
      errorCategories: ERROR_CATEGORIES,
      errorSeverity: ERROR_SEVERITY,
    });
    validationService = new ValidationService({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
      handleError: jest.fn(),
      errorCategories: ERROR_CATEGORIES,
    });

    controller = new SpeechPatternsGeneratorController({
      logger: mockLogger,
      container: { resolve: jest.fn() },
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      characterBuilderService: mockCharacterBuilderService,
      speechPatternsGenerator: mockSpeechPatternsGenerator,
      speechPatternsDisplayEnhancer: mockDisplayEnhancer,
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    });

    // Initialize and disable enhanced validation for faster feedback
    await controller.initialize();
    controller._disableEnhancedValidation();
  });

  const provideValidCharacterInput = async () => {
    const textarea = document.getElementById('character-definition');
    textarea.value = buildCharacterDefinition();

    textarea.dispatchEvent(new Event('blur', { bubbles: true }));
    await jest.runOnlyPendingTimersAsync();
  };

  it('wires keyboard shortcuts to generation, export, clear, and abort flows', async () => {
    const mockPatterns = createMockSpeechPatterns();
    let resolveGeneration;
    mockSpeechPatternsGenerator.generateSpeechPatterns.mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      })
    );

    await provideValidCharacterInput();

    // Start generation via Ctrl+Enter
    mockElements.characterDefinition.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })
    );

    // Abort while generation is in-flight using Escape
    mockElements.characterDefinition.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );

    // Allow generation to complete
    resolveGeneration(mockPatterns);
    await jest.runOnlyPendingTimersAsync();

    expect(mockSpeechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalled();

    // Trigger export via Ctrl+E after results exist
    mockElements.characterDefinition.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true })
    );

    const announcement = document.getElementById('screen-reader-announcement');
    expect(announcement.textContent).toContain('exported');

    // Trigger clear via Ctrl+Shift+Delete
    const textarea = document.getElementById('character-definition');
    textarea.value = 'should clear';
    mockElements.characterDefinition.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Delete',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(textarea.value).toBe('');
    expect(mockDisplayEnhancer.formatForExport).toHaveBeenCalled();
  });

  it('supports keyboard navigation of rendered patterns and announces focus changes', async () => {
    mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue({
      ...createMockSpeechPatterns(),
      speechPatterns: [
        { pattern: 'First pattern', example: 'example one', circumstances: 'c1' },
        { pattern: 'Second pattern', example: 'example two', circumstances: 'c2' },
      ],
    });

    await provideValidCharacterInput();

    mockElements.characterDefinition.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })
    );
    await jest.runAllTimersAsync();

    const patterns = document.querySelectorAll('.speech-pattern-item');
    expect(patterns.length).toBeGreaterThan(1);

    patterns[0].setAttribute('tabindex', '0');
    patterns[0].focus();

    patterns[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    );
    await jest.runOnlyPendingTimersAsync();

    expect(document.activeElement).toBe(patterns[1]);
    await jest.runAllTimersAsync();
  });

  it('populates export controls and toggles template visibility on format change', async () => {
    await provideValidCharacterInput();

    const formatSelect = document.getElementById('export-format');
    const templateGroup = document.getElementById('template-group');

    // Options should be injected from display enhancer
    expect(formatSelect.options.length).toBeGreaterThan(0);

    formatSelect.value = 'json';
    formatSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(templateGroup.style.display).toBe('none');

    formatSelect.value = 'txt';
    formatSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(templateGroup.style.display).toBe('flex');
  });
});
