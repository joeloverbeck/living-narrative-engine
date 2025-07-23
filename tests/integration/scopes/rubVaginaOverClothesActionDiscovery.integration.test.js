/**
 * @file Integration tests for rub_vagina_over_clothes action discovery with socket coverage
 * @description Tests that the actors_with_vagina_facing_each_other_covered scope properly filters
 * actors based on vagina socket coverage (covered vs uncovered), facing direction, and closeness
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const vaginaCoveredScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex/scopes/actors_with_vagina_facing_each_other_covered.scope'
  ),
  'utf8'
);

// Import actual action file
import rubVaginaOverClothesAction from '../../../data/mods/sex/actions/rub_vagina_over_clothes.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Rub Vagina Over Clothes Action Discovery Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;
  let safeEventDispatcher;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);

    // Mock body graph service for custom operators
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    const dataRegistry = new InMemoryDataRegistry({ logger });

    // Store the action
    dataRegistry.store(
      'actions',
      rubVaginaOverClothesAction.id,
      rubVaginaOverClothesAction
    );

    // Store the condition
    dataRegistry.store('conditions', 'intimacy:entity-not-in-facing-away', {
      id: 'intimacy:entity-not-in-facing-away',
      logic: {
        not: {
          in: [
            { var: 'actor.id' },
            { var: 'entity.components.intimacy:closeness.facing_away_from' },
          ],
        },
      },
    });

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Parse and register the scope
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      vaginaCoveredScopeContent,
      'actors_with_vagina_facing_each_other_covered.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex:actors_with_vagina_facing_each_other_covered': scopeDefinitions.get(
        'sex:actors_with_vagina_facing_each_other_covered'
      ),
    });

    scopeEngine = new ScopeEngine();
    const prerequisiteEvaluationService = {
      evaluateActionConditions: jest.fn().mockResolvedValue({
        success: true,
        errors: [],
      }),
    };

    const targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry,
      scopeEngine,
      jsonLogicEvaluationService: jsonLogicEval,
      entityManager,
      logger,
    });

    const gameDataRepository = {
      getAllActionDefinitions: jest
        .fn()
        .mockReturnValue([rubVaginaOverClothesAction]),
      get: jest.fn((type, id) => dataRegistry.get(type, id)),
    };

    safeEventDispatcher = new SafeEventDispatcher({
      logger,
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      },
    });
    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: {
        getCandidateActions: jest
          .fn()
          .mockImplementation(() =>
            gameDataRepository.getAllActionDefinitions()
          ),
      },
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: new ActionCommandFormatter(),
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
    });

    actionDiscoveryService = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('socket coverage tests', () => {
    /**
     * Sets up test entities with optional clothing configuration
     *
     * @param {object} targetClothingConfig - Clothing configuration for target
     */
    function setupEntities(targetClothingConfig = {}) {
      const entities = [
        {
          id: 'actor1',
          components: {
            'intimacy:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'intimacy:closeness': {
              partners: ['actor1'],
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
            ...targetClothingConfig,
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['vagina1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'vagina1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'vagina',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find vagina
      mockBodyGraphService.findPartsByType.mockImplementation(
        (bodyComponent, partType) => {
          if (partType === 'vagina') {
            return ['vagina1'];
          }
          return [];
        }
      );
    }

    it('should discover action when vagina is covered', async () => {
      // Arrange - vagina covered by clothing
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        },
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(1);
      expect(rubOverClothesActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when vagina is uncovered', async () => {
      // Arrange - no clothing equipment, vagina uncovered
      setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when clothing equipment exists but no slot metadata', async () => {
      // Arrange - equipment but no metadata (edge case where isSocketCovered returns false)
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              base: ['pants1'],
            },
          },
        },
        // No clothing:slot_metadata component
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should discover action when vagina is covered by multiple clothing layers', async () => {
      // Arrange - multiple layers covering vagina
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              underwear: ['underwear1'],
              base: ['pants1'],
              outer: ['jacket1'],
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        },
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(1);
      expect(rubOverClothesActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when target is facing away', async () => {
      // Arrange - target facing away from actor, but vagina covered
      const entities = [
        {
          id: 'actor1',
          components: {
            'intimacy:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'intimacy:closeness': {
              partners: ['actor1'],
              facing_away_from: ['actor1'], // Facing away from actor
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
            'clothing:equipment': {
              equipped: {
                torso_lower: {
                  base: ['pants1'],
                },
              },
            },
            'clothing:slot_metadata': {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis', 'vagina'],
                  allowedLayers: ['base'],
                },
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['vagina1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'vagina1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'vagina',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find vagina
      mockBodyGraphService.findPartsByType.mockImplementation(
        (bodyComponent, partType) => {
          if (partType === 'vagina') {
            return ['vagina1'];
          }
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when target has no vagina', async () => {
      // Arrange - target without vagina but with clothing
      const entities = [
        {
          id: 'actor1',
          components: {
            'intimacy:closeness': {
              partners: ['target1'],
              facing_away_from: [],
            },
          },
        },
        {
          id: 'target1',
          components: {
            'intimacy:closeness': {
              partners: ['actor1'],
              facing_away_from: [],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
            'clothing:equipment': {
              equipped: {
                torso_lower: {
                  base: ['pants1'],
                },
              },
            },
            'clothing:slot_metadata': {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis', 'left_hip', 'right_hip'],
                  allowedLayers: ['base'],
                },
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: [], // No vagina
              subType: 'groin',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find no vagina
      mockBodyGraphService.findPartsByType.mockImplementation(
        (bodyComponent, partType) => {
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });

    it('should not discover action when no closeness relationship exists', async () => {
      // Arrange - no closeness component relationship
      const entities = [
        {
          id: 'actor1',
          components: {
            // No closeness component
          },
        },
        {
          id: 'target1',
          components: {
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
            'clothing:equipment': {
              equipped: {
                torso_lower: {
                  base: ['pants1'],
                },
              },
            },
            'clothing:slot_metadata': {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['vagina'],
                  allowedLayers: ['base'],
                },
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['vagina1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'vagina1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'vagina',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find vagina
      mockBodyGraphService.findPartsByType.mockImplementation(
        (bodyComponent, partType) => {
          if (partType === 'vagina') {
            return ['vagina1'];
          }
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubOverClothesActions = result.actions.filter(
        (action) => action.id === 'sex:rub_vagina_over_clothes'
      );
      expect(rubOverClothesActions).toHaveLength(0);
    });
  });
});