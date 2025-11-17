/**
 * @file Mock factories for Core Motivations testing
 * Provides factory functions for creating mock services and dependencies
 */

import { jest } from '@jest/globals';
import {
  createMockCoreMotivation,
  createMockCoreMotivations,
  createMockLLMResponse,
} from './testHelpers.js';

/**
 * Creates a mock CoreMotivationsGenerator service
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock CoreMotivationsGenerator
 */
export function createMockCoreMotivationsGenerator(options = {}) {
  const {
    shouldSucceed = true,
    generationDelay = 0,
    motivationCount = 1,
  } = options;

  return {
    generate: jest.fn().mockImplementation(async () => {
      if (generationDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, generationDelay));
      }

      if (!shouldSucceed) {
        throw new Error('Generation failed');
      }

      return createMockCoreMotivations(motivationCount);
    }),
    validateInput: jest.fn().mockReturnValue({ isValid: true }),
    formatForDisplay: jest.fn().mockImplementation((motivation) => ({
      ...motivation,
      formatted: true,
    })),
    _reset: jest.fn(),
  };
}

/**
 * Creates a mock CharacterDatabase service
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock CharacterDatabase
 */
export function createMockCharacterDatabase(options = {}) {
  const {
    hasExistingData = false,
    shouldFail = false,
    existingMotivations = [],
  } = options;

  const storedMotivations = hasExistingData
    ? existingMotivations.length > 0
      ? existingMotivations
      : createMockCoreMotivations(3)
    : [];

  return {
    isInitialized: jest.fn().mockReturnValue(!shouldFail),
    ensureInitialized: jest.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw new Error('Database initialization failed');
      }
      return true;
    }),
    saveCoreMotivation: jest.fn().mockImplementation(async (motivation) => {
      if (shouldFail) {
        throw new Error('Save failed');
      }
      storedMotivations.push(motivation);
      return { ...motivation, id: motivation.id || 'generated-id' };
    }),
    saveCoreMotivations: jest.fn().mockImplementation(async (motivations) => {
      if (shouldFail) {
        throw new Error('Batch save failed');
      }
      storedMotivations.push(...motivations);
      return motivations;
    }),
    getCoreMotivationsByDirectionId: jest
      .fn()
      .mockImplementation(async (directionId) => {
        if (shouldFail) {
          throw new Error('Retrieval failed');
        }
        return storedMotivations.filter((m) => m.directionId === directionId);
      }),
    getCoreMotivationsByConceptId: jest
      .fn()
      .mockImplementation(async (conceptId) => {
        if (shouldFail) {
          throw new Error('Retrieval failed');
        }
        return storedMotivations.filter((m) => m.conceptId === conceptId);
      }),
    getCoreMotivationById: jest.fn().mockImplementation(async (id) => {
      if (shouldFail) {
        throw new Error('Get failed');
      }
      return storedMotivations.find((m) => m.id === id) || null;
    }),
    deleteCoreMotivation: jest.fn().mockImplementation(async (id) => {
      if (shouldFail) {
        throw new Error('Delete failed');
      }
      const index = storedMotivations.findIndex((m) => m.id === id);
      if (index > -1) {
        storedMotivations.splice(index, 1);
      }
      return true;
    }),
    deleteAllCoreMotivationsForDirection: jest
      .fn()
      .mockImplementation(async (directionId) => {
        if (shouldFail) {
          throw new Error('Clear failed');
        }
        const toRemove = storedMotivations.filter(
          (m) => m.directionId === directionId
        );
        toRemove.forEach((m) => {
          const index = storedMotivations.indexOf(m);
          storedMotivations.splice(index, 1);
        });
        return true;
      }),
    updateCoreMotivation: jest.fn().mockImplementation(async (id, updates) => {
      if (shouldFail) {
        throw new Error('Update failed');
      }
      const motivation = storedMotivations.find((m) => m.id === id);
      if (motivation) {
        Object.assign(motivation, updates);
        return motivation;
      }
      return null;
    }),
    hasCoreMotivationsForDirection: jest
      .fn()
      .mockImplementation(async (directionId) => {
        if (shouldFail) {
          throw new Error('Check failed');
        }
        return storedMotivations.some((m) => m.directionId === directionId);
      }),
    getCoreMotivationsCount: jest
      .fn()
      .mockImplementation(async (directionId) => {
        if (shouldFail) {
          throw new Error('Count failed');
        }
        return storedMotivations.filter((m) => m.directionId === directionId)
          .length;
      }),
    _getStoredMotivations: () => storedMotivations,
    _clearAll: () => {
      storedMotivations.length = 0;
    },
  };
}

