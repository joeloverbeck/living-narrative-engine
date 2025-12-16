/**
 * @file Integration tests for sex action discovery
 * @description Tests the complete action discovery pipeline for sex-related actions
 * This is a simplified integration test that tests the core flow
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
import pumpPenisFromUpCloseAction from '../../../data/mods/sex-penile-manual/actions/pump_penis_from_up_close.action.json';
const pumpPenisScopeContent = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'data/mods/sex-core/scopes/actor_kneeling_before_target_with_penis.scope'
  ),
  'utf8'
);

describe('Sex Action Discovery Integration Tests', () => {
  let entityManager;
  let logger;
  let dataRegistry;
  let mockBodyGraphService;
  let scopeEngine;
  let scopeRegistry;
  let jsonLogicEval;
  let mockLightingStateService;

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

    mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    // Create real data registry and register actions
    dataRegistry = new InMemoryDataRegistry({ logger });
    dataRegistry.store(
      'actions',
      pumpPenisFromUpCloseAction.id,
      pumpPenisFromUpCloseAction
    );

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
    const scopeDefinitionsMap = parseScopeDefinitions(pumpPenisScopeContent);
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

  describe('Pump Penis From Up Close Action - Scope Evaluation', () => {
    it('should correctly evaluate scope when all conditions are met', () => {
      // Arrange
      const actorId = 'test:actor';
      const targetId = 'test:target';

      // Set up entities with all required components
      entityManager.addComponent(actorId, 'positioning:closeness', {
        partners: [targetId],
      });
      entityManager.addComponent(actorId, 'positioning:kneeling_before', {
        entityId: targetId,
      });

      entityManager.addComponent(targetId, 'positioning:closeness', {
        partners: [actorId],
      });
      entityManager.addComponent(targetId, 'anatomy:body', {
        root: `${targetId}_root`,
      });
      entityManager.addComponent(targetId, 'clothing:slot_metadata', {
        slotMappings: {
          lower_body: {
            coveredSockets: ['penis'],
          },
        },
      });
      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          lower_body: {}, // Empty = uncovered
        },
      });

      // Mock body graph service - target has uncovered penis
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === `${targetId}_root` && partType === 'penis') {
            return [{ type: 'penis', id: 'penis_1' }];
          }
          return [];
        }
      );

      // Get actor entity
      const actorEntity = entityManager.getEntityInstance(actorId);

      // Act - Evaluate the scope
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_penis'
      );

      // Debug: Check if scope was found
      expect(scopeDef).toBeDefined();
      expect(scopeDef.ast).toBeDefined();

      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        entityManager,
        jsonLogicEval,
        logger,
      });

      // Assert
      expect(result.size).toBe(1);
      expect(result.has(targetId)).toBe(true);
    });

    it('should return empty when actor is not kneeling', () => {
      // Arrange
      const actorId = 'test:actor';
      const targetId = 'test:target';

      // Set up entities WITHOUT kneeling_before
      entityManager.addComponent(actorId, 'positioning:closeness', {
        partners: [targetId],
      });
      // NO kneeling_before component

      entityManager.addComponent(targetId, 'positioning:closeness', {
        partners: [actorId],
      });
      entityManager.addComponent(targetId, 'anatomy:body', {
        root: `${targetId}_root`,
      });
      entityManager.addComponent(targetId, 'clothing:slot_metadata', {
        slotMappings: {
          lower_body: {
            coveredSockets: ['penis'],
          },
        },
      });
      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          lower_body: {},
        },
      });

      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === `${targetId}_root` && partType === 'penis') {
            return [{ type: 'penis', id: 'penis_1' }];
          }
          return [];
        }
      );

      // Get actor entity
      const actorEntity = entityManager.getEntityInstance(actorId);

      // Act
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_penis'
      );
      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        entityManager,
        jsonLogicEval,
        logger,
      });

      // Assert
      expect(result.size).toBe(0);
    });

    it('should return empty when penis is covered', () => {
      // Arrange
      const actorId = 'test:actor';
      const targetId = 'test:target';

      entityManager.addComponent(actorId, 'positioning:closeness', {
        partners: [targetId],
      });
      entityManager.addComponent(actorId, 'positioning:kneeling_before', {
        entityId: targetId,
      });

      entityManager.addComponent(targetId, 'positioning:closeness', {
        partners: [actorId],
      });
      entityManager.addComponent(targetId, 'anatomy:body', {
        root: `${targetId}_root`,
      });
      entityManager.addComponent(targetId, 'clothing:slot_metadata', {
        slotMappings: {
          lower_body: {
            coveredSockets: ['penis'],
          },
        },
      });
      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          lower_body: {
            base: ['underwear'], // Has clothing = covered
          },
        },
      });

      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === `${targetId}_root` && partType === 'penis') {
            return [{ type: 'penis', id: 'penis_1' }];
          }
          return [];
        }
      );

      // Get actor entity
      const actorEntity = entityManager.getEntityInstance(actorId);

      // Act
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_penis'
      );
      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        entityManager,
        jsonLogicEval,
        logger,
      });

      // Assert
      expect(result.size).toBe(0);
    });

    it('should return empty when target has no penis', () => {
      // Arrange
      const actorId = 'test:actor';
      const targetId = 'test:target';

      entityManager.addComponent(actorId, 'positioning:closeness', {
        partners: [targetId],
      });
      entityManager.addComponent(actorId, 'positioning:kneeling_before', {
        entityId: targetId,
      });

      entityManager.addComponent(targetId, 'positioning:closeness', {
        partners: [actorId],
      });
      entityManager.addComponent(targetId, 'anatomy:body', {
        root: `${targetId}_root`,
      });
      entityManager.addComponent(targetId, 'clothing:slot_metadata', {
        slotMappings: {
          lower_body: {
            coveredSockets: ['penis'],
          },
        },
      });
      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          lower_body: {},
        },
      });

      // Mock body graph service - target has NO penis
      mockBodyGraphService.findPartsByType.mockReturnValue([]);

      // Get actor entity
      const actorEntity = entityManager.getEntityInstance(actorId);

      // Act
      const scopeDef = scopeRegistry.getScope(
        'sex-core:actor_kneeling_before_target_with_penis'
      );
      const result = scopeEngine.resolve(scopeDef.ast, actorEntity, {
        entityManager,
        jsonLogicEval,
        logger,
      });

      // Assert
      expect(result.size).toBe(0);
    });
  });
});
