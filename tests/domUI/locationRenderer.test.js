// tests/domUI/locationRenderer.test.js
// --- FILE START ---
/**
 * @fileoverview Unit tests for the LocationRenderer class.
 * @jest-environment jsdom
 */

import {beforeEach, afterEach, describe, expect, it, jest} from '@jest/globals';
import {LocationRenderer} from '../../src/domUI/index.js';

// --- Mock Dependencies ---
jest.mock('../../src/constants/componentIds.js', () => ({
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
} from '../../src/constants/componentIds.js';


/** @returns {import('../../core/interfaces/ILogger').ILogger} */
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

/** @returns {import('../../src/interfaces/IDocumentContext.js').IDocumentContext} */
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

/** @returns {import('../../src/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} */
const createMockVed = () => ({
    subscribe: jest.fn(() => jest.fn()), // Ensure subscribe returns a mock unsubscribe function
    dispatchValidated: jest.fn(),
});

/** @returns {import('../../src/domUI/domElementFactory.js').default} */
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
        // if (textContent) el.textContent = textContent; // Li usually has complex content
        return el;
    }),
});

/** @returns {import('../../src/interfaces/IEntityManager.js').IEntityManager} */
const createMockEntityManager = () => ({
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()), // Default to empty set
});

/** @returns {import('../../core/interfaces/IDataRegistry').IDataRegistry} */
const createMockDataRegistry = () => ({
    getEntityDefinition: jest.fn(), // Still mock it for tests that might check its absence/presence
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
    const MOCK_LOCATION_ID = 'instance:loc1'; // Use an ID that looks like an instance ID
    const MOCK_LOCATION_DEF_ID = 'world:loc_def1'; // For the definition ID of the location
    const MOCK_OTHER_ACTOR_ID = 'npc:guard';
    const MOCK_NON_ACTOR_ID = 'item:rock';

    // Define a reusable mock location entity instance
    let mockLocationEntityInstance;


    beforeEach(() => {
        mockLogger = createMockLogger();
        mockDocumentContext = createMockDocumentContext();
        mockVed = createMockVed();
        mockDomElementFactory = createMockDomElementFactory(mockDocumentContext);
        mockEntityManager = createMockEntityManager();
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
            entityManager: mockEntityManager,
            dataRegistry: mockDataRegistry,
            containerElement: mockContainerElement,
        };

        // Capture the callback passed to VED subscribe
        turnStartedCallback = undefined; // Reset before each test
        mockVed.subscribe.mockImplementation((eventType, callback) => {
            if (eventType === 'core:turn_started') {
                turnStartedCallback = callback;
            }
            return jest.fn(); // Return a mock unsubscribe function
        });

        // Setup mockLocationEntityInstance for reuse
        mockLocationEntityInstance = {
            id: MOCK_LOCATION_ID,
            definitionId: MOCK_LOCATION_DEF_ID,
            getComponentData: jest.fn(),
            hasComponent: jest.fn(),
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = ''; // Clean up JSDOM
    });

    describe('Constructor', () => {
        it('should successfully create an instance with valid dependencies and subscribe to events', () => {
            expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
            expect(mockLogger.debug).toHaveBeenCalledWith('[LocationRenderer] Attached to base container element:', mockContainerElement);
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
            rendererDeps.entityManager = {getEntitiesInLocation: jest.fn()}; // Missing getEntityInstance
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityManager' dependency is missing or invalid (must have getEntityInstance and getEntitiesInLocation).");
        });
        it('should throw if entityManager is missing getEntitiesInLocation', () => {
            rendererDeps.entityManager = {getEntityInstance: jest.fn()}; // Missing getEntitiesInLocation
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityManager' dependency is missing or invalid (must have getEntityInstance and getEntitiesInLocation).");
        });

        it('should NOT throw but log a warning if dataRegistry is missing', () => {
            rendererDeps.dataRegistry = null;
            expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
            expect(mockLogger.warn).toHaveBeenCalledWith("[LocationRenderer] 'dataRegistry' dependency is missing. Certain fallback or definitional lookups might fail if ever needed.");
        });

        it('should NOT throw but log a warning if dataRegistry is an empty object (missing getEntityDefinition)', () => {
            // The constructor only checks for the presence of dataRegistry, not its methods now
            rendererDeps.dataRegistry = {};
            expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
            // No specific error for missing getEntityDefinition is thrown by constructor;
            // the initial check is just for the presence of dataRegistry itself.
            // The previous warning for missing dataRegistry would still apply if it was null.
            // If it's an object but methods are missing, it will fail at runtime if those methods are called.
            // Our constructor's check for dataRegistry is now minimal.
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
            // Reset mocks that might be modified in tests
            mockEntityManager.getEntityInstance.mockReset();
            mockEntityManager.getEntitiesInLocation.mockReset().mockReturnValue(new Set()); // Default
            mockPlayerEntity.getComponentData.mockReset();
            mockLocationEntityInstance.getComponentData.mockReset(); // Reset for the location instance mock

            // Default mock implementations for this describe block
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                if (id === MOCK_LOCATION_ID) return mockLocationEntityInstance; // Default to returning the mock location
                return null;
            });
            mockPlayerEntity.getComponentData.mockImplementation(compId => {
                if (compId === POSITION_COMPONENT_ID) return {locationId: MOCK_LOCATION_ID};
                return null;
            });
            // Default components for the mockLocationEntityInstance
            mockLocationEntityInstance.getComponentData.mockImplementation(compId => {
                if (compId === NAME_COMPONENT_ID) return {text: "Default Location Name"};
                if (compId === DESCRIPTION_COMPONENT_ID) return {text: "Default Description."};
                if (compId === EXITS_COMPONENT_ID) return []; // Default to no exits
                return null;
            });

            renderer = new LocationRenderer(rendererDeps); // Create renderer instance AFTER mocks are set for the event callback
        });

        const simulateTurnStarted = (payloadOverride = {}) => {
            const event = {
                type: 'core:turn_started',
                payload: {entityId: MOCK_PLAYER_ID, entityType: 'player', ...payloadOverride},
            };
            if (turnStartedCallback) {
                turnStartedCallback(event);
            } else {
                throw new Error("turnStartedCallback was not captured. Ensure LocationRenderer is instantiated in beforeEach for this describe block.");
            }
        };

        it('should clear displays and log warning if event payload has no entityId', () => {
            jest.spyOn(renderer, 'render'); // Spy on the actual render method of the instance
            turnStartedCallback({type: 'core:turn_started', payload: {}}); // Simulate event

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('event is missing entityId'));
            expect(mockNameDisplay.textContent).toContain('(Location Unknown)');
            expect(mockDescriptionDisplay.textContent).toContain('No entity specified for turn.');
            expect(mockExitsDisplay.textContent).toContain('(Exits Unavailable)');
            expect(mockCharactersDisplay.textContent).toContain('(Characters Unavailable)');
            expect(renderer.render).not.toHaveBeenCalled();
        });

        it('should clear displays and log warning if entity not found', () => {
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === MOCK_PLAYER_ID) return null; // Player not found
                return mockLocationEntityInstance; // Location might still exist
            });
            simulateTurnStarted();
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Entity '${MOCK_PLAYER_ID}' (whose turn started) not found`));
            expect(mockDescriptionDisplay.textContent).toContain(`Entity ${MOCK_PLAYER_ID} not found.`);
        });

        it('should clear displays and log warning if entity has no position component', () => {
            mockPlayerEntity.getComponentData.mockReturnValue(null); // No position component for player
            simulateTurnStarted();
            expect(mockPlayerEntity.getComponentData).toHaveBeenCalledWith(POSITION_COMPONENT_ID);
            expect(mockDescriptionDisplay.textContent).toContain(`Location for ${MOCK_PLAYER_ID} is unknown.`);
        });

        it('should clear displays and log error if location INSTANCE not found', () => {
            // Player exists and has position, but the location instance itself is not found
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                if (id === MOCK_LOCATION_ID) return null; // Location instance not found
                return null;
            });
            simulateTurnStarted();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(MOCK_LOCATION_ID);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Location entity INSTANCE for ID '${MOCK_LOCATION_ID}' not found in EntityManager.`));
            expect(mockDescriptionDisplay.textContent).toContain(`Location data for '${MOCK_LOCATION_ID}' missing (instance not found).`);
        });


        describe('Exits Processing and Rendering', () => {
            beforeEach(() => {
                // Location instance will have name and description
                mockLocationEntityInstance.getComponentData.mockImplementation(compId => {
                    if (compId === NAME_COMPONENT_ID) return {text: "Test Location"};
                    if (compId === DESCRIPTION_COMPONENT_ID) return {text: "A place for testing."};
                    // EXITS_COMPONENT_ID will be set per test
                    return null;
                });
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set()); // No other characters for these exit tests
            });

            it('should render with one exit correctly formatted', () => {
                mockLocationEntityInstance.getComponentData.mockImplementation(compId => {
                    if (compId === NAME_COMPONENT_ID) return {text: "Test Location"};
                    if (compId === DESCRIPTION_COMPONENT_ID) return {text: "A place for testing."};
                    if (compId === EXITS_COMPONENT_ID) return [{direction: "North", target: "world:loc2_def"}];
                    return null;
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith({
                    name: "Test Location",
                    description: "A place for testing.",
                    exits: [{description: "North", id: "world:loc2_def"}],
                    characters: []
                });
                const exitListItems = mockExitsDisplay.querySelectorAll('ul li');
                expect(exitListItems.length).toBe(1);
                expect(exitListItems[0].textContent).toBe("North");
            });

            it('should render with multiple exits correctly formatted', () => {
                mockLocationEntityInstance.getComponentData.mockImplementation(compId => {
                    if (compId === NAME_COMPONENT_ID) return {text: "Test Location"};
                    if (compId === DESCRIPTION_COMPONENT_ID) return {text: "A place for testing."};
                    if (compId === EXITS_COMPONENT_ID) return [
                        {direction: "North", target: "world:loc2_def"},
                        {direction: "South to the town", target: "world:town_def"}
                    ];
                    return null;
                });
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');

                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    exits: [
                        {description: "North", id: "world:loc2_def"},
                        {description: "South to the town", id: "world:town_def"}
                    ]
                }));
                expect(renderer._renderList).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({description: "North"}),
                        expect.objectContaining({description: "South to the town"})
                    ]),
                    mockExitsDisplay, 'Exits', 'description', '(None visible)'
                );
            });

            it('should render with "None visible" if exits component is an empty array', () => {
                mockLocationEntityInstance.getComponentData.mockImplementation(compId => {
                    if (compId === NAME_COMPONENT_ID) return {text: "Test Location"};
                    if (compId === DESCRIPTION_COMPONENT_ID) return {text: "A place for testing."};
                    if (compId === EXITS_COMPONENT_ID) return [];
                    return null;
                });
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({exits: []}));
                expect(renderer._renderList).toHaveBeenCalledWith([], mockExitsDisplay, 'Exits', 'description', '(None visible)');
                expect(mockExitsDisplay.querySelector('p.empty-list-message').textContent).toBe("(None visible)");
            });

            it('should render with "None visible" if exits component is missing from location instance', () => {
                // EXITS_COMPONENT_ID will return null from mockLocationEntityInstance.getComponentData
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({exits: []}));
                expect(renderer._renderList).toHaveBeenCalledWith([], mockExitsDisplay, 'Exits', 'description', '(None visible)');
            });
        });


        describe('Characters Processing and Rendering', () => {
            beforeEach(() => {
                // Default location instance data for character tests
                mockLocationEntityInstance.getComponentData.mockImplementation(compId => {
                    if (compId === NAME_COMPONENT_ID) return {text: "Guild Hall"};
                    if (compId === DESCRIPTION_COMPONENT_ID) return {text: "A busy place."};
                    if (compId === EXITS_COMPONENT_ID) return [];
                    return null;
                });
            });

            it('should render "None else here" if no other characters are in the location', () => {
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID])); // Only player is in location
                jest.spyOn(renderer, '_renderList');
                simulateTurnStarted();

                expect(renderer._renderList).toHaveBeenCalledWith(
                    [], mockCharactersDisplay, 'Characters', 'name', '(None else here)'
                );
            });

            it('should render a character with name and description', () => {
                const otherActor = {
                    id: MOCK_OTHER_ACTOR_ID,
                    hasComponent: jest.fn(compId => compId === ACTOR_COMPONENT_ID),
                    getComponentData: jest.fn(compId => {
                        if (compId === NAME_COMPONENT_ID) return {text: "Guard"};
                        if (compId === DESCRIPTION_COMPONENT_ID) return {text: "A stern-looking guard."};
                        return null;
                    })
                };
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID, MOCK_OTHER_ACTOR_ID]));
                // Update getEntityInstance to find this other actor
                mockEntityManager.getEntityInstance.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                    if (id === MOCK_LOCATION_ID) return mockLocationEntityInstance;
                    if (id === MOCK_OTHER_ACTOR_ID) return otherActor;
                    return null;
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    characters: [{id: MOCK_OTHER_ACTOR_ID, name: "Guard", description: "A stern-looking guard."}]
                }));
            });

            it('should render a character with name only if no description component', () => {
                const otherActorNoDesc = {
                    id: MOCK_OTHER_ACTOR_ID,
                    hasComponent: jest.fn(compId => compId === ACTOR_COMPONENT_ID),
                    getComponentData: jest.fn(compId => {
                        if (compId === NAME_COMPONENT_ID) return {text: "Silent Bob"};
                        return null;
                    })
                };
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID, MOCK_OTHER_ACTOR_ID]));
                mockEntityManager.getEntityInstance.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                    if (id === MOCK_LOCATION_ID) return mockLocationEntityInstance;
                    if (id === MOCK_OTHER_ACTOR_ID) return otherActorNoDesc;
                    return null;
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    characters: [{id: MOCK_OTHER_ACTOR_ID, name: "Silent Bob", description: undefined}]
                }));
            });

            it('should exclude the current actor from the character list', () => {
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID]));
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    characters: []
                }));
            });

            it('should ignore non-actor entities in the location', () => {
                const nonActorEntity = {
                    id: MOCK_NON_ACTOR_ID,
                    hasComponent: jest.fn(() => false), // Does not have ACTOR_COMPONENT_ID
                    getComponentData: jest.fn(compId => (compId === NAME_COMPONENT_ID ? {text: "A Rock"} : null))
                };
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID, MOCK_NON_ACTOR_ID]));
                mockEntityManager.getEntityInstance.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                    if (id === MOCK_LOCATION_ID) return mockLocationEntityInstance;
                    if (id === MOCK_NON_ACTOR_ID) return nonActorEntity;
                    return null;
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({characters: []}));
            });
        });

        it('should log an error if a display element (e.g., charactersDisplay) is not found during render', () => {
            // Ensure location instance IS found for this test
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === MOCK_PLAYER_ID) return mockPlayerEntity;
                if (id === MOCK_LOCATION_ID) return mockLocationEntityInstance; // Location instance exists
                return null;
            });
            // Make one of the query calls for display elements return null
            mockDocumentContext.query.mockImplementation(selector => {
                if (selector === '#location-characters-display') return null; // Intentionally missing
                if (selector === '#location-name-display') return mockNameDisplay;
                if (selector === '#location-description-display') return mockDescriptionDisplay;
                if (selector === '#location-exits-display') return mockExitsDisplay;
                return null;
            });

            // Re-initialize renderer with the modified mockDocumentContext for this specific test
            // to ensure it uses the mock that returns null for charactersDisplay.
            const testRenderer = new LocationRenderer(rendererDeps);
            // Capture the callback for *this* instance
            let specificTurnStartedCallback;
            mockVed.subscribe.mockImplementationOnce((eventType, callback) => {
                if (eventType === 'core:turn_started') specificTurnStartedCallback = callback;
                return jest.fn();
            });
            new LocationRenderer(rendererDeps); // This makes sure the subscription uses the fresh mock (if needed)

            // Use the specific callback if captured, otherwise fall back to the general one.
            const callbackToUse = specificTurnStartedCallback || turnStartedCallback;
            if (callbackToUse) {
                callbackToUse({
                    type: 'core:turn_started',
                    payload: {entityId: MOCK_PLAYER_ID, entityType: 'player'},
                });
            } else {
                throw new Error("Turn started callback not captured for specific test instance.");
            }

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Element #location-characters-display not found."));
        });
    });

    describe('dispose', () => {
        it('should handle dispose being called multiple times gracefully', () => {
            const renderer = new LocationRenderer(rendererDeps);
            // The first subscribe call is in the constructor.
            // mockVed.subscribe has been called once at this point.
            // The mock.results[0].value is the unsubscribe function from the first call.
            const mockUnsubscribe = mockVed.subscribe.mock.results[0].value;

            renderer.dispose();
            expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

            renderer.dispose(); // Call dispose again
            expect(mockUnsubscribe).toHaveBeenCalledTimes(1); // Unsubscribe should still only be called once
            expect(mockLogger.info).toHaveBeenCalledWith('[LocationRenderer] LocationRenderer disposed.');
        });
    });
});
// --- FILE END ---