/**
 * Creates a mock LLMService for testing
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock LLMService
 */
export function createMockLLMService(options = {}) {
  const {
    shouldSucceed = true,
    responseDelay = 0,
    customResponse = null,
    retryCount = 0,
  } = options;

  let attemptCount = 0;

  return {
    generateCompletion: jest.fn().mockImplementation(async (prompt) => {
      attemptCount++;

      if (responseDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, responseDelay));
      }

      if (attemptCount <= retryCount) {
        throw new Error('Temporary failure');
      }

      if (!shouldSucceed) {
        throw new Error('LLM service unavailable');
      }

      if (customResponse) {
        return customResponse;
      }

      return createMockLLMResponse();
    }),
    getAIDecision: jest.fn().mockImplementation(async (prompt) => {
      attemptCount++;

      if (responseDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, responseDelay));
      }

      if (attemptCount <= retryCount) {
        throw new Error('Temporary failure');
      }

      if (!shouldSucceed) {
        throw new Error('LLM service unavailable');
      }

      if (customResponse) {
        return customResponse;
      }

      return createMockLLMResponse();
    }),
    validatePrompt: jest.fn().mockReturnValue(true),
    estimateTokens: jest.fn().mockReturnValue(1500),
    _resetAttempts: () => {
      attemptCount = 0;
    },
  };
}

/**
 * Creates a mock CoreMotivationsGeneratorController
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock controller
 */
export function createMockCoreMotivationsController(options = {}) {
  const { isInitialized = true, hasDirections = true } = options;

  return {
    initialize: jest.fn().mockResolvedValue(isInitialized),
    cleanup: jest.fn().mockResolvedValue(true),
    loadEligibleDirections: jest.fn().mockResolvedValue(
      hasDirections
        ? [
            { id: 'dir-1', name: 'Direction 1' },
            { id: 'dir-2', name: 'Direction 2' },
          ]
        : []
    ),
    generateMotivations: jest
      .fn()
      .mockResolvedValue(createMockCoreMotivations(3)),
    displayMotivations: jest.fn(),
    clearMotivations: jest.fn().mockResolvedValue(true),
    exportMotivations: jest.fn().mockReturnValue('Exported data'),
    deleteMotivation: jest.fn().mockResolvedValue(true),
    updateUIState: jest.fn(),
    showError: jest.fn(),
    hideError: jest.fn(),
    _getState: jest.fn().mockReturnValue({
      isGenerating: false,
      selectedDirectionId: null,
      motivations: [],
    }),
  };
}

/**
 * Creates a mock CoreMotivationsDisplayEnhancer service
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock display enhancer
 */
export function createMockCoreMotivationsDisplayEnhancer(options = {}) {
  const { shouldEnhance = true } = options;

  return {
    enhance: jest.fn().mockImplementation((motivation) => {
      if (!shouldEnhance) {
        return motivation;
      }

      return {
        ...motivation,
        displayCoreDesire: `<span class="enhanced">${motivation.coreDesire}</span>`,
        displayContradiction: `<span class="enhanced">${motivation.internalContradiction}</span>`,
        displayQuestion: `<span class="enhanced">${motivation.centralQuestion}</span>`,
        enhanced: true,
      };
    }),
    createMotivationElement: jest.fn().mockImplementation((motivation) => {
      const element = document.createElement('div');
      element.className = 'motivation-item';
      element.dataset.motivationId = motivation.id;
      element.innerHTML = `
        <div class="core-desire">${motivation.coreDesire}</div>
        <div class="internal-contradiction">${motivation.internalContradiction}</div>
        <div class="central-question">${motivation.centralQuestion}</div>
      `;
      return element;
    }),
    formatForExport: jest.fn().mockImplementation((motivations) => {
      return motivations
        .map(
          (m) =>
            `Core Desire: ${m.coreDesire}\n` +
            `Contradiction: ${m.internalContradiction}\n` +
            `Question: ${m.centralQuestion}`
        )
        .join('\n\n');
    }),
    applyTheme: jest.fn(),
    toggleCompactView: jest.fn(),
  };
}

