// tests/domUI/selectableListDisplayComponent.test.js

import { JSDOM } from 'jsdom';
import { SelectableListDisplayComponent } from '../../../src/domUI';
import * as listNavigationUtils from '../../../src/utils/listNavigationUtils.js';

// Mock data
const MOCK_DATA = [
  { id: '1', name: 'Item One' },
  { id: '2', name: 'Item Two' },
  { id: '3', name: 'Item Three' },
];

// Mocks for dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockValidatedEventDispatcher = {
  dispatch: jest.fn(),
  subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
};

/**
 * A concrete implementation of the abstract BaseListDisplayComponent for testing.
 *
 * @class TestableSelectableListComponent
 */
class TestableSelectableListComponent extends SelectableListDisplayComponent {
  _getListItemsData() {
    return MOCK_DATA;
  }

  _renderListItem(itemData) {
    const li = this.documentContext.create('li');
    li.textContent = itemData.name;
    li.dataset.id = itemData.id;
    li.id = `item-${itemData.id}`;
    li.setAttribute('role', 'radio');
    return li;
  }

  _getEmptyListMessage() {
    return 'The list is empty.';
  }

  // Expose protected methods for testing
  getSelectedItemData() {
    return this.selectedItemData;
  }

  getCurrentListData() {
    return this.currentListData;
  }

  getArrowKeyHandler() {
    return this._arrowKeyHandler;
  }
}

