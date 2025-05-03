// src/tests/integration/textUIDisplayMessage.TC2.integration.test.js
// --- Contains only TC2 and necessary setup for isolation ---
// --- REFACTORED to use UiMessageRenderer ---

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import {JSDOM} from 'jsdom'; // Import JSDOM

// --- System Under Test (SUT) & Core Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js'; // Using EventBus for dispatch
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
// --- Import the AppendUiMessageHandler & UiMessageRenderer ---
import AppendUiMessageHandler from '../../logic/operationHandlers/appendUiMessageHandler.js';
// --- Remove DomRenderer import ---
// import DomRenderer from '../../domUI/domRenderer.js';
import {UiMessageRenderer} from '../../domUI/uiMessageRenderer.js'; // Import the new renderer
import DomElementFactory from "../../domUI/domElementFactory.js"; // Needed by UiMessageRenderer


// --- Type Imports (Optional, for clarity) ---
/** @typedef {import('../../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../../data/schemas/event-definition.schema.json').EventDefinition} EventDefinition */
/** @typedef {import('../../domUI/IDocumentContext').IDocumentContext} IDocumentContext */


// --- Mocked Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// Mock ValidatedEventDispatcher
const mockValidatedEventDispatcher = {
    dispatchValidated: jest.fn().mockResolvedValue(true), // Assume success by default
    subscribe: jest.fn(() => ({unsubscribe: jest.fn()})), // Mock subscribe for UiMessageRenderer
};

// Simple EntityManager Stub (minimal implementation for this test)
class MockEntityManager {
    // ... (keep existing MockEntityManager code) ...
    getEntityInstance(id) {
        if (id === 'player1') return {id: 'player1'};
        return undefined;
    }

    getComponentData(entityId, componentType) {
        return undefined;
    }

    hasComponent(entityId, componentType) {
        return false;
    }

    addComponent() {
    }

    removeComponent() {
    }
}

// Simple DataRegistry Stub
class MockDataRegistry {
    // ... (keep existing MockDataRegistry code) ...
    /** @param {SystemRule[]} rules */
    /** @param {EventDefinition[]} eventDefs */
    constructor(rules, eventDefs) {
        this._rules = rules || [];
        this._eventDefs = new Map((eventDefs || []).map(def => [def.id, def]));
    }

    getAllSystemRules() {
        return this._rules;
    }

    getEventDefinition(eventTypeId) {
        return this._eventDefs.get(eventTypeId);
    }
}

// --- Mock DomElementFactory ---
let mockDomElementFactory;

// --- Test Data: Event and Rule Definitions (Adjusted enum if needed) ---
const textUiDisplayMessageEventDef = {
    "$schema": "http://example.com/schemas/event-definition.schema.json#",
    "id": "textUI:display_message",
    "description": "Used extensively throughout action handlers and systems to send textual feedback to the user interface.",
    "payloadSchema": {
        "type": "object",
        "description": "Payload for the textUI:display_message event.",
        "properties": {
            "text": {"type": "string", "description": "The message content."},
            "type": {
                "type": "string",
                "description": "A category hint.",
                // Ensure all types used by UiMessageRenderer/tests are here
                "enum": ["info", "warning", "error", "success", "debug", "command", "location", "system", "system-success", "echo", "fatal"]
            }
        },
        "required": ["text", "type"],
        "additionalProperties": false
    }
};
const uiAppendMessageRuleDef = {
    "rule_id": "system:handle_textUI_display_message",
    "event_type": "textUI:display_message",
    "actions": [
        {
            "type": "APPEND_UI_MESSAGE",
            "comment": "Displays the message from the event payload in the UI.",
            "parameters": {
                "text": "{event.payload.text}",
                "message_type": "{event.payload.type}",
                "allow_html": false
            }
        }
    ]
};
// --- Constants for DOM elements ---
const OUTPUT_DIV_ID = 'outputDiv'; // Keep for reference if needed elsewhere
const INPUT_ID = 'command-input'; // Needed for DomRenderer (if still used for other things)
const TITLE_ID = 'title-element'; // Needed for DomRenderer (if still used for other things)
const MESSAGE_LIST_ID = 'message-list'; // ID used by UiMessageRenderer
const MAIN_CONTENT_ID = 'main-content'; // Parent for message list


