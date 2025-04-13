// src/tests/actions/handlers/useActionHandler.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';

import {executeUse} from '../../../actions/handlers/useActionHandler.js';
import {InventoryComponent} from '../../../components/inventoryComponent.js';
import {ItemComponent} from '../../../components/itemComponent.js';
import {PositionComponent} from '../../../components/positionComponent.js';
import {NameComponent} from '../../../components/nameComponent.js';
// ConnectionsComponent might not be directly used if resolveTargetConnection is fully mocked,
// but including it for completeness if the mock depends on its types internally.
import {ConnectionsComponent} from '../../../components/connectionsComponent.js';
/** @typedef {import('../../../components/connectionsComponent.js').Connection} Connection */


// --- Mock dependencies ---
import {validateRequiredCommandPart} from '../../../utils/actionValidationUtils.js';
import {resolveTargetEntity, resolveTargetConnection} from '../../../services/targetResolutionService.js';
import {getDisplayName, TARGET_MESSAGES} from '../../../utils/messages.js';

// Mock the modules containing the functions we need to control
jest.mock('../../../utils/actionValidationUtils.js', () => ({
    validateRequiredCommandPart: jest.fn(),
}));

jest.mock('../../../services/targetResolutionService.js', () => ({
    resolveTargetEntity: jest.fn(),
    resolveTargetConnection: jest.fn(),
}));

// Mock messages lightly
jest.mock('../../../utils/messages.js', () => ({
    getDisplayName: jest.fn((entity) => entity?.mockName || entity?.id || 'mock display name'),
    TARGET_MESSAGES: { // Provide keys used internally by the handler or resolvers
        INTERNAL_ERROR_COMPONENT: jest.fn((name) => `Mock Internal Error: Missing ${name}`),
        NOTHING_CARRIED: 'Mock Nothing Carried',
        INTERNAL_ERROR: 'Mock Internal Error',
        // Provide mock implementations for keys potentially used by failed resolvers
        TARGET_NOT_FOUND_CONTEXT: jest.fn((verb, name) => `Mock Target '${name}' not found for ${verb}`),
        NOT_FOUND_INVENTORY: jest.fn((name) => `Mock You don't have '${name}'`),
        SCOPE_EMPTY_GENERIC: jest.fn((verb, scope) => `Mock Scope Empty: ${verb} ${scope}`),
        TARGET_AMBIGUOUS_CONTEXT: jest.fn((verb, name, matches) => `Mock Ambiguous ${name} for ${verb}`),
        // Add others if specific failure paths of resolvers need mocking in other tests
    },
}));


// --- Test Suite ---

