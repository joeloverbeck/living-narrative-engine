// src/services/targetResolutionService.test.js

// ** Imports for Jest and Core Testing Utilities **
import {beforeEach, afterEach, describe, expect, jest, test} from '@jest/globals';

// ** Import Class Under Test **
import TargetResolutionService from '../../services/targetResolutionService.js'; // Adjust path
import {ResolutionStatus} from '../../services/targetResolutionService.js'; // Adjust path

// ** Import Dependencies for Mocking/Setup **
import Entity from '../../entities/entity.js'; // Adjust path
import Component from '../../components/component.js'; // Adjust path
import {NameComponent} from '../../components/nameComponent.js'; // Adjust path
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js'; // Adjust path
import {ConnectionsComponent} from '../../components/connectionsComponent.js'; // Adjust path
import {getEntityIdsForScopes} from '../../services/entityScopeService.js'; // Adjust path
import {findTarget} from '../../utils/targetFinder.js'; // Adjust path
import {resolveTargetConnection} from '../../services/connectionResolver.js'; // Adjust path
import {EVENT_DISPLAY_MESSAGE} from "../../types/eventTypes.js"; // Adjust path
import {TARGET_MESSAGES} from '../../utils/messages.js'; // Adjust path

// ** Import Types (for clarity, often optional in JS tests but good practice) **
/** @typedef {import('../../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */

// ========================================================================
// == Mock Dependencies ===================================================
// ========================================================================

// Mock the dependencies that TargetResolutionService uses internally
jest.mock('../../services/entityScopeService.js', () => ({
    getEntityIdsForScopes: jest.fn(),
}));
jest.mock('../../utils/targetFinder.js', () => ({
    findTarget: jest.fn(),
}));
jest.mock('../../services/connectionResolver.js', () => ({
    resolveTargetConnection: jest.fn(),
}));
// Mock PassageDetailsComponent methods if needed within tests
// jest.mock('../../components/passageDetailsComponent.js');


// --- Define Mock Component Classes Consistently (FIX for Filtering Error) ---
class RequiredComponent extends Component {
}

class ForbiddenComponent extends Component {
}

// --- End Consistent Definitions ---

// ========================================================================
// == Test Suite Setup ====================================================
// ========================================================================

