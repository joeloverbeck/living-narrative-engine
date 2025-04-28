// src/tests/integration/textUISetTitle.integration.test.js

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';

// --- System Under Test (SUT) & Core Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js'; // Using EventBus for dispatch
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
import ModifyDomElementHandler from '../../logic/operationHandlers/modifyDomElementHandler.js';
// Supporting modules implicitly used by the above
import * as contextAssembler from '../../logic/contextAssembler.js';
import * as contextUtils from '../../logic/contextUtils.js';

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
        // Only needs to return something truthy if an ID is expected,
        // otherwise context assembler handles null/undefined lookups.
        if (id) {
            // Return a basic object structure if needed by context assembler logic
            // For this specific rule, actor/target aren't deeply inspected, so just id is ok.
            return { id: id };
        }
        return undefined;
    }
    // These methods are needed by contextAssembler/handlers but not critical logic for *this* test
    getComponentData(entityId, componentType) { return undefined; }
    hasComponent(entityId, componentType) { return false; }
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

const textUiSetTitleEventDef = {
    "$schema": "http://example.com/schemas/event-definition.schema.json",
    "id": "textUI:set_title",
    "description": "Signals a request to update the main title display.",
    "payloadSchema": {
        "type": "object",
        "properties": {
            "text": { "type": "string", "description": "The text content." }
        },
        "required": [ "text" ],
        "additionalProperties": false
    }
};

const uiSetTitleRuleDef = {
    "rule_id": "rule:ui_set_title_from_event",
    "event_type": "textUI:set_title",
    "condition": { // Condition checks payload and text property are not null/undefined
        "and": [
            { "!=": [ { "var": "event.payload" }, null ] },
            { "!=": [ { "var": "event.payload.text" }, null ] }
        ]
    },
    "actions": [
        {
            "type": "MODIFY_DOM_ELEMENT",
            "comment": "Update the main H1 title element's text content.",
            "parameters": {
                "selector": "#title-element",
                "property": "textContent",
                "value": "{event.payload.text}" // Placeholder!
            }
        }
    ]
};

const INITIAL_TITLE_TEXT = 'Initial Title';

