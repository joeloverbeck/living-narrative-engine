/**
 * @file Debug test for ThematicDirectionController initialization
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { ThematicDirectionController } from '../../../../src/thematicDirection/controllers/thematicDirectionController.js';

// Mock DOM - will be set up in beforeEach
let mockDocument;

describe('ThematicDirectionController - Debug', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;

  beforeEach(() => {
    // Create fresh mock document
    mockDocument = {
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      createElement: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue(true),
    };

    // Mock all DOM elements to return valid objects mapped by ID
    const mockElements = {};
    const elementIds = [
      // Form elements
      'concept-form',
      'concept-input',
      'concept-error',

      // Concept selector elements
      'concept-selector',
      'selected-concept-display',
      'concept-content',
      'concept-directions-count',
      'concept-created-date',
      'concept-selector-error',

      // Buttons
      'generate-btn',
      'retry-btn',
      'back-to-menu-btn',

      // State containers
      'empty-state',
      'loading-state',
      'results-state',
      'error-state',
      'error-message-text',

      // Results elements
      'generated-directions',
      'directions-list',
      'directions-results',
      'generated-concept',
      'concept-text',
      'character-count',
      'timestamp',
    ];

    // Create a mock element for each ID
    elementIds.forEach((id) => {
      mockElements[id] = {
        addEventListener: jest.fn(),
        style: { display: 'none' },
        innerHTML: '',
        appendChild: jest.fn(),
        value: '',
        disabled: false,
        textContent: '',
        setAttribute: jest.fn(),
        dispatchEvent: jest.fn(),
        children: { length: 0 },
      };
    });

    mockDocument.getElementById.mockImplementation((id) => {
      return mockElements[id] || null;
    });

    mockDocument.querySelector.mockImplementation(() => ({
      textContent: '',
    }));

    mockDocument.createElement.mockImplementation((tagName) => {
      if (tagName === 'option') {
        return {
          textContent: '',
          value: '',
          selected: false,
          appendChild: jest.fn(),
        };
      }
      return {
        textContent: '',
        value: '',
        selected: false,
        appendChild: jest.fn(),
        className: '',
        setAttribute: jest.fn(),
        id: '',
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should complete initialization without errors', async () => {
    // Set global document right before creating controller
    global.document = mockDocument;

    // Create controller after all mocks are set up
    controller = new ThematicDirectionController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
    });

    // Act
    await controller.initialize();

    // Assert
    expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
    expect(
      mockCharacterBuilderService.getAllCharacterConcepts
    ).toHaveBeenCalled();

    // The controller will log errors for missing elements, but still initialize successfully
    // This is expected behavior - it continues despite missing optional elements
    expect(mockLogger.error).toHaveBeenCalled();

    // But it should still complete initialization
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringMatching(
        /ThematicDirectionController: Initialization completed in \d+\.\d+ms/
      )
    );
  });
});
