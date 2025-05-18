// src/tests/domUI/actionButtonsRenderer.unsubscription.test.js

import {ActionButtonsRenderer} from '../../domUI/index.js'; // Assuming this path is correct for your project
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// Helper to create a basic DOM element mock
const createMockElement = (tagName = 'DIV') => {
    const elementInstance = {
        tagName: tagName.toUpperCase(),
        nodeType: 1,
        id: '',
        className: '',
        textContent: '',
        children: [],
        classList: {add: jest.fn(), remove: jest.fn(), contains: jest.fn()},
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        removeAttribute: jest.fn(),
        appendChild: jest.fn((child) => {
            elementInstance.children.push(child);
            return child;
        }),
        removeChild: jest.fn((child) => {
            const index = elementInstance.children.indexOf(child);
            if (index > -1) {
                elementInstance.children.splice(index, 1);
            }
            return child;
        }),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        querySelector: jest.fn(),
        innerHTML: '',
        style: {},
        value: '',
        disabled: false,
    };
    Object.defineProperty(elementInstance, 'firstChild', {
        get: function () {
            return elementInstance.children[0] || null;
        }
    });
    return elementInstance;
};

describe('ActionButtonsRenderer Unsubscription', () => {
    let mockLogger;
    let mockDocumentContext;
    let mockValidatedEventDispatcher;
    let mockDomElementFactory;
    let mockActionButtonsContainer;
    let mockSendButtonElement;
    let mockSpeechInputElement;

    beforeEach(() => {
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };
        mockSpeechInputElement = createMockElement('INPUT');
        mockSpeechInputElement.id = 'command-input';

        mockSendButtonElement = createMockElement('BUTTON');
        mockSendButtonElement.id = 'player-confirm-turn-button';

        mockDocumentContext = {
            query: jest.fn(selector => {
                if (selector === '#player-confirm-turn-button') return mockSendButtonElement;
                if (selector === '#command-input') return mockSpeechInputElement;
                return null;
            }),
            create: jest.fn(type => createMockElement(type)), // Added 'create' method
        };

        const mockVEDUnsubscribe = jest.fn();
        mockValidatedEventDispatcher = {
            subscribe: jest.fn().mockReturnValue({unsubscribe: mockVEDUnsubscribe}),
            dispatchValidated: jest.fn().mockResolvedValue(true),
            _mockUnsubscribeFn: mockVEDUnsubscribe,
        };

        mockDomElementFactory = {
            create: jest.fn((type, className) => {
                const el = createMockElement(type);
                if (className) el.className = className;
                return el;
            }),
            button: jest.fn((text, className) => {
                const btn = createMockElement('BUTTON');
                btn.textContent = text;
                if (className) btn.className = className;
                return btn;
            }),
        };

        mockActionButtonsContainer = createMockElement('DIV');
        mockActionButtonsContainer.id = 'action-buttons';
    });

    // createRenderer helper remains largely the same, uses the mockDocumentContext from beforeEach
    const createRendererInstance = () => { // Renamed to avoid confusion with mockDocumentContext.create
        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory,
            actionButtonsContainer: mockActionButtonsContainer,
            sendButtonElement: mockSendButtonElement,
        });
    };

    it('should call unsubscribe on the VED subscription when disposed after a successful subscription', () => {
        const renderer = createRendererInstance();

        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
            'textUI:update_available_actions',
            expect.any(Function)
        );
        expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Failed to subscribe'));

        renderer.dispose();

        expect(mockValidatedEventDispatcher._mockUnsubscribeFn).toHaveBeenCalledTimes(1);
    });

    it('should clear its subscriptions array when disposed', () => {
        const renderer = createRendererInstance();
        renderer.dispose();
        expect(mockValidatedEventDispatcher._mockUnsubscribeFn).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing subscriptions.'));
    });

    it('should remove the click listener from the send button when disposed', () => {
        const renderer = createRendererInstance();
        expect(mockSendButtonElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        const boundHandler = mockSendButtonElement.addEventListener.mock.calls[0][1];
        renderer.dispose();
        expect(mockSendButtonElement.removeEventListener).toHaveBeenCalledWith('click', boundHandler);
    });

    it('should not attempt to call unsubscribe if VED subscription failed (returned null)', () => {
        mockValidatedEventDispatcher.subscribe.mockReturnValue(null); // Override default for this test
        // mockValidatedEventDispatcher._mockUnsubscribeFn remains but won't be part of the null return

        const renderer = createRendererInstance();

        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "[ActionButtonsRenderer] Failed to subscribe to VED event 'textUI:update_available_actions' or subscription object is invalid."
        );

        expect(() => renderer.dispose()).not.toThrow();
        // _mockUnsubscribeFn was part of the original mock, not the one returning null, so it shouldn't be called.
        // The important part is that dispose doesn't try to call .unsubscribe on null.
        expect(mockValidatedEventDispatcher._mockUnsubscribeFn).not.toHaveBeenCalled(); // Explicitly check original mock's fn
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing subscriptions.'));
    });

    it('should not attempt to call unsubscribe if subscription object is invalid (unsubscribe is not a function)', () => {
        mockValidatedEventDispatcher.subscribe.mockReturnValue({unsubscribe: 'not-a-function'});

        const renderer = createRendererInstance();

        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "[ActionButtonsRenderer] Failed to subscribe to VED event 'textUI:update_available_actions' or subscription object is invalid."
        );

        expect(() => renderer.dispose()).not.toThrow();
        expect(mockValidatedEventDispatcher._mockUnsubscribeFn).not.toHaveBeenCalled(); // Original fn not called
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing subscriptions.'));
    });

    it('dispose should be idempotent and not re-process if already disposed', () => {
        const renderer = createRendererInstance();

        renderer.dispose(); // First call
        expect(mockValidatedEventDispatcher._mockUnsubscribeFn).toHaveBeenCalledTimes(1);
        expect(mockSendButtonElement.removeEventListener).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('[ActionButtonsRenderer] ActionButtonsRenderer disposed.');

        mockValidatedEventDispatcher._mockUnsubscribeFn.mockClear();
        mockSendButtonElement.removeEventListener.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();

        renderer.dispose(); // Second call

        expect(mockValidatedEventDispatcher._mockUnsubscribeFn).not.toHaveBeenCalled();
        expect(mockSendButtonElement.removeEventListener).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('[ActionButtonsRenderer] Disposing subscriptions.'));
        expect(mockLogger.info).not.toHaveBeenCalledWith('[ActionButtonsRenderer] ActionButtonsRenderer disposed.');
    });
});