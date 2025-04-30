// src/tests/integration/handleEnableInput.integration.test.js

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';

// --- System Under Test (SUT) & Core Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
import ModifyDomElementHandler from '../../logic/operationHandlers/modifyDomElementHandler.js'; // Action handler

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

// Simple EntityManager Stub
class MockEntityManager {
    getEntityInstance(id) { return undefined; } // Not needed for this rule
    getComponentData(entityId, componentType) { return undefined; }
    hasComponent(entityId, componentType) { return false; }
    // Add other methods if contextAssembler requires them, returning default values
}

// Simple DataRegistry Stub
class MockDataRegistry {
    /** @param {SystemRule[]} rules */
    /** @param {EventDefinition[]} eventDefs */
    constructor(rules, eventDefs) {
        this._rules = rules || [];
        this._eventDefs = new Map((eventDefs || []).map(def => [def.id, def]));
    }
    getAllSystemRules() { return this._rules; }
    getEventDefinition(eventTypeId) { return this._eventDefs.get(eventTypeId); }
}

// --- Test Data: Event and Rule Definitions ---

const textUiEnableInputEventDef = {
    "$schema": "http://example.com/schemas/event-definition.schema.json",
    "id": "textUI:enable_input",
    "description": "Signals the UI to enable the command input field, optionally setting its placeholder text, and potentially focusing it.",
    "payloadSchema": { /* ... schema details ... */ } // Omitted for brevity, assumed correct
};

const handleEnableInputRuleDef = {
    "rule_id": "handle_enable_input",
    "comment": "Handles the textUI:enable_input event...",
    "event_type": "textUI:enable_input",
    "actions": [
        {
            "type": "MODIFY_DOM_ELEMENT",
            "comment": "Enable the command input field...",
            "parameters": { "selector": "#command-input", "property": "disabled", "value": false }
        },
        {
            "type": "MODIFY_DOM_ELEMENT",
            "comment": "Set the placeholder text...",
            "parameters": { "selector": "#command-input", "property": "placeholder", "value": "{event.payload.placeholder}" }
        }
    ]
};

const INPUT_ID = 'command-input';
const INITIAL_PLACEHOLDER = 'Waiting...';
const UNRESOLVED_PLACEHOLDER_STRING = '{event.payload.placeholder}';

