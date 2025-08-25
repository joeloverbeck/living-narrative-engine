/**
 * @file Test helpers for Speech Patterns Generator tests
 * Provides common mocks, fixtures, and utilities for testing speech patterns functionality
 */

import { jest } from '@jest/globals';

/**
 * Creates mock speech patterns data for testing (raw array)
 */
export function createMockSpeechPatternsArray() {
  return [
    {
      pattern: 'Uses enthusiastic and repetitive expressions when excited',
      example:
        "Oh wow, that's amazing! I can't believe this is happening! This is the best day ever!",
      circumstances: 'When feeling happy and excited in casual settings',
    },
    {
      pattern: 'Employs formal, measured language to express disagreement',
      example:
        'I must express my strong disagreement with this decision. This is completely unacceptable and requires immediate attention.',
      circumstances: 'When angry in professional or formal settings',
    },
    {
      pattern: 'Uses gentle, reassuring tone when comforting others',
      example:
        "It's going to be okay. I understand how you're feeling, and I'm here to help you through this.",
      circumstances: 'When offering emotional support in difficult situations',
    },
  ];
}

/**
 * Creates mock speech patterns data for testing (with structure expected by DisplayEnhancer)
 */
export function createMockSpeechPatterns() {
  return {
    speechPatterns: createMockSpeechPatternsArray(),
    characterName: 'Test Character',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Creates a valid character definition for testing
 */
export function createMockCharacterDefinition() {
  return {
    name: 'Test Character',
    age: 25,
    personality: {
      traits: ['friendly', 'curious', 'thoughtful'],
      background: 'A scholar from a small village',
      motivations: ['seeking knowledge', 'helping others'],
    },
    speech_style: {
      formality: 'mixed',
      vocabulary: 'educated',
      quirks: ['uses metaphors', 'occasionally quotes books'],
    },
    emotional_range: {
      primary: ['joy', 'curiosity', 'concern'],
      suppressed: ['anger', 'fear'],
    },
  };
}

/**
 * Creates an invalid character definition for error testing
 */
export function createInvalidCharacterDefinition() {
  return {
    // Missing required fields
    personality: 'not an object', // Wrong type
    age: 'twenty-five', // Wrong type
  };
}

/**
 * Creates a mock LLM response for speech patterns
 */
export function createMockLLMResponse() {
  return JSON.stringify({
    speechPatterns: createMockSpeechPatternsArray(),
    characterName: 'Test Character',
    generatedAt: new Date().toISOString(),
    metadata: {
      generation_time: Date.now(),
      model: 'test-model',
      version: '1.0.0',
    },
  });
}

/**
 * Creates a malformed LLM response for error testing
 */
export function createMalformedLLMResponse() {
  return 'This is not valid JSON { broken: ';
}

/**
 * Creates mock dependencies for SpeechPatternsGeneratorController
 */
export function createMockControllerDependencies() {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };

  const mockSpeechPatternsGenerator = {
    generateSpeechPatterns: jest.fn(),
    getServiceInfo: jest.fn().mockReturnValue({
      name: 'SpeechPatternsGenerator',
      version: '1.0.0',
    }),
  };

  const mockSpeechPatternsDisplayEnhancer = {
    enhanceForDisplay: jest.fn(),
    formatForExport: jest.fn(),
    generateExportFilename: jest.fn(),
  };

  const mockSchemaValidator = {
    validate: jest.fn(),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
  };

  // Add missing characterBuilderService mock
  const mockCharacterBuilderService = {
    initialize: jest.fn().mockResolvedValue(true),
    getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
    createCharacterConcept: jest.fn().mockResolvedValue({ id: 'test-id' }),
    updateCharacterConcept: jest.fn().mockResolvedValue(true),
    deleteCharacterConcept: jest.fn().mockResolvedValue(true),
    getCharacterConcept: jest.fn().mockResolvedValue(null),
    generateThematicDirections: jest.fn().mockResolvedValue([]),
    getThematicDirections: jest.fn().mockResolvedValue([]),
  };

  const mockContainer = {
    resolve: jest.fn((token) => {
      const services = {
        SpeechPatternsGenerator: mockSpeechPatternsGenerator,
        ILogger: mockLogger,
        ISafeEventDispatcher: mockEventBus,
      };
      return services[token];
    }),
  };

  return {
    logger: mockLogger,
    eventBus: mockEventBus,
    speechPatternsGenerator: mockSpeechPatternsGenerator,
    speechPatternsDisplayEnhancer: mockSpeechPatternsDisplayEnhancer,
    schemaValidator: mockSchemaValidator,
    characterBuilderService: mockCharacterBuilderService,
    container: mockContainer,
  };
}

/**
 * Creates DOM structure for speech patterns generator
 */
export function setupSpeechPatternsDOM() {
  document.body.innerHTML = `
    <div id="app">
      <!-- Input Section -->
      <div class="cb-input-panel">
        <textarea 
          id="character-definition" 
          class="cb-textarea"
          placeholder="Paste character JSON here"
        ></textarea>
        
        <div id="character-input-error" class="error-display" role="alert"></div>
        
        <button 
          id="generate-btn" 
          class="cb-button cb-button-primary"
          disabled
        >
          Generate Speech Patterns
        </button>
        
        <button 
          id="validate-btn" 
          class="cb-button cb-button-secondary"
        >
          Validate Input
        </button>
        
        <button 
          id="back-btn" 
          class="cb-button cb-button-secondary"
        >
          Back
        </button>
      </div>
      
      <!-- Output Section -->
      <div class="cb-output-panel">
        <div id="generation-status" class="generation-status"></div>
        <div id="error-display" class="error-display" role="alert"></div>
        
        <div class="cb-panel-header">
          <h2>Generated Speech Patterns</h2>
          <div class="panel-actions">
            <button 
              id="clear-all-btn" 
              class="cb-button cb-button-danger"
              disabled
            >
              Clear All
            </button>
            <button 
              id="export-btn" 
              class="cb-button cb-button-secondary"
              disabled
            >
              Export
            </button>
          </div>
        </div>
        
        <div 
          id="speech-patterns-container" 
          class="speech-patterns-container"
        >
          <div id="speech-patterns-content"></div>
        </div>
        
        <!-- Pattern count display -->
        <div id="pattern-count" class="pattern-count"></div>
      </div>
      
      <!-- UI State Management Elements -->
      <div id="loading-state" class="ui-state loading-state" style="display: none;">
        <div id="loading-indicator" class="loading-indicator">
          <div class="spinner"></div>
          <span id="loading-message">Generating speech patterns...</span>
        </div>
      </div>
      
      <div id="results-state" class="ui-state results-state" style="display: none;">
        <!-- Results are displayed in speech-patterns-container -->
      </div>
      
      <div id="error-state" class="ui-state error-state" style="display: none;">
        <div id="error-message" class="error-message"></div>
        <button id="retry-btn" class="cb-button cb-button-primary">
          Retry Generation
        </button>
      </div>
      
      <div id="empty-state" class="ui-state empty-state" style="display: none;">
        <p>No speech patterns generated yet.</p>
      </div>
      
      <!-- Screen reader announcement area -->
      <div id="screen-reader-announcement" class="screen-reader-only" aria-live="polite" aria-atomic="true"></div>
    </div>
  `;
}

/**
 * Simulates keyboard event
 *
 * @param key
 * @param ctrlKey
 * @param shiftKey
 */
export function simulateKeyboard(key, ctrlKey = false, shiftKey = false) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

/**
 * Creates accessibility test utilities
 */
export function createAccessibilityTestUtils() {
  return {
    checkAriaAttributes: (element) => {
      const results = {
        hasRole: !!element.getAttribute('role'),
        hasAriaLabel: !!element.getAttribute('aria-label'),
        hasAriaDescribedBy: !!element.getAttribute('aria-describedby'),
        hasAriaLabelledBy: !!element.getAttribute('aria-labelledby'),
        hasAriaLive: !!element.getAttribute('aria-live'),
      };
      return results;
    },

    checkKeyboardNavigation: (element) => {
      return {
        isFocusable: element.tabIndex >= 0,
        hasKeyShortcuts: !!element.getAttribute('aria-keyshortcuts'),
      };
    },

    checkScreenReaderSupport: (container) => {
      const screenReaderElements = container.querySelectorAll(
        '.screen-reader-only'
      );
      const skipLinks = container.querySelectorAll('.skip-link');
      return {
        hasScreenReaderText: screenReaderElements.length > 0,
        hasSkipLinks: skipLinks.length > 0,
      };
    },
  };
}

/**
 * Creates performance monitoring utilities
 */
export function createPerformanceMonitor() {
  const marks = new Map();
  const measures = [];

  return {
    mark: (name) => {
      marks.set(name, performance.now());
    },

    measure: (name, startMark, endMark) => {
      const start = marks.get(startMark);
      const end = marks.get(endMark) || performance.now();
      const duration = end - start;
      measures.push({ name, duration, start, end });
      return duration;
    },

    getMetrics: () => ({
      marks: Array.from(marks.entries()),
      measures: [...measures],
    }),

    reset: () => {
      marks.clear();
      measures.length = 0;
    },
  };
}

/**
 * Creates mock responses for different test scenarios
 */
export const MockResponses = {
  success: () => ({
    success: true,
    data: createMockSpeechPatterns(),
    metadata: {
      tokensUsed: 1500,
      generationTime: 2500,
      model: 'test-model',
    },
  }),

  partialSuccess: () => ({
    success: true,
    data: {
      speechPatterns: [createMockSpeechPatternsArray()[0]], // Only one pattern
      characterName: 'Test Character',
      generatedAt: new Date().toISOString(),
    },
    warnings: ['Some patterns could not be generated'],
  }),

  validationError: () => ({
    success: false,
    error: 'Invalid character definition',
    details: ['Missing required field: name'],
  }),

  networkError: () => ({
    success: false,
    error: 'Network error',
    details: ['Failed to connect to LLM service'],
  }),

  timeout: () => ({
    success: false,
    error: 'Request timeout',
    details: ['Generation took longer than 30 seconds'],
  }),
};

/**
 * Wait for async operations
 *
 * @param ms
 */
export function waitForAsync(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates test fixtures for various edge cases
 */
export const EdgeCaseFixtures = {
  emptyCharacter: {},

  hugeCharacter: (() => {
    const char = createMockCharacterDefinition();
    char.background = 'x'.repeat(10000); // Very long text
    return char;
  })(),

  specialCharacters: {
    name: 'Test <script>alert("XSS")</script>',
    personality: {
      traits: ['<img src=x onerror=alert(1)>'],
    },
  },

  unicodeCharacter: {
    name: '测试角色 🎭',
    personality: {
      traits: ['友好的 😊', 'مفيد', '役に立つ'],
    },
  },

  nestedStructure: {
    name: 'Complex Character',
    nested: {
      deeply: {
        nested: {
          value: 'test',
        },
      },
    },
  },
};
