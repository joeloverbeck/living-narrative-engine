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


/** @returns {import('../../src/core/interfaces/ILogger.js').ILogger} */
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
        // Provide a querySelector on the mockDocument itself if needed for global queries
        querySelector: jest.fn(),
    };
    return {
        document: mockDocument,
        query: jest.fn(), // This will be spied on/mocked per test or setup
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
    subscribe: jest.fn(() => jest.fn()),
    dispatchValidated: jest.fn(),
});

/** @returns {import('../../src/domUI/domElementFactory.js').default} */
const createMockDomElementFactory = (mockDocumentContextInstance) => ({
    create: jest.fn((tagName, options) => { // Align with typical use if options is an object
        const el = mockDocumentContextInstance.document.createElement(tagName);
        if (options && options.cls) {
            if (Array.isArray(options.cls)) el.classList.add(...options.cls);
            else el.className = options.cls;
        }
        if (options && options.text) el.textContent = options.text;
        if (options && options.id) el.id = options.id;
        // Add other common options handling if necessary
        return el;
    }),
    p: jest.fn((className, textContent) => {
        const el = mockDocumentContextInstance.document.createElement('p');
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
    }),
    h3: jest.fn((className, textContent) => {
        const el = mockDocumentContextInstance.document.createElement('h3');
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
    }),
    h4: jest.fn((className, textContent) => {
        const el = mockDocumentContextInstance.document.createElement('h4');
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
    }),
    ul: jest.fn((id, cls) => { // Align with factory method signature
        const el = mockDocumentContextInstance.document.createElement('ul');
        if (id) el.id = id;
        if (cls) {
            if (Array.isArray(cls)) el.classList.add(...cls);
            else el.className = cls;
        }
        return el;
    }),
    li: jest.fn((cls, text) => { // Align with factory method signature
        const el = mockDocumentContextInstance.document.createElement('li');
        if (cls) {
            if (Array.isArray(cls)) el.classList.add(...cls);
            else el.className = cls;
        }
        if (text) el.textContent = text;
        return el;
    }),
    span: jest.fn((cls, text) => { // Align with factory method signature
        const el = mockDocumentContextInstance.document.createElement('span');
        if (cls) {
            if (Array.isArray(cls)) el.classList.add(...cls);
            else el.className = cls;
        }
        if (text) el.textContent = text;
        return el;
    }),
});

/** @returns {import('../../src/interfaces/IEntityManager.js').IEntityManager} */
const createMockEntityManager = () => ({
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()),
});

/** @returns {import('../../src/core/interfaces/IDataRegistry.js').IDataRegistry} */
const createMockDataRegistry = () => ({
    getEntityDefinition: jest.fn(),
});

// +++ ADDED MOCK FOR EntityDisplayDataProvider +++
/** @returns {import('../../src/services/EntityDisplayDataProvider.js').EntityDisplayDataProvider} */
const createMockEntityDisplayDataProvider = () => ({
    getEntityLocationId: jest.fn(),
    getLocationDetails: jest.fn(),
    getCharacterDisplayInfo: jest.fn(),
    getEntityName: jest.fn(),
    getEntityPortraitPath: jest.fn(),
    // Add any other methods that might be called by LocationRenderer
});


