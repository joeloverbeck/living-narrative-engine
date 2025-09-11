/**
 * @file Integration tests for tease_asshole_with_glans action discovery
 * @description Tests that the actors_with_exposed_asshole_facing_away scope properly filters
 * actors based on asshole socket coverage, facing direction, and closeness
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
import {
  createTargetResolutionServiceWithMocks,
  createMockUnifiedScopeResolver,
} from '../../common/mocks/mockUnifiedScopeResolver.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import {
  createMockMultiTargetResolutionStage,
  createEmptyMockMultiTargetResolutionStage,
} from '../../common/mocks/mockMultiTargetResolutionStage.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const assholeScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex/scopes/actors_with_exposed_asshole_facing_away.scope'
  ),
  'utf8'
);

// Import actual action files
import teaseAssholeAction from '../../../data/mods/sex/actions/tease_asshole_with_glans.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Tease Asshole With Glans Action Discovery Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;
  let safeEventDispatcher;
  let multiTargetResolutionStage;
  let prerequisiteEvaluationService;
  let targetResolutionService;
  let gameDataRepository;

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
    dataRegistry.store('actions', teaseAssholeAction.id, teaseAssholeAction);

    // Store the condition
    dataRegistry.store('conditions', 'positioning:actor-in-entity-facing-away', {
      id: 'positioning:actor-in-entity-facing-away',
      logic: {
        in: [
          { var: 'actor.id' },
          { var: 'entity.components.positioning:facing_away.facing_away_from' },
        ],
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
      assholeScopeContent,
      'actors_with_exposed_asshole_facing_away.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex:actors_with_exposed_asshole_facing_away': scopeDefinitions.get(
        'sex:actors_with_exposed_asshole_facing_away'
      ),
    });

    scopeEngine = new ScopeEngine();
    
    // Mock prerequisite evaluation to check for penis
    prerequisiteEvaluationService = {
      evaluate: jest.fn().mockImplementation((prerequisites, actionDef, actor, trace) => {
        // Check if the actor has a penis for this specific action
        if (actionDef.id === 'sex:tease_asshole_with_glans' && prerequisites) {
          // Check if actor has penis using the hasPartOfType operator
          const hasPartOfTypeLogic = { hasPartOfType: ['actor', 'penis'] };
          const context = { actor };
          const hasPenis = jsonLogicEval.evaluate(hasPartOfTypeLogic, context);
          return hasPenis;
        }
        
        return true;
      }),
    };

    targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry,
      scopeEngine,
      jsonLogicEvaluationService: jsonLogicEval,
      entityManager,
      logger,
    });

    gameDataRepository = {
      getAllActionDefinitions: jest.fn().mockReturnValue([teaseAssholeAction]),
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

    // Default to normal mock - individual tests can override
    multiTargetResolutionStage = createMockMultiTargetResolutionStage();
  });

  // Helper to create action discovery service with custom mock
  function createActionDiscoveryService(shouldFindActions = true) {
    // For this test, we need a custom mock that actually checks the scope
    const stage = shouldFindActions
      ? {
          name: 'CustomMockMultiTargetResolution',
          async execute(context) {
            // Get candidate actions from the right place
            const candidateActions = context.candidateActions || context.data?.candidateActions || [];
            
            // Check if the action's scope conditions are met
            const actionsWithTargets = [];
            for (const actionDef of candidateActions) {
              // For this test, we need to check if the scope conditions are actually met
              // We'll evaluate the scope for the target
              const target1 = entityManager.getEntityInstance('target1');
              const actorEntity = context.actor;
              
              // Check the scope conditions using jsonLogicEval
              const scopeContext = {
                actor: actorEntity,
                entity: target1,
              };
              
              // Evaluate the full scope logic for the action
              const fullScopeLogic = {
                and: [
                  { condition_ref: 'positioning:actor-in-entity-facing-away' },
                  {
                    and: [
                      { hasPartOfType: ['.', 'asshole'] },
                      { not: { isSocketCovered: ['.', 'asshole'] } }
                    ]
                  }
                ]
              };
              
              const scopePasses = jsonLogicEval.evaluate(fullScopeLogic, scopeContext);
              
              if (scopePasses) {
                actionsWithTargets.push({
                  actionDef,
                  targetContexts: [{
                    type: 'entity',
                    entityId: 'target1',
                    displayName: 'Target 1',
                    placeholder: 'primary',
                  }],
                  resolvedTargets: {
                    primary: [{
                      id: 'target1',
                      displayName: 'Target 1',
                      entity: target1,
                    }],
                  },
                  targetDefinitions: {
                    primary: {
                      scope: actionDef.targets?.primary?.scope || 'unknown',
                      placeholder: 'primary',
                    },
                  },
                  isMultiTarget: false,
                });
              }
            }
            
            return {
              isSuccess: () => true,
              success: true,
              continueProcessing: true,
              data: {
                ...context.data,
                actionsWithTargets,
              },
              errors: [],
              actions: [],
            };
          },
        }
      : createEmptyMockMultiTargetResolutionStage();

    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: {
        getCandidateActions: jest
          .fn()
          .mockImplementation((actor, trace) => {
            // Return the action only if the actor has the required components
            const allActions = gameDataRepository.getAllActionDefinitions();
            
            const filtered = allActions.filter(action => {
              // Check if actor has required components
              if (action.required_components?.actor) {
                for (const comp of action.required_components.actor) {
                  const hasComp = !!entityManager.getComponentData(actor.id, comp);
                  if (!hasComp) {
                    return false;
                  }
                }
              }
              return true;
            });
            
            return filtered;
          }),
      },
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: new ActionCommandFormatter(),
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
      unifiedScopeResolver: createMockUnifiedScopeResolver({
        scopeRegistry,
        entityManager,
        logger,
      }),
      targetContextBuilder: createMockTargetContextBuilder(),
      multiTargetResolutionStage: stage,
    });

    return new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });
  }

  beforeEach(() => {
    // Create default action discovery service
    actionDiscoveryService = createActionDiscoveryService(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('socket coverage and positioning tests', () => {
    function setupEntities(config = {}) {
      const {
        targetFacingAway = true,
        targetHasAsshole = true,
        assholeCovered = false,
        actorHasPenis = true,
      } = config;

      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:closeness': {
              partners: ['target1'],
            },
            ...(actorHasPenis && {
              'anatomy:body': {
                body: {
                  root: 'groin1',
                },
              },
            }),
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
            },
            'positioning:facing_away': {
              facing_away_from: targetFacingAway ? ['actor1'] : [],
            },
            ...(targetHasAsshole && {
              'anatomy:body': {
                body: {
                  root: 'torso1',
                },
              },
            }),
            // Add clothing components for socket coverage
            // Use torso_lower slot like actual game mechanics
            ...(assholeCovered && {
              'clothing:equipment': {
                equipped: {
                  torso_lower: {
                    base: ['underwear_item'],
                  },
                },
              },
              'clothing:slot_metadata': {
                slotMappings: {
                  torso_lower: {
                    coveredSockets: [
                      'left_hip',
                      'right_hip',
                      'waist_front',
                      'waist_back',
                      'pubic_hair',
                      'penis',
                      'left_testicle',
                      'right_testicle',
                      'vagina',
                      'asshole',
                      'left_ass',
                      'right_ass'
                    ],
                  },
                },
              },
            }),
          },
        },
      ];

      // Add actor anatomy if needed
      if (actorHasPenis) {
        entities.push(
          {
            id: 'groin1',
            components: {
              'anatomy:part': {
                parent: null,
                children: ['penis1'],
                subType: 'groin',
              },
            },
          },
          {
            id: 'penis1',
            components: {
              'anatomy:part': {
                parent: 'groin1',
                children: [],
                subType: 'penis',
              },
            },
          }
        );
      }

      // Add target anatomy if needed
      if (targetHasAsshole) {
        entities.push(
          {
            id: 'torso1',
            components: {
              'anatomy:part': {
                parent: null,
                children: ['asshole1'],
                subType: 'torso',
              },
            },
          },
          {
            id: 'asshole1',
            components: {
              'anatomy:part': {
                parent: 'torso1',
                children: [],
                subType: 'asshole',
              },
            },
          }
        );
      }

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find body parts
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'groin1' && partType === 'penis') {
            return ['penis1'];
          }
          if (rootId === 'torso1' && partType === 'asshole') {
            return ['asshole1'];
          }
          return [];
        }
      );
    }

    it('should discover action when all conditions are met', async () => {
      // Arrange - target facing away, has asshole, not covered, actor has penis
      setupEntities({
        targetFacingAway: true,
        targetHasAsshole: true,
        assholeCovered: false,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const teaseActions = result.actions.filter(
        (action) => action.id === 'sex:tease_asshole_with_glans'
      );
      expect(teaseActions).toHaveLength(1);
      expect(teaseActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when asshole is covered by torso_lower clothing', async () => {
      // This test validates the fix for the bug where actions were available
      // even when target was wearing clothing in torso_lower slot
      
      // Arrange - target wearing clothing in torso_lower
      setupEntities({
        targetFacingAway: true,
        targetHasAsshole: true,
        assholeCovered: true,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert - action should NOT be available when target wears clothing
      const teaseActions = result.actions.filter(
        (action) => action.id === 'sex:tease_asshole_with_glans'
      );
      expect(teaseActions).toHaveLength(0);
    });

    it('should not discover action when target wears torso_lower clothing (underwear layer)', async () => {
      // Test with underwear layer specifically
      const entities = [
        {
          id: 'actor1',
          components: {
            'positioning:closeness': {
              partners: ['target1'],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
          },
        },
        {
          id: 'target1',
          components: {
            'positioning:closeness': {
              partners: ['actor1'],
            },
            'positioning:facing_away': {
              facing_away_from: ['actor1'],
            },
            'anatomy:body': {
              body: {
                root: 'torso1',
              },
            },
            'clothing:equipment': {
              equipped: {
                torso_lower: {
                  underwear: ['boxers'], // Underwear layer
                },
              },
            },
            'clothing:slot_metadata': {
              slotMappings: {
                torso_lower: {
                  coveredSockets: [
                    'left_hip',
                    'right_hip',
                    'waist_front',
                    'waist_back',
                    'pubic_hair',
                    'penis',
                    'left_testicle',
                    'right_testicle',
                    'vagina',
                    'asshole',
                    'left_ass',
                    'right_ass'
                  ],
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
              children: ['penis1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'penis1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'penis',
            },
          },
        },
        {
          id: 'torso1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['asshole1'],
              subType: 'torso',
            },
          },
        },
        {
          id: 'asshole1',
          components: {
            'anatomy:part': {
              parent: 'torso1',
              children: [],
              subType: 'asshole',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find body parts
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'groin1' && partType === 'penis') {
            return ['penis1'];
          }
          if (rootId === 'torso1' && partType === 'asshole') {
            return ['asshole1'];
          }
          return [];
        }
      );

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert - action should NOT be available when target wears underwear
      const teaseActions = result.actions.filter(
        (action) => action.id === 'sex:tease_asshole_with_glans'
      );
      expect(teaseActions).toHaveLength(0);
    });

    it('should not discover action when target is not facing away', async () => {
      // Arrange - target not facing away
      setupEntities({
        targetFacingAway: false,
        targetHasAsshole: true,
        assholeCovered: false,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const teaseActions = result.actions.filter(
        (action) => action.id === 'sex:tease_asshole_with_glans'
      );
      expect(teaseActions).toHaveLength(0);
    });

    it('should not discover action when target lacks asshole', async () => {
      // Arrange - target has no asshole part
      setupEntities({
        targetFacingAway: true,
        targetHasAsshole: false,
        assholeCovered: false,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const teaseActions = result.actions.filter(
        (action) => action.id === 'sex:tease_asshole_with_glans'
      );
      expect(teaseActions).toHaveLength(0);
    });

    it('should not discover action when actor lacks penis', async () => {
      // Arrange - actor has no penis
      setupEntities({
        targetFacingAway: true,
        targetHasAsshole: true,
        assholeCovered: false,
        actorHasPenis: false,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const teaseActions = result.actions.filter(
        (action) => action.id === 'sex:tease_asshole_with_glans'
      );
      expect(teaseActions).toHaveLength(0);
    });
  });
});