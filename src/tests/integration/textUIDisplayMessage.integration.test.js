// src/tests/integration/textUIDisplayMessage.integration.test.js

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';

// --- System Under Test (SUT) & Core Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js'; // Using EventBus for dispatch
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
// --- NEW: Import the AppendUiMessageHandler ---
import AppendUiMessageHandler from '../../logic/operationHandlers/appendUiMessageHandler.js';
// Supporting modules implicitly used by the above (keep if needed)
// import * as contextAssembler from '../../logic/contextAssembler.js';
// import * as contextUtils from '../../logic/contextUtils.js';

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
const textUiDisplayMessageEventDef = { /* ... as before ... */
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
                "enum": ["info", "warning", "error", "success", /* ... other types */ "debug"]
            }
        },
        "required": ["text", "type"],
        "additionalProperties": false
    }
};
const uiAppendMessageRuleDef = { /* ... as before ... */
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
const OUTPUT_DIV_ID = 'outputDiv';

// --- Test Suite ---
describe('Integration Test: textUI:display_message Event Flow', () => {

    // Declare variables needed across tests, initialized in beforeEach/it
    let eventBus;
    let mockEntityManager;
    let mockDataRegistry; // Will be created inside 'it' blocks now
    let opRegistry;
    let jsonLogicService; // Holds the instance
    let appendUiMessageHandler;
    let operationInterpreter;
    let systemLogicInterpreter; // Will be created inside 'it' blocks now

    // --- beforeEach: Setup common mocks and services ---
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset DOM
        document.body.innerHTML = `<div id="${OUTPUT_DIV_ID}"></div>`;

        // Instantiate Mocks and Common Services
        mockEntityManager = new MockEntityManager();
        eventBus = new EventBus();
        jsonLogicService = new JsonLogicEvaluationService({logger: mockLogger}); // Instantiate here
        opRegistry = new OperationRegistry({logger: mockLogger});
        appendUiMessageHandler = new AppendUiMessageHandler({logger: mockLogger});
        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: opRegistry
        });

        // Register the handler (can stay here as it's common)
        opRegistry.register('APPEND_UI_MESSAGE', appendUiMessageHandler.execute.bind(appendUiMessageHandler));
    });

    // --- afterEach: Common cleanup ---
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
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
        systemLogicInterpreter.initialize();
        // --- End Test-specific Setup ---

        const outputDiv = document.getElementById(OUTPUT_DIV_ID);
        expect(outputDiv).not.toBeNull();
        expect(outputDiv.children.length).toBe(0);

        const messageText = "A wild event appears!";
        const messageType = "info";
        const payload = {text: messageText, type: messageType};

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(outputDiv.children.length).toBe(1);
        const newMessageElement = outputDiv.children[0];
        expect(newMessageElement.tagName).toBe('DIV');
        expect(newMessageElement.classList.contains('message')).toBe(true);
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.textContent).toBe(messageText);

        // Assert Logs
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
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Executing handler for operation type "APPEND_UI_MESSAGE"')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message to selector "#${OUTPUT_DIV_ID}"`),
            expect.objectContaining({text: messageText, type: messageType, allowHtml: false}) // Key is 'type' here, matching handler log
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully appended message to "#${OUTPUT_DIV_ID}"`)
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

        const outputDiv = document.getElementById(OUTPUT_DIV_ID);
        const messageText = "Something went slightly wrong.";
        const messageType = "warning";
        const payload = {text: messageText, type: messageType};

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(outputDiv.children.length).toBe(1);
        const newMessageElement = outputDiv.children[0];
        expect(newMessageElement.classList.contains('message')).toBe(true);
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.classList.contains('message-info')).toBe(false);
        expect(newMessageElement.textContent).toBe(messageText);

        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message to selector "#${OUTPUT_DIV_ID}"`),
            expect.objectContaining({type: messageType}) // Key is 'type'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC3: Allow HTML - should render HTML content when allow_html is true in rule', async () => {
        // --- Test-specific Setup ---
        const ruleWithHtml = { /* ... */
            ...uiAppendMessageRuleDef,
            actions: [{
                ...uiAppendMessageRuleDef.actions[0],
                parameters: {
                    ...uiAppendMessageRuleDef.actions[0].parameters,
                    allow_html: true
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

        const outputDiv = document.getElementById(OUTPUT_DIV_ID);
        const htmlText = "This is <strong>important</strong>!";
        const messageType = "success";
        const payload = {text: htmlText, type: messageType};

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(outputDiv.children.length).toBe(1);
        const newMessageElement = outputDiv.children[0];
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.innerHTML).toBe(htmlText);
        const strongTag = newMessageElement.querySelector('strong');
        expect(strongTag).not.toBeNull();
        expect(strongTag.textContent).toBe('important');

        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message to selector "#${OUTPUT_DIV_ID}"`),
            expect.objectContaining({allowHtml: true, type: messageType}) // Key is 'type'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC4: Non-default Selector - should append message to specified container', async () => {
        // --- Test-specific Setup ---
        const specificDivId = 'specific-log-area';
        document.body.innerHTML = `
            <div id="${OUTPUT_DIV_ID}"></div>
            <div id="${specificDivId}"></div>
        `;
        const ruleWithSelector = { /* ... */
            ...uiAppendMessageRuleDef,
            actions: [{
                ...uiAppendMessageRuleDef.actions[0],
                parameters: {
                    ...uiAppendMessageRuleDef.actions[0].parameters,
                    selector: `#${specificDivId}`
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

        const outputDiv = document.getElementById(OUTPUT_DIV_ID);
        const specificDiv = document.getElementById(specificDivId);
        expect(outputDiv).not.toBeNull();
        expect(specificDiv).not.toBeNull();
        expect(outputDiv.children.length).toBe(0);
        expect(specificDiv.children.length).toBe(0);

        const messageText = "Targeted message.";
        const messageType = "debug";
        const payload = {text: messageText, type: messageType};

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(outputDiv.children.length).toBe(0);
        expect(specificDiv.children.length).toBe(1);

        const newMessageElement = specificDiv.children[0];
        expect(newMessageElement.tagName).toBe('DIV');
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true);
        expect(newMessageElement.textContent).toBe(messageText);

        // Check the "Attempting..." log with correct 'type' key
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message to selector "#${specificDivId}"`),
            expect.objectContaining({type: messageType}) // Key is 'type'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully appended message to "#${specificDivId}"`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC5: Robustness - should log error if target container does not exist', async () => {
        // --- Test-specific Setup ---
        const nonExistentSelector = '#does-not-exist';
        const ruleWithBadSelector = { /* ... */
            ...uiAppendMessageRuleDef,
            actions: [{
                ...uiAppendMessageRuleDef.actions[0],
                parameters: {
                    ...uiAppendMessageRuleDef.actions[0].parameters,
                    selector: nonExistentSelector
                }
            }]
        };
        // Define expected params object *before* using it in assertion
        // --- FIX: Use 'type' key to match the handler's log call ---
        const expectedParamsForLogs = {
            text: "This message won't appear", // Resolved value
            type: "error", // Key is 'type'
            allowHtml: false
            // Selector is not included in the object logged by the handler's debug call
            // It's only part of the string message for the debug call.
            // For the error log, selector is part of the params sub-object.
        };
        // --- End Fix ---
        // Define params specifically for the error log assertion
        const expectedParamsInErrorLog = {
            text: "This message won't appear",
            message_type: "error", // Parameter name from rule
            allow_html: false,
            selector: nonExistentSelector // Parameter name from rule
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

        const outputDiv = document.getElementById(OUTPUT_DIV_ID);
        expect(outputDiv).not.toBeNull();
        expect(document.querySelector(nonExistentSelector)).toBeNull();

        const payload = {text: "This message won't appear", type: "error"};

        await eventBus.dispatch('textUI:display_message', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(outputDiv.children.length).toBe(0);

        // Check interpreter log first
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Executing handler for operation type "APPEND_UI_MESSAGE"')
        );
        // Check the handler's "Attempting..." log
        // --- FIX: Use corrected expected object (expectedParamsForLogs) ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Attempting to append message to selector "${nonExistentSelector}"`),
            expect.objectContaining(expectedParamsForLogs)
        );
        // --- End Fix ---

        // Check the error log
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        // Use the params object specific to the error log context
        expect(mockLogger.error).toHaveBeenCalledWith(`APPEND_UI_MESSAGE: Container element not found for selector "${nonExistentSelector}". Cannot append message.`);

        // Check that success wasn't logged
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining(`APPEND_UI_MESSAGE: Successfully appended message to "${nonExistentSelector}"`)
        );
    });
});