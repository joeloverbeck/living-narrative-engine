// src/tests/domUI/locationRenderer.test.js
/**
 * @fileoverview Unit tests for the LocationRenderer class.
 * @jest-environment jsdom
 */

import {beforeEach, afterEach, describe, expect, it, jest} from '@jest/globals';
import {LocationRenderer} from '../../domUI/index.js';

// --- Mock Dependencies ---
jest.mock('../../constants/componentIds.js', () => ({
    POSITION_COMPONENT_ID: 'test:position',
    NAME_COMPONENT_ID: 'test:name',
    DESCRIPTION_COMPONENT_ID: 'test:description',
    EXITS_COMPONENT_ID: 'test:exits',
    ACTOR_COMPONENT_ID: 'test:actor',
}));

import {
    POSITION_COMPONENT_ID,
    NAME_COMPONENT_ID,
    DESCRIPTION_COMPONENT_ID,
    EXITS_COMPONENT_ID,
    ACTOR_COMPONENT_ID
} from '../../constants/componentIds.js';


/** @returns {import('../../core/interfaces/ILogger').ILogger} */
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

/** @returns {import('../../domUI/IDocumentContext').IDocumentContext} */
const createMockDocumentContext = () => {
    const mockDocument = {
        createElement: jest.fn(tagName => {
            const el = document.createElement(tagName);
            jest.spyOn(el, 'appendChild');
            return el;
        }),
        createTextNode: jest.fn(text => document.createTextNode(text)),
    };
    return {
        document: mockDocument,
        query: jest.fn(),
        create: jest.fn((tagName, className, textContent) => {
            const el = mockDocument.createElement(tagName);
            if (className) el.className = className;
            if (textContent) el.textContent = textContent;
            return el;
        }),
    };
};

/** @returns {import('../../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} */
const createMockVed = () => ({
    subscribe: jest.fn(() => jest.fn()),
    dispatchValidated: jest.fn(),
});

/** @returns {import('../../domUI/domElementFactory').default} */
const createMockDomElementFactory = (mockDocumentContext) => ({
    create: jest.fn((tagName, className, textContent) => {
        const el = mockDocumentContext.document.createElement(tagName);
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
    }),
    p: jest.fn((className, textContent) => {
        const el = mockDocumentContext.document.createElement('p');
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
    }),
    h3: jest.fn((className, textContent) => {
        const el = mockDocumentContext.document.createElement('h3');
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
    }),
    h4: jest.fn((className, textContent) => {
        const el = mockDocumentContext.document.createElement('h4');
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
    }),
    ul: jest.fn((className) => {
        const el = mockDocumentContext.document.createElement('ul');
        if (className) el.className = className;
        return el;
    }),
    li: jest.fn((className, textContent) => {
        const el = mockDocumentContext.document.createElement('li');
        if (className) el.className = className;
        return el;
    }),
});

/** @returns {import('../../core/interfaces/IEntityManager').IEntityManager} */
const createMockEntityManager = () => ({
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()),
});

/** @returns {import('../../core/interfaces/IDataRegistry').IDataRegistry} */
const createMockDataRegistry = () => ({
    getEntityDefinition: jest.fn(),
});


