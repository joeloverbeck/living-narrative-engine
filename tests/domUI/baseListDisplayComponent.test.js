// tests/domUI/baseListDisplayComponent.test.js

import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { BaseListDisplayComponent } from '../../src/domUI/baseListDisplayComponent.js';
import { DomUtils } from '../../src/domUI/domUtils.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import { BoundDomRendererBase } from '../../src/domUI/boundDomRendererBase.js'; // For spyOn prototype

// Mock DomUtils
jest.mock('../../src/domUI/domUtils.js', () => ({
  DomUtils: {
    clearElement: jest.fn(),
  },
}));

// Concrete subclass for testing
class TestListDisplayComponent extends BaseListDisplayComponent {
  constructor(deps) {
    super(deps);
    this._getListItemsData = jest.fn();
    this._renderListItem = jest.fn();
    this._getEmptyListMessage = jest.fn();
    this._onListRendered = jest.fn(); // Make it a jest.fn to track calls
  }

  // Mock implementations will be set directly on the instance in tests
}

describe('BaseListDisplayComponent', () => {
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockDomElementFactory;
  let listContainerElement;
  let dom;
  let mockWindow; // Added

  beforeEach(() => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><div id="list-container"></div></body></html>'
    );
    mockWindow = dom.window; // Added
    const mockDocument = mockWindow.document; // Changed to use mockWindow

    // ---- START Global Setup ----
    global.window = mockWindow;
    global.document = mockDocument;
    global.HTMLElement = mockWindow.HTMLElement;
    global.Document = mockWindow.Document; // Explicitly set Document
    // ---- END Global Setup ----

    listContainerElement = mockDocument.getElementById('list-container');

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockDocumentContext = new DocumentContext(mockDocument);
    jest.spyOn(mockDocumentContext, 'query');

    mockValidatedEventDispatcher = {
      subscribe: jest.fn(),
      dispatchValidated: jest.fn(),
    };
    mockDomElementFactory = new DomElementFactory(mockDocumentContext);
    jest.spyOn(mockDomElementFactory, 'p');
    jest.spyOn(mockDomElementFactory, 'create');

    // Reset DomUtils mocks
    DomUtils.clearElement.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // ---- START Global Cleanup ----
    if (mockWindow) mockWindow.close();
    global.window = undefined;
    global.document = undefined;
    global.HTMLElement = undefined;
    global.Document = undefined;
    // ---- END Global Cleanup ----
  });

  const createInstance = (elementsConfigOverrides = {}) => {
    const elementsConfig = {
      listContainerElement: '#list-container',
      ...elementsConfigOverrides,
    };
    return new TestListDisplayComponent({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
      domElementFactory: mockDomElementFactory,
    });
  };

  it('should throw an error if listContainerElement is not found in elementsConfig during construction', () => {
    // Temporarily mock query to simulate element not found for this specific test case
    const originalQuery = mockDocumentContext.query;
    mockDocumentContext.query = jest.fn((selector) => {
      if (selector === '#list-container-missing') return null;
      // For other selectors, or if not '#list-container-missing', it might try original logic or what spy does
      // To be safe, let original logic run for existing selectors
      return originalQuery.call(mockDocumentContext, selector);
    });

    expect(() =>
      createInstance({ listContainerElement: '#list-container-missing' })
    ).toThrow("'listContainerElement' is not defined or not found in the DOM.");

    mockDocumentContext.query = originalQuery; // Restore original spy wrapper
  });

  it('should call abstract methods if they are not implemented by subclass (and throw)', () => {
    class BadSubclass extends BaseListDisplayComponent {
      constructor(deps) {
        super(deps);
      }

      // Missing implementations
    }

    const instance = new BadSubclass({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig: { listContainerElement: '#list-container' }, // Correct dependencyInjection
      domElementFactory: mockDomElementFactory,
    });

    expect(() => instance._getListItemsData()).toThrow(
      'Abstract method _getListItemsData() not implemented.'
    );
    expect(() => instance._renderListItem({}, 0, [])).toThrow(
      'Abstract method _renderListItem() not implemented.'
    );
    expect(() => instance._getEmptyListMessage()).toThrow(
      'Abstract method _getEmptyListMessage() not implemented.'
    );
  });

  describe('renderList()', () => {
    let instance;

    beforeEach(() => {
      instance = createInstance();
    });

    it('should log an error and return if listContainerElement is not available', async () => {
      instance.elements.listContainerElement = null; // Simulate it being removed post-construction
      await instance.renderList();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Cannot render list: 'listContainerElement' is not available."
        )
      );
      expect(instance._getListItemsData).not.toHaveBeenCalled();
    });

    it('should clear the list container using DomUtils.clearElement', async () => {
      instance._getListItemsData.mockResolvedValue([]);
      instance._getEmptyListMessage.mockReturnValue('No items.');

      await instance.renderList();

      expect(DomUtils.clearElement).toHaveBeenCalledWith(listContainerElement);
    });

    describe('Empty List Handling', () => {
      it('should call _getEmptyListMessage and append its string result as a paragraph', async () => {
        instance._getListItemsData.mockResolvedValue([]);
        const emptyMsg = 'The list is quite empty!';
        instance._getEmptyListMessage.mockReturnValue(emptyMsg);

        const mockParagraph = dom.window.document.createElement('p');
        mockParagraph.textContent = emptyMsg;
        mockDomElementFactory.p.mockReturnValue(mockParagraph);

        await instance.renderList();

        expect(instance._getEmptyListMessage).toHaveBeenCalledTimes(1);
        expect(mockDomElementFactory.p).toHaveBeenCalledWith(
          'empty-list-message',
          emptyMsg
        );
        expect(listContainerElement.innerHTML).toBe(
          '<p>The list is quite empty!</p>'
        );
        expect(instance._onListRendered).toHaveBeenCalledWith(
          expect.arrayContaining([]),
          listContainerElement
        );
      });

      it('should append HTMLElement result from _getEmptyListMessage directly', async () => {
        instance._getListItemsData.mockResolvedValue(null); // Also tests null data
        const emptyElement = dom.window.document.createElement('div');
        emptyElement.id = 'custom-empty-msg';
        emptyElement.textContent = 'No data here.';
        instance._getEmptyListMessage.mockReturnValue(emptyElement);

        await instance.renderList();

        expect(listContainerElement.firstChild).toBe(emptyElement);
        expect(instance._onListRendered).toHaveBeenCalledWith(
          null,
          listContainerElement
        );
      });

      it('should handle if _getEmptyListMessage returns invalid type and use fallback', async () => {
        instance._getListItemsData.mockResolvedValue([]);
        instance._getEmptyListMessage.mockReturnValue(123); // Invalid type

        const mockFallbackParagraph = dom.window.document.createElement('p');
        mockFallbackParagraph.textContent = 'List is empty.';
        mockDomElementFactory.p.mockReturnValue(mockFallbackParagraph);

        await instance.renderList();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            '_getEmptyListMessage() returned an invalid type'
          ),
          expect.any(Object)
        );
        expect(listContainerElement.textContent).toBe('List is empty.');
      });

      it('should handle if domElementFactory is not available for string empty message', async () => {
        instance = new TestListDisplayComponent({
          // Recreate instance without domElementFactory
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          elementsConfig: { listContainerElement: '#list-container' },
          // domElementFactory is omitted
        });
        instance._getListItemsData.mockResolvedValue([]); // Ensure instance methods are mocked again
        instance._renderListItem = jest.fn();
        instance._getEmptyListMessage = jest.fn();
        instance._onListRendered = jest.fn();

        const emptyMsg = 'No factory, plain text.';
        instance._getEmptyListMessage.mockReturnValue(emptyMsg);

        await instance.renderList();
        expect(listContainerElement.textContent).toBe(emptyMsg);
      });
    });

    describe('Populating List with Items', () => {
      const sampleData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      beforeEach(() => {
        instance._getListItemsData.mockResolvedValue(sampleData);
      });

      it('should call _renderListItem for each item and append valid HTMLElement results', async () => {
        const mockItemElements = sampleData.map((item) => {
          const li = dom.window.document.createElement('li');
          li.textContent = item.name;
          return li;
        });
        instance._renderListItem
          .mockImplementationOnce(() => mockItemElements[0])
          .mockImplementationOnce(() => mockItemElements[1]);

        await instance.renderList();

        expect(instance._renderListItem).toHaveBeenCalledTimes(
          sampleData.length
        );
        expect(instance._renderListItem).toHaveBeenCalledWith(
          sampleData[0],
          0,
          sampleData
        );
        expect(instance._renderListItem).toHaveBeenCalledWith(
          sampleData[1],
          1,
          sampleData
        );
        expect(listContainerElement.children.length).toBe(sampleData.length);
        expect(listContainerElement.children[0]).toBe(mockItemElements[0]);
        expect(listContainerElement.children[1]).toBe(mockItemElements[1]);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining(
            `Rendered ${sampleData.length} out of ${sampleData.length} items`
          )
        );
        expect(instance._onListRendered).toHaveBeenCalledWith(
          sampleData,
          listContainerElement
        );
      });

      it('should handle _renderListItem returning null by skipping the item', async () => {
        const mockItemElement = dom.window.document.createElement('li');
        mockItemElement.textContent = sampleData[1].name;
        instance._renderListItem
          .mockReturnValueOnce(null) // Skip first item
          .mockReturnValueOnce(mockItemElement);

        await instance.renderList();

        expect(listContainerElement.children.length).toBe(1);
        expect(listContainerElement.children[0]).toBe(mockItemElement);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining(
            `Rendered 1 out of ${sampleData.length} items`
          )
        );
      });

      it('should log warning if _renderListItem returns non-HTMLElement and non-null', async () => {
        instance._renderListItem
          .mockReturnValueOnce('not an element') // Invalid return
          .mockReturnValueOnce(dom.window.document.createElement('li'));

        await instance.renderList();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            '_renderListItem for item at index 0 did not return an HTMLElement or null'
          ),
          expect.anything()
        );
        expect(listContainerElement.children.length).toBe(1); // Only the valid element
      });

      it('should log error and continue if _renderListItem throws an error', async () => {
        const error = new Error('Render item failed');
        const mockItemElement = dom.window.document.createElement('li');
        mockItemElement.textContent = sampleData[1].name;
        instance._renderListItem
          .mockImplementationOnce(() => {
            throw error;
          })
          .mockReturnValueOnce(mockItemElement);

        await instance.renderList();

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Error in _renderListItem for item at index 0:'
          ),
          error,
          expect.anything()
        );
        expect(listContainerElement.children.length).toBe(1); // Second item should still render
      });
    });

    it('should handle asynchronous _getListItemsData', async () => {
      const asyncData = [{ id: 3, name: 'Async Item' }];
      instance._getListItemsData.mockReturnValue(
        new Promise((resolve) => setTimeout(() => resolve(asyncData), 0))
      ); // Use 0 for faster test
      const mockLi = dom.window.document.createElement('li');
      mockLi.textContent = asyncData[0].name;
      instance._renderListItem.mockReturnValue(mockLi);

      const renderPromise = instance.renderList();
      // DOM might be cleared synchronously
      // await jest.runAllTimersAsync(); // For Promises and timers
      await renderPromise;

      expect(instance._getListItemsData).toHaveBeenCalledTimes(1);
      expect(listContainerElement.children.length).toBe(1);
      expect(listContainerElement.children[0]).toBe(mockLi);
      expect(instance._onListRendered).toHaveBeenCalledWith(
        asyncData,
        listContainerElement
      );
    });

    it('should handle _getListItemsData throwing an error', async () => {
      const error = new Error('Failed to fetch data');
      instance._getListItemsData.mockRejectedValue(error);
      const mockErrorParagraph = dom.window.document.createElement('p');
      mockErrorParagraph.textContent = 'Error loading list data.';
      mockDomElementFactory.p.mockReturnValue(mockErrorParagraph);

      await instance.renderList();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching list items data'),
        error
      );
      expect(DomUtils.clearElement).toHaveBeenCalledWith(listContainerElement);
      expect(listContainerElement.textContent).toBe('Error loading list data.');
      expect(instance._onListRendered).toHaveBeenCalledWith(
        null,
        listContainerElement
      );
    });

    it('should call _onListRendered with itemsData and container after populating', async () => {
      const data = [{ id: 1 }];
      instance._getListItemsData.mockResolvedValue(data);
      instance._renderListItem.mockReturnValue(
        dom.window.document.createElement('div')
      );

      await instance.renderList();
      expect(instance._onListRendered).toHaveBeenCalledWith(
        data,
        listContainerElement
      );
    });

    it('should call _onListRendered even if _getListItemsData returns empty', async () => {
      instance._getListItemsData.mockResolvedValue([]);
      instance._getEmptyListMessage.mockReturnValue('Empty');
      await instance.renderList();
      expect(instance._onListRendered).toHaveBeenCalledWith(
        [],
        listContainerElement
      );
    });

    it('should gracefully handle errors in _onListRendered', async () => {
      instance._getListItemsData.mockResolvedValue([]);
      instance._getEmptyListMessage.mockReturnValue('Empty');
      const onRenderedError = new Error('Error in onListRendered');
      instance._onListRendered.mockImplementation(() => {
        throw onRenderedError;
      });

      await instance.renderList();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in _onListRendered hook:'),
        onRenderedError
      );
    });
  });

  describe('refreshList()', () => {
    it('should call renderList and return its promise', async () => {
      const instance = createInstance();
      const mockRenderListPromise = Promise.resolve();
      // Spy on the instance's renderList method
      jest.spyOn(instance, 'renderList').mockReturnValue(mockRenderListPromise);

      const result = instance.refreshList();

      expect(instance.renderList).toHaveBeenCalledTimes(1);
      await expect(result).resolves.toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('refreshList() called, invoking renderList().')
      );
    });
  });

  describe('dispose()', () => {
    it('should call super.dispose()', () => {
      const instance = createInstance();
      // Need to spy on the prototype of the actual base class, not the mock if one exists
      const superDisposeSpy = jest.spyOn(
        BoundDomRendererBase.prototype,
        'dispose'
      );
      instance.dispose();
      expect(superDisposeSpy).toHaveBeenCalledTimes(1);
      superDisposeSpy.mockRestore(); // Important to restore
    });
  });
});
