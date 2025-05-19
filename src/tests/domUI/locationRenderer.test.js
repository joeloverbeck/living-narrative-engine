// src/tests/domUI/locationRenderer.test.js
/**
 * @fileoverview Unit tests for the LocationRenderer class.
 * @jest-environment jsdom
 */

import {beforeEach, afterEach, describe, expect, it, jest} from '@jest/globals';
import {LocationRenderer} from '../../domUI/index.js';

// --- Mock Dependencies ---

// Mock component IDs directly, as they would be imported by the module under test
// It's often cleaner to mock the module they come from.
jest.mock('../../constants/componentIds.js', () => ({
    POSITION_COMPONENT_ID: 'test:position',
    NAME_COMPONENT_ID: 'test:name',
    DESCRIPTION_COMPONENT_ID: 'test:description',
    EXITS_COMPONENT_ID: 'test:exits',
}));

// Re-import constants to get the mocked values within the test file scope
// These are effectively the same string values as above due to the mock,
// but it makes the tests read as if they are using the "real" constants.
import {
    POSITION_COMPONENT_ID,
    NAME_COMPONENT_ID,
    DESCRIPTION_COMPONENT_ID,
    EXITS_COMPONENT_ID
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
            const el = document.createElement(tagName); // Use JSDOM's document
            jest.spyOn(el, 'appendChild');
            return el;
        }),
        createTextNode: jest.fn(text => document.createTextNode(text)), // Use JSDOM's document
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
    subscribe: jest.fn(() => jest.fn()), // Returns an unsubscribe mock
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
        if (textContent) el.textContent = textContent;
        return el;
    }),
});

/** @returns {import('../../core/interfaces/IEntityManager').IEntityManager} */
const createMockEntityManager = () => ({
    getEntityInstance: jest.fn(),
});

/** @returns {import('../../core/interfaces/IDataRegistry').IDataRegistry} */
const createMockDataRegistry = () => ({
    getEntityDefinition: jest.fn(),
});


