// src/core/config/registrations/uiRegistrations.test.js

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
import {tokens} from '../../../../core/tokens.js';

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
    subscribe: jest.fn(), publish: jest.fn(),
};
const mockValidatedDispatcher = {
    dispatch: jest.fn(), dispatchValidated: jest.fn().mockResolvedValue(true), // Add mock for dispatchValidated if needed by DomRenderer mock interaction later
};

// Simple mock objects are sufficient now as they won't hit real constructor validation
const mockOutputDiv = {id: 'output'};
const mockInputElement = {id: 'input'};
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
                throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}`);
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
        // Reset mocks defined via jest.mock
        jest.clearAllMocks(); // Clears calls to DomRenderer, InputHandler mocks etc.

        mockContainer = createMockContainer();

        // Pre-register dependency mocks (unchanged)
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ValidatedEventDispatcher, mockValidatedDispatcher, {lifecycle: 'singleton'});

        // Clear other mocks (unchanged)
        Object.values(mockLogger).forEach(fn => fn.mockClear?.());
        Object.values(mockEventBus).forEach(fn => fn.mockClear?.());
        Object.values(mockValidatedDispatcher).forEach(fn => fn.mockClear?.());
        // Don't clear mockContainer mocks here, clear them specifically or use clearAllMocks
    });

    // afterEach: jest.restoreAllMocks() is good practice if using jest.spyOn,
    // but jest.clearAllMocks() in beforeEach handles jest.mock resets.

    it('should register outputDiv, inputElement, and titleElement as instances', () => {
        // Arrange
        registerUI(mockContainer, {
            outputDiv: mockOutputDiv,
            inputElement: mockInputElement,
            titleElement: mockTitleElement
        });

        // Assert: Check registration calls (unchanged)
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.outputDiv, mockOutputDiv, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.inputElement, mockInputElement, expect.objectContaining({lifecycle: 'singleton'}));
        expect(mockContainer.register).toHaveBeenCalledWith(tokens.titleElement, mockTitleElement, expect.objectContaining({lifecycle: 'singleton'}));

        // Assert: Check resolution (unchanged)
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
        const handlerRegArgs = mockContainer.register.mock.calls.find(call => call[0] === tokens.InputHandler);
        expect(handlerRegArgs).toBeDefined();
        expect(typeof handlerRegArgs[1]).toBe('function');
        expect(handlerRegArgs[2]).toEqual(expect.objectContaining({lifecycle: 'singleton'}));

        // Act: Resolve twice
        const handler1 = mockContainer.resolve(tokens.InputHandler);
        const handler2 = mockContainer.resolve(tokens.InputHandler);

        // Assert: Singleton check
        expect(handler1).toBeDefined();
        expect(handler1).toBe(handler2);
        // Assert: Check that the MOCKED InputHandler constructor was called only once
        expect(InputHandler).toHaveBeenCalledTimes(1); // Check the mock constructor
        expect(mockLogger.info).toHaveBeenCalledWith('UI Registrations: Registered InputHandler.');
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
        expect(DomRenderer).toHaveBeenCalledWith(
            mockOutputDiv,
            mockInputElement,
            mockTitleElement,
            mockEventBus,
            mockValidatedDispatcher,
            mockLogger
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
        mockContainer.resolve(tokens.InputHandler);

        // Assert: Check arguments passed to the MOCKED InputHandler constructor
        expect(InputHandler).toHaveBeenCalledTimes(1);
        expect(InputHandler).toHaveBeenCalledWith(
            mockInputElement,
            null,
            mockEventBus
        );
    });
});