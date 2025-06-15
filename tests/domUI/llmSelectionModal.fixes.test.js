// tests/domUI/llmSelectionModal.fixes.test.js
// --- FILE START ---

import { LlmSelectionModal } from '../../src/domUI/index.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

// Helper to create a basic mock DOM element
const createMockElement = (tag = 'div', id = null) => {
  const _internalClassSet = new Set();
  const _attributes = {}; // Store attributes for hasAttribute and getAttribute

  const classListMock = {
    _set: _internalClassSet,
    add: jest.fn((...classes) =>
      classes.forEach((c) => {
        if (typeof c === 'string')
          c.trim()
            .split(/\s+/)
            .forEach((cn) => {
              if (cn) _internalClassSet.add(cn);
            });
      })
    ),
    remove: jest.fn((...classes) =>
      classes.forEach((c) => {
        if (typeof c === 'string')
          c.trim()
            .split(/\s+/)
            .forEach((cn) => {
              if (cn) _internalClassSet.delete(cn);
            });
      })
    ),
    contains: jest.fn(
      (cls) =>
        typeof cls === 'string' &&
        cls.trim() !== '' &&
        _internalClassSet.has(cls.trim())
    ),
    toggle: jest.fn((cls, force) => {
      if (typeof cls !== 'string' || cls.trim() === '') return false;
      const trimmedClass = cls.trim();
      const currentlyHas = _internalClassSet.has(trimmedClass);
      let shouldHave = typeof force === 'undefined' ? !currentlyHas : force;
      if (shouldHave) _internalClassSet.add(trimmedClass);
      else _internalClassSet.delete(trimmedClass);
      return shouldHave;
    }),
    item: jest.fn((index) => Array.from(_internalClassSet)[index] || null),
    get length() {
      return _internalClassSet.size;
    },
    toString: jest.fn(() => Array.from(_internalClassSet).join(' ')),
    forEach: jest.fn((callback) => _internalClassSet.forEach(callback)),
    [Symbol.iterator]: function* () {
      for (const item of _internalClassSet) yield item;
    },
  };

  const element = Object.assign(
    Object.create(
      global.HTMLElement ? global.HTMLElement.prototype : Object.prototype
    ),
    {
      tag,
      id,
      dataset: {},
      classList: classListMock,
      attributes: _attributes, // Use the internal _attributes store
      children: [],
      style: {},
      textContent: '',
      innerHTML: '',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      appendChild: jest.fn((child) => {
        element.children.push(child);
      }),
      setAttribute: jest.fn((name, value) => {
        _attributes[name] = value;
      }),
      getAttribute: jest.fn((name) =>
        _attributes[name] === undefined ? null : _attributes[name]
      ), // Mock getAttribute
      hasAttribute: jest.fn((name) => _attributes.hasOwnProperty(name)), // Mock hasAttribute
      focus: jest.fn(),
      querySelectorAll: jest.fn((selector) => {
        if (selector === 'li.llm-item') {
          return element.children.filter(
            (c) =>
              c.tag === 'li' && c.classList && c.classList.contains('llm-item')
          );
        }
        return [];
      }),
      querySelector: jest.fn((selector) => {
        if (selector === 'li.llm-item.selected[tabindex="0"]') {
          return (
            element.children.find(
              (c) =>
                c.tag === 'li' &&
                c.classList &&
                c.classList.contains('llm-item') &&
                c.classList.contains('selected') &&
                c.attributes['tabindex'] === '0'
            ) || null
          );
        }
        if (selector === 'li.llm-item[tabindex="0"]') {
          return (
            element.children.find(
              (c) =>
                c.tag === 'li' &&
                c.classList &&
                c.classList.contains('llm-item') &&
                c.attributes['tabindex'] === '0'
            ) || null
          );
        }
        return null;
      }),
    }
  );
  return element;
};

