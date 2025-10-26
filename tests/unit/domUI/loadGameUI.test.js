import { JSDOM } from 'jsdom';
import { LoadGameUI } from '../../../src/domUI';
import { SlotModalBase } from '../../../src/domUI/slotModalBase.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import * as renderSlotItemModule from '../../../src/domUI/helpers/renderSlotItem.js';
import { formatSaveFileMetadata } from '../../../src/domUI/helpers/slotDataFormatter.js';
import {
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';

// Helper to create DOM and dependencies
let dom;
let document;
let window;
let mockLogger;
let mockDocumentContext;
let domElementFactory;
let mockVED;
let mockSaveLoadService;
let mockUserPrompt;
let loadGameUI;
/** @type {jest.SpiedFunction<typeof renderSlotItemModule.renderGenericSlotItem>} */
let renderSlotItemSpy;

beforeEach(() => {
  const html = `<!DOCTYPE html><html><body>
    <div id="load-game-screen" style="display:none;">
      <div id="load-slots-container"></div>
      <div id="load-game-status-message"></div>
      <button id="confirm-load-button"></button>
      <button id="delete-save-button"></button>
      <button id="cancel-load-button"></button>
    </div>
  </body></html>`;
  dom = new JSDOM(html, { runScripts: 'dangerously' });
  window = dom.window;
  document = dom.window.document;
  global.window = window;
  global.document = document;
  global.HTMLElement = window.HTMLElement;
  global.HTMLButtonElement = window.HTMLButtonElement;

  mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };
  mockDocumentContext = {
    query: (selector, el) => (el || document).querySelector(selector),
    create: (tag) => document.createElement(tag),
    document,
  };
  domElementFactory = new DomElementFactory(mockDocumentContext);
  mockVED = {
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    dispatch: jest.fn(),
  };
  mockSaveLoadService = {
    listManualSaveSlots: jest.fn(),
    deleteManualSave: jest.fn(),
  };
  mockUserPrompt = { confirm: jest.fn(() => true) };

  loadGameUI = new LoadGameUI({
    logger: mockLogger,
    documentContext: mockDocumentContext,
    domElementFactory,
    saveLoadService: mockSaveLoadService,
    validatedEventDispatcher: mockVED,
    userPrompt: mockUserPrompt,
  });
  renderSlotItemSpy = jest.spyOn(renderSlotItemModule, 'renderGenericSlotItem');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  if (window) window.close();
  global.window = undefined;
  global.document = undefined;
});

