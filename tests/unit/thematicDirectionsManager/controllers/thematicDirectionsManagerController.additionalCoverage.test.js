/**
 * @file Additional coverage tests for ThematicDirectionsManagerController
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

const dropdownConfigs = [];
let mockDropdownFactory = defaultDropdownFactory;
let localStorageStore;
let originalWindowLocalStorage;
const DROPDOWN_STATE_KEY = 'thematic-directions-dropdown-state';

function defaultDropdownFactory() {
  return {
    loadItems: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
    enable: jest.fn(),
    destroy: jest.fn(),
  };
}

let mockEditorFactory = defaultEditorFactory;

function defaultEditorFactory() {
  return {
    destroy: jest.fn(),
  };
}

jest.mock(
  '../../../../src/shared/characterBuilder/previousItemsDropdown.js',
  () => ({
    PreviousItemsDropdown: jest
      .fn()
      .mockImplementation((options) => {
        dropdownConfigs.push(options);
        const instance = mockDropdownFactory(options);
        return instance;
      }),
  })
);

jest.mock(
  '../../../../src/shared/characterBuilder/inPlaceEditor.js',
  () => ({
    InPlaceEditor: jest
      .fn()
      .mockImplementation(() => {
        const instance = mockEditorFactory();
        return instance;
      }),
  })
);

const addControllerDom = (testBase) => {
  testBase.addDOMElement(`<select id="concept-selector"></select>`);
  testBase.addDOMElement(`<input id="direction-filter" />`);
  testBase.addDOMElement(`<div id="directions-results"></div>`);
  testBase.addDOMElement(`<div id="total-directions"></div>`);
  testBase.addDOMElement(`<div id="orphaned-count"></div>`);
  testBase.addDOMElement(`<button id="cleanup-orphans-btn"></button>`);
  testBase.addDOMElement(`<button id="refresh-btn"></button>`);
  testBase.addDOMElement(`<button id="retry-btn"></button>`);
  testBase.addDOMElement(`<button id="back-to-menu-btn"></button>`);
  testBase.addDOMElement(`
    <div id="concept-display-container" style="display:none;">
      <div id="concept-display-content"></div>
    </div>
  `);
  const emptyState = document.getElementById('empty-state');
  if (emptyState) {
    let message = emptyState.querySelector('.empty-message');
    if (!message) {
      message = document.createElement('span');
      message.className = 'empty-message';
      emptyState.appendChild(message);
    }
  }
};

const createController = async () => {
  const testBase = new BaseCharacterBuilderControllerTestBase();
  await testBase.setup();
  addControllerDom(testBase);
  const controller = new ThematicDirectionsManagerController(testBase.mocks);
  testBase.controller = controller;
  return { testBase, controller };
};

describe('ThematicDirectionsManagerController additional coverage', () => {
  let originalEnv;

  beforeEach(() => {
    dropdownConfigs.length = 0;
    mockDropdownFactory = defaultDropdownFactory;
    mockEditorFactory = defaultEditorFactory;
    originalEnv = process.env.NODE_ENV;
    originalWindowLocalStorage = undefined;
    localStorageStore = {};
    const mockStorage = {
      getItem: jest.fn((key) =>
        Object.prototype.hasOwnProperty.call(localStorageStore, key)
          ? localStorageStore[key]
          : null
      ),
      setItem: jest.fn((key, value) => {
        localStorageStore[key] = value;
      }),
      removeItem: jest.fn((key) => {
        delete localStorageStore[key];
      }),
      clear: jest.fn(() => {
        localStorageStore = {};
      }),
    };
    global.localStorage = mockStorage;
    if (typeof window !== 'undefined') {
      originalWindowLocalStorage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        configurable: true,
        writable: true,
      });
    }
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    delete global.alert;
    if (typeof window !== 'undefined' && originalWindowLocalStorage) {
      Object.defineProperty(window, 'localStorage', {
        value: originalWindowLocalStorage,
        configurable: true,
        writable: true,
      });
    }
    originalWindowLocalStorage = undefined;
  });

  it('applies native fallback when dropdown initialization fails', async () => {
    const { testBase, controller } = await createController();

    controller._cacheElements();

    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValue(
      new Error('network down')
    );
    global.alert = jest.fn();

    await controller.refreshDropdown();
    const selectElement = controller._getElement('conceptSelector');

    expect(selectElement.classList.contains('native-fallback')).toBe(true);
    expect(testBase.mocks.eventBus.dispatch).toHaveBeenCalledWith(
      'core:analytics_track',
      expect.objectContaining({
        properties: expect.objectContaining({ action: 'fallback' }),
      })
    );

    await testBase.cleanup();
  });

  it('restores dropdown selection and filter from stored state', async () => {
    mockDropdownFactory = (options) => {
      const loadItems = jest.fn(async (items) => {
        const select = options.element;
        select.innerHTML = '';
        items.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.concept;
          select.appendChild(option);
        });
      });

      return {
        loadItems,
        clear: jest.fn(),
        enable: jest.fn(),
        destroy: jest.fn(),
      };
    };

    const { testBase, controller } = await createController();

    const dataset = [
      {
        direction: {
          id: 'dir-1',
          title: 'Title',
          description: 'Description',
          coreTension: 'Tension',
          uniqueTwist: 'Twist',
          narrativePotential: 'Potential',
        },
        concept: {
          id: 'concept-1',
          concept: 'Concept 1',
        },
      },
    ];

    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(dataset);
    testBase.mocks.characterBuilderService.getCharacterConcept.mockResolvedValue({
      id: 'concept-1',
      concept: 'Concept 1',
    });

    await controller.initialize();

    const dropdownConfig = dropdownConfigs[0];
    const selectElement = controller._getElement('conceptSelector');
    selectElement.value = 'concept-1';
    await dropdownConfig.onSelectionChange('concept-1');

    const filterElement = controller._getElement('directionFilter');
    filterElement.value = 'mystery';
    filterElement.dispatchEvent(new Event('input', { bubbles: true }));

    const storedState = localStorageStore[DROPDOWN_STATE_KEY];
    expect(storedState).toBeDefined();

    await testBase.cleanup();

    dropdownConfigs.length = 0;

    const { testBase: secondBase, controller: secondController } =
      await createController();

    mockDropdownFactory = (options) => {
      const loadItems = jest.fn(async (items) => {
        const select = options.element;
        select.innerHTML = '';
        items.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.concept;
          select.appendChild(option);
        });
      });

      return {
        loadItems,
        clear: jest.fn(),
        enable: jest.fn(),
        destroy: jest.fn(),
      };
    };

    const secondDataset = [...dataset];

    localStorageStore[DROPDOWN_STATE_KEY] = storedState;

    secondBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      secondDataset
    );
    secondBase.mocks.characterBuilderService.getCharacterConcept.mockResolvedValue({
      id: 'concept-1',
      concept: 'Concept 1',
    });

    await secondController.initialize();

    const restoredSelect = secondController._getElement('conceptSelector');
    const restoredFilter = secondController._getElement('directionFilter');

    expect(restoredSelect.value).toBe('concept-1');
    expect(restoredFilter.value).toBe('mystery');

    await secondBase.cleanup();
  });

  it('emits refresh reset analytics when stored concept is missing', async () => {
    mockDropdownFactory = (options) => {
      const loadItems = jest.fn(async (items) => {
        const select = options.element;
        select.innerHTML = '';
        items.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.concept;
          select.appendChild(option);
        });
      });

      return {
        loadItems,
        clear: jest.fn(),
        enable: jest.fn(),
        destroy: jest.fn(),
      };
    };

    const { testBase, controller } = await createController();

    const serviceMock =
      testBase.mocks.characterBuilderService
        .getAllThematicDirectionsWithConcepts;

    const firstDataset = [
      {
        direction: {
          id: 'dir-1',
          title: 'Title',
          description: 'Description',
          coreTension: 'Tension',
          uniqueTwist: 'Twist',
          narrativePotential: 'Potential',
        },
        concept: {
          id: 'concept-1',
          concept: 'Concept 1',
        },
      },
    ];

    serviceMock.mockResolvedValueOnce(firstDataset);
    testBase.mocks.characterBuilderService.getCharacterConcept.mockResolvedValue({
      id: 'concept-1',
      concept: 'Concept 1',
    });

    await controller.initialize();

    const dropdownConfig = dropdownConfigs[0];
    const selectElement = controller._getElement('conceptSelector');
    selectElement.value = 'concept-1';
    await dropdownConfig.onSelectionChange('concept-1');

    const secondDataset = [
      {
        direction: {
          id: 'dir-2',
          title: 'Second',
          description: 'Second description',
          coreTension: 'Another',
          uniqueTwist: 'Different',
          narrativePotential: 'Potential',
        },
        concept: {
          id: 'concept-2',
          concept: 'Concept 2',
        },
      },
    ];

    serviceMock.mockResolvedValueOnce(secondDataset);

    await controller.refreshDropdown();

    const refreshResetCalled = testBase.mocks.eventBus.dispatch.mock.calls.some(
      ([event, payload]) =>
        event === 'core:analytics_track' &&
        payload?.properties?.action === 'refresh_reset'
    );

    expect(refreshResetCalled).toBe(true);

    await testBase.cleanup();
  });

  it('falls back to native select when dropdown construction throws during initialization', async () => {
    mockDropdownFactory = () => {
      throw new Error('dropdown boom');
    };

    const { testBase, controller } = await createController();

    controller._cacheElements();

    await expect(controller._initializeAdditionalServices()).resolves.toBeUndefined();

    expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
      'Failed to initialize dropdown:',
      expect.any(Error)
    );

    const selectElement = controller._getElement('conceptSelector');
    expect(selectElement.classList.contains('native-fallback')).toBe(true);

    await testBase.cleanup();
  });

  it('reports initialization failures from dependent services', async () => {
    const { testBase, controller } = await createController();

    controller._cacheElements();

    const initError = new Error('service init failed');
    const showErrorSpy = jest.spyOn(controller, '_showError');
    testBase.mocks.characterBuilderService.initialize.mockRejectedValue(initError);

    await expect(controller._initializeServices()).rejects.toThrow(initError);

    expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
      'ThematicDirectionsManagerController: Failed to initialize services',
      initError
    );
    expect(showErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize directions manager. Please refresh the page.'
    );

    showErrorSpy.mockRestore();
    await testBase.cleanup();
  });

  it('continues gracefully when dropdown fails to load initial items', async () => {
    const loadError = new Error('load failed');
    mockDropdownFactory = () => ({
      loadItems: jest.fn().mockRejectedValue(loadError),
      clear: jest.fn(),
      enable: jest.fn(),
      destroy: jest.fn(),
    });

    const dataset = [
      {
        direction: {
          id: 'dir-1',
          title: 'First',
          description: 'Description one',
          coreTension: 'Tension',
          uniqueTwist: 'Twist',
          narrativePotential: 'Potential',
        },
        concept: { id: 'concept-1', concept: 'Concept 1' },
      },
    ];

    const { testBase, controller } = await createController();
    controller._cacheElements();

    await controller._initializeAdditionalServices();

    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );

    await controller._loadInitialData();

    expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
      'Failed to load items into dropdown:',
      loadError
    );

    await testBase.cleanup();
  });

  it('filters displayed results to orphaned directions when orphaned is selected', async () => {
    mockDropdownFactory = (options) => ({
      loadItems: jest.fn(async (items) => {
        const select = options.element;
        select.innerHTML = '';
        items.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.concept || 'Orphaned';
          select.appendChild(option);
        });
      }),
      clear: jest.fn(),
      enable: jest.fn(),
      destroy: jest.fn(),
    });

    const dataset = [
      {
        direction: {
          id: 'dir-orphan',
          title: 'Unanchored',
          description: 'No concept attached',
          coreTension: 'Isolation',
          uniqueTwist: 'Surprise',
          narrativePotential: 'Growth',
        },
        concept: null,
      },
      {
        direction: {
          id: 'dir-linked',
          title: 'Anchored',
          description: 'Linked to concept',
          coreTension: 'Conflict',
          uniqueTwist: 'Reversal',
          narrativePotential: 'Resolution',
        },
        concept: { id: 'concept-1', concept: 'Concept 1' },
      },
    ];

    const { testBase, controller } = await createController();
    const showResultsSpy = jest.spyOn(controller, '_showResults');

    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );

    await controller.initialize();

    const dropdownConfig = dropdownConfigs[0];
    await dropdownConfig.onSelectionChange('orphaned');

    const lastCall = showResultsSpy.mock.calls.at(-1);
    expect(lastCall?.[0]).toHaveLength(1);
    expect(lastCall?.[0][0].concept).toBeNull();

    const orphanedInfo = document.querySelectorAll(
      '.direction-concept-info.orphaned'
    );
    expect(orphanedInfo).toHaveLength(1);

    showResultsSpy.mockRestore();
    await testBase.cleanup();
  });

  it('connects delete button interaction to confirmation modal flow', async () => {
    mockDropdownFactory = (options) => ({
      loadItems: jest.fn(async (items) => {
        const select = options.element;
        select.innerHTML = '';
        items.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.concept || 'Orphaned';
          select.appendChild(option);
        });
      }),
      clear: jest.fn(),
      enable: jest.fn(),
      destroy: jest.fn(),
    });

    const dataset = [
      {
        direction: {
          id: 'dir-delete',
          title: 'Delete Me',
          description: 'To be removed',
          coreTension: 'Risk',
          uniqueTwist: 'Twist',
          narrativePotential: 'Closure',
        },
        concept: { id: 'concept-1', concept: 'Concept 1' },
      },
    ];

    const { testBase, controller } = await createController();
    controller._showConfirmationModal = jest.fn();

    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );

    await controller.initialize();

    const deleteButton = document.querySelector(
      '.direction-action-btn.delete-btn'
    );
    deleteButton.click();

    expect(controller._showConfirmationModal).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Delete Me'),
      })
    );

    await testBase.cleanup();
  });

  it('clears and re-enables dropdown when refresh fails', async () => {
    let dropdownInstance;
    mockDropdownFactory = (options) => {
      dropdownInstance = {
        loadItems: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn(),
        enable: jest.fn(),
        destroy: jest.fn(),
        element: options.element,
      };
      return dropdownInstance;
    };

    const { testBase, controller } = await createController();
    controller._cacheElements();

    await controller._initializeAdditionalServices();

    const refreshError = new Error('refresh failed');
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValue(
      refreshError
    );

    await controller.refreshDropdown();

    expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
      'Failed to refresh dropdown:',
      refreshError
    );
    expect(dropdownInstance.clear).toHaveBeenCalledTimes(1);
    expect(dropdownInstance.enable).toHaveBeenCalledTimes(1);

    await testBase.cleanup();
  });
});
