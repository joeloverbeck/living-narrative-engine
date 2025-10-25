/**
 * @file Unit tests for SpeechPatternsGeneratorController character definition validation
 * @description Tests validation of character JSON structure with nested components
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SpeechPatternsGeneratorController } from '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';

describe('SpeechPatternsGeneratorController - Character Definition Validation', () => {
  let controller;
  let mockLogger;
  let mockContainer;
  let mockSpeechPatternsGenerator;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;
  let mockElements;

  beforeEach(async () => {
    jest.useFakeTimers();
    // Reset DOM
    document.body.innerHTML = '';

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock character builder service (required by BaseCharacterBuilderController)
    mockCharacterBuilderService = {
      // Required methods from BaseCharacterBuilderController validation
      initialize: jest.fn().mockResolvedValue(true),
      getAllCharacterConcepts: jest.fn().mockReturnValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      // Additional methods that may be used
      setCharacterConcept: jest.fn(),
      clearCharacterConcept: jest.fn(),
      getThematicDirection: jest.fn(),
      setThematicDirection: jest.fn(),
      getCliches: jest.fn(),
      setCliches: jest.fn(),
      getCoreMotivations: jest.fn(),
      setCoreMotivations: jest.fn(),
      getCharacterName: jest.fn(),
      setCharacterName: jest.fn(),
      getAnatomyDefinition: jest.fn(),
      setAnatomyDefinition: jest.fn(),
      getSpeechPatterns: jest.fn(),
      setSpeechPatterns: jest.fn(),
    };

    // Create mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Create mock schema validator
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
      validateAgainstSchema: jest.fn().mockReturnValue({ isValid: true }),
      getSchema: jest.fn(),
      loadSchema: jest.fn(),
      loadSchemas: jest.fn(),
      hasSchema: jest.fn().mockReturnValue(true),
    };

    // Create mock speech patterns generator
    mockSpeechPatternsGenerator = {
      generateSpeechPatterns: jest.fn(),
      getServiceInfo: jest.fn().mockReturnValue({ version: '1.0.0' }),
    };

    // Create mock container with proper token resolution
    mockContainer = {
      resolve: jest.fn((token) => {
        if (token === 'SpeechPatternsGenerator') {
          return mockSpeechPatternsGenerator;
        }
        throw new Error(`Token ${token} not registered`);
      }),
    };

    // Create mock DOM elements (including all required state management elements)
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
    };

    // Set IDs for elements
    Object.entries(mockElements).forEach(([key, element]) => {
      element.id = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      document.body.appendChild(element);
    });

    // Create controller instance
    controller = new SpeechPatternsGeneratorController({
      logger: mockLogger,
      container: mockContainer,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      characterBuilderService: mockCharacterBuilderService,
      speechPatternsGenerator: mockSpeechPatternsGenerator,
    });

    // Initialize the controller asynchronously to set up event listeners
    await controller.initialize();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Character Definition Structure Validation', () => {
    it('should accept valid character definition with nested components structure', async () => {
      // This is the actual structure from character.json files
      const validCharacterDef = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'test:character',
        components: {
          'core:actor': {},
          'core:name': {
            text: 'Test Character with a detailed name that provides substantial information about this character for the validation',
          },
          'core:personality': {
            traits: ['brave', 'kind', 'intelligent', 'compassionate'],
            description:
              'A complex personality with deep traits that define how this character behaves in various situations and interactions with others.',
          },
          'core:profile': {
            background:
              'A test character with a rich background story that spans multiple paragraphs and provides extensive detail about their history, motivations, and experiences.',
            age: 25,
            occupation: 'Adventure Guide',
          },
          'core:description': {
            text: 'A detailed physical description of the character including their appearance, mannerisms, clothing style, and other distinguishing features that make them unique.',
          },
        },
      };

      const textarea = document.getElementById('character-definition');
      textarea.value = JSON.stringify(validCharacterDef, null, 2);

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Advance timers for debounced validation
      await jest.advanceTimersByTimeAsync(600);

      // Generate button should be enabled for valid input
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn.disabled).toBe(false);

      // Enhanced validator may show success message or no display
      const errorDiv = document.getElementById('character-input-error');

      // Enhanced validator shows success messages, so check for success content or hidden
      const isHidden = errorDiv.style.display === 'none';
      const hasSuccessMessage =
        errorDiv.textContent.includes('Excellent') ||
        errorDiv.textContent.includes('Good');

      expect(isHidden || hasSuccessMessage).toBe(true);
    });

    it('should reject character definition without components property', async () => {
      // Invalid structure - no namespaced components (no colons)
      const invalidCharacterDef = {
        name: {
          text: 'Test Character',
        },
        personality: {
          traits: ['brave', 'kind'],
        },
      };

      const textarea = document.getElementById('character-definition');
      textarea.value = JSON.stringify(invalidCharacterDef, null, 2);

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Advance timers for debounced validation
      await jest.advanceTimersByTimeAsync(600);

      // Generate button should be disabled for invalid input
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn.disabled).toBe(true);

      // Error should be displayed
      const errorDiv = document.getElementById('character-input-error');
      expect(errorDiv.style.display).not.toBe('none');
      expect(errorDiv.textContent).toContain('No character components found');
    });

    it('should accept character definition with minimal required components', async () => {
      const minimalCharacterDef = {
        id: 'test:minimal',
        components: {
          'core:name': {
            text: 'Minimal Character with enough detail to pass the content length validation requirements for testing purposes',
          },
          'core:personality': {
            traits: ['simple', 'straightforward', 'honest'],
            description:
              'A simple personality with basic traits that still provides enough content for validation to pass the minimum requirements.',
          },
          'core:profile': {
            background:
              'A minimal character background that still contains enough information to satisfy the validation requirements for content depth and detail.',
          },
        },
      };

      const textarea = document.getElementById('character-definition');
      textarea.value = JSON.stringify(minimalCharacterDef, null, 2);

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Advance timers for debounced validation
      await jest.advanceTimersByTimeAsync(600);

      // Should be valid with minimal components
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn.disabled).toBe(false);
    });

    it('should reject empty components object', async () => {
      const emptyComponentsDef = {
        id: 'test:empty',
        components: {},
      };

      const textarea = document.getElementById('character-definition');
      textarea.value = JSON.stringify(emptyComponentsDef, null, 2);

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Advance timers for debounced validation
      await jest.advanceTimersByTimeAsync(600);

      // Should be invalid
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn.disabled).toBe(true);

      const errorDiv = document.getElementById('character-input-error');
      expect(errorDiv.textContent).toContain('No character components found');
    });

    it('should handle complex nested character definition from actual game data', async () => {
      // Simulating the structure of ane_arrieta.character.json without importing it
      const complexCharacterDef = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'test:complex_character',
        components: {
          'core:actor': {},
          'core:player_type': {
            type: 'npc',
          },
          'core:name': {
            text: 'Complex Test Character',
          },
          'core:personality': {
            traits: ['complex', 'detailed', 'nuanced'],
            description:
              'A very detailed personality description with lots of text content to ensure the validation handles substantial data correctly',
          },
          'core:profile': {
            age: 25,
            occupation: 'Test Subject',
            background:
              'Extensive background information that spans multiple sentences and provides rich context for the character',
          },
          'core:likes': {
            items: ['reading', 'music', 'nature'],
          },
          'core:dislikes': {
            items: ['conflict', 'dishonesty'],
          },
          'core:fears': {
            items: ['failure', 'abandonment'],
          },
          'movement:goals': {
            shortTerm: ['learn new skills'],
            longTerm: ['achieve mastery'],
          },
          'anatomy:body': {
            recipeId: 'anatomy:human_female',
          },
          'core:description': {
            text: 'A comprehensive description that includes physical appearance, mannerisms, and other observable characteristics that help bring the character to life in the narrative',
          },
        },
      };

      const textarea = document.getElementById('character-definition');
      textarea.value = JSON.stringify(complexCharacterDef, null, 2);

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Advance timers for debounced validation
      await jest.advanceTimersByTimeAsync(600);

      // Should accept complex valid structure
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn.disabled).toBe(false);

      // Enhanced validator may show success message or no display
      const errorDiv = document.getElementById('character-input-error');

      // Enhanced validator shows success messages, so check for success content or hidden
      const isHidden = errorDiv.style.display === 'none';
      const hasSuccessMessage =
        errorDiv.textContent.includes('Excellent') ||
        errorDiv.textContent.includes('Good');

      expect(isHidden || hasSuccessMessage).toBe(true);
    });

    it('should provide helpful error message for components without sufficient detail', async () => {
      const shallowCharacterDef = {
        components: {
          'core:name': {
            text: 'X',
          },
          'core:personality': {
            traits: ['a'],
          },
          'core:profile': {
            background: 'short',
          },
        },
      };

      const textarea = document.getElementById('character-definition');
      textarea.value = JSON.stringify(shallowCharacterDef, null, 2);

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Advance timers for debounced validation
      await jest.advanceTimersByTimeAsync(600);

      const errorDiv = document.getElementById('character-input-error');
      expect(errorDiv.style.display).not.toBe('none');

      // Should show error about lacking detail (since we have all required components but they're small)
      const errorText = errorDiv.textContent;
      expect(errorText).toContain('Character components appear to lack detail');
    });
  });

  describe('JSON Parsing Errors', () => {
    it('should show clear error for invalid JSON', async () => {
      const textarea = document.getElementById('character-definition');
      textarea.value = '{ invalid json }';

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Advance timers for debounced validation
      await jest.advanceTimersByTimeAsync(600);

      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn.disabled).toBe(true);

      const errorDiv = document.getElementById('character-input-error');
      expect(errorDiv.style.display).not.toBe('none');

      // Enhanced validator shows structured feedback - check for JSON parsing error
      expect(errorDiv.textContent).toContain('JSON Syntax Error');
    });

    it('should clear errors when valid JSON is entered after invalid', async () => {
      const textarea = document.getElementById('character-definition');

      // First enter invalid JSON
      textarea.value = '{ invalid }';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      // Advance timers for debounced validation
      await jest.advanceTimersByTimeAsync(600);

      // Error should be shown
      const errorDiv = document.getElementById('character-input-error');
      expect(errorDiv.style.display).not.toBe('none');

      // Now enter valid JSON with all required components and sufficient detail
      const validDef = {
        components: {
          'core:name': {
            text: 'Valid Character with sufficient detail to pass the validation requirements for testing purposes',
          },
          'core:personality': {
            traits: ['valid', 'detailed', 'comprehensive'],
            description:
              'A valid personality with enough detail to satisfy the validation requirements for content depth and quality.',
          },
          'core:profile': {
            background:
              'A comprehensive character background that contains enough information to satisfy the validation requirements for content depth.',
          },
        },
      };
      textarea.value = JSON.stringify(validDef);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      // Advance timers for debounced validation
      await jest.advanceTimersByTimeAsync(600);

      // Enhanced validator may show success message or clear display
      const isHidden = errorDiv.style.display === 'none';
      const hasSuccessMessage =
        errorDiv.textContent.includes('Excellent') ||
        errorDiv.textContent.includes('Good');
      const noErrorMessage =
        !errorDiv.textContent.includes('JSON Syntax Error');

      expect(isHidden || (hasSuccessMessage && noErrorMessage)).toBe(true);
    });
  });
});