describe('LoadGameUI basic behaviors', () => {
  it('throws when the userPrompt dependency is missing confirm()', () => {
    expect(
      () =>
        new LoadGameUI({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          domElementFactory,
          saveLoadService: mockSaveLoadService,
          validatedEventDispatcher: mockVED,
          userPrompt: {},
        })
    ).toThrow('IUserPrompt dependency is missing or invalid.');
  });

  it('should sort slots and store the result', async () => {
    const saves = [
      {
        identifier: 'a',
        saveName: 'A',
        timestamp: '2023-07-01T00:00:00Z',
        playtimeSeconds: 10,
        isCorrupted: false,
      },
      {
        identifier: 'b',
        saveName: 'B',
        timestamp: '2023-08-01T00:00:00Z',
        playtimeSeconds: 20,
        isCorrupted: false,
      },
      {
        identifier: 'c',
        saveName: 'C',
        timestamp: '2023-07-15T00:00:00Z',
        playtimeSeconds: 15,
        isCorrupted: true,
      },
    ];
    mockSaveLoadService.listManualSaveSlots.mockResolvedValueOnce(saves);

    const result = await loadGameUI._getLoadSlotsData();

    expect(result.map((s) => s.identifier)).toEqual(['b', 'a', 'c']);
    expect(result[0].slotItemMeta).toEqual(formatSaveFileMetadata(result[0]));
    expect(loadGameUI.currentSlotsDisplayData).toEqual(result);
  });

  it('should render a load slot item with expected structure', () => {
    const slotData = {
      identifier: 'slot1',
      saveName: 'First',
      timestamp: '2023-07-01T00:00:00Z',
      playtimeSeconds: 60,
      isCorrupted: false,
    };
    const el = loadGameUI._renderLoadSlotItem(slotData, 0);
    expect(renderSlotItemSpy).toHaveBeenCalledTimes(1);
    expect(el).not.toBeNull();
    if (!el) return;
    expect(el.classList.contains('save-slot')).toBe(true);
    expect(el.getAttribute('role')).toBe('radio');
    expect(el.dataset.slotIdentifier).toBe('slot1');
    expect(el.querySelector('.slot-name')?.textContent).toContain('First');
    expect(el.querySelector('.slot-playtime')?.textContent).toContain(
      '00:01:00'
    );
    expect(el.querySelector('.slot-timestamp')?.textContent).toBe(
      `Saved: ${new Date(slotData.timestamp).toLocaleString()}`
    );
  });

  it('should populate the load slots list using the shared method', async () => {
    mockSaveLoadService.listManualSaveSlots.mockResolvedValueOnce([
      {
        identifier: 'slotA',
        saveName: 'Save A',
        timestamp: '2023-09-01T00:00:00Z',
        playtimeSeconds: 3,
        isCorrupted: false,
      },
    ]);

    await loadGameUI._populateLoadSlotsList();
    expect(renderSlotItemSpy).toHaveBeenCalledTimes(1);

    const slots = document
      .getElementById('load-slots-container')
      .querySelectorAll('.save-slot');
    expect(slots.length).toBe(1);
    expect(slots[0].dataset.slotIdentifier).toBe('slotA');
  });

  it('should update selection and button states', () => {
    const container = document.getElementById('load-slots-container');
    const slotData1 = {
      identifier: 'id1',
      saveName: 'One',
      timestamp: '2023-01-01T00:00:00Z',
      playtimeSeconds: 1,
      isCorrupted: false,
    };
    const slotData2 = {
      identifier: 'id2',
      saveName: 'Two',
      timestamp: '2023-01-02T00:00:00Z',
      playtimeSeconds: 1,
      isCorrupted: false,
    };
    const slot1 = loadGameUI._renderLoadSlotItem(slotData1, 0);
    const slot2 = loadGameUI._renderLoadSlotItem(slotData2, 1);
    expect(renderSlotItemSpy).toHaveBeenCalledTimes(2);
    container.appendChild(slot1);
    container.appendChild(slot2);

    loadGameUI.elements.listContainerElement = container;
    loadGameUI.elements.confirmLoadButtonEl = document.getElementById(
      'confirm-load-button'
    );
    loadGameUI.elements.deleteSaveButtonEl =
      document.getElementById('delete-save-button');

    loadGameUI._onItemSelected(slot1, slotData1);
    expect(slot1.classList.contains('selected')).toBe(true);
    expect(loadGameUI.elements.confirmLoadButtonEl.disabled).toBe(false);
    expect(loadGameUI.elements.deleteSaveButtonEl.disabled).toBe(false);

    loadGameUI._onItemSelected(null, null);
    expect(slot1.classList.contains('selected')).toBe(false);
    expect(loadGameUI.elements.confirmLoadButtonEl.disabled).toBe(true);
  });

  it('invokes the selection handler when a rendered slot is clicked', () => {
    const slotData = {
      identifier: 'slot-click',
      saveName: 'Clickable',
      timestamp: '2023-05-01T00:00:00Z',
      playtimeSeconds: 42,
      isCorrupted: false,
    };

    const onItemSelectedSpy = jest.spyOn(loadGameUI, '_onItemSelected');
    const element = loadGameUI._renderLoadSlotItem(slotData, 0);
    expect(element).not.toBeNull();
    if (!element) return;

    loadGameUI.elements.listContainerElement.appendChild(element);
    element.click();

    expect(onItemSelectedSpy).toHaveBeenCalledWith(element, slotData);
  });

  it('restores status message and button state when repopulating with a selection', async () => {
    const updateSpy = jest.spyOn(loadGameUI, '_updateButtonStates');
    const displaySpy = jest.spyOn(loadGameUI, '_displayStatusMessage');
    jest
      .spyOn(loadGameUI, 'populateSlotsList')
      .mockImplementation(async () => {
        loadGameUI.currentSlotsDisplayData = [
          { identifier: 'slot-1', saveName: 'Keep Selected', isCorrupted: false },
        ];
      });

    loadGameUI.selectedSlotData = {
      identifier: 'slot-1',
      saveName: 'Keep Selected',
      isCorrupted: false,
    };
    loadGameUI._lastStatusMessage = {
      message: 'Previous status',
      type: 'warning',
    };

    await loadGameUI._populateLoadSlotsList();

    expect(updateSpy).toHaveBeenCalledWith(loadGameUI.selectedSlotData);
    expect(displaySpy).toHaveBeenCalledWith('Previous status', 'warning');
  });

  it('skips duplicate loading status messages while repopulating', () => {
    const baseDisplaySpy = jest.spyOn(
      SlotModalBase.prototype,
      '_displayStatusMessage'
    );
    loadGameUI._lastStatusMessage = { message: 'Already loaded', type: 'info' };

    loadGameUI._displayStatusMessage('Loading saved games...', 'info');

    expect(baseDisplaySpy).not.toHaveBeenCalled();
  });

  it('logs and reports success from _performLoad', async () => {
    loadGameUI.loadService = {
      load: jest.fn().mockResolvedValue({ success: true }),
    };

    const result = await loadGameUI._performLoad({
      identifier: 'slot-success',
      saveName: 'Successful Save',
    });

    expect(result).toEqual({ success: true, message: '' });
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Game loaded successfully from slot-success')
    );
  });

  it('finalizes a successful load by notifying and hiding after delay', () => {
    jest.useFakeTimers();
    const hideSpy = jest.spyOn(loadGameUI, 'hide').mockImplementation(() => {});
    const displaySpy = jest.spyOn(loadGameUI, '_displayStatusMessage');

    loadGameUI._finalizeLoad(true, '', { saveName: 'Triumph' });

    expect(displaySpy).toHaveBeenCalledWith(
      'Game "Triumph" loaded successfully. Resuming...',
      'success'
    );
    expect(hideSpy).not.toHaveBeenCalled();

    jest.runAllTimers();

    expect(hideSpy).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('clears selection when refreshed slots lack matching data', async () => {
    const container = loadGameUI.elements.listContainerElement;
    const slot = document.createElement('div');
    slot.className = 'save-slot';
    slot.dataset.slotIdentifier = 'missing';
    container.appendChild(slot);

    jest
      .spyOn(loadGameUI, '_populateLoadSlotsList')
      .mockImplementation(async () => {
        loadGameUI.currentSlotsDisplayData = [];
      });
    const onItemSelectedSpy = jest.spyOn(loadGameUI, '_onItemSelected');

    await loadGameUI._refreshAfterDelete(
      { success: true, message: '' },
      { identifier: 'removed-slot', saveName: 'Removed' }
    );

    expect(onItemSelectedSpy).toHaveBeenCalledWith(null, null);
    expect(onItemSelectedSpy).toHaveBeenCalledTimes(1);
  });

  it('clears selection when no slots remain after deletion', async () => {
    loadGameUI.elements.listContainerElement.innerHTML = '';
    jest
      .spyOn(loadGameUI, '_populateLoadSlotsList')
      .mockImplementation(async () => {
        loadGameUI.currentSlotsDisplayData = [];
      });
    const onItemSelectedSpy = jest.spyOn(loadGameUI, '_onItemSelected');

    await loadGameUI._refreshAfterDelete(
      { success: true, message: '' },
      { identifier: 'removed-slot', saveName: 'Removed' }
    );

    expect(onItemSelectedSpy).toHaveBeenCalledWith(null, null);
    expect(onItemSelectedSpy).toHaveBeenCalledTimes(1);
  });
});
