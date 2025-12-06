/**
 * @file Additional branch coverage for ThematicDirectionsManagerController
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
let mockEditorFactory = defaultEditorFactory;
let originalWindowLocalStorage;
let localStorageStore;

/**
 *
 */
function defaultDropdownFactory() {
  return {
    loadItems: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
    enable: jest.fn(),
    destroy: jest.fn(),
  };
}

/**
 *
 */
function defaultEditorFactory() {
  return {
    destroy: jest.fn(),
  };
}

jest.mock(
  '../../../../src/shared/characterBuilder/previousItemsDropdown.js',
  () => ({
    PreviousItemsDropdown: jest.fn().mockImplementation((options) => {
      dropdownConfigs.push(options);
      return mockDropdownFactory(options);
    }),
  })
);

jest.mock('../../../../src/shared/characterBuilder/inPlaceEditor.js', () => ({
  InPlaceEditor: jest.fn().mockImplementation(() => mockEditorFactory()),
}));

/**
 * Add DOM required by controller
 *
 * @param {BaseCharacterBuilderControllerTestBase} testBase - Current test base
 * @param {{ includeConceptDisplay?: boolean }} [options] - DOM options
 */
const addControllerDom = (testBase, options = {}) => {
  const { includeConceptDisplay = true } = options;
  testBase.addDOMElement('<select id="concept-selector"></select>');
  testBase.addDOMElement('<input id="direction-filter" />');
  testBase.addDOMElement('<div id="directions-results"></div>');
  testBase.addDOMElement('<div id="total-directions"></div>');
  testBase.addDOMElement('<div id="orphaned-count"></div>');
  testBase.addDOMElement('<button id="cleanup-orphans-btn"></button>');
  testBase.addDOMElement('<button id="refresh-btn"></button>');
  testBase.addDOMElement('<button id="retry-btn"></button>');
  testBase.addDOMElement('<button id="back-to-menu-btn"></button>');
  if (includeConceptDisplay) {
    testBase.addDOMElement(`
      <div id="concept-display-container" style="display:none;">
        <div id="concept-display-content"></div>
      </div>
    `);
  }

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

/**
 * Create controller and attach DOM
 *
 * @param {{ includeConceptDisplay?: boolean }} [options] - DOM options
 * @returns {Promise<{ testBase: BaseCharacterBuilderControllerTestBase, controller: ThematicDirectionsManagerController }>}
 */
const createController = async (options = {}) => {
  const testBase = new BaseCharacterBuilderControllerTestBase();
  await testBase.setup();
  addControllerDom(testBase, options);
  const controller = new ThematicDirectionsManagerController(testBase.mocks);
  testBase.controller = controller;
  return { testBase, controller };
};

const buildDataset = () => [
  {
    direction: {
      id: 'dir-1',
      title: 'Direction Title',
      description: 'An engaging description',
      coreTension: 'A central conflict',
      uniqueTwist: 'Unexpected development',
      narrativePotential: 'Rich possibilities',
    },
    concept: {
      id: 'concept-1',
      concept: 'Concept 1',
      createdAt: new Date('2023-01-01T00:00:00Z').toISOString(),
      status: 'active',
      thematicDirections: [{ id: 'dir-1' }],
    },
  },
];

describe('ThematicDirectionsManagerController uncovered branches', () => {
  let originalEnv;
  let originalConsoleWarn;

  beforeEach(() => {
    dropdownConfigs.length = 0;
    mockDropdownFactory = defaultDropdownFactory;
    mockEditorFactory = defaultEditorFactory;
    originalEnv = process.env.NODE_ENV;
    originalConsoleWarn = console.warn;
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
    console.warn = originalConsoleWarn;
    jest.restoreAllMocks();
    if (typeof window !== 'undefined' && originalWindowLocalStorage) {
      Object.defineProperty(window, 'localStorage', {
        value: originalWindowLocalStorage,
        configurable: true,
        writable: true,
      });
    }
    originalWindowLocalStorage = undefined;
  });

  it('falls back to native select and handles change events after dropdown errors', async () => {
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
        clear: jest.fn(() => {
          throw new Error('clear failed');
        }),
        enable: jest.fn(),
        destroy: jest.fn(),
      };
    };

    const { testBase, controller } = await createController();

    const dataset = buildDataset();
    const serviceMock =
      testBase.mocks.characterBuilderService
        .getAllThematicDirectionsWithConcepts;

    serviceMock.mockResolvedValueOnce(dataset);
    testBase.mocks.characterBuilderService.getCharacterConcept.mockResolvedValue(
      dataset[0].concept
    );

    await controller.initialize();

    // Trigger initial selection to set current concept before refresh
    const dropdownConfig = dropdownConfigs[0];
    await dropdownConfig.onSelectionChange('concept-1');

    // Force refresh error so dropdown error handler executes fallback
    serviceMock.mockRejectedValueOnce(new Error('network down'));

    await controller.refreshDropdown();

    const selectElement = controller._getElement('conceptSelector');
    expect(selectElement.classList.contains('native-fallback')).toBe(true);

    // Ensure option exists for manual change dispatch
    if (!selectElement.querySelector('option[value="concept-1"]')) {
      const option = document.createElement('option');
      option.value = 'concept-1';
      option.textContent = 'Concept 1';
      selectElement.appendChild(option);
    }

    selectElement.value = 'concept-1';
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();

    const conceptWrapper = document.querySelector('.concept-content-wrapper');
    expect(conceptWrapper).not.toBeNull();
    expect(
      conceptWrapper.querySelector('.concept-status').textContent.trim()
    ).toBe('Active');

    await testBase.cleanup();
  });

  it('handles invalid stored dropdown state gracefully', async () => {
    const { testBase, controller } = await createController();

    const dataset = buildDataset();
    const serviceMock =
      testBase.mocks.characterBuilderService
        .getAllThematicDirectionsWithConcepts;

    localStorage.getItem.mockReturnValueOnce('not-json');
    serviceMock.mockResolvedValue(dataset);

    await controller.initialize();

    expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
      'Failed to restore dropdown state:',
      expect.any(SyntaxError)
    );

    await testBase.cleanup();
  });

  it('logs save errors when persisting dropdown state fails', async () => {
    const { testBase, controller } = await createController();

    const dataset = buildDataset();
    const serviceMock =
      testBase.mocks.characterBuilderService
        .getAllThematicDirectionsWithConcepts;

    serviceMock.mockResolvedValue(dataset);
    await controller.initialize();

    localStorage.setItem.mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });

    const dropdownConfig = dropdownConfigs[0];
    await dropdownConfig.onSelectionChange('concept-1');

    expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
      'Failed to save dropdown state:',
      expect.any(Error)
    );

    await testBase.cleanup();
  });

  it('returns early when concept display elements are missing', async () => {
    const { testBase, controller } = await createController({
      includeConceptDisplay: false,
    });

    const dataset = buildDataset();
    const serviceMock =
      testBase.mocks.characterBuilderService
        .getAllThematicDirectionsWithConcepts;

    serviceMock.mockResolvedValue(dataset);
    testBase.mocks.characterBuilderService.getCharacterConcept.mockResolvedValue(
      dataset[0].concept
    );

    await controller.initialize();

    const dropdownConfig = dropdownConfigs[0];
    await dropdownConfig.onSelectionChange('concept-1');

    expect(document.querySelector('.concept-content-wrapper')).toBeNull();

    await testBase.cleanup();
  });

  it('renders concept metadata when concept information is available', async () => {
    const { testBase, controller } = await createController();

    const dataset = buildDataset();
    const serviceMock =
      testBase.mocks.characterBuilderService
        .getAllThematicDirectionsWithConcepts;

    serviceMock.mockResolvedValue(dataset);
    testBase.mocks.characterBuilderService.getCharacterConcept.mockResolvedValue(
      dataset[0].concept
    );

    await controller.initialize();

    const dropdownConfig = dropdownConfigs[0];
    await dropdownConfig.onSelectionChange('concept-1');

    const conceptDisplay = document.querySelector('#concept-display-content');
    expect(conceptDisplay.querySelector('.concept-status').textContent).toBe(
      'Active'
    );
    expect(conceptDisplay.querySelector('.concept-date')).not.toBeNull();
    expect(
      conceptDisplay.querySelector('.concept-direction-count')
    ).not.toBeNull();

    await testBase.cleanup();
  });

  it('restores concept selection when refresh keeps the option available', async () => {
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

    const dataset = buildDataset();
    const serviceMock =
      testBase.mocks.characterBuilderService
        .getAllThematicDirectionsWithConcepts;

    serviceMock.mockResolvedValueOnce(dataset);
    await controller.initialize();

    const dropdownConfig = dropdownConfigs[0];
    await dropdownConfig.onSelectionChange('concept-1');

    serviceMock.mockResolvedValueOnce(dataset);
    await controller.refreshDropdown();

    const selectElement = controller._getElement('conceptSelector');
    expect(selectElement.value).toBe('concept-1');

    await testBase.cleanup();
  });

  it('warns when dropdown destroy fails during cleanup', async () => {
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
        destroy: jest.fn(() => {
          throw new Error('destroy failed');
        }),
      };
    };

    const { testBase, controller } = await createController();

    const dataset = buildDataset();
    const serviceMock =
      testBase.mocks.characterBuilderService
        .getAllThematicDirectionsWithConcepts;

    serviceMock.mockResolvedValue(dataset);
    await controller.initialize();

    await controller.destroy();

    expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
      'ThematicDirectionsManagerController: Error destroying concept dropdown',
      expect.any(Error)
    );

    await testBase.cleanup();
  });

  it('reports active dropdowns as potential leaks when destroy is unavailable', async () => {
    console.warn = jest.fn();
    process.env.NODE_ENV = 'development';

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
        // intentionally omit destroy
      };
    };

    const { testBase, controller } = await createController();

    const dataset = buildDataset();
    const serviceMock =
      testBase.mocks.characterBuilderService
        .getAllThematicDirectionsWithConcepts;

    serviceMock.mockResolvedValue(dataset);
    await controller.initialize();

    await controller.destroy();

    const leakCall = testBase.mocks.logger.warn.mock.calls.find(([message]) =>
      message.includes('Potential memory leaks detected')
    );
    expect(leakCall?.[1]?.leaks).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Active concept dropdown'),
      ])
    );

    await testBase.cleanup();
  });
});
