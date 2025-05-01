// src/tests/core/config/registrations/uiRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../../interfaces/coreServices.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../domRenderer.js').default} DomRenderer */
/** @typedef {any} AppContainer */ // Using 'any' as the custom container type isn't defined

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerUI} from '../../../../core/config/registrations/uiRegistrations.js';

// --- Dependencies ---
import {tokens} from '../../../../core/config/tokens.js';

// --- MOCK the Modules to prevent constructor errors ---
// Jest replaces the actual imports with mock constructors
jest.mock('../../../../core/domRenderer.js');
jest.mock('../../../../core/inputHandler.js');
// Now, when DomRenderer or InputHandler are imported, they are mock functions

// --- Import AFTER mocking ---
// It's often good practice to import the mocked modules after calling jest.mock
// although ES Modules hoisting might make order less strict sometimes.
import DomRenderer from '../../../../core/domRenderer.js';
import InputHandler from '../../../../core/inputHandler.js';

// --- Mock Implementations (Services, DOM elements) ---
const mockLogger = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
};
const mockEventBus = {
    subscribe: jest.fn(), publish: jest.fn(), dispatch: jest.fn() // Added dispatch mock for InputHandler constructor validation
};
const mockvalidatedEventDispatcher = {
    dispatch: jest.fn(), dispatchValidated: jest.fn().mockResolvedValue(true), // Add mock for dispatchValidated if needed by DomRenderer mock interaction later
};

// Simple mock objects are sufficient now as they won't hit real constructor validation
const mockOutputDiv = {id: 'output'};
const mockInputElement = {
    id: 'input',
    value: '',
    addEventListener: jest.fn(),
    focus: jest.fn(),
    // Mock form property if accessed (InputHandler accesses it)
    form: {addEventListener: jest.fn()}
};
const mockTitleElement = {id: 'title'};

// --- Mock Custom DI Container (Keep the previous working version) ---
const createMockContainer = () => {
    const registrations = new Map();
    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            registrations.set(token, {factoryOrValue, options, instance: undefined});
        }),
        resolve: jest.fn((token) => {
            const registration = registrations.get(token);
            if (!registration) {
                // Try resolving by string name if token is an object/symbol for easier debugging
                const tokenStr = typeof token === 'symbol' ? token.toString() : String(token);
                throw new Error(`Mock Resolve Error: Token not registered: ${tokenStr}`);
            }
            const {factoryOrValue, options} = registration;
            if (options?.lifecycle === 'singleton') {
                if (registration.instance !== undefined) {
                    return registration.instance;
                }
                if (typeof factoryOrValue !== 'function') {
                    registration.instance = factoryOrValue;
                } else {
                    const factory = factoryOrValue;
                    registration.instance = factory(container); // Pass container
                }
                return registration.instance;
            }
            if (typeof factoryOrValue === 'function') {
                return factoryOrValue(container); // Pass container
            }
            return factoryOrValue;
        }),
    };
    return container;
};

