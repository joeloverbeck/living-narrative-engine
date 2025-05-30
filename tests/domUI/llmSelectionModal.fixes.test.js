// tests/domUI/llmSelectionModal.fixes.test.js
// --- FILE START ---

import {LlmSelectionModal} from '../../src/domUI/index.js'; // Path seems correct based on your setup
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

// Helper to create a basic mock DOM element with corrected classList and querySelector
const createMockElement = (tag = 'div', id = null) => {
    const _internalClassSet = new Set();

    const classListMock = {
        _set: _internalClassSet,
        add: jest.fn((...classes) => {
            classes.forEach(c => {
                if (typeof c === 'string') {
                    const classNames = c.trim().split(/\s+/);
                    classNames.forEach(cn => {
                        if (cn) _internalClassSet.add(cn);
                    });
                }
            });
        }),
        remove: jest.fn((...classes) => {
            classes.forEach(c => {
                if (typeof c === 'string') {
                    const classNames = c.trim().split(/\s+/);
                    classNames.forEach(cn => {
                        if (cn) _internalClassSet.delete(cn);
                    });
                }
            });
        }),
        contains: jest.fn(cls => {
            return typeof cls === 'string' && cls.trim() !== '' && _internalClassSet.has(cls.trim());
        }),
        toggle: jest.fn((cls, force) => {
            if (typeof cls !== 'string' || cls.trim() === '') return false;
            const trimmedClass = cls.trim();
            const currentlyHas = _internalClassSet.has(trimmedClass);
            let shouldHave = force;
            if (typeof force === 'undefined') shouldHave = !currentlyHas;
            if (shouldHave) _internalClassSet.add(trimmedClass);
            else _internalClassSet.delete(trimmedClass);
            return shouldHave;
        }),
        item: jest.fn(index => Array.from(_internalClassSet)[index] || null),
        get length() {
            return _internalClassSet.size;
        },
        toString: jest.fn(() => Array.from(_internalClassSet).join(' ')),
        forEach: jest.fn(callback => _internalClassSet.forEach(callback)),
        [Symbol.iterator]: function* () {
            for (const item of _internalClassSet) yield item;
        },
    };

    const element = {
        tag,
        id,
        dataset: {},
        classList: classListMock,
        attributes: {},
        children: [],
        style: {},
        textContent: '',
        innerHTML: '',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        appendChild: jest.fn(child => {
            element.children.push(child);
        }),
        setAttribute: jest.fn((name, value) => {
            element.attributes[name] = value;
        }),
        focus: jest.fn(),
        querySelectorAll: jest.fn(selector => {
            if (selector === 'li.llm-item') {
                return element.children.filter(c => c.tag === 'li' && c.classList.contains('llm-item'));
            }
            if (selector === 'li[tabindex="0"]') {
                const found = element.children.find(c => c.attributes['tabindex'] === '0');
                return found ? [found] : [];
            }
            return [];
        }),
        querySelector: jest.fn(selector => {
            if (selector === 'li[tabindex="0"]') {
                return element.children.find(c => c.attributes['tabindex'] === '0') || null;
            }
            if (selector === 'li.llm-item.selected') {
                return element.children.find(c => c.tag === 'li' && c.classList.contains('llm-item') && c.classList.contains('selected')) || null;
            }
            return null;
        }),
    };
    return element;
};