/**
 * Creates a mock CoreMotivationsCacheManager
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock cache manager
 */
export function createMockCoreMotivationsCacheManager(options = {}) {
  const { hasCachedData = false, cacheHitRate = 0.5 } = options;

  const cache = new Map();

  if (hasCachedData) {
    cache.set('dir-1', createMockCoreMotivations(2));
  }

  return {
    get: jest.fn().mockImplementation((key) => {
      if (Math.random() < cacheHitRate) {
        return cache.get(key) || null;
      }
      return null;
    }),
    set: jest.fn().mockImplementation((key, value) => {
      cache.set(key, value);
      return true;
    }),
    has: jest.fn().mockImplementation((key) => cache.has(key)),
    delete: jest.fn().mockImplementation((key) => cache.delete(key)),
    clear: jest.fn().mockImplementation(() => cache.clear()),
    getStats: jest.fn().mockReturnValue({
      size: cache.size,
      hitRate: cacheHitRate,
      totalHits: Math.floor(Math.random() * 100),
      totalMisses: Math.floor(Math.random() * 50),
    }),
    _getCache: () => cache,
  };
}

/**
 * Creates a mock prompt generator for Core Motivations
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock prompt generator
 */
export function createMockCoreMotivationsPromptGenerator(options = {}) {
  const { shouldValidate = true } = options;

  return {
    generate: jest.fn().mockImplementation((context) => {
      if (!shouldValidate && !context.direction) {
        throw new Error('Direction is required');
      }

      return {
        systemPrompt: 'You are a creative writing assistant...',
        userPrompt: `Generate core motivations for: ${context.direction.name}`,
        temperature: 0.8,
        maxTokens: 1000,
      };
    }),
    validateContext: jest.fn().mockReturnValue({
      isValid: shouldValidate,
      errors: shouldValidate ? [] : ['Invalid context'],
    }),
    enhancePrompt: jest.fn().mockImplementation((prompt) => ({
      ...prompt,
      enhanced: true,
    })),
  };
}

/**
 * Creates a mock logger for testing
 *
 * @returns {object} Mock logger
 */
export function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    setLevel: jest.fn(),
    getLevel: jest.fn().mockReturnValue('INFO'),
    _getLogs: function (level) {
      if (level) {
        return this[level].mock.calls;
      }
      return {
        debug: this.debug.mock.calls,
        info: this.info.mock.calls,
        warn: this.warn.mock.calls,
        error: this.error.mock.calls,
      };
    },
  };
}

/**
 * Creates a mock schema validator
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock schema validator
 */
export function createMockSchemaValidator(options = {}) {
  const { alwaysValid = true } = options;

  return {
    // Primary method expected by BaseCharacterBuilderController
    validate: jest.fn().mockImplementation((data, schemaId) => {
      if (!alwaysValid && !data.coreDesire) {
        return {
          valid: false,
          errors: ['coreDesire is required'],
        };
      }

      return {
        valid: true,
        errors: [],
      };
    }),
    // Legacy methods for backward compatibility
    validateSchema: jest.fn().mockImplementation((data, schemaId) => {
      if (!alwaysValid && !data.coreDesire) {
        return {
          valid: false,
          errors: ['coreDesire is required'],
        };
      }

      return {
        valid: true,
        errors: [],
      };
    }),
    validateAgainstSchema: jest.fn().mockImplementation((data, schemaId) => {
      if (!alwaysValid && !data.coreDesire) {
        return {
          valid: false,
          errors: ['coreDesire is required'],
        };
      }

      return {
        valid: true,
        errors: [],
      };
    }),
    addSchema: jest.fn().mockResolvedValue(true),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    getSchema: jest.fn().mockReturnValue({
      type: 'object',
      properties: {
        coreDesire: { type: 'string' },
        internalContradiction: { type: 'string' },
        centralQuestion: { type: 'string' },
      },
      required: ['coreDesire', 'internalContradiction', 'centralQuestion'],
    }),
  };
}

/**
 * Creates a mock CharacterBuilderService
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock CharacterBuilderService
 */
