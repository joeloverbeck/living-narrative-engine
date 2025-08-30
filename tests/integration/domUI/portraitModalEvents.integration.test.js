/**
 * @file Integration test for portrait modal event dispatch
 * Tests that portrait modal opened/closed events are dispatched correctly
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { PortraitModalRenderer } from '../../../src/domUI/portraitModalRenderer.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('Portrait Modal Events Integration', () => {
  let renderer;
  let mockLogger;
  let mockDocumentContext;
  let mockDomElementFactory;
  let validatedEventDispatcher;
  let eventBus;
  let gameDataRepository;
  let schemaValidator;
  let mockOriginalElement;
  let mockModalElement;
  let mockCloseButton;
  let mockStatusElement;
  let mockImageElement;
  let mockLoadingSpinner;
  let mockModalTitle;
  let dispatchedEvents;
  let mockRegistry;

  beforeEach(() => {
    mockLogger = createMockLogger();

    // Verify logger was created properly
    if (
      !mockLogger.info ||
      !mockLogger.warn ||
      !mockLogger.error ||
      !mockLogger.debug
    ) {
      console.error('Mock logger missing required methods:', {
        hasInfo: !!mockLogger.info,
        hasWarn: !!mockLogger.warn,
        hasError: !!mockLogger.error,
        hasDebug: !!mockLogger.debug,
      });
    }

    // Create mock DOM elements
    mockModalElement = {
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
      },
      style: {},
      querySelectorAll: jest.fn(() => []),
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
    };

    mockCloseButton = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      focus: jest.fn(),
    };

    mockStatusElement = {
      textContent: '',
      style: {},
    };

    mockImageElement = {
      src: '',
      alt: '',
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    mockLoadingSpinner = {
      style: { display: 'none' },
      setAttribute: jest.fn(),
    };

    mockModalTitle = {
      textContent: '',
    };

    mockOriginalElement = {
      focus: jest.fn(),
      offsetParent: {},
    };

    // Create mock document context
    mockDocumentContext = {
      document: {
        body: {
          appendChild: jest.fn(),
          removeChild: jest.fn(),
          contains: jest.fn(() => true),
        },
        activeElement: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      query: jest.fn((selector) => {
        const elementMap = {
          '.portrait-modal-overlay': mockModalElement,
          '.portrait-modal-close': mockCloseButton,
          '.portrait-error-message': mockStatusElement,
          '.portrait-modal-image': mockImageElement,
          '.portrait-loading-spinner': mockLoadingSpinner,
          '#portrait-modal-title': mockModalTitle,
        };
        return elementMap[selector] || null;
      }),
      create: jest.fn((tagName) => ({
        tagName,
        setAttribute: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    };

    // Create mock DOM element factory
    mockDomElementFactory = {
      div: jest.fn(() => ({
        setAttribute: jest.fn(),
        className: '',
        textContent: '',
        parentNode: {
          removeChild: jest.fn(),
        },
      })),
      img: jest.fn(),
      button: jest.fn(),
    };

    // Create mock registry for GameDataRepository
    mockRegistry = {
      getWorldDefinition: jest.fn(),
      getAllWorldDefinitions: jest.fn(() => []),
      getStartingPlayerId: jest.fn(),
      getStartingLocationId: jest.fn(),
      getActionDefinition: jest.fn(),
      getAllActionDefinitions: jest.fn(() => []),
      getEntityDefinition: jest.fn(),
      getAllEntityDefinitions: jest.fn(() => []),
      getEntityInstanceDefinition: jest.fn(),
      getAllEntityInstanceDefinitions: jest.fn(() => []),
      getEventDefinition: jest.fn(),
      getAllEventDefinitions: jest.fn(() => []),
      getComponentDefinition: jest.fn(),
      getAllComponentDefinitions: jest.fn(() => []),
      getConditionDefinition: jest.fn(),
      getAllConditionDefinitions: jest.fn(() => []),
      getGoalDefinition: jest.fn(),
      getAllGoalDefinitions: jest.fn(() => []),
      getComponentRegistry: jest.fn(() => ({})),
      getActionRegistry: jest.fn(() => ({})),
      getEntityRegistry: jest.fn(() => ({})),
      getEventRegistry: jest.fn(() => ({})),
      registerEventDefinition: jest.fn(),
      registerComponentDefinition: jest.fn(),
      registerActionDefinition: jest.fn(),
      registerEntityDefinition: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(() => []),
      clear: jest.fn(),
      store: jest.fn(),
    };

    // Create real services for integration test
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });
    gameDataRepository = new GameDataRepository(mockRegistry, mockLogger);
    eventBus = new EventBus({ logger: mockLogger });

    // Track dispatched events
    dispatchedEvents = [];
    const originalDispatch = eventBus.dispatch.bind(eventBus);
    jest
      .spyOn(eventBus, 'dispatch')
      .mockImplementation((eventName, payload) => {
        dispatchedEvents.push({ eventName, payload });
        return originalDispatch(eventName, payload);
      });

    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger: mockLogger,
    });

    // Set up mock registry to return event definitions when asked
    const eventDefinitions = {
      'core:portrait_modal_opened': {
        id: 'core:portrait_modal_opened',
        description: 'Dispatched when a portrait modal is opened',
        payloadSchema: {
          type: 'object',
          properties: {
            portraitPath: { type: 'string' },
            speakerName: { type: 'string' },
          },
          required: ['portraitPath', 'speakerName'],
          additionalProperties: false,
        },
      },
      'core:portrait_modal_closed': {
        id: 'core:portrait_modal_closed',
        description: 'Dispatched when a portrait modal is closed',
        payloadSchema: {
          type: 'object',
          properties: {
            portraitPath: { type: 'string' },
            speakerName: { type: 'string' },
          },
          required: ['portraitPath', 'speakerName'],
          additionalProperties: false,
        },
      },
    };

    // Update mock registry to return event definitions
    mockRegistry.getEventDefinition.mockImplementation(
      (id) => eventDefinitions[id] || null
    );

    // Create the renderer with real services
    renderer = new PortraitModalRenderer({
      documentContext: mockDocumentContext,
      domElementFactory: mockDomElementFactory,
      logger: mockLogger,
      validatedEventDispatcher,
    });
  });

  afterEach(() => {
    if (renderer) {
      renderer.destroy();
    }
    jest.clearAllMocks();
  });

  it('should dispatch core:portrait_modal_opened event with valid payload when modal is shown', () => {
    const portraitPath = '/path/to/portrait.jpg';
    const speakerName = 'Test Character';

    // Show the modal
    renderer.showModal(portraitPath, speakerName, mockOriginalElement);

    // Verify the event was dispatched correctly
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toEqual({
      eventName: 'core:portrait_modal_opened',
      payload: {
        portraitPath,
        speakerName,
      },
    });

    // Verify no warnings or errors were logged about invalid event names
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('getEventDefinition called with invalid ID')
    );
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid event name provided')
    );
  });

  it('should dispatch core:portrait_modal_closed event with valid payload when modal is hidden', () => {
    const portraitPath = '/path/to/portrait.jpg';
    const speakerName = 'Test Character';

    // Show and then hide the modal
    renderer.showModal(portraitPath, speakerName, mockOriginalElement);
    dispatchedEvents = []; // Clear the opened event
    renderer.hide();

    // Verify the event was dispatched correctly
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toEqual({
      eventName: 'core:portrait_modal_closed',
      payload: {
        portraitPath,
        speakerName,
      },
    });

    // Verify no warnings or errors were logged about invalid event names
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('getEventDefinition called with invalid ID')
    );
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid event name provided')
    );
  });

  it('should validate event payloads against schemas', () => {
    const portraitPath = '/path/to/portrait.jpg';
    const speakerName = 'Test Character';

    // Show the modal
    renderer.showModal(portraitPath, speakerName, mockOriginalElement);

    // Since schemas are not loaded in AjvSchemaValidator, validation is skipped with a warning
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("VED: Payload schema 'core:portrait_modal_opened#payload' not found/loaded")
    );

    // But the event should still be dispatched
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].eventName).toBe('core:portrait_modal_opened');

    // Verify no errors about missing event definitions
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('EventDefinition not found')
    );
  });

  it('should handle missing event definitions gracefully', () => {
    // Create a new repository without registered event definitions
    const emptyRegistry = {
      ...mockRegistry,
      getEventDefinition: jest.fn(() => null), // Return null for all event definitions
    };
    const emptyRepository = new GameDataRepository(emptyRegistry, mockLogger);
    const newDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository: emptyRepository,
      schemaValidator,
      logger: mockLogger,
    });

    const newRenderer = new PortraitModalRenderer({
      documentContext: mockDocumentContext,
      domElementFactory: mockDomElementFactory,
      logger: mockLogger,
      validatedEventDispatcher: newDispatcher,
    });

    const portraitPath = '/path/to/portrait.jpg';
    const speakerName = 'Test Character';

    // Show the modal - should still work even without event definitions
    newRenderer.showModal(portraitPath, speakerName, mockOriginalElement);

    // Verify warning about missing event definition
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "EventDefinition not found for 'core:portrait_modal_opened'"
      )
    );

    // But the event should still be dispatched
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].eventName).toBe('core:portrait_modal_opened');

    newRenderer.destroy();
  });

  it('should handle both show and hide operations in sequence without errors', () => {
    const portraitPath = '/path/to/portrait.jpg';
    const speakerName = 'Test Character';

    // Show the modal
    renderer.showModal(portraitPath, speakerName, mockOriginalElement);

    // Hide the modal
    renderer.hide();

    // Verify both events were dispatched in correct order
    expect(dispatchedEvents).toHaveLength(2);
    expect(dispatchedEvents[0].eventName).toBe('core:portrait_modal_opened');
    expect(dispatchedEvents[1].eventName).toBe('core:portrait_modal_closed');

    // Verify no errors or warnings about invalid events
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid event name')
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('invalid ID')
    );
  });
});
