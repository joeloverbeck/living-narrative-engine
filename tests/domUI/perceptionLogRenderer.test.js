// src/tests/domUI/perceptionLogRenderer.test.js

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
import {PerceptionLogRenderer} from '../../src/domUI/index.js'; // Ensure this path is correct
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';
import {PERCEPTION_LOG_COMPONENT_ID} from '../../src/constants/componentIds.js';

jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');

const PERCEPTION_LOG_LIST_ID = 'perception-log-list';
const CLASS_PREFIX = '[PerceptionLogRenderer]';
const CORE_TURN_STARTED_EVENT = 'core:turn_started';

const createMockHtmlElement = (doc, tagName = 'div', id = '') => {
    const element = doc.createElement(tagName);
    if (id) element.id = id;

    element.appendChild = jest.fn(element.appendChild.bind(element));
    element.removeChild = jest.fn(element.removeChild.bind(element));

    const originalSetAttribute = element.setAttribute.bind(element);
    element._attributes = {};
    element.setAttribute = jest.fn((name, value) => {
        originalSetAttribute(name, value);
        element._attributes[name] = value;
    });
    Object.defineProperty(element, 'title', {
        get: () => element.getAttribute('title') || '',
        set: (value) => element.setAttribute('title', value),
        configurable: true
    });

    element.classList.add = jest.fn();
    element.classList.remove = jest.fn();
    Object.defineProperty(element, 'scrollHeight', {value: 100, writable: true, configurable: true});
    Object.defineProperty(element, 'scrollTop', {value: 0, writable: true, configurable: true});
    return element;
};