export function createMockCharacterBuilderService(options = {}) {
  const {
    hasExistingData = false,
    shouldFail = false,
    existingMotivations = [],
  } = options;

  const storedMotivations = hasExistingData
    ? existingMotivations.length > 0
      ? existingMotivations
      : createMockCoreMotivations(3)
    : [];

  return {
    // Required base methods
    initialize: jest.fn().mockResolvedValue(true),
    createCharacterConcept: jest.fn().mockImplementation(async (concept) => {
      if (shouldFail) {
        throw new Error('Failed to create character concept');
      }
      return { ...concept, id: concept.id || 'new-concept-id' };
    }),
    updateCharacterConcept: jest
      .fn()
      .mockImplementation(async (id, updates) => {
        if (shouldFail) {
          throw new Error('Failed to update character concept');
        }
        return { id, ...updates };
      }),
    deleteCharacterConcept: jest.fn().mockImplementation(async (id) => {
      if (shouldFail) {
        throw new Error('Failed to delete character concept');
      }
      return true;
    }),
    getCharacterConcept: jest.fn().mockImplementation(async (id) => {
      if (shouldFail) {
        throw new Error('Failed to get character concept');
      }
      return { id, name: 'Test Concept' };
    }),
    generateThematicDirections: jest
      .fn()
      .mockImplementation(async (conceptId) => {
        if (shouldFail) {
          throw new Error('Failed to generate thematic directions');
        }
        return [
          { id: 'dir-1', title: 'Direction 1', theme: 'Theme 1' },
          { id: 'dir-2', title: 'Direction 2', theme: 'Theme 2' },
        ];
      }),
    getThematicDirections: jest.fn().mockImplementation(async (conceptId) => {
      if (shouldFail) {
        throw new Error('Failed to get thematic directions');
      }
      return [
        { id: 'dir-1', title: 'Direction 1', theme: 'Theme 1' },
        { id: 'dir-2', title: 'Direction 2', theme: 'Theme 2' },
      ];
    }),

    // Character concept methods
    getAllCharacterConcepts: jest
      .fn()
      .mockResolvedValue([{ id: 'concept-1', name: 'Test Concept' }]),
    getCharacterConcept: jest.fn().mockImplementation(async (id) => {
      if (shouldFail) {
        throw new Error('Failed to get character concept');
      }
      return { id, name: 'Test Concept' };
    }),

    // Thematic direction methods
    getThematicDirectionsByConceptId: jest
      .fn()
      .mockImplementation(async (conceptId) => {
        if (shouldFail) {
          throw new Error('Failed to get thematic directions');
        }
        return [
          { id: 'dir-1', title: 'Direction 1', theme: 'Theme 1' },
          { id: 'dir-2', title: 'Direction 2', theme: 'Theme 2' },
        ];
      }),
    updateThematicDirection: jest
      .fn()
      .mockImplementation(async (directionId, updates = {}) => {
        if (shouldFail) {
          throw new Error('Failed to update thematic direction');
        }
        return { id: directionId, ...updates };
      }),
    getAllThematicDirectionsWithConcepts: jest
      .fn()
      .mockImplementation(async () => {
        if (shouldFail) {
          throw new Error(
            'Failed to get all thematic directions with concepts'
          );
        }
        return [
          {
            direction: { id: 'dir-1', title: 'Direction 1', theme: 'Theme 1' },
            concept: {
              id: 'concept-1',
              text: 'Test Concept 1',
              title: 'Test Concept 1',
            },
          },
          {
            direction: { id: 'dir-2', title: 'Direction 2', theme: 'Theme 2' },
            concept: {
              id: 'concept-1',
              text: 'Test Concept 1',
              title: 'Test Concept 1',
            },
          },
          {
            direction: { id: 'dir-3', title: 'Direction 3', theme: 'Theme 3' },
            concept: {
              id: 'concept-2',
              text: 'Test Concept 2',
              title: 'Test Concept 2',
            },
          },
        ];
      }),
    getThematicDirectionById: jest.fn().mockImplementation(async (id) => {
      if (shouldFail) {
        throw new Error('Failed to get thematic direction');
      }
      return { id, title: `Direction ${id}`, theme: `Theme ${id}` };
    }),

    // Clichés methods
    hasClichesForDirection: jest
      .fn()
      .mockImplementation(async (directionId) => {
        if (shouldFail) {
          throw new Error('Failed to check clichés');
        }
        return true; // All directions have clichés in test
      }),
    getClichesByDirectionId: jest
      .fn()
      .mockImplementation(async (directionId) => {
        if (shouldFail) {
          throw new Error('Failed to get clichés');
        }
        return [
          { id: 'cliche-1', text: 'Test Cliché 1' },
          { id: 'cliche-2', text: 'Test Cliché 2' },
        ];
      }),

    // Core motivations methods
    getCoreMotivationsByDirectionId: jest
      .fn()
      .mockImplementation(async (directionId) => {
        if (shouldFail) {
          throw new Error('Failed to get core motivations');
        }
        return storedMotivations.filter((m) => m.directionId === directionId);
      }),
    saveCoreMotivations: jest
      .fn()
      .mockImplementation(async (directionId, motivations) => {
        if (shouldFail) {
          throw new Error('Failed to save core motivations');
        }
        const savedMotivations = motivations.map((m) => ({
          ...m,
          id: m.id || `motivation-${Date.now()}-${Math.random()}`,
          directionId,
        }));
        storedMotivations.push(...savedMotivations);
        return savedMotivations.map((m) => m.id);
      }),
    removeCoreMotivationItem: jest
      .fn()
      .mockImplementation(async (directionId, motivationId) => {
        if (shouldFail) {
          throw new Error('Failed to remove core motivation');
        }
        const index = storedMotivations.findIndex((m) => m.id === motivationId);
        if (index > -1) {
          storedMotivations.splice(index, 1);
        }
        return true;
      }),
    clearCoreMotivationsForDirection: jest
      .fn()
      .mockImplementation(async (directionId) => {
        if (shouldFail) {
          throw new Error('Failed to clear core motivations');
        }
        const toRemove = storedMotivations.filter(
          (m) => m.directionId === directionId
        );
        const count = toRemove.length;
        toRemove.forEach((m) => {
          const index = storedMotivations.indexOf(m);
          storedMotivations.splice(index, 1);
        });
        return count;
      }),

    // Utility methods for testing
    _getStoredMotivations: () => storedMotivations,
    _clearAll: () => {
      storedMotivations.length = 0;
    },
  };
}

