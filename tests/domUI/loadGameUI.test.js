import { JSDOM } from 'jsdom';
import { LoadGameUI } from '../../src/domUI/index.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import * as renderSlotItemModule from '../../src/domUI/helpers/renderSlotItem.js';
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
let loadGameUI;
/** @type {jest.SpiedFunction<typeof renderSlotItemModule.renderSlotItem>} */
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

  loadGameUI = new LoadGameUI({
    logger: mockLogger,
    documentContext: mockDocumentContext,
    domElementFactory,
    saveLoadService: mockSaveLoadService,
    validatedEventDispatcher: mockVED,
  });
  renderSlotItemSpy = jest.spyOn(renderSlotItemModule, 'renderSlotItem');
});

afterEach(() => {
  jest.restoreAllMocks();
  if (window) window.close();
  global.window = undefined;
  global.document = undefined;
});

describe('LoadGameUI basic behaviors', () => {
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

    loadGameUI._handleSlotSelection(slot1, slotData1);
    expect(slot1.classList.contains('selected')).toBe(true);
    expect(loadGameUI.elements.confirmLoadButtonEl.disabled).toBe(false);
    expect(loadGameUI.elements.deleteSaveButtonEl.disabled).toBe(false);

    loadGameUI._handleSlotSelection(null, null);
    expect(slot1.classList.contains('selected')).toBe(false);
    expect(loadGameUI.elements.confirmLoadButtonEl.disabled).toBe(true);
  });
});
