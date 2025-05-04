// src/tests/domUI/actionButtonsRenderer.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
// Import from specific file for clarity
import {ActionButtonsRenderer} from '../../domUI/index.js'; // Using index import
import DocumentContext from '../../domUI/documentContext.js';
import DomElementFactory from '../../domUI/domElementFactory.js';
import ConsoleLogger from '../../core/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../core/services/consoleLogger');
jest.mock('../../services/validatedEventDispatcher');
// Mock the factory module itself for constructor tests, but we'll use real instances later
jest.mock('../../domUI/domElementFactory');


describe('ActionButtonsRenderer', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance; // To hold instance used in most tests
    let actionButtonsContainer; // The specific container for this renderer

    // --- Mock Elements ---
    // Creates a mock element with spied methods, letting JSDOM handle implementation
    const createMockElement = (tagName = 'div', id = '', classes = [], textContent = '') => {
        const element = document.createElement(tagName); // Use JSDOM's createElement
        if (id) element.id = id;
        const classArray = Array.isArray(classes) ? classes : String(classes).split(' ').filter(c => c);
        if (classArray.length > 0) {
            element.classList.add(...classArray);
        }
        element.textContent = textContent;

        // Event listener mock store
        element._listeners = {};
        element.addEventListener = jest.fn((event, cb) => {
            if (!element._listeners[event]) {
                element._listeners[event] = [];
            }
            element._listeners[event].push(cb);
        });
        element.removeEventListener = jest.fn(); // Add basic mock

        // Simulate click
        element.click = jest.fn(async () => {
            if (element._listeners['click']) {
                for (const listener of element._listeners['click']) {
                    await listener();
                }
            }
        });

        // Spy on native methods we might want to check calls for
        jest.spyOn(element, 'setAttribute');
        jest.spyOn(element, 'remove');

        return element;
    };


    beforeEach(() => {
        // Reset DOM with the *correct* ID for the container
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div></div></body></html>`);
        document = dom.window.document;
        global.document = document; // Ensure global document is set for DocumentContext
        global.HTMLElement = dom.window.HTMLElement; // Ensure global HTMLElement is set

        docContext = new DocumentContext(); // Let it pick up global.document

        mockLogger = new ConsoleLogger();
        // Ensure VED mock has necessary methods if not fully mocked elsewhere
        mockVed = new ValidatedEventDispatcher({
            eventBus: {subscribe: jest.fn(), unsubscribe: jest.fn(), dispatch: jest.fn().mockResolvedValue(undefined)}, // Basic EventBus mock
            gameDataRepository: {getEventDefinition: jest.fn()}, // Mock needed methods
            schemaValidator: {
                isSchemaLoaded: jest.fn().mockReturnValue(true),
                validate: jest.fn().mockReturnValue({isValid: true})
            }, // Mock needed methods
            logger: mockLogger // Use the mocked logger
        });

        // Create an *actual* factory instance for most tests, using the real constructor
        // Keep the module mock for the specific constructor failure test
        mockDomElementFactoryInstance = new DomElementFactory(docContext);
        // Spy on the 'button' method of this *instance* for render tests
        jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
            const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
            // Use our extended mock creator to get elements with spied methods
            return createMockElement('button', '', classes, text);
        });


        actionButtonsContainer = document.getElementById('action-buttons'); // Get the correct element

        // Ensure container exists before spying
        if (!actionButtonsContainer) {
            throw new Error("Test setup failed: #action-buttons container not found in JSDOM.");
        }

        // Logger spies
        jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'warn').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'error').mockImplementation(() => {
        });
        jest.spyOn(mockLogger, 'debug').mockImplementation(() => {
        });

        // VED spies (re-apply spies on the potentially new mock instance)
        jest.spyOn(mockVed, 'subscribe').mockReturnValue({unsubscribe: jest.fn()});
        jest.spyOn(mockVed, 'dispatchValidated').mockResolvedValue(true);
        jest.spyOn(mockVed, 'unsubscribe'); // Spy on unsubscribe as well


        // Spy on container's methods we want to track calls for, but DO NOT mock implementation
        jest.spyOn(actionButtonsContainer, 'appendChild');
        jest.spyOn(actionButtonsContainer, 'removeChild'); // Spy only, let JSDOM handle removal
    });

    afterEach(() => {
        jest.restoreAllMocks();
        // Clean up JSDOM globals if necessary
        delete global.document;
        delete global.HTMLElement;
        if (document && document.body) {
            document.body.innerHTML = ''; // Clear body
        }
    });

    // Helper to create renderer
    const createRenderer = (containerOverride = actionButtonsContainer, factoryOverride = mockDomElementFactoryInstance) => {
        // Default to the spied instance, allow overriding for specific tests
        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: factoryOverride,
            actionButtonsContainer: containerOverride,
        });
    };

    // --- Test Scenarios ---

    describe('render()', () => {
        it('should clear the container when rendering', () => {
            // Add a real button that the clearing mechanism should remove
            const oldButton = document.createElement('button');
            oldButton.id = 'old-button';
            oldButton.textContent = 'Old Button';
            actionButtonsContainer.appendChild(oldButton); // appendChild call #1

            expect(actionButtonsContainer.children.length).toBe(1);
            expect(actionButtonsContainer.textContent).toContain('Old Button');

            const renderer = createRenderer();
            renderer.render(['look', 'go north']); // Render new actions -> appendChild calls #2, #3

            // Verify removeChild was called (at least once, for the old button)
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);

            // Verify new state by querying the actual JSDOM container
            const finalButtons = actionButtonsContainer.querySelectorAll('button');
            expect(finalButtons.length).toBe(2); // Should only contain the 2 new buttons
            expect(actionButtonsContainer.textContent).not.toContain('Old Button');
            expect(actionButtonsContainer.textContent).toContain('look');
            expect(actionButtonsContainer.textContent).toContain('go north');

            // ****** REMOVED INCORRECT ASSERTION ******
            // expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(2); // This was wrong

            // Optional: Verify appendChild was called with the *new* mock buttons if needed
            const lookButton = mockDomElementFactoryInstance.button.mock.results[0].value;
            const goNorthButton = mockDomElementFactoryInstance.button.mock.results[1].value;
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(lookButton);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(goNorthButton);
            // Verify total calls if necessary (1 setup + 2 render)
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(3);
        });

        it('should render nothing and log debug if actions list is empty', () => {
            // Add a real button to be cleared
            const oldButton = document.createElement('button');
            oldButton.id = 'old-button-empty-test';
            oldButton.textContent = 'Old Button';
            actionButtonsContainer.appendChild(oldButton); // Append during setup

            expect(actionButtonsContainer.children.length).toBe(1);

            // ****** ADDED mockClear ******
            actionButtonsContainer.appendChild.mockClear(); // Clear calls from setup

            const renderer = createRenderer();
            renderer.render([]); // Render empty list

            // Verify the old button was removed
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            // Verify the container is actually empty in JSDOM
            expect(actionButtonsContainer.children.length).toBe(0);
            // Verify factory and logs
            expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No actions provided, container cleared.'));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringMatching(/Rendered \d+ action buttons/));
            // appendChild should not have been called *during the render*
            expect(actionButtonsContainer.appendChild).not.toHaveBeenCalled(); // Check after clearing mock
        });


        it('should render buttons for each valid action string', () => {
            const actions = ['look', 'go north', 'talk to npc'];
            const renderer = createRenderer();
            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(actions.length);
            // Check the *actual* children added via the non-mocked appendChild
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(actions.length);
            expect(actionButtonsContainer.children.length).toBe(actions.length); // Check final DOM state

            // Verify calls to the factory and element configuration
            actions.forEach((action, index) => {
                expect(mockDomElementFactoryInstance.button).toHaveBeenCalledWith(action.trim(), 'action-button');
                // Get the mock element returned by the factory for this call
                const mockButton = mockDomElementFactoryInstance.button.mock.results[index].value;
                expect(mockButton).not.toBeNull();
                expect(mockButton.tagName).toBe('BUTTON');
                expect(mockButton.textContent).toBe(action);
                // Check attributes/listeners on the *mock* button returned by the factory
                expect(mockButton.classList.contains('action-button')).toBe(true);
                expect(mockButton.setAttribute).toHaveBeenCalledWith('title', `Click to ${action}`);
                expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function)); // Check listener attachment
                expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(mockButton); // Verify it was appended
            });
            // Check log message based on *actual* children count after render
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Rendered ${actionButtonsContainer.children.length} action buttons.`));
        });

        it('should skip invalid actions (non-string, empty/whitespace) and log warning', () => {
            const actions = ['look', null, 'go east', '', '   ', 123, 'examine chest'];
            const validActions = ['look', 'go east', 'examine chest'];
            const renderer = createRenderer();
            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(validActions.length);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(validActions.length); // Check append calls match valid count
            expect(actionButtonsContainer.children.length).toBe(validActions.length); // Check final DOM state
            expect(mockLogger.warn).toHaveBeenCalledTimes(4); // Four invalid items

            validActions.forEach((action) => {
                expect(mockDomElementFactoryInstance.button).toHaveBeenCalledWith(action.trim(), 'action-button');
                // Find the mock button created for this valid action
                const mockButton = mockDomElementFactoryInstance.button.mock.results.find(r => r.value?.textContent === action)?.value;
                expect(mockButton).toBeDefined();
                expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(mockButton);
            });

            // Verify specific warnings
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid or empty action string in list: "null"'));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid or empty action string in list: ""'));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid or empty action string in list: "   "'));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid or empty action string in list: "123"'));

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Rendered ${validActions.length} action buttons.`));
        });

        it('should log error and clear container if actions argument is not an array', () => {
            const oldButton = document.createElement('button');
            oldButton.textContent = 'Old Button';
            actionButtonsContainer.appendChild(oldButton); // Append during setup
            expect(actionButtonsContainer.children.length).toBe(1);

            // ****** ADDED mockClear ******
            actionButtonsContainer.appendChild.mockClear(); // Clear calls from setup

            const renderer = createRenderer();

            // Test case 1: String
            renderer.render('not an array');
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton); // Clearing should have happened
            expect(actionButtonsContainer.children.length).toBe(0); // Container should be empty
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), 'not an array');
            expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled(); // No buttons should be created
            expect(actionButtonsContainer.appendChild).not.toHaveBeenCalled(); // No buttons appended *by render*

            // Reset mocks and DOM for next case
            mockLogger.error.mockClear();
            mockDomElementFactoryInstance.button.mockClear();
            actionButtonsContainer.appendChild(oldButton); // Put back button
            actionButtonsContainer.removeChild.mockClear(); // Clear removeChild spy calls
            actionButtonsContainer.appendChild.mockClear(); // Clear appendChild spy calls again

            // Test case 2: Null
            renderer.render(null);
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), null);
            expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();
            expect(actionButtonsContainer.appendChild).not.toHaveBeenCalled();

            // Reset mocks and DOM for next case
            mockLogger.error.mockClear();
            actionButtonsContainer.appendChild(oldButton);
            actionButtonsContainer.removeChild.mockClear();
            actionButtonsContainer.appendChild.mockClear();


            // Test case 3: Undefined
            renderer.render(undefined);
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), undefined);
            expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();
            expect(actionButtonsContainer.appendChild).not.toHaveBeenCalled();

            // Reset mocks and DOM for next case
            mockLogger.error.mockClear();
            actionButtonsContainer.appendChild(oldButton);
            actionButtonsContainer.removeChild.mockClear();
            actionButtonsContainer.appendChild.mockClear();


            // Test case 4: Object (not array)
            renderer.render({actions: []}); // Object is not an array
            expect(actionButtonsContainer.removeChild).toHaveBeenCalledWith(oldButton);
            expect(actionButtonsContainer.children.length).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid actions argument received. Expected array, got:'), {actions: []});
            expect(mockDomElementFactoryInstance.button).not.toHaveBeenCalled();
            expect(actionButtonsContainer.appendChild).not.toHaveBeenCalled();
        });

        it('should log error and skip if factory fails to create a button', () => {
            const actions = ['look', 'fail', 'go north'];
            // Reset the mock for this specific test
            jest.spyOn(mockDomElementFactoryInstance, 'button').mockImplementation((text, cls) => {
                if (text === 'fail') return null; // Simulate factory failure for 'fail'
                const classes = cls ? (Array.isArray(cls) ? cls : cls.split(' ').filter(c => c)) : [];
                return createMockElement('button', '', classes, text); // Use mock element creation
            });


            const renderer = createRenderer();
            renderer.render(actions);

            expect(mockDomElementFactoryInstance.button).toHaveBeenCalledTimes(actions.length); // Factory attempted for all
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledTimes(2); // Appended only 2
            expect(actionButtonsContainer.children.length).toBe(2); // Check final DOM state

            // Check that the appended buttons were the correct ones
            const lookButton = mockDomElementFactoryInstance.button.mock.results[0].value;
            const goNorthButton = mockDomElementFactoryInstance.button.mock.results[2].value;
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(lookButton);
            expect(actionButtonsContainer.appendChild).toHaveBeenCalledWith(goNorthButton);
            expect(actionButtonsContainer.appendChild).not.toHaveBeenCalledWith(null); // Ensure null wasn't appended

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create button element for action: "fail"'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Rendered 2 action buttons.`)); // Log based on actual final count
        });

    }); // End render() describe


}); // End ActionButtonsRenderer describe