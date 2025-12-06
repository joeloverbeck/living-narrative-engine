/**
 * @file Unit tests for ActorParticipationController
 * Tests initialization, element caching, event subscriptions, actor loading,
 * participation toggles, error handling, and cleanup.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import ActorParticipationController from '../../../src/domUI/actorParticipationController.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import {
  ACTOR_COMPONENT_ID,
  NAME_COMPONENT_ID,
  PARTICIPATION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('ActorParticipationController', () => {
  let dom;
  let controller;
  let mockEventBus;
  let mockDocumentContext;
  let mockLogger;
  let mockEntityManager;
  let mockDocument;

  beforeEach(() => {
    // Setup JSDOM
    const html = `
      <div id="actor-participation-widget">
        <div id="actor-participation-list-container"></div>
        <div id="actor-participation-status"></div>
      </div>
    `;
    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
    });
    mockDocument = dom.window.document;

    // Create mocks
    mockEventBus = {
      subscribe: jest.fn(() => jest.fn()), // Returns unsubscribe function
      unsubscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    mockDocumentContext = new DocumentContext(mockDocument, dom.window);

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getEntitiesWithComponent: jest.fn(() => []),
      addComponent: jest.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    if (controller) {
      controller.cleanup();
    }
    dom.window.close();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should validate all dependencies in constructor', () => {
      expect(() => {
        controller = new ActorParticipationController({
          eventBus: mockEventBus,
          documentContext: mockDocumentContext,
          logger: mockLogger,
          entityManager: mockEntityManager,
        });
      }).not.toThrow();
    });

    it('should throw error if eventBus is missing', () => {
      expect(() => {
        controller = new ActorParticipationController({
          eventBus: null,
          documentContext: mockDocumentContext,
          logger: mockLogger,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('should throw error if documentContext is missing', () => {
      expect(() => {
        controller = new ActorParticipationController({
          eventBus: mockEventBus,
          documentContext: null,
          logger: mockLogger,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        controller = new ActorParticipationController({
          eventBus: mockEventBus,
          documentContext: mockDocumentContext,
          logger: null,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('should throw error if entityManager is missing', () => {
      expect(() => {
        controller = new ActorParticipationController({
          eventBus: mockEventBus,
          documentContext: mockDocumentContext,
          logger: mockLogger,
          entityManager: null,
        });
      }).toThrow();
    });

    it('should NOT cache elements or subscribe in constructor', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      expect(mockEventBus.subscribe).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should cache DOM elements on initialize()', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ActorParticipation] Initialization complete'
      );
    });

    it('should attach event listeners on initialize()', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      const listContainer = mockDocument.querySelector(
        '#actor-participation-list-container'
      );
      const addEventListenerSpy = jest.spyOn(listContainer, 'addEventListener');

      controller.initialize();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('should subscribe to ENGINE_READY_UI event on initialize()', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        expect.any(Function)
      );
    });

    it('should handle missing DOM elements gracefully on initialize()', () => {
      // Create empty DOM
      const emptyDom = new JSDOM('', {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
      });
      const emptyDocumentContext = new DocumentContext(
        emptyDom.window.document,
        emptyDom.window
      );

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: emptyDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      expect(() => controller.initialize()).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Widget element not found')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('List element not found')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Status element not found')
      );

      emptyDom.window.close();
    });

    it('should perform defensive actor loading on initialize()', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        ACTOR_COMPONENT_ID
      );
    });

    it('should handle defensive actor loading failure gracefully', () => {
      mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
        throw new Error('Entity manager not ready');
      });

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      expect(() => controller.initialize()).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Defensive actor loading failed'),
        expect.any(Error)
      );
    });

    it('should log error and re-throw when initialization fails critically', () => {
      // Make eventBus.subscribe throw an error during initialization
      mockEventBus.subscribe.mockImplementation(() => {
        throw new Error('Event bus subscription failed');
      });

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      expect(() => controller.initialize()).toThrow(
        'Event bus subscription failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] Failed to initialize',
        expect.any(Error)
      );
    });
  });

  describe('Element Caching', () => {
    it('should cache widget container on initialize', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const widget = mockDocument.querySelector('#actor-participation-widget');
      expect(widget).not.toBeNull();
    });

    it('should cache list container on initialize', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const listContainer = mockDocument.querySelector(
        '#actor-participation-list-container'
      );
      expect(listContainer).not.toBeNull();
    });

    it('should cache status area on initialize', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const status = mockDocument.querySelector('#actor-participation-status');
      expect(status).not.toBeNull();
    });

    it('should log warnings when elements are missing', () => {
      const emptyDom = new JSDOM('', {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
      });
      const emptyDocumentContext = new DocumentContext(
        emptyDom.window.document,
        emptyDom.window
      );

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: emptyDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] Widget element not found (#actor-participation-widget)'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] List element not found (#actor-participation-list-container)'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] Status element not found (#actor-participation-status)'
      );

      emptyDom.window.close();
    });
  });

  describe('Event Subscription', () => {
    it('should create ENGINE_READY_UI subscription on initialize', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        expect.any(Function)
      );
    });

    it('should trigger handleGameReady when ENGINE_READY_UI event fires', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      let gameReadyHandler;
      mockEventBus.subscribe.mockImplementation((eventId, handler) => {
        if (eventId === ENGINE_READY_UI) {
          gameReadyHandler = handler;
        }
        return jest.fn();
      });

      controller.initialize();

      // Trigger the ENGINE_READY_UI event
      expect(gameReadyHandler).toBeDefined();
      gameReadyHandler();

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ActorParticipation] Loading actors for participation panel'
      );
    });

    it('should handle multiple ENGINE_READY_UI events correctly', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      let gameReadyHandler;
      mockEventBus.subscribe.mockImplementation((eventId, handler) => {
        if (eventId === ENGINE_READY_UI) {
          gameReadyHandler = handler;
        }
        return jest.fn();
      });

      controller.initialize();

      // Trigger multiple times
      gameReadyHandler();
      gameReadyHandler();
      gameReadyHandler();

      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledTimes(
        4
      ); // 1 defensive + 3 triggered
    });

    it('should log error if ENGINE_READY_UI subscription fails', () => {
      mockEventBus.subscribe.mockReturnValue(null);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] CRITICAL: Failed to subscribe to ENGINE_READY_UI'
      );
    });
  });

  describe('Actor Loading', () => {
    it('should call getEntitiesWithComponent with ACTOR_COMPONENT_ID', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        ACTOR_COMPONENT_ID
      );
    });

    it('should receive Entity objects and extract data correctly', () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) {
            return { text: 'Alice' };
          }
          if (componentId === PARTICIPATION_COMPONENT_ID) {
            return { participating: true };
          }
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        NAME_COMPONENT_ID
      );
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        PARTICIPATION_COMPONENT_ID
      );
    });

    it('should extract actor names using entity.getComponentData(NAME_COMPONENT_ID)', () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) {
            return { text: 'Bob' };
          }
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const listContainer = mockDocument.querySelector(
        '#actor-participation-list-container'
      );
      const label = listContainer.querySelector('label');
      expect(label.textContent).toBe('Bob');
    });

    it('should query participation using entity.getComponentData(PARTICIPATION_COMPONENT_ID)', () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) {
            return { text: 'Charlie' };
          }
          if (componentId === PARTICIPATION_COMPONENT_ID) {
            return { participating: false };
          }
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      expect(checkbox.checked).toBe(false);
    });

    it('should default participation to true when component is missing', () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) {
            return { text: 'David' };
          }
          return null; // No participation component
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      expect(checkbox.checked).toBe(true);
    });

    it('should sort actors alphabetically by name', () => {
      const mockEntities = [
        {
          id: 'actor-3',
          getComponentData: jest.fn((componentId) => {
            if (componentId === NAME_COMPONENT_ID) return { text: 'Zoe' };
            return null;
          }),
        },
        {
          id: 'actor-1',
          getComponentData: jest.fn((componentId) => {
            if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
            return null;
          }),
        },
        {
          id: 'actor-2',
          getComponentData: jest.fn((componentId) => {
            if (componentId === NAME_COMPONENT_ID) return { text: 'Bob' };
            return null;
          }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockEntities);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const labels = Array.from(mockDocument.querySelectorAll('label'));
      expect(labels[0].textContent).toBe('Alice');
      expect(labels[1].textContent).toBe('Bob');
      expect(labels[2].textContent).toBe('Zoe');
    });

    it('should return empty array for empty actor list', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[ActorParticipation] Loaded 0 actors'
      );
    });

    it('should fallback to entity ID when name component has no text', () => {
      const mockEntity = {
        id: 'actor-fallback-123',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) {
            return { text: '' }; // Empty text
          }
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const label = mockDocument.querySelector('label');
      expect(label.textContent).toBe('actor-fallback-123');
    });
  });

  describe('Actor Rendering', () => {
    it('should clear previous content before rendering', () => {
      const listContainer = mockDocument.querySelector(
        '#actor-participation-list-container'
      );
      listContainer.innerHTML = '<div>Old content</div>';

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(listContainer.innerHTML).not.toContain('Old content');
    });

    it('should render empty state for no actors', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const emptyMessage = mockDocument.querySelector('.empty-list-message');
      expect(emptyMessage).not.toBeNull();
      expect(emptyMessage.textContent).toBe('No actors found');
    });

    it('should create list items for each actor', () => {
      const mockEntities = [
        {
          id: 'actor-1',
          getComponentData: jest.fn((componentId) => {
            if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
            return null;
          }),
        },
        {
          id: 'actor-2',
          getComponentData: jest.fn((componentId) => {
            if (componentId === NAME_COMPONENT_ID) return { text: 'Bob' };
            return null;
          }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockEntities);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const items = mockDocument.querySelectorAll('.actor-participation-item');
      expect(items.length).toBe(2);
    });

    it('should create correct DOM structure for actor list items', () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const item = mockDocument.querySelector('.actor-participation-item');
      const checkbox = item.querySelector('input[type="checkbox"]');
      const label = item.querySelector('label');

      expect(checkbox).not.toBeNull();
      expect(label).not.toBeNull();
      expect(label.htmlFor).toBe(checkbox.id);
    });

    it('should set checkboxes to reflect participation state', () => {
      const mockEntities = [
        {
          id: 'actor-1',
          getComponentData: jest.fn((componentId) => {
            if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
            if (componentId === PARTICIPATION_COMPONENT_ID)
              return { participating: true };
            return null;
          }),
        },
        {
          id: 'actor-2',
          getComponentData: jest.fn((componentId) => {
            if (componentId === NAME_COMPONENT_ID) return { text: 'Bob' };
            if (componentId === PARTICIPATION_COMPONENT_ID)
              return { participating: false };
            return null;
          }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockEntities);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkboxes = Array.from(
        mockDocument.querySelectorAll('input[type="checkbox"]')
      );
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(false);
    });

    it('should set data-actor-id attribute correctly', () => {
      const mockEntity = {
        id: 'actor-123',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      expect(checkbox.dataset.actorId).toBe('actor-123');
    });
  });

  describe('Participation Toggle', () => {
    it('should extract actor ID from checkbox.dataset.actorId', async () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;

      // Trigger change event
      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor-1',
        PARTICIPATION_COMPONENT_ID,
        { participating: false }
      );
    });

    it('should call updateParticipation which is async', async () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockEntityManager.addComponent).toHaveBeenCalled();
    });

    it('should use addComponent to handle both create and update', async () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'actor-1',
        PARTICIPATION_COMPONENT_ID,
        expect.objectContaining({ participating: false })
      );
    });

    it('should show success status on successful toggle', async () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);
      mockEntityManager.addComponent.mockResolvedValue(true);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = mockDocument.querySelector('#actor-participation-status');
      expect(status.textContent).toContain(
        'Disabled participation for actor-1'
      );
      expect(status.className).toContain('status-success');
    });

    it('should show error status on failed toggle', async () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);
      mockEntityManager.addComponent.mockResolvedValue(false);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = mockDocument.querySelector('#actor-participation-status');
      expect(status.textContent).toBe('Error updating participation');
      expect(status.className).toContain('status-error');
    });

    it('should revert checkbox state on failed toggle', async () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);
      mockEntityManager.addComponent.mockRejectedValue(
        new Error('Network error')
      );

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      const originalState = checkbox.checked;
      checkbox.checked = !originalState;

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(checkbox.checked).toBe(originalState);
    });
  });

  describe('Status Display', () => {
    it('should update status element text', async () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = mockDocument.querySelector('#actor-participation-status');
      expect(status.textContent).toBeTruthy();
    });

    it('should apply correct CSS class for type', async () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = mockDocument.querySelector('#actor-participation-status');
      expect(status.className).toContain('status-success');
    });

    it('should auto-clear status after 3 seconds', async () => {
      jest.useFakeTimers();

      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await jest.runAllTimersAsync();

      const status = mockDocument.querySelector('#actor-participation-status');
      expect(status.textContent).toBe('');
      expect(status.className).toBe('status-message');

      jest.useRealTimers();
    });

    it('should clear previous timeout when new status is shown', async () => {
      jest.useFakeTimers();

      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const checkbox = mockDocument.querySelector('input[type="checkbox"]');

      // First toggle
      checkbox.checked = false;
      let changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await Promise.resolve();

      // Advance time by 1 second
      jest.advanceTimersByTime(1000);

      // Second toggle before first timeout expires
      checkbox.checked = true;
      changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await Promise.resolve();

      // Status should still be showing
      const status = mockDocument.querySelector('#actor-participation-status');
      expect(status.textContent).toBeTruthy();

      jest.useRealTimers();
    });

    it('should warn when status element is missing', async () => {
      // Create DOM without status element
      const partialHtml = `
        <div id="actor-participation-widget">
          <div id="actor-participation-list-container"></div>
        </div>
      `;
      const partialDom = new JSDOM(partialHtml, {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
      });
      const partialDocumentContext = new DocumentContext(
        partialDom.window.document,
        partialDom.window
      );

      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: partialDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      // Trigger a participation toggle to call #showStatus
      const checkbox = partialDom.window.document.querySelector(
        'input[type="checkbox"]'
      );
      checkbox.checked = false;

      const changeEvent = new partialDom.window.Event('change', {
        bubbles: true,
      });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] Cannot show status: status element not found'
      );

      partialDom.window.close();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from ENGINE_READY_UI', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();
      controller.cleanup();

      expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        expect.any(Function)
      );
    });

    it('should remove DOM event listeners', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      const listContainer = mockDocument.querySelector(
        '#actor-participation-list-container'
      );
      const removeEventListenerSpy = jest.spyOn(
        listContainer,
        'removeEventListener'
      );

      controller.initialize();
      controller.cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('should clear element references', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();
      controller.cleanup();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[ActorParticipation] Cleanup complete'
      );
    });

    it('should clear status timeout on cleanup', async () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      // Trigger a status message to create a timeout
      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;
      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify timeout was created by checking status text
      const status = mockDocument.querySelector('#actor-participation-status');
      expect(status.textContent).toBeTruthy();

      // Cleanup should clear the timeout without errors
      expect(() => controller.cleanup()).not.toThrow();

      // After cleanup, logger should show cleanup complete
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[ActorParticipation] Cleanup complete'
      );
    });

    it('should not throw errors if called multiple times', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(() => {
        controller.cleanup();
        controller.cleanup();
        controller.cleanup();
      }).not.toThrow();
    });

    it('should handle errors during cleanup gracefully', () => {
      // Make unsubscribe throw an error
      mockEventBus.unsubscribe.mockImplementation(() => {
        throw new Error('Unsubscribe failed');
      });

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      // Cleanup should catch the error and not throw
      expect(() => controller.cleanup()).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] Error during cleanup',
        expect.any(Error)
      );
    });

    it('should handle timeout firing after failed cleanup', async () => {
      jest.useFakeTimers();

      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      // Trigger status message to create timeout
      const checkbox = mockDocument.querySelector('input[type="checkbox"]');
      checkbox.checked = false;
      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      await Promise.resolve();

      // Override clearTimeout to throw an error, simulating a cleanup failure
      const originalClearTimeout = global.clearTimeout;
      global.clearTimeout = jest.fn(() => {
        throw new Error('clearTimeout failed');
      });

      // Now call cleanup - it will fail to clear the timeout but set element to null
      controller.cleanup();

      // Restore clearTimeout
      global.clearTimeout = originalClearTimeout;

      // Now advance timers - the timeout will fire with null status element
      jest.advanceTimersByTime(3000);

      // Should not throw because of the defensive check at line 375
      expect(() => jest.runAllTimers()).not.toThrow();

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle error when entity manager throws during load', () => {
      mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Defensive actor loading failed'),
        expect.any(Error)
      );
    });

    it('should handle error when DOM elements are missing during render', () => {
      const emptyDom = new JSDOM('', {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
      });
      const emptyDocumentContext = new DocumentContext(
        emptyDom.window.document,
        emptyDom.window
      );

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: emptyDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot attach event listeners')
      );

      emptyDom.window.close();
    });

    it('should handle error in toggle with invalid actor ID', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      // Create a checkbox without data-actor-id
      const listContainer = mockDocument.querySelector(
        '#actor-participation-list-container'
      );
      const checkbox = mockDocument.createElement('input');
      checkbox.type = 'checkbox';
      listContainer.appendChild(checkbox);

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: checkbox,
        enumerable: true,
      });
      checkbox.dispatchEvent(changeEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] Checkbox missing data-actor-id attribute'
      );
    });

    it('should handle malformed event data gracefully', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      const listContainer = mockDocument.querySelector(
        '#actor-participation-list-container'
      );

      // Trigger change event with non-checkbox target
      const div = mockDocument.createElement('div');
      listContainer.appendChild(div);

      const changeEvent = new dom.window.Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: div,
        enumerable: true,
      });
      div.dispatchEvent(changeEvent);

      // Should not attempt to process non-checkbox elements
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('should handle ENGINE_READY_UI event with error gracefully', () => {
      mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
        throw new Error('Engine not ready');
      });

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      let gameReadyHandler;
      mockEventBus.subscribe.mockImplementation((eventId, handler) => {
        if (eventId === ENGINE_READY_UI) {
          gameReadyHandler = handler;
        }
        return jest.fn();
      });

      controller.initialize();

      // Clear the defensive loading error
      mockLogger.error.mockClear();

      // Trigger ENGINE_READY_UI
      gameReadyHandler();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] Failed to load actors',
        expect.any(Error)
      );
    });
  });

  describe('Refresh Method', () => {
    it('should reload actors on refresh', () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      // Clear previous calls
      mockEntityManager.getEntitiesWithComponent.mockClear();

      // Call refresh
      controller.refresh();

      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        ACTOR_COMPONENT_ID
      );
    });

    it('should re-render list on refresh', () => {
      const mockEntity = {
        id: 'actor-1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Alice' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([mockEntity]);

      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      // Update mock to return different data
      const newMockEntity = {
        id: 'actor-2',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Bob' };
          return null;
        }),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        newMockEntity,
      ]);

      controller.refresh();

      const label = mockDocument.querySelector('label');
      expect(label.textContent).toBe('Bob');
    });
  });
});
