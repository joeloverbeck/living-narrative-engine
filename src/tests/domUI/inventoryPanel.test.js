// src/tests/domUI/inventoryPanel.test.js
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {InventoryPanel} from '../../domUI/index.js'; // Adjust path as necessary

// --- Mock Dependencies ---

const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockDocumentContext = {
    query: jest.fn(),
    create: jest.fn(), // Needed if DomElementFactory is not fully mocked
};

const mockValidatedEventDispatcher = {
    subscribe: jest.fn(),
    dispatchValidated: jest.fn().mockResolvedValue(true), // Default to successful dispatch
    // Add unsubscribe mock if needed for dispose testing
};

// Mock DomElementFactory instance methods - will be configured per test where needed
const mockDomElementFactoryInstance = {
    div: jest.fn(),
    ul: jest.fn(),
    li: jest.fn(),
    h3: jest.fn(),
    button: jest.fn(),
    span: jest.fn(),
    img: jest.fn(),
    create: jest.fn(), // Mock generic create if used
};

// --- Mock DOM Element Helpers ---

// Simple mock element factory (Assume previous version with corrections is used)
const createMockElement = (tagName = 'DIV', id = '', classList = []) => {
    const classes = new Set(classList);
    const dataset = {};
    const children = [];
    let textContent = '';
    let parentNode = null;
    const eventListeners = {}; // Store listeners by type

    const element = {
        tagName: tagName.toUpperCase(),
        nodeType: 1, // ELEMENT_NODE
        id: id,
        classList: {
            add: jest.fn((...cls) => cls.forEach(c => c && classes.add(c))),
            remove: jest.fn((...cls) => cls.forEach(c => c && classes.delete(c))),
            contains: jest.fn((cls) => classes.has(cls)),
            _values: () => Array.from(classes), // Helper for assertions
        },
        dataset: dataset,
        appendChild: jest.fn((child) => {
            if (child) {
                children.push(child);
                child.parentNode = element; // Set parent relationship
            }
        }),
        removeChild: jest.fn((child) => {
            const index = children.indexOf(child);
            if (index > -1) {
                children.splice(index, 1);
                if (child) child.parentNode = null; // Remove parent relationship
            }
            return child;
        }),
        addEventListener: jest.fn((type, listener) => {
            if (!eventListeners[type]) {
                eventListeners[type] = [];
            }
            eventListeners[type].push(listener);
        }),
        removeEventListener: jest.fn((type, listener) => { /* Implementation if needed */
        }),
        // Helper to simulate click
        _simulateClick: async (eventData = {}) => {
            const event = {target: element, stopPropagation: jest.fn(), ...eventData};
            if (eventListeners['click']) {
                for (const listener of eventListeners['click']) {
                    const result = listener(event);
                    if (result instanceof Promise) {
                        await result;
                    }
                }
            }
            if (element.onclick) {
                const result = element.onclick(event);
                if (result instanceof Promise) {
                    await result;
                }
            }
        },
        _getChildren: () => children,
        get textContent() {
            return textContent;
        },
        set textContent(value) {
            textContent = String(value);
            if (children) children.length = 0;
        },
        get innerHTML() {
            let html = '';
            children.forEach(child => {
                if (child.nodeType === 3) {
                    html += child.textContent;
                } else if (child.outerHTML) {
                    html += child.outerHTML;
                } else {
                    const tag = child.tagName ? child.tagName.toLowerCase() : 'unknown';
                    html += `<${tag}>${child.innerHTML || child.textContent || ''}</${tag}>`;
                }
            });
            return html;
        },
        set innerHTML(value) {
            if (children) children.length = 0;
            textContent = '';
            if (value !== '') {
                const textNode = {nodeType: 3, textContent: value};
                children.push(textNode);
            }
        },
        get parentNode() {
            return parentNode;
        },
        set parentNode(value) {
            parentNode = value;
        },
        attributes: {},
        setAttribute: jest.fn((name, value) => {
            element.attributes[name] = value;
        }),
        getAttribute: jest.fn((name) => element.attributes[name]),
        ownerDocument: {createElement: mockDocumentContext.create},
        src: '', alt: '', title: '', style: {}, onclick: null,
        get outerHTML() {
            const tag = tagName.toLowerCase();
            const attrs = Object.entries(element.attributes).map(([k, v]) => `${k}="${v}"`).join(' ');
            return `<${tag}${attrs ? ' ' + attrs : ''}>${element.innerHTML}</${tag}>`;
        }
    };
    return element;
};


