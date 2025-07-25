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

// Mock DOM
const mockDocument = {
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  createElement: jest.fn(),
};
global.document = mockDocument;

describe('ThematicDirectionController - Debug', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(),
      createCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      getCharacterConcept: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue(true),
    };

    // Mock all DOM elements to return valid objects mapped by ID
    const mockElements = {};
    const elementIds = [
      'concept-form', 'concept-input', 'generate-btn', 'retry-btn', 
      'back-to-menu-btn', 'empty-state', 'loading-state', 'error-state', 
      'results-state', 'directions-results', 'previous-concepts', 
      'concept-error', 'error-message-text'
    ];

    // Create a mock element for each ID
    elementIds.forEach(id => {
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

    // Set global document
    global.document = mockDocument;

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

    controller = new ThematicDirectionController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should complete initialization without errors', async () => {
    // Act
    await controller.initialize();

    // Debug: Check all mock calls
    console.log(
      'Service initialize calls:',
      mockCharacterBuilderService.initialize.mock.calls.length
    );
    console.log(
      'getAllCharacterConcepts calls:',
      mockCharacterBuilderService.getAllCharacterConcepts.mock.calls.length
    );
    console.log('Logger error calls:', mockLogger.error.mock.calls);
    console.log('Logger warn calls:', mockLogger.warn.mock.calls);
    console.log('Logger info calls:', mockLogger.info.mock.calls);
    console.log('DOM getElementById calls:', mockDocument.getElementById.mock.calls.map(call => call[0]));

    // Assert
    expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
    expect(
      mockCharacterBuilderService.getAllCharacterConcepts
    ).toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'ThematicDirectionController: Successfully initialized'
    );
  });
});