// --- Test Suite ---
describe('Integration Test: textUI:set_title Event Flow', () => {

    // REMOVE THIS - 'dom' instance variable is no longer needed
    // let dom;

    // Keep other variable declarations
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

        // 1. Reset the DOM Body Content (using Jest's global document)
        // This ensures the H1 exists for each test run
        document.body.innerHTML = `
            <h1 id="title-element">${INITIAL_TITLE_TEXT}</h1>
        `;

        // REMOVE THESE LINES - Jest handles JSDOM setup/globals
        // dom = new JSDOM(`...`);
        // global.document = dom.window.document;
        // global.window = dom.window;

        // 2. Instantiate Mocks and Stubs (Keep This)
        mockEntityManager = new MockEntityManager();
        mockDataRegistry = new MockDataRegistry([uiSetTitleRuleDef], [textUiSetTitleEventDef]);

        // 3. Instantiate Real Services (Keep This)
        eventBus = new EventBus();
        jsonLogicService = new JsonLogicEvaluationService({ logger: mockLogger });
        opRegistry = new OperationRegistry({ logger: mockLogger });
        modifyDomHandler = new ModifyDomElementHandler({ logger: mockLogger });
        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: opRegistry
        });

        // 4. Register the Handler (Keep This)
        opRegistry.register('MODIFY_DOM_ELEMENT', modifyDomHandler.execute.bind(modifyDomHandler));

        // 5. Instantiate System Under Test (SystemLogicInterpreter) (Keep This)
        systemLogicInterpreter = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: eventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: jsonLogicService,
            entityManager: mockEntityManager,
            operationInterpreter: operationInterpreter
        });

        // 6. Initialize the Interpreter (Keep This)
        systemLogicInterpreter.initialize();
    });

    afterEach(() => {
        // REMOVE THESE LINES - Jest handles JSDOM cleanup
        // global.document = undefined;
        // global.window = undefined;

        // Keep mock restoration
        jest.restoreAllMocks();
    });

    // --- Test Cases (Following the Plan) ---

    it('TC1: Happy Path - should update the title element text content', async () => {
        const titleElement = document.getElementById('title-element');
        expect(titleElement).not.toBeNull();
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);

        const newTitle = "Welcome, Player!";
        const payload = { text: newTitle };

        await eventBus.dispatch('textUI:set_title', payload);

        // *** ADD DELAY HERE ***
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM Change
        expect(titleElement.textContent).toBe(newTitle);

        // Assert Logs (Now checked after delay)
        // --- Updated Expectation: Check for the handler log specifically, matching BOTH arguments ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining("MODIFY_DOM_ELEMENT: Handler executing with params:"), // Matcher for the first argument (the message)
            expect.any(String) // Matcher for the second argument (the stringified params)
        );
        // --- Keep other relevant log checks if desired ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing rule \'rule:ui_set_title_from_event\''));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Condition evaluation final boolean result: true'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing 1 actions'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully set property "textContent" on element 1/1 (selector: "#title-element")`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC2: Condition Failure - should NOT update title when payload is null', async () => {
        const titleElement = document.getElementById('title-element');
        const payload = null; // Explicitly null

        await eventBus.dispatch('textUI:set_title', payload);

        // Assert DOM unchanged
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        // Assert logs indicate condition failure
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        // Assert handler was not called (indirectly check via debug logs)
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC3: Condition Failure - should NOT update title when payload is undefined', async () => {
        const titleElement = document.getElementById('title-element');
        // Dispatch without payload argument, which defaults to {} in EventBus, but contextAssembler makes it null
        await eventBus.dispatch('textUI:set_title'); // No payload

        // Assert DOM unchanged
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        // Assert logs indicate condition failure (event.payload becomes null in context)
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC4: Condition Failure - should NOT update title when payload lacks "text" property', async () => {
        const titleElement = document.getElementById('title-element');
        const payload = { anotherProp: "some value" }; // Missing 'text'

        await eventBus.dispatch('textUI:set_title', payload);

        // Assert DOM unchanged
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        // Assert logs indicate condition failure
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC5: Condition Failure - should NOT update title when payload "text" is null', async () => {
        const titleElement = document.getElementById('title-element');
        const payload = { text: null }; // 'text' is explicitly null

        await eventBus.dispatch('textUI:set_title', payload);

        // Assert DOM unchanged
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        // Assert logs indicate condition failure
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC6: Edge Case - should update title to an empty string', async () => {
        const titleElement = document.getElementById('title-element');
        const payload = { text: "" }; // Empty string

        await eventBus.dispatch('textUI:set_title', payload);

        // *** ADD DELAY HERE ***
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM change
        expect(titleElement.textContent).toBe("");

        // Assert Logs (Now checked after delay)
        // --- Updated Expectation: Check for the handler log specifically, matching BOTH arguments ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining("MODIFY_DOM_ELEMENT: Handler executing with params:"), // Matcher for the first argument (the message)
            expect.any(String) // Matcher for the second argument (the stringified params)
        );
        // --- Keep other relevant log checks if desired ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing rule \'rule:ui_set_title_from_event\''));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Condition evaluation final boolean result: true')); // "" !== null
        // The original assertion was: expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing')
        // Let's keep it similar or use the more specific one above. The one above is better.
        // expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully set property "textContent" on element 1/1 (selector: "#title-element")`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC7: Robustness - should log warning and not fail when target element is missing', async () => {
        const titleElement = document.getElementById('title-element');
        expect(titleElement).not.toBeNull();
        titleElement.remove();

        const payload = { text: "Should Not Appear" };

        await eventBus.dispatch('textUI:set_title', payload);

        // *** ADD DELAY HERE ***
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert
        expect(document.getElementById('title-element')).toBeNull();
        expect(mockLogger.error).not.toHaveBeenCalled();

        // Assert Logs (Now checked after delay)
        // Check the flow proceeded up to the handler attempt
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing rule \'rule:ui_set_title_from_event\''));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Condition evaluation final boolean result: true'));
        // --- Updated Expectation: Check for the handler log specifically, matching BOTH arguments ---
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining("MODIFY_DOM_ELEMENT: Handler executing with params:"), // Matcher for the first argument (the message)
            expect.any(String) // Matcher for the second argument (the stringified params)
        );
        // The original assertion was: expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing')
        // expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));

        // Check for the WARNING log from the handler
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('MODIFY_DOM_ELEMENT: No DOM elements found matching selector "#title-element"')
        );
    });

});