describe('LlmSelectionModal', () => {
  let loggerMock;
  let documentContextMock;
  let domElementFactoryMock;
  let llmAdapterMock;
  let validatedEventDispatcherMock;
  let modalElementMock;
  let llmListElementMock;
  let closeModalButtonMock;
  let llmStatusMessageElementMock;
  let changeLlmButtonMock;
  let llmSelectionModal;

  beforeEach(() => {
    global.HTMLElement = function HTMLElement() {};
    loggerMock = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    modalElementMock = createMockElement('div', 'llm-selection-modal');
    llmListElementMock = createMockElement('ul', 'llm-selection-list');
    closeModalButtonMock = createMockElement(
      'button',
      'llm-selection-modal-close-button'
    );
    llmStatusMessageElementMock = createMockElement(
      'div',
      'llm-selection-status-message'
    );
    changeLlmButtonMock = createMockElement('button', 'change-llm-button');

    documentContextMock = {
      query: jest.fn((selector) => {
        if (selector === '#llm-selection-modal') return modalElementMock;
        if (selector === '#llm-selection-list') return llmListElementMock;
        if (selector === '#llm-selection-modal-close-button')
          return closeModalButtonMock;
        if (selector === '#llm-selection-status-message')
          return llmStatusMessageElementMock;
        if (selector === '#change-llm-button') return changeLlmButtonMock;
        return null;
      }),
      create: jest.fn((tag) => createMockElement(tag)),
      document: {
        activeElement: null,
        body: createMockElement('body'), // Mock body with basic methods if needed by SUT (e.g. body.contains)
        defaultView: { HTMLElement: global.HTMLElement },
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    };
    // Ensure body.contains is mocked if BaseModalRenderer uses it
    documentContextMock.document.body.contains = jest
      .fn()
      .mockReturnValue(true);

    domElementFactoryMock = {
      create: jest.fn((tag, options = {}) => {
        const el = createMockElement(tag);
        if (options.cls) {
          const classesToAdd = Array.isArray(options.cls)
            ? options.cls
            : [options.cls];
          el.classList.add(...classesToAdd);
        }
        if (options.text) el.textContent = options.text;
        if (options.id) el.id = options.id;
        el.addEventListener = jest.fn();
        el.removeEventListener = jest.fn();
        el.focus = jest.fn(); // Ensure focus is a jest.fn on all created elements
        return el;
      }),
    };

    llmAdapterMock = {
      getAvailableLlmOptions: jest.fn(),
      getCurrentActiveLlmId: jest.fn(),
      setActiveLlm: jest.fn(),
    };
    validatedEventDispatcherMock = {
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      dispatch: jest.fn(),
      unsubscribe: jest.fn(),
    };

    global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
    global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));
    jest.useFakeTimers();

    llmSelectionModal = new LlmSelectionModal({
      logger: loggerMock,
      documentContext: documentContextMock,
      domElementFactory: domElementFactoryMock,
      llmAdapter: llmAdapterMock,
      validatedEventDispatcher: validatedEventDispatcherMock,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
    delete global.HTMLElement;
  });

  describe('show() method', () => {
    it('should log warnings and show 0 valid options if adapter returns an array of strings (simulating bug)', async () => {
      const mockLlmIdsAsStrings = ['id1-string', 'id2-string', 'id3-string'];
      const currentActiveId = 'id1-string';
      llmAdapterMock.getAvailableLlmOptions.mockResolvedValue(
        mockLlmIdsAsStrings
      );
      llmAdapterMock.getCurrentActiveLlmId.mockResolvedValue(currentActiveId);

      llmSelectionModal.show();
      await new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
      );
      jest.runAllTimers();

      expect(loggerMock.debug).toHaveBeenCalledWith(
        '[LlmSelectionModal] Fetching LLM list data...'
      );
      expect(loggerMock.debug).toHaveBeenCalledWith(
        `[LlmSelectionModal] Fetched ${mockLlmIdsAsStrings.length} LLM options. Active ID: ${currentActiveId}`
      );
      expect(llmAdapterMock.getAvailableLlmOptions).toHaveBeenCalledTimes(1);

      expect(loggerMock.warn).toHaveBeenCalledTimes(mockLlmIdsAsStrings.length);
      mockLlmIdsAsStrings.forEach((strOption, index) => {
        expect(loggerMock.warn).toHaveBeenCalledWith(
          `[LlmSelectionModal] LLM option at index ${index} is missing configId. Skipping.`,
          { optionData: strOption }
        );
      });

      const llmItemCreations = domElementFactoryMock.create.mock.calls.filter(
        (call) => call[0] === 'li' && call[1]?.cls?.includes('llm-item')
      );
      expect(llmItemCreations.length).toBe(0);

      const appendedLlmItems = llmListElementMock.appendChild.mock.calls.filter(
        (call) => call[0].classList && call[0].classList.contains('llm-item')
      );
      expect(appendedLlmItems.length).toBe(0);

      // Corrected: SUT does NOT create an "empty message" if listData.llmOptions was initially populated
      // but all items failed _renderListItem. It renders an empty list.
      const emptyMessageCreationCall =
        domElementFactoryMock.create.mock.calls.find(
          (call) =>
            call[0] === 'li' &&
            call[1]?.text === 'No Language Models are currently configured.'
        );
      expect(emptyMessageCreationCall).toBeUndefined();

      expect(modalElementMock.style.display).toBe('flex');
      expect(modalElementMock.classList.contains('visible')).toBe(true);
      // In this case, _getInitialFocusElement should return the closeButton.
      expect(closeModalButtonMock.focus).toHaveBeenCalled();
    });

    it('should display a "no options" message if adapter returns an empty list', async () => {
      llmAdapterMock.getAvailableLlmOptions.mockResolvedValue([]);
      llmAdapterMock.getCurrentActiveLlmId.mockResolvedValue(null);

      llmSelectionModal.show();
      await new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
      );
      jest.runAllTimers();

      expect(domElementFactoryMock.create).toHaveBeenCalledWith('li', {
        text: 'No Language Models are currently configured.',
        cls: 'llm-item-message llm-empty-message',
      });
      const appendedArgs = llmListElementMock.appendChild.mock.calls;
      expect(appendedArgs.length).toBe(1);
      expect(appendedArgs[0][0].textContent).toBe(
        'No Language Models are currently configured.'
      );
      expect(appendedArgs[0][0].classList.contains('llm-empty-message')).toBe(
        true
      );

      expect(loggerMock.warn).toHaveBeenCalledWith(
        '[LlmSelectionModal] LLM list is empty or failed to load. Displaying empty/error message.'
      );
      expect(closeModalButtonMock.focus).toHaveBeenCalled();
    });

    it('should display an empty message if fetching LLM options fails', async () => {
      const errorMessageContent = 'Network error';
      llmAdapterMock.getAvailableLlmOptions.mockRejectedValue(
        new Error(errorMessageContent)
      );
      llmAdapterMock.getCurrentActiveLlmId.mockResolvedValue(null);

      llmSelectionModal.show();
      await new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
      );
      jest.runAllTimers();

      expect(loggerMock.error).toHaveBeenCalledWith(
        `[LlmSelectionModal] Error fetching LLM data from adapter: ${errorMessageContent}`,
        { error: new Error(errorMessageContent) }
      );

      expect(domElementFactoryMock.create).toHaveBeenCalledWith('li', {
        text: 'No Language Models are currently configured.',
        cls: 'llm-item-message llm-empty-message',
      });
      const appendedArgs = llmListElementMock.appendChild.mock.calls;
      expect(appendedArgs.length).toBe(1);
      expect(appendedArgs[0][0].textContent).toBe(
        'No Language Models are currently configured.'
      );
      expect(appendedArgs[0][0].classList.contains('llm-empty-message')).toBe(
        true
      );

      expect(closeModalButtonMock.focus).toHaveBeenCalled();
    });
  });
});

// --- FILE END ---
