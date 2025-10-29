/**
 * @file A test suite to properly cover LoadGameUI.
 * @see tests/domUI/loadGameUI.coverage.test.js
 */

import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import LoadGameUI from '../../../src/domUI/loadGameUI.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import * as listNavigationUtils from '../../../src/utils/listNavigationUtils.js';
import { DomUtils } from '../../../src/utils/domUtils.js';
import { SlotModalBase } from '../../../src/domUI/slotModalBase.js';
import * as renderSlotItemModule from '../../../src/domUI/helpers/renderSlotItem.js';
import * as createEmptySlotMessageModule from '../../../src/domUI/helpers/createEmptySlotMessage.js';

// Mock dependencies
jest.mock('../../../src/utils/domUtils.js', () => ({
  DomUtils: {
    clearElement: jest.fn(),
  },
}));

jest.mock('../../../src/utils/listNavigationUtils.js', () => ({
  setupRadioListNavigation: jest.fn(),
}));

jest.mock('../../../src/domUI/helpers/renderSlotItem.js', () => ({
  renderGenericSlotItem: jest.fn(),
}));

jest.mock('../../../src/domUI/helpers/createEmptySlotMessage.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('LoadGameUI', () => {
  let dom;
  let mockWindow;
  let mockDocument;
  let mockLogger;
  let mockDocumentContext;
  let mockDomElementFactory;
  let mockSaveLoadService;
  let mockValidatedEventDispatcher;
  let mockLoadService;
  let mockUserPrompt;
  let instance;

  // DOM Elements
  let modalElement,
    closeButton,
    listContainer,
    confirmLoadButton,
    deleteSaveButton,
    statusMessageElement;

  const aGoodSlot = {
    identifier: 'slot-1',
    saveName: 'Good Save',
    timestamp: new Date(2023, 10, 11).toISOString(),
    isCorrupted: false,
    playtimeSeconds: 120,
  };
  const anotherGoodSlot = {
    identifier: 'slot-2',
    saveName: 'Another Save',
    timestamp: new Date(2023, 10, 12).toISOString(),
    isCorrupted: false,
    playtimeSeconds: 300,
  };
  const aCorruptedSlot = {
    identifier: 'slot-bad',
    saveName: 'Corrupted File',
    isCorrupted: true,
  };

  beforeEach(() => {
    const html = `
      <div id="load-game-screen" style="display: none;">
        <button id="cancel-load-button"></button>
        <div id="load-slots-container"></div>
        <button id="confirm-load-button"></button>
        <button id="delete-save-button"></button>
        <div id="load-game-status-message"></div>
      </div>
    `;
    dom = new JSDOM(html);
    mockWindow = dom.window;
    mockDocument = mockWindow.document;

    // Setup globals that might be used by dependencies
    global.window = mockWindow;
    global.document = mockDocument;
    global.HTMLElement = mockWindow.HTMLElement;
    global.Element = mockWindow.Element;
    global.requestAnimationFrame = (cb) => cb();

    modalElement = mockDocument.getElementById('load-game-screen');
    closeButton = mockDocument.getElementById('cancel-load-button');
    listContainer = mockDocument.getElementById('load-slots-container');
    confirmLoadButton = mockDocument.getElementById('confirm-load-button');
    deleteSaveButton = mockDocument.getElementById('delete-save-button');
    statusMessageElement = mockDocument.getElementById(
      'load-game-status-message'
    );

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockDocumentContext = new DocumentContext(mockDocument);
    mockDomElementFactory = new DomElementFactory(mockDocumentContext);
    mockSaveLoadService = {
      listManualSaveSlots: jest.fn().mockResolvedValue([]),
      deleteManualSave: jest.fn().mockResolvedValue({ success: true }),
    };
    mockValidatedEventDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };
    mockLoadService = {
      load: jest.fn().mockResolvedValue({ success: true }),
    };
    mockUserPrompt = { confirm: jest.fn(() => true) };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Clean up global mocks
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;

    if (mockWindow) mockWindow.close();
    global.window = undefined;
    global.document = undefined;
    global.HTMLElement = undefined;
    global.Element = undefined;
  });

  const createInstance = (depsOverrides = {}) => {
    const deps = {
      logger: mockLogger,
      documentContext: mockDocumentContext,
      domElementFactory: mockDomElementFactory,
      saveLoadService: mockSaveLoadService,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      userPrompt: mockUserPrompt,
      ...depsOverrides,
    };
    return new LoadGameUI(deps);
  };

  describe('Constructor & Initialization', () => {
    it('should throw an error if saveLoadService is missing listManualSaveSlots', () => {
      const invalidService = { deleteManualSave: jest.fn() };
      expect(() => createInstance({ saveLoadService: invalidService })).toThrow(
        'ISaveLoadService dependency is missing or invalid (missing listManualSaveSlots or deleteManualSave).'
      );
    });

    it('should throw an error if saveLoadService is missing deleteManualSave', () => {
      const invalidService = { listManualSaveSlots: jest.fn() };
      expect(() => createInstance({ saveLoadService: invalidService })).toThrow(
        'ISaveLoadService dependency is missing or invalid (missing listManualSaveSlots or deleteManualSave).'
      );
    });

    it('should throw an error if userPrompt.confirm is not provided', () => {
      const invalidPrompt = { confirm: undefined };
      expect(() => createInstance({ userPrompt: invalidPrompt })).toThrow(
        'IUserPrompt dependency is missing or invalid.'
      );
    });

    it('init() should log an error if loadService is invalid', () => {
      instance = createInstance();
      instance.init(null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid ILoadService instance provided during init.'
        )
      );
    });

    it('init() should log an error if loadService is missing load method', () => {
      instance = createInstance();
      instance.init({}); // Missing loadGame
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid ILoadService instance provided during init.'
        )
      );
    });

    it('init() should log an error if core modal element is not bound', () => {
      jest.spyOn(mockDocumentContext, 'query').mockReturnValue(null);
      instance = createInstance();
      // Manually nullify the element post-construction for this test
      instance.elements.modalElement = null;
      instance.init(mockLoadService);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Core Load Game UI elements not bound by BaseModalRenderer'
        )
      );
    });

    it('init() should attach event listeners on success', () => {
      instance = createInstance();
      const spy = jest.spyOn(instance, '_addDomListener');
      instance.init(mockLoadService);
      expect(instance.loadService).toBe(mockLoadService);
      // Confirm load, delete, and submit listeners are added
      expect(spy).toHaveBeenCalledWith(
        confirmLoadButton,
        'click',
        expect.any(Function)
      );
      expect(spy).toHaveBeenCalledWith(
        deleteSaveButton,
        'click',
        expect.any(Function)
      );
      expect(spy).toHaveBeenCalledWith(
        modalElement,
        'submit',
        expect.any(Function)
      );
    });

    it('should skip delete listener when delete button is unavailable', () => {
      instance = createInstance();
      instance.elements.deleteSaveButtonEl = null;
      const spy = jest.spyOn(instance, '_addDomListener');

      instance._initEventListeners();

      const targets = spy.mock.calls.map((call) => call[0]);
      expect(targets).not.toContain(deleteSaveButton);
    });

    it('form submit should prevent default', () => {
      instance = createInstance();
      instance.init(mockLoadService);
      const event = new mockWindow.Event('submit', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
      modalElement.dispatchEvent(event);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('UI Lifecycle & Display', () => {
    beforeEach(() => {
      instance = createInstance();
      instance.init(mockLoadService);
      // Spy on private/protected methods
      jest.spyOn(instance, '_populateLoadSlotsList').mockResolvedValue();
    });

    it('_onShow should disable buttons and trigger list population', () => {
      instance.show();
      expect(confirmLoadButton.disabled).toBe(true);
      expect(deleteSaveButton.disabled).toBe(true);
      expect(instance._populateLoadSlotsList).toHaveBeenCalled();
    });

    it('_onShow should handle missing action buttons gracefully', async () => {
      instance.elements.confirmLoadButtonEl = null;
      instance.elements.deleteSaveButtonEl = null;
      instance._populateLoadSlotsList.mockRestore();
      const populateSpy = jest
        .spyOn(instance, '_populateLoadSlotsList')
        .mockResolvedValue();

      await instance._onShow();

      expect(populateSpy).toHaveBeenCalled();
    });

    it('_getInitialFocusElement should return first good slot', () => {
      const goodSlotEl = mockDocument.createElement('div');
      goodSlotEl.className = 'save-slot';
      goodSlotEl.dataset.corrupted = 'false';
      const corruptedSlotEl = mockDocument.createElement('div');
      corruptedSlotEl.className = 'save-slot corrupted';
      listContainer.appendChild(corruptedSlotEl);
      listContainer.appendChild(goodSlotEl);
      instance.elements.listContainerElement = listContainer;

      const focusEl = instance._getInitialFocusElement();
      expect(focusEl).toBe(goodSlotEl);
    });

    it('_getInitialFocusElement should fallback to close button', () => {
      instance.elements.listContainerElement = listContainer; // Empty
      const focusEl = instance._getInitialFocusElement();
      expect(focusEl).toBe(closeButton);
    });

    it('_getInitialFocusElement should fallback to modal when close button missing', () => {
      instance.elements.listContainerElement = null;
      instance.elements.closeButton = null;
      const focusEl = instance._getInitialFocusElement();
      expect(focusEl).toBe(instance.elements.modalElement);
    });

    it('_getEmptyLoadSlotsMessage should return a string if factory is missing', () => {
      instance.domElementFactory = null;
      createEmptySlotMessageModule.default.mockImplementation((_f, msg) => msg);
      const message = instance._getEmptyLoadSlotsMessage();
      expect(message).toBe('No saved games found.');
      expect(createEmptySlotMessageModule.default).toHaveBeenCalledWith(
        null,
        'No saved games found.'
      );
    });

    it('_getEmptyLoadSlotsMessage should return an element if factory is present', () => {
      const mockEl = mockDocument.createElement('p');
      createEmptySlotMessageModule.default.mockReturnValue(mockEl);
      const messageElement = instance._getEmptyLoadSlotsMessage();
      expect(messageElement).toBe(mockEl);
      expect(createEmptySlotMessageModule.default).toHaveBeenCalledWith(
        mockDomElementFactory,
        'No saved games found.'
      );
    });

    it('_onHide should clear list container and reset internal state', () => {
      const clearSpy = jest.spyOn(instance, 'clearSlotData');
      instance.elements.listContainerElement = listContainer;
      instance.selectedSlotData = { ...aGoodSlot };
      instance._lastStatusMessage = { message: 'keep me', type: 'info' };

      instance._onHide();

      expect(DomUtils.clearElement).toHaveBeenCalledWith(listContainer);
      expect(clearSpy).toHaveBeenCalled();
      expect(instance.selectedSlotData).toBeNull();
      expect(instance._lastStatusMessage).toBeNull();
    });

    it('_onHide should skip clearing when list container is missing', () => {
      const clearSpy = jest.spyOn(instance, 'clearSlotData');
      instance.elements.listContainerElement = null;

      instance._onHide();

      expect(DomUtils.clearElement).not.toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('Status message handling', () => {
    beforeEach(() => {
      instance = createInstance();
    });

    it('should avoid re-rendering loading message when already shown', () => {
      const superSpy = jest.spyOn(
        SlotModalBase.prototype,
        '_displayStatusMessage'
      );
      instance._lastStatusMessage = { message: 'Existing', type: 'info' };

      instance._displayStatusMessage('Loading saved games...', 'info');

      expect(superSpy).not.toHaveBeenCalled();
      expect(instance._lastStatusMessage).toEqual({
        message: 'Existing',
        type: 'info',
      });
      superSpy.mockRestore();
    });

    it('should default status type to info when omitted', () => {
      const superSpy = jest.spyOn(
        SlotModalBase.prototype,
        '_displayStatusMessage'
      );

      instance._displayStatusMessage('Hello world');

      expect(superSpy).toHaveBeenCalledWith('Hello world', 'info');
      superSpy.mockRestore();
    });

    it('should forward loading message when no previous status exists', () => {
      const superSpy = jest.spyOn(
        SlotModalBase.prototype,
        '_displayStatusMessage'
      );

      instance._displayStatusMessage('Loading saved games...');

      expect(superSpy).toHaveBeenCalledWith('Loading saved games...', 'info');
      expect(instance._lastStatusMessage).toBeNull();
      superSpy.mockRestore();
    });

    it('should keep last status message while slots populate', () => {
      const superSpy = jest.spyOn(
        SlotModalBase.prototype,
        '_clearStatusMessage'
      );
      instance._isPopulatingSlots = true;
      instance._lastStatusMessage = { message: 'Hold', type: 'warning' };

      instance._clearStatusMessage();

      expect(superSpy).not.toHaveBeenCalled();
      expect(instance._lastStatusMessage).toEqual({
        message: 'Hold',
        type: 'warning',
      });
      superSpy.mockRestore();
    });

    it('should clear stored status when not populating', () => {
      const superSpy = jest.spyOn(
        SlotModalBase.prototype,
        '_clearStatusMessage'
      );
      instance._isPopulatingSlots = false;
      instance._lastStatusMessage = { message: 'Temp', type: 'info' };

      instance._clearStatusMessage();

      expect(superSpy).toHaveBeenCalled();
      expect(instance._lastStatusMessage).toBeNull();
      superSpy.mockRestore();
    });

    it('should call super clear when populating without status', () => {
      const superSpy = jest.spyOn(
        SlotModalBase.prototype,
        '_clearStatusMessage'
      );
      instance._isPopulatingSlots = true;
      instance._lastStatusMessage = null;

      instance._clearStatusMessage();

      expect(superSpy).toHaveBeenCalled();
      expect(instance._lastStatusMessage).toBeNull();
      superSpy.mockRestore();
    });
  });

  describe('Data Handling and Rendering', () => {
    it('_getLoadSlotsData should sort saves by timestamp (desc) and corrupted last', async () => {
      mockSaveLoadService.listManualSaveSlots.mockResolvedValue([
        aCorruptedSlot,
        aGoodSlot,
        anotherGoodSlot, // Newest
      ]);
      instance = createInstance();
      const slots = await instance._getLoadSlotsData();
      expect(slots.map((s) => s.identifier)).toEqual([
        'slot-2',
        'slot-1',
        'slot-bad',
      ]);
    });

    it('_getLoadSlotsData should handle service error gracefully', async () => {
      const error = new Error('Service failed');
      mockSaveLoadService.listManualSaveSlots.mockRejectedValue(error);
      instance = createInstance();
      const spy = jest.spyOn(instance, '_displayStatusMessage');

      const slots = await instance._getLoadSlotsData();

      expect(slots).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error fetching or processing save slots data:'
        ),
        error
      );
      expect(spy).toHaveBeenCalledWith(
        'Error loading list of saved games.',
        'error'
      );
    });

    it('_renderLoadSlotItem should log error and return null if domElementFactory is missing', () => {
      instance = createInstance();
      instance.domElementFactory = null;
      const result = instance._renderLoadSlotItem({}, 0);
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('DomElementFactory not available')
      );
    });

    it('_renderLoadSlotItem should call renderSlotItem helper with correct params', () => {
      const mockDiv = mockDocument.createElement('div');
      mockDiv.setAttribute('tabindex', '0');
      renderSlotItemModule.renderGenericSlotItem.mockReturnValue(mockDiv);
      instance = createInstance();

      const result = instance._renderLoadSlotItem(aGoodSlot, 0);

      expect(renderSlotItemModule.renderGenericSlotItem).toHaveBeenCalledWith(
        mockDomElementFactory,
        'slotIdentifier',
        aGoodSlot.identifier,
        expect.any(Object),
        0,
        expect.any(Function)
      );
      expect(result).toBe(mockDiv);
      expect(result.getAttribute('tabindex')).toBe('0');
    });

    it('rendered slot items should delegate selection to _onItemSelected', () => {
      const mockDiv = mockDocument.createElement('div');
      renderSlotItemModule.renderGenericSlotItem.mockReturnValue(mockDiv);
      instance = createInstance();
      const selectionSpy = jest
        .spyOn(instance, '_onItemSelected')
        .mockImplementation(() => {});

      instance._renderLoadSlotItem(aGoodSlot, 1);
      const handler =
        renderSlotItemModule.renderGenericSlotItem.mock.calls[0][5];
      handler({ currentTarget: mockDiv });

      expect(selectionSpy).toHaveBeenCalledWith(mockDiv, aGoodSlot);
    });

    it('_populateLoadSlotsList should log error if container is missing', async () => {
      instance = createInstance();
      const spy = jest.spyOn(instance, '_displayStatusMessage');
      instance.elements.listContainerElement = null; // Simulate missing element
      await instance._populateLoadSlotsList();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('List container element not found')
      );
      expect(spy).toHaveBeenCalledWith(
        'Error: UI component for slots missing.',
        'error'
      );
    });

    it('_populateLoadSlotsList should wire fetch, render, and status restoration', async () => {
      instance = createInstance();
      instance.init(mockLoadService);
      const data = [{ ...aGoodSlot }];
      instance.selectedSlotData = data[0];
      instance._lastStatusMessage = { message: 'Keep', type: 'info' };

      const getDataSpy = jest
        .spyOn(instance, '_getLoadSlotsData')
        .mockResolvedValue(data);
      const renderSpy = jest
        .spyOn(instance, '_renderLoadSlotItem')
        .mockReturnValue(mockDocument.createElement('li'));
      const emptySpy = jest
        .spyOn(instance, '_getEmptyLoadSlotsMessage')
        .mockReturnValue('empty');
      const updateSpy = jest
        .spyOn(instance, '_updateButtonStates')
        .mockImplementation(() => {});
      const statusSpy = jest.spyOn(instance, '_displayStatusMessage');

      jest
        .spyOn(instance, 'populateSlotsList')
        .mockImplementation(async (fetchFn, renderFn, emptyFn, loadingMsg) => {
          expect(loadingMsg).toBe('Loading saved games...');
          const slots = await fetchFn();
          slots.forEach((slot, index) => renderFn(slot, index));
          emptyFn();
        });

      await instance._populateLoadSlotsList();

      expect(getDataSpy).toHaveBeenCalled();
      expect(renderSpy).toHaveBeenCalledWith(data[0], 0);
      expect(emptySpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(data[0]);
      expect(statusSpy).toHaveBeenCalledWith('Keep', 'info');
      expect(instance._isPopulatingSlots).toBe(false);
    });

    it('_populateLoadSlotsList should skip status restoration when none exists', async () => {
      instance = createInstance();
      instance.init(mockLoadService);
      instance.selectedSlotData = null;
      instance._lastStatusMessage = null;

      const statusSpy = jest.spyOn(instance, '_displayStatusMessage');
      jest
        .spyOn(instance, 'populateSlotsList')
        .mockImplementation(async (fetchFn) => {
          await fetchFn();
        });

      await instance._populateLoadSlotsList();

      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    let confirmSpy;

    beforeEach(() => {
      instance = createInstance();
      instance.init(mockLoadService);
      confirmSpy = jest.spyOn(mockUserPrompt, 'confirm').mockReturnValue(true);

      // Mock the base class's populateSlotsList to simplify testing interactions
      jest
        .spyOn(SlotModalBase.prototype, 'populateSlotsList')
        .mockImplementation(async (fetchDataFn) => {
          instance.currentSlotsDisplayData = (await fetchDataFn()) || [];
        });
    });

    afterEach(() => {
      confirmSpy.mockRestore();
    });

    it('_onItemSelected should disable load button for corrupted slot', () => {
      instance._onItemSelected(
        mockDocument.createElement('div'),
        aCorruptedSlot
      );
      expect(confirmLoadButton.disabled).toBe(true);
      expect(deleteSaveButton.disabled).toBe(false);
    });

    it('_onItemSelected should tolerate missing confirm button element', () => {
      instance.elements.confirmLoadButtonEl = null;
      const slotElement = mockDocument.createElement('div');

      instance._onItemSelected(slotElement, aGoodSlot);

      expect(deleteSaveButton.disabled).toBe(false);
    });

    it('_onItemSelected should tolerate missing delete button element', () => {
      instance.elements.deleteSaveButtonEl = null;
      const slotElement = mockDocument.createElement('div');

      instance._onItemSelected(slotElement, aGoodSlot);

      expect(confirmLoadButton.disabled).toBe(false);
    });

    it('_handleLoad should show error if no slot is selected', async () => {
      instance.selectedSlotData = null;
      const spy = jest.spyOn(instance, '_displayStatusMessage');
      await instance._handleLoad();
      expect(spy).toHaveBeenCalledWith(
        'Please select a save slot to load.',
        'error'
      );
      expect(mockLoadService.load).not.toHaveBeenCalled();
    });

    it('_handleLoad should show error if slot is corrupted', async () => {
      instance.selectedSlotData = aCorruptedSlot;
      const spy = jest.spyOn(instance, '_displayStatusMessage');
      await instance._handleLoad();
      expect(spy).toHaveBeenCalledWith(
        'Cannot load a corrupted save file. Please delete it or choose another.',
        'error'
      );
    });

    it('_handleLoad should show error if load service is not ready', async () => {
      instance.selectedSlotData = aGoodSlot;
      instance.loadService = null;
      const spy = jest.spyOn(instance, '_displayStatusMessage');
      await instance._handleLoad();
      expect(spy).toHaveBeenCalledWith(
        'Cannot load: Game engine is not ready.',
        'error'
      );
    });

    it('_handleLoad should handle load failure from game engine', async () => {
      instance.selectedSlotData = aGoodSlot;
      mockLoadService.load.mockResolvedValue({
        success: false,
        error: 'Engine failed',
      });
      const statusSpy = jest.spyOn(instance, '_displayStatusMessage');
      const progressSpy = jest.spyOn(instance, '_setOperationInProgress');
      await instance._handleLoad();
      expect(statusSpy).toHaveBeenCalledWith(
        'Load failed: Engine failed',
        'error'
      );
      expect(progressSpy).toHaveBeenLastCalledWith(false);
    });

    it('_handleLoad should handle exception during load', async () => {
      instance.selectedSlotData = aGoodSlot;
      const error = new Error('Unexpected exception');
      mockLoadService.load.mockRejectedValue(error);
      const statusSpy = jest.spyOn(instance, '_displayStatusMessage');
      const progressSpy = jest.spyOn(instance, '_setOperationInProgress');
      await instance._handleLoad();
      expect(statusSpy).toHaveBeenCalledWith(
        'Load failed: Unexpected exception',
        'error'
      );
      expect(progressSpy).toHaveBeenLastCalledWith(false);
    });

    it('_performLoad should report a successful load', async () => {
      const result = await instance._performLoad(aGoodSlot);
      expect(result).toEqual({ success: true, message: '' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Game loaded successfully from slot-1')
      );
    });

    it('_performLoad should use fallback error message when none provided', async () => {
      mockLoadService.load.mockResolvedValue({ success: false });

      const result = await instance._performLoad(aGoodSlot);

      expect(result).toEqual({
        success: false,
        message: 'An unknown error occurred while loading the game.',
      });
    });

    it('_performLoad should stringify non-error exceptions', async () => {
      mockLoadService.load.mockRejectedValue('boom');

      const result = await instance._performLoad(aGoodSlot);

      expect(result).toEqual({ success: false, message: 'boom' });
    });

    it('_finalizeLoad should hide modal after success', () => {
      jest.useFakeTimers();
      const hideSpy = jest.spyOn(instance, 'hide').mockImplementation(() => {});
      const statusSpy = jest.spyOn(instance, '_displayStatusMessage');

      instance._finalizeLoad(true, '', aGoodSlot);

      expect(statusSpy).toHaveBeenCalledWith(
        'Game "Good Save" loaded successfully. Resuming...',
        'success'
      );
      jest.runAllTimers();
      expect(hideSpy).toHaveBeenCalled();
    });

    it('_handleDelete should show error if no slot is selected', async () => {
      instance.selectedSlotData = null;
      const spy = jest.spyOn(instance, '_displayStatusMessage');
      await instance._handleDelete();
      expect(spy).toHaveBeenCalledWith(
        'Please select a save slot to delete.',
        'error'
      );
    });

    it('_handleDelete should return if user cancels confirmation', async () => {
      confirmSpy.mockReturnValue(false);
      instance.selectedSlotData = aGoodSlot;
      await instance._handleDelete();
      expect(mockSaveLoadService.deleteManualSave).not.toHaveBeenCalled();
    });

    it('_handleDelete should handle service failure', async () => {
      instance.selectedSlotData = aGoodSlot;
      mockSaveLoadService.deleteManualSave.mockResolvedValue({
        success: false,
        error: 'Deletion failed',
      });
      const statusSpy = jest.spyOn(instance, '_displayStatusMessage');
      await instance._handleDelete();
      expect(statusSpy).toHaveBeenCalledWith(
        'Delete failed: Deletion failed',
        'error'
      );
    });

    it('_handleDelete should handle service exception', async () => {
      instance.selectedSlotData = aGoodSlot;
      const error = new Error('Service exception');
      mockSaveLoadService.deleteManualSave.mockRejectedValue(error);
      const statusSpy = jest.spyOn(instance, '_displayStatusMessage');
      await instance._handleDelete();
      expect(statusSpy).toHaveBeenCalledWith(
        'Delete failed: Service exception',
        'error'
      );
    });

    it('_performDelete should prefer message property when available', async () => {
      mockSaveLoadService.deleteManualSave.mockResolvedValue({
        success: false,
        message: 'Custom failure',
      });

      const result = await instance._performDelete(aGoodSlot);

      expect(result).toEqual({ success: false, message: 'Custom failure' });
    });

    it('_performDelete should fall back to default message', async () => {
      mockSaveLoadService.deleteManualSave.mockResolvedValue({ success: false });

      const result = await instance._performDelete(aGoodSlot);

      expect(result).toEqual({
        success: false,
        message: 'An unknown error occurred while deleting the save.',
      });
    });

    it('_performDelete should stringify non-error exceptions', async () => {
      mockSaveLoadService.deleteManualSave.mockRejectedValue('explode');

      const result = await instance._performDelete(aGoodSlot);

      expect(result).toEqual({ success: false, message: 'explode' });
    });

    it('_handleDelete should refocus correctly after deletion', async () => {
      instance.selectedSlotData = aGoodSlot;

      // Mock list population to simulate a new list appearing
      const populateSpy = jest
        .spyOn(instance, '_populateLoadSlotsList')
        .mockImplementation(async () => {
          const newItem = mockDocument.createElement('div');
          newItem.className = 'save-slot';
          newItem.dataset.slotIdentifier = 'new-item';
          newItem.focus = jest.fn(); // Mock focus
          listContainer.innerHTML = ''; // Clear previous items before appending
          listContainer.appendChild(newItem);
          instance.currentSlotsDisplayData = [
            { identifier: 'new-item', isCorrupted: false },
          ];
        });

      await instance._handleDelete();

      expect(populateSpy).toHaveBeenCalled();
      const newFirstSlot = listContainer.querySelector('.save-slot');
      expect(newFirstSlot.focus).toHaveBeenCalled();
      expect(deleteSaveButton.disabled).toBe(false); // Should be re-enabled for new item
    });

    it('_refreshAfterDelete should clear selection when no slot data matches', async () => {
      const onItemSelectedSpy = jest
        .spyOn(instance, '_onItemSelected')
        .mockImplementation(() => {});
      const statusSpy = jest.spyOn(instance, '_displayStatusMessage');
      const opSpy = jest.spyOn(instance, '_setOperationInProgress');
      const populateSpy = jest
        .spyOn(instance, '_populateLoadSlotsList')
        .mockResolvedValue();

      const slotElement = mockDocument.createElement('div');
      slotElement.className = 'save-slot';
      slotElement.dataset.slotIdentifier = 'unknown';
      slotElement.focus = jest.fn();
      listContainer.appendChild(slotElement);
      instance.currentSlotsDisplayData = [];

      await instance._refreshAfterDelete({ success: true, message: '' }, aGoodSlot);

      expect(populateSpy).toHaveBeenCalled();
      expect(slotElement.focus).toHaveBeenCalled();
      expect(onItemSelectedSpy).toHaveBeenCalledWith(null, null);
      expect(statusSpy).toHaveBeenCalledWith(
        'Save "Good Save" deleted successfully.',
        'success'
      );
      expect(opSpy).toHaveBeenCalledWith(false);
    });

    it('_refreshAfterDelete should clear selection when no slots remain', async () => {
      const onItemSelectedSpy = jest
        .spyOn(instance, '_onItemSelected')
        .mockImplementation(() => {});
      const populateSpy = jest
        .spyOn(instance, '_populateLoadSlotsList')
        .mockResolvedValue();

      listContainer.innerHTML = '';
      instance.currentSlotsDisplayData = [];

      await instance._refreshAfterDelete({ success: true, message: '' }, aGoodSlot);

      expect(populateSpy).toHaveBeenCalled();
      expect(onItemSelectedSpy).toHaveBeenCalledWith(null, null);
    });

    // Note: Testing _handleSlotNavigation is complex as it relies on a returned function.
    // We can test that the setup function is called.
    it('_handleSlotNavigation setup should be called', () => {
      // This test is somewhat conceptual as the handler is created and used internally.
      // We can trigger a keydown to see if setupRadioListNavigation would be triggered.
      const mockHandler = jest.fn();
      listNavigationUtils.setupRadioListNavigation.mockReturnValue(mockHandler);

      instance = createInstance();
      const slot = mockDocument.createElement('div');
      slot.className = 'save-slot';
      slot.setAttribute('role', 'radio');
      listContainer.appendChild(slot);
      slot.focus();

      // We cannot directly test the private method, so we check the dependency was called
      // in a scenario where it *would* be used. A better test would refactor the handler
      // creation to be more accessible if needed.
      SlotModalBase.prototype._handleSlotNavigation.call(
        instance,
        new mockWindow.KeyboardEvent('keydown', { key: 'ArrowDown' })
      );
      expect(listNavigationUtils.setupRadioListNavigation).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('dispose()', () => {
    it('should nullify loadService and clear data arrays', () => {
      instance = createInstance();
      instance.init(mockLoadService);
      instance.selectedSlotData = {};
      instance.currentSlotsDisplayData = [{}];

      instance.dispose();

      expect(instance.loadService).toBeNull();
      expect(instance.selectedSlotData).toBeNull();
      expect(instance.currentSlotsDisplayData).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[LoadGameUI] LoadGameUI disposed.'
      );
    });

    it('should call super.dispose()', () => {
      const superDisposeSpy = jest.spyOn(SlotModalBase.prototype, 'dispose');
      instance = createInstance();
      instance.dispose();
      expect(superDisposeSpy).toHaveBeenCalled();
    });
  });
});
