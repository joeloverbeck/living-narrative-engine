// tests/domUI/saveGameUI.test.js
// --- FILE START ---

import { JSDOM } from 'jsdom';
import { SaveGameUI, SaveGameService } from '../../../src/domUI';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import * as renderSlotItemModule from '../../../src/domUI/helpers/renderSlotItem.js';
import {
  formatSaveFileMetadata,
  formatEmptySlot,
} from '../../../src/domUI/helpers/slotDataFormatter.js';

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

const MAX_SAVE_SLOTS = 10;

describe('SaveGameUI', () => {
  let dom;
  let mockDocument;
  let mockWindow;

  let mockLogger;
  let mockDocumentContext;
  let mockDomElementFactory;
  let mockValidatedEventDispatcher;
  let mockSaveService;
  let mockUserPrompt;

  /** @type {jest.SpiedFunction<typeof renderSlotItemModule.renderGenericSlotItem>} */
  let renderSlotItemSpy;

  let mockSaveLoadService;
  let saveGameUI;

  let listContainerElement,
    saveNameInputEl,
    confirmSaveButtonEl,
    statusMessageElement;

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

    listContainerElement = mockDocument.getElementById('save-slots-container');
    saveNameInputEl = mockDocument.getElementById('save-name-input');
    confirmSaveButtonEl = mockDocument.getElementById('confirm-save-button');
    statusMessageElement = mockDocument.getElementById(
      'save-game-status-message'
    );

    mockDocumentContext = {
      query: jest.fn((selector, element) =>
        (element || mockDocument).querySelector(selector)
      ),
      create: jest.fn((tagName) => mockDocument.createElement(tagName)),
      document: mockDocument,
    };

    mockDomElementFactory = new DomElementFactory(mockDocumentContext);
    jest.spyOn(mockDomElementFactory, 'p');
    jest.spyOn(mockDomElementFactory, 'div');
    jest.spyOn(mockDomElementFactory, 'span');

    mockValidatedEventDispatcher = {
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      dispatch: jest.fn(),
    };

    mockSaveService = { save: jest.fn() };
    mockSaveLoadService = { listManualSaveSlots: jest.fn() };
    mockUserPrompt = { confirm: jest.fn(() => true) };
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
    renderSlotItemSpy = jest.spyOn(
      renderSlotItemModule,
      'renderGenericSlotItem'
    );

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

  /**
   *
   */
  async function awaitTick() {
    await Promise.resolve();
    jest.runAllTimers();
  }

  /**
   *
   * @param mockFn
   * @param callIndex
   */
  async function awaitMockCall(mockFn, callIndex = 0) {
    while (mockFn.mock.calls.length <= callIndex) {
      await awaitTick();
    }
    if (
      mockFn.mock.results[callIndex] &&
      mockFn.mock.results[callIndex].type === 'return'
    ) {
      if (
        mockFn.mock.results[callIndex].value &&
        typeof mockFn.mock.results[callIndex].value.then === 'function'
      ) {
        await mockFn.mock.results[callIndex].value;
      }
    }
    await awaitTick();
  }

  describe('_getSaveSlotsData', () => {
    it('should build slot metadata with helper', async () => {
      mockSaveLoadService.listManualSaveSlots.mockResolvedValueOnce([
        {
          identifier: 'id1',
          saveName: 'Slot One',
          timestamp: '2023-01-01T00:00:00Z',
          playtimeSeconds: 5,
          isCorrupted: false,
        },
      ]);

      const result = await saveGameUI._getSaveSlotsData();

      expect(result[0].slotItemMeta).toEqual(
        formatSaveFileMetadata({
          identifier: 'id1',
          saveName: 'Slot One',
          timestamp: '2023-01-01T00:00:00Z',
          playtimeSeconds: 5,
          isCorrupted: false,
        })
      );
      expect(result[1].slotItemMeta).toEqual(formatEmptySlot('Empty Slot 2'));
    });
  });

  describe('populateSlotsList integration', () => {
    it('should populate the save slots container with slot items', async () => {
      mockSaveLoadService.listManualSaveSlots.mockResolvedValueOnce([
        {
          identifier: 'id1',
          saveName: 'Slot One',
          timestamp: '2023-01-01T00:00:00Z',
          playtimeSeconds: 5,
          isEmpty: false,
          isCorrupted: false,
        },
        {
          identifier: 'id2',
          saveName: 'Slot Two',
          timestamp: '2023-01-02T00:00:00Z',
          playtimeSeconds: 10,
          isEmpty: false,
          isCorrupted: false,
        },
      ]);

      await saveGameUI._populateSaveSlotsList();
      await awaitMockCall(mockSaveLoadService.listManualSaveSlots, 0);

      expect(renderSlotItemSpy).toHaveBeenCalledTimes(MAX_SAVE_SLOTS);

      const slots = listContainerElement.querySelectorAll('.save-slot');
      expect(slots.length).toBe(10);
      expect(slots[0].textContent).toContain('Slot One');
      const tsText = slots[0].querySelector('.slot-timestamp')?.textContent;
      expect(tsText).toBe(
        `Saved: ${new Date('2023-01-01T00:00:00Z').toLocaleString()}`
      );
      expect(slots[1].dataset.slotId).toBe('1');
    });
  });

  describe('Save Operation and Slot Re-selection', () => {
    it('should correctly re-select the slot after a successful save to an empty slot', async () => {
      const saveName = 'My Awesome Game';
      const newSaveFilePath = 'saves/manual_saves/My_Awesome_Game.sav';
      const newSaveTimestamp = new Date().toISOString();
      const newPlaytime = 120;

      mockSaveLoadService.listManualSaveSlots.mockResolvedValueOnce([]);
      mockSaveLoadService.listManualSaveSlots.mockResolvedValueOnce([
        {
          identifier: newSaveFilePath,
          saveName: saveName,
          timestamp: newSaveTimestamp,
          playtimeSeconds: newPlaytime,
          isEmpty: false,
          isCorrupted: false,
        },
      ]);
      mockSaveService.save.mockResolvedValue({
        success: true,
        message: 'Game saved successfully!',
        filePath: newSaveFilePath,
      });

      saveGameUI.show();
      await awaitMockCall(mockSaveLoadService.listManualSaveSlots, 0);

      const firstSlotElement = listContainerElement.querySelector(
        '.save-slot[data-slot-id="0"]'
      );
      // --- JEST MATCHER FIX ---
      expect(firstSlotElement).not.toBeNull();
      // --- END FIX ---
      if (!firstSlotElement) {
        console.error(
          'Test Error: firstSlotElement is null after initial population. HTML:',
          listContainerElement.innerHTML
        );
        return; // Prevent further errors in this test run
      }

      expect(firstSlotElement.classList.contains('empty')).toBe(true);
      firstSlotElement.click();

      saveNameInputEl.value = saveName;
      saveNameInputEl.dispatchEvent(
        new global.InputEvent('input', { bubbles: true })
      );
      expect(confirmSaveButtonEl.disabled).toBe(false);

      confirmSaveButtonEl.click();

      await awaitMockCall(mockSaveService.save, 0);
      await awaitMockCall(mockSaveLoadService.listManualSaveSlots, 1);

      expect(mockSaveService.save).toHaveBeenCalledWith(0, saveName);
      expect(mockSaveLoadService.listManualSaveSlots).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Could not find metadata for newly saved slot')
      );
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining(
          'Save operation succeeded but did not return a valid filePath/identifier'
        )
      );

      expect(saveGameUI.selectedSlotData).toBeDefined();
      expect(saveGameUI.selectedSlotData.saveName).toBe(saveName);
      expect(saveGameUI.selectedSlotData.identifier).toBe(newSaveFilePath);
      expect(saveGameUI.selectedSlotData.isEmpty).toBe(false);
      expect(saveGameUI.selectedSlotData.slotId).toBe(0);

      const selectedSlotInDOM = listContainerElement.querySelector(
        '.save-slot.selected'
      );
      expect(selectedSlotInDOM).not.toBeNull();
      if (!selectedSlotInDOM) return;
      expect(selectedSlotInDOM.textContent).toContain(saveName);
      expect(selectedSlotInDOM.dataset.slotId).toBe('0');
      expect(selectedSlotInDOM.classList.contains('empty')).toBe(false);

      expect(saveNameInputEl.value).toBe(saveName);
      expect(statusMessageElement.textContent).toBe(
        `Game saved as "${saveName}".`
      );
      expect(
        statusMessageElement.classList.contains('status-message-success')
      ).toBe(true);
    });

    it('should log an error if save succeeds but filePath is missing in the result', async () => {
      const saveName = 'GameWithoutFilePath';
      mockSaveLoadService.listManualSaveSlots.mockResolvedValueOnce([]);
      mockSaveLoadService.listManualSaveSlots.mockResolvedValueOnce([]);
      mockSaveService.save.mockResolvedValue({
        success: true,
        message: 'Saved but no path!',
        filePath: undefined,
      });

      saveGameUI.show();
      await awaitMockCall(mockSaveLoadService.listManualSaveSlots, 0);

      const firstSlotElement = listContainerElement.querySelector(
        '.save-slot[data-slot-id="0"]'
      );
      // --- JEST MATCHER FIX ---
      expect(firstSlotElement).not.toBeNull();
      // --- END FIX ---
      if (!firstSlotElement) {
        console.error(
          'Test Error: firstSlotElement is null in filePath missing test. HTML:',
          listContainerElement.innerHTML
        );
        return; // Prevent further errors
      }

      firstSlotElement.click();
      saveNameInputEl.value = saveName;
      saveNameInputEl.dispatchEvent(
        new global.InputEvent('input', { bubbles: true })
      );
      confirmSaveButtonEl.click();

      await awaitMockCall(mockSaveService.save, 0);
      await awaitMockCall(mockSaveLoadService.listManualSaveSlots, 1);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'SaveGameService: Save operation succeeded but returned no filePath/identifier.'
        ),
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Could not find metadata for newly saved slot named "${saveName}" to re-select. Searched with ID: undefined`
        )
      );
    });
  });

  describe('_validateAndConfirmSave', () => {
    it('returns null and displays error when preconditions fail', () => {
      const statusSpy = jest.spyOn(saveGameUI, '_displayStatusMessage');
      const result = saveGameUI._validateAndConfirmSave();
      expect(result).toBeNull();
      expect(statusSpy).toHaveBeenCalledWith(
        'Cannot save: Internal error. Please select a slot and enter a name.',
        'error'
      );
    });

    it('returns trimmed name when validation and confirmation pass', () => {
      mockUserPrompt.confirm.mockReturnValue(true);
      saveGameUI.selectedSlotData = {
        slotId: 0,
        isEmpty: false,
        saveName: 'Old',
        isCorrupted: false,
      };
      saveNameInputEl.value = '  New Name  ';

      const result = saveGameUI._validateAndConfirmSave();

      expect(mockUserPrompt.confirm).toHaveBeenCalled();
      expect(result).toBe('New Name');
    });

    it('returns null if user cancels overwrite confirmation', () => {
      mockUserPrompt.confirm.mockReturnValue(false);
      saveGameUI.selectedSlotData = {
        slotId: 0,
        isEmpty: false,
        saveName: 'Old',
        isCorrupted: false,
      };
      saveNameInputEl.value = 'Cancel Me';

      const result = saveGameUI._validateAndConfirmSave();

      expect(mockUserPrompt.confirm).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('_executeAndFinalizeSave', () => {
    it('shows progress and finalizes a successful save', async () => {
      saveGameUI.selectedSlotData = {
        slotId: 0,
        isEmpty: true,
        isCorrupted: false,
      };
      mockSaveService.save.mockResolvedValue({
        success: true,
        message: 'ok',
        filePath: 'path',
      });
      mockSaveLoadService.listManualSaveSlots.mockResolvedValueOnce([]);

      const progressSpy = jest.spyOn(saveGameUI, '_setOperationInProgress');
      const statusSpy = jest.spyOn(saveGameUI, '_displayStatusMessage');

      await saveGameUI._executeAndFinalizeSave('TestSave');

      expect(progressSpy).toHaveBeenNthCalledWith(1, true);
      expect(statusSpy).toHaveBeenNthCalledWith(
        1,
        'Saving game as "TestSave"...',
        'info'
      );
      expect(mockSaveService.save).toHaveBeenCalledWith(0, 'TestSave');
      expect(progressSpy).toHaveBeenLastCalledWith(false);
      expect(statusSpy).toHaveBeenLastCalledWith(
        'Game saved as "TestSave".',
        'success'
      );
    });

    it('finalizes with error message on failed save', async () => {
      saveGameUI.selectedSlotData = {
        slotId: 1,
        isEmpty: true,
        isCorrupted: false,
      };
      mockSaveService.save.mockResolvedValue({
        success: false,
        error: 'oops',
      });

      const statusSpy = jest.spyOn(saveGameUI, '_displayStatusMessage');

      await saveGameUI._executeAndFinalizeSave('BadSave');

      expect(statusSpy).toHaveBeenLastCalledWith('Save failed: oops', 'error');
    });
  });
});
// --- FILE END ---