// --- Test Suite ---
describe('Integration Test: textUI:display_message Event Flow - TC2 Isolated', () => {

    // Declare variables needed across tests, initialized in beforeEach/it
    let dom; // JSDOM instance
    let window; // JSDOM window
    let document; // JSDOM document
    let eventBus;
    let mockEntityManager;
    let mockDataRegistry;
    let opRegistry;
    let jsonLogicService;
    // Remove domRenderer reference
    // let domRenderer;
    let uiMessageRenderer; // Add UiMessageRenderer reference
    let appendUiMessageHandler;
    let operationInterpreter;
    let systemLogicInterpreter;

    /** @type {IDocumentContext} */ // Add documentContext reference
    let documentContext;

    // DOM Elements
    let outputDiv; // Keep reference to original if needed for checks
    let messageList; // Add reference to message list

    // --- beforeEach: Setup common mocks and services ---
    beforeEach(() => {
        jest.clearAllMocks();

        // --- Create JSDOM instance and elements ---
        dom = new JSDOM(`<!DOCTYPE html><html><body>
          <div id="game-container">
            <h1 id="${TITLE_ID}">Initial Title</h1>
            <div id="${MAIN_CONTENT_ID}"> <ul id="${MESSAGE_LIST_ID}"></ul> </div> <div id="${OUTPUT_DIV_ID}"></div> <div id="action-buttons-container"></div>
            <input type="text" id="${INPUT_ID}" placeholder="Enter command..." />
          </div>
        </body></html>`);
        window = dom.window;
        document = window.document; // Assign the test's document instance

        // --- Create Document Context Wrapper ---
        documentContext = {
            getDocument: () => document,
            query: (selector) => document.querySelector(selector),
            queryAll: (selector) => document.querySelectorAll(selector),
            getElementById: (id) => document.getElementById(id),
            create: (tagName) => document.createElement(tagName), // Add create method
        };
        // --- End Document Context ---

        // --- Define Mock DomElementFactory *after* document is created ---
        mockDomElementFactory = {
            create: jest.fn((tag, id = null, classes = [], attributes = {}) => {
                const element = document.createElement(tag); // Use the *correct* document instance
                if (id) element.id = id;
                if (Array.isArray(classes) && classes.length > 0) element.classList.add(...classes);
                Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
                return element;
            }),
            ul: jest.fn((id = null, classes = []) => mockDomElementFactory.create('ul', id, classes)),
            li: jest.fn((id = null, classes = []) => mockDomElementFactory.create('li', id, classes)),
        };

        // Get references to DOM elements
        outputDiv = document.getElementById(OUTPUT_DIV_ID);
        messageList = document.getElementById(MESSAGE_LIST_ID); // Get message list

        // Instantiate Mocks and Common Services
        mockEntityManager = new MockEntityManager();
        eventBus = new EventBus(); // Real EventBus
        jsonLogicService = new JsonLogicEvaluationService({logger: mockLogger});
        opRegistry = new OperationRegistry({logger: mockLogger});

        // --- Instantiate REAL UiMessageRenderer and Handler ---
        uiMessageRenderer = new UiMessageRenderer({ // Instantiate UiMessageRenderer
            logger: mockLogger,
            documentContext: documentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory
        });
        appendUiMessageHandler = new AppendUiMessageHandler({ // Inject uiMessageRenderer correctly
            logger: mockLogger,
            uiMessageRenderer: uiMessageRenderer
        });
        // --- End Instantiation ---

        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: opRegistry,
            jsonLogicEvaluationService: jsonLogicService,
            entityManager: mockEntityManager
        });

        // Register the handler
        opRegistry.register('APPEND_UI_MESSAGE', appendUiMessageHandler.execute.bind(appendUiMessageHandler));
    });

    // --- afterEach: Common cleanup ---
    afterEach(() => {
        jest.restoreAllMocks();
        if (uiMessageRenderer && typeof uiMessageRenderer.dispose === 'function') {
            uiMessageRenderer.dispose();
        }
        if (dom) {
            dom.window.close();
        }
        systemLogicInterpreter = null;
        mockDataRegistry = null;
        uiMessageRenderer = null;
        mockDomElementFactory = null;
    });

    // --- Test Case (TC2 Only) ---

    it('TC2: Different Message Type - should apply the correct CSS class', async () => {
        // --- Test-specific Setup ---
        mockDataRegistry = new MockDataRegistry([uiAppendMessageRuleDef], [textUiDisplayMessageEventDef]);
        systemLogicInterpreter = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: eventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: jsonLogicService,
            entityManager: mockEntityManager,
            operationInterpreter: operationInterpreter
        });
        systemLogicInterpreter.initialize();
        // --- End Test-specific Setup ---

        const messageText = "Something went slightly wrong.";
        const messageType = "warning"; // Use a different type
        const payload = {text: messageText, type: messageType};

        mockDomElementFactory.li.mockClear(); // Clear factory mock

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // --- Remove or comment out old console.log debug sections if no longer needed ---
        // console.log('--- TC2 LOGGER DEBUG (Isolated File) ---'); ...
        // console.log('--- TC2 DOM DEBUG (Isolated File) ---'); ...

        // --- Assertions updated for UiMessageRenderer ---
        expect(messageList.children.length).toBe(1); // Check the message list
        const newMessageElement = messageList.children[0];
        expect(newMessageElement.tagName).toBe('LI'); // Should be an LI

        expect(newMessageElement.classList.contains('message')).toBe(true);
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true); // Check for warning class
        expect(newMessageElement.classList.contains('message-info')).toBe(false); // Check NOT info class
        expect(newMessageElement.textContent).toBe(messageText);
        expect(outputDiv.children.length).toBe(0); // Ensure old div remains empty

        // --- Verify factory was used ---
        expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);

        // --- Check Logs (Updated Formats) ---
        // Check AppendUiMessageHandler Attempt log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer`),
            expect.objectContaining({
                text: messageText,
                type: messageType, // Check the correct type is logged here
                allowHtml: false
            })
        );
        // Check UiMessageRenderer Rendered log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[UiMessageRenderer] Rendered message: ${messageType} - ${messageText.substring(0, 50)}...`)
        );
        // Check AppendUiMessageHandler Success log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully delegated message rendering to UiMessageRenderer.`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No selector warning expected here
    });

});