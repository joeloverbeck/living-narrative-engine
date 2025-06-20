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
import { SlotModalBase } from '../../../src/domUI/slotModalBase.js';
import * as renderSlotItemModule from '../../../src/domUI/helpers/renderSlotItem.js';
import * as createMessageElementModule from '../../../src/domUI/helpers/createMessageElement.js';

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
  renderSlotItem: jest.fn(),
}));

jest.mock('../../../src/domUI/helpers/createMessageElement.js', () => ({
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
  let mockGameEngine;
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
    mockGameEngine = {
      loadGame: jest.fn().mockResolvedValue({ success: true }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (mockWindow) mockWindow.close();
    global.window = undefined;
    global.document = undefined;
    global.HTMLElement = undefined;
    global.Element = undefined;
    global.requestAnimationFrame = undefined;
  });

  const createInstance = (depsOverrides = {}) => {
    const deps = {
      logger: mockLogger,
      documentContext: mockDocumentContext,
      domElementFactory: mockDomElementFactory,
      saveLoadService: mockSaveLoadService,
      validatedEventDispatcher: mockValidatedEventDispatcher,
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

    it('init() should log an error if gameEngine is invalid', () => {
      instance = createInstance();
      instance.init(null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid GameEngine instance provided during init.'
        )
      );
    });

    it('init() should log an error if gameEngine is missing loadGame method', () => {
      instance = createInstance();
      instance.init({}); // Missing loadGame
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid GameEngine instance provided during init.'
        )
      );
    });

    it('init() should log an error if core modal element is not bound', () => {
      jest.spyOn(mockDocumentContext, 'query').mockReturnValue(null);
      instance = createInstance();
      // Manually nullify the element post-construction for this test
      instance.elements.modalElement = null;
      instance.init(mockGameEngine);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Core Load Game UI elements not bound by BaseModalRenderer'
        )
      );
    });

    it('init() should attach event listeners on success', () => {
      instance = createInstance();
      const spy = jest.spyOn(instance, '_addDomListener');
      instance.init(mockGameEngine);
      expect(instance.gameEngine).toBe(mockGameEngine);
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

    it('form submit should prevent default', () => {
      instance = createInstance();
      instance.init(mockGameEngine);
      const event = new mockWindow.Event('submit', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
      modalElement.dispatchEvent(event);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('UI Lifecycle & Display', () => {
    beforeEach(() => {
      instance = createInstance();
      instance.init(mockGameEngine);
      // Spy on private/protected methods
      jest.spyOn(instance, '_populateLoadSlotsList').mockResolvedValue();
    });

    it('_onShow should disable buttons and trigger list population', () => {
      instance.show();
      expect(confirmLoadButton.disabled).toBe(true);
      expect(deleteSaveButton.disabled).toBe(true);
      expect(instance._populateLoadSlotsList).toHaveBeenCalled();
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

    it('_getEmptyLoadSlotsMessage should return a string if factory is missing', () => {
      instance.domElementFactory = null;
      const message = instance._getEmptyLoadSlotsMessage();
      expect(message).toBe('No saved games found.');
    });

    it('_getEmptyLoadSlotsMessage should return an element if factory is present', () => {
      const mockP = mockDocument.createElement('p');
      createMessageElementModule.default.mockReturnValue(mockP);
      const messageElement = instance._getEmptyLoadSlotsMessage();
      expect(messageElement).toBe(mockP);
      expect(createMessageElementModule.default).toHaveBeenCalledWith(
        mockDomElementFactory,
        'empty-slot-message',
        'No saved games found.'
      );
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
      renderSlotItemModule.renderSlotItem.mockReturnValue(mockDiv);
      instance = createInstance();

      const result = instance._renderLoadSlotItem(aGoodSlot, 0);

      expect(renderSlotItemModule.renderSlotItem).toHaveBeenCalledWith(
        mockDomElementFactory,
        'slotIdentifier',
        aGoodSlot.identifier,
        expect.any(Object),
        expect.any(Function)
      );
      expect(result).toBe(mockDiv);
      expect(result.getAttribute('tabindex')).toBe('0');
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
  });

  describe('User Interactions', () => {
    let confirmSpy;

    beforeEach(() => {
      instance = createInstance();
      instance.init(mockGameEngine);
      // Mock window.confirm using jest.spyOn for reliability
      confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      // Mock the base class's populateSlotsList to simplify testing interactions
      jest
        .spyOn(SlotModalBase.prototype, 'populateSlotsList')
        .mockImplementation(async (fetchDataFn) => {
          instance.currentSlotsDisplayData = (await fetchDataFn()) || [];
        });
    });

    afterEach(() => {
      // Restore the original implementation of window.confirm
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

    it('_handleLoad should show error if no slot is selected', async () => {
      instance.selectedSlotData = null;
      const spy = jest.spyOn(instance, '_displayStatusMessage');
      await instance._handleLoad();
      expect(spy).toHaveBeenCalledWith(
        'Please select a save slot to load.',
        'error'
      );
      expect(mockGameEngine.loadGame).not.toHaveBeenCalled();
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

    it('_handleLoad should show error if game engine is not ready', async () => {
      instance.selectedSlotData = aGoodSlot;
      instance.gameEngine = null;
      const spy = jest.spyOn(instance, '_displayStatusMessage');
      await instance._handleLoad();
      expect(spy).toHaveBeenCalledWith(
        'Cannot load: Game engine is not ready.',
        'error'
      );
    });

    it('_handleLoad should handle load failure from game engine', async () => {
      instance.selectedSlotData = aGoodSlot;
      mockGameEngine.loadGame.mockResolvedValue({
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
      mockGameEngine.loadGame.mockRejectedValue(error);
      const statusSpy = jest.spyOn(instance, '_displayStatusMessage');
      const progressSpy = jest.spyOn(instance, '_setOperationInProgress');
      await instance._handleLoad();
      expect(statusSpy).toHaveBeenCalledWith(
        'Load failed: Unexpected exception',
        'error'
      );
      expect(progressSpy).toHaveBeenLastCalledWith(false);
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
    it('should nullify gameEngine and clear data arrays', () => {
      instance = createInstance();
      instance.init(mockGameEngine);
      instance.selectedSlotData = {};
      instance.currentSlotsDisplayData = [{}];

      instance.dispose();

      expect(instance.gameEngine).toBeNull();
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
