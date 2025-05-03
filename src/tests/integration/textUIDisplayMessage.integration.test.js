// src/tests/integration/textUIDisplayMessage.integration.test.js
// --- REFACTORED for UiMessageRenderer ---
// --- FIX: Added 'create' method to documentContext ---
// --- FIX: Corrected expected log format for UiMessageRenderer ---

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import {JSDOM} from 'jsdom'; // Import JSDOM

// --- System Under Test (SUT) & Core Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js'; // Using EventBus for dispatch
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
// --- NEW: Import the AppendUiMessageHandler & UiMessageRenderer ---
import AppendUiMessageHandler from '../../logic/operationHandlers/appendUiMessageHandler.js';
// --- Remove DomRenderer import as it's no longer directly used by the handler ---
// import DomRenderer from '../../domUI/domRenderer.js';
import {UiMessageRenderer} from '../../domUI/index.js'; // Import the new renderer
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
        if (id === 'player1') return {id: 'player1'}; // Example if actor/target needed
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
// This mock needs to use the *test's* document instance
let mockDomElementFactory; // Define outside beforeEach so it's accessible

// --- Test Data: Event and Rule Definitions (from your prompt) ---
const textUiDisplayMessageEventDef = {
    // ... (keep existing event def) ...
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
                "enum": ["info", "warning", "error", "success", "debug", "command", "location", "system", "system-success", "echo", "fatal"] // Added echo/fatal used by UiMsgRenderer
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
                "message_type": "{event.payload.type}", // Keep original param name
                "allow_html": false
                // 'selector' is intentionally omitted or will be ignored if present
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
describe('Integration Test: textUI:display_message Event Flow (using UiMessageRenderer)', () => {

    // Declare variables needed across tests, initialized in beforeEach/it
    let dom; // JSDOM instance
    let window; // JSDOM window
    let document; // JSDOM document
    let eventBus;
    let mockEntityManager;
    let mockDataRegistry; // Will be created inside 'it' blocks now
    let opRegistry;
    let jsonLogicService; // Holds the instance
    // let domRenderer; // No longer needed for this specific test flow
    let uiMessageRenderer; // Instance of the new renderer
    let appendUiMessageHandler; // Real handler instance
    let operationInterpreter;
    let systemLogicInterpreter; // Will be created inside 'it' blocks now

    /** @type {IDocumentContext} */
    let documentContext; // Wrapper for JSDOM document

    // DOM Elements
    let outputDiv; // Keep reference if needed
    let messageList; // The target UL for messages
    let mainContentDiv; // Parent of messageList

    // --- beforeEach: Setup common mocks and services ---
    beforeEach(() => {
        jest.clearAllMocks();

        // --- NEW: Create JSDOM instance and elements ---
        dom = new JSDOM(`<!DOCTYPE html><html><body>
          <div id="game-container">
            <h1 id="${TITLE_ID}">Initial Title</h1>
            <div id="${MAIN_CONTENT_ID}">
              <ul id="${MESSAGE_LIST_ID}"></ul> </div>
            <div id="${OUTPUT_DIV_ID}"></div> <div id="action-buttons-container"></div>
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
            // --- FIX: Add the missing 'create' method expected by RendererBase ---
            create: (tagName) => document.createElement(tagName),
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


        outputDiv = document.getElementById(OUTPUT_DIV_ID);
        messageList = document.getElementById(MESSAGE_LIST_ID); // Get the new target list
        mainContentDiv = document.getElementById(MAIN_CONTENT_ID);
        // --- End JSDOM Setup ---

        // Instantiate Mocks and Common Services
        mockEntityManager = new MockEntityManager();
        eventBus = new EventBus(); // Real EventBus
        jsonLogicService = new JsonLogicEvaluationService({logger: mockLogger}); // Instantiate here
        opRegistry = new OperationRegistry({logger: mockLogger});

        // --- NEW: Instantiate REAL UiMessageRenderer and Handler ---
        uiMessageRenderer = new UiMessageRenderer({
            logger: mockLogger,
            documentContext: documentContext, // Pass the fixed context
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory // Use the mock factory
        });
        appendUiMessageHandler = new AppendUiMessageHandler({
            logger: mockLogger,
            uiMessageRenderer: uiMessageRenderer // Inject the new renderer
        });
        // --- End NEW Instantiation ---

        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: opRegistry,
            jsonLogicEvaluationService: jsonLogicService, // Provide JsonLogic service
            entityManager: mockEntityManager // Provide EntityManager for context
        });

        // Register the handler (can stay here as it's common)
        // --- NEW: Register the REAL handler instance's execute method ---
        opRegistry.register('APPEND_UI_MESSAGE', appendUiMessageHandler.execute.bind(appendUiMessageHandler));
        // --- End NEW Registration ---
    });

    // --- afterEach: Common cleanup ---
    afterEach(() => {
        jest.restoreAllMocks();
        if (uiMessageRenderer && typeof uiMessageRenderer.dispose === 'function') {
            uiMessageRenderer.dispose(); // Clean up renderer subscriptions
        }
        if (dom) {
            dom.window.close(); // Clean up JSDOM resources
        }
        systemLogicInterpreter = null;
        mockDataRegistry = null;
        uiMessageRenderer = null; // Clear instance
        mockDomElementFactory = null; // Clear mock factory reference
    });

    // --- Test Cases ---

    it('TC1: Happy Path - should append a new message li to the message list', async () => {
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
        systemLogicInterpreter.initialize(); // This sets up subscriptions
        // --- End Test-specific Setup ---

        // Initial check of the DOM elements
        expect(messageList).not.toBeNull();
        expect(messageList.children.length).toBe(0); // Should be empty initially
        expect(outputDiv.children.length).toBe(0); // Old div remains empty

        const messageText = "A wild event appears!";
        const messageType = "info";
        const payload = {text: messageText, type: messageType};

        // --- Ensure mock factory 'li' is called ---
        mockDomElementFactory.li.mockClear(); // Clear any previous calls if tests run sequentially

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async rule processing

        // Assert DOM changes in the correct container (#message-list)
        expect(messageList.children.length).toBe(1); // Check the message list
        const newMessageElement = messageList.children[0];
        expect(newMessageElement.tagName).toBe('LI'); // Should be an LI
        expect(newMessageElement.classList.contains('message')).toBe(true);
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.textContent).toBe(messageText);
        expect(outputDiv.children.length).toBe(0); // Verify old div is still empty

        // --- Verify factory was used ---
        expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);
        expect(mockDomElementFactory.li).toHaveBeenCalledWith(null); // Check args if needed

        // Assert Logs (Updated for UiMessageRenderer/Handler interaction)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Received event: textUI:display_message'),
            expect.objectContaining({payload: payload})
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Processing rule 'system:handle_textUI_display_message'`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[Rule system:handle_textUI_display_message] Executing 1 actions.`)
        );
        // Log from OperationInterpreter about executing the handler
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Executing handler for operation type "APPEND_UI_MESSAGE"')
        );
        // --- Log from AppendUiMessageHandler (Attempt) ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer`),
            expect.objectContaining({text: messageText, type: messageType, allowHtml: false})
        );
        // --- Log from UiMessageRenderer (Actual Rendering) --- FIX: Match actual log format ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[UiMessageRenderer] Rendered message: ${messageType} - ${messageText.substring(0, 50)}...`) // Check UiMessageRenderer's log
        );
        // --- Log from AppendUiMessageHandler (Success Delegation) ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully delegated message rendering to UiMessageRenderer.`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No selector warning in default case
    });


    it('TC3: Allow HTML - should render HTML content when allow_html is true in rule', async () => {
        // --- Test-specific Setup ---
        const ruleWithHtml = {
            ...uiAppendMessageRuleDef,
            actions: [{
                ...uiAppendMessageRuleDef.actions[0],
                parameters: {
                    ...uiAppendMessageRuleDef.actions[0].parameters,
                    allow_html: true // Enable HTML in the rule action
                }
            }]
        };
        mockDataRegistry = new MockDataRegistry([ruleWithHtml], [textUiDisplayMessageEventDef]);
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

        const htmlText = "This is <strong>important</strong>!"; // HTML content
        const messageType = "success";
        const payload = {text: htmlText, type: messageType};

        mockDomElementFactory.li.mockClear(); // Clear factory mock

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(messageList.children.length).toBe(1); // Check message list
        const newMessageElement = messageList.children[0];
        expect(newMessageElement.tagName).toBe('LI'); // Check LI
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.innerHTML).toBe(htmlText); // Assert innerHTML
        const strongTag = newMessageElement.querySelector('strong'); // Check internal structure
        expect(strongTag).not.toBeNull();
        expect(strongTag.textContent).toBe('important');
        expect(outputDiv.children.length).toBe(0); // Verify old div is still empty

        // --- Verify factory was used ---
        expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);

        // Check handler log for allowHtml=true
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer`),
            expect.objectContaining({allowHtml: true, type: messageType})
        );
        // Check UiMessageRenderer log --- FIX: Match actual log format ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[UiMessageRenderer] Rendered message: ${messageType} - ${htmlText.substring(0, 50)}...`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC4: Non-default Selector - should append message to message list (selector ignored)', async () => {
        // --- Test-specific Setup ---
        const specificDivId = 'specific-log-area'; // This ID is still used in the rule...
        // Add the specific div to the JSDOM body (though it won't be targeted)
        const specificDiv = document.createElement('div');
        specificDiv.id = specificDivId;
        document.body.appendChild(specificDiv);

        const ruleWithSelector = {
            ...uiAppendMessageRuleDef,
            actions: [{
                ...uiAppendMessageRuleDef.actions[0],
                parameters: {
                    ...uiAppendMessageRuleDef.actions[0].parameters,
                    selector: `#${specificDivId}` // Target the specific div (will be ignored)
                }
            }]
        };
        mockDataRegistry = new MockDataRegistry([ruleWithSelector], [textUiDisplayMessageEventDef]);
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

        expect(messageList).not.toBeNull();
        expect(specificDiv).not.toBeNull();
        expect(messageList.children.length).toBe(0);
        expect(specificDiv.children.length).toBe(0); // This specific div should remain empty
        expect(outputDiv.children.length).toBe(0); // Default output div should also remain empty

        const messageText = "Targeted message (but selector ignored).";
        const messageType = "debug";
        const payload = {text: messageText, type: messageType};

        mockDomElementFactory.li.mockClear(); // Clear factory mock

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert message appeared in the standard message list, NOT the specific div
        expect(specificDiv.children.length).toBe(0); // Specific div remains empty
        expect(outputDiv.children.length).toBe(0); // Default output div remains empty
        expect(messageList.children.length).toBe(1); // Message is in the correct list

        const newMessageElement = messageList.children[0];
        expect(newMessageElement.tagName).toBe('LI'); // Check LI
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.textContent).toBe(messageText);

        // --- Verify factory was used ---
        expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);

        // Check the handler logs for the specific selector attempt
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer`),
            expect.objectContaining({type: messageType, originalSelector: `#${specificDivId}`}) // Check logged selector
        );
        // --- Check for the WARNING about the ignored selector ---
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: The 'selector' parameter ("#${specificDivId}") is provided but ignored.`)
        );
        // Check UiMessageRenderer log --- FIX: Match actual log format ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[UiMessageRenderer] Rendered message: ${messageType} - ${messageText.substring(0, 50)}...`)
        );
        // Check handler success log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully delegated message rendering to UiMessageRenderer.`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC5: Robustness - should render successfully even if target container selector in params does not exist (selector ignored)', async () => {
        // --- Test-specific Setup ---
        const nonExistentSelector = '#does-not-exist';
        const ruleWithBadSelector = {
            ...uiAppendMessageRuleDef,
            actions: [{
                ...uiAppendMessageRuleDef.actions[0],
                parameters: {
                    ...uiAppendMessageRuleDef.actions[0].parameters,
                    selector: nonExistentSelector // Target a non-existent element (will be ignored)
                }
            }]
        };
        mockDataRegistry = new MockDataRegistry([ruleWithBadSelector], [textUiDisplayMessageEventDef]);
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

        expect(messageList).not.toBeNull();
        expect(document.querySelector(nonExistentSelector)).toBeNull(); // Verify selector doesn't exist

        const messageText = "This message WILL appear despite bad selector";
        const messageType = "warning"; // Changed type for variety
        const payload = {text: messageText, type: messageType};

        mockDomElementFactory.li.mockClear(); // Clear factory mock

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert message WAS added successfully to the standard message list
        expect(messageList.children.length).toBe(1);
        const newMessageElement = messageList.children[0];
        expect(newMessageElement.tagName).toBe('LI');
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.textContent).toBe(messageText);

        // --- Verify factory was used ---
        expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);

        // Check interpreter log first
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Executing handler for operation type "APPEND_UI_MESSAGE"')
        );
        // Check the handler's "Attempting..." log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer`),
            expect.objectContaining({
                text: messageText,
                type: messageType,
                allowHtml: false,
                originalSelector: nonExistentSelector
            })
        );
        // --- Check for the WARNING about the ignored selector ---
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: The 'selector' parameter ("${nonExistentSelector}") is provided but ignored.`)
        );
        // Check UiMessageRenderer log --- FIX: Match actual log format ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[UiMessageRenderer] Rendered message: ${messageType} - ${messageText.substring(0, 50)}...`)
        );
        // --- Assert NO ERRORS were logged ---
        expect(mockLogger.error).not.toHaveBeenCalled();

        // Check that success *was* logged by the handler
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully delegated message rendering to UiMessageRenderer.`)
        );
    });
});