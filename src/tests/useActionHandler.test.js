import {describe, it, expect, jest, beforeEach} from '@jest/globals';

// --- Mock Dependencies FIRST ---

// Mock the entire targetResolutionService module - Define mocks inline
jest.mock('../services/targetResolutionService.js', () => ({
    resolveTargetEntity: jest.fn(), // Define directly here
    resolveTargetConnection: jest.fn(), // Define directly here
}));

// Mock action validation utils - Define mock inline
jest.mock('../utils/actionValidationUtils.js', () => ({
    validateRequiredTargets: jest.fn(() => true), // Define directly here
}));

// Mock messages utils (This pattern was already correct)
jest.mock('../utils/messages.js', () => ({
    getDisplayName: jest.fn((entity) => entity?.mockName || entity?.id || 'Unknown'),
    TARGET_MESSAGES: {
        INTERNAL_ERROR_COMPONENT: (comp) => `Internal Error: Missing ${comp} Component.`,
        NOTHING_CARRIED: "You aren't carrying anything.",
        INTERNAL_ERROR: "An internal error occurred.",
    },
}));

// --- Get References to the Mock Functions AFTER jest.mock ---
// We need these references to set implementations and clear mocks later
const {
    resolveTargetEntity: mockResolveTargetEntity,
    resolveTargetConnection: mockResolveTargetConnection
} = require('../services/targetResolutionService.js');
const {validateRequiredTargets: mockValidateRequiredTargets} = require('../utils/actionValidationUtils.js');
// If you need getDisplayName mock reference often, get it too:
// const { getDisplayName: mockGetDisplayName } = require('../utils/messages.js');

// --- Import the System Under Test AFTER mocks ---
// Note: The exact path might depend on your folder structure (e.g., src/actions vs src/tests)
// Assuming the test file is in src/tests and the handler is in src/actions
import {executeUse} from '../actions/handlers/useActionHandler.js';

// --- Import Components (or use simple mock objects) ---
// Using simple objects for mocks to avoid component class dependencies
const mockInventoryComponent = (items = []) => ({
    items: items,
    getItems: jest.fn(() => items),
    hasItem: jest.fn((itemId) => items.includes(itemId)),
});

const mockPositionComponent = (locationId) => ({
    locationId: locationId,
    // Add other properties/methods if executeUse calls them
});

const mockNameComponent = (value) => ({
    value: value,
});

const mockItemComponent = (definitionId = null) => ({
    definitionId: definitionId,
});

const mockConnectionsComponent = (connections = []) => ({
    connections: connections,
    getConnectionById: jest.fn((connId) => connections.find(c => c.connectionId === connId)),
    // Add other methods if executeUse calls them
});


