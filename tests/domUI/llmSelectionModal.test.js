// tests/domUI/llmSelectionModal.test.js
// --- FILE START ---

import {JSDOM} from 'jsdom';
import {LlmSelectionModal} from '../../src/domUI/index.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

// Mock requestAnimationFrame for JSDOM
if (typeof global !== 'undefined' && !global.requestAnimationFrame) {
    global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
}


describe('LlmSelectionModal', () => {
    let dom;
    let mockDocument;
    let mockWindow;

    let mockLogger;
    let mockDocumentContext;
    let mockDomElementFactory;
    let mockLlmAdapter;

    let changeLlmButton;
    let modalElement;
    let llmListElement;
    let closeModalButton;
    let llmStatusMessageElement;

    beforeEach(() => {
        const html = `
            <body>
                <button id="change-llm-button">Change LLM</button>
                <div id="llm-selection-modal" style="display: none;">
                    <h2>Select LLM</h2>
                    <button id="llm-selection-modal-close-button">Close</button>
                    <ul id="llm-selection-list"></ul>
                    <div id="llm-selection-status-message" class="status-message-area"></div>
                </div>
            </body>
        `;
        dom = new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true});
        mockWindow = dom.window;
        mockDocument = dom.window.document;

        global.window = mockWindow;
        global.document = mockDocument;
        global.HTMLElement = mockWindow.HTMLElement;
        global.Event = mockWindow.Event;
        global.CustomEvent = mockWindow.CustomEvent;
        global.MouseEvent = mockWindow.MouseEvent;

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        changeLlmButton = mockDocument.getElementById('change-llm-button');
        modalElement = mockDocument.getElementById('llm-selection-modal');
        llmListElement = mockDocument.getElementById('llm-selection-list');
        closeModalButton = mockDocument.getElementById('llm-selection-modal-close-button');
        llmStatusMessageElement = mockDocument.getElementById('llm-selection-status-message');

        jest.spyOn(changeLlmButton, 'addEventListener');
        jest.spyOn(modalElement, 'addEventListener');
        jest.spyOn(closeModalButton, 'addEventListener');
        jest.spyOn(changeLlmButton, 'focus');
        jest.spyOn(closeModalButton, 'focus');


        mockDocumentContext = {
            query: jest.fn((selector) => {
                switch (selector) {
                    case '#change-llm-button':
                        return changeLlmButton;
                    case '#llm-selection-modal':
                        return modalElement;
                    case '#llm-selection-list':
                        return llmListElement;
                    case '#llm-selection-modal-close-button':
                        return closeModalButton;
                    case '#llm-selection-status-message':
                        return llmStatusMessageElement;
                    default:
                        if (typeof this !== 'undefined' && this instanceof mockWindow.HTMLElement && this.querySelector) {
                            return this.querySelector(selector);
                        }
                        return mockDocument.querySelector(selector);
                }
            }),
            create: jest.fn((tagName) => mockDocument.createElement(tagName)),
            dispatchEvent: jest.fn(),
        };

        mockDomElementFactory = new DomElementFactory(mockDocumentContext);
        jest.spyOn(mockDomElementFactory, 'create').mockImplementation((tagName, options) => {
            const el = mockDocument.createElement(tagName);
            if (options) {
                if (options.className !== undefined) {
                    el.className = options.className;
                } else if (options.cls !== undefined) {
                    el.className = options.cls;
                }

                if (options.textContent !== undefined) {
                    el.textContent = options.textContent;
                } else if (options.text !== undefined) {
                    el.textContent = options.text;
                }
                Object.keys(options).forEach(key => {
                    if (key !== 'className' && key !== 'cls' && key !== 'textContent' && key !== 'text') {
                        if (key.startsWith('data-')) {
                            el.dataset[key.substring(5)] = options[key];
                        } else {
                            el.setAttribute(key, options[key]);
                        }
                    }
                });
            }
            jest.spyOn(el, 'addEventListener');
            jest.spyOn(el, 'focus');
            return el;
        });

        mockLlmAdapter = {
            getAvailableLlmOptions: jest.fn(),
            getCurrentActiveLlmId: jest.fn(),
            setActiveLlm: jest.fn(),
        };

        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
        if (mockWindow) mockWindow.close();
        global.window = undefined;
        global.document = undefined;
        global.HTMLElement = undefined;
        global.Event = undefined;
        global.CustomEvent = undefined;
        global.MouseEvent = undefined;
    });

    describe('Constructor and Initial Listener Setup', () => {
        it('should throw an error if logger dependency is missing', () => {
            expect(() => new LlmSelectionModal({
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            }))
                .toThrow('LlmSelectionModal: Logger dependency is required.');
        });

        it('should throw an error if documentContext dependency is missing', () => {
            expect(() => new LlmSelectionModal({
                logger: mockLogger,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            }))
                .toThrow('LlmSelectionModal: DocumentContext dependency is required.');
        });

        it('should throw an error if domElementFactory dependency is missing', () => {
            expect(() => new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                llmAdapter: mockLlmAdapter
            }))
                .toThrow('LlmSelectionModal: DomElementFactory dependency is required.');
        });

        it('should throw an error if llmAdapter dependency is missing', () => {
            expect(() => new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory
            }))
                .toThrow('LlmSelectionModal: LLMAdapter dependency is required.');
        });

        it('should initialize correctly and bind DOM elements', () => {
            new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            expect(mockLogger.info).toHaveBeenCalledWith('LlmSelectionModal: Initializing...');
            expect(mockDocumentContext.query).toHaveBeenCalledWith('#change-llm-button');
            expect(mockDocumentContext.query).toHaveBeenCalledWith('#llm-selection-modal');
            expect(mockDocumentContext.query).toHaveBeenCalledWith('#llm-selection-list');
            expect(mockDocumentContext.query).toHaveBeenCalledWith('#llm-selection-modal-close-button');
            expect(mockDocumentContext.query).toHaveBeenCalledWith('#llm-selection-status-message');
            expect(mockLogger.info).toHaveBeenCalledWith('LlmSelectionModal: Initialized successfully.');
        });

        it('should log errors if essential DOM elements are not found', () => {
            const originalQuery = mockDocumentContext.query;
            mockDocumentContext.query = jest.fn().mockReturnValue(null);

            new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });

            expect(mockLogger.error).toHaveBeenCalledWith('LlmSelectionModal: Could not find #change-llm-button element.');
            expect(mockLogger.error).toHaveBeenCalledWith('LlmSelectionModal: Could not find #llm-selection-modal element.');
            expect(mockLogger.error).toHaveBeenCalledWith('LlmSelectionModal: CRITICAL - #llm-selection-list element NOT FOUND. LLM list cannot be populated.');
            expect(mockLogger.error).toHaveBeenCalledWith('LlmSelectionModal: Could not find #llm-selection-modal-close-button element.');
            expect(mockLogger.warn).toHaveBeenCalledWith('LlmSelectionModal: Could not find #llm-selection-status-message element. Status messages during LLM switch may not be displayed.');
            mockDocumentContext.query = originalQuery;
        });

        it('should attach event listener to #change-llm-button and call show() on click', () => {
            const modal = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            jest.spyOn(modal, 'show').mockImplementation(() => {
            });

            expect(changeLlmButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            const clickCallback = changeLlmButton.addEventListener.mock.calls.find(call => call[0] === 'click')[1];
            clickCallback();
            expect(modal.show).toHaveBeenCalledTimes(1);
        });

        it('should log warning if #change-llm-button is not found for listener attachment', () => {
            const tempOriginalQuery = mockDocumentContext.query;
            const originalChangeLlmButton = changeLlmButton;
            changeLlmButton = null;
            mockDocumentContext.query = jest.fn(selector => {
                if (selector === '#change-llm-button') return null;
                if (selector === '#llm-selection-modal') return modalElement;
                if (selector === '#llm-selection-list') return llmListElement;
                if (selector === '#llm-selection-modal-close-button') return closeModalButton;
                if (selector === '#llm-selection-status-message') return llmStatusMessageElement;
                return tempOriginalQuery(selector);
            });

            new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            expect(mockLogger.warn).toHaveBeenCalledWith('LlmSelectionModal: Cannot attach listener to #change-llm-button as it was not found.');

            mockDocumentContext.query = tempOriginalQuery;
            changeLlmButton = originalChangeLlmButton;
            if (changeLlmButton) jest.spyOn(changeLlmButton, 'addEventListener');
        });


        it('should attach event listener to #llm-selection-modal-close-button and call hide() on click', () => {
            const modal = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            jest.spyOn(modal, 'hide').mockImplementation(() => {
            });

            expect(closeModalButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            const clickCallback = closeModalButton.addEventListener.mock.calls.find(call => call[0] === 'click')[1];
            clickCallback();
            expect(modal.hide).toHaveBeenCalledTimes(1);
        });

        it('should log warning if #llm-selection-modal-close-button is not found for listener attachment', () => {
            const tempOriginalQuery = mockDocumentContext.query;
            const originalCloseModalButton = closeModalButton;
            closeModalButton = null;
            mockDocumentContext.query = jest.fn(selector => {
                if (selector === '#llm-selection-modal-close-button') return null;
                if (selector === '#change-llm-button') return changeLlmButton;
                if (selector === '#llm-selection-modal') return modalElement;
                if (selector === '#llm-selection-list') return llmListElement;
                if (selector === '#llm-selection-status-message') return llmStatusMessageElement;
                return tempOriginalQuery(selector);
            });

            new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            expect(mockLogger.warn).toHaveBeenCalledWith('LlmSelectionModal: Cannot attach listener to #llm-selection-modal-close-button as it was not found.');

            mockDocumentContext.query = tempOriginalQuery;
            closeModalButton = originalCloseModalButton;
            if (closeModalButton) jest.spyOn(closeModalButton, 'addEventListener');
        });

        it('should attach event listener to #llm-selection-modal for overlay click and call hide()', () => {
            const modal = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            jest.spyOn(modal, 'hide').mockImplementation(() => {
            });

            expect(modalElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            const clickCallback = modalElement.addEventListener.mock.calls.find(call => call[0] === 'click')[1];

            const mockEventOverlay = new mockWindow.MouseEvent('click');
            Object.defineProperty(mockEventOverlay, 'target', {value: modalElement, writable: false});
            clickCallback(mockEventOverlay);
            expect(modal.hide).toHaveBeenCalledTimes(1);

            modal.hide.mockClear();
            const childElement = mockDocument.createElement('div');
            modalElement.appendChild(childElement);
            const mockEventChild = new mockWindow.MouseEvent('click');
            Object.defineProperty(mockEventChild, 'target', {value: childElement, writable: false});
            clickCallback(mockEventChild);
            expect(modal.hide).not.toHaveBeenCalled();
        });

        it('should not try to attach overlay click listener if #llm-selection-modal is not found, and log error', () => {
            const tempOriginalQuery = mockDocumentContext.query;
            const originalModalElement = modalElement;
            modalElement = null;

            mockDocumentContext.query = jest.fn(selector => {
                if (selector === '#llm-selection-modal') return null;
                if (selector === '#change-llm-button') return changeLlmButton;
                if (selector === '#llm-selection-list') return llmListElement;
                if (selector === '#llm-selection-modal-close-button') return closeModalButton;
                if (selector === '#llm-selection-status-message') return llmStatusMessageElement;
                return tempOriginalQuery(selector);
            });

            new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            expect(mockLogger.error).toHaveBeenCalledWith('LlmSelectionModal: Could not find #llm-selection-modal element.');


            mockDocumentContext.query = tempOriginalQuery;
            modalElement = originalModalElement;
            if (modalElement) jest.spyOn(modalElement, 'addEventListener');
        });
    });

    describe('show() Method Tests', () => {
        let modalInstance;

        beforeEach(() => {
            modalInstance = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            if (modalElement) {
                modalElement.style.display = 'none';
                modalElement.classList.remove('visible');
            }
        });

        it('should make the modal element visible and add "visible" class', async () => {
            mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue([]);
            mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);

            await modalInstance.show();
            jest.runAllTimers();

            expect(modalElement.style.display).toBe('flex');
            expect(modalElement.classList.contains('visible')).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith('LlmSelectionModal: Modal display set to visible.');
        });

        it('should log an error and return if modalElement is not found', async () => {
            const originalQuery = mockDocumentContext.query;
            const originalModalElement = modalElement;
            modalElement = null;

            mockDocumentContext.query = jest.fn(selector => {
                if (selector === '#llm-selection-modal') return null;
                if (selector === '#change-llm-button') return changeLlmButton;
                if (selector === '#llm-selection-list') return llmListElement;
                if (selector === '#llm-selection-modal-close-button') return closeModalButton;
                if (selector === '#llm-selection-status-message') return llmStatusMessageElement;
                return originalQuery(selector);
            });

            modalInstance = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });

            await modalInstance.show();
            expect(mockLogger.error).toHaveBeenCalledWith('LlmSelectionModal: Cannot show modal, #llm-selection-modal element not found.');
            expect(mockLlmAdapter.getAvailableLlmOptions).not.toHaveBeenCalled();

            modalElement = originalModalElement;
            mockDocumentContext.query = originalQuery;
        });

        it('should clear previous status messages', async () => {
            llmStatusMessageElement.textContent = 'Old message';
            llmStatusMessageElement.className = 'status-message-area some-extra-class';
            mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue([]);
            mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);

            await modalInstance.show();
            jest.runAllTimers();

            expect(llmStatusMessageElement.textContent).toBe('');
            expect(llmStatusMessageElement.className).toBe('status-message-area');
        });

        it('should log error, show modal frame, if #llm-selection-list is not found', async () => {
            const originalQuery = mockDocumentContext.query;
            const originalLlmListElement = llmListElement;
            llmListElement = null;

            mockDocumentContext.query = jest.fn(selector => {
                if (selector === '#llm-selection-list') return null;
                if (selector === '#llm-selection-modal') return modalElement;
                if (selector === '#change-llm-button') return changeLlmButton;
                if (selector === '#llm-selection-modal-close-button') return closeModalButton;
                if (selector === '#llm-selection-status-message') return llmStatusMessageElement;
                return originalQuery(selector);
            });

            modalInstance = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });


            await modalInstance.show();
            jest.runAllTimers();

            expect(mockLogger.error).toHaveBeenCalledWith('LlmSelectionModal: #llm-selection-list element not found. Cannot populate LLM list.');
            expect(modalElement.style.display).toBe('flex');
            expect(modalElement.classList.contains('visible')).toBe(true);
            expect(mockLlmAdapter.getAvailableLlmOptions).not.toHaveBeenCalled();

            llmListElement = originalLlmListElement;
            mockDocumentContext.query = originalQuery;
        });

        it('should call adapter methods and populate list correctly', async () => {
            const mockOptions = [
                {configId: 'llm1', displayName: 'LLM One'},
                {configId: 'llm2', displayName: 'LLM Two (Active)'},
                {configId: 'llm3', displayName: 'LLM Three'},
            ];
            const activeLlmId = 'llm2';
            mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue(mockOptions);
            mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(activeLlmId);

            await modalInstance.show();
            jest.runAllTimers();

            expect(mockLlmAdapter.getAvailableLlmOptions).toHaveBeenCalledTimes(1);
            expect(mockLlmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
            expect(llmListElement.innerHTML).not.toBe('');
            expect(mockDomElementFactory.create).toHaveBeenCalledTimes(mockOptions.length);

            const items = llmListElement.querySelectorAll('li.llm-item');
            expect(items.length).toBe(mockOptions.length);

            items.forEach((item, index) => {
                expect(item.textContent).toBe(mockOptions[index].displayName);
                expect(item.dataset.llmId).toBe(mockOptions[index].configId);
                expect(item.getAttribute('role')).toBe('radio');
                const isActive = mockOptions[index].configId === activeLlmId;
                expect(item.classList.contains('selected')).toBe(isActive);
                expect(item.getAttribute('aria-checked')).toBe(String(isActive));
                expect(item.getAttribute('tabindex')).toBe(isActive ? '0' : '-1');
                expect(item.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            });

            const selectedItem = llmListElement.querySelector('li.selected[data-llm-id="llm2"]');
            expect(selectedItem).not.toBeNull();
            expect(selectedItem.focus).toHaveBeenCalled();
        });

        it('should populate list with ID if displayName is missing', async () => {
            const mockOptions = [{configId: 'llm-no-name', displayName: null}];
            mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue(mockOptions);
            mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);

            await modalInstance.show();
            jest.runAllTimers();

            const item = llmListElement.querySelector('li.llm-item');
            expect(item).not.toBeNull();
            expect(item.textContent).toBe('llm-no-name');
        });

        it('should handle empty LLM options list from adapter', async () => {
            mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue([]);
            mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);

            await modalInstance.show();
            jest.runAllTimers();

            expect(mockLogger.warn).toHaveBeenCalledWith('LlmSelectionModal: No LLM options available or list is empty.');
            expect(mockDomElementFactory.create).toHaveBeenCalledWith('li', expect.objectContaining({
                text: 'No Language Models are currently configured.',
                className: 'llm-item-message llm-empty-message'
            }));
            const messageItem = llmListElement.querySelector('li.llm-empty-message');
            expect(messageItem).not.toBeNull();
            expect(messageItem.textContent).toBe('No Language Models are currently configured.');
            expect(closeModalButton.focus).toHaveBeenCalled();
        });

        it('should handle error from getAvailableLlmOptions', async () => {
            const error = new Error('Adapter failed to get options');
            mockLlmAdapter.getAvailableLlmOptions.mockRejectedValue(error);
            mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);

            await modalInstance.show();
            jest.runAllTimers();

            expect(mockLogger.error).toHaveBeenCalledWith(`LlmSelectionModal: Error fetching LLM data from adapter for list population: ${error.message}`, {error});
            expect(mockDomElementFactory.create).toHaveBeenCalledWith('li', expect.objectContaining({
                text: `Failed to load LLM list: ${error.message}`,
                className: 'llm-item-message llm-error-message'
            }));
            const errorItem = llmListElement.querySelector('li.llm-error-message');
            expect(errorItem).not.toBeNull();
            expect(errorItem.textContent).toBe(`Failed to load LLM list: ${error.message}`);
            expect(closeModalButton.focus).toHaveBeenCalled();
        });

        it('should handle error from getCurrentActiveLlmId', async () => {
            const mockOptions = [{configId: 'llm1', displayName: 'LLM One'}];
            const error = new Error('Adapter failed to get active ID');
            mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue(mockOptions);
            mockLlmAdapter.getCurrentActiveLlmId.mockRejectedValue(error);

            await modalInstance.show();
            jest.runAllTimers();

            expect(mockLogger.error).toHaveBeenCalledWith(`LlmSelectionModal: Error fetching LLM data from adapter for list population: ${error.message}`, {error});
            const errorItem = llmListElement.querySelector('li.llm-error-message');
            expect(errorItem).not.toBeNull();
            expect(errorItem.textContent).toBe(`Failed to load LLM list: ${error.message}`);
        });

        it('should set tabindex="0" on the first item if no item is active and list is not empty', async () => {
            const mockOptions = [{configId: 'llm1', displayName: 'LLM One'}, {
                configId: 'llm2',
                displayName: 'LLM Two'
            }];
            mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue(mockOptions);
            mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);

            await modalInstance.show();
            jest.runAllTimers();

            const items = llmListElement.querySelectorAll('li.llm-item');
            expect(items.length).toBe(2);
            expect(items[0].getAttribute('tabindex')).toBe('0');
            expect(items[1].getAttribute('tabindex')).toBe('-1');
            expect(items[0].focus).toHaveBeenCalled();
        });
    });

    describe('hide() Method Tests', () => {
        let modalInstance;

        beforeEach(() => {
            modalInstance = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            if (modalElement) {
                modalElement.style.display = 'flex';
                modalElement.classList.add('visible');
            }
            if (llmStatusMessageElement) {
                llmStatusMessageElement.textContent = 'A status message';
                llmStatusMessageElement.className = 'status-message-area llm-error-message';
            }
        });

        it('should hide the modal element and remove "visible" class', () => {
            modalInstance.hide();
            expect(modalElement.classList.contains('visible')).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith('LlmSelectionModal: Modal hidden.');
        });

        it('should clear status messages when hiding', () => {
            modalInstance.hide();
            expect(llmStatusMessageElement.textContent).toBe('');
            expect(llmStatusMessageElement.className).toBe('status-message-area');
        });

        it('should return focus to the changeLlmButton if available', () => {
            modalInstance.hide();
            expect(changeLlmButton.focus).toHaveBeenCalledTimes(1);
        });

        it('should not throw if changeLlmButton is not available for focus return', () => {
            const originalQuery = mockDocumentContext.query;
            const originalChangeLlmButton = changeLlmButton;
            changeLlmButton = null;

            mockDocumentContext.query = jest.fn(selector => {
                if (selector === '#change-llm-button') return null;
                if (selector === '#llm-selection-modal') return modalElement;
                if (selector === '#llm-selection-list') return llmListElement;
                if (selector === '#llm-selection-modal-close-button') return closeModalButton;
                if (selector === '#llm-selection-status-message') return llmStatusMessageElement;
                return originalQuery(selector);
            });

            modalInstance = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            if (modalElement) modalElement.classList.add('visible');

            expect(() => modalInstance.hide()).not.toThrow();

            changeLlmButton = originalChangeLlmButton;
            mockDocumentContext.query = originalQuery;
        });

        it('should log debug message if modal was already hidden', () => {
            if (modalElement) modalElement.classList.remove('visible');
            modalInstance.hide();
            expect(mockLogger.debug).toHaveBeenCalledWith('LlmSelectionModal: hide() called, but modal was not visible or not found.');
        });

        it('should log error if modalElement is not found when hide is called', () => {
            const originalQuery = mockDocumentContext.query;
            const originalModalElement = modalElement;
            modalElement = null;

            mockDocumentContext.query = jest.fn(selector => {
                if (selector === '#llm-selection-modal') return null;
                if (selector === '#change-llm-button') return changeLlmButton;
                if (selector === '#llm-selection-list') return llmListElement;
                if (selector === '#llm-selection-modal-close-button') return closeModalButton;
                if (selector === '#llm-selection-status-message') return llmStatusMessageElement;
                return originalQuery(selector);
            });
            modalInstance = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });

            modalInstance.hide();
            expect(mockLogger.error).toHaveBeenCalledWith('LlmSelectionModal: Cannot hide modal, #llm-selection-modal element not found.');

            modalElement = originalModalElement;
            mockDocumentContext.query = originalQuery;
        });
    });

    describe('LLM Item Click Logic (#handleLlmSelection)', () => {
        let modalInstance;
        const mockOptions = [
            {configId: 'llm1', displayName: 'LLM One'},
            {configId: 'llm2', displayName: 'LLM Two (Currently Active)'},
            {configId: 'llm3', displayName: 'LLM Three'},
        ];
        const initialActiveLlmId = 'llm2';

        async function setupAndShowModal() {
            mockLlmAdapter.getAvailableLlmOptions.mockResolvedValue(mockOptions);
            mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(initialActiveLlmId);
            await modalInstance.show();
            jest.runAllTimers();
        }

        beforeEach(() => {
            modalInstance = new LlmSelectionModal({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                domElementFactory: mockDomElementFactory,
                llmAdapter: mockLlmAdapter
            });
            jest.spyOn(modalInstance, 'hide');
        });

        // ***** CORRECTED HERE *****
        async function simulateClickOnItemById(llmId) {
            const itemToClick = llmListElement.querySelector(`[data-llm-id="${llmId}"]`);
            // CORRECTED: Removed custom message string from toBeNull
            expect(itemToClick).not.toBeNull();

            const addEventListenerCalls = itemToClick.addEventListener.mock.calls;
            const clickHandlerCall = addEventListenerCalls.find(call => call[0] === 'click');
            // CORRECTED: Removed custom message string from toBeDefined
            expect(clickHandlerCall).toBeDefined();
            const handler = clickHandlerCall[1];

            const mockEvent = new mockWindow.MouseEvent('click', {bubbles: true, cancelable: true});
            Object.defineProperty(mockEvent, 'currentTarget', {value: itemToClick, writable: false});

            await handler(mockEvent);
            jest.runAllTimers();
        }


        it('should call setActiveLlm with correct ID and hide modal on success', async () => {
            await setupAndShowModal();
            const itemToClickId = 'llm1';
            mockLlmAdapter.setActiveLlm.mockResolvedValue(true);

            await simulateClickOnItemById(itemToClickId);

            expect(mockLlmAdapter.setActiveLlm).toHaveBeenCalledWith(itemToClickId);
            expect(modalInstance.hide).toHaveBeenCalledTimes(1);
            expect(llmStatusMessageElement.textContent).toBe('');


            const itemClickedElement = llmListElement.querySelector(`[data-llm-id="${itemToClickId}"]`);
            expect(itemClickedElement.classList.contains('selected')).toBe(true);
            expect(itemClickedElement.getAttribute('aria-checked')).toBe('true');
            expect(itemClickedElement.getAttribute('tabindex')).toBe('0');

            const initiallyActiveElement = llmListElement.querySelector(`[data-llm-id="${initialActiveLlmId}"]`);
            expect(initiallyActiveElement.classList.contains('selected')).toBe(false);
            expect(initiallyActiveElement.getAttribute('aria-checked')).toBe('false');
            expect(initiallyActiveElement.getAttribute('tabindex')).toBe('-1');
        });

        it('should show error, keep modal open on setActiveLlm failure (returns false)', async () => {
            await setupAndShowModal();
            const itemToClickId = 'llm1';
            mockLlmAdapter.setActiveLlm.mockResolvedValue(false);

            const itemToClickElement = llmListElement.querySelector(`[data-llm-id="${itemToClickId}"]`);
            expect(itemToClickElement).not.toBeNull();

            await simulateClickOnItemById(itemToClickId);

            expect(mockLlmAdapter.setActiveLlm).toHaveBeenCalledWith(itemToClickId);
            expect(modalInstance.hide).not.toHaveBeenCalled();
            expect(llmStatusMessageElement.textContent).toBe(`Failed to switch to ${itemToClickElement.textContent}. The LLM may be unavailable or the selection invalid.`);
            expect(llmStatusMessageElement.classList.contains('llm-error-message')).toBe(true);
            expect(itemToClickElement.classList.contains('selected')).toBe(true);
        });

        it('should show error, keep modal open on setActiveLlm exception', async () => {
            await setupAndShowModal();
            const itemToClickId = 'llm3';
            const error = new Error('Network Error');
            mockLlmAdapter.setActiveLlm.mockRejectedValue(error);

            const itemToClickElement = llmListElement.querySelector(`[data-llm-id="${itemToClickId}"]`);
            expect(itemToClickElement).not.toBeNull();

            await simulateClickOnItemById(itemToClickId);

            expect(mockLlmAdapter.setActiveLlm).toHaveBeenCalledWith(itemToClickId);
            expect(modalInstance.hide).not.toHaveBeenCalled();
            expect(llmStatusMessageElement.textContent).toBe(`An error occurred while trying to switch to ${itemToClickElement.textContent}: ${error.message}`);
            expect(llmStatusMessageElement.classList.contains('llm-error-message')).toBe(true);
            expect(itemToClickElement.classList.contains('selected')).toBe(true);
        });

        it('should show error if clicked item has no llmId in dataset', async () => {
            await setupAndShowModal();
            const itemToModifyId = 'llm1';
            const itemToModifyElement = llmListElement.querySelector(`[data-llm-id="${itemToModifyId}"]`);
            expect(itemToModifyElement).not.toBeNull();

            delete itemToModifyElement.dataset.llmId;

            const clickHandlerCall = itemToModifyElement.addEventListener.mock.calls.find(call => call[0] === 'click');
            expect(clickHandlerCall).toBeDefined();
            const handler = clickHandlerCall[1];
            const mockEvent = new mockWindow.MouseEvent('click', {bubbles: true, cancelable: true});
            Object.defineProperty(mockEvent, 'currentTarget', {value: itemToModifyElement, writable: false});

            await handler(mockEvent);
            jest.runAllTimers();

            expect(mockLlmAdapter.setActiveLlm).not.toHaveBeenCalled();
            expect(modalInstance.hide).not.toHaveBeenCalled();
            expect(llmStatusMessageElement.textContent).toBe('Internal error: LLM ID not found for selection.');
            expect(llmStatusMessageElement.classList.contains('llm-error-message')).toBe(true);
        });


        it('should correctly update visual selection for all items on click and success', async () => {
            await setupAndShowModal();
            const itemToClickId = 'llm1';
            mockLlmAdapter.setActiveLlm.mockResolvedValue(true);

            await simulateClickOnItemById(itemToClickId);

            const itemClickedElement = llmListElement.querySelector(`[data-llm-id="${itemToClickId}"]`);
            const initiallyActiveElement = llmListElement.querySelector(`[data-llm-id="${initialActiveLlmId}"]`);
            const otherItemElement = llmListElement.querySelector(`[data-llm-id="llm3"]`);

            expect(itemClickedElement.classList.contains('selected')).toBe(true);
            expect(itemClickedElement.getAttribute('aria-checked')).toBe('true');
            expect(itemClickedElement.getAttribute('tabindex')).toBe('0');

            expect(initiallyActiveElement.classList.contains('selected')).toBe(false);
            expect(initiallyActiveElement.getAttribute('aria-checked')).toBe('false');
            expect(initiallyActiveElement.getAttribute('tabindex')).toBe('-1');

            expect(otherItemElement.classList.contains('selected')).toBe(false);
            expect(otherItemElement.getAttribute('aria-checked')).toBe('false');
            expect(otherItemElement.getAttribute('tabindex')).toBe('-1');

            expect(modalInstance.hide).toHaveBeenCalled();
        });
    });
});

// --- FILE END ---