describe('PerceptionLogRenderer', () => {
    let dom;
    let document;
    let mockLogger;
    let mockVed;
    let mockDomElementFactoryInstance;
    let mockEntityManager;
    let mockDocumentContext;
    let logListElementInDom; // Actual DOM element
    let turnStartedHandler;

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><ul id="${PERCEPTION_LOG_LIST_ID}"></ul></body></html>`);
        document = dom.window.document;
        global.document = document;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLUListElement = dom.window.HTMLUListElement;

        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher({});
        mockVed.subscribe.mockImplementation((eventName, handler) => {
            if (eventName === CORE_TURN_STARTED_EVENT) {
                turnStartedHandler = handler;
            }
            return jest.fn(); // Unsubscribe function
        });

        mockDocumentContext = {
            query: jest.fn(selector => {
                if (selector === `#${PERCEPTION_LOG_LIST_ID}`) {
                    logListElementInDom = document.getElementById(PERCEPTION_LOG_LIST_ID);
                    // Spy on the actual DOM element's methods if they are called directly by the renderer
                    // (though usually it's via domElementFactory or documentContext itself)
                    if (logListElementInDom && !jest.isMockFunction(logListElementInDom.appendChild)) {
                        jest.spyOn(logListElementInDom, 'appendChild');
                        jest.spyOn(logListElementInDom, 'removeChild');
                    }
                    return logListElementInDom;
                }
                return null;
            }),
            create: jest.fn(tagName => createMockHtmlElement(document, tagName)),
            document: document,
        };

        mockDomElementFactoryInstance = new DomElementFactory(mockDocumentContext);
        mockDomElementFactoryInstance.li = jest.fn((className, textContent) => {
            const li = createMockHtmlElement(document, 'li');
            li.textContent = textContent || '';
            if (className) className.split(' ').forEach(c => li.classList.add(c));
            return li;
        });

        mockEntityManager = {getEntityInstance: jest.fn()};
    });

    afterEach(() => {
        jest.clearAllMocks();
        turnStartedHandler = undefined;
    });

    const createRendererInstance = (config = {}) => {
        return new PerceptionLogRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: mockDomElementFactoryInstance,
            entityManager: mockEntityManager,
            ...config,
        });
    };

    describe('Constructor', () => {
        it('should initialize, find element, subscribe, and render initial empty message', () => {
            createRendererInstance();
            expect(mockDocumentContext.query).toHaveBeenCalledWith(`#${PERCEPTION_LOG_LIST_ID}`);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Attached to log list element:`), expect.any(dom.window.HTMLUListElement));
            expect(mockVed.subscribe).toHaveBeenCalledWith(CORE_TURN_STARTED_EVENT, expect.any(Function));
            expect(turnStartedHandler).toBeDefined();

            // Check effect of constructor's this.render([]) -> this.renderMessage('No actor selected.')
            expect(mockDomElementFactoryInstance.li).toHaveBeenCalledWith('empty-log-message', 'No actor selected.');
            const initialLi = mockDomElementFactoryInstance.li.mock.results[mockDomElementFactoryInstance.li.mock.calls.length - 1].value;
            expect(logListElementInDom.appendChild).toHaveBeenCalledWith(initialLi);
        });

        it('should log an error if log list element is not found', () => {
            mockDocumentContext.query.mockReturnValueOnce(null);
            createRendererInstance();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Could not find '#${PERCEPTION_LOG_LIST_ID}' element.`));
        });
    });

    describe('#handleTurnStarted', () => {
        const actorId = 'player:hero';
        const mockEntity = {id: actorId, hasComponent: jest.fn(), getComponentData: jest.fn()};
        let renderer;

        beforeEach(() => {
            mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
            mockEntity.hasComponent.mockReset().mockReturnValue(true);
            mockEntity.getComponentData.mockReset();
            // Clear factory mock calls from constructor before each #handleTurnStarted test
            mockDomElementFactoryInstance.li.mockClear();
            if (logListElementInDom) { // if it was found
                jest.spyOn(logListElementInDom, 'appendChild').mockClear();
                jest.spyOn(logListElementInDom, 'removeChild').mockClear();
            }
            renderer = createRendererInstance(); // Spies on render/renderMessage are NOT on this instance
            // We will test the effects or spy on demand.
        });

        it('should render logs if actor has component with valid logEntries', () => {
            const logEntries = [{
                descriptionText: 'Test log',
                timestamp: 'ts',
                perceptionType: 'test',
                actorId: 'testActor'
            }];
            mockEntity.getComponentData.mockReturnValue({logEntries, maxEntries: 10});
            jest.spyOn(renderer, 'render'); // Spy before call

            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: actorId}});

            expect(renderer.render).toHaveBeenCalledWith(logEntries);
            // Check that render correctly created an LI
            expect(mockDomElementFactoryInstance.li).toHaveBeenCalledWith(undefined, 'Test log');
        });

        it('should display "Perception log is empty" if logEntries is present but empty', () => {
            mockEntity.getComponentData.mockReturnValue({logEntries: [], maxEntries: 10});
            jest.spyOn(renderer, 'renderMessage');

            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: actorId}});
            expect(renderer.renderMessage).toHaveBeenCalledWith('Perception log is empty.');
        });

        it('should display "Perception log is empty" on old "entries" data structure', () => {
            mockEntity.getComponentData.mockReturnValue({entries: [{text: "Old"}], maxEntries: 10});
            jest.spyOn(renderer, 'renderMessage');
            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: actorId}});
            expect(renderer.renderMessage).toHaveBeenCalledWith('Perception log is empty.');
        });

        it('should display "Perception log is empty" if logEntries is not an array', () => {
            mockEntity.getComponentData.mockReturnValue({logEntries: "not-an-array", maxEntries: 10});
            jest.spyOn(renderer, 'renderMessage');
            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: actorId}});
            expect(renderer.renderMessage).toHaveBeenCalledWith('Perception log is empty.');
        });

        it('should display "No perception log for this actor" if no component', () => {
            mockEntity.hasComponent.mockReturnValue(false);
            jest.spyOn(renderer, 'renderMessage');
            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: actorId}});
            expect(renderer.renderMessage).toHaveBeenCalledWith('No perception log for this actor.');
        });

        it('should display "Actor not found" if no entity', () => {
            mockEntityManager.getEntityInstance.mockReturnValue(null);
            jest.spyOn(renderer, 'renderMessage');
            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: 'unknown'}});
            expect(renderer.renderMessage).toHaveBeenCalledWith("Actor 'unknown' not found.");
        });

        it('should display "No current actor specified" if no entityId in payload', () => {
            jest.spyOn(renderer, 'renderMessage');
            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {}});
            expect(renderer.renderMessage).toHaveBeenCalledWith('No current actor specified.');
        });

        it('should display error message on generic error', () => {
            mockEntityManager.getEntityInstance.mockImplementation(() => {
                throw new Error("DB Fail");
            });
            jest.spyOn(renderer, 'renderMessage');
            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: actorId}});
            expect(renderer.renderMessage).toHaveBeenCalledWith('Error retrieving perception logs.');
        });
    });

    describe('render method (direct invocation)', () => {
        let renderer;
        const sampleLogEntries = [
            {
                eventId: "evt1",
                descriptionText: 'Log entry 1',
                timestamp: 'ts1',
                perceptionType: 'sight',
                actorId: 'npc:1',
                targetId: 'item:A'
            },
            {
                eventId: "evt2",
                descriptionText: 'Log entry 2',
                timestamp: 'ts2',
                perceptionType: 'sound',
                actorId: 'env:B'
            },
        ];

        beforeEach(() => {
            renderer = createRendererInstance();
            mockDomElementFactoryInstance.li.mockClear(); // Clear calls from constructor
            if (logListElementInDom) {
                jest.spyOn(logListElementInDom, 'appendChild').mockClear();
                jest.spyOn(logListElementInDom, 'removeChild').mockClear();
            }
        });

        it('should clear previous logs and render new log entries as LIs', () => {
            // Simulate current actor being set by a previous turn_started event
            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: 'player:hero'}});
            mockDomElementFactoryInstance.li.mockClear(); // Clear li calls from #handleTurnStarted if any
            if (logListElementInDom) logListElementInDom.appendChild.mockClear();


            const dummyChild = document.createElement('li');
            if (logListElementInDom) logListElementInDom.appendChild(dummyChild); // Add a child to check clearList

            renderer.render(sampleLogEntries);

            if (logListElementInDom) expect(logListElementInDom.removeChild).toHaveBeenCalledWith(dummyChild);
            expect(mockDomElementFactoryInstance.li).toHaveBeenCalledTimes(sampleLogEntries.length);
            expect(mockDomElementFactoryInstance.li).toHaveBeenCalledWith(undefined, 'Log entry 1');

            const createdLi1 = mockDomElementFactoryInstance.li.mock.results[0].value;
            if (logListElementInDom) expect(logListElementInDom.appendChild).toHaveBeenCalledWith(createdLi1);
            expect(createdLi1.title).toContain('Time: ts1');
        });

        it('should render "Perception log is empty" if logEntries is empty and actor is selected', () => {
            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: 'player:hero'}}); // Set currentActorId
            mockDomElementFactoryInstance.li.mockClear(); // Clear constructor/turn_handler LI call

            jest.spyOn(renderer, 'renderMessage');
            renderer.render([]);
            expect(renderer.renderMessage).toHaveBeenCalledWith('Perception log is empty.');
        });

        it('should render "No actor selected." if logEntries is empty and no current actor', () => {
            renderer = createRendererInstance(); // Fresh instance, currentActorId is null
            mockDomElementFactoryInstance.li.mockClear(); // Clear constructor LI call

            jest.spyOn(renderer, 'renderMessage');
            renderer.render([]);
            expect(renderer.renderMessage).toHaveBeenCalledWith('No actor selected.');
        });

        it('should handle malformed log entries gracefully', () => {
            turnStartedHandler({type: CORE_TURN_STARTED_EVENT, payload: {entityId: 'player:hero'}});
            mockDomElementFactoryInstance.li.mockClear();

            const malformedEntries = [null, {ts: 'ts3'}, "a string"];
            renderer.render(malformedEntries);

            expect(mockDomElementFactoryInstance.li).toHaveBeenCalledTimes(1); // Only for "a string"
            expect(mockDomElementFactoryInstance.li).toHaveBeenCalledWith(undefined, "a string");
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Skipping malformed log entry object:"), null);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Skipping malformed log entry object:"), {ts: 'ts3'});
        });

        it('should log error if logListElement is not available during render', () => {
            // To test this, documentContext.query needs to return null when renderer is constructed
            const rendererWithNoElement = new PerceptionLogRenderer({
                logger: mockLogger,
                documentContext: {...mockDocumentContext, query: () => null}, // Force query to return null
                validatedEventDispatcher: mockVed,
                domElementFactory: mockDomElementFactoryInstance,
                entityManager: mockEntityManager,
            });
            rendererWithNoElement.render(sampleLogEntries);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Cannot render logs, #logListElement is not available."));
        });
    });

    describe('renderMessage', () => {
        let renderer;
        beforeEach(() => {
            renderer = createRendererInstance();
            mockDomElementFactoryInstance.li.mockClear();
            if (logListElementInDom) {
                jest.spyOn(logListElementInDom, 'appendChild').mockClear();
                jest.spyOn(logListElementInDom, 'removeChild').mockClear();
            }
        });

        it('should clear the list and append a new LI with the message', () => {
            const message = "Test Message";
            if (logListElementInDom) {
                const dummyChild = document.createElement('li');
                logListElementInDom.appendChild(dummyChild); // Add a child
                logListElementInDom.appendChild.mockClear(); // Clear this call
                logListElementInDom.removeChild.mockClear();
            }


            renderer.renderMessage(message);

            if (logListElementInDom) expect(logListElementInDom.removeChild).toHaveBeenCalled();
            expect(mockDomElementFactoryInstance.li).toHaveBeenCalledWith('empty-log-message', message);
            const messageLi = mockDomElementFactoryInstance.li.mock.results[0].value;
            if (logListElementInDom) expect(logListElementInDom.appendChild).toHaveBeenCalledWith(messageLi);
        });
    });

    describe('dispose', () => {
        it('should call unsubscribe for all subscriptions', () => {
            const mockUnsubscribe1 = jest.fn();
            mockVed.subscribe.mockReset().mockReturnValue(mockUnsubscribe1);

            const renderer = createRendererInstance(); // Subscribes once

            // If PerceptionLogRenderer internally could add more subscriptions to #subscriptions
            // we would test that here. Since it only subscribes once in constructor:
            renderer.dispose();

            expect(mockUnsubscribe1).toHaveBeenCalledTimes(1);
            // Accessing #subscriptions directly is not possible.
            // We trust that dispose clears its internal array and nulls out #logListElement.
            // We can check if #logListElement is attempted to be used after dispose.
            expect(renderer["#logListElement"] === undefined || renderer["#logListElement"] === null); // This won't work for native private
            // Test behavior: e.g., calling render after dispose might log an error or do nothing gracefully.
            renderer.render([]); // Should ideally not throw, might log error due to null #logListElement
            expect(mockLogger.error).toHaveBeenLastCalledWith(expect.stringContaining("Cannot render logs, #logListElement is not available."));

        });
    });
});