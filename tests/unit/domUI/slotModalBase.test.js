// tests/unit/domUI/slotModalBase.test.js
/**
 * @file Unit tests for SlotModalBase class
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { SlotModalBase } from '../../../src/domUI/slotModalBase.js';
import { DATASET_SLOT_ID } from '../../../src/constants/datasetKeys.js';

// Mock dependencies
jest.mock('../../../src/domUI/baseModalRenderer.js');
jest.mock('../../../src/utils/listNavigationUtils.js');
jest.mock('../../../src/domUI/helpers/renderListCommon.js');

import { BaseModalRenderer } from '../../../src/domUI/baseModalRenderer.js';
import { setupRadioListNavigation } from '../../../src/utils/listNavigationUtils.js';
import renderListCommon from '../../../src/domUI/helpers/renderListCommon.js';

describe('SlotModalBase', () => {
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockDomElementFactory;
  let mockElements;
  let slotModalBase;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Setup mock document context
    mockDocumentContext = {
      document: {
        activeElement: null,
      },
      query: jest.fn(),
      queryAll: jest.fn(),
    };

    // Setup mock event dispatcher
    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Setup mock DOM element factory
    mockDomElementFactory = {
      createElement: jest.fn(),
    };

    // Setup mock elements
    mockElements = {
      modalElement: document.createElement('div'),
      listContainerElement: document.createElement('div'),
      confirmButton: document.createElement('button'),
      deleteButton: document.createElement('button'),
    };

    // Setup BaseModalRenderer mock
    BaseModalRenderer.mockImplementation(function (deps) {
      this.logger = deps.logger;
      this.documentContext = deps.documentContext;
      this.validatedEventDispatcher = deps.validatedEventDispatcher;
      this.domElementFactory = deps.domElementFactory;
      this.elements = mockElements;
      this._logPrefix = '[SlotModalBase]';
      this._addDomListener = jest.fn();
      this._setOperationInProgress = jest.fn();
      this._displayStatusMessage = jest.fn();
      this._clearStatusMessage = jest.fn();
    });

    // Mock setupRadioListNavigation to return a function
    setupRadioListNavigation.mockReturnValue(jest.fn());

    // Mock renderListCommon
    renderListCommon.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid parameters', () => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
        buttonKeys: {
          confirmKey: 'confirmButton',
          deleteKey: 'deleteButton',
        },
      });

      expect(slotModalBase._datasetKey).toBe(DATASET_SLOT_ID);
      expect(slotModalBase._confirmButtonKey).toBe('confirmButton');
      expect(slotModalBase._deleteButtonKey).toBe('deleteButton');
      expect(slotModalBase.selectedSlotData).toBeNull();
      expect(slotModalBase.currentSlotsDisplayData).toEqual([]);
    });

    it('should initialize without buttonKeys', () => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
      });

      expect(slotModalBase._confirmButtonKey).toBeUndefined();
      expect(slotModalBase._deleteButtonKey).toBeUndefined();
    });

    it('should throw error if buttonKeys is not an object', () => {
      expect(() => {
        new SlotModalBase({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: mockDomElementFactory,
          datasetKey: DATASET_SLOT_ID,
          buttonKeys: 'invalid',
        });
      }).toThrow("'buttonKeys' must be an object when provided");
    });

    it('should throw error if buttonKeys is null', () => {
      expect(() => {
        new SlotModalBase({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: mockDomElementFactory,
          datasetKey: DATASET_SLOT_ID,
          buttonKeys: null,
        });
      }).toThrow("'buttonKeys' must be an object when provided");
    });
  });

  describe('property getters', () => {
    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
        buttonKeys: {
          confirmKey: 'confirmButton',
          deleteKey: 'deleteButton',
        },
      });
    });

    it('should return confirm button element when key is configured', () => {
      const button = slotModalBase._confirmButtonEl;
      expect(button).toBe(mockElements.confirmButton);
    });

    it('should return null when confirm button key is not configured', () => {
      slotModalBase._confirmButtonKey = undefined;
      const button = slotModalBase._confirmButtonEl;
      expect(button).toBeNull();
    });

    it('should return delete button element when key is configured', () => {
      const button = slotModalBase._deleteButtonEl;
      expect(button).toBe(mockElements.deleteButton);
    });

    it('should return null when delete button key is not configured', () => {
      slotModalBase._deleteButtonKey = undefined;
      const button = slotModalBase._deleteButtonEl;
      expect(button).toBeNull();
    });
  });

  describe('setSlotData', () => {
    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
      });
    });

    it('should set slot data with valid array', () => {
      const testData = [
        { slotId: 1, name: 'Slot 1' },
        { slotId: 2, name: 'Slot 2' },
      ];
      slotModalBase.setSlotData(testData);
      expect(slotModalBase.currentSlotsDisplayData).toEqual(testData);
    });

    it('should convert non-array to empty array', () => {
      slotModalBase.setSlotData('not an array');
      expect(slotModalBase.currentSlotsDisplayData).toEqual([]);
    });

    it('should handle null input', () => {
      slotModalBase.setSlotData(null);
      expect(slotModalBase.currentSlotsDisplayData).toEqual([]);
    });

    it('should handle undefined input', () => {
      slotModalBase.setSlotData(undefined);
      expect(slotModalBase.currentSlotsDisplayData).toEqual([]);
    });
  });

  describe('clearSlotData', () => {
    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
      });
    });

    it('should clear existing slot data', () => {
      slotModalBase.currentSlotsDisplayData = [{ slotId: 1 }, { slotId: 2 }];
      slotModalBase.clearSlotData();
      expect(slotModalBase.currentSlotsDisplayData).toEqual([]);
    });

    it('should handle clearing when already empty', () => {
      slotModalBase.currentSlotsDisplayData = [];
      slotModalBase.clearSlotData();
      expect(slotModalBase.currentSlotsDisplayData).toEqual([]);
    });
  });

  describe('_updateButtonStates', () => {
    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
        buttonKeys: {
          confirmKey: 'confirmButton',
          deleteKey: 'deleteButton',
        },
      });
    });

    it('should enable buttons when slot is selected', () => {
      slotModalBase._updateButtonStates({ slotId: 1 });
      expect(mockElements.confirmButton.disabled).toBe(false);
      expect(mockElements.deleteButton.disabled).toBe(false);
    });

    it('should disable buttons when no slot is selected', () => {
      slotModalBase._updateButtonStates(null);
      expect(mockElements.confirmButton.disabled).toBe(true);
      expect(mockElements.deleteButton.disabled).toBe(true);
    });

    it('should handle missing confirm button', () => {
      mockElements.confirmButton = null;
      expect(() => {
        slotModalBase._updateButtonStates({ slotId: 1 });
      }).not.toThrow();
    });

    it('should handle missing delete button', () => {
      mockElements.deleteButton = null;
      expect(() => {
        slotModalBase._updateButtonStates({ slotId: 1 });
      }).not.toThrow();
    });
  });

  describe('_onItemSelected', () => {
    let mockSlotElements;

    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
        buttonKeys: {
          confirmKey: 'confirmButton',
          deleteKey: 'deleteButton',
        },
      });

      // Create mock slot elements
      mockSlotElements = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
      ];
      mockSlotElements.forEach((el, index) => {
        el.classList.add('save-slot');
        el.setAttribute('tabindex', '-1');
        el.setAttribute('aria-checked', 'false');
        el.dataset[DATASET_SLOT_ID] = String(index);
        mockElements.listContainerElement.appendChild(el);
      });

      // Mock querySelectorAll
      mockElements.listContainerElement.querySelectorAll = jest
        .fn()
        .mockReturnValue(mockSlotElements);
    });

    it('should update selectedSlotData', () => {
      const slotData = { slotId: 1, name: 'Test Slot' };
      slotModalBase._onItemSelected(mockSlotElements[0], slotData);
      expect(slotModalBase.selectedSlotData).toBe(slotData);
    });

    it('should update selected element classes and attributes', () => {
      const slotData = { slotId: 1 };
      slotModalBase._onItemSelected(mockSlotElements[1], slotData);

      expect(mockSlotElements[0].classList.contains('selected')).toBe(false);
      expect(mockSlotElements[0].getAttribute('aria-checked')).toBe('false');
      expect(mockSlotElements[0].getAttribute('tabindex')).toBe('-1');

      expect(mockSlotElements[1].classList.contains('selected')).toBe(true);
      expect(mockSlotElements[1].getAttribute('aria-checked')).toBe('true');
      expect(mockSlotElements[1].getAttribute('tabindex')).toBe('0');

      expect(mockSlotElements[2].classList.contains('selected')).toBe(false);
      expect(mockSlotElements[2].getAttribute('aria-checked')).toBe('false');
      expect(mockSlotElements[2].getAttribute('tabindex')).toBe('-1');
    });

    it('should focus selected element if not already focused', () => {
      const focusSpy = jest.spyOn(mockSlotElements[1], 'focus');
      mockDocumentContext.document.activeElement = mockSlotElements[0];

      slotModalBase._onItemSelected(mockSlotElements[1], { slotId: 1 });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should not focus if element is already focused', () => {
      const focusSpy = jest.spyOn(mockSlotElements[1], 'focus');
      mockDocumentContext.document.activeElement = mockSlotElements[1];

      slotModalBase._onItemSelected(mockSlotElements[1], { slotId: 1 });

      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('should set tabindex on first slot when no element selected', () => {
      mockElements.listContainerElement.querySelector = jest
        .fn()
        .mockReturnValue(mockSlotElements[0]);

      slotModalBase._onItemSelected(null, null);

      expect(mockSlotElements[0].getAttribute('tabindex')).toBe('0');
    });

    it('should handle case when no first slot found', () => {
      mockElements.listContainerElement.querySelector = jest
        .fn()
        .mockReturnValue(null);

      expect(() => {
        slotModalBase._onItemSelected(null, null);
      }).not.toThrow();
    });

    it('should call _updateButtonStates', () => {
      const updateSpy = jest.spyOn(slotModalBase, '_updateButtonStates');
      const slotData = { slotId: 1 };

      slotModalBase._onItemSelected(mockSlotElements[0], slotData);

      expect(updateSpy).toHaveBeenCalledWith(slotData);
    });
  });

  describe('_handleSlotNavigation', () => {
    let mockArrowHandler;
    let mockSlotElements;

    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
        buttonKeys: {
          confirmKey: 'confirmButton',
        },
      });

      // Setup slot data
      slotModalBase.currentSlotsDisplayData = [
        { slotId: 0, name: 'Slot 0' },
        { slotId: 1, name: 'Slot 1' },
        { slotId: 2, name: 'Slot 2' },
      ];

      // Create mock slot elements
      mockSlotElements = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
      ];
      mockSlotElements.forEach((el, index) => {
        el.dataset[DATASET_SLOT_ID] = String(index);
      });

      // Mock the arrow handler
      mockArrowHandler = jest.fn();
      setupRadioListNavigation.mockReturnValue(mockArrowHandler);
    });

    it('should handle missing container element', () => {
      mockElements.listContainerElement = null;
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      expect(() => {
        slotModalBase._handleSlotNavigation(event);
      }).not.toThrow();

      expect(setupRadioListNavigation).not.toHaveBeenCalled();
    });

    it('should setup arrow navigation handler', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      slotModalBase._handleSlotNavigation(event);

      expect(setupRadioListNavigation).toHaveBeenCalledWith(
        mockElements.listContainerElement,
        '[role="radio"]',
        DATASET_SLOT_ID,
        expect.any(Function)
      );
      expect(mockArrowHandler).toHaveBeenCalledWith(event);
    });

    it('should handle Enter key press', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefault = jest.spyOn(event, 'preventDefault');
      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      Object.defineProperty(event, 'target', {
        value: mockSlotElements[1],
        configurable: true,
      });

      slotModalBase._handleSlotNavigation(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(onItemSelectedSpy).toHaveBeenCalledWith(
        mockSlotElements[1],
        slotModalBase.currentSlotsDisplayData[1]
      );
    });

    it('should handle Space key press', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      const preventDefault = jest.spyOn(event, 'preventDefault');
      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      Object.defineProperty(event, 'target', {
        value: mockSlotElements[2],
        configurable: true,
      });

      slotModalBase._handleSlotNavigation(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(onItemSelectedSpy).toHaveBeenCalledWith(
        mockSlotElements[2],
        slotModalBase.currentSlotsDisplayData[2]
      );
    });

    it('should handle slot selection callback from arrow navigation', () => {
      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      slotModalBase._handleSlotNavigation(new KeyboardEvent('keydown'));

      // Get the callback passed to setupRadioListNavigation
      const callback = setupRadioListNavigation.mock.calls[0][3];

      // Call the callback
      callback(mockSlotElements[1], '1');

      expect(onItemSelectedSpy).toHaveBeenCalledWith(
        mockSlotElements[1],
        slotModalBase.currentSlotsDisplayData[1]
      );
    });

    it('should handle custom dataset key', () => {
      const customKey = 'customId';
      slotModalBase._datasetKey = customKey;
      slotModalBase.currentSlotsDisplayData = [
        { [customKey]: 'custom1', name: 'Slot 1' },
        { [customKey]: 'custom2', name: 'Slot 2' },
      ];

      mockSlotElements[0].dataset[customKey] = 'custom1';

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefault = jest.spyOn(event, 'preventDefault');
      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      Object.defineProperty(event, 'target', {
        value: mockSlotElements[0],
        configurable: true,
      });

      slotModalBase._handleSlotNavigation(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(onItemSelectedSpy).toHaveBeenCalledWith(
        mockSlotElements[0],
        slotModalBase.currentSlotsDisplayData[0]
      );
    });

    it('should handle custom dataset key in arrow navigation callback', () => {
      const customKey = 'customId';
      slotModalBase._datasetKey = customKey;
      slotModalBase.currentSlotsDisplayData = [
        { [customKey]: 'custom1', name: 'Slot 1' },
        { [customKey]: 'custom2', name: 'Slot 2' },
      ];

      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      slotModalBase._handleSlotNavigation(new KeyboardEvent('keydown'));

      // Get the callback passed to setupRadioListNavigation
      const callback = setupRadioListNavigation.mock.calls[0][3];

      // Call the callback
      callback(mockSlotElements[1], 'custom2');

      expect(onItemSelectedSpy).toHaveBeenCalledWith(
        mockSlotElements[1],
        slotModalBase.currentSlotsDisplayData[1]
      );
    });

    it('should handle missing slot data', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefault = jest.spyOn(event, 'preventDefault');
      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      // Create element with non-existent slot ID
      mockSlotElements[0].dataset[DATASET_SLOT_ID] = '999';

      Object.defineProperty(event, 'target', {
        value: mockSlotElements[0],
        configurable: true,
      });

      slotModalBase._handleSlotNavigation(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(onItemSelectedSpy).not.toHaveBeenCalled();
    });

    it('should handle Enter key with undefined dataset value', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefault = jest.spyOn(event, 'preventDefault');
      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      // Create element without dataset value
      const elementWithoutDataset = document.createElement('div');

      Object.defineProperty(event, 'target', {
        value: elementWithoutDataset,
        configurable: true,
      });

      slotModalBase._handleSlotNavigation(event);

      expect(preventDefault).toHaveBeenCalled();
      // Should parse undefined to -1, which won't find a match
      expect(onItemSelectedSpy).not.toHaveBeenCalled();
    });

    it('should handle missing slot data in arrow navigation callback', () => {
      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      slotModalBase._handleSlotNavigation(new KeyboardEvent('keydown'));

      // Get the callback passed to setupRadioListNavigation
      const callback = setupRadioListNavigation.mock.calls[0][3];

      // Call the callback with non-existent slot ID
      callback(mockSlotElements[1], '999');

      expect(onItemSelectedSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid slot ID parsing', () => {
      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      slotModalBase._handleSlotNavigation(new KeyboardEvent('keydown'));

      // Get the callback passed to setupRadioListNavigation
      const callback = setupRadioListNavigation.mock.calls[0][3];

      // Call the callback with invalid value
      callback(mockSlotElements[0], 'invalid');

      expect(onItemSelectedSpy).not.toHaveBeenCalled();
    });

    it('should handle null value in arrow navigation callback', () => {
      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      slotModalBase._handleSlotNavigation(new KeyboardEvent('keydown'));

      // Get the callback passed to setupRadioListNavigation
      const callback = setupRadioListNavigation.mock.calls[0][3];

      // Call the callback with null value
      callback(mockSlotElements[0], null);

      // Should parse null to -1, which won't find a match
      expect(onItemSelectedSpy).not.toHaveBeenCalled();
    });

    it('should handle missing slot data in custom key callback', () => {
      const customKey = 'customId';
      slotModalBase._datasetKey = customKey;
      slotModalBase.currentSlotsDisplayData = [
        { [customKey]: 'custom1', name: 'Slot 1' },
        { [customKey]: 'custom2', name: 'Slot 2' },
      ];

      const onItemSelectedSpy = jest.spyOn(slotModalBase, '_onItemSelected');

      slotModalBase._handleSlotNavigation(new KeyboardEvent('keydown'));

      // Get the callback passed to setupRadioListNavigation
      const callback = setupRadioListNavigation.mock.calls[0][3];

      // Call the callback with non-existent value
      callback(mockSlotElements[1], 'custom999');

      expect(onItemSelectedSpy).not.toHaveBeenCalled();
    });
  });

  describe('_initCommonListeners', () => {
    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
        buttonKeys: {
          confirmKey: 'confirmButton',
        },
      });
    });

    it('should add confirm button listener when handler provided', () => {
      const confirmHandler = jest.fn();
      slotModalBase._initCommonListeners(confirmHandler);

      expect(slotModalBase._addDomListener).toHaveBeenCalledWith(
        mockElements.confirmButton,
        'click',
        confirmHandler
      );
    });

    it('should not add listener when confirm button missing', () => {
      slotModalBase._confirmButtonKey = undefined;
      const confirmHandler = jest.fn();

      slotModalBase._initCommonListeners(confirmHandler);

      expect(slotModalBase._addDomListener).not.toHaveBeenCalledWith(
        expect.anything(),
        'click',
        confirmHandler
      );
    });

    it('should not add listener when handler is not a function', () => {
      slotModalBase._initCommonListeners('not a function');

      expect(slotModalBase._addDomListener).not.toHaveBeenCalledWith(
        mockElements.confirmButton,
        'click',
        expect.anything()
      );
    });

    it('should add form submit prevention listener', () => {
      slotModalBase._initCommonListeners(() => {});

      expect(slotModalBase._addDomListener).toHaveBeenCalledWith(
        mockElements.modalElement,
        'submit',
        expect.any(Function)
      );

      // Test the submit handler
      const submitHandler = slotModalBase._addDomListener.mock.calls.find(
        (call) => call[1] === 'submit'
      )[2];

      const event = new Event('submit');
      const preventDefault = jest.spyOn(event, 'preventDefault');

      submitHandler(event);

      expect(preventDefault).toHaveBeenCalled();
    });

    it('should handle missing modal element', () => {
      mockElements.modalElement = null;

      expect(() => {
        slotModalBase._initCommonListeners(() => {});
      }).not.toThrow();
    });
  });

  describe('_validateSlotSelection', () => {
    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
      });
    });

    it('should return null for valid selection', () => {
      slotModalBase.selectedSlotData = { slotId: 1, name: 'Test' };
      const result = slotModalBase._validateSlotSelection();
      expect(result).toBeNull();
    });

    it('should return error when no slot selected', () => {
      slotModalBase.selectedSlotData = null;
      const result = slotModalBase._validateSlotSelection();
      expect(result).toBe('Please select a save slot first.');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should use custom no selection message', () => {
      slotModalBase.selectedSlotData = null;
      const result = slotModalBase._validateSlotSelection(false, {
        noSelection: 'Custom error message',
      });
      expect(result).toBe('Custom error message');
    });

    it('should return error for corrupted slot when required uncorrupted', () => {
      slotModalBase.selectedSlotData = {
        slotId: 1,
        isCorrupted: true,
      };
      const result = slotModalBase._validateSlotSelection(true);
      expect(result).toBe('Cannot use a corrupted save file.');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should use custom corrupted message', () => {
      slotModalBase.selectedSlotData = {
        slotId: 1,
        isCorrupted: true,
      };
      const result = slotModalBase._validateSlotSelection(true, {
        corrupted: 'Custom corrupted message',
      });
      expect(result).toBe('Custom corrupted message');
    });

    it('should return null for uncorrupted slot when required uncorrupted', () => {
      slotModalBase.selectedSlotData = {
        slotId: 1,
        isCorrupted: false,
      };
      const result = slotModalBase._validateSlotSelection(true);
      expect(result).toBeNull();
    });

    it('should return null for slot without isCorrupted property', () => {
      slotModalBase.selectedSlotData = { slotId: 1 };
      const result = slotModalBase._validateSlotSelection(true);
      expect(result).toBeNull();
    });
  });

  describe('_populateSlots', () => {
    let dataFetcher;
    let renderer;
    let emptyMessageProvider;

    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
      });

      dataFetcher = jest.fn().mockResolvedValue([
        { slotId: 1, name: 'Slot 1' },
        { slotId: 2, name: 'Slot 2' },
      ]);
      renderer = jest.fn().mockReturnValue(document.createElement('div'));
      emptyMessageProvider = jest.fn().mockReturnValue('No slots available');
    });

    it('should populate slots successfully', async () => {
      const testData = [
        { slotId: 1, name: 'Slot 1' },
        { slotId: 2, name: 'Slot 2' },
      ];
      renderListCommon.mockResolvedValue(testData);

      await slotModalBase._populateSlots(
        dataFetcher,
        renderer,
        emptyMessageProvider,
        'Loading slots...'
      );

      expect(slotModalBase._setOperationInProgress).toHaveBeenCalledWith(true);
      expect(slotModalBase._displayStatusMessage).toHaveBeenCalledWith(
        'Loading slots...',
        'info'
      );
      expect(renderListCommon).toHaveBeenCalledWith(
        dataFetcher,
        expect.any(Function),
        emptyMessageProvider,
        mockElements.listContainerElement,
        mockLogger,
        mockDomElementFactory
      );
      expect(slotModalBase.currentSlotsDisplayData).toEqual(testData);
      expect(slotModalBase._clearStatusMessage).toHaveBeenCalled();
      expect(slotModalBase._setOperationInProgress).toHaveBeenCalledWith(false);
    });

    it('should handle missing container element', async () => {
      mockElements.listContainerElement = null;

      await slotModalBase._populateSlots(
        dataFetcher,
        renderer,
        emptyMessageProvider,
        'Loading...'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[SlotModalBase] List container element not found.'
      );
      expect(slotModalBase._displayStatusMessage).toHaveBeenCalledWith(
        'Error: UI component for slots missing.',
        'error'
      );
      expect(renderListCommon).not.toHaveBeenCalled();
    });

    it('should handle empty data', async () => {
      renderListCommon.mockResolvedValue([]);

      await slotModalBase._populateSlots(
        dataFetcher,
        renderer,
        emptyMessageProvider,
        'Loading...'
      );

      expect(slotModalBase.currentSlotsDisplayData).toEqual([]);
    });

    it('should handle non-array data', async () => {
      renderListCommon.mockResolvedValue(null);

      await slotModalBase._populateSlots(
        dataFetcher,
        renderer,
        emptyMessageProvider,
        'Loading...'
      );

      expect(slotModalBase.currentSlotsDisplayData).toEqual([]);
    });

    it('should pass renderer function correctly', async () => {
      await slotModalBase._populateSlots(
        dataFetcher,
        renderer,
        emptyMessageProvider,
        'Loading...'
      );

      // Get the renderer function passed to renderListCommon
      const passedRenderer = renderListCommon.mock.calls[0][1];
      const item = { slotId: 1 };
      const index = 0;
      const list = [item];

      passedRenderer(item, index, list);

      expect(renderer).toHaveBeenCalledWith(item, index, list);
    });
  });

  describe('populateSlotsList', () => {
    beforeEach(() => {
      slotModalBase = new SlotModalBase({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        domElementFactory: mockDomElementFactory,
        datasetKey: DATASET_SLOT_ID,
      });

      // Spy on the internal method
      slotModalBase._populateSlots = jest.fn().mockResolvedValue(undefined);
    });

    it('should call _populateSlots with correct parameters', async () => {
      const fetchDataFn = jest.fn();
      const renderItemFn = jest.fn();
      const getEmptyMessageFn = jest.fn();
      const loadingMessage = 'Loading...';

      await slotModalBase.populateSlotsList(
        fetchDataFn,
        renderItemFn,
        getEmptyMessageFn,
        loadingMessage
      );

      expect(slotModalBase._populateSlots).toHaveBeenCalledWith(
        fetchDataFn,
        renderItemFn,
        getEmptyMessageFn,
        loadingMessage
      );
    });
  });
});
