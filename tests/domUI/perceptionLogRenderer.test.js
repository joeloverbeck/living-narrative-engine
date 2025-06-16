// tests/domUI/perceptionLogRenderer.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { PerceptionLogRenderer } from '../../src/domUI/perceptionLogRenderer.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../src/constants/componentIds.js';
import { TURN_STARTED_ID } from '../../src/constants/eventIds.js';

jest.mock('../../src/logging/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');

const PERCEPTION_LOG_LIST_SELECTOR = '#perception-log-list';
const CLASS_PREFIX = '[PerceptionLogRenderer]';

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve));

describe('PerceptionLogRenderer', () => {
  let dom;
  let document;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance;
  let mockEntityManager;
  let mockDocumentContext;
  let listContainerElementInDom;
  let turnStartedHandler;

  const setInternalCurrentActorId = (rendererInstance, actorId) => {
    rendererInstance['#currentActorId'] = actorId;
  };

  beforeEach(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body><ul id="perception-log-list"></ul></body></html>`
    );
    document = dom.window.document;

    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLUListElement = dom.window.HTMLUListElement;
    global.HTMLParagraphElement = dom.window.HTMLParagraphElement;

    const ConsoleLogger = require('../../src/logging/consoleLogger.js').default;
    const ValidatedEventDispatcher =
      require('../../src/events/validatedEventDispatcher.js').default;

    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher({});
    mockVed.subscribe.mockImplementation((eventName, handler) => {
      if (eventName === TURN_STARTED_ID) {
        turnStartedHandler = handler;
      }
      return jest.fn();
    });

    listContainerElementInDom = document.querySelector(
      PERCEPTION_LOG_LIST_SELECTOR
    );
    if (listContainerElementInDom) {
      // Spy on methods; these will be restored by jest.restoreAllMocks()
      jest.spyOn(listContainerElementInDom, 'appendChild');
      jest.spyOn(listContainerElementInDom, 'removeChild');
      Object.defineProperty(listContainerElementInDom, 'scrollHeight', {
        value: 200,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(listContainerElementInDom, 'clientHeight', {
        value: 100,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(listContainerElementInDom, 'scrollTop', {
        value: 0,
        writable: true,
        configurable: true,
      });
    }

    mockDocumentContext = {
      query: jest.fn((selector) => {
        if (selector === PERCEPTION_LOG_LIST_SELECTOR) {
          return listContainerElementInDom;
        }
        return document.querySelector(selector);
      }),
      create: jest.fn((tagName) => document.createElement(tagName)),
      document: document,
    };

    mockDomElementFactoryInstance = {
      create: jest.fn((tag) => document.createElement(tag)),
      li: jest.fn((className, textContent) => {
        const li = document.createElement('li');
        if (textContent !== undefined) li.textContent = textContent;
        if (className) li.className = className;
        const originalSetAttribute = li.setAttribute.bind(li);
        li.setAttribute = jest.fn((name, value) =>
          originalSetAttribute(name, value)
        );
        Object.defineProperty(li, 'title', {
          get: () => li.getAttribute('title') || '',
          set: (value) => li.setAttribute('title', value),
          configurable: true,
        });
        return li;
      }),
      p: jest.fn((className, textContent) => {
        const p = document.createElement('p');
        if (textContent !== undefined) p.textContent = textContent;
        if (className) p.className = className;
        return p;
      }),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restores all spies and mocks
    turnStartedHandler = undefined;
  });

  const createRenderer = (options = {}) => {
    return new PerceptionLogRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: mockDomElementFactoryInstance,
      entityManager: mockEntityManager,
      autoRefresh: true,
      ...options,
    });
  };

  describe('Constructor', () => {
    it('should initialize, bind listContainerElement, subscribe, and call refreshList', async () => {
      const refreshListSpy = jest
        .spyOn(PerceptionLogRenderer.prototype, 'refreshList')
        .mockResolvedValue();
      createRenderer();
      await flushPromises();
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        PERCEPTION_LOG_LIST_SELECTOR
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Successfully bound element 'listContainerElement' to selector '${PERCEPTION_LOG_LIST_SELECTOR}'.`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${CLASS_PREFIX} List container element successfully bound:`,
        listContainerElementInDom
      );
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        expect.any(Function)
      );
      expect(turnStartedHandler).toBeDefined();
      expect(refreshListSpy).toHaveBeenCalled();
      refreshListSpy.mockRestore();
    });

    it('should throw if listContainerElement is not found (by BaseListDisplayComponent)', () => {
      mockDocumentContext.query.mockImplementationOnce((selector) => {
        if (selector === PERCEPTION_LOG_LIST_SELECTOR) return null;
        return document.querySelector(selector);
      });
      const expectedErrorMessage = `${CLASS_PREFIX} 'listContainerElement' is not defined or not found in the DOM. This element is required for BaseListDisplayComponent. Ensure it's specified in elementsConfig.`;
      expect(() => createRenderer()).toThrow(expectedErrorMessage);
    });
  });

  describe('_getListItemsData', () => {
    let renderer;
    const actorId = 'player:hero';

    beforeEach(() => {
      renderer = createRenderer({ autoRefresh: false });
      mockLogger.warn.mockClear();
      mockLogger.info.mockClear();
      mockLogger.error.mockClear();
    });

    it('should return [] if no currentActorId', () => {
      setInternalCurrentActorId(renderer, null);
      expect(renderer._getListItemsData()).toEqual([]);
    });

    it('should return [] and log if actor entity not found', () => {
      setInternalCurrentActorId(renderer, actorId);
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      expect(renderer._getListItemsData()).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Actor entity '${actorId}' not found in _getListItemsData.`
      );
    });

    it('should return [] and log if actor has no perception log component', () => {
      setInternalCurrentActorId(renderer, actorId);
      const mockActor = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn(),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
      expect(renderer._getListItemsData()).toEqual([]);
    });

    it('should return [] and log if logEntries are empty or malformed', () => {
      setInternalCurrentActorId(renderer, actorId);
      const mockActor = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn(),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

      mockActor.getComponentData.mockReturnValueOnce({ logEntries: [] });
      expect(renderer._getListItemsData()).toEqual([]);
    });

    it('should return logEntries if valid', () => {
      setInternalCurrentActorId(renderer, actorId);
      const entries = [
        {
          descriptionText: 'Entry 1',
          timestamp: 'ts',
          perceptionType: 'type',
          actorId: 'a1',
        },
      ];
      const mockActor = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest
          .fn()
          .mockReturnValue({ logEntries: entries, maxEntries: 10 }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
      expect(renderer._getListItemsData()).toEqual(entries);
    });

    it('should return [] and log on generic error', () => {
      setInternalCurrentActorId(renderer, actorId);
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Fetch Error');
      });
      expect(renderer._getListItemsData()).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching perception log data'),
        expect.any(Error)
      );
    });
  });

  describe('_renderListItem', () => {
    let renderer;
    beforeEach(() => {
      renderer = createRenderer();
    });

    it('should create an LI with descriptionText and title', () => {
      const logEntry = {
        descriptionText: 'Test Log',
        timestamp: '12:00',
        perceptionType: 'Sight',
        actorId: 'npc:1',
        targetId: 'item:A',
      };
      const li = renderer._renderListItem(logEntry, 0, [logEntry]);
      expect(mockDomElementFactoryInstance.li).toHaveBeenCalledWith(
        'log-generic'
      );
      expect(li.textContent).toBe('Test Log');
      expect(li.setAttribute).toHaveBeenCalledWith(
        'title',
        expect.stringContaining('Time: 12:00')
      );
    });

    it('should return null and log warning for malformed log entry', () => {
      const malformedEntry = { timestamp: '12:01' };
      expect(
        renderer._renderListItem(malformedEntry, 0, [malformedEntry])
      ).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('malformed log entry'),
        expect.any(Object)
      );
    });
  });

  describe('_getEmptyListMessage', () => {
    let renderer;
    const actorId = 'player:hero';
    beforeEach(() => {
      renderer = createRenderer();
    });

    it('should return "No actor selected." if no currentActorId', () => {
      setInternalCurrentActorId(renderer, null);
      expect(renderer._getEmptyListMessage()).toBe('No actor selected.');
    });

    it('should return actor not found message if entity not found for currentActorId', () => {
      setInternalCurrentActorId(renderer, actorId);
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      expect(renderer._getEmptyListMessage()).toBe(
        `Actor '${actorId}' not found. Cannot display perception log.`
      );
    });

    it('should return "No perception log component..." if actor has no component', () => {
      setInternalCurrentActorId(renderer, actorId);
      const mockActor = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(false),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
      expect(renderer._getEmptyListMessage()).toBe(
        'No perception log component for this actor.'
      );
    });

    it('should return "Perception log is empty." if component data is empty', () => {
      setInternalCurrentActorId(renderer, actorId);
      const mockActor = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ logEntries: [] }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockActor);
      expect(renderer._getEmptyListMessage()).toBe('Perception log is empty.');
    });
  });

  describe('_onListRendered', () => {
    it('should effectively call scrollToBottom (test by effect)', () => {
      const renderer = createRenderer({ autoRefresh: false });
      renderer.elements.listContainerElement = listContainerElementInDom; // Ensure it's set
      Object.defineProperty(listContainerElementInDom, 'scrollHeight', {
        value: 200,
        configurable: true,
      });
      Object.defineProperty(listContainerElementInDom, 'clientHeight', {
        value: 100,
        configurable: true,
      });
      listContainerElementInDom.scrollTop = 0; // Reset

      renderer._onListRendered([], listContainerElementInDom);
      expect(listContainerElementInDom.scrollTop).toBe(200); // Check effect of scroll
    });
  });

  describe('#handleTurnStarted', () => {
    let renderer;
    const actorId = 'player:hero';

    beforeEach(() => {
      renderer = createRenderer({ autoRefresh: false });
      // Restore real refreshList for these tests, then spy on it
      if (jest.isMockFunction(renderer.refreshList))
        renderer.refreshList.mockRestore();
      jest.spyOn(renderer, 'refreshList').mockResolvedValue(); // Spy for call tracking
    });

    it('should set currentActorId and call refreshList on valid event', async () => {
      await turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: { entityId: actorId, entityType: 'player' },
      });
      expect(renderer['#currentActorId']).toBe(actorId);
      expect(renderer.refreshList).toHaveBeenCalled();
    });

    it('should set currentActorId to null and call refreshList if entityId is missing', async () => {
      await turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: { entityType: 'player' },
      });
      expect(renderer['#currentActorId']).toBeNull();
      expect(renderer.refreshList).toHaveBeenCalled();
    });

    it('should log error and attempt to update DOM if refreshList fails', async () => {
      const errorRenderer = createRenderer({ autoRefresh: false }); // Use a fresh instance
      // Make this instance's refreshList reject
      jest
        .spyOn(errorRenderer, 'refreshList')
        .mockRejectedValue(new Error('Simulated refreshList failure'));

      mockLogger.error.mockClear(); // Clear previous logs
      mockDomElementFactoryInstance.p.mockClear();
      if (listContainerElementInDom)
        listContainerElementInDom.appendChild.mockClear();

      // Need to get the handler bound to *this specific instance* if it's different
      // However, turnStartedHandler is captured globally from the last `createRenderer` in `beforeEach`.
      // For this test, it's better to call the method directly or re-capture the handler.
      // Let's call the method directly on errorRenderer for clarity.
      await errorRenderer['#handleTurnStarted']({
        type: TURN_STARTED_ID,
        payload: { entityId: actorId },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `${CLASS_PREFIX} Error during refreshList in #handleTurnStarted`
        ),
        expect.objectContaining({ message: 'Simulated refreshList failure' })
      );
      expect(mockDomElementFactoryInstance.p).toHaveBeenCalledWith(
        'error-message',
        'Error updating perception log.'
      );
      if (
        listContainerElementInDom &&
        mockDomElementFactoryInstance.p.mock.results[0]
      ) {
        expect(listContainerElementInDom.appendChild).toHaveBeenCalledWith(
          mockDomElementFactoryInstance.p.mock.results[0].value
        );
      }
    });
  });

  describe('dispose', () => {
    it('should call VED unsubscribe, clear currentActorId, and clear elements', () => {
      const mockUnsubscribe = jest.fn();
      const localMockVed =
        new (require('../../src/events/validatedEventDispatcher.js').default)(
          {}
        );
      localMockVed.subscribe = jest.fn().mockReturnValue(mockUnsubscribe);

      const renderer = new PerceptionLogRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: localMockVed, // Use the locally controlled mock
        domElementFactory: mockDomElementFactoryInstance,
        entityManager: mockEntityManager,
      });
      setInternalCurrentActorId(renderer, 'some-actor');

      renderer.dispose();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(renderer['#currentActorId']).toBeNull();
      expect(renderer.elements).toEqual({});
    });

    it('refreshList after dispose should log error due to missing listContainerElement', async () => {
      const renderer = createRenderer();
      renderer.dispose();
      await renderer.refreshList(); // Will call renderList
      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Cannot render list: 'listContainerElement' is not available.`
      );
    });
  });

  describe('Initial Display State (after constructor)', () => {
    it('should display "No actor selected." message initially', async () => {
      // Constructor calls refreshList -> renderList
      // _getListItemsData returns [] (actorId is null)
      // _getEmptyListMessage returns "No actor selected."
      // renderList appends a <p> with this message
      createRenderer();
      await flushPromises();

      expect(mockDomElementFactoryInstance.p).toHaveBeenCalledWith(
        'empty-list-message',
        'No actor selected.'
      );
      if (
        listContainerElementInDom &&
        mockDomElementFactoryInstance.p.mock.results[0]
      ) {
        expect(listContainerElementInDom.appendChild).toHaveBeenCalledWith(
          mockDomElementFactoryInstance.p.mock.results[0].value
        );
      }
    });
  });
});
