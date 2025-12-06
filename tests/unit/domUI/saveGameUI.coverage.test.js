// tests/unit/domUI/saveGameUI.coverage.test.js

import { JSDOM } from 'jsdom';
import { SaveGameUI } from '../../../src/domUI';
import SaveGameService from '../../../src/domUI/saveGameService.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';

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

describe('SaveGameUI - Coverage Tests', () => {
  let dom;
  let mockDocument;
  let mockWindow;

  let mockLogger;
  let mockDocumentContext;
  let mockDomElementFactory;
  let mockValidatedEventDispatcher;
  let mockSaveService;
  let mockUserPrompt;
  let mockSaveLoadService;

  beforeEach(() => {
    const html = `
            <body>
                <div id="save-game-screen" class="modal-overlay" style="display: none;">
                    <div class="modal-content">
                        <h2>Save Game</h2>
                        <input type="text" id="save-name-input" />
                        <div id="save-slots-container"></div>
                        <div id="save-game-status-message" class="status-message-area"></div>
                        <button id="confirm-save-button">Save</button>
                        <button id="cancel-save-button">Cancel</button>
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
    global.Element = mockWindow.Element;
    global.Node = mockWindow.Node;
    global.Event = mockWindow.Event;
    global.CustomEvent = mockWindow.CustomEvent;
    global.MouseEvent = mockWindow.MouseEvent;
    global.KeyboardEvent = mockWindow.KeyboardEvent;
    global.InputEvent =
      mockWindow.InputEvent ||
      function (type, options) {
        const event = new mockWindow.Event(type, options);
        return event;
      };
    global.HTMLInputElement = mockWindow.HTMLInputElement;
    global.HTMLButtonElement = mockWindow.HTMLButtonElement;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDocumentContext = {
      query: jest.fn((selector, element) =>
        (element || mockDocument).querySelector(selector)
      ),
      create: jest.fn((tagName) => mockDocument.createElement(tagName)),
      document: mockDocument,
    };

    mockDomElementFactory = new DomElementFactory(mockDocumentContext);

    mockValidatedEventDispatcher = {
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      dispatch: jest.fn(),
    };

    mockSaveService = { save: jest.fn() };
    mockSaveLoadService = { listManualSaveSlots: jest.fn() };
    mockUserPrompt = { confirm: jest.fn(() => true) };

    jest.useFakeTimers();
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
    global.Node = undefined;
    global.Event = undefined;
    global.CustomEvent = undefined;
    global.MouseEvent = undefined;
    global.KeyboardEvent = undefined;
    global.InputEvent = undefined;
    global.HTMLInputElement = undefined;
    global.HTMLButtonElement = undefined;
  });

  describe('Constructor Error Handling', () => {
    it('should throw error when saveLoadService is null', () => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      expect(() => {
        new SaveGameUI({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          domElementFactory: mockDomElementFactory,
          saveLoadService: null, // Invalid
          validatedEventDispatcher: mockValidatedEventDispatcher,
          saveGameService,
        });
      }).toThrow(/ISaveLoadService dependency is missing or invalid/);
    });

    it('should throw error when saveLoadService lacks listManualSaveSlots method', () => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      expect(() => {
        new SaveGameUI({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          domElementFactory: mockDomElementFactory,
          saveLoadService: {}, // Missing required method
          validatedEventDispatcher: mockValidatedEventDispatcher,
          saveGameService,
        });
      }).toThrow(/ISaveLoadService dependency is missing or invalid/);
    });

    it('should throw error when saveGameService is null', () => {
      expect(() => {
        new SaveGameUI({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          domElementFactory: mockDomElementFactory,
          saveLoadService: mockSaveLoadService,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          saveGameService: null, // Invalid
        });
      }).toThrow(/SaveGameService dependency is missing or invalid/);
    });

    it('should throw error when saveGameService lacks required methods', () => {
      expect(() => {
        new SaveGameUI({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          domElementFactory: mockDomElementFactory,
          saveLoadService: mockSaveLoadService,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          saveGameService: {}, // Missing required methods
        });
      }).toThrow(/SaveGameService dependency is missing or invalid/);
    });
  });

  describe('init() Method Error Handling', () => {
    let saveGameUI;

    beforeEach(() => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      saveGameUI = new SaveGameUI({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        saveLoadService: mockSaveLoadService,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        saveGameService,
      });
    });

    it('should log error and return early when saveServiceInstance is null', () => {
      saveGameUI.init(null);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid ISaveService instance provided during init'
        )
      );
      expect(saveGameUI.saveService).toBeNull();
    });

    it('should log error and return early when saveServiceInstance is undefined', () => {
      saveGameUI.init(undefined);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid ISaveService instance provided during init'
        )
      );
      expect(saveGameUI.saveService).toBeNull();
    });

    it('should log error and return early when saveServiceInstance lacks save method', () => {
      saveGameUI.init({}); // Missing save method

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid ISaveService instance provided during init'
        )
      );
      expect(saveGameUI.saveService).toBeNull();
    });
  });

  describe('_getInitialFocusElement() Edge Cases', () => {
    let saveGameUI;

    beforeEach(() => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      saveGameUI = new SaveGameUI({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        saveLoadService: mockSaveLoadService,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        saveGameService,
      });
      saveGameUI.init(mockSaveService);
    });

    it('should return input element when it exists and is not disabled', () => {
      const saveNameInput = mockDocument.getElementById('save-name-input');
      saveNameInput.disabled = false;

      // Set up a selected slot that is not corrupted
      saveGameUI.selectedSlotData = { slotId: 0, isCorrupted: false };

      const focusElement = saveGameUI._getInitialFocusElement();

      expect(focusElement).toBe(saveNameInput);
    });

    it('should fallback to close button when no slots and input is disabled', () => {
      const saveNameInput = mockDocument.getElementById('save-name-input');
      saveNameInput.disabled = true;

      // Ensure no slots in container
      const container = mockDocument.getElementById('save-slots-container');
      container.innerHTML = '';

      const focusElement = saveGameUI._getInitialFocusElement();

      expect(focusElement).toBe(
        mockDocument.getElementById('cancel-save-button')
      );
    });
  });

  describe('_populateSaveSlotsList() Error Handling', () => {
    let saveGameUI;

    beforeEach(() => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      saveGameUI = new SaveGameUI({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        saveLoadService: mockSaveLoadService,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        saveGameService,
      });
      saveGameUI.init(mockSaveService);
    });

    it('should handle missing listContainerElement gracefully', async () => {
      // Mock missing container element
      saveGameUI.elements.listContainerElement = null;
      const statusSpy = jest.spyOn(saveGameUI, '_displayStatusMessage');

      await saveGameUI._populateSaveSlotsList();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('List container element not found')
      );
      expect(statusSpy).toHaveBeenCalledWith(
        'Error: UI component for slots missing.',
        'error'
      );
    });
  });

  describe('_handleSaveNameInput() Missing Elements', () => {
    let saveGameUI;

    beforeEach(() => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      saveGameUI = new SaveGameUI({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        saveLoadService: mockSaveLoadService,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        saveGameService,
      });
      saveGameUI.init(mockSaveService);
    });

    it('should return early when confirmSaveButtonEl is null', () => {
      saveGameUI.elements.confirmSaveButtonEl = null;

      // Should not throw error, just return early
      expect(() => {
        saveGameUI._handleSaveNameInput();
      }).not.toThrow();
    });

    it('should return early when saveNameInputEl is null', () => {
      saveGameUI.elements.saveNameInputEl = null;

      // Should not throw error, just return early
      expect(() => {
        saveGameUI._handleSaveNameInput();
      }).not.toThrow();
    });
  });

  describe('Slot Re-selection Edge Cases', () => {
    let saveGameUI;

    beforeEach(() => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      saveGameUI = new SaveGameUI({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        saveLoadService: mockSaveLoadService,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        saveGameService,
      });
      saveGameUI.init(mockSaveService);
    });

    it('should log warning when slot element not found during re-selection', async () => {
      // Set up save operation to trigger re-selection
      saveGameUI.selectedSlotData = {
        slotId: 0,
        isEmpty: true,
        isCorrupted: false,
      };

      // Mock save service to return success
      mockSaveService.save.mockResolvedValue({
        success: true,
        message: 'Saved successfully',
        filePath: 'test-id',
      });

      // Mock the listManualSaveSlots to return the saved data
      mockSaveLoadService.listManualSaveSlots
        .mockResolvedValueOnce([]) // Initial call
        .mockResolvedValueOnce([
          {
            // After save call
            slotId: 0,
            saveName: 'TestSave',
            identifier: 'test-id',
            isEmpty: false,
            isCorrupted: false,
          },
        ]);

      // Set up current slots data
      saveGameUI.currentSlotsDisplayData = [
        {
          slotId: 0,
          saveName: 'TestSave',
          identifier: 'test-id',
          isEmpty: false,
          isCorrupted: false,
        },
      ];

      // Container has no matching element (DOM element not found)
      const container = mockDocument.getElementById('save-slots-container');
      container.innerHTML = '';

      // Trigger save operation which will call re-selection internally
      await saveGameUI._executeAndFinalizeSave('TestSave');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not find metadata for newly saved slot named "TestSave" to re-select'
        )
      );
    });

    it('should warn when saved slot metadata exists but DOM element is missing', async () => {
      saveGameUI.selectedSlotData = {
        slotId: 1,
        isEmpty: true,
        isCorrupted: false,
      };

      jest.spyOn(saveGameUI.saveGameService, 'performSave').mockResolvedValue({
        success: true,
        message: 'Game saved as "TestSave".',
        returnedIdentifier: 'test-id',
      });

      jest
        .spyOn(saveGameUI, '_populateSaveSlotsList')
        .mockImplementation(async () => {
          saveGameUI.currentSlotsDisplayData = [
            {
              slotId: 1,
              saveName: 'TestSave',
              identifier: 'test-id',
              isEmpty: false,
              isCorrupted: false,
            },
          ];
        });

      const container = saveGameUI.elements.listContainerElement;
      expect(container).not.toBeNull();
      if (container) container.innerHTML = '';

      await saveGameUI._executeAndFinalizeSave('TestSave');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not find DOM element for newly saved slot ID 1 to re-select.'
        )
      );
    });
  });

  describe('Save Operation Finalization Edge Cases', () => {
    let saveGameUI;

    beforeEach(() => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      saveGameUI = new SaveGameUI({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        saveLoadService: mockSaveLoadService,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        saveGameService,
      });
      saveGameUI.init(mockSaveService);
    });

    it('should show default error message when success is false and no message provided', async () => {
      const statusSpy = jest.spyOn(saveGameUI, '_displayStatusMessage');
      const progressSpy = jest.spyOn(saveGameUI, '_setOperationInProgress');

      saveGameUI.selectedSlotData = {
        slotId: 0,
        isEmpty: true,
        isCorrupted: false,
      };

      // Mock save service to return failure with empty message
      mockSaveService.save.mockResolvedValue({
        success: false,
        error: '', // Empty error message
      });

      mockSaveLoadService.listManualSaveSlots.mockResolvedValue([]);

      // Trigger save operation which will call finalization internally
      await saveGameUI._executeAndFinalizeSave('TestSave');

      expect(progressSpy).toHaveBeenCalledWith(false);
      expect(statusSpy).toHaveBeenCalledWith(
        'Save failed: An unknown error occurred while saving.',
        'error'
      );
    });

    it('should not show any message when success is true and no message provided', async () => {
      const statusSpy = jest.spyOn(saveGameUI, '_displayStatusMessage');
      const progressSpy = jest.spyOn(saveGameUI, '_setOperationInProgress');

      saveGameUI.selectedSlotData = {
        slotId: 0,
        isEmpty: true,
        isCorrupted: false,
      };

      // Mock save service to return success with empty message
      mockSaveService.save.mockResolvedValue({
        success: true,
        message: '', // Empty message
        filePath: 'test-path',
      });

      mockSaveLoadService.listManualSaveSlots.mockResolvedValue([]);

      // Trigger save operation which will call finalization internally
      await saveGameUI._executeAndFinalizeSave('TestSave');

      expect(progressSpy).toHaveBeenCalledWith(false);
      // Should not display any status message for successful save with empty message
      expect(statusSpy).toHaveBeenCalledWith(
        'Saving game as "TestSave"...',
        'info'
      );
      // Verify no error or success message was shown for empty message
      expect(statusSpy).not.toHaveBeenCalledWith('', 'success');
      expect(statusSpy).not.toHaveBeenCalledWith('', 'error');
    });

    it('should show fallback error message when save fails without providing one', async () => {
      const statusSpy = jest.spyOn(saveGameUI, '_displayStatusMessage');
      const progressSpy = jest.spyOn(saveGameUI, '_setOperationInProgress');

      saveGameUI.selectedSlotData = {
        slotId: 0,
        isEmpty: true,
        isCorrupted: false,
      };

      jest.spyOn(saveGameUI.saveGameService, 'performSave').mockResolvedValue({
        success: false,
        message: '',
        returnedIdentifier: null,
      });

      jest.spyOn(saveGameUI, '_populateSaveSlotsList').mockResolvedValue();

      await saveGameUI._executeAndFinalizeSave('TestSave');

      expect(progressSpy).toHaveBeenCalledWith(false);
      expect(statusSpy).toHaveBeenCalledWith(
        'An unspecified error occurred during the save operation.',
        'error'
      );
    });
  });

  describe('Corrupted Slot Selection', () => {
    let saveGameUI;

    beforeEach(() => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      saveGameUI = new SaveGameUI({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        saveLoadService: mockSaveLoadService,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        saveGameService,
      });
      saveGameUI.init(mockSaveService);
    });

    it('should disable and clear input when corrupted slot is selected', () => {
      const saveNameInput = mockDocument.getElementById('save-name-input');
      const corruptedSlotData = {
        slotId: 0,
        isEmpty: false,
        isCorrupted: true,
        saveName: 'Corrupted Save',
      };

      const mockSlotElement = mockDocument.createElement('div');
      mockSlotElement.classList.add('save-slot');
      mockSlotElement.dataset.slotId = '0';

      saveGameUI._onItemSelected(mockSlotElement, corruptedSlotData);

      expect(saveNameInput.value).toBe('');
      expect(saveNameInput.disabled).toBe(true);
    });
  });

  describe('dispose() Method', () => {
    let saveGameUI;

    beforeEach(() => {
      const saveGameService = new SaveGameService({
        logger: mockLogger,
        userPrompt: mockUserPrompt,
      });

      saveGameUI = new SaveGameUI({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        saveLoadService: mockSaveLoadService,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        saveGameService,
      });
      saveGameUI.init(mockSaveService);
    });

    it('should clean up properties and call super.dispose()', () => {
      const superDisposeSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(saveGameUI)),
        'dispose'
      );

      // Set some test data
      saveGameUI.saveService = mockSaveService;
      saveGameUI.selectedSlotData = { slotId: 0 };
      saveGameUI.currentSlotsDisplayData = [{ slotId: 0 }];

      saveGameUI.dispose();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Disposing SaveGameUI')
      );
      expect(superDisposeSpy).toHaveBeenCalled();
      expect(saveGameUI.saveService).toBeNull();
      expect(saveGameUI.selectedSlotData).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('SaveGameUI disposed')
      );
    });
  });
});