describe('LlmSelectionModal', () => {
    let loggerMock;
    let documentContextMock;
    let domElementFactoryMock;
    let llmAdapterMock;
    let modalElementMock;
    let llmListElementMock;
    let closeModalButtonMock;
    let llmStatusMessageElementMock;
    let changeLlmButtonMock;

    let llmSelectionModal;

    beforeEach(() => {
        loggerMock = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        modalElementMock = createMockElement('div', 'llm-selection-modal');
        llmListElementMock = createMockElement('ul', 'llm-selection-list');
        closeModalButtonMock = createMockElement('button', 'llm-selection-modal-close-button');
        llmStatusMessageElementMock = createMockElement('div', 'llm-selection-status-message');
        changeLlmButtonMock = createMockElement('button', 'change-llm-button');

        documentContextMock = {
            query: jest.fn(selector => {
                if (selector === '#llm-selection-modal') return modalElementMock;
                if (selector === '#llm-selection-list') return llmListElementMock;
                if (selector === '#llm-selection-modal-close-button') return closeModalButtonMock;
                if (selector === '#llm-selection-status-message') return llmStatusMessageElementMock;
                if (selector === '#change-llm-button') return changeLlmButtonMock;
                return null;
            }),
        };

        domElementFactoryMock = {
            create: jest.fn((tag, options = {}) => {
                const el = createMockElement(tag);
                if (options.cls) {
                    const classesToAdd = Array.isArray(options.cls) ? options.cls : [options.cls];
                    el.classList.add(...classesToAdd);
                }
                if (options.className && typeof options.className === 'string') {
                    el.classList.add(options.className);
                }
                if (options.text) el.textContent = options.text;
                if (options.id) el.id = options.id;
                return el;
            }),
        };

        llmAdapterMock = {
            getAvailableLlmOptions: jest.fn(),
            getCurrentActiveLlmId: jest.fn(),
            setActiveLlm: jest.fn(),
        };

        global.requestAnimationFrame = jest.fn(cb => {
            cb();
            return 0;
        });

        llmSelectionModal = new LlmSelectionModal({
            logger: loggerMock,
            documentContext: documentContextMock,
            domElementFactory: domElementFactoryMock,
            llmAdapter: llmAdapterMock,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete global.requestAnimationFrame;
    });

    describe('show() method', () => {
        // THIS IS THE FAILING TEST - Corrected assertion for logger.info
        it('should log warnings and show 0 valid options if adapter returns an array of strings (simulating bug)', async () => {
            const mockLlmIdsAsStrings = ['id1-string', 'id2-string', 'id3-string'];
            const currentActiveId = 'id1-string';
            llmAdapterMock.getAvailableLlmOptions.mockResolvedValue(mockLlmIdsAsStrings);
            llmAdapterMock.getCurrentActiveLlmId.mockResolvedValue(currentActiveId);

            await llmSelectionModal.show();

            expect(loggerMock.debug).toHaveBeenCalledWith('LlmSelectionModal: Fetching available LLM options...');
            expect(loggerMock.debug).toHaveBeenCalledWith(`LlmSelectionModal: Fetched ${mockLlmIdsAsStrings.length} LLM options.`);
            expect(llmAdapterMock.getAvailableLlmOptions).toHaveBeenCalledTimes(1);

            expect(loggerMock.warn).toHaveBeenCalledTimes(mockLlmIdsAsStrings.length);
            mockLlmIdsAsStrings.forEach(strOption => {
                expect(loggerMock.warn).toHaveBeenCalledWith(
                    'LlmSelectionModal: LLM option is missing configId.',
                    {option: strOption}
                );
            });

            expect(loggerMock.info).toHaveBeenCalledWith('LlmSelectionModal: show() called.');
            // The SUT *will* log this because llmOptions.length > 0, even if children.length becomes 0
            expect(loggerMock.info).toHaveBeenCalledWith(
                `LlmSelectionModal: LLM list populated with 0 valid options. Current active: ${currentActiveId}.`
            );
            expect(loggerMock.info).toHaveBeenCalledWith('LlmSelectionModal: Modal display set to visible.');


            const llmItemCreations = domElementFactoryMock.create.mock.calls.filter(
                call => call[0] === 'li' && call[1]?.cls?.includes('llm-item')
            );
            expect(llmItemCreations.length).toBe(0);

            const appendedLlmItems = llmListElementMock.appendChild.mock.calls.filter(
                call => call[0].classList && call[0].classList.contains('llm-item')
            );
            expect(appendedLlmItems.length).toBe(0);

            expect(modalElementMock.style.display).toBe('flex');
            expect(modalElementMock.classList.contains('visible')).toBe(true);
            expect(llmListElementMock.querySelector).toHaveBeenCalledWith('li[tabindex="0"]');
            expect(closeModalButtonMock.focus).toHaveBeenCalled();
        });

        it('should populate the list correctly when adapter returns valid LlmConfigOption objects', async () => {
            const mockOptions = [
                {configId: 'llm1', displayName: 'LLM One'},
                {configId: 'llm2', displayName: 'LLM Two (Active)'},
                {configId: 'llm3', displayName: 'LLM Three'},
            ];
            llmAdapterMock.getAvailableLlmOptions.mockResolvedValue(mockOptions);
            llmAdapterMock.getCurrentActiveLlmId.mockResolvedValue('llm2');

            let createdLiForFocus = null;

            domElementFactoryMock.create.mockImplementation((tag, options) => {
                const el = createMockElement(tag);
                if (options.cls) {
                    const classesToAdd = Array.isArray(options.cls) ? options.cls : [options.cls];
                    el.classList.add(...classesToAdd);
                }
                if (options.text) el.textContent = options.text;

                if (tag === 'li' && options?.cls?.includes('llm-item')) {
                    const opt = mockOptions.find(o => (o.displayName === options.text) || (o.configId === options.text && !o.displayName));
                    if (opt) {
                        el.dataset.llmId = opt.configId;
                        if (opt.configId === 'llm2') createdLiForFocus = el;
                    }
                }
                return el;
            });

            await llmSelectionModal.show();

            expect(loggerMock.warn).not.toHaveBeenCalledWith(
                'LlmSelectionModal: LLM option is missing configId.',
                expect.anything()
            );
            const liCreations = domElementFactoryMock.create.mock.calls.filter(call => call[0] === 'li' && call[1]?.cls === 'llm-item');
            expect(liCreations.length).toBe(mockOptions.length);
            expect(llmListElementMock.appendChild).toHaveBeenCalledTimes(mockOptions.length);

            mockOptions.forEach((option) => {
                const appendedChild = llmListElementMock.appendChild.mock.calls.map(c => c[0]).find(el => el.dataset.llmId === option.configId);
                expect(appendedChild).toBeDefined();
                expect(appendedChild.classList.contains('llm-item')).toBe(true);
                expect(appendedChild.textContent).toBe(option.displayName);
                expect(appendedChild.attributes['role']).toBe('radio');

                if (option.configId === 'llm2') {
                    expect(appendedChild.classList.contains('selected')).toBe(true);
                    expect(appendedChild.attributes['aria-checked']).toBe('true');
                    expect(appendedChild.attributes['tabindex']).toBe('0');
                } else {
                    expect(appendedChild.classList.contains('selected')).toBe(false);
                    expect(appendedChild.attributes['aria-checked']).toBe('false');
                    expect(appendedChild.attributes['tabindex']).toBe('-1');
                }
            });

            expect(loggerMock.info).toHaveBeenCalledWith(
                `LlmSelectionModal: LLM list populated with ${mockOptions.length} valid options. Current active: llm2.`
            );
            expect(modalElementMock.classList.contains('visible')).toBe(true);
            expect(llmListElementMock.querySelector).toHaveBeenCalledWith('li[tabindex="0"]');
            expect(createdLiForFocus.focus).toHaveBeenCalled();
        });

        it('should skip options missing configId but render valid ones, and log warnings for invalid ones', async () => {
            const mixedOptions = [
                {displayName: 'Invalid LLM 1 (no configId)'},
                {configId: 'valid-llm1', displayName: 'Valid LLM One'},
                {configId: null, displayName: 'Invalid LLM 2 (null configId)'},
                {configId: 'valid-llm2', displayName: 'Valid LLM Two (Active)'},
            ];
            llmAdapterMock.getAvailableLlmOptions.mockResolvedValue(mixedOptions);
            llmAdapterMock.getCurrentActiveLlmId.mockResolvedValue('valid-llm2');

            let focusedElementInTest = null;

            domElementFactoryMock.create.mockImplementation((tag, options) => {
                const el = createMockElement(tag);
                if (options.cls) {
                    const classesToAdd = Array.isArray(options.cls) ? options.cls : [options.cls];
                    el.classList.add(...classesToAdd);
                }
                if (options.text) el.textContent = options.text;
                if (tag === 'li' && options?.cls?.includes('llm-item')) {
                    const opt = mixedOptions.find(o => o.displayName === options.text && o.configId);
                    if (opt) {
                        el.dataset.llmId = opt.configId;
                        if (opt.configId === 'valid-llm2') focusedElementInTest = el;
                    }
                }
                return el;
            });

            await llmSelectionModal.show();

            expect(loggerMock.warn).toHaveBeenCalledTimes(2);
            expect(loggerMock.warn).toHaveBeenCalledWith(
                'LlmSelectionModal: LLM option is missing configId.', {option: mixedOptions[0]}
            );
            expect(loggerMock.warn).toHaveBeenCalledWith(
                'LlmSelectionModal: LLM option is missing configId.', {option: mixedOptions[2]}
            );

            const llmItemCreations = domElementFactoryMock.create.mock.calls.filter(
                call => call[0] === 'li' && call[1]?.cls === 'llm-item'
            );
            expect(llmItemCreations.length).toBe(2);
            expect(llmListElementMock.appendChild).toHaveBeenCalledTimes(2);

            const appendedValidItems = llmListElementMock.appendChild.mock.calls.map(call => call[0]);
            expect(appendedValidItems.find(el => el.dataset.llmId === 'valid-llm1').textContent).toBe('Valid LLM One');
            const activeItem = appendedValidItems.find(el => el.dataset.llmId === 'valid-llm2');
            expect(activeItem.textContent).toBe('Valid LLM Two (Active)');
            expect(activeItem.classList.contains('selected')).toBe(true);

            expect(loggerMock.info).toHaveBeenCalledWith(
                `LlmSelectionModal: LLM list populated with 2 valid options. Current active: valid-llm2.`
            );
            expect(focusedElementInTest.focus).toHaveBeenCalled();
        });

        it('should display a "no options" message if adapter returns an empty list', async () => {
            llmAdapterMock.getAvailableLlmOptions.mockResolvedValue([]);
            llmAdapterMock.getCurrentActiveLlmId.mockResolvedValue(null);

            const noOptionsMessageElement = createMockElement('li');
            domElementFactoryMock.create.mockImplementation((tag, options) => {
                const el = createMockElement(tag);
                if (options.text) el.textContent = options.text;
                if (options.className) el.classList.add(options.className);
                if (options.text === 'No Language Models are currently configured.') {
                    noOptionsMessageElement.textContent = options.text;
                    if (options.className) noOptionsMessageElement.classList.add(options.className);
                    return noOptionsMessageElement;
                }
                return el;
            });

            await llmSelectionModal.show();

            expect(domElementFactoryMock.create).toHaveBeenCalledWith('li', {
                text: 'No Language Models are currently configured.',
                className: 'llm-item-message llm-empty-message'
            });
            expect(llmListElementMock.appendChild).toHaveBeenCalledWith(noOptionsMessageElement);
            expect(loggerMock.warn).toHaveBeenCalledWith('LlmSelectionModal: No LLM options available or list is empty.');
            expect(loggerMock.info).toHaveBeenCalledWith('LlmSelectionModal: show() called.');
            expect(loggerMock.info).toHaveBeenCalledWith('LlmSelectionModal: Modal display set to visible.');
            expect(loggerMock.info).not.toHaveBeenCalledWith(
                expect.stringMatching(/LLM list populated with .* valid options/)
            );
            expect(closeModalButtonMock.focus).toHaveBeenCalled();
        });

        it('should display an error message if fetching LLM options fails', async () => {
            const errorMessage = 'Network error';
            llmAdapterMock.getAvailableLlmOptions.mockRejectedValue(new Error(errorMessage));
            llmAdapterMock.getCurrentActiveLlmId.mockResolvedValue(null);

            const errorItemElement = createMockElement('li');
            domElementFactoryMock.create.mockImplementation((tag, options) => {
                const el = createMockElement(tag);
                if (options.text) el.textContent = options.text;
                if (options.className) el.classList.add(options.className);
                if (options.text === `Failed to load LLM list: ${errorMessage}`) {
                    errorItemElement.textContent = options.text;
                    if (options.className) errorItemElement.classList.add(options.className);
                    return errorItemElement;
                }
                return el;
            });

            await llmSelectionModal.show();

            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmSelectionModal: Error fetching LLM data from adapter for list population: ${errorMessage}`,
                {error: new Error(errorMessage)}
            );
            expect(domElementFactoryMock.create).toHaveBeenCalledWith('li', {
                text: `Failed to load LLM list: ${errorMessage}`,
                className: 'llm-item-message llm-error-message'
            });
            expect(llmListElementMock.appendChild).toHaveBeenCalledWith(errorItemElement);
            expect(loggerMock.info).toHaveBeenCalledWith('LlmSelectionModal: show() called.');
            expect(loggerMock.info).toHaveBeenCalledWith('LlmSelectionModal: Modal display set to visible.');
            expect(loggerMock.info).not.toHaveBeenCalledWith(
                expect.stringMatching(/LLM list populated with .* valid options/)
            );
            expect(closeModalButtonMock.focus).toHaveBeenCalled();
        });

        it('should use configId as display text if displayName is missing but configId is present', async () => {
            const mockOptions = [
                {configId: 'llm-only-id'},
                {configId: 'llm-with-name', displayName: 'LLM With Name'}
            ];
            llmAdapterMock.getAvailableLlmOptions.mockResolvedValue(mockOptions);
            llmAdapterMock.getCurrentActiveLlmId.mockResolvedValue('llm-with-name');

            let focusedElementInTest = null;

            domElementFactoryMock.create.mockImplementation((tag, options) => {
                const el = createMockElement(tag);
                if (options.cls) {
                    const classesToAdd = Array.isArray(options.cls) ? options.cls : [options.cls];
                    el.classList.add(...classesToAdd);
                }
                if (options.text) el.textContent = options.text;
                if (tag === 'li' && options?.cls?.includes('llm-item')) {
                    const opt = mockOptions.find(o => (o.displayName || o.configId) === options.text);
                    if (opt) {
                        el.dataset.llmId = opt.configId;
                        if (opt.configId === 'llm-with-name') focusedElementInTest = el;
                    }
                }
                return el;
            });

            await llmSelectionModal.show();

            const liCreations = domElementFactoryMock.create.mock.calls.filter(call => call[0] === 'li' && call[1]?.cls === 'llm-item');
            expect(liCreations.length).toBe(2);

            const appendedItems = llmListElementMock.appendChild.mock.calls.map(call => call[0]);
            const item1 = appendedItems.find(el => el.dataset.llmId === 'llm-only-id');
            expect(item1.textContent).toBe('llm-only-id');

            const item2 = appendedItems.find(el => el.dataset.llmId === 'llm-with-name');
            expect(item2.textContent).toBe('LLM With Name');
            expect(item2.classList.contains('selected')).toBe(true);

            expect(loggerMock.warn).not.toHaveBeenCalledWith(
                'LlmSelectionModal: LLM option is missing configId.',
                expect.anything()
            );
            expect(loggerMock.info).toHaveBeenCalledWith(
                `LlmSelectionModal: LLM list populated with 2 valid options. Current active: llm-with-name.`
            );
            expect(focusedElementInTest.focus).toHaveBeenCalled();
        });
    });
});

// --- FILE END ---