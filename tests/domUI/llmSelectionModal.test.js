// tests/domUI/llmSelectionModal.test.js
// --- FILE START ---

import { JSDOM } from 'jsdom';
import { LlmSelectionModal } from '../../src/domUI/index.js'; // Adjusted path if necessary
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

// Mock requestAnimationFrame for JSDOM
if (typeof global !== 'undefined' && !global.requestAnimationFrame) {
  global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}

describe('LlmSelectionModal Refactored', () => {
  let dom;
  let mockDocument;
  let mockWindow;

  let mockLogger;
  let mockDocumentContext;
  let mockDomElementFactory;
  let mockLlmAdapter;
  let mockValidatedEventDispatcher; // Added for BaseModalRenderer

  // DOM Elements that are part of the modal structure
  let modalElement;
  let llmListElement;
  let closeModalButton;
  let llmStatusMessageElement;

  // External trigger element
  let changeLlmButton;

  const elementsConfig = {
    modalElement: { selector: '#llm-selection-modal', required: true },
    closeButton: {
      selector: '#llm-selection-modal-close-button',
      required: true,
    },
    listContainerElement: { selector: '#llm-selection-list', required: true },
    statusMessageElement: {
      selector: '#llm-selection-status-message',
      required: false,
    },
  };

  beforeEach(() => {
    const html = `
            <body>
                <button id="change-llm-button">Change LLM</button>
                <div id="llm-selection-modal" class="modal-overlay" style="display: none;">
                    <div class="modal-content">
                        <h2>Select LLM</h2>
                        <button id="llm-selection-modal-close-button" class="modal-close-button">Close</button>
                        <ul id="llm-selection-list" class="llm-options-list"></ul>
                        <div id="llm-selection-status-message" class="status-message-area"></div>
                    </div>
                </div>
            </body>
        `;
    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
    });
    mockWindow = dom.window;
    mockDocument = dom.window.document;

    global.window = mockWindow;
    global.document = mockDocument;
    global.HTMLElement = mockWindow.HTMLElement;
    global.Element = mockWindow.Element; // Needed for instanceof checks in BoundDomRendererBase
    global.Node = mockWindow.Node; // Needed for some DOM manipulations
    global.Event = mockWindow.Event;
    global.CustomEvent = mockWindow.CustomEvent;
    global.MouseEvent = mockWindow.MouseEvent;
    global.KeyboardEvent = mockWindow.KeyboardEvent; // For BaseModalRenderer Escape key

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Get elements from the JSDOM
    changeLlmButton = mockDocument.getElementById('change-llm-button');
    modalElement = mockDocument.getElementById('llm-selection-modal');
    llmListElement = mockDocument.getElementById('llm-selection-list');
    closeModalButton = mockDocument.getElementById(
      'llm-selection-modal-close-button'
    );
    llmStatusMessageElement = mockDocument.getElementById(
      'llm-selection-status-message'
    );

    // Spy on methods of actual DOM elements if needed for BaseModalRenderer interactions
    jest.spyOn(modalElement, 'addEventListener');
    jest.spyOn(modalElement, 'focus');
    jest.spyOn(closeModalButton, 'addEventListener');
    jest.spyOn(closeModalButton, 'focus');
    if (changeLlmButton) jest.spyOn(changeLlmButton, 'addEventListener');

    mockDocumentContext = {
      query: jest.fn((selector) => {
        // Simulate document.querySelector and element.querySelector behavior
        if (
          typeof this === 'undefined' ||
          this === mockDocumentContext ||
          this === mockDocument
        ) {
          // query called on document context directly
          switch (selector) {
            case '#change-llm-button':
              return changeLlmButton;
            case elementsConfig.modalElement.selector:
              return modalElement;
            case elementsConfig.closeButton.selector:
              return closeModalButton;
            case elementsConfig.listContainerElement.selector:
              return llmListElement;
            case elementsConfig.statusMessageElement.selector:
              return llmStatusMessageElement;
            default:
              return mockDocument.querySelector(selector);
          }
        } else if (this instanceof mockWindow.HTMLElement) {
          // query called on an element
          return this.querySelector(selector);
        }
        return null;
      }),
      create: jest.fn((tagName) => mockDocument.createElement(tagName)),
      document: mockDocument, // BaseModalRenderer needs access to document.activeElement and for Escape key
    };

    mockDomElementFactory = new DomElementFactory(mockDocumentContext);
    jest
      .spyOn(mockDomElementFactory, 'create')
      .mockImplementation((tagName, options = {}) => {
        const el = mockDocument.createElement(tagName);
        if (options.cls)
          el.className = Array.isArray(options.cls)
            ? options.cls.join(' ')
            : options.cls;
        if (options.text) el.textContent = options.text;
        if (options.id) el.id = options.id;
        if (options.attrs) {
          Object.entries(options.attrs).forEach(([key, value]) =>
            el.setAttribute(key, value)
          );
        }
        Object.entries(options).forEach(([key, value]) => {
          if (key.startsWith('data-')) {
            el.dataset[key.substring(5)] = value;
          }
        });
        jest.spyOn(el, 'addEventListener');
        jest.spyOn(el, 'removeEventListener'); // For BaseModalRenderer cleanup
        jest.spyOn(el, 'focus');
        return el;
      });

    mockLlmAdapter = {
      getAvailableLlmOptions: jest.fn(),
      getCurrentActiveLlmId: jest.fn(),
      setActiveLlm: jest.fn(),
    };

    mockValidatedEventDispatcher = {
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      dispatch: jest.fn(),
      unsubscribe: jest.fn(), // Though likely not directly called by BaseModalRenderer
    };

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers(); // Clear any pending timers
    jest.useRealTimers();
    if (mockWindow) mockWindow.close();
    global.window = undefined;
    global.document = undefined;
    global.HTMLElement = undefined;
    global.Element = undefined;
    global.Node = undefined;
    global.Event = undefined;
    global.CustomEvent = undefined;
    global.MouseEvent = undefined;
    global.KeyboardEvent = undefined;
  });

  const createInstance = () =>
    new LlmSelectionModal({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      domElementFactory: mockDomElementFactory,
      llmAdapter: mockLlmAdapter,
      validatedEventDispatcher: mockValidatedEventDispatcher,
    });

  describe('Constructor and Initialization (extending BaseModalRenderer)', () => {
    it('should call super with correct elementsConfig and dependencies', () => {
      const modal = createInstance();
      // BaseModalRenderer (via BoundDomRendererBase) will call documentContext.query
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        elementsConfig.modalElement.selector
      );
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        elementsConfig.closeButton.selector
      );
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        elementsConfig.listContainerElement.selector
      );
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        elementsConfig.statusMessageElement.selector
      );
      expect(modal.elements.modalElement).toBe(modalElement);
      expect(modal.elements.closeButton).toBe(closeModalButton);
      expect(modal.elements.listContainerElement).toBe(llmListElement);
      expect(modal.elements.statusMessageElement).toBe(llmStatusMessageElement);
    });

    it('should attach event listener to external #change-llm-button', () => {
      createInstance();
      expect(changeLlmButton.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        undefined
      );
    });

    it('should call show() on #change-llm-button click', () => {
      const modal = createInstance();
      const showSpy = jest
        .spyOn(modal, 'show')
        .mockImplementation(() => Promise.resolve());
      const clickCallback = changeLlmButton.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )[1];
      clickCallback();
      expect(showSpy).toHaveBeenCalledTimes(1);
    });

    it('should log error if #change-llm-button is not found', () => {
      const originalButton = changeLlmButton;
      changeLlmButton = null; // Make it null for this test
      // Adjust mockDocumentContext.query to return null for this specific selector
      const originalQuery = mockDocumentContext.query;
      mockDocumentContext.query = jest.fn((selector) => {
        if (selector === '#change-llm-button') return null;
        return originalQuery(selector); // Delegate other queries
      });

      createInstance();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not find #change-llm-button element.')
      );

      changeLlmButton = originalButton; // Restore
      mockDocumentContext.query = originalQuery; // Restore
    });
  });

  describe('_onShow Lifecycle Hook', () => {
    it('should call renderLlmList when _onShow is triggered (via show)', async () => {
      const modal = createInstance();
      const renderLlmListSpy = jest
        .spyOn(modal, 'renderLlmList')
        .mockResolvedValue();
      // mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue([]); // Prevent errors in renderLlmList

      await modal.show(); // show calls _onShow
      jest.runAllTimers(); // For requestAnimationFrame in BaseModalRenderer.show

      expect(renderLlmListSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('_onHide Lifecycle Hook', () => {
    it('should clear the listContainerElement innerHTML when _onHide is triggered', async () => {
      const modal = createInstance();
      await modal.show(); // To make it visible first
      jest.runAllTimers();

      llmListElement.innerHTML = '<li>Some item</li>';
      await modal.hide(); // hide calls _onHide (after animation timeout)
      jest.runAllTimers(); // For setTimeout in BaseModalRenderer.hide

      expect(llmListElement.innerHTML).toBe('');
    });
  });

  describe('_getInitialFocusElement', () => {
    let modal;
    const mockOptions = [{ configId: 'llm1', displayName: 'LLM One' }];

    beforeEach(async () => {
      modal = createInstance();
      // Populate the list to test focus on items
      mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue(mockOptions);
      mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);
      await modal.show(); // This populates the list via _onShow -> renderLlmList
      jest.runAllTimers();
    });

    it('should return the selected LLM item if one is selected and has tabindex 0', () => {
      const firstItem = llmListElement.querySelector('li.llm-item');
      firstItem.classList.add('selected'); // Manually select for test
      firstItem.setAttribute('tabindex', '0');
      expect(modal._getInitialFocusElement()).toBe(firstItem);
    });

    it('should return the first LLM item if no item is selected but list has items and first has tabindex 0', () => {
      // _onListRendered should set tabindex 0 on the first item
      const firstItem = llmListElement.querySelector(
        'li.llm-item[tabindex="0"]'
      );
      expect(modal._getInitialFocusElement()).toBe(firstItem);
    });

    it('should return the closeButton if list is empty or no item has tabindex 0', async () => {
      llmListElement.innerHTML = ''; // Clear list
      // Re-show to simulate empty list scenario if needed, or just test _getInitialFocusElement directly
      mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue([]);
      await modal.renderLlmList(); // Re-render with empty
      jest.runAllTimers();

      expect(modal._getInitialFocusElement()).toBe(closeModalButton);
    });
  });

  describe('List Rendering (_getListItemsData, _renderListItem, _getEmptyListMessage, _onListRendered, renderLlmList)', () => {
    let modal;
    beforeEach(() => {
      modal = createInstance();
    });

    describe('_getListItemsData', () => {
      it('should fetch and return LLM options and active ID', async () => {
        const mockOpts = [{ configId: 'id1', displayName: 'Name1' }];
        const mockActiveId = 'id1';
        mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue(mockOpts);
        mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(mockActiveId);

        const data = await modal._getListItemsData();
        expect(data).toEqual({
          llmOptions: mockOpts,
          currentActiveLlmId: mockActiveId,
        });
        expect(mockLlmAdapter.getAvailableLlmOptions).toHaveBeenCalledTimes(1);
        expect(mockLlmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
      });

      it('should return null and log error if getAvailableLlmOptions fails', async () => {
        mockLlmAdapter.getAvailableLlmOptions.mockRejectedValue(
          new Error('Fetch failed')
        );
        const data = await modal._getListItemsData();
        expect(data).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error fetching LLM data'),
          expect.any(Object)
        );
      });
    });

    describe('_renderListItem', () => {
      const allData = { llmOptions: [], currentActiveLlmId: 'activeId' };

      it('should create an <li> with correct attributes and text', () => {
        const option = { configId: 'id1', displayName: 'LLM Display Name' };
        const li = modal._renderListItem(option, 0, allData);

        expect(mockDomElementFactory.create).toHaveBeenCalledWith('li', {
          cls: 'llm-item',
          text: 'LLM Display Name',
        });
        expect(li.dataset.llmId).toBe('id1');
        expect(li.getAttribute('role')).toBe('radio');
        expect(li.getAttribute('aria-checked')).toBe('false'); // Not active
        expect(li.classList.contains('selected')).toBe(false);
        expect(li.addEventListener).toHaveBeenCalledWith(
          'click',
          expect.any(Function),
          undefined
        );
      });

      it('should mark as selected if configId matches currentActiveLlmId', () => {
        const option = { configId: 'activeId', displayName: 'Active LLM' };
        const li = modal._renderListItem(option, 0, allData);
        expect(li.classList.contains('selected')).toBe(true);
        expect(li.getAttribute('aria-checked')).toBe('true');
      });

      it('should use configId as text if displayName is missing', () => {
        const option = { configId: 'id-only', displayName: null };
        const li = modal._renderListItem(option, 0, allData);
        expect(li.textContent).toBe('id-only');
      });

      it('should log warning and return null if configId is missing', () => {
        const option = { displayName: 'No ID LLM' };
        const li = modal._renderListItem(option, 0, allData);
        expect(li).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('missing configId'),
          expect.any(Object)
        );
      });
    });

    describe('_getEmptyListMessage', () => {
      it('should return "No Language Models..." message element when not error', () => {
        const msgElement = modal._getEmptyListMessage(false);
        expect(mockDomElementFactory.create).toHaveBeenCalledWith('li', {
          text: 'No Language Models are currently configured.',
          cls: 'llm-item-message llm-empty-message',
        });
        expect(msgElement.textContent).toBe(
          'No Language Models are currently configured.'
        );
      });

      it('should return error message element when errorOccurred is true', () => {
        const msgElement = modal._getEmptyListMessage(true, 'Custom error');
        expect(mockDomElementFactory.create).toHaveBeenCalledWith('li', {
          text: 'Custom error',
          cls: 'llm-item-message llm-error-message',
        });
        expect(msgElement.textContent).toBe('Custom error');
      });
    });

    describe('_onListRendered', () => {
      it('should set tabindex="0" on selected item, or first item if none selected', () => {
        const item1 = mockDocument.createElement('li');
        item1.classList.add('llm-item');
        const item2 = mockDocument.createElement('li');
        item2.classList.add('llm-item', 'selected');
        const item3 = mockDocument.createElement('li');
        item3.classList.add('llm-item');
        llmListElement.append(item1, item2, item3);

        modal._onListRendered(
          { llmOptions: [], currentActiveLlmId: 'someId' },
          llmListElement
        );

        expect(item1.getAttribute('tabindex')).toBe('-1');
        expect(item2.getAttribute('tabindex')).toBe('0');
        expect(item3.getAttribute('tabindex')).toBe('-1');

        item2.classList.remove('selected');
        modal._onListRendered(
          { llmOptions: [], currentActiveLlmId: null },
          llmListElement
        );
        expect(item1.getAttribute('tabindex')).toBe('0'); // First item gets focus
      });
    });

    describe('renderLlmList', () => {
      it('should populate list when data is fetched successfully', async () => {
        const mockOpts = [{ configId: 'id1', displayName: 'Name1' }];
        mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue(mockOpts);
        mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue('id1');

        const renderListItemSpy = jest.spyOn(modal, '_renderListItem');
        const onListRenderedSpy = jest.spyOn(modal, '_onListRendered');

        await modal.renderLlmList();

        expect(llmListElement.innerHTML).not.toBe('');
        expect(renderListItemSpy).toHaveBeenCalledTimes(1);
        expect(onListRenderedSpy).toHaveBeenCalledTimes(1);
        expect(llmListElement.querySelector('li.llm-item').textContent).toBe(
          'Name1'
        );
      });

      it('should display empty message if no options are returned', async () => {
        mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue([]);
        mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);
        const getEmptySpy = jest.spyOn(modal, '_getEmptyListMessage');
        await modal.renderLlmList();
        expect(getEmptySpy).toHaveBeenCalledWith(false, expect.any(String));
        expect(
          llmListElement.querySelector('li.llm-empty-message')
        ).not.toBeNull();
      });

      it('should display error message if _getListItemsData returns null (error)', async () => {
        jest.spyOn(modal, '_getListItemsData').mockResolvedValue(null);
        const getEmptySpy = jest.spyOn(modal, '_getEmptyListMessage');
        await modal.renderLlmList();
        expect(getEmptySpy).toHaveBeenCalledWith(true, expect.any(String));
        expect(
          llmListElement.querySelector('li.llm-error-message')
        ).not.toBeNull();
      });

      it('should log error and display status message if listContainerElement is missing', async () => {
        modal.elements.listContainerElement = null; // Simulate missing element
        const displayStatusSpy = jest.spyOn(modal, '_displayStatusMessage');
        await modal.renderLlmList();
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            "Cannot render LLM list: 'listContainerElement' is not available."
          )
        );
        expect(displayStatusSpy).toHaveBeenCalledWith(
          'Internal error: LLM list container missing.',
          'error'
        );
      });
    });
  });

  describe('#handleLlmSelection', () => {
    let modal;
    let mockEvent;
    let mockClickedItem;

    beforeEach(async () => {
      modal = createInstance();
      // We need to call show() to ensure elements like listContainerElement are populated and BaseModal is "visible"
      // It will also call renderLlmList, so mock adapter calls
      mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue([
        { configId: 'llm1', displayName: 'LLM One' },
        { configId: 'llm2', displayName: 'LLM Two' },
      ]);
      mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue('llm1');
      modal.show(); // This is synchronous but kicks off async work via _onShow.

      // 1. Flush initial timers (e.g., for requestAnimationFrame in modal.show's implementation)
      jest.runAllTimers();

      // 2. Allow microtasks (promise .then/catch/finally) to run.
      //    This is crucial for the async chain: _onShow -> await renderLlmList -> await _getListItemsData.
      //    Using setImmediate (via jest.requireActual to get the real one) is robust with legacy timers.
      await new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
      );

      // 3. After microtasks, new macrotasks (timers) might have been scheduled by promise handlers.
      //    Flush timers again to be sure.
      jest.runAllTimers();

      // For debugging, if it still fails, uncomment the next two lines:
      // console.log('DEBUG: llmListElement.innerHTML:', llmListElement.innerHTML);
      // console.log('DEBUG: Active Element:', mockDocument.activeElement);

      mockClickedItem = llmListElement.querySelector('[data-llm-id="llm2"]');
      if (!mockClickedItem) {
        // If this fails, the list wasn't rendered correctly in the setup
        // You can add more detailed logging here if needed:
        // console.error("DEBUG llmListElement content:", llmListElement.innerHTML);
        // const data = await modal._getListItemsData(); // Check what data should have been rendered
        // console.error("DEBUG data for list:", data);
        throw new Error(
          'Test setup failed: llm item not found in list for #handleLlmSelection tests.'
        );
      }

      mockEvent = new mockWindow.MouseEvent('click');
      Object.defineProperty(mockEvent, 'currentTarget', {
        value: mockClickedItem,
        writable: false,
      });

      jest.spyOn(modal, 'hide');
      jest.spyOn(modal, '_displayStatusMessage');
      jest.spyOn(modal, '_setOperationInProgress');
    });

    it('should update selection, call setActiveLlm, and hide on success', async () => {
      mockLlmAdapter.setActiveLlm.mockResolvedValue(true);

      // Dispatch the click event on the item
      mockClickedItem.dispatchEvent(mockEvent);

      // Wait for the async operations within #handleLlmSelection to complete.
      // 1. Allow microtasks (promise .then/catch/finally) from setActiveLlm to run.
      //    Using setImmediate is robust for this with Jest's legacy timers.
      await new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
      );
      // 2. modal.hide() is called, which uses a setTimeout for animation. Flush these timers.
      //    Also, _setOperationInProgress(false) is called in a finally block.
      jest.runAllTimers();

      expect(mockLlmAdapter.setActiveLlm).toHaveBeenCalledWith('llm2');
      expect(modal._displayStatusMessage).toHaveBeenCalledWith(
        'Switching to LLM Two...',
        'info'
      );
      expect(modal._setOperationInProgress).toHaveBeenCalledWith(true); // Called before await
      expect(mockClickedItem.classList.contains('selected')).toBe(true);
      expect(mockClickedItem.getAttribute('tabindex')).toBe('0');
      // Note: focus is called before the async setActiveLlm call in the SUT.
      // Depending on exact timing and if focus itself is async or has side effects observed later,
      // this assertion might need care, but typically it's checked right after the action that causes it.
      expect(mockClickedItem.focus).toHaveBeenCalled();
      expect(modal.hide).toHaveBeenCalledTimes(1);
      expect(modal._setOperationInProgress).toHaveBeenLastCalledWith(false); // Called in finally
    });

    it('should display error and not hide on setActiveLlm failure (returns false)', async () => {
      mockLlmAdapter.setActiveLlm.mockResolvedValue(false);

      mockClickedItem.dispatchEvent(mockEvent);

      await new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
      );
      jest.runAllTimers();

      expect(modal.hide).not.toHaveBeenCalled();
      expect(modal._displayStatusMessage).toHaveBeenCalledWith(
        'Failed to switch to LLM Two. The LLM may be unavailable or the selection invalid.',
        'error'
      );
      expect(modal._setOperationInProgress).toHaveBeenLastCalledWith(false);
    });

    it('should display error and not hide on setActiveLlm exception', async () => {
      const error = new Error('Adapter boom');
      mockLlmAdapter.setActiveLlm.mockRejectedValue(error);

      mockClickedItem.dispatchEvent(mockEvent);

      await new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
      );
      jest.runAllTimers();

      expect(modal.hide).not.toHaveBeenCalled();
      expect(modal._displayStatusMessage).toHaveBeenCalledWith(
        `An error occurred while trying to switch to LLM Two: ${error.message}`,
        'error'
      );
      expect(modal._setOperationInProgress).toHaveBeenLastCalledWith(false);
    });

    it('should display error if clicked item has no llmId', async () => {
      delete mockClickedItem.dataset.llmId; // Sabotage the item

      mockClickedItem.dispatchEvent(mockEvent);

      // #handleLlmSelection should return early if no llmId, so less async waiting might be needed,
      // but being consistent with waiting won't hurt.
      await new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
      );
      jest.runAllTimers();

      expect(mockLlmAdapter.setActiveLlm).not.toHaveBeenCalled();
      expect(modal.hide).not.toHaveBeenCalled();
      expect(modal._displayStatusMessage).toHaveBeenCalledWith(
        'Internal error: LLM ID not found for selection.',
        'error'
      );
      // _setOperationInProgress(true) is called after the llmId check.
      // If it returns early, _setOperationInProgress(true) isn't called, nor is the finally block's _setOperationInProgress(false).
      // Let's re-check the SUT: if llmId is missing, it returns early BEFORE _setOperationInProgress(true).
      // So, _setOperationInProgress should not have been called with true, nor with false in a finally block that isn't reached.
      // The existing SUT's finally block will still call _setOperationInProgress(false).

      // SUT:
      // if (!selectedLlmId) { ... return; }
      // this._setOperationInProgress(true);
      // try { ... } finally { this._setOperationInProgress(false); }
      // So, if selectedLlmId is null, _setOperationInProgress(true) is NOT called.
      // The finally block also won't be entered from this path if it returns early.
      // This means _setOperationInProgress might not be called at all in this specific error path.

      // Let's adjust the expectation for _setOperationInProgress for this specific test case.
      // If the function returns early before the try...finally block that contains _setOperationInProgress(true/false):
      if (modal._setOperationInProgress.mock.calls.length > 0) {
        // If it was called, it means the early return didn't happen as expected, or the structure is different.
        // For now, let's assume it returns early and _setOperationInProgress is NOT called.
        // However, the SUT calls _setOperationInProgress(true) *after* the ID check.
        // And the finally block for _setOperationInProgress(false) is tied to the try after the `true` call.
        // If the early return for `!selectedLlmId` happens, `_setOperationInProgress` isn't called at all.
        expect(modal._setOperationInProgress).not.toHaveBeenCalled();
      } else {
        // This branch means it was never called, which is expected if it returned early.
        // So, no specific assertion needed other than it wasn't called with true or false.
        // The original test had: expect(modal._setOperationInProgress).not.toHaveBeenCalledWith(true);
        // This is good. Let's ensure it wasn't called at all if that's the SUT logic.
        // Given the SUT code, it *should not* be called.
        expect(modal._setOperationInProgress).not.toHaveBeenCalled();
      }
    });
  });

  describe('dispose', () => {
    it('should call super.dispose and log', () => {
      const modal = createInstance();
      const superDisposeSpy = jest.spyOn(
        Object.getPrototypeOf(LlmSelectionModal.prototype),
        'dispose'
      );
      modal.dispose();
      expect(superDisposeSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('LlmSelectionModal disposed.')
      );
    });
  });
});

// --- FILE END ---