describe('registerUI (with Mock Pure JS DI Container and Mocked Dependencies)', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;
    // No longer need constructor spies as the classes are fully mocked

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockContainer = createMockContainer();

        // Pre-register dependencies
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.IValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});
        // Register DOM elements (instances provided via registerUI are wrapped in factories)
        mockContainer.register(tokens.outputDiv, mockOutputDiv);
        mockContainer.register(tokens.inputElement, mockInputElement);
        mockContainer.register(tokens.titleElement, mockTitleElement);


        // Clear mock function calls (not instances)
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockEventBus).forEach(fn => fn.mockClear?.());
        Object.values(mockvalidatedEventDispatcher).forEach(fn => fn.mockClear?.());
        mockInputElement.addEventListener.mockClear();
        mockInputElement.focus.mockClear();
        if (mockInputElement.form) {
            mockInputElement.form.addEventListener.mockClear();
        }
        // Ensure document mock is cleared if needed (InputHandler adds listener)
        // For simplicity, assuming jest handles global document mocks or it's not critical here.
    });

    // afterEach: jest.restoreAllMocks() is good practice if using jest.spyOn,
    // but jest.clearAllMocks() in beforeEach handles jest.mock resets.

    it('should register outputDiv, inputElement, and titleElement as instances via factories', () => { // Updated test description slightly
        // Arrange
        registerUI(mockContainer, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement
        });

        // --- Assert: Check registration calls ---
        // *** FIX HERE: Expect a FUNCTION as the second argument *** (This was already correct)
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.outputDiv,
            expect.any(Function), // The Registrar.instance now provides a factory function
            expect.objectContaining({lifecycle: 'singleton'})
        );
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.inputElement,
            expect.any(Function), // The Registrar.instance now provides a factory function
            expect.objectContaining({lifecycle: 'singleton'})
        );
        expect(mockContainer.register).toHaveBeenCalledWith(
            tokens.titleElement,
            expect.any(Function), // The Registrar.instance now provides a factory function
            expect.objectContaining({lifecycle: 'singleton'})
        );

        // --- Assert: Check resolution (This part remains the same and is important!) ---
        // Verify that resolving these tokens returns the *original* mock instance,
        // proving the factory function wrapper works correctly.
        expect(mockContainer.resolve(tokens.outputDiv)).toBe(mockOutputDiv);
        expect(mockContainer.resolve(tokens.inputElement)).toBe(mockInputElement);
        expect(mockContainer.resolve(tokens.titleElement)).toBe(mockTitleElement);

        // Assert: Check logger call (unchanged)
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Registered DOM element instances.');
    });


    it('should register DomRenderer as a singleton factory', () => {
        // Arrange
        registerUI(mockContainer, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement
        });

        // Assert: Check registration call (unchanged)
        const rendererRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.DomRenderer);
        expect(rendererRegArgs).toBeDefined();
        expect(typeof rendererRegArgs[1]).toBe('function');
        expect(rendererRegArgs[2]).toEqual(expect.objectContaining({lifecycle: 'singleton'}));

        // Act: Resolve twice
        const renderer1 = mockContainer.resolve(tokens.DomRenderer);
        const renderer2 = mockContainer.resolve(tokens.DomRenderer);

        // Assert: Singleton check
        expect(renderer1).toBeDefined();
        expect(renderer1).toBe(renderer2); // Should be the same instance
        // Assert: Check that the MOCKED DomRenderer constructor was called only once
        expect(DomRenderer).toHaveBeenCalledTimes(1); // Check the mock constructor
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Registered DomRenderer.');
    });

    it('should register InputHandler as a singleton factory', () => {
        // Arrange
        registerUI(mockContainer, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement
        });

        // Assert: Check registration call (unchanged)
        const handlerRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.IInputHandler);
        expect(handlerRegArgs).toBeDefined();
        expect(typeof handlerRegArgs[1]).toBe('function');
        expect(handlerRegArgs[2]).toEqual(expect.objectContaining({lifecycle: 'singleton'}));

        // Act: Resolve twice
        const handler1 = mockContainer.resolve(tokens.IInputHandler);
        const handler2 = mockContainer.resolve(tokens.IInputHandler);

        // Assert: Singleton check
        expect(handler1).toBeDefined();
        expect(handler1).toBe(handler2);
        // Assert: Check that the MOCKED InputHandler constructor was called only once
        expect(InputHandler).toHaveBeenCalledTimes(1); // Check the mock constructor

        // --- FIX IS HERE ---
        // Assert: Check the specific logger message for InputHandler registration
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Registered InputHandler against IInputHandler token.');
        // --- END FIX ---
    });

    it('should inject correct dependencies into DomRenderer when resolved', () => {
        // Arrange
        registerUI(mockContainer, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement
        });

        // Act: Resolve
        mockContainer.resolve(tokens.DomRenderer);

        // Assert: Check arguments passed to the MOCKED DomRenderer constructor
        expect(DomRenderer).toHaveBeenCalledTimes(1);

        // ***** CORRECTED ASSERTION (AGAIN) ***** (This was already correct in your provided code)
        // Expect the mock to have been called with ONE argument: an object
        // containing the dependencies as properties. Match the keys from the
        // 'Received' error output, which reflects what the DI is *actually* providing.
        expect(DomRenderer).toHaveBeenCalledWith(
            expect.objectContaining({
                outputDiv: mockOutputDiv,
                inputElement: mockInputElement,
                titleElement: mockTitleElement,
                eventBus: mockEventBus,
                // ****** THE FIX IS HERE ****** (This was already correct in your provided code)
                validatedEventDispatcher: mockvalidatedEventDispatcher, // Use 'validatedEventDispatcher' key to match the RECEIVED object
                // ******************************
                logger: mockLogger
            })
        );
    });


    it('should inject correct dependencies (including null) into InputHandler when resolved', () => {
        // Arrange
        registerUI(mockContainer, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement
        });

        // Act: Resolve
        mockContainer.resolve(tokens.IInputHandler);

        // Assert: Check arguments passed to the MOCKED InputHandler constructor
        expect(InputHandler).toHaveBeenCalledTimes(1);
        expect(InputHandler).toHaveBeenCalledWith(
            mockInputElement, // First arg: inputElement
            null,             // Second arg: onCommandCallback (explicitly null in registration)
            mockEventBus      // Third arg: eventBus
        );
    });
});