describe('LocationRenderer', () => {
    let mockLogger;
    let mockDocumentContext;
    let mockVed;
    let mockDomElementFactory;
    let mockEntityManager;
    let mockDataRegistry;
    let mockContainerElement;
    let mockNameDisplay, mockDescriptionDisplay, mockExitsDisplay, mockCharactersDisplay;

    let rendererDeps;
    let turnStartedCallback;

    const MOCK_PLAYER_ID = 'player:1';
    const MOCK_LOCATION_ID = 'world:loc1';
    const MOCK_OTHER_ACTOR_ID = 'npc:guard';
    const MOCK_NON_ACTOR_ID = 'item:rock';


    beforeEach(() => {
        mockLogger = createMockLogger();
        mockDocumentContext = createMockDocumentContext();
        mockVed = createMockVed();
        mockDomElementFactory = createMockDomElementFactory(mockDocumentContext);
        mockEntityManager = createMockEntityManager(); // mockEntityManager is initialized here
        mockDataRegistry = createMockDataRegistry();

        mockContainerElement = document.createElement('div');
        mockContainerElement.id = 'location-info-container';

        mockNameDisplay = document.createElement('div');
        mockNameDisplay.id = 'location-name-display';
        mockDescriptionDisplay = document.createElement('div');
        mockDescriptionDisplay.id = 'location-description-display';
        mockExitsDisplay = document.createElement('div');
        mockExitsDisplay.id = 'location-exits-display';
        mockCharactersDisplay = document.createElement('div');
        mockCharactersDisplay.id = 'location-characters-display';

        document.body.appendChild(mockContainerElement);
        mockContainerElement.appendChild(mockNameDisplay);
        mockContainerElement.appendChild(mockDescriptionDisplay);
        mockContainerElement.appendChild(mockExitsDisplay);
        mockContainerElement.appendChild(mockCharactersDisplay);

        mockDocumentContext.query.mockImplementation(selector => {
            if (selector === '#location-name-display') return mockNameDisplay;
            if (selector === '#location-description-display') return mockDescriptionDisplay;
            if (selector === '#location-exits-display') return mockExitsDisplay;
            if (selector === '#location-characters-display') return mockCharactersDisplay;
            return null;
        });

        rendererDeps = {
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: mockDomElementFactory,
            entityManager: mockEntityManager, // mockEntityManager is assigned to rendererDeps
            dataRegistry: mockDataRegistry,
            containerElement: mockContainerElement,
        };

        mockVed.subscribe.mockImplementation((eventType, callback) => {
            if (eventType === 'core:turn_started') {
                turnStartedCallback = callback;
            }
            return jest.fn();
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('Constructor', () => {
        it('should successfully create an instance with valid dependencies and subscribe to events', () => {
            expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
            expect(mockLogger.debug).toHaveBeenCalledWith('[LocationRenderer] Initialized.');
            expect(mockVed.subscribe).toHaveBeenCalledWith('core:turn_started', expect.any(Function));
        });

        it('should throw if domElementFactory is missing', () => {
            rendererDeps.domElementFactory = null;
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'domElementFactory' dependency is missing or invalid.");
        });

        it('should throw if entityManager is missing', () => {
            rendererDeps.entityManager = null;
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityManager' dependency is missing or invalid (must have getEntityInstance and getEntitiesInLocation).");
        });
        it('should throw if entityManager is missing getEntityInstance', () => {
            rendererDeps.entityManager = {getEntitiesInLocation: jest.fn()};
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityManager' dependency is missing or invalid (must have getEntityInstance and getEntitiesInLocation).");
        });
        it('should throw if entityManager is missing getEntitiesInLocation', () => {
            rendererDeps.entityManager = {getEntityInstance: jest.fn()};
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityManager' dependency is missing or invalid (must have getEntityInstance and getEntitiesInLocation).");
        });

        it('should throw if dataRegistry is missing or invalid', () => {
            rendererDeps.dataRegistry = null;
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'dataRegistry' dependency is missing or invalid (must have getEntityDefinition).");
        });
        it('should throw if dataRegistry is missing getEntityDefinition', () => {
            rendererDeps.dataRegistry = {
                someOtherMethod: () => {
                }
            };
            expect(() => new LocationRenderer(rendererDeps)).toThrow("must have getEntityDefinition");
        });

        it('should throw if containerElement is missing or invalid', () => {
            rendererDeps.containerElement = null;
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'containerElement' (expected '#location-info-container') dependency is missing or not a valid DOM element.");
        });
    });

    describe('#handleTurnStarted and render', () => {
        let renderer;
        const mockPlayerEntity = {
            id: MOCK_PLAYER_ID,
            getComponentData: jest.fn(),
            hasComponent: jest.fn(),
        };

        beforeEach(() => {
            mockEntityManager.getEntityInstance.mockReset();
            mockEntityManager.getEntitiesInLocation.mockReset(); // Ensure this is also reset
            mockDataRegistry.getEntityDefinition.mockReset();
            mockPlayerEntity.getComponentData.mockReset();
            mockPlayerEntity.hasComponent.mockReset();

            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                return null;
            });
            mockPlayerEntity.getComponentData.mockImplementation(compId => {
                if (compId === POSITION_COMPONENT_ID) return {locationId: MOCK_LOCATION_ID};
                return null;
            });
            renderer = new LocationRenderer(rendererDeps);
        });

        const simulateTurnStarted = (payloadOverride = {}) => {
            const event = {
                type: 'core:turn_started',
                payload: {entityId: MOCK_PLAYER_ID, entityType: 'player', ...payloadOverride},
            };
            if (turnStartedCallback) {
                turnStartedCallback(event);
            } else {
                throw new Error("turnStartedCallback was not captured by mockVed.subscribe");
            }
        };

        it('should clear displays and log warning if event payload has no entityId', () => {
            jest.spyOn(renderer, 'render');
            turnStartedCallback({type: 'core:turn_started', payload: {}});

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('event is missing entityId'));
            expect(mockNameDisplay.textContent).toContain('(Location Unknown)');
            expect(mockDescriptionDisplay.textContent).toContain('No entity specified for turn.');
            expect(mockExitsDisplay.textContent).toContain('(Exits Unavailable)');
            expect(mockCharactersDisplay.textContent).toContain('(Characters Unavailable)');
            expect(renderer.render).not.toHaveBeenCalled();
        });

        it('should clear displays and log warning if entity not found', () => {
            mockEntityManager.getEntityInstance.mockReturnValue(null);
            simulateTurnStarted();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Entity '${MOCK_PLAYER_ID}' (whose turn started) not found`));
            expect(mockDescriptionDisplay.textContent).toContain(`Entity ${MOCK_PLAYER_ID} not found.`);
        });

        it('should clear displays and log warning if entity has no position component', () => {
            mockPlayerEntity.getComponentData.mockImplementation(compId => {
                if (compId === POSITION_COMPONENT_ID) return null;
                return null;
            });
            simulateTurnStarted();
            expect(mockPlayerEntity.getComponentData).toHaveBeenCalledWith(POSITION_COMPONENT_ID);
            expect(mockDescriptionDisplay.textContent).toContain(`Location for ${MOCK_PLAYER_ID} is unknown.`);
        });

        it('should clear displays and log error if location definition not found', () => {
            mockDataRegistry.getEntityDefinition.mockReturnValue(null);
            simulateTurnStarted();
            expect(mockDataRegistry.getEntityDefinition).toHaveBeenCalledWith(MOCK_LOCATION_ID);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Location entity definition for ID '${MOCK_LOCATION_ID}' not found.`));
            expect(mockDescriptionDisplay.textContent).toContain(`Location data for '${MOCK_LOCATION_ID}' missing.`);
        });

        describe('Exits Processing and Rendering', () => {
            const baseLocationDef = {
                id: MOCK_LOCATION_ID,
                components: {
                    [NAME_COMPONENT_ID]: {text: "Test Location"},
                    [DESCRIPTION_COMPONENT_ID]: {text: "A place for testing."}
                }
            };
            // Moved the mock setup into a beforeEach for this describe block
            beforeEach(() => {
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set()); // No other characters for these exit tests
            });

            it('should render with one exit correctly formatted', () => {
                const locationDefWithExit = {
                    ...baseLocationDef,
                    components: {
                        ...baseLocationDef.components,
                        [EXITS_COMPONENT_ID]: [{direction: "North", target: "world:loc2"}]
                    }
                };
                mockDataRegistry.getEntityDefinition.mockReturnValue(locationDefWithExit);
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith({
                    name: "Test Location",
                    description: "A place for testing.",
                    exits: [{description: "North", id: "world:loc2"}],
                    characters: []
                });
                // Basic check for list item content
                const exitListItems = mockExitsDisplay.querySelectorAll('ul li');
                expect(exitListItems.length).toBe(1);
                expect(exitListItems[0].textContent).toBe("North");
            });

            it('should render with multiple exits correctly formatted', () => {
                const locationDefWithExits = {
                    ...baseLocationDef,
                    components: {
                        ...baseLocationDef.components,
                        [EXITS_COMPONENT_ID]: [
                            {direction: "North", target: "world:loc2"},
                            {direction: "South to the town", target: "world:town"}
                        ]
                    }
                };
                mockDataRegistry.getEntityDefinition.mockReturnValue(locationDefWithExits);
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');

                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    exits: [
                        {description: "North", id: "world:loc2"},
                        {description: "South to the town", id: "world:town"}
                    ]
                }));
                expect(renderer._renderList).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({description: "North"}),
                        expect.objectContaining({description: "South to the town"})
                    ]),
                    mockExitsDisplay, 'Exits', 'description', '(None visible)'
                );
                expect(mockExitsDisplay.querySelectorAll('ul li').length).toBe(2);
                expect(mockExitsDisplay.querySelectorAll('ul li')[0].textContent).toBe("North");
                expect(mockExitsDisplay.querySelectorAll('ul li')[1].textContent).toBe("South to the town");
            });

            it('should render with "None visible" if exits component is an empty array', () => {
                const locationDefNoExits = {
                    ...baseLocationDef,
                    components: {...baseLocationDef.components, [EXITS_COMPONENT_ID]: []}
                };
                mockDataRegistry.getEntityDefinition.mockReturnValue(locationDefNoExits);
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');

                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({exits: []}));
                expect(renderer._renderList).toHaveBeenCalledWith([], mockExitsDisplay, 'Exits', 'description', '(None visible)');
                expect(mockExitsDisplay.querySelector('p.empty-list-message').textContent).toBe("(None visible)");
                expect(mockExitsDisplay.querySelector('ul')).toBeNull();
            });

            it('should render with "None visible" if exits component is missing', () => {
                mockDataRegistry.getEntityDefinition.mockReturnValue(baseLocationDef); // No EXITS_COMPONENT_ID
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');

                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({exits: []}));
                expect(renderer._renderList).toHaveBeenCalledWith([], mockExitsDisplay, 'Exits', 'description', '(None visible)');
                expect(mockExitsDisplay.querySelector('p.empty-list-message').textContent).toBe("(None visible)");
            });
        });


        describe('Characters Processing and Rendering', () => {
            const baseLocationDef = {
                id: MOCK_LOCATION_ID,
                components: {
                    [NAME_COMPONENT_ID]: {text: "Guild Hall"},
                    [DESCRIPTION_COMPONENT_ID]: {text: "A busy place."}
                }
            };

            beforeEach(() => {
                mockDataRegistry.getEntityDefinition.mockReturnValue(baseLocationDef);
            });

            it('should render "None else here" if no other characters are in the location', () => {
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set());
                jest.spyOn(renderer, '_renderList');
                simulateTurnStarted();

                expect(renderer._renderList).toHaveBeenCalledWith(
                    [],
                    mockCharactersDisplay,
                    'Characters',
                    'name',
                    '(None else here)'
                );
                expect(mockCharactersDisplay.querySelector('p.empty-list-message').textContent).toBe("(None else here)");
            });

            it('should render a character with name and description', () => {
                const otherActor = {
                    id: MOCK_OTHER_ACTOR_ID,
                    hasComponent: jest.fn(compId => compId === ACTOR_COMPONENT_ID),
                    getComponentData: jest.fn(compId => {
                        if (compId === NAME_COMPONENT_ID) return {text: "Guard"};
                        if (compId === DESCRIPTION_COMPONENT_ID) return {text: "A stern-looking guard."};
                        if (compId === POSITION_COMPONENT_ID) return {locationId: MOCK_LOCATION_ID};
                        return null;
                    })
                };
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID, MOCK_OTHER_ACTOR_ID]));
                mockEntityManager.getEntityInstance.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                    if (id === MOCK_OTHER_ACTOR_ID) return otherActor;
                    return null;
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    characters: [{id: MOCK_OTHER_ACTOR_ID, name: "Guard", description: "A stern-looking guard."}]
                }));
                const characterListItems = mockCharactersDisplay.querySelectorAll('ul li');
                expect(characterListItems.length).toBe(1);
                expect(characterListItems[0].querySelector('span').textContent).toBe("Guard");
                expect(characterListItems[0].querySelector('p.character-description').textContent).toBe("A stern-looking guard.");
            });


            it('should render a character with name only if no description component', () => {
                const otherActorNoDesc = {
                    id: MOCK_OTHER_ACTOR_ID,
                    hasComponent: jest.fn(compId => compId === ACTOR_COMPONENT_ID),
                    getComponentData: jest.fn(compId => {
                        if (compId === NAME_COMPONENT_ID) return {text: "Silent Bob"};
                        if (compId === POSITION_COMPONENT_ID) return {locationId: MOCK_LOCATION_ID};
                        return null;
                    })
                };
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID, MOCK_OTHER_ACTOR_ID]));
                mockEntityManager.getEntityInstance.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                    if (id === MOCK_OTHER_ACTOR_ID) return otherActorNoDesc;
                    return null;
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    characters: [{id: MOCK_OTHER_ACTOR_ID, name: "Silent Bob", description: undefined}]
                }));
                const characterListItems = mockCharactersDisplay.querySelectorAll('ul li');
                expect(characterListItems.length).toBe(1);
                expect(characterListItems[0].querySelector('span').textContent).toBe("Silent Bob");
                expect(characterListItems[0].querySelector('p.character-description')).toBeNull();
            });

            it('should exclude the current actor from the character list', () => {
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID]));
                mockPlayerEntity.hasComponent.mockImplementation(compId => compId === ACTOR_COMPONENT_ID || compId === POSITION_COMPONENT_ID);
                mockPlayerEntity.getComponentData.mockImplementation(compId => {
                    if (compId === POSITION_COMPONENT_ID) return {locationId: MOCK_LOCATION_ID};
                    if (compId === NAME_COMPONENT_ID) return {text: "Hero"};
                    if (compId === DESCRIPTION_COMPONENT_ID) return {text: "The protagonist."}
                    return null;
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    characters: []
                }));
                expect(mockCharactersDisplay.querySelector('p.empty-list-message').textContent).toBe("(None else here)");
            });

            it('should ignore non-actor entities in the location', () => {
                const nonActorEntity = {
                    id: MOCK_NON_ACTOR_ID,
                    hasComponent: jest.fn(compId => compId === POSITION_COMPONENT_ID),
                    getComponentData: jest.fn(compId => {
                        if (compId === NAME_COMPONENT_ID) return {text: "A Rock"};
                        if (compId === POSITION_COMPONENT_ID) return {locationId: MOCK_LOCATION_ID};
                        return null;
                    })
                };
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID, MOCK_NON_ACTOR_ID]));
                mockEntityManager.getEntityInstance.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                    if (id === MOCK_NON_ACTOR_ID) return nonActorEntity;
                    return null;
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    characters: []
                }));
                expect(mockCharactersDisplay.querySelector('p.empty-list-message').textContent).toBe("(None else here)");
            });
        });

        it('should log an error if a display element (e.g., charactersDisplay) is not found during render', () => {
            const locationDef = {id: MOCK_LOCATION_ID, components: {}};
            mockDataRegistry.getEntityDefinition.mockReturnValue(locationDef);
            mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set());

            mockDocumentContext.query.mockImplementation(selector => {
                if (selector === '#location-characters-display') return null;
                if (selector === '#location-name-display') return mockNameDisplay;
                if (selector === '#location-description-display') return mockDescriptionDisplay;
                if (selector === '#location-exits-display') return mockExitsDisplay;
                return null;
            });

            // Must re-initialize renderer with the modified mockDocumentContext for this specific test
            const testRenderer = new LocationRenderer(rendererDeps);
            // And also re-capture the callback for this specific instance
            let testTurnStartedCallback;
            mockVed.subscribe.mockImplementation((eventType, callback) => {
                if (eventType === 'core:turn_started') {
                    testTurnStartedCallback = callback;
                }
                return jest.fn();
            });
            new LocationRenderer(rendererDeps); // This re-subscribes using the latest mock.
            // It's important to ensure the callback used is from the correct instance.

            if (testTurnStartedCallback) {
                testTurnStartedCallback({
                    type: 'core:turn_started',
                    payload: {entityId: MOCK_PLAYER_ID, entityType: 'player'},
                });
            } else {
                // If the test setup is such that the original `turnStartedCallback` is still the one bound
                // to the original `renderer` instance, this path might be taken.
                // It's safer to ensure the callback from the correct instance is used.
                // For this test, directly calling render or ensuring the right callback is tricky if not careful.
                // A simpler way for this specific case might be to directly call render on testRenderer if the goal
                // is only to test the query part inside render().
                // However, sticking to the event flow:
                simulateTurnStarted(); // This will use the `turnStartedCallback` from the outer scope's `renderer`
            }


            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Element #location-characters-display not found."));
        });
    });

    describe('dispose', () => {
        it('should handle dispose being called multiple times gracefully', () => {
            const renderer = new LocationRenderer(rendererDeps);
            const mockUnsubscribe = mockVed.subscribe.mock.results[0].value;

            renderer.dispose();
            expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

            renderer.dispose();
            expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('[LocationRenderer] LocationRenderer disposed.');
        });
    });
});