describe('SelectableListDisplayComponent', () => {
  let dom;
  let document;
  let container;
  let component;
  let mockDocumentContext;

  // Set up the DOM and component before each test
  beforeEach(async () => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><ul id="list-container"></ul></body></html>',
      {
        url: 'http://localhost',
      }
    );
    document = dom.window.document;
    container = document.getElementById('list-container');

    mockDocumentContext = {
      query: (selector) => document.querySelector(selector),
      queryAll: (selector) => document.querySelectorAll(selector),
      create: (tag) => document.createElement(tag),
      getDocument: () => document,
    };

    const params = {
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig: { listContainerElement: '#list-container' },
      datasetKey: 'id',
      autoRefresh: false, // *** FIX: Disable auto-refresh
    };

    component = new TestableSelectableListComponent(params);
    await component.refreshList(); // *** FIX: Manually trigger and await rendering
  });

  afterEach(() => {
    component.dispose();
    jest.clearAllMocks();
  });

  // These constructor tests don't need the async setup, but are fine here.
  describe('Constructor', () => {
    test('should throw an error if datasetKey is missing', () => {
      expect(
        () =>
          new SelectableListDisplayComponent({
            logger: mockLogger,
            documentContext: mockDocumentContext,
          })
      ).toThrow(
        `[SelectableListDisplayComponent] 'datasetKey' is required and must be a string.`
      );
    });

    test('should throw an error if datasetKey is not a string', () => {
      expect(
        () =>
          new SelectableListDisplayComponent({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            datasetKey: 123,
          })
      ).toThrow(
        `[SelectableListDisplayComponent] 'datasetKey' is required and must be a string.`
      );
    });

    test('should initialize successfully with valid parameters', () => {
      const instance = new SelectableListDisplayComponent({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        elementsConfig: { listContainerElement: '#list-container' },
        datasetKey: 'id',
        autoRefresh: false,
      });
      expect(instance).toBeInstanceOf(SelectableListDisplayComponent);
    });

    test('constructor should throw if listContainerElement is not found in DOM', () => {
      const badContext = { ...mockDocumentContext, query: () => null };
      expect(
        () =>
          new SelectableListDisplayComponent({
            logger: mockLogger,
            documentContext: badContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            elementsConfig: { listContainerElement: '#nonexistent' },
            datasetKey: 'id',
          })
      ).toThrow(
        /'listContainerElement' is not defined or not found in the DOM/
      );
    });
  });

  describe('Rendering and Selection', () => {
    test('should render all list items correctly', () => {
      const items = container.querySelectorAll('li');
      expect(items.length).toBe(MOCK_DATA.length);
      expect(items[0].textContent).toBe('Item One');
      expect(items[1].dataset.id).toBe('2');
    });

    test('should handle click events to select an item', () => {
      const itemToSelect = container.querySelector('#item-2');
      const spy = jest.spyOn(itemToSelect, 'focus');

      // Simulate click
      itemToSelect.dispatchEvent(
        new dom.window.MouseEvent('click', { bubbles: true })
      );

      expect(component.getSelectedItemData()).toBe(MOCK_DATA[1]);
      expect(itemToSelect.classList.contains('selected')).toBe(true);
      expect(itemToSelect.getAttribute('aria-checked')).toBe('true');
      expect(spy).toHaveBeenCalled();
    });

    test('should change selection when a different item is clicked', () => {
      const firstItem = container.querySelector('#item-1');
      const secondItem = container.querySelector('#item-2');

      // First click
      firstItem.dispatchEvent(
        new dom.window.MouseEvent('click', { bubbles: true })
      );
      expect(component.getSelectedItemData()).toBe(MOCK_DATA[0]);
      expect(firstItem.classList.contains('selected')).toBe(true);
      expect(secondItem.classList.contains('selected')).toBe(false);

      // Second click
      secondItem.dispatchEvent(
        new dom.window.MouseEvent('click', { bubbles: true })
      );
      expect(component.getSelectedItemData()).toBe(MOCK_DATA[1]);
      expect(firstItem.classList.contains('selected')).toBe(false);
      expect(secondItem.classList.contains('selected')).toBe(true);
    });
  });

  describe('Keyboard Navigation', () => {
    let mockRadioNavHandler;

    beforeEach(() => {
      mockRadioNavHandler = jest.fn();
      // Spy on the setup utility to see if it's called correctly
      jest
        .spyOn(listNavigationUtils, 'setupRadioListNavigation')
        .mockImplementation(() => mockRadioNavHandler);

      // Re-render to apply the spy
      return component.refreshList();
    });

    test('should set up keyboard navigation on render', () => {
      expect(listNavigationUtils.setupRadioListNavigation).toHaveBeenCalledWith(
        container,
        '[role="radio"]',
        'id',
        expect.any(Function)
      );
      expect(component.getArrowKeyHandler()).toBe(mockRadioNavHandler);
    });

    test('should trigger the arrow key navigation handler on keydown', () => {
      const items = container.querySelectorAll('li');
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
      });
      // Dispatch from an item, as this would be the target in a real scenario
      items[0].dispatchEvent(event);
      expect(mockRadioNavHandler).toHaveBeenCalledWith(event);
    });

    test('should select an item when navigation callback is invoked', () => {
      const navCallback = jest.spyOn(
        listNavigationUtils,
        'setupRadioListNavigation'
      ).mock.calls[0][3];
      const itemToSelect = container.querySelector('#item-3');
      const spy = jest.spyOn(component, '_selectItem');

      navCallback(itemToSelect, '3');

      expect(spy).toHaveBeenCalledWith(itemToSelect, MOCK_DATA[2]);
    });

    test('should select focused item on "Enter" key press', () => {
      const itemToSelect = container.querySelector('#item-2');
      itemToSelect.focus(); // Set focus to simulate user navigation
      const spy = jest.spyOn(component, '_selectItem');

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      // Dispatch event from the item itself
      itemToSelect.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(itemToSelect, MOCK_DATA[1]);
    });

    test('should select focused item on " " (Space) key press', () => {
      const itemToSelect = container.querySelector('#item-1');
      itemToSelect.focus();
      const spy = jest.spyOn(component, '_selectItem');

      const event = new dom.window.KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
      });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      // Dispatch event from the item itself
      itemToSelect.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(itemToSelect, MOCK_DATA[0]);
    });
  });

  describe('Dispose', () => {
    test('should clear selection and list data on dispose', () => {
      const itemToSelect = container.querySelector('#item-2');
      itemToSelect.dispatchEvent(
        new dom.window.MouseEvent('click', { bubbles: true })
      );

      expect(component.getSelectedItemData()).not.toBeNull();
      expect(component.getCurrentListData().length).toBe(MOCK_DATA.length);

      component.dispose();

      expect(component.getSelectedItemData()).toBeNull();
      expect(component.getCurrentListData().length).toBe(0);
    });

    test('should remove keydown listener on dispose', () => {
      const spy = jest.spyOn(container, 'removeEventListener');
      component.dispose();
      // The base class handles the removal, so we check if it was called.
      // We expect it to be called for 'keydown'.
      expect(spy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        undefined
      );
    });
  });
});
