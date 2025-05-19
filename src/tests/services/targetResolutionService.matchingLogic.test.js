// src/tests/services/targetResolutionService.matchingLogic.test.js

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
// Assuming the test file is actually located at src/tests/services/ as per jest output
import { TargetResolutionService } from '../../services/targetResolutionService.js';
import { ResolutionStatus } from '../../types/resolutionStatus.js';
import Entity from '../../entities/entity.js';
import { INVENTORY_COMPONENT_ID, NAME_COMPONENT_ID } from '../../constants/componentIds.js';
import {getEntityIdsForScopes} from "../../services/entityScopeService.js";

// --- Mocks for Dependencies ---
let mockEntityManager;
let mockWorldContext;
let mockGameDataRepository;
let mockLogger;
// --- End Mocks ---

describe('TargetResolutionService - Advanced Name Matching Logic (via Inventory Domain)', () => {
    let service;
    let mockActorEntity;
    const actionDefinition = { id: 'test:get-action', target_domain: 'inventory' };

    const createMockItem = (id, name) => {
        const item = new Entity(id);
        if (name !== undefined && name !== null) {
            item.addComponent(NAME_COMPONENT_ID, { text: name });
        }
        return item;
    };

    // Helper to create actionContext with correct structure
    const createActionContext = (nounPhraseValue, currentActingEntity = mockActorEntity) => {
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
            // Include other mocks if TRS or entityScopeService depend on them directly from context
            // However, _buildMinimalContextForScopes in TRS uses service's own injected dependencies primarily.
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
            currentLocation: { id: 'mockRoomForContext' } // Provide a mock location
        };
    };


    beforeEach(() => {
        jest.resetAllMocks();

        mockEntityManager = {
            getEntityInstance: jest.fn(),
            getEntitiesInLocation: jest.fn(),
        };
        mockWorldContext = {
            getLocationOfEntity: jest.fn().mockReturnValue({ id: 'mockRoomForContext' }), // For _buildMinimalContextForScopes
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

        const options = {
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
            getEntityIdsForScopes: getEntityIdsForScopes
        };
        service = new TargetResolutionService(options);

        mockActorEntity = new Entity('actor1');
        mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: [] });

        // Default mock for actor itself by entity manager
        mockEntityManager.getEntityInstance.mockImplementation(id => {
            if (id === 'actor1') return mockActorEntity;
            return undefined;
        });
    });

    const setupInventoryAndEntityManager = (inventoryItems) => {
        const itemEntityIds = inventoryItems.map(item => item.id);
        mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: itemEntityIds });

        mockEntityManager.getEntityInstance.mockImplementation(requestedId => {
            if (requestedId === mockActorEntity.id) {
                return mockActorEntity;
            }
            const foundItem = inventoryItems.find(i => i.id === requestedId);
            if (foundItem) {
                return foundItem;
            }
            return undefined;
        });
    };


    // 8.1: Matching - Exact Match Priority (1 exact, multiple startsWith/substring)
    describe('8.1: Exact Match Priority', () => {
        test('should select the exact match even if startsWith and substring matches exist', async () => {
            const itemsToSetup = [
                createMockItem('item1', 'apple pie'),
                createMockItem('item2', 'apple'), // Exact match
                createMockItem('item3', 'a big apple pie'),
            ];
            setupInventoryAndEntityManager(itemsToSetup);
            const actionContext = createActionContext('apple'); // Corrected context

            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('item2');
            expect(result.targetType).toBe('entity');
            expect(result.error).toBeUndefined();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('NameMatcher.matchNames: Unique exact match found: ID "item2"'));
        });
    });

    // 8.2: Matching - StartsWith Match Priority (0 exact, 1 startsWith, multiple substring)
    describe('8.2: StartsWith Match Priority', () => {
        test('should select the startsWith match if no exact match exists, even with substring matches', async () => {
            const itemsToSetup = [
                createMockItem('item1', 'apple pie'), // StartsWith match
                createMockItem('item2', 'a tasty apple pie'),
                createMockItem('item3', 'another pie apple'),
            ];
            setupInventoryAndEntityManager(itemsToSetup);
            const actionContext = createActionContext('apple'); // Corrected context

            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('item1');
            expect(result.targetType).toBe('entity');
            expect(result.error).toBeUndefined();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('NameMatcher.matchNames: Unique startsWith match found: ID "item1"'));
        });
    });

    // 8.3: Matching - Substring Match (0 exact, 0 startsWith, 1 substring)
    describe('8.3: Substring Match', () => {
        test('should select the substring match if no exact or startsWith matches exist', async () => {
            const itemsToSetup = [
                createMockItem('item1', 'the tasty apple pie'), // Substring match
                createMockItem('item2', 'banana bread'),
            ];
            setupInventoryAndEntityManager(itemsToSetup);
            const actionContext = createActionContext('apple'); // Corrected context

            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('item1');
            expect(result.targetType).toBe('entity');
            expect(result.error).toBeUndefined();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('NameMatcher.matchNames: Unique substring match found: ID "item1"'));
        });
    });

    // 8.7: Matching - Case Insensitivity for Phrase and Candidate Names
    describe('8.7: Case Insensitivity', () => {
        test('should match regardless of phrase casing (e.g., "APPLE" for "apple")', async () => {
            const itemsToSetup = [createMockItem('item1', 'apple')];
            setupInventoryAndEntityManager(itemsToSetup);
            const actionContext = createActionContext('APPLE'); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);
            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('item1');
        });

        test('should match regardless of candidate name casing (e.g., "apple" for "APPLE")', async () => {
            const itemsToSetup = [createMockItem('item1', 'APPLE')];
            setupInventoryAndEntityManager(itemsToSetup);
            const actionContext = createActionContext('apple'); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);
            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('item1');
        });

        test('should match regardless of mixed casing in both (e.g., "ApPlE" for "aPpLe")', async () => {
            const itemsToSetup = [createMockItem('item1', 'aPpLe')];
            setupInventoryAndEntityManager(itemsToSetup);
            const actionContext = createActionContext('ApPlE'); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);
            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('item1');
        });
    });

    // 8.8: Matching - Whitespace Trimming for Phrase
    describe('8.8: Whitespace Trimming for Phrase', () => {
        test('should match when phrase has leading/trailing spaces', async () => {
            const itemsToSetup = [createMockItem('item1', 'apple')];
            setupInventoryAndEntityManager(itemsToSetup);
            const actionContext = createActionContext('  apple  '); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);
            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('item1');
        });
    });

    // 8.9: Matching - Candidates with Invalid/Empty Names
    describe('8.9: Candidates with Invalid/Empty Names', () => {
        test('should skip candidates with missing name components and log a warning', async () => {
            const validItem = createMockItem('validItem', 'apple');
            const itemActuallyNoNameComp = new Entity('noNameComp');
            itemActuallyNoNameComp.name = undefined; // Ensure no fallback name either

            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: ['noNameComp', 'validItem'] });

            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === 'validItem') return validItem;
                if (id === 'noNameComp') return itemActuallyNoNameComp;
                if (id === 'actor1') return mockActorEntity;
                return undefined;
            });

            const actionContext = createActionContext('apple'); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('validItem');
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`EntityUtils.getEntityDisplayName: Entity 'noNameComp' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`TargetResolutionService.#_gatherNameMatchCandidates: Entity 'noNameComp' in inventory has no valid name. Skipping.`));
        });

        test('should skip candidates with empty name string in name component and log a warning', async () => {
            const validItem = createMockItem('validItem', 'apple');
            const itemEmptyName = createMockItem('emptyNameItem', '   ');

            setupInventoryAndEntityManager([itemEmptyName, validItem]);

            const actionContext = createActionContext('apple'); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('validItem');
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`EntityUtils.getEntityDisplayName: Entity 'emptyNameItem' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`));
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`TargetResolutionService.#_gatherNameMatchCandidates: Entity 'emptyNameItem' in inventory has no valid name. Skipping.`));
        });

        test('should correctly handle items with non-string names (logged by earlier stages) and find valid items', async () => {
            const item1 = createMockItem('item1', 'normal apple');
            const item2Entity = new Entity('item2');
            item2Entity.addComponent(NAME_COMPONENT_ID, { text: 123 }); // Non-string name
            item2Entity.name = undefined; // No fallback entity.name

            setupInventoryAndEntityManager([item1, item2Entity]);

            const actionContext = createActionContext('normal apple'); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
            expect(result.targetId).toBe('item1');
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`EntityUtils.getEntityDisplayName: Entity 'item2' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`)
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`TargetResolutionService.#_gatherNameMatchCandidates: Entity 'item2' in inventory has no valid name. Skipping.`)
            );
        });
    });

    // 8.10: Matching - No Candidates Provided to #_matchByName (now NameMatcher)
    describe('8.10: No Candidates Provided to #_matchByName', () => {
        test('should return NOT_FOUND from inventory resolver if inventory is empty', async () => {
            mockActorEntity.addComponent(INVENTORY_COMPONENT_ID, { items: [] });
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === 'actor1') return mockActorEntity;
                return undefined;
            });

            const actionContext = createActionContext('apple'); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBeNull();
            expect(result.error).toBe("Your inventory is empty.");
        });

        test('should return specific error if inventory items exist but none have names', async () => {
            const itemNoName = new Entity('itemNoName');
            itemNoName.name = undefined; // Ensure no fallback
            setupInventoryAndEntityManager([itemNoName]);

            const actionContext = createActionContext('apple'); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.error).toBe("You don't have anything like that in your inventory.");
            expect(result.targetType).toBe('entity');
        });

        test('error from NameMatcher "Nothing found to match..." is overridden by inventory domain', async () => {
            const itemsToSetup = [createMockItem('item1', 'banana')];
            setupInventoryAndEntityManager(itemsToSetup);

            const actionContext = createActionContext('apple'); // Corrected context
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
            expect(result.error).toBe("You don't have \"apple\" in your inventory.");
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('NameMatcher.matchNames called with phrase: "apple"'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('NameMatcher.matchNames - Phrase: "apple" - Exact: 0, StartsWith: 0, Substring: 0'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('NameMatcher.matchNames: No matches found for phrase "apple"'));
        });
    });

    // 8.11: Matching - Empty Noun Phrase to #_matchByName (now NameMatcher)
    describe('8.11: Empty Noun Phrase to #_matchByName', () => {
        const itemsToSetup = [createMockItem('item1', 'apple')];

        // These tests already correctly simulate an empty/null directObjectPhrase
        // because createActionContext will pass null/undefined/empty string
        // to directObjectPhrase.
        beforeEach(() => {
            setupInventoryAndEntityManager(itemsToSetup);
        });

        const expectedError = "You need to specify which item from your inventory.";

        test.each([
            [null, "null"],
            [undefined, "undefined"],
            ['', 'empty string'],
            ['   ', 'whitespace string']
        ])
        ('should return ENTITY with domain-specific error for nounPhrase %s', async (nounPhraseValue, _description) => {
            const actionContext = createActionContext(nounPhraseValue); // Corrected context used here

            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            expect(result.status).toBe(ResolutionStatus.NONE);
            expect(result.targetType).toBe('entity');
            expect(result.targetId).toBeNull();
            expect(result.error).toBe(expectedError);

            if (nounPhraseValue === null || nounPhraseValue === undefined || String(nounPhraseValue).trim() === "") {
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("NameMatcher.matchNames: Invalid or empty phrase provided."));
            }
        });
    });
});