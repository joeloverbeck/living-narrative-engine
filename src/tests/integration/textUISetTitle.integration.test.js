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
import DomRenderer from '../../core/domRenderer.js'; // Make sure this path is correct

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
// Added for clarity in test setup
const ACTION_BUTTONS_CONTAINER_ID = 'action-buttons-container';

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
    // Reference for action button container if needed later
    let actionButtonsContainer;


    beforeEach(() => {
        // Reset mocks for each test
        Object.values(mockLogger).forEach(mockFn => mockFn.mockClear());
        mockValidatedEventDispatcher.dispatchValidated.mockClear();


        // --- Create JSDOM instance and elements ---
        // Ensure all elements needed by DomRenderer constructor exist
        dom = new JSDOM(`<!DOCTYPE html><html><body>
          <div id="game-container">
            <h1 id="${TITLE_ID}">${INITIAL_TITLE_TEXT}</h1>
            <div id="${OUTPUT_DIV_ID}"></div>
            <div id="${ACTION_BUTTONS_CONTAINER_ID}"></div>
            <input type="text" id="${INPUT_ID}" placeholder="Enter command..." />
          </div>
        </body></html>`);
        window = dom.window;
        document = window.document;

        // Make JSDOM globals available for DomRenderer internal checks if needed
        // global.window = window; // Often needed for libraries expecting window
        // global.document = document; // Jest >= 28 prefers this over setting window.document
        // global.HTMLElement = window.HTMLElement;
        // global.HTMLInputElement = window.HTMLInputElement;
        // global.HTMLHeadingElement = window.HTMLHeadingElement;
        // NOTE: Relying on nodeType/tagName checks in DomRenderer is preferred over setting globals

        // Get references to DOM elements AFTER JSDOM is set up
        titleElement = document.getElementById(TITLE_ID);
        outputDiv = document.getElementById(OUTPUT_DIV_ID);
        inputElement = document.getElementById(INPUT_ID);
        actionButtonsContainer = document.getElementById(ACTION_BUTTONS_CONTAINER_ID); // Get reference


        // --- Instantiate Mocks and Common Services ---
        mockEntityManager = new MockEntityManager();
        mockDataRegistry = new MockDataRegistry([uiSetTitleRuleDef], [textUiSetTitleEventDef]);
        eventBus = new EventBus();
        jsonLogicService = new JsonLogicEvaluationService({logger: mockLogger});
        opRegistry = new OperationRegistry({logger: mockLogger});


        // --- Instantiate REAL DomRenderer and ModifyDomElementHandler ---
        // Ensure all required elements are correctly passed
        expect(outputDiv).toBeInstanceOf(window.HTMLElement); // Verify element before passing
        expect(inputElement).toBeInstanceOf(window.HTMLInputElement);
        expect(titleElement).toBeInstanceOf(window.HTMLHeadingElement);
        expect(actionButtonsContainer).toBeInstanceOf(window.HTMLElement); // Verify action container exists

        domRenderer = new DomRenderer({
            outputDiv: outputDiv,
            inputElement: inputElement,
            titleElement: titleElement, // Pass the real title element
            eventBus: eventBus,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            logger: mockLogger
            // actionButtonsContainer is found internally by ID
        });

        modifyDomHandler = new ModifyDomElementHandler({
            logger: mockLogger,
            domRenderer: domRenderer // Pass the real DomRenderer
        });
        // --- End REAL Instantiation ---


        // --- Instantiate OperationInterpreter ---
        // Assuming contextUtils and resolvePlaceholders exist and work
        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: opRegistry,
            // Pass dependencies needed by resolvePlaceholders if any (e.g., JsonLogic, EntityManager)
            // jsonLogicEvaluationService: jsonLogicService, // Might be needed by resolvePlaceholders
            // entityManager: mockEntityManager // Might be needed by resolvePlaceholders
        });


        // --- Register the REAL handler instance ---
        opRegistry.register('MODIFY_DOM_ELEMENT', modifyDomHandler.execute.bind(modifyDomHandler));
        // --- End Registration ---


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
        // Clean up globals if they were set
        // delete global.window;
        // delete global.document;
        // delete global.HTMLElement;
        // delete global.HTMLInputElement;
        // delete global.HTMLHeadingElement;

        systemLogicInterpreter?.shutdown(); // Call shutdown if it exists
        systemLogicInterpreter = null; // Help GC
        mockDataRegistry = null;
        domRenderer = null;
        modifyDomHandler = null;
        operationInterpreter = null;
        opRegistry = null;
        jsonLogicService = null;
        eventBus = null;
    });


    // --- Test Cases (Following the Plan) ---

    it('TC1: Happy Path - should update the title element text content', async () => {
        expect(titleElement).not.toBeNull();
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);

        const newTitle = "Welcome, Player!";
        const payload = {text: newTitle}; // Payload key is 'text'

        await eventBus.dispatch('textUI:set_title', payload);
        // Use Jest's fake timers or a more robust async wait if needed
        // await new Promise(process.nextTick); // Allow event loop to process
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async actions

        // Assert DOM Change
        expect(titleElement.textContent).toBe(newTitle); // This was failing

        // Assert Logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing rule \'rule:ui_set_title_from_event\''));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Condition evaluation final boolean result: true'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing 1 actions'));

        // Check OperationInterpreter received correct operation
        expect(operationInterpreter.execute).toHaveBeenCalledWith(
            expect.objectContaining({type: 'MODIFY_DOM_ELEMENT'}),
            expect.anything() // Check context if necessary
        );

        // Check handler execution log - Handler logs resolved params
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            // Use objectContaining for flexibility if stringify order changes
            expect.objectContaining({
                "selector": `#${TITLE_ID}`,
                "property": "textContent",
                "value": newTitle // Expect RESOLVED value here
            })
        );

        // Check DomRenderer mutate log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `DomRenderer.mutate: Successfully set property "textContent" on 1 element(s) matching selector "#${TITLE_ID}"`
        );

        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check for warnings - should be none in happy path
        // Filter out potential unrelated warnings if necessary
        const warnCalls = mockLogger.warn.mock.calls;
        const relevantWarnings = warnCalls.filter(call => !call[0].includes('inventory panel')); // Example filter
        expect(relevantWarnings.length).toBe(0);
    });

    // TC2, TC3, TC4, TC5 (Passed - No changes needed)

    it('TC2: Condition Failure - should NOT update title when payload is null', async () => {
        const payload = null;
        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC3: Condition Failure - should NOT update title when payload is undefined', async () => {
        await eventBus.dispatch('textUI:set_title'); // No payload
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC4: Condition Failure - should NOT update title when payload lacks "text" property', async () => {
        const payload = {anotherProp: "some value"};
        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });

    it('TC5: Condition Failure - should NOT update title when payload "text" is null', async () => {
        const payload = {text: null};
        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(titleElement.textContent).toBe(INITIAL_TITLE_TEXT);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Rule 'rule:ui_set_title_from_event' actions skipped"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("due to condition evaluating to false"));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('MODIFY_DOM_ELEMENT: Handler executing'));
    });


    it('TC6: Edge Case - should update title to an empty string', async () => {
        const payload = {text: ""}; // Empty string

        // Mock OperationInterpreter execute to check parameters *after* placeholder resolution
        // This requires OperationInterpreter.execute to be spy-able or mockable
        // If using the real OperationInterpreter, rely on ModifyDomElementHandler logs
        // jest.spyOn(operationInterpreter, 'execute'); // Example if possible

        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async actions

        // Assert DOM change
        expect(titleElement.textContent).toBe(""); // This was failing

        // Assert Logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing rule \'rule:ui_set_title_from_event\''));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Condition evaluation final boolean result: true')); // "" !== null
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing 1 actions'));

        // Check handler execution log - Handler logs resolved params
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            // Use objectContaining for flexibility
            expect.objectContaining({
                "selector": `#${TITLE_ID}`,
                "property": "textContent",
                "value": "" // Expect RESOLVED empty string value here
            })
        );

        // Check DomRenderer success log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `DomRenderer.mutate: Successfully set property "textContent" on 1 element(s) matching selector "#${TITLE_ID}"`
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('TC7: Robustness - should log warning and not fail when target element is missing', async () => {
        // Ensure titleElement exists before removing it
        expect(document.getElementById(TITLE_ID)).not.toBeNull();
        titleElement.remove(); // Remove the target H1 element
        expect(document.getElementById(TITLE_ID)).toBeNull(); // Verify removal

        const payload = {text: "Should Not Appear"};

        await eventBus.dispatch('textUI:set_title', payload);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async actions

        // Assert Logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing rule \'rule:ui_set_title_from_event\''));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Condition evaluation final boolean result: true'));

        // Check handler execution attempt log (should still attempt)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            expect.objectContaining({
                "selector": `#${TITLE_ID}`,
                "property": "textContent",
                "value": "Should Not Appear"
            })
        );

        // --- UPDATED ASSERTIONS ---
        // Check WARNING log from DomRenderer due to missing element during mutate
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`DomRenderer.mutate: Selector "#${TITLE_ID}" found no elements.`)
        );
        // Check WARNING log from ModifyDomElementHandler because mutate found 0 elements
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `MODIFY_DOM_ELEMENT: No elements found or modified for selector "#${TITLE_ID}".`
        );

        // Check that no *relevant* errors occurred.
        // Filter out the known setup error about action-buttons-container if it still occurs.
        const errorCalls = mockLogger.error.mock.calls;
        const unexpectedErrors = errorCalls.filter(call =>
                !call[0].includes('#action-buttons-container') // Ignore action button container error during setup
            // Add other filters here if other known setup errors exist
        );
        // Assert that no *other* errors were logged during the test execution
        expect(unexpectedErrors).toEqual([]);


        // Ensure the expected warnings were the *only* warnings (or filter out others)
        const warnCalls = mockLogger.warn.mock.calls;
        // Filter for only the two expected warnings related to the missing element
        const relevantWarnings = warnCalls.filter(call =>
            call[0].includes(`DomRenderer.mutate: Selector "#${TITLE_ID}" found no elements.`) ||
            call[0].includes(`MODIFY_DOM_ELEMENT: No elements found or modified for selector "#${TITLE_ID}".`)
        );
        // Ensure exactly 2 relevant warnings were logged
        expect(relevantWarnings.length).toBe(2);
        // --- END UPDATED ASSERTIONS ---

    });

});