describe('LocationRenderer', () => {
    /** @type {ILogger} */
    let mockLogger;
    /** @type {IDocumentContext} */
    let mockDocumentContext;
    /** @type {IValidatedEventDispatcher} */
    let mockVed;
    /** @type {DomElementFactory} */
    let mockDomElementFactory;
    /** @type {IEntityManager} */
    let mockEntityManager;
    /** @type {IDataRegistry} */
    let mockDataRegistry;
    /** @type {HTMLElement} */
    let mockContainerElement;
    /** @type {HTMLElement} */
    let mockNameDisplay, mockDescriptionDisplay, mockExitsDisplay, mockItemsDisplay, mockEntitiesDisplay;

    /** @type {{logger: ILogger, documentContext: IDocumentContext, validatedEventDispatcher: IValidatedEventDispatcher, domElementFactory: DomElementFactory, entityManager: IEntityManager, dataRegistry: IDataRegistry, containerElement: HTMLElement}} */
    let rendererDeps;

    /** @type {Function} */
    let turnStartedCallback; // To capture the callback passed to VED.subscribe

    const MOCK_PLAYER_ID = 'player:1';
    const MOCK_LOCATION_ID = 'world:loc1';

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockDocumentContext = createMockDocumentContext();
        mockVed = createMockVed();
        mockDomElementFactory = createMockDomElementFactory(mockDocumentContext);
        mockEntityManager = createMockEntityManager();
        mockDataRegistry = createMockDataRegistry();

        // Setup JSDOM elements for query selectors
        mockContainerElement = document.createElement('div');
        mockContainerElement.id = 'location-info-container';

        mockNameDisplay = document.createElement('div');
        mockNameDisplay.id = 'location-name-display';
        mockDescriptionDisplay = document.createElement('div');
        mockDescriptionDisplay.id = 'location-description-display';
        mockExitsDisplay = document.createElement('div');
        mockExitsDisplay.id = 'location-exits-display';
        mockItemsDisplay = document.createElement('div');
        mockItemsDisplay.id = 'location-items-display';
        mockEntitiesDisplay = document.createElement('div');
        mockEntitiesDisplay.id = 'location-entities-display';

        // Add to a dummy parent in JSDOM's body to make querySelector work
        document.body.appendChild(mockContainerElement);
        mockContainerElement.appendChild(mockNameDisplay);
        mockContainerElement.appendChild(mockDescriptionDisplay);
        mockContainerElement.appendChild(mockExitsDisplay);
        mockContainerElement.appendChild(mockItemsDisplay);
        mockContainerElement.appendChild(mockEntitiesDisplay);

        mockDocumentContext.query.mockImplementation(selector => {
            if (selector === '#location-name-display') return mockNameDisplay;
            if (selector === '#location-description-display') return mockDescriptionDisplay;
            if (selector === '#location-exits-display') return mockExitsDisplay;
            if (selector === '#location-items-display') return mockItemsDisplay;
            if (selector === '#location-entities-display') return mockEntitiesDisplay;
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

        // Capture the event handler
        mockVed.subscribe.mockImplementation((eventType, callback) => {
            if (eventType === 'core:turn_started') {
                turnStartedCallback = callback;
            }
            return jest.fn(); // unsubscribe function
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = ''; // Clean up JSDOM
    });

    // --- Constructor Tests ---
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
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'entityManager' dependency is missing or invalid.");
        });

        it('should throw if dataRegistry is missing or invalid', () => {
            rendererDeps.dataRegistry = null;
            expect(() => new LocationRenderer(rendererDeps)).toThrow("'dataRegistry' dependency is missing or invalid");
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

    // --- Event Handling and Rendering Logic ---
    describe('#handleTurnStarted and render', () => {
        let renderer;
        const mockPlayerEntity = {
            getComponentData: jest.fn(),
            id: MOCK_PLAYER_ID
        };

        beforeEach(() => {
            renderer = new LocationRenderer(rendererDeps); // Instance created, subscription happens.
            // Reset mocks for entity and registry for each test in this block
            mockEntityManager.getEntityInstance.mockReset();
            mockDataRegistry.getEntityDefinition.mockReset();
            mockPlayerEntity.getComponentData.mockReset();

            mockEntityManager.getEntityInstance.mockReturnValue(mockPlayerEntity);
            mockPlayerEntity.getComponentData.mockReturnValue({locationId: MOCK_LOCATION_ID});
        });

        const simulateTurnStarted = (payloadOverride = {}) => {
            const event = {
                type: 'core:turn_started',
                payload: {entityId: MOCK_PLAYER_ID, entityType: 'player', ...payloadOverride},
            };
            turnStartedCallback(event);
        };

        it('should clear displays and log warning if event payload has no entityId', () => {
            jest.spyOn(renderer, 'render'); // Spy on render to check if it's called
            turnStartedCallback({type: 'core:turn_started', payload: {}}); // No entityId

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('event is missing entityId'));
            expect(mockNameDisplay.textContent).toContain('(Location Unknown)');
            expect(mockDescriptionDisplay.textContent).toContain('No entity specified for turn.');
            expect(mockExitsDisplay.textContent).toContain('(Exits Unavailable)');
            expect(renderer.render).not.toHaveBeenCalled(); // render method should not be called directly in this path
        });

        it('should clear displays and log warning if entity not found', () => {
            mockEntityManager.getEntityInstance.mockReturnValue(null);
            simulateTurnStarted();

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Entity '${MOCK_PLAYER_ID}' (whose turn started) not found`));
            expect(mockNameDisplay.textContent).toContain('(Location Unknown)');
            expect(mockDescriptionDisplay.textContent).toContain(`Entity ${MOCK_PLAYER_ID} not found.`);
        });

        it('should clear displays and log warning if entity has no position component', () => {
            mockPlayerEntity.getComponentData.mockReturnValue(null); // No position
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

            it('should render with one exit correctly formatted', () => {
                const locationDefWithExit = {
                    ...baseLocationDef,
                    components: {
                        ...baseLocationDef.components,
                        [EXITS_COMPONENT_ID]: [
                            {direction: "North", target: "world:loc2", blocker: null}
                        ]
                    }
                };
                mockDataRegistry.getEntityDefinition.mockReturnValue(locationDefWithExit);
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList'); // Spy on _renderList

                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith({
                    name: "Test Location",
                    description: "A place for testing.",
                    exits: [{description: "North", id: "world:loc2"}],
                    items: [],
                    entities: []
                });
                expect(mockNameDisplay.textContent).toBe("Test Location");
                expect(mockDescriptionDisplay.textContent).toBe("A place for testing.");

                // Check _renderList call for exits
                expect(renderer._renderList).toHaveBeenCalledWith(
                    [{description: "North", id: "world:loc2"}], // exits data
                    mockExitsDisplay, // target element
                    'Exits',            // title
                    'description',      // itemTextProperty
                    '(None visible)'    // emptyText
                );
                // Check DOM output (simplified)
                expect(mockExitsDisplay.querySelector('h4').textContent).toBe("Exits:");
                expect(mockExitsDisplay.querySelector('ul li').textContent).toBe("North");
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
                // EXITS_COMPONENT_ID is not in baseLocationDef.components
                mockDataRegistry.getEntityDefinition.mockReturnValue(baseLocationDef);
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');

                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({exits: []}));
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`No exits data found for location '${MOCK_LOCATION_ID}'`));
                expect(renderer._renderList).toHaveBeenCalledWith([], mockExitsDisplay, 'Exits', 'description', '(None visible)');
                expect(mockExitsDisplay.querySelector('p.empty-list-message').textContent).toBe("(None visible)");
            });

            it('should render with "None visible" and log warning if exits component is not an array', () => {
                const malformedExitsDef = {
                    ...baseLocationDef,
                    components: {...baseLocationDef.components, [EXITS_COMPONENT_ID]: {"oops": "not-an-array"}}
                };
                mockDataRegistry.getEntityDefinition.mockReturnValue(malformedExitsDef);
                jest.spyOn(renderer, 'render');
                jest.spyOn(renderer, '_renderList');

                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({exits: []}));
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Exits data for location '${MOCK_LOCATION_ID}' is present but not an array`),
                    {"oops": "not-an-array"}
                );
                expect(renderer._renderList).toHaveBeenCalledWith([], mockExitsDisplay, 'Exits', 'description', '(None visible)');
                expect(mockExitsDisplay.querySelector('p.empty-list-message').textContent).toBe("(None visible)");
            });

            it('should filter out exits with missing or falsy "direction" but include those with missing "target"', () => {
                const locationDefPartialExits = {
                    ...baseLocationDef,
                    components: {
                        ...baseLocationDef.components,
                        [EXITS_COMPONENT_ID]: [
                            {direction: "Valid Exit", target: "world:locValid"},
                            {target: "world:locMissingDirection"}, // Missing direction
                            {direction: null, target: "world:locNullDirection"}, // Null direction
                            {direction: "", target: "world:locEmptyDirection"}, // Empty direction
                            {direction: "Only Direction"} // Missing target (should be included)
                        ]
                    }
                };
                mockDataRegistry.getEntityDefinition.mockReturnValue(locationDefPartialExits);
                jest.spyOn(renderer, 'render');

                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
                    exits: [
                        {description: "Valid Exit", id: "world:locValid"},
                        {description: "Only Direction", id: undefined} // Target becomes undefined
                    ]
                }));
                expect(mockExitsDisplay.querySelectorAll('ul li').length).toBe(2);
                expect(mockExitsDisplay.querySelectorAll('ul li')[0].textContent).toBe("Valid Exit");
                expect(mockExitsDisplay.querySelectorAll('ul li')[1].textContent).toBe("Only Direction");
            });

            it('should use default texts if name/description components are missing', () => {
                const locationDefMinimal = {
                    id: MOCK_LOCATION_ID,
                    components: { // No name or description components
                        [EXITS_COMPONENT_ID]: [{direction: "East", target: "world:locE"}]
                    }
                };
                mockDataRegistry.getEntityDefinition.mockReturnValue(locationDefMinimal);
                jest.spyOn(renderer, 'render');
                simulateTurnStarted();

                expect(renderer.render).toHaveBeenCalledWith({
                    name: "Unnamed Location",
                    description: "No description available.",
                    exits: [{description: "East", id: "world:locE"}],
                    items: [],
                    entities: []
                });
                expect(mockNameDisplay.textContent).toBe("Unnamed Location");
                expect(mockDescriptionDisplay.textContent).toBe("No description available.");
            });
        });

        it('should log an error if a display element (e.g., exitsDisplay) is not found during render', () => {
            const locationDef = {
                id: MOCK_LOCATION_ID,
                components: {
                    [NAME_COMPONENT_ID]: {text: "Test Location"},
                    [DESCRIPTION_COMPONENT_ID]: {text: "A place for testing."},
                    [EXITS_COMPONENT_ID]: [{direction: "North", target: "world:loc2"}]
                }
            };
            mockDataRegistry.getEntityDefinition.mockReturnValue(locationDef);
            // Simulate the element being missing
            mockDocumentContext.query.mockImplementation(selector => {
                if (selector === '#location-exits-display') return null; // Critical element missing
                if (selector === '#location-name-display') return mockNameDisplay;
                if (selector === '#location-description-display') return mockDescriptionDisplay;
                // For items and entities, allow them to be missing for this specific test
                if (selector === '#location-items-display') return null;
                if (selector === '#location-entities-display') return null;
                return null;
            });

            // Re-create renderer with this specific mockDocumentContext setup for the query
            renderer = new LocationRenderer(rendererDeps);
            // Re-capture callback
            mockVed.subscribe.mockImplementation((eventType, callback) => {
                if (eventType === 'core:turn_started') {
                    turnStartedCallback = callback;
                }
                return jest.fn(); // unsubscribe function
            });
            new LocationRenderer(rendererDeps); // This will call subscribe again


            simulateTurnStarted();

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Element #location-exits-display not found."));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Element #location-items-display not found."));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Element #location-entities-display not found."));

            // Ensure other parts still rendered
            expect(mockNameDisplay.textContent).toBe("Test Location");
        });
    });

    describe('dispose', () => {
        it('should handle dispose being called multiple times gracefully', () => {
            const renderer = new LocationRenderer(rendererDeps);
            const mockUnsubscribe = mockVed.subscribe.mock.results[0].value;

            renderer.dispose();
            expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

            renderer.dispose(); // Call again
            expect(mockUnsubscribe).toHaveBeenCalledTimes(1); // Should not be called again
            expect(mockLogger.info).toHaveBeenCalledWith('[LocationRenderer] LocationRenderer disposed.');
        });
    });
});