describe('TargetResolutionService', () => {
    let targetResolutionService;
    let mockContext;
    let mockEntityManager;
    let mockComponentRegistry;
    let mockEventBus;
    let mockPlayerEntity;
    let mockCurrentLocation;
    let mockParsedCommand;
    let mockActionDefinition;

    // Helper to create basic mock entities
    const createMockEntity = (id, name = 'Mock Entity') => {
        const entity = new Entity(id);
        // Use the *real* addComponent initially to set NameComponent for easier setup
        entity.addComponent(new NameComponent({value: name}));

        // Add simplified mocks AFTER initial setup
        const components = new Map(entity.components); // Copy initial components
        entity.components = components; // Store components directly for easier mocking access

        entity.addComponent = jest.fn((componentInstance) => {
            const componentClass = componentInstance.constructor;
            if (components.has(componentClass)) {
                // Allow overwriting in tests if needed, with a warning
                // console.warn(`Mock Entity ${id}: Overwriting component ${componentClass.name}`);
            }
            components.set(componentClass, componentInstance);
        });
        entity.getComponent = jest.fn((componentClass) => {
            return components.get(componentClass);
        });
        entity.hasComponent = jest.fn((componentClass) => {
            // Ensure componentClass is valid before checking map
            if (typeof componentClass !== 'function') {
                // console.warn(`Mock Entity ${id}: hasComponent called with invalid type:`, componentClass);
                return false;
            }
            return components.has(componentClass);
        });
        entity.removeComponent = jest.fn((componentClass) => {
            if (typeof componentClass !== 'function') return false;
            return components.delete(componentClass);
        });

        return entity;
    };

    beforeEach(() => {
        // 1. Reset all mocks defined with jest.mock(...) and clear mock function calls
        jest.clearAllMocks();

        // 2. Instantiate the service
        targetResolutionService = new TargetResolutionService();

        // 3. Setup fresh mocks for context dependencies
        mockEntityManager = {
            entities: new Map(),
            getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
            componentRegistry: { // Mock componentRegistry as part of entityManager or separately
                get: jest.fn((compId) => {
                    // Return CONSISTENT mock component classes (FIX for Filtering Error)
                    if (compId === 'RequiredComponent') return RequiredComponent;
                    if (compId === 'ForbiddenComponent') return ForbiddenComponent;
                    if (compId === 'PassageDetailsComponent') return PassageDetailsComponent; // Real one for direction tests
                    // Add other mock component classes as needed
                    return undefined;
                }),
            },
            // Added mock for getEntitiesInLocation needed by entityScopeService mocks
            getEntitiesInLocation: jest.fn().mockReturnValue(new Set()),
        };
        mockEventBus = {
            dispatch: jest.fn().mockResolvedValue(undefined), // Mock async dispatch
        };
        mockPlayerEntity = createMockEntity('player-1', 'Player');
        mockCurrentLocation = createMockEntity('loc-1', 'Test Location');
        // Add ConnectionsComponent to mock location for direction tests
        mockCurrentLocation.addComponent(new ConnectionsComponent({connections: {}}));


        // Add player/location to mock entity manager map
        mockEntityManager.entities.set(mockPlayerEntity.id, mockPlayerEntity);
        mockEntityManager.entities.set(mockCurrentLocation.id, mockCurrentLocation);

        mockParsedCommand = {
            command: 'test',
            verb: 'test',
            directObjectPhrase: null, // Default, override in tests
            preposition: null,
            indirectObjectPhrase: null,
        };

        // Default mock ActionDefinition (override specific fields in tests)
        mockActionDefinition = {
            id: 'test:action_default',
            name: 'Test Action',
            target_domain: 'none', // Default, override in tests
            target_required_components: [],
            target_forbidden_components: [],
            // Add other fields if needed by the service
        };

        // Full mock ActionContext
        mockContext = {
            playerEntity: mockPlayerEntity,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            parsedCommand: mockParsedCommand,
            currentLocation: mockCurrentLocation, // Needed for 'direction' and some entity domains
            // Add other context fields if the service might use them
        };
    });

    // ========================================================================
    // == Basic Input Validation Tests ========================================
    // ========================================================================
    describe('Input Validation', () => {
        test('should return INVALID_INPUT if actionDefinition is missing', async () => {
            const result = await targetResolutionService.resolveActionTarget(null, mockContext);
            expect(result.status).toBe(ResolutionStatus.INVALID_INPUT);
            expect(result.error).toContain('Invalid action definition or context');
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        test('should return INVALID_INPUT if context is missing', async () => {
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, null);
            expect(result.status).toBe(ResolutionStatus.INVALID_INPUT);
            expect(result.error).toContain('Invalid action definition or context');
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        test('should return INVALID_INPUT if context lacks playerEntity', async () => {
            mockContext.playerEntity = null;
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);
            expect(result.status).toBe(ResolutionStatus.INVALID_INPUT);
            expect(result.error).toContain('Invalid action definition or context');
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });
        // Add tests for missing entityManager, eventBus, parsedCommand...

        test('should return INVALID_INPUT for "direction" domain if context lacks currentLocation', async () => {
            mockActionDefinition.target_domain = 'direction';
            mockContext.currentLocation = null;
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);
            expect(result.status).toBe(ResolutionStatus.INVALID_INPUT);
            expect(result.error).toContain('Context missing currentLocation for direction resolution');
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });
    });


    // ========================================================================
    // == Test Cases per Target Domain ========================================
    // ========================================================================

    describe('Domain: none', () => {
        test('should return FOUND_UNIQUE with targetType "none"', async () => {
            mockActionDefinition.target_domain = 'none';
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetType).toBe('none');
            expect(result.targetId).toBeNull();
            expect(result.targetEntity).toBeNull();
            expect(result.targetConnectionEntity).toBeNull();
            expect(result.candidateIds).toEqual([]);
            expect(result.details).toBeNull();
            expect(result.error).toBeNull();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled(); // No message for 'none' success
        });
    });

    describe('Domain: self', () => {
        test('should return FOUND_UNIQUE with targetType "self" referencing player', async () => {
            mockActionDefinition.target_domain = 'self';
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetType).toBe('self');
            expect(result.targetId).toBe(mockPlayerEntity.id);
            expect(result.targetEntity).toBe(mockPlayerEntity); // Should return the actual entity instance
            expect(result.targetConnectionEntity).toBeNull();
            expect(result.candidateIds).toEqual([]);
            expect(result.details).toBeNull();
            expect(result.error).toBeNull();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled(); // No message for 'self' success
        });
    });

    describe('Domain: direction', () => {
        beforeEach(() => {
            mockActionDefinition.target_domain = 'direction';
            mockParsedCommand.directObjectPhrase = 'north'; // Default direction
        });

        test('should return NOT_FOUND if resolveTargetConnection returns null', async () => {
            // Arrange: Mock resolveTargetConnection to return null
            resolveTargetConnection.mockReturnValue(null);

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(resolveTargetConnection).toHaveBeenCalledWith(mockContext, 'north', mockActionDefinition.name);
            expect(result.status).toBe(ResolutionStatus.NOT_FOUND); // Assuming null from resolver means NOT_FOUND
            expect(result.targetType).toBeNull();
            expect(result.targetId).toBeNull();
            expect(result.targetConnectionEntity).toBeNull();
            expect(result.details).toEqual({searchedDirection: 'north'});
            // NOTE: resolveTargetConnection is expected to dispatch the user message, so TRS doesn't.
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        test('should return FOUND_UNIQUE if resolveTargetConnection returns a valid connection with PassageDetails', async () => {
            // Arrange: Create mock connection entity and passage details
            const mockConnection = createMockEntity('conn-n', 'North Door');
            const mockPassageDetails = new PassageDetailsComponent({
                locationAId: mockCurrentLocation.id, locationBId: 'loc-other',
                directionAtoB: 'north', directionBtoA: 'south',
                blockerEntityId: 'blocker-1'
            });
            mockConnection.addComponent(mockPassageDetails); // Use the mock addComponent
            // Mock resolveTargetConnection to return the entity
            resolveTargetConnection.mockReturnValue(mockConnection);

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(resolveTargetConnection).toHaveBeenCalledWith(mockContext, 'north', mockActionDefinition.name);
            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetType).toBe('direction');
            expect(result.targetId).toBe(mockConnection.id);
            expect(result.targetConnectionEntity).toBe(mockConnection);
            expect(result.targetEntity).toBeNull();
            expect(result.details).toEqual({targetLocationId: 'loc-other', blockerEntityId: 'blocker-1'});
            expect(result.error).toBeNull();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        test('should return INVALID_INPUT if directObjectPhrase is missing/empty', async () => {
            // Arrange
            mockParsedCommand.directObjectPhrase = '  '; // Empty or whitespace

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(result.status).toBe(ResolutionStatus.INVALID_INPUT);
            expect(result.error).toBe('Missing direction name.');
            expect(result.details).toEqual({message: "Direction name missing from command."});
            expect(resolveTargetConnection).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        test('should return ERROR if resolved ConnectionEntity lacks PassageDetailsComponent', async () => {
            // Arrange: Resolve returns entity *without* the component
            const mockConnectionNoDetails = createMockEntity('conn-n-broken', 'North Arch');
            // Ensure it doesn't have the component (it won't by default with createMockEntity after NameComponent)
            resolveTargetConnection.mockReturnValue(mockConnectionNoDetails);

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(result.status).toBe(ResolutionStatus.ERROR);
            expect(result.error).toContain('lacks required details');
            expect(result.details).toEqual({
                missingComponent: 'PassageDetailsComponent',
                entityId: mockConnectionNoDetails.id
            });
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        test('should return ERROR if PassageDetailsComponent method throws an error', async () => {
            // Arrange: Mock connection and passage details, make getOtherLocationId throw
            const mockConnection = createMockEntity('conn-n-error', 'North Error');
            const mockPassageDetails = new PassageDetailsComponent({
                locationAId: mockCurrentLocation.id, locationBId: 'loc-other',
                directionAtoB: 'north', directionBtoA: 'south',
            });
            // Mock the method on the instance to throw
            // IMPORTANT: Use jest.spyOn for existing methods of non-mocked classes
            jest.spyOn(mockPassageDetails, 'getOtherLocationId').mockImplementation(() => {
                throw new Error('Test Passage Error');
            });
            mockConnection.addComponent(mockPassageDetails); // Use mock addComponent
            resolveTargetConnection.mockReturnValue(mockConnection);

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(result.status).toBe(ResolutionStatus.ERROR);
            expect(result.error).toContain('Error processing passage details: Test Passage Error');
            expect(result.details).toEqual({passageError: 'Test Passage Error', entityId: mockConnection.id});
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        test('should return ERROR and dispatch internal error if resolveTargetConnection itself throws', async () => {
            // Arrange: Make the dependency throw
            const testError = new Error("Resolve Connection Failed");
            resolveTargetConnection.mockImplementation(() => {
                throw testError;
            });

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(result.status).toBe(ResolutionStatus.ERROR);
            expect(result.error).toContain('Error during direction resolution: Resolve Connection Failed');
            // Check that the generic internal error message was dispatched
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                EVENT_DISPLAY_MESSAGE,
                {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'}
            );
        });
    });

    describe('Domain: entity-based (inventory, environment, etc.)', () => {
        let mockTargetEntity1, mockTargetEntity2;
        // Note: RequiredComponent and ForbiddenComponent are now defined at the top level

        beforeEach(() => {
            // Default setup for entity domains
            mockActionDefinition.target_domain = 'environment'; // Example domain
            mockParsedCommand.directObjectPhrase = 'target'; // Default target phrase

            // Mock entities relevant to these tests
            mockTargetEntity1 = createMockEntity('target-1', 'First Target');
            mockTargetEntity2 = createMockEntity('target-2', 'Second Target');

            // Place targets in the environment (current location) for 'environment' scope
            mockEntityManager.entities.set(mockTargetEntity1.id, mockTargetEntity1);
            mockEntityManager.entities.set(mockTargetEntity2.id, mockTargetEntity2);
            // Assume getEntitiesInLocation handles placement for 'environment'
            const locationSet = new Set([mockTargetEntity1.id, mockTargetEntity2.id, mockPlayerEntity.id]); // Include player initially
            // Mock getEntitiesInLocation used by entityScopeService
            mockEntityManager.getEntitiesInLocation.mockReturnValue(locationSet);
            // Mock getEntityIdsForScopes directly based on mocked location contents
            // NOTE: environment scope resolves to nearby_including_blockers -> nearby -> location + inventory
            // We need to mock accordingly or let the real entityScopeService run against mocks
            getEntityIdsForScopes.mockReturnValue(new Set([mockTargetEntity1.id, mockTargetEntity2.id])); // Simplified mock return for tests

            // Default mocks for dependencies
            findTarget.mockReturnValue({status: 'NOT_FOUND', matches: []}); // Default to not found
        });

        test('should return INVALID_INPUT if directObjectPhrase is missing/empty', async () => {
            // Arrange
            mockParsedCommand.directObjectPhrase = '';

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(result.status).toBe(ResolutionStatus.INVALID_INPUT);
            expect(result.error).toBe('Missing target name.');
            expect(getEntityIdsForScopes).not.toHaveBeenCalled();
            expect(findTarget).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        test('should return FILTER_EMPTY and dispatch message if getEntityIdsForScopes returns empty set', async () => {
            // Arrange
            getEntityIdsForScopes.mockReturnValue(new Set()); // Override setup
            // Use the correct message function used by the service code
            const expectedMsgFunc = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
            const expectedMsg = expectedMsgFunc(mockActionDefinition.name, mockActionDefinition.target_domain);

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(result.status).toBe(ResolutionStatus.FILTER_EMPTY);
            expect(result.candidateIds).toEqual([]);
            expect(result.details).toEqual({reason: 'Initial scope empty'});
            expect(getEntityIdsForScopes).toHaveBeenCalledWith([mockActionDefinition.target_domain], mockContext);
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // Shouldn't try to get instances if scope is empty
            expect(findTarget).not.toHaveBeenCalled();
            // Verify message dispatch
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                EVENT_DISPLAY_MESSAGE,
                {text: expectedMsg, type: 'info'}
            );
        });

        test('should return FILTER_EMPTY and dispatch message if getEntityInstance returns null for all IDs', async () => {
            // Arrange: Scope returns IDs, but manager returns null for them
            const idSet = new Set(['target-1', 'target-2']);
            getEntityIdsForScopes.mockReturnValue(idSet);
            mockEntityManager.getEntityInstance.mockReturnValue(null); // Always return null
            // Use the correct message function used by the service code
            const expectedMsgFunc = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
            const expectedMsg = expectedMsgFunc(mockActionDefinition.name, mockActionDefinition.target_domain);


            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(result.status).toBe(ResolutionStatus.FILTER_EMPTY);
            expect(result.candidateIds).toEqual(['target-1', 'target-2']); // Should contain original IDs
            expect(result.details).toEqual({reason: 'No instances found for scope IDs'});
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('target-1');
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('target-2');
            expect(findTarget).not.toHaveBeenCalled();
            // Verify message dispatch
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                EVENT_DISPLAY_MESSAGE,
                {text: expectedMsg, type: 'info'}
            );
        });

        describe('Component Filtering', () => {
            beforeEach(() => {
                // Ensure entities exist for filtering tests (re-create fresh instances if needed)
                mockTargetEntity1 = createMockEntity('target-1', 'First Target');
                mockTargetEntity2 = createMockEntity('target-2', 'Second Target');
                const idSet = new Set([mockTargetEntity1.id, mockTargetEntity2.id]);
                getEntityIdsForScopes.mockReturnValue(idSet); // Ensure scope returns IDs
                // Ensure getEntityInstance returns the mock entities
                mockEntityManager.getEntityInstance.mockImplementation((id) => {
                    // Reset mockEntityManager.entities map if createMockEntity doesn't add to it
                    mockEntityManager.entities.set(mockTargetEntity1.id, mockTargetEntity1);
                    mockEntityManager.entities.set(mockTargetEntity2.id, mockTargetEntity2);
                    return mockEntityManager.entities.get(id); // Use the map
                });
            });

            test('should return FILTER_EMPTY if no candidates meet target_required_components', async () => {
                // Arrange: Define required component, entities don't have it
                mockActionDefinition.target_required_components = ['RequiredComponent'];
                // mockTargetEntity1 & 2 don't have RequiredComponent by default setup

                // FIX: Use the correct message function the service uses on fallback
                const expectedMsgFunc = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
                const expectedMsg = expectedMsgFunc(mockActionDefinition.name, mockActionDefinition.target_domain);


                // Act
                const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

                // Assert
                expect(result.status).toBe(ResolutionStatus.FILTER_EMPTY);
                // Check components of entities to be sure
                expect(mockTargetEntity1.hasComponent(RequiredComponent)).toBe(false);
                expect(mockTargetEntity2.hasComponent(RequiredComponent)).toBe(false);
                expect(result.candidateIds).toEqual([mockTargetEntity1.id, mockTargetEntity2.id]); // Initial candidates
                expect(result.details).toEqual({reason: 'All candidates filtered out by component requirements.'});
                expect(findTarget).not.toHaveBeenCalled();
                expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    EVENT_DISPLAY_MESSAGE,
                    {text: expectedMsg, type: 'info'}
                );
            });

            test('should return FILTER_EMPTY if all candidates have target_forbidden_components', async () => {
                // Arrange: Define forbidden component, add it to both entities
                mockActionDefinition.target_forbidden_components = ['ForbiddenComponent'];
                // Use the CONSISTENT ForbiddenComponent class reference from top level
                mockTargetEntity1.addComponent(new ForbiddenComponent());
                mockTargetEntity2.addComponent(new ForbiddenComponent());

                // FIX: Use the correct message function the service uses on fallback
                const expectedMsgFunc = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
                const expectedMsg = expectedMsgFunc(mockActionDefinition.name, mockActionDefinition.target_domain);

                // Act
                const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

                // Assert
                expect(result.status).toBe(ResolutionStatus.FILTER_EMPTY);
                // Check components
                expect(mockTargetEntity1.hasComponent(ForbiddenComponent)).toBe(true);
                expect(mockTargetEntity2.hasComponent(ForbiddenComponent)).toBe(true);
                expect(result.candidateIds).toEqual([mockTargetEntity1.id, mockTargetEntity2.id]); // Initial candidates
                expect(result.details).toEqual({reason: 'All candidates filtered out by component requirements.'});
                expect(findTarget).not.toHaveBeenCalled();
                expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    EVENT_DISPLAY_MESSAGE,
                    {text: expectedMsg, type: 'info'}
                );
            });

            test('should pass only entities meeting component criteria to findTarget', async () => {
                // Arrange: Entity 1 is valid, Entity 2 has forbidden component
                mockActionDefinition.target_forbidden_components = ['ForbiddenComponent'];
                // mockTargetEntity1 is valid by default
                // Use the CONSISTENT ForbiddenComponent class reference from top level
                mockTargetEntity2.addComponent(new ForbiddenComponent());

                // Mock findTarget to expect only entity 1
                findTarget.mockReturnValue({status: 'FOUND_UNIQUE', matches: [mockTargetEntity1]});


                // Act
                await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

                // Assert: Verify findTarget was called with only the valid entity
                // Check components first for sanity
                expect(mockTargetEntity1.hasComponent(ForbiddenComponent)).toBe(false);
                expect(mockTargetEntity2.hasComponent(ForbiddenComponent)).toBe(true);

                expect(findTarget).toHaveBeenCalledTimes(1);
                // This assertion should now pass due to the consistent class fix
                expect(findTarget).toHaveBeenCalledWith(
                    mockParsedCommand.directObjectPhrase, // 'target'
                    [mockTargetEntity1] // Only the entity that passed filtering
                );
                expect(mockEventBus.dispatch).not.toHaveBeenCalled(); // No message for unique success
            });

            test('should return FILTER_EMPTY if component registry lookup fails during filtering', async () => {
                // Arrange: Require a component that the mock registry doesn't know
                mockActionDefinition.target_required_components = ['UnknownComponent'];
                // Mock registry to return undefined for this specific component
                // This is already handled by the default mock setup in beforeEach

                // Use the CORRECT message function
                const expectedMsgFunc = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
                const expectedMsg = expectedMsgFunc(mockActionDefinition.name, mockActionDefinition.target_domain);

                // Act
                const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

                // Assert
                // It filters out entities because the registry returns undefined for UnknownComponent,
                // making the `every` check in the service return false.
                expect(result.status).toBe(ResolutionStatus.FILTER_EMPTY);
                expect(result.details).toEqual({reason: 'All candidates filtered out by component requirements.'});
                // Verify message dispatch
                expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    EVENT_DISPLAY_MESSAGE,
                    {text: expectedMsg, type: 'info'}
                );
                // findTarget should not be called
                expect(findTarget).not.toHaveBeenCalled();
                // Console error expected from the service itself about the missing component type
                // You might need `jest.spyOn(console, 'error');` to assert console calls
            });
        }); // End Component Filtering describe

        describe('findTarget Outcomes', () => {
            beforeEach(() => {
                // Ensure basic valid setup where filtering passes
                mockTargetEntity1 = createMockEntity('target-1', 'First Target');
                mockTargetEntity2 = createMockEntity('target-2', 'Second Target');
                const idSet = new Set([mockTargetEntity1.id, mockTargetEntity2.id]);
                getEntityIdsForScopes.mockReturnValue(idSet);
                mockEntityManager.getEntityInstance.mockImplementation((id) => {
                    mockEntityManager.entities.set(mockTargetEntity1.id, mockTargetEntity1);
                    mockEntityManager.entities.set(mockTargetEntity2.id, mockTargetEntity2);
                    return mockEntityManager.entities.get(id);
                });
            });

            test('should return NOT_FOUND and dispatch message if findTarget returns NOT_FOUND', async () => {
                // Arrange
                findTarget.mockReturnValue({status: 'NOT_FOUND', matches: []});
                const expectedMsgFunc = TARGET_MESSAGES.NOT_FOUND_NEARBY; // Adjust if domain changes
                const expectedMsg = expectedMsgFunc(mockParsedCommand.directObjectPhrase);

                // Act
                const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

                // Assert
                expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
                expect(result.targetType).toBeNull();
                expect(result.candidateIds).toEqual([mockTargetEntity1.id, mockTargetEntity2.id]); // Candidates before findTarget
                expect(result.details).toEqual({searchedName: mockParsedCommand.directObjectPhrase});
                expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    EVENT_DISPLAY_MESSAGE,
                    {text: expectedMsg, type: 'info'}
                );
            });

            test('should return AMBIGUOUS and dispatch message if findTarget returns FOUND_AMBIGUOUS', async () => {
                // Arrange
                const ambiguousMatches = [mockTargetEntity1, mockTargetEntity2];
                findTarget.mockReturnValue({status: 'FOUND_AMBIGUOUS', matches: ambiguousMatches});
                const expectedMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(
                    mockActionDefinition.name, // Action name/ID
                    mockParsedCommand.directObjectPhrase,
                    ambiguousMatches
                );

                // Act
                const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

                // Assert
                expect(result.status).toBe(ResolutionStatus.AMBIGUOUS);
                expect(result.targetType).toBe('entity'); // Still 'entity' type conceptually
                expect(result.targetId).toBeNull();
                expect(result.targetEntity).toBeNull();
                expect(result.candidateIds).toEqual(ambiguousMatches.map(e => e.id)); // IDs of ambiguous matches
                expect(result.details).toEqual({searchedName: mockParsedCommand.directObjectPhrase});
                expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                    EVENT_DISPLAY_MESSAGE,
                    {text: expectedMsg, type: 'warning'} // Type should be 'warning' for ambiguous
                );
            });

            test('should return FOUND_UNIQUE if findTarget returns FOUND_UNIQUE', async () => {
                // Arrange
                const uniqueMatch = mockTargetEntity1;
                findTarget.mockReturnValue({status: 'FOUND_UNIQUE', matches: [uniqueMatch]});

                // Act
                const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

                // Assert
                expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
                expect(result.targetType).toBe('entity');
                expect(result.targetId).toBe(uniqueMatch.id);
                expect(result.targetEntity).toBe(uniqueMatch);
                expect(result.candidateIds).toEqual([]); // No longer candidates
                expect(result.details).toBeNull();
                expect(result.error).toBeNull();
                expect(mockEventBus.dispatch).not.toHaveBeenCalled(); // No message for unique success
            });
        }); // End findTarget Outcomes describe

        test('should return ERROR and dispatch message for internal errors (e.g., findTarget throws)', async () => {
            // Arrange: Make findTarget throw an error
            // Need valid entities before findTarget is called
            mockTargetEntity1 = createMockEntity('target-1', 'First Target');
            mockTargetEntity2 = createMockEntity('target-2', 'Second Target');
            const idSet = new Set([mockTargetEntity1.id, mockTargetEntity2.id]);
            getEntityIdsForScopes.mockReturnValue(idSet);
            mockEntityManager.getEntityInstance.mockImplementation((id) => {
                mockEntityManager.entities.set(mockTargetEntity1.id, mockTargetEntity1);
                mockEntityManager.entities.set(mockTargetEntity2.id, mockTargetEntity2);
                return mockEntityManager.entities.get(id);
            });

            const testError = new Error("FindTarget Failed");
            findTarget.mockImplementation(() => {
                throw testError;
            });

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(result.status).toBe(ResolutionStatus.ERROR);
            expect(result.error).toContain('Error during resolution: FindTarget Failed');
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                EVENT_DISPLAY_MESSAGE,
                {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'}
            );
        });

    }); // End entity-based domains describe

    // ========================================================================
    // == Test Message Dispatch ===============================================
    // ========================================================================
    describe('Message Dispatch Verification', () => {
        // Tests above already verify dispatch for specific outcomes (NOT_FOUND, AMBIGUOUS, FILTER_EMPTY, ERROR).
        // Add specific tests here if you need to verify the *content* of messages more granularly
        // or test edge cases around message generation (e.g., using action ID if name is missing).
        let mockTargetEntity1;

        test('should dispatch correct message for SCOPE_EMPTY (inventory scope)', async () => {
            // Arrange
            mockActionDefinition.target_domain = 'inventory';
            mockActionDefinition.name = 'Equip'; // Action name for message
            getEntityIdsForScopes.mockReturnValue(new Set()); // Simulate empty inventory

            // ---> ADD THIS LINE <---
            mockParsedCommand.directObjectPhrase = 'some item'; // Provide a non-empty target name

            const expectedMsgFunc = TARGET_MESSAGES.SCOPE_EMPTY_INVENTORY || TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
            const expectedMsg = expectedMsgFunc(mockActionDefinition.name, mockActionDefinition.target_domain);

            // Act
            await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1); // Should now pass
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                EVENT_DISPLAY_MESSAGE,
                {text: expectedMsg, type: 'info'}
            );
        });

        test('should dispatch correct message for NOT_FOUND (environment scope)', async () => {
            // Arrange
            mockActionDefinition.target_domain = 'environment';
            mockParsedCommand.directObjectPhrase = 'widget';
            // Need valid entity setup before findTarget

            // ---> FIX: Initialize the mock entity required by getEntityInstance <---
            mockTargetEntity1 = createMockEntity('target-1', 'Target'); // Initialize it HERE

            const idSet = new Set(['target-1']); // Non-empty scope initially
            getEntityIdsForScopes.mockReturnValue(idSet);
            // Now, when this mock is created, mockTargetEntity1 is defined:
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetEntity1);

            findTarget.mockReturnValue({status: 'NOT_FOUND', matches: []}); // findTarget fails
            const expectedMsgFunc = TARGET_MESSAGES.NOT_FOUND_ENVIRONMENT || TARGET_MESSAGES.NOT_FOUND_NEARBY; // Use specific or a valid fallback
            const expectedMsg = expectedMsgFunc(mockParsedCommand.directObjectPhrase);

            // Act
            await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                EVENT_DISPLAY_MESSAGE,
                {text: expectedMsg, type: 'info'}
            );
        });

        test('should use actionDefinition.id in messages if name is missing', async () => {
            // Arrange
            mockActionDefinition.target_domain = 'inventory';
            mockActionDefinition.name = undefined; // No name defined
            mockActionDefinition.id = 'core:test_equip_no_name'; // Use ID instead
            getEntityIdsForScopes.mockReturnValue(new Set()); // Empty inventory

            // ---> ADD THIS LINE <---
            mockParsedCommand.directObjectPhrase = 'some item id'; // Provide a non-empty target name

            const expectedMsgFunc = TARGET_MESSAGES.SCOPE_EMPTY_INVENTORY || TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
            const expectedMsg = expectedMsgFunc(mockActionDefinition.id, mockActionDefinition.target_domain); // Expect ID to be used

            // Act
            await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(mockEventBus.dispatch).toHaveBeenCalledWith( // Should now pass
                EVENT_DISPLAY_MESSAGE,
                {text: expectedMsg, type: 'info'}
            );
        });
    }); // End Message Dispatch describe


    // ========================================================================
    // == Fallback / Unknown Domain Test ======================================
    // ========================================================================
    describe('Unknown Domain', () => {
        test('should return ERROR for unhandled target_domain', async () => {
            // Arrange
            mockActionDefinition.target_domain = 'unknown_domain'; // Set to an unhandled value

            // Act
            const result = await targetResolutionService.resolveActionTarget(mockActionDefinition, mockContext);

            // Assert
            expect(result.status).toBe(ResolutionStatus.ERROR);
            expect(result.targetType).toBeNull();
            expect(result.error).toBe('Unhandled target domain: unknown_domain');
            expect(result.details).toEqual({unhandledDomain: 'unknown_domain'});
            expect(mockEventBus.dispatch).not.toHaveBeenCalled(); // No specific dispatch for this error type yet
        });
    });

}); // End describe('TargetResolutionService')