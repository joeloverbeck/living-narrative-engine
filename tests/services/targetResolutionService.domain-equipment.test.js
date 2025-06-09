// src/tests/services/targetResolutionService.domain-equipment.test.js

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../src/actions/targeting/targetResolutionService.js';
import { ResolutionStatus } from '../../src/types/resolutionStatus.js';
import { getEntityIdsForScopes } from '../../src/entities/entityScopeService.js';
import Entity from '../../src/entities/entity.js'; // Import Entity if creating instances

// Constants used by the service
const EQUIPMENT_COMPONENT_ID = 'core:equipment';
const NAME_COMPONENT_ID = 'core:name';

// --- Mocks for Dependencies ---
let mockEntityManager;
let mockWorldContext;
let mockGameDataRepository;
let mockLogger;
// --- End Mocks ---

describe("TargetResolutionService - Domain 'equipment'", () => {
  let service;
  let mockActorEntity; // To be instantiated as an Entity

  const actionDefinition = {
    id: 'test:equip-action',
    target_domain: 'equipment',
  };

  // Helper to create mock item Entity instances
  const createMockItemEntity = (id, name) => {
    const item = new Entity(id, 'dummy');
    if (name !== undefined && name !== null) {
      item.addComponent(NAME_COMPONENT_ID, { text: name });
    }
    // For fallback tests, ensure .name property is set if component is missing
    if (
      name !== undefined &&
      name !== null &&
      !item.hasComponent(NAME_COMPONENT_ID)
    ) {
      item.name = name;
    }
    return item;
  };

  // Helper to create actionContext with correct structure
  const createActionContext = (
    nounPhraseValue,
    currentActingEntity = mockActorEntity
  ) => {
    return {
      actingEntity: currentActingEntity,
      parsedCommand: {
        directObjectPhrase: nounPhraseValue,
        actionId: actionDefinition.id,
        originalInput:
          typeof nounPhraseValue === 'string' ? nounPhraseValue : '',
        error: null,
        preposition: null,
        indirectObjectPhrase: null,
      },
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockGameDataRepository,
      logger: mockLogger,
      currentLocation: { id: 'mockRoomForEquipContext' }, // For _buildMinimalContextForScopes
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getEntitiesInLocation: jest.fn(),
    };
    mockWorldContext = {
      getLocationOfEntity: jest
        .fn()
        .mockReturnValue({ id: 'mockRoomForEquipContext' }), // For _buildMinimalContextForScopes
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
      getEntityIdsForScopes: getEntityIdsForScopes,
    };
    service = new TargetResolutionService(options);

    mockActorEntity = new Entity('actor1', 'dummy'); // Create a new Entity instance for actor
    // Ensure actor has the equipment component for most tests. Specific tests can override.
    mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, { slots: {} });

    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === 'actor1') return mockActorEntity;
      return undefined;
    });

    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.warn.mockClear();
  });

  // 5.1: No Equipment Component
  describe('5.1: No Equipment Component', () => {
    test('should return NOT_FOUND if actor has no equipment component', async () => {
      const actorWithoutEquip = new Entity('actorNoEquip', 'dummy');
      // actorWithoutEquip deliberately does not have EQUIPMENT_COMPONENT_ID
      const actionContext = createActionContext('sword', actorWithoutEquip);

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('You are not wearing or wielding anything.');
    });
  });

  // 5.2: Equipment Component Exists, No Slots / Empty Slots
  describe('5.2: Equipment Component Exists, No Slots / Empty Slots', () => {
    test('should return NOT_FOUND if equipment component has no slots property', async () => {
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {}); // No slots property
      const actionContext = createActionContext('helm');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe('You have nothing equipped.');
    });

    test('should return NOT_FOUND if equipment component has null slots', async () => {
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, { slots: null });
      const actionContext = createActionContext('helm');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe('You have nothing equipped.');
    });

    test('should return NOT_FOUND if equipment component has an empty slots object', async () => {
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, { slots: {} });
      const actionContext = createActionContext('helm');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe('You have nothing equipped.');
    });
  });

  // 5.3: Invalid itemId in a Slot
  describe('5.3: Invalid itemId in a Slot', () => {
    test('should skip invalid itemIds and log warnings, processing valid ones', async () => {
      const validItemEntity = createMockItemEntity('itemValid', 'Valid Helmet');
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {
        slots: {
          head: null, // Invalid
          hand: 'itemValid', // Valid
          feet: '', // Invalid
          neck: '  ', // Invalid (empty after trim, though getEntityIdsForScopes filters it)
          ring: 123, // Invalid (not a string ID, getEntityIdsForScopes filters it)
        },
      });
      mockEntityManager.getEntityInstance.mockImplementation((itemId) => {
        if (itemId === 'itemValid') return validItemEntity;
        if (itemId === 'actor1') return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('Valid Helmet'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      // entityScopeService._handleEquipment filters out non-string itemIds from slots
      // _gatherNameMatchCandidates then logs warnings for string IDs that are empty or don't resolve.
      // `null` and `123` are filtered by `entityScopeService`.
      // `''` and `'  '` are filtered by `entityScopeService`.
      // So, no warnings from _gatherNameMatchCandidates for these specific invalid types.
      // If there were other types of invalidities that passed getEntityIdsForScopes, they'd be logged.

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBe('itemValid');
    });
  });

  // 5.4: Equipped Item Entity Not Found by EntityManager
  describe('5.4: Equipped Item Entity Not Found by EntityManager', () => {
    test('should skip item if entityManager does not find it and log warning', async () => {
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {
        slots: { head: 'ghostHelmet' },
      });
      // Ensure getEntityInstance returns undefined for 'ghostHelmet'
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor1') return mockActorEntity;
        if (id === 'ghostHelmet') return undefined; // Specifically not found
        return undefined;
      });
      const actionContext = createActionContext('helmet'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "prepareNameMatchCandidates: Entity 'ghostHelmet' from equipment not found via entityManager. Skipping."
      );
      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe("You don't have anything like that equipped.");
    });
  });

  // 5.5: Equipped Item Entity Has No Name
  describe('5.5: Equipped Item Entity Has No Name', () => {
    test('should skip item if it has no name component or fallback name and log warning', async () => {
      const namelessItem = createMockItemEntity('namelessHelm', undefined); // No name
      namelessItem.name = undefined; // Ensure no fallback via .name property

      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {
        slots: { head: 'namelessHelm' },
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'namelessHelm') return namelessItem;
        if (id === 'actor1') return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('helmet'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "getEntityDisplayName: Entity 'namelessHelm' has no usable name from component or 'entity.name'. Falling back to entity ID."
      );
      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('You don\'t have "helmet" equipped.');
    });
  });

  // 5.6: No Noun Phrase Provided
  describe('5.6: No Noun Phrase Provided', () => {
    test('should return NONE status if no noun phrase is provided and items are equipped', async () => {
      const helmEntity = createMockItemEntity('ironHelm', 'Iron Helm');
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {
        slots: { head: 'ironHelm' },
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'ironHelm') return helmEntity;
        if (id === 'actor1') return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext(''); // Corrected context (empty noun phrase)

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NONE);
      expect(result.targetType).toBe('entity'); // TRS sets this for NONE in equipment domain
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('You need to specify which equipped item.');
    });
  });

  // 5.7: Unique Match
  describe('5.7: Unique Match', () => {
    test('should find a unique item by exact name', async () => {
      const helmEntity = createMockItemEntity('ironHelm', 'Iron Helm');
      const swordEntity = createMockItemEntity('steelSword', 'Steel Sword');
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {
        slots: { head: 'ironHelm', mainHand: 'steelSword' },
      });
      mockEntityManager.getEntityInstance.mockImplementation((itemId) => {
        if (itemId === 'ironHelm') return helmEntity;
        if (itemId === 'steelSword') return swordEntity;
        if (itemId === 'actor1') return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('Iron Helm'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBe('ironHelm');
      expect(result.error).toBeUndefined();
    });
  });

  // 5.8: Ambiguous Match
  describe('5.8: Ambiguous Match', () => {
    test('should return AMBIGUOUS if noun phrase matches multiple items', async () => {
      const goldRing = createMockItemEntity('goldRing', 'Gold Ring');
      const silverRing = createMockItemEntity('silverRing', 'Silver Ring');
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {
        slots: { finger1: 'goldRing', finger2: 'silverRing' },
      });
      mockEntityManager.getEntityInstance.mockImplementation((itemId) => {
        if (itemId === 'goldRing') return goldRing;
        if (itemId === 'silverRing') return silverRing;
        if (itemId === 'actor1') return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('ring'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.AMBIGUOUS);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBeNull();
      expect(result.candidates).toEqual(
        expect.arrayContaining(['goldRing', 'silverRing'])
      );
      expect(result.candidates.length).toBe(2);
      expect(result.error).toMatch(
        /Which item containing "ring" did you mean\? For example: "Gold Ring", "Silver Ring"/
      );
    });
  });

  // 5.9: No Match
  describe('5.9: No Match', () => {
    test('should return NOT_FOUND if noun phrase does not match any equipped item', async () => {
      const helmEntity = createMockItemEntity('ironHelm', 'Iron Helm');
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {
        slots: { head: 'ironHelm' },
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'ironHelm') return helmEntity;
        if (id === 'actor1') return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('Boots'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('You don\'t have "Boots" equipped.');
    });
  });

  // 5.10: All Equipped Items Invalid/No Name
  describe('5.10: All Equipped Items Invalid/No Name', () => {
    test('should return specific NOT_FOUND when all items are invalid or nameless', async () => {
      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {
        slots: {
          head: 'nonExistentHelm',
          hand: 'namelessSwordId',
        },
      });
      const namelessSword = createMockItemEntity('namelessSwordId', undefined); // No name
      namelessSword.name = undefined; // ensure no fallback

      mockEntityManager.getEntityInstance.mockImplementation((itemId) => {
        if (itemId === 'nonExistentHelm') return undefined;
        if (itemId === 'namelessSwordId') return namelessSword;
        if (itemId === 'actor1') return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('sword'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBe('namelessSwordId');
      expect(result.error).toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "prepareNameMatchCandidates: Entity 'nonExistentHelm' from equipment not found via entityManager. Skipping."
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `getEntityDisplayName: Entity 'namelessSwordId' has no usable name from component or 'entity.name'. Falling back to entity ID.`
      );
    });
  });

  describe('Fallback to entity.name for equipped item', () => {
    test('should use entity.name if NAME_COMPONENT_ID is missing for an equipped item', async () => {
      const helmWithFallbackName = new Entity('fallbackHelm', 'dummy');
      helmWithFallbackName.name = 'Fallback Helm Name'; // No core:name component, will use entity.name

      mockActorEntity.addComponent(EQUIPMENT_COMPONENT_ID, {
        slots: { head: 'fallbackHelm' },
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'fallbackHelm') return helmWithFallbackName;
        if (id === 'actor1') return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('Fallback Helm Name'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBe('fallbackHelm');
      expect(result.error).toBeUndefined();
      // getEntityDisplayName logging not expected because logger isn't passed
    });
  });
});