// --- Test Suite ---
describe('Action Handler: executeUse', () => {
    let mockPlayerEntity;
    let mockItemEntity;
    let mockTargetEntity;
    let mockConnectionObject;
    let mockCurrentLocation;
    let mockEntityManager;
    let mockEventBus;
    let mockDispatch;
    let baseActionContext;

    // --- Test Setup ---
    beforeEach(() => {
        // Clear mocks using the references obtained via require
        // jest.clearAllMocks() might also work, but being explicit is safer here
        mockResolveTargetEntity.mockClear();
        mockResolveTargetConnection.mockClear();
        mockValidateRequiredTargets.mockClear();
        // Also clear implementations if they are set in tests
        mockResolveTargetEntity.mockReset(); // Use mockReset if you want to clear impls too
        mockResolveTargetConnection.mockReset();
        // Reset validateRequiredTargets back to its default mock state if needed
        mockValidateRequiredTargets.mockImplementation(() => true);
        // Reset getDisplayName if you manipulate it:
        // mockGetDisplayName.mockClear(); or mockGetDisplayName.mockReset();


        // --- Mock Entities and Objects ---
        mockItemEntity = {
            id: 'item:test_key_instance_123',
            mockName: 'Test Key', // Used by mockGetDisplayName via the mock impl
            getComponent: jest.fn((componentClassOrKey) => {
                // Simplified key matching for test purposes
                const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
                if (key === 'NameComponent') {
                    return mockNameComponent('Test Key');
                }
                if (key === 'ItemComponent') {
                    // Allow overriding definitionId if needed per test
                    return mockItemComponent(mockItemEntity.definitionId || 'item_def:test_key');
                }
                return undefined;
            }),
            // Add definitionId property to be accessible within mockItemEntity itself if needed
            definitionId: 'item_def:test_key',
        };

        mockPlayerEntity = {
            id: 'player:test_player',
            getComponent: jest.fn((componentClassOrKey) => {
                const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
                if (key === 'InventoryComponent') {
                    // Default: player has the item
                    return mockInventoryComponent([mockItemEntity.id]);
                }
                if (key === 'PositionComponent') {
                    return mockPositionComponent('location:test_room');
                }
                if (key === 'NameComponent') {
                    return mockNameComponent('Test Player');
                }
                return undefined;
            }),
        };

        mockTargetEntity = {
            id: 'npc:test_goblin_456',
            mockName: 'Test Goblin',
            getComponent: jest.fn((componentClassOrKey) => {
                const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
                if (key === 'NameComponent') {
                    return mockNameComponent('Test Goblin');
                }
                // Add other components if needed by conditions/effects (though not tested here)
                return undefined;
            }),
        };

        mockConnectionObject = {
            connectionId: 'conn:north_door_789',
            name: 'North Door',
            direction: 'north',
            // Add state etc. if needed by conditions (though not tested here)
        };

        mockCurrentLocation = {
            id: 'location:test_room',
            getComponent: jest.fn((componentClassOrKey) => {
                const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
                if (key === 'ConnectionsComponent') {
                    return mockConnectionsComponent([mockConnectionObject]);
                }
                if (key === 'NameComponent') {
                    return mockNameComponent('Test Room');
                }
                return undefined;
            }),
        };

        // --- Mock Services ---
        mockEntityManager = {
            getEntityInstance: jest.fn((entityId) => {
                if (entityId === mockPlayerEntity.id) return mockPlayerEntity;
                if (entityId === mockItemEntity.id) return mockItemEntity;
                if (entityId === mockTargetEntity.id) return mockTargetEntity;
                if (entityId === mockCurrentLocation.id) return mockCurrentLocation;
                return undefined;
            }),
            // Add other methods if executeUse calls them
        };

        mockEventBus = {
            dispatch: jest.fn(),
        };
        mockDispatch = mockEventBus.dispatch; // Alias for convenience

        // --- Base Action Context ---
        baseActionContext = {
            playerEntity: mockPlayerEntity,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            dispatch: mockDispatch,
            currentLocation: mockCurrentLocation,
            // targets will be added per test
        };
    });

    // --- Test Cases (Remain the same as previous version) ---

    it('AC 2.1: should dispatch item_use_attempted for item used on a connection', () => {
        // Arrange Mocks
        mockResolveTargetEntity.mockImplementation((context, config) => {
            // Simulate resolving the item from inventory
            if (config.scope === 'inventory' && config.targetName.includes('key')) {
                return mockItemEntity;
            }
            return null;
        });
        mockResolveTargetConnection.mockImplementation((context, targetName) => {
            // Simulate resolving the connection
            if (targetName.includes('north door')) {
                return mockConnectionObject;
            }
            return null;
        });

        // Arrange Context
        const actionContext = {
            ...baseActionContext,
            targets: ['test', 'key', 'on', 'north', 'door'], // Example targets from parser
        };

        // Act
        const result = executeUse(actionContext);

        // Assert
        expect(result.success).toBe(true);
        expect(mockValidateRequiredTargets).toHaveBeenCalledWith(actionContext, 'use');
        expect(mockResolveTargetEntity).toHaveBeenCalledTimes(1); // Only for the item
        expect(mockResolveTargetEntity).toHaveBeenCalledWith(
            actionContext,
            expect.objectContaining({scope: 'inventory', targetName: 'test key on north door'}) // Checks full string initially
        );
        expect(mockResolveTargetConnection).toHaveBeenCalledTimes(1);
        // The mockGetDisplayName now correctly provides 'Test Key' here
        expect(mockResolveTargetConnection).toHaveBeenCalledWith(actionContext, 'north door', expect.stringContaining('use Test Key on'));
        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:item_use_attempted',
            {
                userEntityId: mockPlayerEntity.id,
                itemInstanceId: mockItemEntity.id,
                itemDefinitionId: mockItemEntity.definitionId, // From mock item setup
                explicitTargetEntityId: null,
                explicitTargetConnectionId: mockConnectionObject.connectionId,
            }
        );
    });

    it('AC 2.2: should dispatch item_use_attempted for item used on an entity', () => {
        // Arrange Mocks
        mockResolveTargetEntity.mockImplementation((context, config) => {
            if (config.scope === 'inventory' && config.targetName.includes('potion')) {
                // Update mock item details for this test
                mockItemEntity.id = 'item:potion_1';
                mockItemEntity.mockName = 'Healing Potion';
                mockItemEntity.definitionId = 'item_def:potion_healing';
                return mockItemEntity;
            }
            if (config.scope === 'location' && config.targetName.includes('goblin')) {
                return mockTargetEntity;
            }
            return null;
        });
        mockResolveTargetConnection.mockReturnValue(null); // No connection found

        // Arrange Context
        const actionContext = {
            ...baseActionContext,
            targets: ['healing', 'potion', 'on', 'goblin'], // Example targets
        };
        // Ensure player has the potion using jest.spyOn to modify the mock for this test
        const inventorySpy = jest.spyOn(mockPlayerEntity, 'getComponent');
        inventorySpy.mockImplementation((componentClassOrKey) => {
            const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
            if (key === 'InventoryComponent') return mockInventoryComponent(['item:potion_1']);
            if (key === 'PositionComponent') return mockPositionComponent('location:test_room');
            if (key === 'NameComponent') return mockNameComponent('Test Player'); // Keep name accessible
            return undefined;
        });


        // Act
        const result = executeUse(actionContext);

        // Assert
        expect(result.success).toBe(true);
        expect(mockValidateRequiredTargets).toHaveBeenCalledWith(actionContext, 'use');
        expect(mockResolveTargetEntity).toHaveBeenCalledTimes(2); // Once for item, once for target entity
        expect(mockResolveTargetEntity).toHaveBeenCalledWith(
            actionContext,
            expect.objectContaining({scope: 'inventory', targetName: 'healing potion on goblin'})
        );
        expect(mockResolveTargetEntity).toHaveBeenCalledWith(
            actionContext,
            expect.objectContaining({scope: 'location', targetName: 'goblin'}) // Target name extracted after item name
        );
        expect(mockResolveTargetConnection).toHaveBeenCalledTimes(1); // Still checks connection first
        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:item_use_attempted',
            {
                userEntityId: mockPlayerEntity.id,
                itemInstanceId: 'item:potion_1',
                itemDefinitionId: 'item_def:potion_healing',
                explicitTargetEntityId: mockTargetEntity.id,
                explicitTargetConnectionId: null,
            }
        );
        inventorySpy.mockRestore(); // Clean up the spy
    });

    it('AC 2.3: should dispatch item_use_attempted for item used without explicit target', () => {
        // Arrange Mocks
        mockResolveTargetEntity.mockImplementation((context, config) => {
            if (config.scope === 'inventory' && config.targetName === 'healing potion') { // Exact match now
                mockItemEntity.id = 'item:potion_1';
                mockItemEntity.mockName = 'Healing Potion';
                mockItemEntity.definitionId = 'item_def:potion_healing';
                return mockItemEntity;
            }
            return null;
        });
        // No connection or entity target should be resolved

        // Arrange Context
        const actionContext = {
            ...baseActionContext,
            targets: ['healing', 'potion'], // Just the item
        };
        // Ensure player has the potion using jest.spyOn
        const inventorySpy = jest.spyOn(mockPlayerEntity, 'getComponent');
        inventorySpy.mockImplementation((componentClassOrKey) => {
            const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
            if (key === 'InventoryComponent') return mockInventoryComponent(['item:potion_1']);
            if (key === 'PositionComponent') return mockPositionComponent('location:test_room');
            if (key === 'NameComponent') return mockNameComponent('Test Player');
            return undefined;
        });

        // Act
        const result = executeUse(actionContext);

        // Assert
        expect(result.success).toBe(true);
        expect(mockValidateRequiredTargets).toHaveBeenCalledWith(actionContext, 'use');
        expect(mockResolveTargetEntity).toHaveBeenCalledTimes(1); // Only for item
        expect(mockResolveTargetEntity).toHaveBeenCalledWith(
            actionContext,
            expect.objectContaining({scope: 'inventory', targetName: 'healing potion'})
        );
        expect(mockResolveTargetConnection).not.toHaveBeenCalled(); // Not called if no remaining target string
        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:item_use_attempted',
            {
                userEntityId: mockPlayerEntity.id,
                itemInstanceId: 'item:potion_1',
                itemDefinitionId: 'item_def:potion_healing',
                explicitTargetEntityId: null,
                explicitTargetConnectionId: null,
            }
        );
        inventorySpy.mockRestore(); // Clean up the spy
    });

    it('should fail if the specific item is not found in inventory', () => { // Renamed for clarity
        // Arrange Mocks
        mockResolveTargetEntity.mockImplementation((context, config) => {
            if (config.scope === 'inventory') {
                // Simulate resolver NOT finding the 'nonexistent item'
                return null;
            }
            return null; // Default null for other scopes if any
        });

        // Arrange Context
        const actionContext = {
            ...baseActionContext,
            targets: ['nonexistent', 'item'],
        };
        // Ensure player inventory is NOT empty, but doesn't contain the target
        const inventorySpy = jest.spyOn(mockPlayerEntity, 'getComponent');
        inventorySpy.mockImplementation((componentClassOrKey) => {
            const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
            // *** FIX: Give the player SOME other item ***
            if (key === 'InventoryComponent') return mockInventoryComponent(['item:some_other_thing']);
            if (key === 'PositionComponent') return mockPositionComponent('location:test_room');
            if (key === 'NameComponent') return mockNameComponent('Test Player');
            return undefined;
        });

        // Act
        const result = executeUse(actionContext);

        // Assert
        expect(result.success).toBe(false);
        expect(mockValidateRequiredTargets).toHaveBeenCalled();
        // *** The original assertion should now pass ***
        expect(mockResolveTargetEntity).toHaveBeenCalledTimes(1);
        expect(mockResolveTargetEntity).toHaveBeenCalledWith(
            actionContext,
            expect.objectContaining({scope: 'inventory', targetName: 'nonexistent item'})
        );
        expect(mockResolveTargetConnection).not.toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:item_use_attempted', expect.anything());
        // Add assertion check that resolveTargetEntity (or a utility it calls) dispatched the 'NOT_FOUND_INVENTORY' message

        inventorySpy.mockRestore(); // Clean up the spy
    });

    it('should fail if explicit target (connection/entity) is not found', () => {
        // Arrange Mocks
        mockResolveTargetEntity.mockImplementation((context, config) => {
            // Found item
            if (config.scope === 'inventory' && config.targetName.includes('key')) {
                return mockItemEntity;
            }
            // Did NOT find target entity
            if (config.scope === 'location') {
                return null;
            }
            return null;
        });
        mockResolveTargetConnection.mockReturnValue(null); // Did NOT find target connection

        // Arrange Context
        const actionContext = {
            ...baseActionContext,
            targets: ['test', 'key', 'on', 'nonexistent'], // Target 'nonexistent'
        };
        // Ensure player has the key
        const inventorySpy = jest.spyOn(mockPlayerEntity, 'getComponent');
        inventorySpy.mockImplementation((componentClassOrKey) => {
            const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
            if (key === 'InventoryComponent') return mockInventoryComponent([mockItemEntity.id]);
            if (key === 'PositionComponent') return mockPositionComponent('location:test_room');
            if (key === 'NameComponent') return mockNameComponent('Test Player');
            return undefined;
        });


        // Act
        const result = executeUse(actionContext);

        // Assert
        expect(result.success).toBe(false);
        expect(mockValidateRequiredTargets).toHaveBeenCalled();
        expect(mockResolveTargetEntity).toHaveBeenCalledTimes(2); // Item (success), Target Entity (fail)
        expect(mockResolveTargetConnection).toHaveBeenCalledTimes(1); // Target Connection (fail)
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:item_use_attempted', expect.anything());
        // We expect resolveTargetConnection or resolveTargetEntity to dispatch the failure message
        inventorySpy.mockRestore(); // Clean up the spy
    });

    it('should fail if player is missing InventoryComponent', () => {
        // Arrange Mocks using jest.spyOn
        const inventorySpy = jest.spyOn(mockPlayerEntity, 'getComponent');
        inventorySpy.mockImplementation((componentClassOrKey) => {
            const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
            if (key === 'InventoryComponent') return null; // Missing inventory!
            if (key === 'PositionComponent') return mockPositionComponent('location:test_room');
            if (key === 'NameComponent') return mockNameComponent('Test Player');
            return undefined;
        });

        // Arrange Context
        const actionContext = {
            ...baseActionContext,
            targets: ['test', 'key'],
        };

        // Act
        const result = executeUse(actionContext);

        // Assert
        expect(result.success).toBe(false);
        // executeUse checks inventory *before* validateRequiredTargets
        // expect(mockValidateRequiredTargets).toHaveBeenCalled(); // This might not be called if inventory check fails first
        expect(mockResolveTargetEntity).not.toHaveBeenCalled(); // Should fail before resolving
        expect(mockResolveTargetConnection).not.toHaveBeenCalled();
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({type: 'error', text: expect.stringContaining('Inventory')})
        );
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:item_use_attempted', expect.anything());
        inventorySpy.mockRestore(); // Clean up the spy
    });

    it('should fail gracefully if EventBus is missing in context', () => {
        // Arrange Mocks - resolve item successfully
        mockResolveTargetEntity.mockImplementation((context, config) => {
            // Simple item match based on the 'test key' target in context
            if (config.scope === 'inventory' && config.targetName === 'test key') {
                return mockItemEntity;
            }
            return null;
        });
        // Ensure player has the key
        const inventorySpy = jest.spyOn(mockPlayerEntity, 'getComponent');
        inventorySpy.mockImplementation((componentClassOrKey) => {
            const key = typeof componentClassOrKey === 'string' ? componentClassOrKey : componentClassOrKey?.name;
            if (key === 'InventoryComponent') return mockInventoryComponent([mockItemEntity.id]);
            if (key === 'PositionComponent') return mockPositionComponent('location:test_room');
            if (key === 'NameComponent') return mockNameComponent('Test Player');
            return undefined;
        });


        // Arrange Context - Remove eventBus!
        const actionContext = {
            ...baseActionContext,
            targets: ['test', 'key'],
            eventBus: undefined, // Critical part of this test
            // Keep context.dispatch pointing to the mockDispatch for the error message
        };

        // Act
        const result = executeUse(actionContext);

        // Assert
        expect(result.success).toBe(false);
        expect(mockResolveTargetEntity).toHaveBeenCalledTimes(1); // Should still resolve item
        // It tries to dispatch the internal error message via context.dispatch
        expect(mockDispatch).toHaveBeenCalledTimes(1);
        expect(mockDispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({type: 'error', text: expect.stringContaining('internal error')})
        );
        // It should not have tried to dispatch the success event via the (missing) eventBus
        // Since eventBus is undefined, the final dispatch will fail internally
        expect(mockDispatch).not.toHaveBeenCalledWith('event:item_use_attempted', expect.anything());
        inventorySpy.mockRestore(); // Clean up the spy
    });
});