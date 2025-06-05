// src/tests/services/targetResolutionService.domain-environment.test.js

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../src/actions/targeting/targetResolutionService.js';
import { ResolutionStatus } from '../../src/types/resolutionStatus.js';
import { getEntityIdsForScopes } from '../../src/entities/entityScopeService.js';
import Entity from '../../src/entities/entity.js'; // Available if complex mocks are needed

// Constants used by the service
const NAME_COMPONENT_ID = 'core:name';

// --- Mocks for Dependencies ---
let mockEntityManager;
let mockWorldContext;
let mockGameDataRepository;
let mockLogger;
// --- End Mocks ---

describe("TargetResolutionService - Domain 'environment'", () => {
  let service;
  let mockActorEntity; // Will be an Entity instance
  let mockLocationEntity; // Will be an Entity instance

  const actionDefinition = {
    id: 'test:look-action',
    target_domain: 'environment',
  };

  // Helper to create mock Entity instances for items/NPCs
  const createMockEnvEntity = (id, name) => {
    const entity = new Entity(id, 'dummy');
    if (name !== undefined && name !== null) {
      entity.addComponent(NAME_COMPONENT_ID, { text: name });
    }
    // For fallback tests, ensure .name property is set if component is missing
    if (
      name !== undefined &&
      name !== null &&
      !entity.hasComponent(NAME_COMPONENT_ID)
    ) {
      entity.name = name;
    }
    return entity;
  };

  // Helper to create actionContext with correct structure
  const createActionContext = (
    nounPhraseValue,
    currentActingEntity = mockActorEntity,
    currentMockLocation = mockLocationEntity
  ) => {
    // Ensure actingEntity and currentLocation are part of the context for TRS and entityScopeService
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
      currentLocation: currentMockLocation, // Used by entityScopeService's _handleLocation
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getEntitiesInLocation: jest.fn(),
    };
    mockWorldContext = {
      getLocationOfEntity: jest.fn(),
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

    mockActorEntity = new Entity('actor1', 'dummy');
    mockActorEntity.addComponent(NAME_COMPONENT_ID, { text: 'Actor Name' });

    mockLocationEntity = new Entity('location1', 'dummy');

    mockWorldContext.getLocationOfEntity.mockReturnValue(mockLocationEntity);
    // Default: actor is in mockLocationEntity. entityManager should return it.
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === 'actor1') return mockActorEntity;
      if (id === 'location1') return mockLocationEntity;
      return undefined;
    });
  });

  // 6.1: Actor Location Not Found
  describe('6.1: Actor Location Not Found', () => {
    test('should return ERROR if actor location cannot be determined', async () => {
      mockWorldContext.getLocationOfEntity.mockReturnValue(undefined);
      const actionContext = createActionContext('something');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.ERROR);
      expect(result.targetType).toBe('none');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe(
        'Internal error: Cannot determine your current location.'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `TargetResolutionService.#_resolveEnvironment: Actor '${mockActorEntity.id}' has no valid location according to worldContext (checked via minimalContext).`
      );
    });

    test('should return ERROR if actor location entity has no ID', async () => {
      const locationWithoutId = { name: 'Some Location Without ID' }; // No .id property
      mockWorldContext.getLocationOfEntity.mockReturnValue(locationWithoutId);
      const actionContext = createActionContext('something');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.ERROR);
      expect(result.error).toBe(
        'Internal error: Cannot determine your current location.'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `TargetResolutionService.#_resolveEnvironment: Actor '${mockActorEntity.id}' is in a location entity that has no ID (via minimalContext). Location data: ${JSON.stringify(locationWithoutId)}`
      );
    });
  });

  // 6.2: No Entities in Location (Besides potentially actor)
  describe('6.2: No Entities in Location (Besides actor)', () => {
    describe('6.2.1: nounPhrase empty', () => {
      test('should return NOT_FOUND with "There is nothing here." if location is empty', async () => {
        mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set()); // Location is empty
        const actionContext = createActionContext(''); // Empty nounPhrase

        const result = await service.resolveActionTarget(
          actionDefinition,
          actionContext
        );

        expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
        expect(result.targetType).toBe('none'); // Because nounPhrase is empty
        expect(result.targetId).toBeNull();
        expect(result.error).toBe('There is nothing here.');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `TargetResolutionService.#_resolveEnvironment: No entities (excluding actor) found in location '${mockLocationEntity.id}' via scope 'location'.`
        );
      });

      test('should return NOT_FOUND with "There is nothing here." if location only contains the actor', async () => {
        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([mockActorEntity.id])
        );
        const actionContext = createActionContext(''); // Empty nounPhrase

        const result = await service.resolveActionTarget(
          actionDefinition,
          actionContext
        );

        expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
        expect(result.targetType).toBe('none');
        expect(result.targetId).toBeNull();
        expect(result.error).toBe('There is nothing here.');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `TargetResolutionService.#_resolveEnvironment: No entities (excluding actor) found in location '${mockLocationEntity.id}' via scope 'location'.`
        );
      });
    });

    describe('6.2.2: nounPhrase "foo"', () => {
      test('should return NOT_FOUND with "You don\'t see any "foo" here." if location is empty', async () => {
        mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set());
        const actionContext = createActionContext('foo'); // Corrected context

        const result = await service.resolveActionTarget(
          actionDefinition,
          actionContext
        );

        expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
        expect(result.targetType).toBe('entity'); // Because nounPhrase is specific
        expect(result.targetId).toBeNull();
        expect(result.error).toBe('You don\'t see any "foo" here.');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `TargetResolutionService.#_resolveEnvironment: No entities (excluding actor) found in location '${mockLocationEntity.id}' via scope 'location'.`
        );
      });

      test('should return NOT_FOUND with "You don\'t see any "foo" here." if location only contains the actor', async () => {
        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([mockActorEntity.id])
        );
        const actionContext = createActionContext('foo'); // Corrected context

        const result = await service.resolveActionTarget(
          actionDefinition,
          actionContext
        );

        expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
        expect(result.targetType).toBe('entity');
        expect(result.targetId).toBeNull();
        expect(result.error).toBe('You don\'t see any "foo" here.');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `TargetResolutionService.#_resolveEnvironment: No entities (excluding actor) found in location '${mockLocationEntity.id}' via scope 'location'.`
        );
      });
    });
  });

  // 6.3: Entity in Location Not Found by EntityManager
  describe('6.3: Entity in Location Not Found by EntityManager', () => {
    test('should skip entity, log, and return NOT_FOUND if entity is not found by EntityManager', async () => {
      const ghostEntityId = 'ghostEntity';
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([ghostEntityId, mockActorEntity.id])
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === mockActorEntity.id) return mockActorEntity;
        if (id === ghostEntityId) return undefined; // Not found by EM
        return undefined;
      });
      const actionContext = createActionContext('ghost'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe('You don\'t see any "ghost" here.');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `TargetResolutionService.#_resolveEnvironment: No valid targetable candidates (excluding actor, with names) found in location '${mockLocationEntity.id}' from 1 IDs from scope.`
      );
    });
  });

  // 6.4: Entity in Location Has No Name
  describe('6.4: Entity in Location Has No Name', () => {
    test('should skip entity, log, and return NOT_FOUND if entity has no name', async () => {
      const namelessEntity = createMockEnvEntity('namelessThing', undefined); // No name
      namelessEntity.name = undefined; // ensure no entity.name fallback
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([namelessEntity.id, mockActorEntity.id])
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === mockActorEntity.id) return mockActorEntity;
        if (id === namelessEntity.id) return namelessEntity;
        return undefined;
      });
      const actionContext = createActionContext('thing'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `EntityUtils.getEntityDisplayName: Entity '${namelessEntity.id}' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`
      );
      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe('You don\'t see any "thing" here.'); // Because candidates list becomes empty
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `TargetResolutionService.#_resolveEnvironment: No valid targetable candidates (excluding actor, with names) found in location '${mockLocationEntity.id}' from 1 IDs from scope.`
      );
    });
  });

  // 6.5: Actor Itself Skipped as Candidate
  describe('6.5: Actor Itself Skipped as Candidate', () => {
    test("should skip actor and not match if nounPhrase is actor's name", async () => {
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([mockActorEntity.id])
      );
      // mockEntityManager.getEntityInstance for actor is already set up in beforeEach

      const actionContext = createActionContext('Actor Name'); // Corrected context
      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `TargetResolutionService.#_resolveEnvironment: No entities (excluding actor) found in location '${mockLocationEntity.id}' via scope 'location'.`
      );
      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe('You don\'t see any "Actor Name" here.');
    });
  });

  // 6.6: No Noun Phrase Provided (entities exist)
  describe('6.6: No Noun Phrase Provided (entities exist)', () => {
    test('should return NONE with "You need to specify which item here."', async () => {
      const goblinEntity = createMockEnvEntity('goblin1', 'Goblin');
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([goblinEntity.id, mockActorEntity.id])
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === goblinEntity.id) return goblinEntity;
        if (id === mockActorEntity.id) return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext(''); // Corrected context (empty string)

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NONE);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('You need to specify which item here.');
    });
  });

  // 6.7: Unique Match
  describe('6.7: Unique Match', () => {
    test('should find a unique entity by exact name ("Goblin Guard")', async () => {
      const goblinGuardEntity = createMockEnvEntity(
        'goblinGuard1',
        'Goblin Guard'
      );
      const orcEntity = createMockEnvEntity('orc1', 'Orc Peon');
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([goblinGuardEntity.id, orcEntity.id, mockActorEntity.id])
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === goblinGuardEntity.id) return goblinGuardEntity;
        if (id === orcEntity.id) return orcEntity;
        if (id === mockActorEntity.id) return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('Goblin Guard'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBe(goblinGuardEntity.id);
      expect(result.error).toBeUndefined();
    });
  });

  // 6.8: Ambiguous Match
  describe('6.8: Ambiguous Match', () => {
    test('should return AMBIGUOUS for "chest" with "Wooden Chest" and "Iron Chest"', async () => {
      const woodenChestEntity = createMockEnvEntity(
        'woodChest',
        'Wooden Chest'
      );
      const ironChestEntity = createMockEnvEntity('ironChest', 'Iron Chest');
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([woodenChestEntity.id, ironChestEntity.id, mockActorEntity.id])
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === woodenChestEntity.id) return woodenChestEntity;
        if (id === ironChestEntity.id) return ironChestEntity;
        if (id === mockActorEntity.id) return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('chest'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.AMBIGUOUS);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBeNull();
      expect(result.candidates).toEqual(
        expect.arrayContaining([woodenChestEntity.id, ironChestEntity.id])
      );
      expect(result.candidates.length).toBe(2);
      expect(result.error).toMatch(
        /Which item containing "chest" did you mean\? For example: "Wooden Chest", "Iron Chest"./
      );
    });
  });

  // 6.9: No Match (entities exist)
  describe('6.9: No Match (entities exist)', () => {
    test('should return NOT_FOUND for "Dragon" when other entities are present', async () => {
      const goblinEntity = createMockEnvEntity('goblin1', 'Goblin');
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([goblinEntity.id, mockActorEntity.id])
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === goblinEntity.id) return goblinEntity;
        if (id === mockActorEntity.id) return mockActorEntity;
        return undefined;
      });
      const actionContext = createActionContext('Dragon'); // Corrected context

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('You don\'t see "Dragon" here.');
    });
  });

  // 6.10: No Valid Targetable Candidates Found
  describe('6.10: No Valid Targetable Candidates Found (excluding actor, with names)', () => {
    const unfindableEntityId = 'unfindable';
    const namelessEntity = createMockEnvEntity('namelessEnvEntity', undefined); // No name
    namelessEntity.name = undefined; // Ensure no entity.name fallback

    beforeEach(() => {
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([mockActorEntity.id, unfindableEntityId, namelessEntity.id])
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === mockActorEntity.id) return mockActorEntity;
        if (id === unfindableEntityId) return undefined;
        if (id === namelessEntity.id) return namelessEntity;
        return undefined;
      });
    });

    describe('6.10.1: nounPhrase empty', () => {
      test('should return NOT_FOUND with "There is nothing else of interest here."', async () => {
        const actionContext = createActionContext(''); // Corrected context
        const result = await service.resolveActionTarget(
          actionDefinition,
          actionContext
        );

        expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
        expect(result.targetType).toBe('none'); // Because nounPhrase is empty
        expect(result.targetId).toBeNull();
        expect(result.error).toBe('There is nothing else of interest here.');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `TargetResolutionService.#_resolveEnvironment: No valid targetable candidates (excluding actor, with names) found in location '${mockLocationEntity.id}' from 2 IDs from scope.`
        );
      });
    });

    describe('6.10.2: nounPhrase "foo"', () => {
      test('should return NOT_FOUND with "You don\'t see any "foo" here."', async () => {
        const actionContext = createActionContext('foo'); // Corrected context
        const result = await service.resolveActionTarget(
          actionDefinition,
          actionContext
        );

        expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
        expect(result.targetType).toBe('entity'); // Because nounPhrase is specific
        expect(result.targetId).toBeNull();
        expect(result.error).toBe('You don\'t see any "foo" here.');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `TargetResolutionService.#_resolveEnvironment: No valid targetable candidates (excluding actor, with names) found in location '${mockLocationEntity.id}' from 2 IDs from scope.`
        );
      });
    });
  });

  describe('Entity name fallback in environment', () => {
    test('should use entity.name if NAME_COMPONENT_ID is missing for an environment entity', async () => {
      const itemWithFallbackName = new Entity('fallbackItemEnv', 'dummy');
      itemWithFallbackName.name = 'Fallback Item from Environment'; // This will be used
      // No core:name component added to itemWithFallbackName

      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([itemWithFallbackName.id, mockActorEntity.id])
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === itemWithFallbackName.id) return itemWithFallbackName;
        if (id === mockActorEntity.id) return mockActorEntity;
        return undefined;
      });

      const actionContext = createActionContext(
        'Fallback Item from Environment'
      ); // Corrected context
      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBe(itemWithFallbackName.id);
      expect(result.error).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `EntityUtils.getEntityDisplayName: Entity '${itemWithFallbackName.id}' using fallback entity.name property ('${itemWithFallbackName.name}') as '${NAME_COMPONENT_ID}' was not found or invalid.`
      );
    });
  });
});
