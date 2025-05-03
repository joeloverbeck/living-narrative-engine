// src/tests/integration/textUISetTitle.integration.test.js

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import {JSDOM} from 'jsdom'; // Import JSDOM

// --- System Under Test (SUT) & Core Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js'; // Using EventBus for dispatch
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


// Simple EntityManager Stub (minimal implementation for this test)
class MockEntityManager {
    getEntityInstance(id) {
        if (id) {
            return {id: id};
        }
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
const textUiSetTitleEventDef = {
    "$schema": "http://example.com/schemas/event-definition.schema.json",
    "id": "textUI:set_title",
    "description": "Signals a request to update the main title display.",
    "payloadSchema": {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "The text content."}
        },
        "required": ["text"],
        "additionalProperties": false
    }
};

const uiSetTitleRuleDef = {
    "rule_id": "rule:ui_set_title_from_event",
    "event_type": "textUI:set_title",
    "condition": { // Condition checks payload and text property are not null/undefined
        "and": [
            {"!=": [{"var": "event.payload"}, null]},
            {"!=": [{"var": "event.payload.text"}, null]} // Check 'text', not 'title'
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
const TITLE_ID = 'title-element';
const OUTPUT_DIV_ID = 'outputDiv'; // Needed for DomRenderer
const INPUT_ID = 'command-input'; // Needed for DomRenderer

// --- Test Suite ---
describe('Integration Test: textUI:set_title Event Flow', () => {

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
    let titleElement;
    let outputDiv;
    let inputElement;

    beforeEach(() => {
        jest.clearAllMocks();

        // --- NEW: Create JSDOM instance and elements ---
        dom = new JSDOM(`<!DOCTYPE html><html><body>
          <div id="game-container">
            <h1 id="${TITLE_ID}">${INITIAL_TITLE_TEXT}</h1>
            <div id="${OUTPUT_DIV_ID}"></div>
            <div id="action-buttons-container"></div>
            <input type="text" id="${INPUT_ID}" placeholder="Enter command..." />
          </div>
        </body></html>`);
        window = dom.window;
        document = window.document;

        // Get references to DOM elements
        titleElement = document.getElementById(TITLE_ID);
        outputDiv = document.getElementById(OUTPUT_DIV_ID);
        inputElement = document.getElementById(INPUT_ID);
        // --- End JSDOM Setup ---

        // Instantiate Mocks and Common Services
        mockEntityManager = new MockEntityManager();
        mockDataRegistry = new MockDataRegistry([uiSetTitleRuleDef], [textUiSetTitleEventDef]);
        eventBus = new EventBus();
        jsonLogicService = new JsonLogicEvaluationService({logger: mockLogger});
        opRegistry = new OperationRegistry({logger: mockLogger});

        // --- NEW: Instantiate REAL DomRenderer and ModifyDomElementHandler ---
        domRenderer = new DomRenderer({
            outputDiv: outputDiv,
            inputElement: inputElement,
            titleElement: titleElement, // Pass the real title element
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
            jsonLogicEvaluationService: jsonLogicService,
            entityManager: mockEntityManager
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


    // --- Test Cases (Following the Plan) ---

    it('TC1: Happy Path - should update the title element text content', async () => {
        expect(titleElement).not.toBeNull();
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);

        const newTitle = "Welcome, Player!";
        const payload = {text: newTitle}; // Payload key is 'text'

        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async processing

        // Assert DOM Change
        expect(titleElement.textContent).toBe(newTitle);

        // Assert Logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing rule \'rule:ui_set_title_from_event\''));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Condition evaluation final boolean result: true'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing 1 actions'));
        // Check handler execution log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${TITLE_ID}","property":"textContent","value":"${newTitle}"`)
        );
        // Check DomRenderer success log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Modified property "textContent" on 1 element(s) matching selector "#${TITLE_ID}"`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected
    });

    it('TC2: Condition Failure - should NOT update title when payload is null', async () => {
        const payload = null; // Explicitly null

        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async processing (though nothing should happen)

        // Assert DOM unchanged
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        // Assert logs indicate condition failure
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        // Assert handler was not called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC3: Condition Failure - should NOT update title when payload is undefined', async () => {
        // Dispatch without payload argument, which defaults to {} in EventBus, but contextAssembler makes it null
        await eventBus.dispatch('textUI:set_title'); // No payload
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM unchanged
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        // Assert logs indicate condition failure (event.payload becomes null in context)
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC4: Condition Failure - should NOT update title when payload lacks "text" property', async () => {
        const payload = {anotherProp: "some value"}; // Missing 'text'

        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM unchanged
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        // Assert logs indicate condition failure (event.payload.text is null/undefined)
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC5: Condition Failure - should NOT update title when payload "text" is null', async () => {
        const payload = {text: null}; // 'text' is explicitly null

        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM unchanged
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        // Assert logs indicate condition failure (event.payload.text is null)
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC6: Edge Case - should update title to an empty string', async () => {
        const payload = {text: ""}; // Empty string

        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert DOM change
        expect(titleElement.textContent).toBe("");

        // Assert Logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing rule \'rule:ui_set_title_from_event\''));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Condition evaluation final boolean result: true')); // "" !== null
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing 1 actions'));
        // Check handler execution log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${TITLE_ID}","property":"textContent","value":""`) // Value is empty string
        );
        // Check DomRenderer success log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Modified property "textContent" on 1 element(s) matching selector "#${TITLE_ID}"`)
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC7: Robustness - should log warning and not fail when target element is missing', async () => {
        titleElement.remove(); // Remove the target H1 element
        expect(document.getElementById(TITLE_ID)).toBeNull(); // Verify removal

        const payload = {text: "Should Not Appear"};

        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert Logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing rule \'rule:ui_set_title_from_event\''));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Condition evaluation final boolean result: true'));
        // Check handler execution attempt log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.stringContaining(`"selector":"#${TITLE_ID}","property":"textContent","value":"Should Not Appear"`)
        );
        // Check WARNING log from DomRenderer due to missing element
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`DomRenderer.mutate: Selector "#${TITLE_ID}" found no elements.`)
        );
        // Check WARNING log from ModifyDomElementHandler due to missing element
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `MODIFY_DOM_ELEMENT: No elements found or modified for selector "#${TITLE_ID}".`
        );

        expect(mockLogger.error).not.toHaveBeenCalled(); // Should not be an error, just warnings
        expect(mockLogger.warn).toHaveBeenCalledTimes(2); // 1 from DomRenderer, 1 from Handler
    });

});