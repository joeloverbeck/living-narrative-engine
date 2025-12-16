/**
 * @file Integration tests for nuzzle_penis_through_clothing action discovery
 * @description Tests the complete action discovery pipeline for the nuzzle_penis_through_clothing action
 * This tests that the action is correctly discovered when all conditions are met:
 * - Actor is kneeling before target
 * - Target has a covered penis (clothing present)
 * - Both are in closeness positioning
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import fs from 'fs';
import path from 'path';

// Import actual action and scope files
import nuzzlePenisThroughClothingAction from '../../../data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing.action.json';
const nuzzlePenisScopeContent = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'data/mods/sex-core/scopes/actor_kneeling_before_target_with_covered_penis.scope'
  ),
  'utf8'
);

describe('Nuzzle Penis Through Clothing Action Discovery Integration Tests', () => {
  let entityManager;
  let logger;
  let dataRegistry;
  let mockBodyGraphService;
  let scopeEngine;
  let scopeRegistry;
  let jsonLogicEval;

  beforeEach(() => {
    // Create minimal mocks for external dependencies only
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create real entity manager
    entityManager = new SimpleEntityManager([]);

    // Mock only the body graph service (external dependency)
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    // Create real data registry and register actions
    dataRegistry = new InMemoryDataRegistry({ logger });
    dataRegistry.store(
      'actions',
      nuzzlePenisThroughClothingAction.id,
      nuzzlePenisThroughClothingAction
    );

    // Create mock lighting state service
    const mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    // Create real JSON Logic operators and evaluation service
    const jsonLogicCustomOperators = new JsonLogicCustomOperators({
      entityManager,
      bodyGraphService: mockBodyGraphService,
      logger,
      dataRegistry,
      lightingStateService: mockLightingStateService,
    });

    jsonLogicEval = new JsonLogicEvaluationService({
      customOperators: jsonLogicCustomOperators,
      logger,
    });

    // Register the custom operators with JsonLogic
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Create real scope system
    scopeRegistry = new ScopeRegistry();

    // Register actual scope definitions
    const scopeDefinitionsMap = parseScopeDefinitions(nuzzlePenisScopeContent);
    // Convert Map to object for initialize method
    const scopeDefinitions = Object.fromEntries(scopeDefinitionsMap);
    scopeRegistry.initialize(scopeDefinitions);

    scopeEngine = new ScopeEngine({
      registry: scopeRegistry,
      logger,
      entityManager,
      jsonLogic: jsonLogicEval,
    });
  });

  describe('Nuzzle Penis Through Clothing Action - Scope Evaluation', () => {
    it('should correctly evaluate scope when all conditions are met', () => {
      // Arrange
      const actorId = 'test:actor';
      const targetId = 'test:target';

      // Setup entities with all required conditions
      entityManager.setEntities([
        {
          id: actorId,
          components: {
            'positioning:closeness': { partners: [targetId] },
            'positioning:kneeling_before': { entityId: targetId },
          },
        },
        {
          id: targetId,
          components: {
            'core:position': { locationId: 'test:location' },
            'anatomy:body': { root: `${targetId}_root` },
            'clothing:slot_metadata': {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis'],
                },
              },
            },
            'clothing:equipment': {
              equipped: {
                lower_body: {
                  base: ['underwear'], // Has clothing = covered
                },
              },
            },
          },
        },
      ]);

      // Mock body graph service to indicate target has penis
      mockBodyGraphService.findPartsByType.mockReturnValue([
        { type: 'penis', id: 'penis_1' },
      ]);

      // Act
      const context = { actor: actorId };
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_covered_penis'
      );
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        jsonLogicEval,
        entityManager,
        logger,
      });

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.has(targetId)).toBe(true);
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        `${targetId}_root`,
        'penis'
      );
    });

    it('should return empty when target penis is uncovered', () => {
      // Arrange
      const actorId = 'test:actor';
      const targetId = 'test:target';

      entityManager.setEntities([
        {
          id: actorId,
          components: {
            'positioning:closeness': { partners: [targetId] },
            'positioning:kneeling_before': { entityId: targetId },
          },
        },
        {
          id: targetId,
          components: {
            'core:position': { locationId: 'test:location' },
            'anatomy:body': { root: `${targetId}_root` },
            'clothing:slot_metadata': {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis'],
                },
              },
            },
            'clothing:equipment': {
              equipped: {
                lower_body: {}, // Empty = uncovered
              },
            },
          },
        },
      ]);

      // Mock body graph service to indicate target has penis
      mockBodyGraphService.findPartsByType.mockReturnValue([
        { type: 'penis', id: 'penis_1' },
      ]);

      // Act
      const context = { actor: actorId };
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_covered_penis'
      );
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        jsonLogicEval,
        entityManager,
        logger,
      });

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should return empty when actor is not kneeling before target', () => {
      // Arrange
      const actorId = 'test:actor';
      const targetId = 'test:target';

      entityManager.setEntities([
        {
          id: actorId,
          components: {
            'positioning:closeness': { partners: [targetId] },
            // No kneeling_before component
          },
        },
        {
          id: targetId,
          components: {
            'core:position': { locationId: 'test:location' },
            'anatomy:body': { root: `${targetId}_root` },
            'clothing:slot_metadata': {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis'],
                },
              },
            },
            'clothing:equipment': {
              equipped: {
                lower_body: {
                  base: ['underwear'], // Has clothing = covered
                },
              },
            },
          },
        },
      ]);

      // Mock body graph service to indicate target has penis
      mockBodyGraphService.findPartsByType.mockReturnValue([
        { type: 'penis', id: 'penis_1' },
      ]);

      // Act
      const context = { actor: actorId };
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_covered_penis'
      );
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        jsonLogicEval,
        entityManager,
        logger,
      });

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should return empty when target has no penis', () => {
      // Arrange
      const actorId = 'test:actor';
      const targetId = 'test:target';

      entityManager.setEntities([
        {
          id: actorId,
          components: {
            'positioning:closeness': { partners: [targetId] },
            'positioning:kneeling_before': { entityId: targetId },
          },
        },
        {
          id: targetId,
          components: {
            'core:position': { locationId: 'test:location' },
            'anatomy:body': { root: `${targetId}_root` },
            'clothing:slot_metadata': {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis'],
                },
              },
            },
            'clothing:equipment': {
              equipped: {
                lower_body: {
                  base: ['underwear'], // Has clothing = covered
                },
              },
            },
          },
        },
      ]);

      // Mock body graph service to indicate target has no penis
      mockBodyGraphService.findPartsByType.mockReturnValue([]); // No penis parts

      // Act
      const context = { actor: actorId };
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_covered_penis'
      );
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        jsonLogicEval,
        entityManager,
        logger,
      });

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should return empty when actor is kneeling before different target', () => {
      // Arrange
      const actorId = 'test:actor';
      const targetId = 'test:target';
      const otherTargetId = 'test:other';

      entityManager.setEntities([
        {
          id: actorId,
          components: {
            'positioning:closeness': { partners: [targetId, otherTargetId] },
            'positioning:kneeling_before': { entityId: otherTargetId }, // Kneeling before other
          },
        },
        {
          id: targetId,
          components: {
            'core:position': { locationId: 'test:location' },
            'anatomy:body': { root: `${targetId}_root` },
            'clothing:slot_metadata': {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis'],
                },
              },
            },
            'clothing:equipment': {
              equipped: {
                lower_body: {
                  base: ['underwear'], // Has clothing = covered
                },
              },
            },
          },
        },
        {
          id: otherTargetId,
          components: {
            'core:position': { locationId: 'test:location' },
          },
        },
      ]);

      // Mock body graph service for target
      mockBodyGraphService.findPartsByType.mockReturnValue([
        { type: 'penis', id: 'penis_1' },
      ]);

      // Act
      const context = { actor: actorId };
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_covered_penis'
      );
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        jsonLogicEval,
        entityManager,
        logger,
      });

      // Assert - should not include targetId since actor is kneeling before otherTargetId
      expect(result).toBeInstanceOf(Set);
      expect(result.has(targetId)).toBe(false);
    });

    it('should handle multiple targets in closeness correctly', () => {
      // Arrange
      const actorId = 'test:actor';
      const target1Id = 'test:target1';
      const target2Id = 'test:target2';

      entityManager.setEntities([
        {
          id: actorId,
          components: {
            'positioning:closeness': { partners: [target1Id, target2Id] },
            'positioning:kneeling_before': { entityId: target1Id }, // Only kneeling before target1
          },
        },
        {
          id: target1Id,
          components: {
            'core:position': { locationId: 'test:location' },
            'anatomy:body': { root: `${target1Id}_root` },
            'clothing:slot_metadata': {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis'],
                },
              },
            },
            'clothing:equipment': {
              equipped: {
                lower_body: {
                  base: ['underwear'], // Has clothing = covered
                },
              },
            },
          },
        },
        {
          id: target2Id,
          components: {
            'core:position': { locationId: 'test:location' },
            'anatomy:body': { root: `${target2Id}_root` },
            'clothing:slot_metadata': {
              slotMappings: {
                lower_body: {
                  coveredSockets: ['penis'],
                },
              },
            },
            'clothing:equipment': {
              equipped: {
                lower_body: {
                  base: ['underwear'], // Has clothing = covered
                },
              },
            },
          },
        },
      ]);

      // Mock body graph service for both targets
      mockBodyGraphService.findPartsByType.mockReturnValue([
        { type: 'penis', id: 'penis_1' },
      ]);

      // Act
      const context = { actor: actorId };
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_covered_penis'
      );
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        jsonLogicEval,
        entityManager,
        logger,
      });

      // Assert - only target1 should be in result since actor is kneeling before target1
      expect(result).toBeInstanceOf(Set);
      expect(result.has(target1Id)).toBe(true);
      expect(result.has(target2Id)).toBe(false);
    });
  });
});
