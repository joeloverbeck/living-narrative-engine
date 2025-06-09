/**
 * @file This test suite proves the behavior of TargetResolutionService, when it comes to the "followers" domain.
 * @see tests/actions/targeting/targetResolutionService.domain-followers.test.js
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targeting/targetResolutionService.js';
import { ResolutionStatus } from '../../../src/types/resolutionStatus.js';
import { getEntityIdsForScopes } from '../../../src/entities/entityScopeService.js';
import Entity from '../../../src/entities/entity.js';

// --- Constants ---
const NAME_COMPONENT_ID = 'core:name';
const LEADING_COMPONENT_ID = 'core:leading';

// --- Mocks ---
let mockEntityManager;
let mockWorldContext;
let mockGameDataRepository;
let mockLogger;

describe("TargetResolutionService - Domain 'followers'", () => {
  let service;
  let mockActorEntity;
  const actionDefinition = {
    id: 'test:dismiss-action',
    target_domain: 'followers',
  };

  /**
   * Helper function to create a mock Entity instance for a follower.
   * @param {string} id - The entity ID.
   * @param {string} name - The display name for the entity.
   * @returns {Entity} A new Entity instance with a name component.
   */
  const createMockFollower = (id, name) => {
    const entity = new Entity(id, 'dummy-follower-def');
    entity.addComponent(NAME_COMPONENT_ID, { text: name });
    return entity;
  };

  /**
   * Helper function to create a standard action context for tests.
   * @param {string | null} nounPhrase - The direct object phrase from the parsed command.
   * @returns {object} A mock ActionContext object.
   */
  const createActionContext = (nounPhrase) => ({
    actingEntity: mockActorEntity,
    parsedCommand: {
      directObjectPhrase: nounPhrase,
      actionId: actionDefinition.id,
      originalInput: typeof nounPhrase === 'string' ? nounPhrase : '',
      error: null,
      preposition: null,
      indirectObjectPhrase: null,
    },
    entityManager: mockEntityManager,
    worldContext: mockWorldContext,
    gameDataRepository: mockGameDataRepository,
    logger: mockLogger,
    // --- CHANGE START ---
    // The Entity constructor requires a definitionId as the second argument.
    currentLocation: new Entity('location-irrelevant', 'dummy-location-def'), // Location is not needed for the 'followers' scope.
    // --- CHANGE END ---
  });

  beforeEach(() => {
    // Reset all mocks to ensure test isolation.
    jest.resetAllMocks();

    // Initialize mock dependencies.
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getEntitiesInLocation: jest.fn(), // Needed for constructor validation
    };
    mockWorldContext = {
      getLocationOfEntity: jest.fn(),
      getCurrentActor: jest.fn(), // Needed for constructor validation
      getCurrentLocation: jest.fn(), // Needed for constructor validation
    };
    mockGameDataRepository = {
      getActionDefinition: jest.fn(), // Needed for constructor validation
      getAllActionDefinitions: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    // Instantiate the service under test with mocked dependencies.
    service = new TargetResolutionService({
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockGameDataRepository,
      logger: mockLogger,
      getEntityIdsForScopes: getEntityIdsForScopes, // Use the real function, as we mock its underlying dependencies.
    });

    // Create a fresh mock actor for each test.
    mockActorEntity = new Entity('actor1', 'dummy-actor-def');
    mockActorEntity.addComponent(NAME_COMPONENT_ID, { text: 'Leader' });
  });

  describe('When actor has no followers', () => {
    test('should return NOT_FOUND if actor has no leading component', async () => {
      // By default, the mock actor has no 'core:leading' component.
      const context = createActionContext('Some Guy');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe('You have no follower named "Some Guy".');
    });

    test('should return NOT_FOUND if leading component has an empty followers array', async () => {
      mockActorEntity.addComponent(LEADING_COMPONENT_ID, { followers: [] });
      const context = createActionContext('Some Guy');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe('You have no follower named "Some Guy".');
    });

    test('should return NOT_FOUND with a specific message if nounPhrase is empty', async () => {
      mockActorEntity.addComponent(LEADING_COMPONENT_ID, { followers: [] });
      const context = createActionContext('');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('entity');
      expect(result.error).toBe("You don't have any followers.");
    });
  });

  describe('When actor has one follower', () => {
    let follower;

    beforeEach(() => {
      follower = createMockFollower('follower1', 'Zorb the Orc');
      mockActorEntity.addComponent(LEADING_COMPONENT_ID, {
        followers: [follower.id],
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === follower.id) return follower;
        if (id === mockActorEntity.id) return mockActorEntity;
        return undefined;
      });
    });

    test('should find the follower with an exact name match', async () => {
      const context = createActionContext('Zorb the Orc');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetType).toBe('entity');
      expect(result.targetId).toBe(follower.id);
      expect(result.error).toBeUndefined();
    });

    test('should find the follower with a partial (startsWith) name match', async () => {
      const context = createActionContext('Zorb');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetId).toBe(follower.id);
    });

    test('should return NOT_FOUND for a non-matching name', async () => {
      const context = createActionContext('Gorb');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.error).toBe('You don\'t have "Gorb" among your followers.');
    });

    test('should return NONE when no nounPhrase is provided, asking for specifics', async () => {
      const context = createActionContext('');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      expect(result.status).toBe(ResolutionStatus.NONE);
      expect(result.error).toBe('You need to specify which follower.');
    });
  });

  describe('When actor has multiple followers', () => {
    let follower1, follower2, follower3;

    beforeEach(() => {
      follower1 = createMockFollower('f1', 'Human Guard');
      follower2 = createMockFollower('f2', 'Orc Guard');
      follower3 = createMockFollower('f3', 'Elf Archer');
      mockActorEntity.addComponent(LEADING_COMPONENT_ID, {
        followers: [follower1.id, follower2.id, follower3.id],
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const followersMap = {
          [follower1.id]: follower1,
          [follower2.id]: follower2,
          [follower3.id]: follower3,
          [mockActorEntity.id]: mockActorEntity,
        };
        return followersMap[id];
      });
    });

    test('should find a unique follower among many with a unique partial name', async () => {
      const context = createActionContext('Elf');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetId).toBe(follower3.id);
    });

    test('should return AMBIGUOUS for a partial name matching multiple followers', async () => {
      const context = createActionContext('Guard');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      expect(result.status).toBe(ResolutionStatus.AMBIGUOUS);
      expect(result.targetId).toBeNull();
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates).toEqual(
        expect.arrayContaining([follower1.id, follower2.id])
      );
      expect(result.error).toMatch(
        /Which item containing "Guard" did you mean\? For example: "Human Guard", "Orc Guard"./
      );
    });
  });

  describe('Edge Cases', () => {
    test('should skip a follower if its ID is listed but the entity is not in EntityManager', async () => {
      const follower1 = createMockFollower('f1', 'Zorb');
      const ghostFollowerId = 'ghost';
      mockActorEntity.addComponent(LEADING_COMPONENT_ID, {
        followers: [follower1.id, ghostFollowerId],
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === follower1.id) return follower1;
        // 'ghost' ID will return undefined.
        return undefined;
      });

      const context = createActionContext('Zorb');
      const result = await service.resolveActionTarget(
        actionDefinition,
        context
      );

      // It should still find Zorb successfully, having skipped the ghost.
      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetId).toBe(follower1.id);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Entity '${ghostFollowerId}' from followers not found via entityManager. Skipping.`
        )
      );
    });
  });
});
