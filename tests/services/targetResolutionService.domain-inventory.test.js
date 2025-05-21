// src/tests/services/targetResolutionService.domain-inventory.test.js

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TargetResolutionService } from '../../src/services/targetResolutionService.js';
import { ResolutionStatus } from '../../src/types/resolutionStatus.js';
import {getEntityIdsForScopes} from "../../src/services/entityScopeService.js";
import Entity from '../../src/entities/entity.js'; // Using Entity for mocks

// Constants used by the service
const INVENTORY_COMPONENT_ID = 'core:inventory';
const NAME_COMPONENT_ID = 'core:name';

// --- Mocks for Dependencies ---
let mockEntityManager;
let mockWorldContext;
let mockGameDataRepository;
let mockLogger;
// --- End Mocks ---

describe('TargetResolutionService - Domain \'inventory\'', () => {
    let service;
    let consoleWarnSpy;
    const actionDefinition = { id: 'test:inv-action', target_domain: 'inventory' }; // Define actionDefinition

    // Helper to create mock item Entity instances
    const createMockItemEntity = (id, name) => {
        const item = new Entity(id);
        if (name !== undefined && name !== null) {
            item.addComponent(NAME_COMPONENT_ID, { text: name });
        }
        // Add .name property for fallback tests
        item.name = name;
        return item;
    };

    // Helper to create actionContext with correct structure
    const createActionContext = (nounPhraseValue, currentActingEntity) => {
        return {
            actingEntity: currentActingEntity,
            parsedCommand: {
                directObjectPhrase: nounPhraseValue,
                actionId: actionDefinition.id, // include for completeness
                originalInput: typeof nounPhraseValue === 'string' ? nounPhraseValue : '', // for completeness
                error: null,
                preposition: null,
                indirectObjectPhrase: null,
            },
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
            currentLocation: { id: 'mockRoomForInvContext' } // Mock location needed for _buildMinimalContextForScopes
        };
    };

    beforeEach(() => {
        // Reset all mocks before each test
        jest.resetAllMocks();

        mockEntityManager = {
            getEntityInstance: jest.fn(),
            getEntitiesInLocation: jest.fn(),
        };
        mockWorldContext = {
            getLocationOfEntity: jest.fn().mockReturnValue({ id: 'mockRoomForInvContext' }), // Needed for _buildMinimalContextForScopes
            getCurrentActor: jest.fn(),
            getCurrentLocation: jest.fn(),
        };
        mockGameDataRepository = {
            getActionDefinition: jest.fn(),
            getAllActionDefinitions: jest.fn(),
        };
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
        };

        // Suppress console.warn messages from entityScopeService for cleaner test output
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});


        const options = {
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
            getEntityIdsForScopes: getEntityIdsForScopes
        };
        service = new TargetResolutionService(options);

        // Clear any logger calls from constructor or previous tests
        mockLogger.info.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });


    // Sub-Ticket/Test Case 4.1: Inventory - Actor has no Inventory Component
    describe('Sub-Ticket/Test Case 4.1: Inventory - Actor has no Inventory Component', () => {
        test('Tests behavior when the actor lacks an inventory component.', async () => {
            // Setup
            const mockActorEntity = new Entity('actor1'); // No inventory component added
            // Ensure hasComponent returns false for inventory
            const originalHasComponent = mockActorEntity.hasComponent;
            mockActorEntity.hasComponent = jest.fn(compId => {
                if(compId === INVENTORY_COMPONENT_ID) return false;
                return originalHasComponent.call(mockActorEntity, compId);
            });

            const nounPhrase = 'sword';
            const actionContext = createActionContext(nounPhrase, mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBeNull();
            expect(result.error).toBe("You are not carrying anything.");

            expect(consoleWarnSpy).toHaveBeenCalledWith( // Check console.warn from entityScopeService
                `entityScopeService._handleInventory: Scope 'inventory' requested but player ${mockActorEntity.id} lacks component data for ID "${INVENTORY_COMPONENT_ID}".`
            );
            // Check overall logger calls for this specific test
            // TRS log will now show the actual nounPhrase used
            expect(mockLogger.debug).toHaveBeenCalledWith(`TargetResolutionService.resolveActionTarget called for action: '${actionDefinition.id}', actor: '${mockActorEntity.id}', noun: "${nounPhrase}"`);
            // _resolveInventoryDomain log will also show the nounPhrase
            expect(mockLogger.debug).toHaveBeenCalledWith(`TargetResolutionService.#_resolveInventoryDomain called for actor: '${mockActorEntity.id}', nounPhrase: "${nounPhrase}"`);
            // TRS internal warning about missing component (different from ESS console.warn)
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `TargetResolutionService.#_resolveInventoryDomain: Actor 'actor1' is missing '${INVENTORY_COMPONENT_ID}' component (checked after getEntityIdsForScopes returned empty).`
            );
        });
    });

    // Sub-Ticket/Test Case 4.2: Inventory - Empty (No items or empty array)
    describe('Sub-Ticket/Test Case 4.2: Inventory - Empty', () => {
        test('Tests behavior with an empty inventory component ({ items: [] })', async () => {
            // Setup
            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: [] }); // Empty inventory
            const actionContext = createActionContext('sword', mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBeNull();
            expect(result.error).toBe("Your inventory is empty.");
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `TargetResolutionService.#_resolveInventoryDomain: Actor 'actor1' inventory is empty (getEntityIdsForScopes returned empty set).`
            );
        });

        test('Tests behavior with an inventory component having items: null', async () => {
            // Setup
            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: null }); // Invalid items property
            const actionContext = createActionContext('sword', mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBeNull();
            expect(result.error).toBe("Your inventory is empty."); // ESS logs warning, returns empty set, TRS handles empty set
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `TargetResolutionService.#_resolveInventoryDomain: Actor 'actor1' inventory is empty (getEntityIdsForScopes returned empty set).`
            );
        });

        test('Tests behavior with an inventory component being an empty object {}', async () => {
            // Setup
            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, {}); // No items property
            const actionContext = createActionContext('sword', mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBeNull();
            expect(result.error).toBe("Your inventory is empty."); // ESS logs warning, returns empty set, TRS handles empty set
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `TargetResolutionService.#_resolveInventoryDomain: Actor 'actor1' inventory is empty (getEntityIdsForScopes returned empty set).`
            );
        });
    });

    // Sub-Ticket/Test Case 4.3: Inventory - Item ID is Invalid
    describe('Sub-Ticket/Test Case 4.3: Inventory - Item ID is Invalid', () => {
        test('Tests skipping of invalid item IDs in the inventory list.', async () => {
            // Setup
            const validItemEntity = createMockItemEntity('itemValid', 'Valid Item');
            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: [null, 'itemValid', ''] }); // Invalid IDs mixed with valid

            mockEntityManager.getEntityInstance.mockImplementation((itemId) => {
                if (itemId === 'itemValid') return validItemEntity;
                if (itemId === 'actor1') return mockActorEntity;
                return undefined;
            });
            const actionContext = createActionContext('Valid Item', mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            // ESS filters out null and empty string before TRS sees them. No warnings expected for those.
            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBe('itemValid');
            expect(result.error).toBeUndefined();
        });
    });

    // Sub-Ticket/Test Case 4.4: Inventory - Item Entity Not Found by EntityManager
    describe('Sub-Ticket/Test Case 4.4: Inventory - Item Entity Not Found by EntityManager', () => {
        test('Tests skipping an item if entityManager.getEntityInstance returns undefined.', async () => {
            // Setup
            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: ['nonExistentItem'] });
            // EM will not find 'nonExistentItem'
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === 'actor1') return mockActorEntity;
                return undefined;
            });
            const actionContext = createActionContext('thing', mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "TargetResolutionService.#_gatherNameMatchCandidates: Entity 'nonExistentItem' from inventory not found via entityManager. Skipping."
            );
            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.targetType).toBe('entity');
            expect(result.error).toBe("You don't have anything like that in your inventory."); // Because candidates list became empty
        });
    });

    // Sub-Ticket/Test Case 4.5: Inventory - Item Entity Has No Name (via #_getEntityName)
    describe('Sub-Ticket/Test Case 4.5: Inventory - Item Entity Has No Name', () => {
        test('Tests skipping an item if it has no name.', async () => {
            // Setup
            const namelessItemEntity = new Entity('namelessItem'); // No name component added
            namelessItemEntity.name = undefined; // Ensure no fallback

            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: ['namelessItem'] });

            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === 'namelessItem') return namelessItemEntity;
                if (id === 'actor1') return mockActorEntity;
                return undefined;
            });
            const actionContext = createActionContext('thing', mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "EntityUtils.getEntityDisplayName: Entity 'namelessItem' has no usable name from 'core:name' or entity.name."
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "TargetResolutionService.#_gatherNameMatchCandidates: Entity 'namelessItem' in inventory has no valid name. Skipping."
            );
            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.targetType).toBe('entity');
            expect(result.error).toBe("You don't have anything like that in your inventory."); // Because candidates list became empty
        });
    });

    // Sub-Ticket/Test Case 4.6: Inventory - No Noun Phrase Provided
    describe('Sub-Ticket/Test Case 4.6: Inventory - No Noun Phrase Provided', () => {
        test('Tests response when nounPhrase is empty but inventory has items.', async () => {
            // Setup
            const itemEntity1 = createMockItemEntity('sword', 'Steel Sword');
            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: ['sword'] });

            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === 'sword') return itemEntity1;
                if (id === 'actor1') return mockActorEntity;
                return undefined;
            });
            const actionContext = createActionContext('', mockActorEntity); // Corrected context (empty string)

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.NONE);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBeNull();
            expect(result.error).toBe("You need to specify which item from your inventory.");
        });
    });

    // Sub-Ticket/Test Case 4.7: Inventory - Unique Match (Exact)
    describe('Sub-Ticket/Test Case 4.7: Inventory - Unique Match (Exact)', () => {
        test('Tests successful unique exact match.', async () => {
            // Setup
            const itemEntity1 = createMockItemEntity('sword', 'Steel Sword');
            const itemEntity2 = createMockItemEntity('potion', 'Healing Potion');
            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: ['sword', 'potion'] });

            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === 'sword') return itemEntity1;
                if (id === 'potion') return itemEntity2;
                if (id === 'actor1') return mockActorEntity;
                return undefined;
            });
            const actionContext = createActionContext('Steel Sword', mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBe('sword');
            expect(result.error).toBeUndefined();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'NameMatcher.matchNames: Unique exact match found: ID "sword", Name "Steel Sword".'
            );
        });
    });

    // Sub-Ticket/Test Case 4.8: Inventory - Ambiguous Match (StartsWith)
    describe('Sub-Ticket/Test Case 4.8: Inventory - Ambiguous Match (StartsWith)', () => {
        test('Tests ambiguous match based on startsWith.', async () => {
            // Setup
            const itemEntity1 = createMockItemEntity('long_sword', 'Long Sword');
            const itemEntity2 = createMockItemEntity('long_bow', 'Long Bow');
            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: ['long_sword', 'long_bow'] });

            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === 'long_sword') return itemEntity1;
                if (id === 'long_bow') return itemEntity2;
                if (id === 'actor1') return mockActorEntity;
                return undefined;
            });
            const nounPhrase = 'Long';
            const actionContext = createActionContext(nounPhrase, mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.AMBIGUOUS);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBeNull();
            expect(result.candidates).toEqual(expect.arrayContaining(['long_sword', 'long_bow']));
            expect(result.candidates.length).toBe(2);
            expect(result.error).toBe("Which item starting with \"Long\" did you mean? For example: \"Long Sword\", \"Long Bow\".");

            const normalizedPhrase = nounPhrase.toLowerCase();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `NameMatcher.matchNames: Ambiguous startsWith matches found for "${normalizedPhrase}". Count: 2.`
            );
        });
    });

    // Sub-Ticket/Test Case 4.9: Inventory - No Match
    describe('Sub-Ticket/Test Case 4.9: Inventory - No Match', () => {
        test('Tests when nounPhrase matches no items in inventory.', async () => {
            // Setup
            const itemEntity1 = createMockItemEntity('sword', 'Steel Sword');
            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: ['sword'] });

            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === 'sword') return itemEntity1;
                if (id === 'actor1') return mockActorEntity;
                return undefined;
            });
            const actionContext = createActionContext('Shield', mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBeNull();
            expect(result.error).toBe("You don't have \"Shield\" in your inventory.");
        });
    });

    // Sub-Ticket/Test Case 4.10: Inventory - Item name from entity.name fallback
    describe('Sub-Ticket/Test Case 4.10: Inventory - Item name from entity.name fallback', () => {
        test('Tests #_getEntityName fallback to entity.name for an inventory item.', async () => {
            // Setup
            const itemWithFallbackName = new Entity('fallback_item');
            itemWithFallbackName.name = 'Fallback Item Name'; // Add .name directly
            // No core:name component added

            const mockActorEntity = new Entity('actor1');
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: ['fallback_item'] });

            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === 'fallback_item') return itemWithFallbackName;
                if (id === 'actor1') return mockActorEntity;
                return undefined;
            });
            const actionContext = createActionContext('Fallback Item Name', mockActorEntity); // Corrected context

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBe('fallback_item');
            expect(result.error).toBeUndefined();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                "EntityUtils.getEntityDisplayName: Entity 'fallback_item' using fallback entity.name property ('Fallback Item Name') as 'core:name' was not found or invalid."
            );
        });
    });
});