// src/tests/integration/textUIDisplayMessage.integration.test.js

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import {JSDOM} from 'jsdom'; // Import JSDOM

// --- System Under Test (SUT) & Core Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js'; // Using EventBus for dispatch
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
// --- NEW: Import the AppendUiMessageHandler & DomRenderer ---
import AppendUiMessageHandler from '../../logic/operationHandlers/appendUiMessageHandler.js';
import DomRenderer from '../../core/domRenderer.js'; // Import DomRenderer

// --- Type Imports (Optional, for clarity) ---
/** @typedef {import('../../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../../data/schemas/event-definition.schema.json').EventDefinition} EventDefinition */

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
};

// Simple EntityManager Stub (minimal implementation for this test)
class MockEntityManager {
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

// --- Test Data: Event and Rule Definitions (from your prompt) ---
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
                "enum": ["info", "warning", "error", "success", "debug", "command", "location", "system", "system-success"]
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
            }
        }
    ]
};
const OUTPUT_DIV_ID = 'outputDiv';
const INPUT_ID = 'command-input'; // Needed for DomRenderer
const TITLE_ID = 'title-element'; // Needed for DomRenderer

// --- Test Suite ---
describe('Integration Test: textUI:display_message Event Flow', () => {

    // Declare variables needed across tests, initialized in beforeEach/it
    let dom; // JSDOM instance
    let window; // JSDOM window
    let document; // JSDOM document
    let eventBus;
    let mockEntityManager;
    let mockDataRegistry; // Will be created inside 'it' blocks now
    let opRegistry;
    let jsonLogicService; // Holds the instance
    let domRenderer; // Now using the real DomRenderer
    let appendUiMessageHandler; // Real handler instance
    let operationInterpreter;
    let systemLogicInterpreter; // Will be created inside 'it' blocks now

    // DOM Elements
    let outputDiv;
    let inputElement;
    let titleElement;

    // --- beforeEach: Setup common mocks and services ---
    beforeEach(() => {
        jest.clearAllMocks();

        // --- NEW: Create JSDOM instance and elements ---
        dom = new JSDOM(`<!DOCTYPE html><html><body>
          <div id="game-container">
            <h1 id="${TITLE_ID}">Initial Title</h1>
            <div id="${OUTPUT_DIV_ID}"></div>
            <div id="action-buttons-container"></div>
            <input type="text" id="${INPUT_ID}" placeholder="Enter command..." />
          </div>
        </body></html>`);
        window = dom.window;
        document = window.document;
        // Assign to Jest's globals if needed elsewhere, but prefer passing document/window explicitly
        // global.window = window;
        // global.document = document;

        outputDiv = document.getElementById(OUTPUT_DIV_ID);
        inputElement = document.getElementById(INPUT_ID);
        titleElement = document.getElementById(TITLE_ID);
        // --- End JSDOM Setup ---

        // Instantiate Mocks and Common Services
        mockEntityManager = new MockEntityManager();
        eventBus = new EventBus(); // Real EventBus
        jsonLogicService = new JsonLogicEvaluationService({logger: mockLogger}); // Instantiate here
        opRegistry = new OperationRegistry({logger: mockLogger});

        // --- NEW: Instantiate REAL DomRenderer and Handler ---
        domRenderer = new DomRenderer({
            outputDiv: outputDiv,
            inputElement: inputElement,
            titleElement: titleElement,
            eventBus: eventBus, // Pass real eventBus
            validatedEventDispatcher: mockValidatedEventDispatcher, // Pass mock dispatcher
            logger: mockLogger
        });
        appendUiMessageHandler = new AppendUiMessageHandler({
            logger: mockLogger,
            domRenderer: domRenderer // Pass the real DomRenderer instance
        });
        // --- End NEW Instantiation ---

        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: opRegistry,
            jsonLogicEvaluationService: jsonLogicService, // Provide JsonLogic service
            entityManager: mockEntityManager // Provide EntityManager for context
            // Missing worldContext if needed, provide mock if necessary
        });


        // Register the handler (can stay here as it's common)
        // --- NEW: Register the REAL handler instance's execute method ---
        opRegistry.register('APPEND_UI_MESSAGE', appendUiMessageHandler.execute.bind(appendUiMessageHandler));
        // --- End NEW Registration ---
    });

    // --- afterEach: Common cleanup ---
    afterEach(() => {
        jest.restoreAllMocks();
        // Clean up JSDOM window/document if set globally
        // global.window = undefined;
        // global.document = undefined;
        if (dom) {
            dom.window.close(); // Clean up JSDOM resources
        }
        systemLogicInterpreter = null;
        mockDataRegistry = null;
    });

    // --- Test Cases ---

    it('TC1: Happy Path - should append a new message div to the output container', async () => {
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

        // Initial check of the DOM element fetched in beforeEach
        expect(outputDiv).not.toBeNull();
        expect(outputDiv.children.length).toBe(0); // Should be empty initially

        const messageText = "A wild event appears!";
        const messageType = "info";
        const payload = {text: messageText, type: messageType};

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async rule processing

        // Assert DOM changes
        expect(outputDiv.children.length).toBe(1);
        const newMessageElement = outputDiv.children[0];
        expect(newMessageElement.tagName).toBe('DIV');
        expect(newMessageElement.classList.contains('message')).toBe(true);
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.textContent).toBe(messageText);

        // Assert Logs (Updated for DomRenderer/Handler interaction)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Received event: textUI:display_message'),
            expect.objectContaining({payload: payload})
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Processing rule 'system:handle_textUI_display_message'`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[Rule system:handle_textUI_display_message] No condition defined`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[Rule system:handle_textUI_display_message] Executing 1 actions.`)
        );
        // Log from OperationInterpreter about executing the handler
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Executing handler for operation type "APPEND_UI_MESSAGE"')
        );
        // --- Log from AppendUiMessageHandler ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via DomRenderer to selector "#${OUTPUT_DIV_ID}"`),
            expect.objectContaining({text: messageText, type: messageType, allowHtml: false}) // Log includes 'type' key
        );
        // --- Log from AppendUiMessageHandler (success) ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully rendered message via DomRenderer to "#${OUTPUT_DIV_ID}"`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

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

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(outputDiv.children.length).toBe(1);
        const newMessageElement = outputDiv.children[0];
        expect(newMessageElement.classList.contains('message')).toBe(true);
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true); // Check for warning class
        expect(newMessageElement.classList.contains('message-info')).toBe(false); // Check not info class
        expect(newMessageElement.textContent).toBe(messageText);

        // Check handler log for correct type
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via DomRenderer to selector "#${OUTPUT_DIV_ID}"`),
            expect.objectContaining({type: messageType}) // Handler logs 'type'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
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

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(outputDiv.children.length).toBe(1);
        const newMessageElement = outputDiv.children[0];
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.innerHTML).toBe(htmlText); // Assert innerHTML
        const strongTag = newMessageElement.querySelector('strong'); // Check internal structure
        expect(strongTag).not.toBeNull();
        expect(strongTag.textContent).toBe('important');

        // Check handler log for allowHtml=true
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via DomRenderer to selector "#${OUTPUT_DIV_ID}"`),
            expect.objectContaining({allowHtml: true, type: messageType}) // Handler logs 'type'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC4: Non-default Selector - should append message to specified container', async () => {
        // --- Test-specific Setup ---
        const specificDivId = 'specific-log-area';
        // Add the specific div to the JSDOM body for this test
        const specificDiv = document.createElement('div');
        specificDiv.id = specificDivId;
        document.body.appendChild(specificDiv);

        const ruleWithSelector = {
            ...uiAppendMessageRuleDef,
            actions: [{
                ...uiAppendMessageRuleDef.actions[0],
                parameters: {
                    ...uiAppendMessageRuleDef.actions[0].parameters,
                    selector: `#${specificDivId}` // Target the new div
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

        expect(outputDiv).not.toBeNull();
        expect(specificDiv).not.toBeNull();
        expect(outputDiv.children.length).toBe(0);
        expect(specificDiv.children.length).toBe(0);

        const messageText = "Targeted message.";
        const messageType = "debug";
        const payload = {text: messageText, type: messageType};

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert message appeared in the specific div, not the default one
        expect(outputDiv.children.length).toBe(0);
        expect(specificDiv.children.length).toBe(1);

        const newMessageElement = specificDiv.children[0];
        expect(newMessageElement.tagName).toBe('DIV');
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.textContent).toBe(messageText);

        // Check the handler logs for the specific selector
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via DomRenderer to selector "#${specificDivId}"`),
            expect.objectContaining({type: messageType}) // Handler logs 'type'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully rendered message via DomRenderer to "#${specificDivId}"`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC5: Robustness - should log error if target container does not exist', async () => {
        // --- Test-specific Setup ---
        const nonExistentSelector = '#does-not-exist';
        const ruleWithBadSelector = {
            ...uiAppendMessageRuleDef,
            actions: [{
                ...uiAppendMessageRuleDef.actions[0],
                parameters: {
                    ...uiAppendMessageRuleDef.actions[0].parameters,
                    selector: nonExistentSelector // Target a non-existent element
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

        expect(outputDiv).not.toBeNull();
        expect(document.querySelector(nonExistentSelector)).toBeNull(); // Verify selector doesn't exist

        const messageText = "This message won't appear";
        const messageType = "error";
        const payload = {text: messageText, type: messageType};
        // Define expected params for the handler's "Attempting" log
        const expectedParamsForAttemptLog = {
            text: messageText,
            type: messageType, // Handler logs 'type'
            allowHtml: false
        };
        // Define expected params object for the *rule action* parameters
        const expectedParamsInRuleAction = {
            text: messageText,
            message_type: messageType, // Rule uses 'message_type'
            allow_html: false,
            selector: nonExistentSelector
        };


        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert no message was added to the default div
        expect(outputDiv.children.length).toBe(0);

        // Check interpreter log first
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Executing handler for operation type "APPEND_UI_MESSAGE"')
        );
        // Check the handler's "Attempting..." log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message via DomRenderer to selector "${nonExistentSelector}"`),
            expect.objectContaining(expectedParamsForAttemptLog) // Uses 'type'
        );

        // --- Assert Error Log from DomRenderer ---
        // DomRenderer logs the error when the selector finds nothing
        expect(mockLogger.error).toHaveBeenCalledWith(
            `DomRenderer.renderMessage: Selector "${nonExistentSelector}" did not match any element.`
        );
        // --- Assert Error Log from AppendUiMessageHandler (optional, confirms failure) ---
        expect(mockLogger.error).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Failed to render via DomRenderer.'
        );

        // Check that success wasn't logged by the handler
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully rendered message via DomRenderer to "${nonExistentSelector}"`)
        );
    });
});