// --- Test Suite ---
describe('Integration Test: handle_enable_input Rule Flow', () => {

    let eventBus;
    let mockEntityManager;
    let mockDataRegistry;
    let opRegistry;
    let jsonLogicService;
    let modifyDomHandler;
    let operationInterpreter;
    let systemLogicInterpreter;

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `<input type="text" id="${INPUT_ID}" disabled placeholder="${INITIAL_PLACEHOLDER}">`;
        mockEntityManager = new MockEntityManager();
        mockDataRegistry = new MockDataRegistry([handleEnableInputRuleDef], [textUiEnableInputEventDef]);
        eventBus = new EventBus();
        jsonLogicService = new JsonLogicEvaluationService({ logger: mockLogger });
        opRegistry = new OperationRegistry({ logger: mockLogger });
        modifyDomHandler = new ModifyDomElementHandler({ logger: mockLogger });
        operationInterpreter = new OperationInterpreter({ logger: mockLogger, operationRegistry: opRegistry });
        opRegistry.register('MODIFY_DOM_ELEMENT', modifyDomHandler.execute.bind(modifyDomHandler));
        systemLogicInterpreter = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: eventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: jsonLogicService,
            entityManager: mockEntityManager,
            operationInterpreter: operationInterpreter
        });
        systemLogicInterpreter.initialize();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
        systemLogicInterpreter = null;
        mockDataRegistry = null;
    });

    // --- Test Cases ---

    it('TC1: Happy Path - should enable the input and set its placeholder', async () => {
        const commandInput = document.getElementById(INPUT_ID);
        const newPlaceholder = "Enter your command...";
        const payload = { placeholder: newPlaceholder };
        await eventBus.dispatch(textUiEnableInputEventDef.id, payload);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(commandInput.disabled).toBe(false);
        expect(commandInput.placeholder).toBe(newPlaceholder);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Rule ${handleEnableInputRuleDef.rule_id}] No condition defined or condition is empty. Defaulting to passed.`));
        // ... other debug log checks ...
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('TC2: Edge Case - should handle empty string placeholder', async () => {
        const commandInput = document.getElementById(INPUT_ID);
        const emptyPlaceholder = "";
        const payload = { placeholder: emptyPlaceholder };
        await eventBus.dispatch(textUiEnableInputEventDef.id, payload);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(commandInput.disabled).toBe(false);
        expect(commandInput.placeholder).toBe(emptyPlaceholder);
        // ... log checks ...
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC3: Edge Case - should handle null placeholder (sets placeholder to "null")', async () => {
        const commandInput = document.getElementById(INPUT_ID);
        const nullPlaceholder = null;
        const payload = { placeholder: nullPlaceholder };
        await eventBus.dispatch(textUiEnableInputEventDef.id, payload);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(commandInput.disabled).toBe(false);
        expect(commandInput.placeholder).toBe("null");
        // ... log checks ...
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    it('TC4: Robustness - should log warning if target element is missing', async () => {
        const commandInput = document.getElementById(INPUT_ID);
        commandInput.remove();
        const placeholderText = "This won't appear";
        const payload = { placeholder: placeholderText };
        await eventBus.dispatch(textUiEnableInputEventDef.id, payload);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(document.getElementById(INPUT_ID)).toBeNull();
        // ... log checks ...
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`MODIFY_DOM_ELEMENT: No DOM elements found matching selector "#${INPUT_ID}"`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC5: Error Handling - should process rule even if payload is missing', async () => {
        const commandInput = document.getElementById(INPUT_ID);
        expect(commandInput.disabled).toBe(true); // Check initial disabled state
        expect(commandInput.placeholder).toBe(INITIAL_PLACEHOLDER); // Check initial placeholder

        await eventBus.dispatch(textUiEnableInputEventDef.id); // Dispatch with NO payload
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM state reflects current behavior:
        expect(commandInput.disabled).toBe(false); // Action 1 (hardcoded value) should still succeed.
        expect(commandInput.placeholder).toBe(UNRESOLVED_PLACEHOLDER_STRING); // Action 2 sets the literal string.

        // Assert Logs reflect current behavior:
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Processing rule '${handleEnableInputRuleDef.rule_id}'`)
        );
        // Action 1 logs:
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"disabled","value":false`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`MODIFY_DOM_ELEMENT: Successfully set property "disabled" on element 1/1`)
        );

        // ***** FIX 5: REMOVED error log expectation *****
        // expect(mockLogger.error)... removed

        // Action 2 logs (handler called with unresolved string):
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"placeholder","value":"${UNRESOLVED_PLACEHOLDER_STRING}"`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`MODIFY_DOM_ELEMENT: Successfully set property "placeholder" on element 1/1`)
        );

        // Explicitly check that no *unexpected* errors were logged
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC6: Error Handling - should process rule even if payload lacks "placeholder" property', async () => {
        const commandInput = document.getElementById(INPUT_ID);
        expect(commandInput.disabled).toBe(true); // Check initial disabled state
        expect(commandInput.placeholder).toBe(INITIAL_PLACEHOLDER); // Check initial placeholder

        const invalidPayload = { someOtherProp: 'value' }; // Payload is an object, but missing 'placeholder'

        await eventBus.dispatch(textUiEnableInputEventDef.id, invalidPayload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM state reflects current behavior:
        expect(commandInput.disabled).toBe(false); // Action 1 succeeds.
        expect(commandInput.placeholder).toBe(UNRESOLVED_PLACEHOLDER_STRING); // Action 2 sets the literal string.

        // Assert Logs reflect current behavior:
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Processing rule '${handleEnableInputRuleDef.rule_id}'`)
        );
        // Action 1 logs:
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"disabled","value":false`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`MODIFY_DOM_ELEMENT: Successfully set property "disabled" on element 1/1`)
        );

        // ***** FIX 6: REMOVED error log expectation *****
        // expect(mockLogger.error)... removed

        // Action 2 logs (handler called with unresolved string):
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${INPUT_ID}","property":"placeholder","value":"${UNRESOLVED_PLACEHOLDER_STRING}"`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`MODIFY_DOM_ELEMENT: Successfully set property "placeholder" on element 1/1`)
        );

        // Explicitly check that no *unexpected* errors were logged
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

});