describe('LocationRenderer', () => {
    let mockLogger;
    let mockDocumentContext;
    let mockVed;
    let mockDomElementFactory;
    let mockEntityManager;
    let mockEntityDisplayDataProvider; // +++ DECLARED +++
    let mockDataRegistry;
    let mockContainerElement;
    let mockNameDisplay, mockDescriptionDisplay, mockExitsDisplay, mockCharactersDisplay;

    let rendererDeps;
    let turnStartedCallback;

    const MOCK_PLAYER_ID = 'player:1';
    const MOCK_LOCATION_ID = 'instance:loc1';
    const MOCK_LOCATION_DEF_ID = 'world:loc_def1';
    const MOCK_OTHER_ACTOR_ID = 'npc:guard';
    const MOCK_NON_ACTOR_ID = 'item:rock';

    let mockLocationEntityInstance;


    beforeEach(() => {
        mockLogger = createMockLogger();
        mockDocumentContext = createMockDocumentContext();
        mockVed = createMockVed();
        mockDomElementFactory = createMockDomElementFactory(mockDocumentContext);
        mockEntityManager = createMockEntityManager();
        mockEntityDisplayDataProvider = createMockEntityDisplayDataProvider(); // +++ INSTANTIATED +++
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

        // This mockDocumentContext.query is critical for BoundDomRendererBase
        mockDocumentContext.query.mockImplementation(selector => {
            // console.log(`[Test mockDocumentContext.query] Selector: '${selector}'`);
            if (selector === '#location-name-display') return mockNameDisplay;
            if (selector === '#location-description-display') return mockDescriptionDisplay;
            if (selector === '#location-exits-display') return mockExitsDisplay;
            if (selector === '#location-characters-display') return mockCharactersDisplay;
            // Add other selectors if BoundDomRendererBase in other tests needs them
            return document.querySelector(selector); // Fallback to actual JSDOM querySelector
        });

        rendererDeps = {
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockVed,
            domElementFactory: mockDomElementFactory,
            entityManager: mockEntityManager,
            entityDisplayDataProvider: mockEntityDisplayDataProvider, // +++ ADDED TO DEPS +++
            dataRegistry: mockDataRegistry,
            containerElement: mockContainerElement,
        };

        turnStartedCallback = undefined;
        mockVed.subscribe.mockImplementation((eventType, callback) => {
            if (eventType === 'core:turn_started') {
                turnStartedCallback = callback;
            }
            return jest.fn();
        });

        mockLocationEntityInstance = {
            id: MOCK_LOCATION_ID,
            definitionId: MOCK_LOCATION_DEF_ID,
            getComponentData: jest.fn(),
            hasComponent: jest.fn(),
        };

        // Default mock implementations for EntityDisplayDataProvider
        mockEntityDisplayDataProvider.getEntityLocationId.mockReturnValue(MOCK_LOCATION_ID);
        mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
            name: "Default Mock Location",
            description: "A default mock description.",
            exits: []
        });
        mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(id => ({
            id: id,
            name: `Mock Character ${id}`,
            description: `Description for ${id}`,
            portraitPath: null
        }));

    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
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
            rendererDeps.entityManager = {getEntitiesInLocation: jest.fn()};
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityManager' dependency is missing or invalid (must have getEntityInstance and getEntitiesInLocation).");
        });
        it('should throw if entityManager is missing getEntitiesInLocation', () => {
            rendererDeps.entityManager = {getEntityInstance: jest.fn()};
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityManager' dependency is missing or invalid (must have getEntityInstance and getEntitiesInLocation).");
        });

        // +++ Test for missing entityDisplayDataProvider +++
        it('should throw if entityDisplayDataProvider is missing', () => {
            delete rendererDeps.entityDisplayDataProvider; // Or set to null
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityDisplayDataProvider' dependency is missing or invalid.");
        });
        it('should throw if entityDisplayDataProvider is invalid (e.g., missing getLocationDetails)', () => {
            rendererDeps.entityDisplayDataProvider = {getEntityLocationId: jest.fn()}; // Missing other methods
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityDisplayDataProvider' dependency is missing or invalid.");
        });


        it('should NOT throw but log a warning if dataRegistry is missing', () => {
            rendererDeps.dataRegistry = null;
            expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
            expect(mockLogger.warn).toHaveBeenCalledWith("[LocationRenderer] 'dataRegistry' dependency is missing. Certain fallback or definitional lookups might fail if ever needed.");
        });

        it('should NOT throw but log a warning if dataRegistry is an empty object (missing getEntityDefinition)', () => {
            rendererDeps.dataRegistry = {};
            expect(() => new LocationRenderer(rendererDeps)).not.toThrow();
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
            getComponentData: jest.fn(), // Will be spied on if used directly
            hasComponent: jest.fn(),   // Will be spied on if used directly
        };


        beforeEach(() => {
            mockEntityManager.getEntityInstance.mockReset();
            mockEntityManager.getEntitiesInLocation.mockReset().mockReturnValue(new Set());
            mockEntityDisplayDataProvider.getEntityLocationId.mockReset().mockReturnValue(MOCK_LOCATION_ID);
            mockEntityDisplayDataProvider.getLocationDetails.mockReset().mockReturnValue({
                name: "Test Location from EDDP",
                description: "A test description from EDDP.",
                exits: []
            });
            mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockReset();


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
                throw new Error("turnStartedCallback was not captured.");
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

        it('should clear displays and log warning if entity has no locationId via EDDP', () => {
            mockEntityDisplayDataProvider.getEntityLocationId.mockReturnValue(null); // Simulate EDDP returning no location
            simulateTurnStarted();
            expect(mockEntityDisplayDataProvider.getEntityLocationId).toHaveBeenCalledWith(MOCK_PLAYER_ID);
            expect(mockDescriptionDisplay.textContent).toContain(`Location for ${MOCK_PLAYER_ID} is unknown.`);
        });


        it('should clear displays and log error if location details not found via EDDP', () => {
            mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue(null); // Simulate EDDP returning no details for the location
            simulateTurnStarted();
            expect(mockEntityDisplayDataProvider.getLocationDetails).toHaveBeenCalledWith(MOCK_LOCATION_ID);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Location details for ID '${MOCK_LOCATION_ID}' not found via EntityDisplayDataProvider.`));
            expect(mockDescriptionDisplay.textContent).toContain(`Location data for '${MOCK_LOCATION_ID}' missing.`);
        });


        describe('Exits Processing and Rendering', () => {
            beforeEach(() => {
                mockEntityDisplayDataProvider.getLocationDetails.mockImplementation(locId => {
                    if (locId === MOCK_LOCATION_ID) {
                        return {
                            name: "Test Location",
                            description: "A place for testing.",
                            exits: [] // Default, override in tests
                        };
                    }
                    return null;
                });
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set());
            });

            it('should render with one exit correctly formatted', () => {
                const mockExit = {description: "North", id: "world:loc2_def", target: "world:loc2_def"};
                mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
                    name: "Test Location",
                    description: "A place for testing.",
                    exits: [mockExit]
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith({
                    name: "Test Location",
                    description: "A place for testing.",
                    exits: [mockExit],
                    characters: []
                });
                const exitListItems = mockExitsDisplay.querySelectorAll('ul li');
                expect(exitListItems.length).toBe(1);
                expect(exitListItems[0].textContent).toBe("North");
            });

            it('should render with multiple exits correctly formatted', () => {
                const mockExits = [
                    {description: "North", id: "world:loc2_def", target: "world:loc2_def"},
                    {description: "South to the town", id: "world:town_def", target: "world:town_def"}
                ];
                mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
                    name: "Test Location",
                    description: "A place for testing.",
                    exits: mockExits
                });
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');

                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({exits: mockExits}));
                expect(renderer._renderList).toHaveBeenCalledWith(
                    mockExits,
                    mockExitsDisplay, 'Exits', 'description', '(None visible)'
                );
            });

            it('should render with "None visible" if exits array from EDDP is empty', () => {
                mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
                    name: "Test Location",
                    description: "A place for testing.",
                    exits: []
                });
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({exits: []}));
                expect(renderer._renderList).toHaveBeenCalledWith([], mockExitsDisplay, 'Exits', 'description', '(None visible)');
                expect(mockExitsDisplay.querySelector('p.empty-list-message').textContent).toBe("(None visible)");
            });
        });


        describe('Characters Processing and Rendering', () => {
            beforeEach(() => {
                mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
                    name: "Guild Hall",
                    description: "A busy place.",
                    exits: []
                });
            });

            it('should render "None else here" if no other characters are in the location', () => {
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID]));
                mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockReturnValue(null); // Ensure it's not called or returns null
                jest.spyOn(renderer, '_renderList');
                simulateTurnStarted();

                expect(renderer._renderList).toHaveBeenCalledWith(
                    [], mockCharactersDisplay, 'Characters', 'name', '(None else here)'
                );
            });

            it('should render a character with name and description via EDDP', () => {
                const otherActorId = MOCK_OTHER_ACTOR_ID;
                const characterInfo = {
                    id: otherActorId,
                    name: "Guard",
                    description: "A stern-looking guard.",
                    portraitPath: null
                };

                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID, otherActorId]));
                // Mocking direct entity.hasComponent for the check inside #handleTurnStarted
                mockEntityManager.getEntityInstance.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return {id: MOCK_PLAYER_ID, hasComponent: () => false}; // Mock player
                    if (id === otherActorId) return {
                        id: otherActorId,
                        hasComponent: (compId) => compId === ACTOR_COMPONENT_ID
                    }; // Mock other actor
                    return null;
                });
                mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(id => {
                    if (id === otherActorId) return characterInfo;
                    return null;
                });

                jest.spyOn(renderer, 'render');
                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    characters: [characterInfo]
                }));
            });

            it('should render a character with name only if description is undefined/empty from EDDP', () => {
                const otherActorId = MOCK_OTHER_ACTOR_ID;
                const characterInfoNoDesc = {id: otherActorId, name: "Silent Bob", description: "", portraitPath: null};
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID, otherActorId]));
                mockEntityManager.getEntityInstance.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return {id: MOCK_PLAYER_ID, hasComponent: () => false};
                    if (id === otherActorId) return {
                        id: otherActorId,
                        hasComponent: (compId) => compId === ACTOR_COMPONENT_ID
                    };
                    return null;
                });
                mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockReturnValue(characterInfoNoDesc);

                jest.spyOn(renderer, 'render');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    characters: [characterInfoNoDesc]
                }));
                // The _renderList method will handle empty description string correctly
            });

            it('should exclude the current actor from the character list', () => {
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID]));
                mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return {
                        id: MOCK_PLAYER_ID,
                        name: "Player",
                        description: "",
                        portraitPath: null
                    };
                    return null;
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({characters: []}));
            });

            it('should ignore non-actor entities in the location', () => {
                const nonActorId = MOCK_NON_ACTOR_ID;
                mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([MOCK_PLAYER_ID, nonActorId]));
                // Mock that nonActorId does NOT have ACTOR_COMPONENT_ID
                mockEntityManager.getEntityInstance.mockImplementation(id => {
                    if (id === MOCK_PLAYER_ID) return {id: MOCK_PLAYER_ID, hasComponent: () => false};
                    if (id === nonActorId) return {
                        id: nonActorId,
                        hasComponent: (compId) => compId !== ACTOR_COMPONENT_ID
                    }; // No actor component
                    return null;
                });
                // Ensure EDDP is not called for non-actor, or returns null
                mockEntityDisplayDataProvider.getCharacterDisplayInfo.mockImplementation(id => {
                    if (id === nonActorId) return null; // Or simply don't expect it to be called
                    return {id: id, name: "Some other char", description: "", portraitPath: null};
                });
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();
                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({characters: []}));
                expect(mockEntityDisplayDataProvider.getCharacterDisplayInfo).not.toHaveBeenCalledWith(nonActorId);
            });
        });

        it('should log an error if a display element (e.g., charactersDisplay) is not found during render', () => {
            mockEntityDisplayDataProvider.getLocationDetails.mockReturnValue({
                name: "Test",
                description: "Desc",
                exits: []
            });
            mockDocumentContext.query.mockImplementation(selector => {
                if (selector === '#location-characters-display') return null; // Intentionally missing
                if (selector === '#location-name-display') return mockNameDisplay;
                if (selector === '#location-description-display') return mockDescriptionDisplay;
                if (selector === '#location-exits-display') return mockExitsDisplay;
                return null;
            });

            const testRenderer = new LocationRenderer(rendererDeps);
            let specificTurnStartedCallback;
            // Re-capture subscribe for this specific test instance of renderer
            const originalSubscribe = mockVed.subscribe;
            mockVed.subscribe = jest.fn((eventType, callback) => {
                if (eventType === 'core:turn_started') {
                    specificTurnStartedCallback = callback;
                }
                return jest.fn();
            });
            new LocationRenderer(rendererDeps); // Instantiate with potentially new subscribe mock
            mockVed.subscribe = originalSubscribe; // Restore original mock

            if (specificTurnStartedCallback) {
                specificTurnStartedCallback({
                    type: 'core:turn_started',
                    payload: {entityId: MOCK_PLAYER_ID, entityType: 'player'},
                });
            } else if (turnStartedCallback) { // Fallback if the above didn't capture
                turnStartedCallback({
                    type: 'core:turn_started',
                    payload: {entityId: MOCK_PLAYER_ID, entityType: 'player'},
                });
            } else {
                throw new Error("Turn started callback not captured for specific test instance.");
            }
            expect(mockLogger.error).toHaveBeenCalledWith("[LocationRenderer] One or more display elements (name, description, exits, characters) are missing from this.elements.");
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
// --- FILE END ---