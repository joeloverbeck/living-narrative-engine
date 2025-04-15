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
import {resolveTargetEntity} from '../../../services/entityFinderService.js';
import {resolveTargetConnection} from "../../../services/connectionResolver.js";
import {getDisplayName, TARGET_MESSAGES} from '../../../utils/messages.js';

// Mock the modules containing the functions we need to control
jest.mock('../../../utils/actionValidationUtils.js', () => ({
    validateRequiredCommandPart: jest.fn(),
}));

// Mock the entityFinderService to return resolution objects
jest.mock('../../../services/entityFinderService.js', () => ({
    resolveTargetEntity: jest.fn(), // Will be configured in beforeEach and specific tests
}));

// Add a new mock for the new service:
jest.mock('../../../services/connectionResolver.js', () => ({
    resolveTargetConnection: jest.fn(), // Will be configured in beforeEach and specific tests
}));

// Mock messages lightly
jest.mock('../../../utils/messages.js', () => ({
    getDisplayName: jest.fn((entity) => entity?.mockName || entity?.id || 'mock display name'),
    TARGET_MESSAGES: { // Provide keys used internally by the handler or resolvers
        INTERNAL_ERROR_COMPONENT: jest.fn((name) => `Mock Internal Error: Missing ${name}`),
        NOTHING_CARRIED: 'Mock Nothing Carried',
        INTERNAL_ERROR: 'Mock Internal Error',
        // Mock messages for different resolution statuses
        TARGET_NOT_FOUND_CONTEXT: jest.fn((name) => `Mock Target '${name}' not found`), // Simplified mock
        NOT_FOUND_INVENTORY: jest.fn((name) => `Mock You don't have '${name}'`),
        SCOPE_EMPTY_GENERIC: jest.fn((verb, scope) => `Mock Scope Empty: ${verb} ${scope}`),
        TARGET_AMBIGUOUS_CONTEXT: jest.fn((verb, name, matches) => `Mock Ambiguous ${name} for ${verb}`),
        AMBIGUOUS_PROMPT: jest.fn((verb, name, matches) => `Mock Ambiguous Item ${name} for ${verb}`), // Added for item ambiguity
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
            // *** IMPORTANT: Default resolvers now return a NOT_FOUND object ***
            resolveTargetEntity.mockReturnValue({status: 'NOT_FOUND', candidates: []});
            resolveTargetConnection.mockReturnValue(null); // Connection resolver might still return null for simplicity if not found
            // Use mock implementation that uses mockName if available
            getDisplayName.mockImplementation((entity) => entity?.mockName || entity?.id || 'mock display name');
        });

        // =============================================================
        // == Test Cases for Sub-Ticket 7.5.6 (Specific Failures) =====
        // =============================================================

        it('should return success: false and dispatch NOTHING_CARRIED if inventory is empty', () => {
            // --- AC1: Setup ---
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
                // Note: We still need getComponent to return this...
                getItems: jest.fn(() => []),
            };
            mockPlayerEntity.getComponent.mockImplementation((componentClass) => {
                if (componentClass === InventoryComponent) return mockEmptyInventory; // Return the empty one
                if (componentClass === PositionComponent) return {locationId: locationId, x: 1, y: 1};
                if (componentClass === NameComponent) return {value: 'Player'};
                return undefined;
            });

            // *** FIX START ***
            // Mock resolveTargetEntity to return FILTER_EMPTY for inventory scope
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory') {
                    // Simulate the resolver finding nothing because the inventory is empty
                    return {status: 'FILTER_EMPTY', candidates: []};
                }
                // Default fallback (shouldn't be hit in this test)
                return {status: 'NOT_FOUND', candidates: []};
            });
            // *** FIX END ***

            // Ensure initial validation passes
            validateRequiredCommandPart.mockReturnValue(true);

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC1: Verification ---
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            // Assert item resolution was attempted
            expect(resolveTargetEntity).toHaveBeenCalledWith(mockContext, expect.objectContaining({
                scope: 'inventory',
                targetName: itemPhrase
            }));
            // Assert correct message dispatched (from the FILTER_EMPTY case)
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.NOTHING_CARRIED, // Handler uses this for FILTER_EMPTY on inventory
                type: 'info'
            });
            // Assert connection resolver and event bus were NOT called
            expect(resolveTargetConnection).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            // Assert handler returned failure
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    text: expect.stringContaining('reason: FILTER_EMPTY (Inventory empty)'), // Check internal message
                    type: 'internal'
                })
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
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            expect(result.success).toBe(false);
            expect(mockPlayerEntity.getComponent).not.toHaveBeenCalledWith(InventoryComponent);
            expect(resolveTargetEntity).not.toHaveBeenCalled(); // Correctly not called
            expect(resolveTargetConnection).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        it('should return success: false and dispatch INTERNAL_ERROR if eventBus dispatch throws', () => {
            // --- AC3: Setup ---
            mockContext.parsedCommand = {
                actionId: 'core:use',
                originalInput: `use ${itemPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,
                preposition: null,
                indirectObjectPhrase: null,
            };
            validateRequiredCommandPart.mockReturnValue(true);

            // *** FIX START ***
            // Mock item resolution to succeed correctly with the resolution object
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    // Return the resolution object, not just the entity
                    return {status: 'FOUND_UNIQUE', entity: mockItemEntity};
                }
                // Fallback if called unexpectedly (e.g., for target)
                return {status: 'NOT_FOUND', candidates: []};
            });
            // *** FIX END ***

            // Mock eventBus dispatch to throw an error
            const dispatchError = new Error('Simulated dispatch failure');
            mockEventBus.dispatch.mockImplementation(() => {
                throw dispatchError;
            });

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC3: Verification ---
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            // Assert item resolution was attempted and succeeded (returned FOUND_UNIQUE)
            expect(resolveTargetEntity).toHaveBeenCalledWith(mockContext, expect.objectContaining({
                scope: 'inventory',
                targetName: itemPhrase
            }));
            // Assert event dispatch WAS called (now that item resolution succeeded)
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1); // Should be 1 now
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

            // *** FIX START ***
            // Mock item resolution to explicitly fail with NOT_FOUND object
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === nonExistentItemPhrase) {
                    return {status: 'NOT_FOUND', candidates: []};
                }
                // Fallback for other potential calls
                return {status: 'NOT_FOUND', candidates: []};
            });
            // *** FIX END ***

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC1: Verification ---
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            expect(resolveTargetEntity).toHaveBeenCalledTimes(1);
            expect(resolveTargetEntity).toHaveBeenCalledWith(mockContext, expect.objectContaining({
                scope: 'inventory',
                targetName: nonExistentItemPhrase,
                // removed requiredComponents check here as it's now internal to resolver
            }));
            expect(resolveTargetConnection).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.any(Array));
            // Handler should dispatch the user message for NOT_FOUND
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.NOT_FOUND_INVENTORY(nonExistentItemPhrase),
                type: 'info'
            });
            // Verify handler didn't dispatch its *own* INTERNAL_ERROR
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
                text: TARGET_MESSAGES.INTERNAL_ERROR
            }));
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    text: expect.stringContaining(`Item resolution failed for '${nonExistentItemPhrase}', reason: NOT_FOUND.`), // Check internal message
                    type: 'internal'
                })
            ]));
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

            // Mock resolveTargetEntity: Succeeds for item, fails for target (returns NOT_FOUND object)
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    return {status: 'FOUND_UNIQUE', entity: mockItemEntity}; // Find item
                }
                if (config.scope === 'location' && config.targetName === targetPhrase) {
                    return {status: 'NOT_FOUND', candidates: []}; // Fail target entity lookup
                }
                return {status: 'NOT_FOUND', candidates: []}; // Default fail
            });
            // resolveTargetConnection defaults to null (fails target lookup)
            resolveTargetConnection.mockReturnValue(null); // Explicitly fail connection lookup


            // --- Execute ---
            const result = executeUse(mockContext);

            // --- AC2: Verification ---
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            const expectedContextString = `use ${itemPhrase} ${mockPreposition}`;

            // 1. Item lookup (Succeeds)
            expect(resolveTargetEntity).toHaveBeenNthCalledWith(1, mockContext, expect.objectContaining({
                scope: 'inventory', targetName: itemPhrase,
            }));
            // 2. Connection target lookup (Fails)
            expect(resolveTargetConnection).toHaveBeenNthCalledWith(1, mockContext,
                targetPhrase, expectedContextString
            );
            // 3. Entity target lookup (Fails)
            expect(resolveTargetEntity).toHaveBeenNthCalledWith(2, mockContext, expect.objectContaining({
                scope: 'location', targetName: targetPhrase, // actionVerb is now internal detail
            }));

            expect(resolveTargetEntity).toHaveBeenCalledTimes(2);
            expect(resolveTargetConnection).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.any(Array));

            // Handler should dispatch the user message for TARGET_NOT_FOUND_CONTEXT (from nested switch)
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetPhrase), // Mock updated
                type: 'info'
            });
            // Verify handler didn't dispatch its *own* INTERNAL_ERROR
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
                text: TARGET_MESSAGES.INTERNAL_ERROR
            }));
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    text: expect.stringContaining(`Target resolution failed for '${targetPhrase}', reason: NOT_FOUND.`), // Check internal message
                    type: 'internal'
                })
            ]));
        });


        // --- Existing SUCCESS Test Cases (Keep them, adjust mocks if needed) ---

        // NOTE: Success cases also need `resolveTargetEntity` updated to return the object format.

        it('should handle successful item use on a connection target (DO+P+IO)', () => {
            // --- Context Simulation ---
            const targetConnectionPhrase = 'north passage';
            const targetConnectionId = 'conn-north-passage-01';
            const targetConnectionName = 'North Passage';
            // ... other connection details
            const mockPreposition = 'on';

            mockContext.parsedCommand = { /* ... as before ... */
                actionId: 'core:use',
                originalInput: `use ${itemPhrase} ${mockPreposition} ${targetConnectionPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,
                preposition: mockPreposition,
                indirectObjectPhrase: targetConnectionPhrase,
            };

            // --- Mock Setup - Validation & Item Resolution ---
            validateRequiredCommandPart.mockReturnValue(true);

            // Configure resolveTargetEntity to find the ITEM (returning object)
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    return {status: 'FOUND_UNIQUE', entity: mockItemEntity}; // FIX: Return object
                }
                return {status: 'NOT_FOUND', candidates: []}; // Only find the item
            });

            // --- Mock Setup - Connection Resolution ---
            const mockConnectionObject = { /* ... as before ... */
                connectionId: targetConnectionId,
                name: targetConnectionName,
                // ... other props
            };
            resolveTargetConnection.mockImplementation((context, connectionTargetName, actionVerb) => {
                if (connectionTargetName === targetConnectionPhrase) {
                    return mockConnectionObject;
                }
                return null;
            });

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- Assertions (remain largely the same) ---
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
            expect(resolveTargetEntity).toHaveBeenCalledTimes(1); // Only for item
            expect(resolveTargetConnection).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                'event:item_use_attempted',
                expect.objectContaining({ // Payload remains the same
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: targetConnectionId,
                })
            );
            expect(result.success).toBe(true);
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'error'}));
        });

        it('should handle successful item use with no explicit target', () => {
            // --- Test-Specific Mock Config ---
            mockContext.parsedCommand = { /* ... as before ... */
                actionId: 'core:use',
                originalInput: `use ${itemPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,
                preposition: null,
                indirectObjectPhrase: null,
            };
            validateRequiredCommandPart.mockReturnValue(true);
            // Configure resolveTargetEntity for the item ONLY (returning object)
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    return {status: 'FOUND_UNIQUE', entity: mockItemEntity}; // FIX: Return object
                }
                return {status: 'NOT_FOUND', candidates: []};
            });
            resolveTargetConnection.mockReturnValue(null); // Correct here

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- Assertions (remain the same) ---
            expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, 'use', 'directObjectPhrase');
            expect(resolveTargetEntity).toHaveBeenCalledTimes(1);
            expect(resolveTargetEntity).toHaveBeenCalledWith(mockContext, expect.objectContaining({
                scope: 'inventory', targetName: itemPhrase
            }));
            expect(resolveTargetConnection).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:item_use_attempted', expect.objectContaining({
                explicitTargetEntityId: null, // Correct
                explicitTargetConnectionId: null, // Correct
            }));
            expect(result.success).toBe(true);
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'error'}));
        });

        it('should handle successful item use on an entity target', () => {
            // --- Setup ---
            const targetEntityId = 'entity-target-door-789';
            const targetPhrase = 'rusty door';
            const mockTargetEntity = { /* ... as before ... */
                id: targetEntityId,
                mockName: targetPhrase,
                getComponent: jest.fn(),
            };
            // ... mockTargetEntity.getComponent setup ...
            // ... mockContext.entityManager setups ...
            mockContext.parsedCommand = { /* ... as before ... */
                actionId: 'core:use',
                originalInput: `use ${itemPhrase} on ${targetPhrase}`,
                verbToken: 'use',
                directObjectPhrase: itemPhrase,
                preposition: 'on',
                indirectObjectPhrase: targetPhrase,
            };
            validateRequiredCommandPart.mockReturnValue(true);

            // Configure resolvers for ITEM(ok) -> CONNECTION(fail) -> ENTITY(ok) (returning objects)
            resolveTargetEntity.mockImplementation((context, config) => {
                if (config.scope === 'inventory' && config.targetName === itemPhrase) {
                    return {status: 'FOUND_UNIQUE', entity: mockItemEntity}; // 1. Find Item (FIX: object)
                }
                if (config.scope === 'location' && config.targetName === targetPhrase) {
                    return {status: 'FOUND_UNIQUE', entity: mockTargetEntity}; // 3. Find Target Entity (FIX: object)
                }
                return {status: 'NOT_FOUND', candidates: []};
            });
            resolveTargetConnection.mockReturnValue(null); // 2. Connection check fails

            // --- Execute ---
            const result = executeUse(mockContext);

            // --- Assertions (remain the same) ---
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
                expect.objectContaining({ // Payload remains the same
                    explicitTargetEntityId: targetEntityId,
                    explicitTargetConnectionId: null
                })
            );
            expect(result.success).toBe(true);
            expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'error'}));
        });


    }); // end describe executeUse
}); // end describe useActionHandler