// --- Test Suite ---

describe('InventoryPanel', () => {
    let mockContainerElement;
    let mockPanelElement;
    let mockListElement;
    let mockGameContainer;
    let subscriptions;

    // Function to reset mocks to default behavior before each test
    const resetFactoryMocks = () => {
        mockPanelElement = createMockElement('DIV', 'inventory-panel', ['hidden']);
        mockListElement = createMockElement('UL', 'inventory-list');
        mockDomElementFactoryInstance.div.mockReturnValue(mockPanelElement);
        mockDomElementFactoryInstance.ul.mockReturnValue(mockListElement);
        mockDomElementFactoryInstance.h3.mockReturnValue(createMockElement('H3'));
        mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
            const btn = createMockElement('BUTTON');
            btn.textContent = text;
            if (cls) btn.classList.add(...(Array.isArray(cls) ? cls : cls.split(' ')));
            return btn;
        });
        mockDomElementFactoryInstance.li.mockImplementation((cls, text) => {
            const li = createMockElement('LI');
            if (cls) li.classList.add(...(Array.isArray(cls) ? cls : cls.split(' ')));
            if (text !== undefined) li.textContent = text;
            return li;
        });
        mockDomElementFactoryInstance.span.mockImplementation((cls, text) => {
            const span = createMockElement('SPAN');
            if (cls) span.classList.add(...(Array.isArray(cls) ? cls : cls.split(' ')));
            if (text !== undefined) span.textContent = text;
            return span;
        });
        mockDomElementFactoryInstance.img.mockImplementation((src, alt, cls) => {
            const img = createMockElement('IMG');
            img.src = src;
            img.alt = alt;
            if (cls) img.classList.add(...(Array.isArray(cls) ? cls : cls.split(' ')));
            return img;
        });
        mockDomElementFactoryInstance.create.mockImplementation((tag, options = {}) => {
            const el = createMockElement(tag, options.id);
            if (options.cls) el.classList.add(...(Array.isArray(options.cls) ? options.cls : options.cls.split(' ')));
            if (options.text !== undefined) el.textContent = options.text;
            return el;
        });
    };


    beforeEach(() => {
        jest.clearAllMocks();
        subscriptions = [];

        // Reset mock elements and factory returns
        mockContainerElement = createMockElement('DIV', 'test-container');
        mockGameContainer = createMockElement('DIV', 'game-container');
        resetFactoryMocks(); // Apply default mock behavior


        mockValidatedEventDispatcher.subscribe.mockImplementation(() => {
            const sub = {unsubscribe: jest.fn()};
            subscriptions.push(sub);
            return sub;
        });

        mockDocumentContext.query.mockImplementation(selector => {
            if (selector === '#game-container') return mockGameContainer;
            return null;
        });
    });

    // --- Helper to create instance ---
    const createInstance = (deps = {}) => {
        const defaultDeps = {
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactoryInstance,
            containerElement: mockContainerElement,
        };
        return new InventoryPanel({...defaultDeps, ...deps});
    };

    // --- Constructor Tests ---

    it('should instantiate successfully with valid dependencies', () => {
        const panel = createInstance();
        expect(panel).toBeInstanceOf(InventoryPanel);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[InventoryPanel] Initialized. Panel is initially hidden.'));
        // ... other constructor checks ...
        expect(mockContainerElement.appendChild).toHaveBeenCalledWith(mockPanelElement);
        expect(mockPanelElement.appendChild).toHaveBeenCalledTimes(3); // header, list, button
    });

    it('should throw if logger is missing or invalid', () => {
        expect(() => createInstance({logger: null}))
            .toThrow('InventoryPanel: Logger dependency is missing or invalid.');
    });

    it('should throw if documentContext is missing or invalid', () => {
        expect(() => createInstance({documentContext: null}))
            .toThrow('InventoryPanel: DocumentContext dependency is missing or invalid.');
    });

    it('should throw if validatedEventDispatcher is missing or invalid', () => {
        expect(() => createInstance({validatedEventDispatcher: null}))
            .toThrow('InventoryPanel: ValidatedEventDispatcher dependency is missing or invalid.');
    });

    it('should throw if domElementFactory is missing or invalid', () => {
        expect(() => createInstance({domElementFactory: null}))
            .toThrow("[InventoryPanel] 'domElementFactory' dependency is missing or invalid.");
    });

    // LNE-Error-Correction: Corrected expected error string precisely
    it('should throw if containerElement is invalid AND fallback #game-container is not found', () => {
        mockDocumentContext.query.mockReturnValue(null);
        const expectedErrorString = "[InventoryPanel] 'containerElement' dependency is missing or not a valid DOM element, and fallback '#game-container' not found. Cannot append panel.";
        expect(() => createInstance({containerElement: null}))
            .toThrow(expectedErrorString); // Match exact string
        expect(mockDocumentContext.query).toHaveBeenCalledWith('#game-container');
    });

    it('should use fallback #game-container if containerElement is invalid and fallback exists', () => {
        mockDocumentContext.query.mockReturnValue(mockGameContainer);
        const panel = createInstance({containerElement: null});
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("'containerElement' was invalid or missing. Found and using '#game-container' as fallback."));
        expect(mockGameContainer.appendChild).toHaveBeenCalledWith(mockPanelElement);
    });

    it('should handle failure to create panel elements gracefully', () => {
        mockDomElementFactoryInstance.div.mockReturnValue(null);
        expect(() => createInstance()).not.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith('[InventoryPanel] Failed to create main panel element.');
    });

    it('should handle failure to create list element gracefully', () => {
        mockDomElementFactoryInstance.ul.mockReturnValue(null);
        const panel = createInstance();
        expect(mockLogger.error).toHaveBeenCalledWith('[InventoryPanel] Failed to create inventory list (UL) element.');
    });

    it('should handle failure to append panel to container gracefully', () => {
        mockContainerElement.appendChild.mockImplementation(() => {
            throw new Error('Simulated append error');
        });
        const panel = createInstance();
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to append inventory panel to container element:'), expect.any(Error));
    });

    it('should attach onclick handler to close button', () => {
        const mockCloseButton = createMockElement('BUTTON');
        mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
            if (cls === 'inventory-panel__close-button') return mockCloseButton;
            return createMockElement('BUTTON');
        });
        const panel = createInstance();
        const toggleSpy = jest.spyOn(panel, 'toggle');
        expect(mockCloseButton.onclick).toBeInstanceOf(Function);
        mockCloseButton.onclick();
        expect(toggleSpy).toHaveBeenCalledWith(false);
        toggleSpy.mockRestore();
    });


    // --- Event Handling Tests (#handleRenderInventory, #handleToggleInventory) ---

    describe('VED Event Handlers', () => {
        let panel;
        let renderHandler;
        let toggleHandler;

        beforeEach(() => {
            resetFactoryMocks(); // Reset mocks for factory instances
            panel = createInstance(); // Create a standard instance for most tests
            // Capture handlers from the standard instance
            const renderCall = mockValidatedEventDispatcher.subscribe.mock.calls.find(call => call[0] === 'event:render_inventory');
            const toggleCall = mockValidatedEventDispatcher.subscribe.mock.calls.find(call => call[0] === 'event:toggle_inventory');
            renderHandler = renderCall ? renderCall[1] : null;
            toggleHandler = toggleCall ? toggleCall[1] : null;

            // Reset mocks often modified within handlers
            mockListElement.appendChild.mockClear();
            mockListElement.innerHTML = '';
            mockDomElementFactoryInstance.li.mockClear();
            mockLogger.error.mockClear();
            mockLogger.warn.mockClear();
        });

        describe('#handleRenderInventory', () => {
            it('should clear list and show (Empty) for empty items array', () => {
                renderHandler({items: []}, 'event:render_inventory');
                expect(mockDomElementFactoryInstance.li).toHaveBeenCalledWith('inventory-panel__item inventory-panel__item--empty', '(Empty)');
                expect(mockListElement.appendChild).toHaveBeenCalledTimes(1);
                expect(mockListElement.appendChild).toHaveBeenCalledWith(expect.objectContaining({textContent: '(Empty)'}));
            });

            it('should display error message for null/undefined items payload', () => {
                renderHandler({items: null}, 'event:render_inventory');
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid payload for 'event:render_inventory'"), {items: null});
                expect(mockDomElementFactoryInstance.li).toHaveBeenCalledWith('inventory-panel__item inventory-panel__item--error', 'Error loading inventory.');
                expect(mockListElement.appendChild).toHaveBeenCalledTimes(1);
                expect(mockListElement.appendChild).toHaveBeenCalledWith(expect.objectContaining({textContent: 'Error loading inventory.'}));
            });

            it('should render items with names and icons', () => {
                const items = [{id: 'item1', name: 'Sword', icon: 'sword.png'}, {id: 'item2', name: 'Potion'}];
                renderHandler({items: items}, 'event:render_inventory');

                expect(mockListElement.appendChild).toHaveBeenCalledTimes(2);
                // Item 1 checks
                const appendedLi1 = mockListElement.appendChild.mock.calls[0][0];
                expect(appendedLi1).toEqual(expect.objectContaining({tagName: 'LI', dataset: {itemId: 'item1'}}));
                const childrenLi1 = appendedLi1._getChildren();
                expect(childrenLi1).toEqual(expect.arrayContaining([
                    expect.objectContaining({tagName: 'IMG', src: 'sword.png', alt: 'Sword'}),
                    expect.objectContaining({tagName: 'SPAN', textContent: 'Sword'}),
                    expect.objectContaining({tagName: 'BUTTON', textContent: 'Drop', dataset: {itemName: 'Sword'}})
                ]));
                const dropButton1 = childrenLi1.find(el => el.tagName === 'BUTTON');
                expect(dropButton1.setAttribute).toHaveBeenCalledWith('title', 'Drop Sword');
                // Item 2 checks
                const appendedLi2 = mockListElement.appendChild.mock.calls[1][0];
                expect(appendedLi2).toEqual(expect.objectContaining({tagName: 'LI', dataset: {itemId: 'item2'}}));
                const childrenLi2 = appendedLi2._getChildren();
                expect(childrenLi2).toEqual(expect.arrayContaining([
                    expect.objectContaining({tagName: 'SPAN', textContent: '📦'}),
                    expect.objectContaining({tagName: 'SPAN', textContent: 'Potion'}),
                    expect.objectContaining({tagName: 'BUTTON', textContent: 'Drop', dataset: {itemName: 'Potion'}})
                ]));
                const dropButton2 = childrenLi2.find(el => el.tagName === 'BUTTON');
                expect(dropButton2.setAttribute).toHaveBeenCalledWith('title', 'Drop Potion');
            });

            it('should skip rendering items with invalid data (missing id/name)', () => {
                const items = [{
                    id: 'valid1',
                    name: 'Valid Item'
                }, {id: 'invalid1'}, {name: 'Invalid Item 2'}, null, {id: 'valid2', name: 'Another Valid'}];
                renderHandler({items: items}, 'event:render_inventory');
                expect(mockLogger.warn).toHaveBeenCalledTimes(3);
                expect(mockListElement.appendChild).toHaveBeenCalledTimes(2);
                expect(mockListElement.appendChild).toHaveBeenCalledWith(expect.objectContaining({dataset: {itemId: 'valid1'}}));
                expect(mockListElement.appendChild).toHaveBeenCalledWith(expect.objectContaining({dataset: {itemId: 'valid2'}}));
            });

            it('should display error message if payload is invalid (e.g., not an object)', () => {
                renderHandler(null, 'event:render_inventory');
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received invalid payload for 'event:render_inventory'"), null);
                expect(mockDomElementFactoryInstance.li).toHaveBeenCalledWith('inventory-panel__item inventory-panel__item--error', 'Error loading inventory.');
                expect(mockListElement.appendChild).toHaveBeenCalledWith(expect.objectContaining({textContent: 'Error loading inventory.'}));
            });

            // LNE-Error-Correction: Get handler from the correct instance
            it('should log error if listElement is missing when handler is called', () => {
                // Simulate list creation failure for this specific instance
                mockDomElementFactoryInstance.ul.mockReturnValue(null);
                // Create the instance where list creation fails
                const panelWithNoList = createInstance();
                // Clear the error logged during construction
                mockLogger.error.mockClear();

                // Find the VED subscribe call for *this specific instance* if VED mock was instance-specific
                // If VED mock is global, we need to find the handler associated with panelWithNoList
                // Assuming VED mock captures handlers based on instance or we can re-capture:
                const renderInventorySubCall = mockValidatedEventDispatcher.subscribe.mock.calls.find(
                    call => call[0] === 'event:render_inventory' && call[1].name.includes('bound #handleRenderInventory') // Fragile check based on bind name
                );
                // A more robust way might be needed if mock setup doesn't allow this distinction.
                // Alternative: Re-bind the internal method for testing (requires modifying class or test utils)
                // For now, let's assume we can get the correct handler instance.
                // Re-subscribing inside test or making VED mock instance-aware might be needed.
                // Let's try finding the last subscription for simplicity here:
                const lastRenderHandlerSub = mockValidatedEventDispatcher.subscribe.mock.calls.filter(call => call[0] === 'event:render_inventory').pop();
                const handlerFromFaultyInstance = lastRenderHandlerSub ? lastRenderHandlerSub[1] : null;

                expect(handlerFromFaultyInstance).toBeInstanceOf(Function); // Ensure we found a handler

                if (handlerFromFaultyInstance) {
                    handlerFromFaultyInstance({items: [{id: 'a', name: 'b'}]}, 'event:render_inventory'); // Call the potentially correct handler
                    // Assert the specific error from the handler
                    expect(mockLogger.error).toHaveBeenCalledTimes(1);
                    expect(mockLogger.error).toHaveBeenCalledWith('[InventoryPanel] Cannot render inventory, list element not found.');
                } else {
                    throw new Error("Could not isolate the render handler for the faulty instance.");
                }
            });
        });

        describe('#handleToggleInventory', () => {
            it('should call panel.toggle()', () => {
                const toggleSpy = jest.spyOn(panel, 'toggle');
                expect(toggleHandler).toBeInstanceOf(Function); // Ensure handler was captured
                if (toggleHandler) toggleHandler(); // Call the handler
                expect(toggleSpy).toHaveBeenCalledWith();
                toggleSpy.mockRestore();
            });
        });
    });


    // --- Drop Button Click Logic Tests ---
    describe('Drop Button Clicks', () => {
        let panel;
        let renderHandler;

        beforeEach(async () => {
            resetFactoryMocks();
            panel = createInstance();
            renderHandler = mockValidatedEventDispatcher.subscribe.mock.calls.find(call => call[0] === 'event:render_inventory')[1];
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            mockValidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

            const items = [{id: 'dropItem1', name: 'Rusty Dagger', icon: 'dagger.png'}];
            renderHandler({items: items}, 'event:render_inventory'); // Render items
            mockLogger.error.mockClear(); // Clear logs before click simulation tests
        });

        const findAndClickDropButton = async (listElem) => {
            // Find the LI element that was appended
            const appendedLiCall = listElem.appendChild.mock.calls.find(call => call[0].tagName === 'LI');
            if (!appendedLiCall) throw new Error("LI element not found in appendChild calls");
            const appendedLi = appendedLiCall[0];

            // Find the BUTTON element within the LI's children
            const dropButton = appendedLi._getChildren().find(el => el.tagName === 'BUTTON');
            if (!dropButton) throw new Error("Drop button not found in LI children");

            await dropButton._simulateClick();
            return dropButton;
        };


        it('should dispatch "command:submit" with correct payload on drop click when visible', async () => {
            panel.toggle(true); // Make visible
            mockValidatedEventDispatcher.dispatchValidated.mockClear(); // Clear toggle dispatch
            await findAndClickDropButton(mockListElement);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('command:submit', {command: 'drop Rusty Dagger'});
        });

        it('should call toggle(false) after successful dispatch if panel was visible', async () => {
            panel.toggle(true);
            const toggleSpy = jest.spyOn(panel, 'toggle');
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            mockValidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
            await findAndClickDropButton(mockListElement);
            expect(toggleSpy).toHaveBeenCalledWith(false);
            toggleSpy.mockRestore();
        });

        it('should NOT call toggle(false) after successful dispatch if panel was hidden', async () => {
            const toggleSpy = jest.spyOn(panel, 'toggle');
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            mockValidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);
            await findAndClickDropButton(mockListElement);
            expect(toggleSpy).not.toHaveBeenCalledWith(false);
            toggleSpy.mockRestore();
        });


        it('should NOT call toggle(false) if dispatch fails', async () => {
            panel.toggle(true);
            const toggleSpy = jest.spyOn(panel, 'toggle');
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            mockValidatedEventDispatcher.dispatchValidated.mockResolvedValue(false); // Fail dispatch
            await findAndClickDropButton(mockListElement);
            expect(toggleSpy).not.toHaveBeenCalledWith(false);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Drop command dispatch failed or was prevented.'));
            toggleSpy.mockRestore();
        });

        // LNE-Error-Correction: Modify dataset of the *found* button before clicking
        it('should log error and not dispatch if item name is missing from dataset', async () => {
            const appendedLiCall = mockListElement.appendChild.mock.calls.find(call => call[0].tagName === 'LI');
            const appendedLi = appendedLiCall[0];
            const dropButton = appendedLi._getChildren().find(el => el.tagName === 'BUTTON');
            expect(dropButton).toBeDefined();

            // Modify the specific button's dataset
            delete dropButton.dataset.itemName;

            const toggleSpy = jest.spyOn(panel, 'toggle');
            await dropButton._simulateClick(); // Click the modified button

            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Ensure only one error log
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Drop button clicked, but missing item name from dataset.'), {itemId: 'dropItem1'});
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(toggleSpy).not.toHaveBeenCalledWith(false);
            toggleSpy.mockRestore();
        });

        it('should handle errors during dispatch gracefully', async () => {
            panel.toggle(true);
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            const toggleSpy = jest.spyOn(panel, 'toggle');
            const dispatchError = new Error('Dispatch failed');
            mockValidatedEventDispatcher.dispatchValidated.mockRejectedValue(dispatchError);
            await findAndClickDropButton(mockListElement);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Error occurred during dispatch of 'command:submit' for \"drop Rusty Dagger\""), dispatchError);
            expect(toggleSpy).not.toHaveBeenCalledWith(false);
            toggleSpy.mockRestore();
        });

        it('should stop propagation', async () => {
            const mockEvent = {target: createMockElement('BUTTON'), stopPropagation: jest.fn()};
            const appendedLiCall = mockListElement.appendChild.mock.calls.find(call => call[0].tagName === 'LI');
            const appendedLi = appendedLiCall[0];
            const dropButton = appendedLi._getChildren().find(el => el.tagName === 'BUTTON');
            const clickHandler = dropButton.addEventListener.mock.calls.find(call => call[0] === 'click')[1];
            await clickHandler(mockEvent);
            expect(mockEvent.stopPropagation).toHaveBeenCalled();
        });
    });


    // --- toggle() Method Tests ---
    describe('toggle()', () => {
        // ... toggle tests remain the same ...
        let panel;
        beforeEach(() => {
            resetFactoryMocks();
            panel = createInstance();
            expect(mockPanelElement.classList.contains('hidden')).toBe(true);
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
        });

        it('should remove "hidden" class and request render when toggling from hidden', () => {
            panel.toggle();
            expect(mockPanelElement.classList.remove).toHaveBeenCalledWith('hidden');
            expect(mockPanelElement.classList.contains('hidden')).toBe(false);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:request_inventory_render', {});
        });

        it('should add "hidden" class when toggling from visible', () => {
            panel.toggle(); // Hidden -> Visible
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            panel.toggle(); // Visible -> Hidden
            expect(mockPanelElement.classList.add).toHaveBeenCalledWith('hidden');
            expect(mockPanelElement.classList.contains('hidden')).toBe(true);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        it('should force show when called with toggle(true) and hidden', () => {
            panel.toggle(true);
            expect(mockPanelElement.classList.remove).toHaveBeenCalledWith('hidden');
            expect(mockPanelElement.classList.contains('hidden')).toBe(false);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:request_inventory_render', {});
        });

        it('should force hide when called with toggle(false) and visible', () => {
            panel.toggle(true); // Visible
            expect(mockPanelElement.classList.contains('hidden')).toBe(false);
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            panel.toggle(false); // Hide
            expect(mockPanelElement.classList.add).toHaveBeenCalledWith('hidden');
            expect(mockPanelElement.classList.contains('hidden')).toBe(true);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        it('should request render again when called with toggle(true) and already visible', () => {
            panel.toggle(true); // Visible, request 1
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            panel.toggle(true); // Still visible, request 2
            expect(mockPanelElement.classList.remove).toHaveBeenCalledTimes(1); // Not removed again
            expect(mockPanelElement.classList.contains('hidden')).toBe(false);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);
        });

        it('should do nothing when called with toggle(false) and already hidden', () => {
            expect(mockPanelElement.classList.contains('hidden')).toBe(true);
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            panel.toggle(false);
            expect(mockPanelElement.classList.add).not.toHaveBeenCalled();
            expect(mockPanelElement.classList.contains('hidden')).toBe(true);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        it('should log warning and do nothing if panel element is missing', () => {
            mockDomElementFactoryInstance.div.mockReset().mockReturnValue(null);
            const panelNoElement = createInstance();
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
            panelNoElement.toggle();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Cannot toggle inventory, panel element does not exist'));
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });
    });

    // --- dispose() Method Tests ---
    describe('dispose()', () => {
        // ... dispose tests remain the same ...
        it('should unsubscribe from all VED events', () => {
            const panel = createInstance();
            panel.dispose();
            subscriptions.forEach(sub => {
                expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
            });
        });

        it('should remove the panel element from its container', () => {
            const panel = createInstance();
            mockPanelElement.parentNode = mockContainerElement; // Ensure relationship for test
            panel.dispose();
            expect(mockContainerElement.removeChild).toHaveBeenCalledWith(mockPanelElement);
        });

        it('should handle panel already removed from DOM gracefully', () => {
            const panel = createInstance();
            mockPanelElement.parentNode = null; // Simulate pre-removal
            expect(() => panel.dispose()).not.toThrow();
            expect(mockContainerElement.removeChild).not.toHaveBeenCalled();
        });

        it('should handle errors during DOM removal gracefully', () => {
            const panel = createInstance();
            mockPanelElement.parentNode = mockContainerElement;
            const removalError = new Error('Cannot remove');
            mockContainerElement.removeChild.mockImplementation(() => {
                throw removalError;
            });
            expect(() => panel.dispose()).not.toThrow();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error removing panel element during dispose:'), removalError);
        });

        it('should call super.dispose() for base class cleanup/logging', () => {
            const panel = createInstance();
            panel.dispose();
            expect(mockLogger.debug).toHaveBeenCalledWith('[InventoryPanel] Disposing.');
        });
    });
});