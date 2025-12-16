/**
 * @file Integration tests for violence:actor_beak_body_parts scope
 * @description Tests that the actor_beak_body_parts scope properly returns body part
 * entity IDs where subType contains "beak" and has damage capabilities component.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const beakScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../data/mods/violence/scopes/actor_beak_body_parts.scope'
  ),
  'utf8'
);

jest.unmock('../../../../src/scopeDsl/scopeRegistry.js');

describe('Actor Beak Body Parts Scope Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;
  let dataRegistry;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);
    dataRegistry = new InMemoryDataRegistry({ logger });

    // Mock body graph service
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });
    // Create mock lighting state service
    const mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
      lightingStateService: mockLightingStateService,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Parse and register the scope
    const scopeDefinitions = parseScopeDefinitions(
      beakScopeContent,
      'actor_beak_body_parts.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'violence:actor_beak_body_parts': scopeDefinitions.get(
        'violence:actor_beak_body_parts'
      ),
    });

    scopeEngine = new ScopeEngine();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Helper to create an actor entity with anatomy:body component
   */
  function createActorWithBody(
    actorId,
    bodyData,
    locationId = 'test:location'
  ) {
    entityManager.addEntity({
      id: actorId,
      definitionId: 'test:actor',
      components: {
        'core:actor': {},
        'core:position': { locationId },
        'anatomy:body': bodyData,
      },
    });
    return entityManager.getEntityInstance(actorId);
  }

  /**
   * Helper to create a body part entity
   */
  function createBodyPart(partId, subType, hasDamageCapabilities = true) {
    const components = {
      'anatomy:part': {
        subType,
        hit_probability_weight: 2,
        health_calculation_weight: 1,
      },
      'anatomy:part_health': {
        currentHealth: 35,
        maxHealth: 35,
        state: 'healthy',
      },
      'core:name': { text: subType },
    };

    if (hasDamageCapabilities) {
      components['damage-types:damage_capabilities'] = {
        entries: [
          {
            name: 'piercing',
            amount: 15,
            penetration: 0.5,
          },
        ],
      };
    }

    entityManager.addEntity({
      id: partId,
      definitionId: 'anatomy:body_part',
      components,
    });
    return entityManager.getEntityInstance(partId);
  }

  /**
   * Helper to configure mock body graph service to return body parts
   */
  function setupMockBodyGraphService(bodyComponent, actorId, partIds) {
    mockBodyGraphService.getAllParts.mockImplementation(
      (bodyComp, entityId) => {
        if (entityId === actorId) {
          return partIds;
        }
        return [];
      }
    );
  }

  describe('Basic Scope Resolution', () => {
    it('should return body part entity ID when subType contains "beak" and has damage capabilities', () => {
      const actorId = 'test:bird-creature';
      const beakPartId = 'test:bird-creature:beak_part';

      // Create body part with beak subType and damage capabilities
      createBodyPart(beakPartId, 'beak', true);

      // Create body structure
      const bodyData = {
        body: {
          root: beakPartId,
          parts: {
            [beakPartId]: { children: [] },
          },
        },
      };

      // Create actor with body
      const actorEntity = createActorWithBody(actorId, bodyData);

      // Configure mock to return body parts
      setupMockBodyGraphService(bodyData, actorId, [beakPartId]);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has(beakPartId)).toBe(true);
    });

    it('should return empty set when actor has no beak body parts', () => {
      const actorId = 'test:human';
      const headPartId = 'test:human:head_part';
      const torsoPartId = 'test:human:torso_part';

      // Create body parts without beak subType
      createBodyPart(headPartId, 'head', true);
      createBodyPart(torsoPartId, 'torso', true);

      // Create body structure
      const bodyData = {
        body: {
          root: torsoPartId,
          parts: {
            [torsoPartId]: { children: [headPartId] },
            [headPartId]: { children: [] },
          },
        },
      };

      // Create actor with body
      const actorEntity = createActorWithBody(actorId, bodyData);

      // Configure mock to return body parts
      setupMockBodyGraphService(bodyData, actorId, [headPartId, torsoPartId]);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should return empty set when beak part lacks damage capabilities', () => {
      const actorId = 'test:passive-bird';
      const beakPartId = 'test:passive-bird:beak_part';

      // Create beak WITHOUT damage capabilities
      createBodyPart(beakPartId, 'beak', false);

      // Create body structure
      const bodyData = {
        body: {
          root: beakPartId,
          parts: {
            [beakPartId]: { children: [] },
          },
        },
      };

      // Create actor with body
      const actorEntity = createActorWithBody(actorId, bodyData);

      // Configure mock to return body parts
      setupMockBodyGraphService(bodyData, actorId, [beakPartId]);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('Substring Matching for Beak SubTypes', () => {
    it('should match subType "chicken_beak" containing "beak"', () => {
      const actorId = 'test:chicken';
      const beakPartId = 'test:chicken:chicken_beak_part';

      // Create body part with chicken_beak subType
      createBodyPart(beakPartId, 'chicken_beak', true);

      // Create body structure
      const bodyData = {
        body: {
          root: beakPartId,
          parts: {
            [beakPartId]: { children: [] },
          },
        },
      };

      // Create actor with body
      const actorEntity = createActorWithBody(actorId, bodyData);

      // Configure mock to return body parts
      setupMockBodyGraphService(bodyData, actorId, [beakPartId]);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has(beakPartId)).toBe(true);
    });

    it('should match subType "tortoise_beak" containing "beak"', () => {
      const actorId = 'test:tortoise';
      const beakPartId = 'test:tortoise:tortoise_beak_part';

      // Create body part with tortoise_beak subType
      createBodyPart(beakPartId, 'tortoise_beak', true);

      // Create body structure
      const bodyData = {
        body: {
          root: beakPartId,
          parts: {
            [beakPartId]: { children: [] },
          },
        },
      };

      // Create actor with body
      const actorEntity = createActorWithBody(actorId, bodyData);

      // Configure mock to return body parts
      setupMockBodyGraphService(bodyData, actorId, [beakPartId]);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has(beakPartId)).toBe(true);
    });

    it('should NOT match subType that does not contain "beak"', () => {
      const actorId = 'test:creature';
      const snoutPartId = 'test:creature:snout_part';

      // Create body part with snout subType (no beak)
      createBodyPart(snoutPartId, 'snout', true);

      // Create body structure
      const bodyData = {
        body: {
          root: snoutPartId,
          parts: {
            [snoutPartId]: { children: [] },
          },
        },
      };

      // Create actor with body
      const actorEntity = createActorWithBody(actorId, bodyData);

      // Configure mock to return body parts
      setupMockBodyGraphService(bodyData, actorId, [snoutPartId]);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('Multiple Body Parts', () => {
    it('should return only beak parts from actor with mixed body parts', () => {
      const actorId = 'test:griffin';
      const beakPartId = 'test:griffin:beak_part';
      const headPartId = 'test:griffin:head_part';
      const torsoPartId = 'test:griffin:torso_part';
      const clawPartId = 'test:griffin:claw_part';

      // Create multiple body parts
      createBodyPart(beakPartId, 'beak', true); // Should match
      createBodyPart(headPartId, 'head', true); // Should NOT match
      createBodyPart(torsoPartId, 'torso', true); // Should NOT match
      createBodyPart(clawPartId, 'claw', true); // Should NOT match

      // Create body structure
      const bodyData = {
        body: {
          root: torsoPartId,
          parts: {
            [torsoPartId]: { children: [headPartId] },
            [headPartId]: { children: [beakPartId] },
            [beakPartId]: { children: [] },
            [clawPartId]: { children: [] },
          },
        },
      };

      // Create actor with body
      const actorEntity = createActorWithBody(actorId, bodyData);

      // Configure mock to return all body parts
      setupMockBodyGraphService(bodyData, actorId, [
        beakPartId,
        headPartId,
        torsoPartId,
        clawPartId,
      ]);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has(beakPartId)).toBe(true);
      expect(result.has(headPartId)).toBe(false);
      expect(result.has(torsoPartId)).toBe(false);
      expect(result.has(clawPartId)).toBe(false);
    });

    it('should return multiple beaks when actor has multiple beak parts', () => {
      const actorId = 'test:hydra-bird';
      const beak1PartId = 'test:hydra-bird:beak_1_part';
      const beak2PartId = 'test:hydra-bird:beak_2_part';
      const head1PartId = 'test:hydra-bird:head_1_part';
      const head2PartId = 'test:hydra-bird:head_2_part';

      // Create multiple beak parts
      createBodyPart(beak1PartId, 'beak', true);
      createBodyPart(beak2PartId, 'chicken_beak', true);
      createBodyPart(head1PartId, 'head', true);
      createBodyPart(head2PartId, 'head', true);

      // Create body structure
      const bodyData = {
        body: {
          root: head1PartId,
          parts: {
            [head1PartId]: { children: [beak1PartId, head2PartId] },
            [beak1PartId]: { children: [] },
            [head2PartId]: { children: [beak2PartId] },
            [beak2PartId]: { children: [] },
          },
        },
      };

      // Create actor with body
      const actorEntity = createActorWithBody(actorId, bodyData);

      // Configure mock to return all body parts
      setupMockBodyGraphService(bodyData, actorId, [
        beak1PartId,
        beak2PartId,
        head1PartId,
        head2PartId,
      ]);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has(beak1PartId)).toBe(true);
      expect(result.has(beak2PartId)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should return empty set when actor has no anatomy:body component', () => {
      const actorId = 'test:ethereal';

      // Create actor WITHOUT anatomy:body component
      entityManager.addEntity({
        id: actorId,
        definitionId: 'test:actor',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'test:location' },
          // No anatomy:body
        },
      });

      const actorEntity = entityManager.getEntityInstance(actorId);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should handle empty body parts array gracefully', () => {
      const actorId = 'test:empty-body';

      // Create body structure with no parts
      const bodyData = {
        body: {
          root: null,
          parts: {},
        },
      };

      // Create actor with empty body
      const actorEntity = createActorWithBody(actorId, bodyData);

      // Configure mock to return empty array
      setupMockBodyGraphService(bodyData, actorId, []);

      // Set up runtime context
      const runtimeCtx = {
        entityManager,
        location: { id: 'test:location' },
        logger,
        jsonLogicEval,
        container: {
          resolve: (token) => {
            if (token === 'BodyGraphService') return mockBodyGraphService;
            return null;
          },
        },
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        scopeRegistry.getScopeAst('violence:actor_beak_body_parts'),
        actorEntity,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });
});