/**
 * Creates a test bed with all necessary mocks for Core Motivations testing
 *
 * @param {object} options - Configuration options
 * @returns {object} Complete test bed with mocks
 */
export function createCoreMotivationsTestBed(options = {}) {
  const {
    withDatabase = true,
    withLLM = true,
    withCache = true,
    withLogger = true,
    withCharacterBuilderService = true,
  } = options;

  const testBed = {
    mocks: {},
    cleanup: jest.fn(),
  };

  if (withDatabase) {
    testBed.mocks.database = createMockCharacterDatabase(options.database);
  }

  if (withLLM) {
    testBed.mocks.llmService = createMockLLMService(options.llm);
  }

  if (withCache) {
    testBed.mocks.cacheManager = createMockCoreMotivationsCacheManager(
      options.cache
    );
  }

  if (withLogger) {
    testBed.mocks.logger = createMockLogger();
  }

  if (withCharacterBuilderService) {
    testBed.mocks.characterBuilderService = createMockCharacterBuilderService(
      options.characterBuilder
    );
  }

  testBed.mocks.eventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    listenerCount: jest.fn().mockReturnValue(0),
  };

  testBed.mocks.schemaValidator = createMockSchemaValidator(options.validator);

  testBed.cleanup = () => {
    Object.values(testBed.mocks).forEach((mock) => {
      if (mock._clearAll) {
        mock._clearAll();
      }
      if (mock._resetAttempts) {
        mock._resetAttempts();
      }
    });
    jest.clearAllMocks();
  };

  return testBed;
}

export default {
  createMockCoreMotivationsGenerator,
  createMockCharacterDatabase,
  createMockLLMService,
  createMockCoreMotivationsController,
  createMockCoreMotivationsDisplayEnhancer,
  createMockCoreMotivationsCacheManager,
  createMockCoreMotivationsPromptGenerator,
  createMockLogger,
  createMockSchemaValidator,
  createMockCharacterBuilderService,
  createCoreMotivationsTestBed,
};