describe('useActionHandler', () => {
    describe('executeUse', () => {
        let mockContext;
        let mockPlayerEntity;
        let mockItemEntity; // Defined here for use across tests
        let mockEventBus;
        let mockDispatch;
        let mockDataManager;
        const playerId = 'player-1';
        const itemId = 'item-instance-key-123';
        const itemDefId = 'item-def-master-key';
        const itemPhrase = 'master key'; // Matches parsed command DO

        const locationId = 'location-lab-1';

        beforeEach(() => {
            jest.clearAllMocks();

            // --- Basic Mocks Setup ---
            mockPlayerEntity = {
                id: playerId,
                mockName: 'Player',
                getComponent: jest.fn(),
            };

            mockItemEntity = { // Now defined in beforeEach for consistency
                id: itemId,
                mockName: itemPhrase,
                getComponent: jest.fn(),
            };

            mockEventBus = {
                dispatch: jest.fn(),
            };

            mockDispatch = jest.fn();

            mockDataManager = {
                getEntityDefinition: jest.fn(),
            };

            // Mock player components
            const mockInventory = {
                items: [itemId], // Assume item exists initially unless test overrides
                getItems: jest.fn(() => [itemId]), // Default: has items
            };
            mockPlayerEntity.getComponent.mockImplementation((componentClass) => {
                if (componentClass === InventoryComponent) return mockInventory;
                if (componentClass === PositionComponent) return {locationId: locationId, x: 1, y: 1};
                if (componentClass === NameComponent) return {value: 'Player'};
                return undefined;
            });

            // Mock item components (used when item *is* resolved)
            mockItemEntity.getComponent.mockImplementation((componentClass) => {
                if (componentClass === ItemComponent) return {definitionId: itemDefId};
                if (componentClass === NameComponent) return {value: itemPhrase};
                return undefined;
            });

            // Mock DataManager (used when item *is* resolved)
            mockDataManager.getEntityDefinition.mockImplementation((defId) => {
                if (defId === itemDefId) return {id: itemDefId, name: 'Master Key Definition'};
                return undefined;
            });

            // Base mock context structure
            mockContext = {
                playerEntity: mockPlayerEntity,
                entityManager: {
                    getEntityInstance: jest.fn((id) => {
                        if (id === playerId) return mockPlayerEntity;
                        // Return item only if needed by successful item resolution path in a test
                        if (id === itemId) return mockItemEntity;
                        return undefined;
                    }),
                    getEntitiesInLocation: jest.fn().mockReturnValue([playerId]), // Only player by default
                },
                dataManager: mockDataManager,
                dispatch: mockDispatch,
                eventBus: mockEventBus,
                currentLocation: {
                    id: locationId,
                    getComponent: jest.fn(), // Mock needed if resolveTargetConnection interacts directly
                },
                parsedCommand: null, // Set per test
            };

            // --- Default Mock Implementations ---
            validateRequiredCommandPart.mockReturnValue(true); // Default to pass validation
            // *** IMPORTANT: Default resolvers now return null to catch missing setup ***
            resolveTargetEntity.mockReturnValue(null);
            resolveTargetConnection.mockReturnValue(null);
            // Use mock implementation that uses mockName if available
            getDisplayName.mockImplementation((entity) => entity?.mockName || entity?.id || 'mock display name');
        });

        // =============================================================
        // == Test Cases for Sub-Ticket 7.5.6 (Specific Failures) =====
        // =============================================================

        it('should return success: false and dispatch NOTHING_CARRIED if inventory is empty', () => {
            // --- AC1: Setup ---
            // Ensure command itself is valid enough to pass initial checks
            mockContext.parsedCommand = {
                actionId: 'core:use',
                originalInput: `use ${itemPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,
                preposition: null,
                indirectObjectPhrase: null,
            };
            // Mock inventory component specific setup
            const mockEmptyInventory = {
                getItems: jest.fn(() => []), // Return empty array
            };
            // Override the default playerEntity.getComponent mock for this test
            mockPlayerEntity.getComponent.mockImplementation((componentClass) => {
                if (componentClass === InventoryComponent) return mockEmptyInventory; // The crucial part
                if (componentClass === PositionComponent) return {locationId: locationId, x: 1, y: 1};
                if (componentClass === NameComponent) return {value: 'Player'};
                return undefined;
            });
            // Ensure initial validation passes
            validateRequiredCommandPart.mockReturnValue(true);

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC1: Verification ---
            // Assert validation was checked (it happens before inventory check)
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            // Assert inventory check was done
            expect(mockEmptyInventory.getItems).toHaveBeenCalled();
            // Assert correct message dispatched
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.NOTHING_CARRIED,
                type: 'info'
            });
            // Assert resolvers and event bus were NOT called
            expect(resolveTargetEntity).not.toHaveBeenCalled();
            expect(resolveTargetConnection).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            // Assert handler returned failure
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'internal'})
            ]));
        });

        it('should return success: false early if direct object is missing (validation fails)', () => {
            // --- AC2: Setup ---
            mockContext.parsedCommand = {
                actionId: 'core:use',
                originalInput: `use`, // Missing DO
                verbToken: 'use',
                directObjectPhrase: null, // Explicitly null
                preposition: null,
                indirectObjectPhrase: null,
            };
            // Mock validation to fail for the direct object
            validateRequiredCommandPart.mockImplementation((context, actionVerb, part) => {
                if (actionVerb === 'use' && part === 'directObjectPhrase') {
                    return false; // Simulate failure
                }
                return true; // Pass other potential checks (none expected here)
            });

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC2: Verification ---
            // Assert validation was called correctly
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            // Assert handler returned failure immediately
            expect(result.success).toBe(false);
            // Assert inventory check, resolvers, and event bus were NOT called
            expect(mockPlayerEntity.getComponent).not.toHaveBeenCalledWith(InventoryComponent); // Didn't get to inventory check
            expect(resolveTargetEntity).not.toHaveBeenCalled();
            expect(resolveTargetConnection).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            // Optional: Check that the handler itself didn't dispatch redundant messages
            expect(mockDispatch).not.toHaveBeenCalled(); // Validator handles dispatch
        });

        it('should return success: false and dispatch INTERNAL_ERROR if eventBus dispatch throws', () => {
            // --- AC3: Setup ---
            // Need a valid command and successful item resolution
            mockContext.parsedCommand = {
                actionId: 'core:use',
                originalInput: `use ${itemPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,
                preposition: null,
                indirectObjectPhrase: null,
            };
            // Mock validation passes
            validateRequiredCommandPart.mockReturnValue(true);
            // Mock item resolution succeeds
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    return mockItemEntity;
                }
                return null;
            });
            // Mock eventBus dispatch to throw an error
            const dispatchError = new Error('Simulated dispatch failure');
            mockEventBus.dispatch.mockImplementation(() => {
                throw dispatchError;
            });

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC3: Verification ---
            // Assert validation was checked
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            // Assert item resolution was attempted and succeeded (implicitly)
            expect(resolveTargetEntity).toHaveBeenCalledWith(mockContext, expect.objectContaining({
                scope: 'inventory',
                targetName: itemPhrase
            }));
            // Assert event dispatch WAS called (even though it threw)
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                'event:item_use_attempted',
                expect.objectContaining({ // Check key parts of payload
                    userEntityId: playerId,
                    itemInstanceId: itemId,
                    itemDefinitionId: itemDefId,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: null,
                })
            );
            // Assert the catch block dispatched the internal error message
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.INTERNAL_ERROR,
                type: 'error'
            });
            // Assert handler returned failure
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    text: expect.stringContaining('Intent Failed: Error dispatching event.'),
                    type: 'error'
                })
            ]));
        });

        // ==================================================================
        // == Existing Tests (Failures from Ticket 7.5.5 + Success Cases) ===
        // ==================================================================

        it('should return success: false and not dispatch event if item cannot be resolved', () => {
            // --- AC1: Setup ---
            const nonExistentItemPhrase = 'glowing orb';
            mockContext.parsedCommand = {
                actionId: 'core:use',
                originalInput: `use ${nonExistentItemPhrase}`,
                verbToken: 'use',
                directObjectPhrase: nonExistentItemPhrase, // Item player doesn't have
                preposition: null,
                indirectObjectPhrase: null,
            };
            validateRequiredCommandPart.mockReturnValue(true); // Validation passes
            // resolveTargetEntity already defaults to null in beforeEach

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC1: Verification ---
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            expect(resolveTargetEntity).toHaveBeenCalledTimes(1);
            expect(resolveTargetEntity).toHaveBeenCalledWith(mockContext, expect.objectContaining({
                scope: 'inventory',
                targetName: nonExistentItemPhrase,
                notFoundMessageKey: 'NOT_FOUND_INVENTORY',
            }));
            expect(resolveTargetConnection).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.any(Array));
            // Resolver should dispatch the user message (e.g., NOT_FOUND_INVENTORY)
            // Verify handler didn't dispatch its *own* INTERNAL_ERROR
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
                text: TARGET_MESSAGES.INTERNAL_ERROR
            }));
        });

        it('should return success: false and not dispatch event if item is found but target cannot be resolved', () => {
            // --- AC2: Setup ---
            const targetPhrase = 'locked console'; // Target that won't be found
            const mockPreposition = 'on';
            mockContext.parsedCommand = {
                actionId: 'core:use',
                originalInput: `use ${itemPhrase} ${mockPreposition} ${targetPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,         // Item exists
                preposition: mockPreposition,
                indirectObjectPhrase: targetPhrase,      // Target doesn't exist
            };
            validateRequiredCommandPart.mockReturnValue(true); // Validation passes

            // Mock resolveTargetEntity: Succeeds for item, fails for target (default)
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    return mockItemEntity; // Find item
                }
                return null; // Fail target lookup (or any other)
            });
            // resolveTargetConnection defaults to null (fails target lookup)

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC2: Verification ---
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            const expectedContextString = `use ${itemPhrase} ${mockPreposition}`;

            expect(resolveTargetEntity).toHaveBeenNthCalledWith(1, mockContext, expect.objectContaining({
                scope: 'inventory', targetName: itemPhrase,
            })); // Item lookup
            expect(resolveTargetConnection).toHaveBeenNthCalledWith(1, mockContext,
                targetPhrase, expectedContextString
            ); // Connection target lookup (fails)
            expect(resolveTargetEntity).toHaveBeenNthCalledWith(2, mockContext, expect.objectContaining({
                scope: 'location', targetName: targetPhrase, actionVerb: expectedContextString
            })); // Entity target lookup (fails)

            expect(resolveTargetEntity).toHaveBeenCalledTimes(2);
            expect(resolveTargetConnection).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.any(Array));
            // Resolver should dispatch the user message (e.g., TARGET_NOT_FOUND_CONTEXT)
            // Verify handler didn't dispatch its *own* INTERNAL_ERROR
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
                text: TARGET_MESSAGES.INTERNAL_ERROR
            }));
        });


        // --- Existing SUCCESS Test Cases (Keep them) ---

        it('should handle successful item use on a connection target (DO+P+IO)', () => {
            // --- AC1: Context Simulation ---
            const targetConnectionPhrase = 'north passage';
            const targetConnectionId = 'conn-north-passage-01';
            const targetConnectionName = 'North Passage';
            const targetConnectionDirection = 'north';
            const targetConnectionDestination = 'location-hallway-5';
            const mockPreposition = 'on';

            mockContext.parsedCommand = {
                actionId: 'core:use',
                originalInput: `use ${itemPhrase} ${mockPreposition} ${targetConnectionPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,
                preposition: mockPreposition,
                indirectObjectPhrase: targetConnectionPhrase, // The connection target phrase
            };

            // --- AC2: Mock Setup - Validation & Item Resolution ---
            validateRequiredCommandPart.mockReturnValue(true);

            // Configure resolveTargetEntity to find the ITEM
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    return mockItemEntity;
                }
                return null; // Only find the item for this path
            });

            // --- AC3: Mock Setup - Connection Resolution ---
            /** @type {Connection} */
            const mockConnectionObject = {
                connectionId: targetConnectionId,
                name: targetConnectionName,
                direction: targetConnectionDirection,
                target: targetConnectionDestination,
                state: 'locked',
            };

            // Configure resolveTargetConnection to find the CONNECTION
            resolveTargetConnection.mockImplementation((context, connectionTargetName, actionVerb) => {
                if (connectionTargetName === targetConnectionPhrase) {
                    return mockConnectionObject;
                }
                return null;
            });

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC4: Assertion: Resolver Call Sequence & Arguments ---
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            expect(resolveTargetEntity).toHaveBeenNthCalledWith(1,
                mockContext,
                expect.objectContaining({scope: 'inventory', targetName: itemPhrase})
            );
            const expectedContextString = `use ${itemPhrase} ${mockPreposition}`;
            expect(resolveTargetConnection).toHaveBeenNthCalledWith(1,
                mockContext,
                targetConnectionPhrase,
                expectedContextString
            );

            // --- AC5: Assertion: No Entity Target Resolution Attempt ---
            expect(resolveTargetEntity).toHaveBeenCalledTimes(1); // Only for item
            expect(resolveTargetConnection).toHaveBeenCalledTimes(1);

            // --- AC6: Assertion: Event Dispatch ---
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                'event:item_use_attempted',
                {
                    userEntityId: playerId,
                    itemInstanceId: itemId,
                    itemDefinitionId: itemDefId,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: targetConnectionId,
                }
            );

            // --- AC7: Assertion: Return Value & No Errors ---
            expect(result.success).toBe(true);
            expect(result.messages).toEqual(expect.any(Array));
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'error'}));
        });

        it('should handle successful item use with no explicit target', () => {
            // --- Test-Specific Mock Config ---
            mockContext.parsedCommand = {
                actionId: 'core:use',
                originalInput: `use ${itemPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,
                preposition: null,
                indirectObjectPhrase: null,
            };
            validateRequiredCommandPart.mockReturnValue(true);
            // Configure resolveTargetEntity specifically for the item ONLY
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    return mockItemEntity;
                }
                return null;
            });
            // resolveTargetConnection default mock returns null, correct here

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- Assertions ---
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            expect(resolveTargetEntity).toHaveBeenCalledTimes(1);
            expect(resolveTargetEntity).toHaveBeenCalledWith(mockContext, expect.objectContaining({
                scope: 'inventory',
                targetName: itemPhrase
            }));
            expect(resolveTargetConnection).not.toHaveBeenCalled(); // Correctly NOT called
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:item_use_attempted', {
                userEntityId: playerId,
                itemInstanceId: itemId,
                itemDefinitionId: itemDefId,
                explicitTargetEntityId: null,
                explicitTargetConnectionId: null,
            });
            expect(result.success).toBe(true);
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'error'}));
        });

        it('should handle successful item use on an entity target', () => {
            // --- Setup ---
            const targetEntityId = 'entity-target-door-789';
            const targetPhrase = 'rusty door';
            const mockTargetEntity = {
                id: targetEntityId,
                mockName: targetPhrase,
                getComponent: jest.fn(),
            };
            mockTargetEntity.getComponent.mockImplementation((componentClass) => {
                if (componentClass === NameComponent) return {value: targetPhrase};
                if (componentClass === PositionComponent) return {locationId: locationId, x: 5, y: 5};
                return undefined;
            });
            mockContext.entityManager.getEntityInstance.mockImplementation((id) => {
                if (id === playerId) return mockPlayerEntity;
                if (id === itemId) return mockItemEntity;
                if (id === targetEntityId) return mockTargetEntity;
                return undefined;
            });
            mockContext.entityManager.getEntitiesInLocation.mockImplementation((locId) => {
                if (locId === locationId) return [playerId, targetEntityId]; // Target is in location
                return [];
            });

            mockContext.parsedCommand = {
                actionId: 'core:use',
                originalInput: `use ${itemPhrase} on ${targetPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,
                preposition: 'on',
                indirectObjectPhrase: targetPhrase,
            };
            validateRequiredCommandPart.mockReturnValue(true);

            // Configure resolvers for ITEM(ok) -> CONNECTION(fail) -> ENTITY(ok)
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    return mockItemEntity; // 1. Find Item
                }
                if (config.scope === 'location' && config.targetName === targetPhrase) {
                    return mockTargetEntity; // 3. Find Target Entity
                }
                return null;
            });
            resolveTargetConnection.mockReturnValue(null); // 2. Connection check fails

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- Assertions ---
            const expectedContextString = `use ${itemPhrase} on`;
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            expect(resolveTargetEntity).toHaveBeenNthCalledWith(1, mockContext, expect.objectContaining({
                scope: 'inventory', targetName: itemPhrase,
            }));
            expect(resolveTargetConnection).toHaveBeenNthCalledWith(1, mockContext,
                targetPhrase, expectedContextString
            );
            expect(resolveTargetEntity).toHaveBeenNthCalledWith(2, mockContext, expect.objectContaining({
                scope: 'location', targetName: targetPhrase,
            }));
            expect(resolveTargetEntity).toHaveBeenCalledTimes(2);
            expect(resolveTargetConnection).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                'event:item_use_attempted',
                {
                    userEntityId: playerId,
                    itemInstanceId: itemId,
                    itemDefinitionId: itemDefId,
                    explicitTargetEntityId: targetEntityId, // Correct: Entity ID
                    explicitTargetConnectionId: null        // Correct: Connection ID null
                }
            );
            expect(result.success).toBe(true);
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'error'}));
        });

    }); // end describe executeUse
}); // end describe useActionHandler