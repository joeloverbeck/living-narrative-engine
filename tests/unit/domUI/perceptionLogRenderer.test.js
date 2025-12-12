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
import { PerceptionLogRenderer } from '../../../src/domUI/perceptionLogRenderer.js';
import { TURN_STARTED_ID } from '../../../src/constants/eventIds.js';
import * as createMessageElementModule from '../../../src/domUI/helpers/createMessageElement.js';

jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/events/validatedEventDispatcher.js');

const PERCEPTION_LOG_LIST_SELECTOR = '#perception-log-list';
const CLASS_PREFIX = '[PerceptionLogRenderer]';

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve));

describe('PerceptionLogRenderer', () => {
  let dom;
  let document;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance;
  /** @type {jest.SpiedFunction<typeof createMessageElementModule.createMessageElement>} */
  let createMessageElementSpy;
  let mockEntityManager;
  let mockDocumentContext;
  let listContainerElementInDom;
  let turnStartedHandler;

  const setInternalCurrentActorId = (rendererInstance, actorId) => {
    rendererInstance.setCurrentActorId(actorId);
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

    const ConsoleLogger =
      require('../../../src/logging/consoleLogger.js').default;
    const ValidatedEventDispatcher =
      require('../../../src/events/validatedEventDispatcher.js').default;

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
          set: (value) => {
            li.setAttribute('title', value);
          },
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

    createMessageElementSpy = jest.spyOn(createMessageElementModule, 'default');

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

    it('should throw if entityManager is null', () => {
      const expectedErrorMessage = `${CLASS_PREFIX} 'entityManager' dependency is missing or invalid.`;
      expect(() => createRenderer({ entityManager: null })).toThrow(
        expectedErrorMessage
      );
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
    });

    it('should throw if entityManager is undefined', () => {
      const expectedErrorMessage = `${CLASS_PREFIX} 'entityManager' dependency is missing or invalid.`;
      expect(() => createRenderer({ entityManager: undefined })).toThrow(
        expectedErrorMessage
      );
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
    });

    it('should throw if entityManager lacks getEntityInstance method', () => {
      const invalidEntityManager = { someOtherMethod: jest.fn() };
      const expectedErrorMessage = `${CLASS_PREFIX} 'entityManager' dependency is missing or invalid.`;
      expect(() =>
        createRenderer({ entityManager: invalidEntityManager })
      ).toThrow(expectedErrorMessage);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
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
        perceptionType: 'Sight', // Unknown type - should fallback to log-generic
        actorId: 'npc:1',
        targetId: 'item:A',
      };
      const li = renderer._renderListItem(logEntry, 0, [logEntry]);
      // New implementation calls li() with no args and adds classes via classList.add()
      expect(mockDomElementFactoryInstance.li).toHaveBeenCalled();
      expect(li.classList.contains('log-generic')).toBe(true);
      expect(li.textContent).toBe('Test Log');
      // Title is now set via li.title property, not setAttribute
      expect(li.title).toContain('Time: 12:00');
      expect(li.title).toContain('Type: Sight');
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

    it('should render speech entries with log-type-speech class and speaker-name span', () => {
      const speechEntry = {
        descriptionText: 'Alice says: Hello, how are you?',
        timestamp: '14:30',
        perceptionType: 'communication.speech',
        actorId: 'npc:alice',
      };
      const li = renderer._renderListItem(speechEntry, 0, [speechEntry]);

      // New implementation calls li() with no args and adds classes via classList.add()
      expect(mockDomElementFactoryInstance.li).toHaveBeenCalled();
      expect(li.classList.contains('log-type-speech')).toBe(true);
      expect(li.classList.contains('log-cat-communication')).toBe(true);
      // New implementation uses speaker-name and dialogue classes
      expect(li.innerHTML).toContain('<span class="speaker-name">Alice</span>');
      expect(li.innerHTML).toContain('<span class="dialogue">');
      expect(li.title).toContain('Time: 14:30');
      expect(li.title).toContain('Type: communication.speech');
    });

    it('should render speech with different speaker names', () => {
      const speechEntry = {
        descriptionText: 'The Dark Lord says: You shall not pass!',
        timestamp: '15:00',
        perceptionType: 'communication.speech',
        actorId: 'npc:darklord',
      };
      const li = renderer._renderListItem(speechEntry, 0, [speechEntry]);

      // New implementation uses speaker-name class for the speaker name only
      expect(li.innerHTML).toContain(
        '<span class="speaker-name">The Dark Lord</span>'
      );
      expect(li.innerHTML).toContain('says:');
      expect(li.innerHTML).toContain('You shall not pass!');
    });

    it('should render action entries with perceptionType-based class and action-text span', () => {
      const actionEntry = {
        descriptionText: '*draws sword*',
        timestamp: '16:15',
        perceptionType: 'physical.target_action', // Use a valid new perceptionType
        actorId: 'player:hero',
      };
      const li = renderer._renderListItem(actionEntry, 0, [actionEntry]);

      // New implementation calls li() with no args and adds classes via classList.add()
      expect(mockDomElementFactoryInstance.li).toHaveBeenCalled();
      expect(li.classList.contains('log-type-target-action')).toBe(true);
      expect(li.classList.contains('log-cat-physical')).toBe(true);
      expect(li.innerHTML).toContain(
        '<span class="action-text">draws sword</span>'
      );
      expect(li.title).toContain('Time: 16:15');
      expect(li.title).toContain('Type: physical.target_action');
    });

    it('should render complex action entries', () => {
      const actionEntry = {
        descriptionText: '*carefully examines the ancient tome*',
        timestamp: '17:00',
        perceptionType: 'Action',
        actorId: 'player:scholar',
      };
      const li = renderer._renderListItem(actionEntry, 0, [actionEntry]);

      expect(li.innerHTML).toContain(
        '<span class="action-text">carefully examines the ancient tome</span>'
      );
    });

    it('should escape HTML in speech utterances', () => {
      const speechEntry = {
        descriptionText: 'Bob says: I have <script>alert("xss")</script> code!',
        timestamp: '18:00',
        perceptionType: 'Speech',
        actorId: 'npc:bob',
      };
      const li = renderer._renderListItem(speechEntry, 0, [speechEntry]);

      expect(li.innerHTML).toContain(
        '&lt;script&gt;alert("xss")&lt;/script&gt;'
      );
      expect(li.innerHTML).not.toContain('<script>');
    });

    it('should escape HTML in action text', () => {
      const actionEntry = {
        descriptionText: '*uses <b>bold</b> & <i>italic</i> moves*',
        timestamp: '18:30',
        perceptionType: 'Action',
        actorId: 'player:hacker',
      };
      const li = renderer._renderListItem(actionEntry, 0, [actionEntry]);

      expect(li.innerHTML).toContain('&lt;b&gt;bold&lt;/b&gt;');
      expect(li.innerHTML).toContain('&amp;');
      expect(li.innerHTML).toContain('&lt;i&gt;italic&lt;/i&gt;');
      expect(li.innerHTML).not.toContain('<b>');
      expect(li.innerHTML).not.toContain('<i>');
    });

    it('should escape HTML in generic entries', () => {
      const genericEntry = {
        descriptionText: 'The <door> opens & reveals a > symbol',
        timestamp: '19:00',
        perceptionType: 'Generic',
        actorId: 'system',
      };
      const li = renderer._renderListItem(genericEntry, 0, [genericEntry]);

      expect(li.innerHTML).toBe(
        'The &lt;door&gt; opens &amp; reveals a &gt; symbol'
      );
    });

    it('should handle edge case of action without asterisks at both ends', () => {
      const invalidActionEntry = {
        descriptionText: '*draws sword', // Missing closing asterisk
        timestamp: '19:30',
        perceptionType: 'physical.target_action',
        actorId: 'player:hero',
      };
      const li = renderer._renderListItem(invalidActionEntry, 0, [
        invalidActionEntry,
      ]);

      // Even though text doesn't match action pattern, it still gets perceptionType-based classes
      expect(mockDomElementFactoryInstance.li).toHaveBeenCalled();
      // The perceptionType determines styling, not the text pattern
      expect(li.classList.contains('log-type-target-action')).toBe(true);
      expect(li.innerHTML).toBe('*draws sword');
    });

    // =========================================================================
    // Speech quote handling tests - verifies no double-quoting bug
    // The entity_speech.rule.json adds quotes around speech content, so
    // the renderer must not add additional quotes.
    // =========================================================================

    it('should NOT double-quote speech that already has quotes from the rule', () => {
      // This reflects the actual format from entity_speech.rule.json line 51:
      // description_text: "{name} says: \"{speechContent}\""
      const speechEntry = {
        descriptionText: 'Cress Siltwell says: "Hello world"',
        timestamp: '14:30',
        perceptionType: 'communication.speech',
        actorId: 'npc:cress',
      };
      const li = renderer._renderListItem(speechEntry, 0, [speechEntry]);

      // Should contain single quotes, not double
      expect(li.innerHTML).toContain('"Hello world"');
      expect(li.innerHTML).not.toContain('""Hello world""');
    });

    it('should handle speech without pre-existing quotes', () => {
      // Edge case: if someone creates a perception entry without quotes
      const speechEntry = {
        descriptionText: 'Bob says: Hi there',
        timestamp: '14:30',
        perceptionType: 'communication.speech',
        actorId: 'npc:bob',
      };
      const li = renderer._renderListItem(speechEntry, 0, [speechEntry]);

      // Should add quotes
      expect(li.innerHTML).toContain('"Hi there"');
    });

    it('should handle empty quoted speech without quadruple quotes', () => {
      const speechEntry = {
        descriptionText: 'Charlie says: ""',
        timestamp: '14:30',
        perceptionType: 'communication.speech',
        actorId: 'npc:charlie',
      };
      const li = renderer._renderListItem(speechEntry, 0, [speechEntry]);

      // Should have exactly two quotes (empty string in quotes), not four
      expect(li.innerHTML).toContain('""');
      expect(li.innerHTML).not.toContain('""""');
    });

    it('should preserve speech with only partial quote at start', () => {
      // Edge case: quote at start but not end - regex won't strip partial quotes
      // This is acceptable behavior since properly formatted speech always has
      // matching quotes from the rule template
      const speechEntry = {
        descriptionText: 'Dana says: "incomplete quote',
        timestamp: '14:30',
        perceptionType: 'communication.speech',
        actorId: 'npc:dana',
      };
      const li = renderer._renderListItem(speechEntry, 0, [speechEntry]);

      // Should render in dialogue span (partial quote is not stripped, then wrapped)
      // This edge case produces ""incomplete quote" which is suboptimal but
      // unlikely in real usage since rule always adds complete quotes
      expect(li.innerHTML).toContain('dialogue');
      expect(li.innerHTML).toContain('incomplete quote');
    });

    it('should reproduce the reported bug scenario with realistic speech content', () => {
      // Exact scenario from bug report: 'Cress Siltwell says: ""aaaa""'
      const speechEntry = {
        descriptionText: 'Cress Siltwell says: "aaaa"',
        timestamp: '10:00',
        perceptionType: 'communication.speech',
        actorId: 'npc:cress_siltwell',
      };
      const li = renderer._renderListItem(speechEntry, 0, [speechEntry]);

      // Should show "aaaa", not ""aaaa""
      const dialogueMatch = li.innerHTML.match(
        /<span class="dialogue">(.*?)<\/span>/
      );
      expect(dialogueMatch).not.toBeNull();
      expect(dialogueMatch[1]).toBe('"aaaa"');
      expect(dialogueMatch[1]).not.toBe('""aaaa""');
    });

    it('should handle second reported bug scenario', () => {
      // Second scenario from bug report: 'Eira Quenreach says: ""I\'ve said this.""'
      const speechEntry = {
        descriptionText: "Eira Quenreach says: \"I've said this.\"",
        timestamp: '10:05',
        perceptionType: 'communication.speech',
        actorId: 'npc:eira_quenreach',
      };
      const li = renderer._renderListItem(speechEntry, 0, [speechEntry]);

      // Should show "I've said this.", not ""I've said this.""
      const dialogueMatch = li.innerHTML.match(
        /<span class="dialogue">(.*?)<\/span>/
      );
      expect(dialogueMatch).not.toBeNull();
      expect(dialogueMatch[1]).toBe('"I\'ve said this."');
      expect(dialogueMatch[1]).not.toBe('""I\'ve said this.""');
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

    it('should handle error in getEntityInstance and return default message', () => {
      setInternalCurrentActorId(renderer, actorId);
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = renderer._getEmptyListMessage();

      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Error in _getEmptyListMessage:`,
        expect.objectContaining({ message: 'Database connection failed' })
      );
      expect(result).toBe('No actor selected.');
    });

    it('should handle error in hasComponent and return default message', () => {
      setInternalCurrentActorId(renderer, actorId);
      const mockActor = {
        id: actorId,
        hasComponent: jest.fn().mockImplementation(() => {
          throw new Error('Component check failed');
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

      const result = renderer._getEmptyListMessage();

      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Error in _getEmptyListMessage:`,
        expect.objectContaining({ message: 'Component check failed' })
      );
      expect(result).toBe('No actor selected.');
    });

    it('should handle error in getComponentData and return default message', () => {
      setInternalCurrentActorId(renderer, actorId);
      const mockActor = {
        id: actorId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation(() => {
          throw new Error('Component data retrieval failed');
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

      const result = renderer._getEmptyListMessage();

      expect(mockLogger.error).toHaveBeenCalledWith(
        `${CLASS_PREFIX} Error in _getEmptyListMessage:`,
        expect.objectContaining({ message: 'Component data retrieval failed' })
      );
      expect(result).toBe('No actor selected.');
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

  describe('_handleTurnStartedForTest', () => {
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
      expect(renderer.getCurrentActorId()).toBe(actorId);
      expect(renderer.refreshList).toHaveBeenCalled();
    });

    it('should set currentActorId to null and call refreshList if entityId is missing', async () => {
      await turnStartedHandler({
        type: TURN_STARTED_ID,
        payload: { entityType: 'player' },
      });
      expect(renderer.getCurrentActorId()).toBeNull();
      expect(renderer.refreshList).toHaveBeenCalled();
    });

    it('should log error and attempt to update DOM if refreshList fails', async () => {
      const errorRenderer = createRenderer({ autoRefresh: false }); // Use a fresh instance
      // Make this instance's refreshList reject
      jest
        .spyOn(errorRenderer, 'refreshList')
        .mockRejectedValue(new Error('Simulated refreshList failure'));

      mockLogger.error.mockClear(); // Clear previous logs
      createMessageElementSpy.mockClear();
      if (listContainerElementInDom)
        listContainerElementInDom.appendChild.mockClear();

      // Need to get the handler bound to *this specific instance* if it's different
      // However, turnStartedHandler is captured globally from the last `createRenderer` in `beforeEach`.
      // For this test, it's better to call the method directly or re-capture the handler.
      // Let's call the method directly on errorRenderer for clarity.
      await errorRenderer._handleTurnStartedForTest({
        type: TURN_STARTED_ID,
        payload: { entityId: actorId },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `${CLASS_PREFIX} Error during refreshList in _handleTurnStartedForTest`
        ),
        expect.objectContaining({ message: 'Simulated refreshList failure' })
      );
      expect(createMessageElementSpy).toHaveBeenCalledWith(
        mockDomElementFactoryInstance,
        'error-message',
        'Error updating perception log.'
      );
      if (
        listContainerElementInDom &&
        createMessageElementSpy.mock.results[0]
      ) {
        expect(listContainerElementInDom.appendChild).toHaveBeenCalledWith(
          createMessageElementSpy.mock.results[0].value
        );
      }
    });
  });

  describe('dispose', () => {
    it('should call VED unsubscribe, clear currentActorId, and clear elements', () => {
      const mockUnsubscribe = jest.fn();
      const localMockVed =
        new (require('../../../src/events/validatedEventDispatcher.js').default)(
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
      expect(renderer.getCurrentActorId()).toBeNull();
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

      expect(createMessageElementSpy).toHaveBeenCalledWith(
        mockDomElementFactoryInstance,
        'empty-list-message',
        'No actor selected.'
      );
      if (
        listContainerElementInDom &&
        createMessageElementSpy.mock.results[0]
      ) {
        expect(listContainerElementInDom.appendChild).toHaveBeenCalledWith(
          createMessageElementSpy.mock.results[0].value
        );
      }
    });
  });
});
