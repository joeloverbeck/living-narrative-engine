// src/tests/integration/textUIDisplayMessage.TC2.integration.test.js
// --- Contains only TC2 and necessary setup for isolation ---

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import {JSDOM} from 'jsdom'; // Import JSDOM

// --- System Under Test (SUT) & Core Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js'; // Using EventBus for dispatch
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
// --- Import the AppendUiMessageHandler & DomRenderer ---
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
describe('Integration Test: textUI:display_message Event Flow - TC2 Isolated', () => {

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

    // --- Test Case (TC2 Only) ---

    it('TC2: Different Message Type - should apply the correct CSS class', async () => {
        // --- Test-specific Setup ---
        // Note: Uses the same setup as before, ensuring relevant services are initialized
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

        // --- DEBUG: Inspect mockLogger.debug calls ---
        console.log('--- TC2 LOGGER DEBUG (Isolated File) ---');
        mockLogger.debug.mock.calls.forEach((callArgs, index) => {
            // Log the data object (second argument) if it exists and relates to APPEND_UI_MESSAGE handler logs
            if (typeof callArgs[0] === 'string' && callArgs[0].includes('APPEND_UI_MESSAGE') && callArgs.length > 1) {
                console.log(`Call ${index}: ${callArgs[0]}`, callArgs[1]);
            } else if (typeof callArgs[0] === 'string' && callArgs[0].includes('APPEND_UI_MESSAGE')) {
                console.log(`Call ${index}: ${callArgs[0]}`); // Log message if no data object
            }
            // Optional: Log other debug messages too if needed
            // else { console.log(`Call ${index}: ${callArgs[0]}`); }
        });
        console.log('--- END TC2 LOGGER DEBUG (Isolated File) ---');
        // --- END DEBUG ---

        expect(outputDiv.children.length).toBe(1);
        const newMessageElement = outputDiv.children[0];

        // --- DEBUG: DOM Inspection ---
        console.log('--- TC2 DOM DEBUG (Isolated File) ---');
        console.log('Element:', newMessageElement.outerHTML);
        console.log('Expected class:', `message-${messageType}`);
        console.log('Actual className:', newMessageElement.className);
        console.log('Actual classList:', newMessageElement.classList);
        console.log('--- END TC2 DOM DEBUG (Isolated File) ---');
        // --- END DEBUG ---

        expect(newMessageElement.classList.contains('message')).toBe(true);
        expect(newMessageElement.classList.contains(`message-${messageType}`)).toBe(true); // Check for warning class (Failing Line)
        expect(newMessageElement.classList.contains('message-info')).toBe(false); // Check NOT info class
        expect(newMessageElement.textContent).toBe(messageText);

        // Check handler log for correct type (Refined Assertion)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('APPEND_UI_MESSAGE: Attempting to append message via DomRenderer'), // Match the message part
            expect.objectContaining({ // Ensure the logged object contains these exact key-value pairs
                text: messageText,
                type: "warning", // Explicitly check for "warning" type in the log
                allowHtml: false
            })
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

});