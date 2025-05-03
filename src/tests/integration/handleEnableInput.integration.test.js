// src/tests/integration/handleEnableInput.integration.test.js

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import {JSDOM} from 'jsdom'; // Import JSDOM

// --- System Under Test (SUT) & Core Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
// --- NEW: Import ModifyDomElementHandler & DomRenderer ---
import ModifyDomElementHandler from '../../logic/operationHandlers/modifyDomElementHandler.js';
import DomRenderer from '../../core/domRenderer.js';

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

// Simple EntityManager Stub
class MockEntityManager {
    getEntityInstance(id) {
        return undefined;
    }

    getComponentData(entityId, componentType) {
        return undefined;
    }

    hasComponent(entityId, componentType) {
        return false;
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

// --- Test Data: Event and Rule Definitions ---
const textUiEnableInputEventDef = {
    "$schema": "http://example.com/schemas/event-definition.schema.json",
    "id": "textUI:enable_input",
    "description": "Signals the UI to enable the command input field...",
    "payloadSchema": {
        "type": "object",
        "properties": {
            "placeholder": {"type": "string", "description": "Placeholder text."},
            // Add other potential properties if needed by the schema
        },
        // No required properties needed for this test's focus
        "additionalProperties": true // Allow other properties like 'focus' if present
    }
};

const handleEnableInputRuleDef = {
    "rule_id": "handle_enable_input",
    "comment": "Handles the textUI:enable_input event...",
    "event_type": "textUI:enable_input",
    "actions": [
        {
            "type": "MODIFY_DOM_ELEMENT",
            "comment": "Enable the command input field...",
            "parameters": {"selector": "#command-input", "property": "disabled", "value": false}
        },
        {
            "type": "MODIFY_DOM_ELEMENT",
            "comment": "Set the placeholder text...",
            "parameters": {
                "selector": "#command-input",
                "property": "placeholder",
                "value": "{event.payload.placeholder}"
            }
        }
    ]
};

const INPUT_ID = 'command-input';
const INITIAL_PLACEHOLDER = 'Waiting...';
const UNRESOLVED_PLACEHOLDER_STRING = '{event.payload.placeholder}';
const OUTPUT_DIV_ID = 'outputDiv'; // Needed for DomRenderer
const TITLE_ID = 'title-element'; // Needed for DomRenderer

// --- Test Suite ---
describe('Integration Test: handle_enable_input Rule Flow', () => {

    // JSDOM variables
    let dom;
    let window;
    let document;
    // Core service variables
    let eventBus;
    let mockEntityManager;
    let mockDataRegistry;
    let opRegistry;
    let jsonLogicService;
    let domRenderer; // REAL DomRenderer instance
    let modifyDomHandler; // REAL ModifyDomElementHandler instance
    let operationInterpreter;
    let systemLogicInterpreter;
    // DOM Elements
    let commandInput;
    let outputDiv;
    let titleElement;

    beforeEach(() => {
        jest.clearAllMocks();

        // --- NEW: Create JSDOM instance and elements ---
        dom = new JSDOM(`<!DOCTYPE html><html><body>
          <div id="game-container">
             <h1 id="${TITLE_ID}">Initial Title</h1>
             <div id="${OUTPUT_DIV_ID}"></div>
             <div id="action-buttons-container"></div>
             <input type="text" id="${INPUT_ID}" disabled placeholder="${INITIAL_PLACEHOLDER}">
           </div>
         </body></html>`);
        window = dom.window;
        document = window.document;

        // Get references to DOM elements
        commandInput = document.getElementById(INPUT_ID);
        outputDiv = document.getElementById(OUTPUT_DIV_ID);
        titleElement = document.getElementById(TITLE_ID);
        // --- End JSDOM Setup ---

        // Instantiate Mocks and Common Services
        mockEntityManager = new MockEntityManager();
        mockDataRegistry = new MockDataRegistry([handleEnableInputRuleDef], [textUiEnableInputEventDef]); // Setup registry for the rule
        eventBus = new EventBus();
        jsonLogicService = new JsonLogicEvaluationService({logger: mockLogger});
        opRegistry = new OperationRegistry({logger: mockLogger});

        // --- NEW: Instantiate REAL DomRenderer and ModifyDomElementHandler ---
        domRenderer = new DomRenderer({
            outputDiv: outputDiv,
            inputElement: commandInput, // Pass the real input element
            titleElement: titleElement,
            eventBus: eventBus,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            logger: mockLogger
        });
        modifyDomHandler = new ModifyDomElementHandler({
            logger: mockLogger,
            domRenderer: domRenderer // Pass the real DomRenderer
        });
        // --- End NEW Instantiation ---

        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: opRegistry,
            jsonLogicEvaluationService: jsonLogicService, // Provide JsonLogic service
            entityManager: mockEntityManager // Provide EntityManager for context
            // Provide mock worldContext if needed
        });

        // --- NEW: Register the REAL handler instance ---
        opRegistry.register('MODIFY_DOM_ELEMENT', modifyDomHandler.execute.bind(modifyDomHandler));
        // --- End NEW Registration ---

        // Instantiate SUT (SystemLogicInterpreter)
        systemLogicInterpreter = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: eventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: jsonLogicService,
            entityManager: mockEntityManager,
            operationInterpreter: operationInterpreter
        });
        systemLogicInterpreter.initialize(); // Subscribe SUT to EventBus
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (dom) {
            dom.window.close(); // Clean up JSDOM
        }
        systemLogicInterpreter = null; // Help GC
        mockDataRegistry = null;
    });

    // --- Test Cases ---

    it('TC1: Happy Path - should enable the input and set its placeholder', async () => {
        expect(commandInput.disabled).toBe(true); // Verify initial state
        expect(commandInput.placeholder).toBe(INITIAL_PLACEHOLDER);

        const newPlaceholder = "Enter your command...";
        const payload = {placeholder: newPlaceholder};

        await eventBus.dispatch(textUiEnableInputEventDef.id, payload);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async processing

        // Assert DOM changes
        expect(commandInput.disabled).toBe(false);
        expect(commandInput.placeholder).toBe(newPlaceholder);

        // Assert Logs (check that the handler was called via interpreter logs and handler logs)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[Rule ${handleEnableInputRuleDef.rule_id}] No condition defined`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`[Rule ${handleEnableInputRuleDef.rule_id}] Executing 2 actions.`)
        );
        // Action 1 (disable=false)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"disabled","value":false`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Modified property "disabled" on 1 element(s)`) // Check DomRenderer success log
        );
        // Action 2 (placeholder)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"placeholder","value":"${newPlaceholder}"`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Modified property "placeholder" on 1 element(s)`) // Check DomRenderer success log
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('TC2: Edge Case - should handle empty string placeholder', async () => {
        const emptyPlaceholder = "";
        const payload = {placeholder: emptyPlaceholder};

        await eventBus.dispatch(textUiEnableInputEventDef.id, payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(commandInput.disabled).toBe(false);
        expect(commandInput.placeholder).toBe(emptyPlaceholder); // Should be set to empty string
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check handler log for placeholder
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"placeholder","value":""`) // Value should be empty string
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Modified property "placeholder" on 1 element(s)`) // Check DomRenderer success log
        );
    });

    it('TC3: Edge Case - should handle null placeholder (sets placeholder to "null" string)', async () => {
        const nullPlaceholder = null;
        const payload = {placeholder: nullPlaceholder};

        await eventBus.dispatch(textUiEnableInputEventDef.id, payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(commandInput.disabled).toBe(false);
        expect(commandInput.placeholder).toBe("null"); // DOM elements treat null attribute value as the string "null"
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check handler log for placeholder
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"placeholder","value":null`) // Value passed as null
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Modified property "placeholder" on 1 element(s)`) // Check DomRenderer success log
        );
    });

    it('TC4: Robustness - should log warning if target element is missing', async () => {
        commandInput.remove(); // Remove the input element from JSDOM
        expect(document.getElementById(INPUT_ID)).toBeNull(); // Verify removal

        const placeholderText = "This won't appear";
        const payload = {placeholder: placeholderText};

        await eventBus.dispatch(textUiEnableInputEventDef.id, payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert Logs (DomRenderer should log warnings)
        // Action 1 (disable)
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`DomRenderer.mutate: Selector "#${INPUT_ID}" found no elements.`)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `MODIFY_DOM_ELEMENT: No elements found or modified for selector "#${INPUT_ID}".` // Handler log
        );
        // Action 2 (placeholder) - same logs expected again
        // Use expect.arrayContaining or check count if precise number of warnings matters
        expect(mockLogger.warn).toHaveBeenCalledTimes(4); // 2 from DomRenderer, 2 from Handler

        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC5: Error Handling - should process rule even if payload is missing', async () => {
        expect(commandInput.disabled).toBe(true);
        expect(commandInput.placeholder).toBe(INITIAL_PLACEHOLDER);

        await eventBus.dispatch(textUiEnableInputEventDef.id); // Dispatch with NO payload (undefined)
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM state
        expect(commandInput.disabled).toBe(false); // Action 1 (hardcoded value) should still succeed.
        // The placeholder value resolves to undefined (event.payload.placeholder -> {}.placeholder -> undefined)
        // ModifyDomElementHandler skips execution if value is undefined.
        expect(commandInput.placeholder).toBe(INITIAL_PLACEHOLDER); // Placeholder should remain unchanged.

        // Assert Logs
        // Action 1 (disable) logs should be present
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"disabled","value":false`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Modified property "disabled" on 1 element(s)`)
        );
        // Action 2 (placeholder) - Handler execution should be skipped by OperationInterpreter or Handler itself due to undefined value
        // Check interpreter does not attempt to execute handler with undefined value if possible,
        // OR check handler logs error/skips due to undefined value.
        // Current ModifyDomElementHandler logs error and returns early for undefined value:
        expect(mockLogger.error).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Invalid or incomplete parameters.',
            {params: {selector: `#${INPUT_ID}`, property: 'placeholder', value: undefined}} // Resolved params logged by interpreter before passing to handler
        );

        // No warning about element not found
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('TC6: Error Handling - should process rule even if payload lacks "placeholder" property', async () => {
        expect(commandInput.disabled).toBe(true);
        expect(commandInput.placeholder).toBe(INITIAL_PLACEHOLDER);

        const invalidPayload = {someOtherProp: 'value'}; // Payload is an object, but missing 'placeholder'

        await eventBus.dispatch(textUiEnableInputEventDef.id, invalidPayload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM state
        expect(commandInput.disabled).toBe(false); // Action 1 succeeds.
        // Placeholder value resolves to undefined (event.payload.placeholder -> {someOtherProp: 'value'}.placeholder -> undefined)
        expect(commandInput.placeholder).toBe(INITIAL_PLACEHOLDER); // Placeholder should remain unchanged.

        // Assert Logs
        // Action 1 (disable) logs should be present
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"disabled","value":false`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Modified property "disabled" on 1 element(s)`)
        );

        // Action 2 (placeholder) - Handler execution should be skipped or log error due to undefined value
        expect(mockLogger.error).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Invalid or incomplete parameters.',
            {params: {selector: `#${INPUT_ID}`, property: 'placeholder', value: undefined}}
        );

        // No warning about element not found
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

});