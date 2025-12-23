/**
 * @file Integration tests for rub_penis_between_ass_cheeks action discovery
 * @description Tests that the actors_with_exposed_ass_facing_away scope properly filters
 * actors based on ass socket coverage, facing direction, and closeness
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
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import {
  createMockMultiTargetResolutionStage,
  createEmptyMockMultiTargetResolutionStage,
} from '../../common/mocks/mockMultiTargetResolutionStage.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const assScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex-dry-intimacy/scopes/actors_with_exposed_ass_facing_away.scope'
  ),
  'utf8'
);

// Import actual action files
import rubPenisBetweenAssCheeksAction from '../../../data/mods/sex-dry-intimacy/actions/rub_penis_between_ass_cheeks.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Rub Penis Between Ass Cheeks Action Discovery Integration Tests', () => {
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
    dataRegistry.store(
      'actions',
      rubPenisBetweenAssCheeksAction.id,
      rubPenisBetweenAssCheeksAction
    );

    // Store the condition
    dataRegistry.store(
      'conditions',
      'facing-states:actor-in-entity-facing-away',
      {
        id: 'facing-states:actor-in-entity-facing-away',
        logic: {
          in: [
            { var: 'actor.id' },
            {
              var: 'entity.components.facing-states:facing_away.facing_away_from',
            },
          ],
        },
      }
    );

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
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      assScopeContent,
      'actors_with_exposed_ass_facing_away.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex-dry-intimacy:actors_with_exposed_ass_facing_away':
        scopeDefinitions.get(
          'sex-dry-intimacy:actors_with_exposed_ass_facing_away'
        ),
    });

    scopeEngine = new ScopeEngine();

    // Mock prerequisite evaluation to check for penis
    prerequisiteEvaluationService = {
      evaluate: jest
        .fn()
        .mockImplementation((prerequisites, actionDef, actor, trace) => {
          console.log(
            'PrerequisiteEvaluationService.evaluate called for action:',
            actionDef.id
          );

          // Check if the actor has a penis for this specific action
          if (
            actionDef.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks' &&
            prerequisites
          ) {
            // Check if actor has penis using the hasPartOfType operator
            const hasPartOfTypeLogic = { hasPartOfType: ['actor', 'penis'] };
            const context = { actor };
            const hasPenis = jsonLogicEval.evaluate(
              hasPartOfTypeLogic,
              context
            );
            console.log('Actor has penis in prerequisite check:', hasPenis);
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
      getAllActionDefinitions: jest
        .fn()
        .mockReturnValue([rubPenisBetweenAssCheeksAction]),
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
  /**
   *
   * @param shouldFindActions
   */
  function createActionDiscoveryService(shouldFindActions = true) {
    // For this test, we need a custom mock that actually checks the scope
    const stage = shouldFindActions
      ? {
          name: 'CustomMockMultiTargetResolution',
          async execute(context) {
            console.log(
              'Mock stage received context.candidateActions:',
              context.candidateActions?.map((a) => a.id)
            );
            console.log(
              'Mock stage received context.data?.candidateActions:',
              context.data?.candidateActions?.map((a) => a.id)
            );

            // Get candidate actions from the right place
            const candidateActions =
              context.candidateActions || context.data?.candidateActions || [];
            console.log(
              'Mock stage found actions:',
              candidateActions.map((a) => a.id)
            );

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
                  { condition_ref: 'facing-states:actor-in-entity-facing-away' },
                  {
                    or: [
                      {
                        and: [
                          { hasPartOfType: ['.', 'ass_cheek'] },
                          { not: { isSocketCovered: ['.', 'left_ass'] } },
                        ],
                      },
                      {
                        and: [
                          { hasPartOfType: ['.', 'ass_cheek'] },
                          { not: { isSocketCovered: ['.', 'right_ass'] } },
                        ],
                      },
                    ],
                  },
                ],
              };

              const scopePasses = jsonLogicEval.evaluate(
                fullScopeLogic,
                scopeContext
              );
              console.log(
                `Scope evaluation for action ${actionDef.id}: ${scopePasses}`
              );

              if (scopePasses) {
                actionsWithTargets.push({
                  actionDef,
                  targetContexts: [
                    {
                      type: 'entity',
                      entityId: 'target1',
                      displayName: 'Target 1',
                      placeholder: 'primary',
                    },
                  ],
                  resolvedTargets: {
                    primary: [
                      {
                        id: 'target1',
                        displayName: 'Target 1',
                        entity: target1,
                      },
                    ],
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

    // Create mock TargetComponentValidator
    const mockTargetComponentValidator = {
      validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
      validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
    };

    // Create mock TargetRequiredComponentsValidator
    const mockTargetRequiredComponentsValidator =
      createMockTargetRequiredComponentsValidator();
    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: {
        getCandidateActions: jest.fn().mockImplementation((actor, trace) => {
          // Return the action only if the actor has the required components
          const allActions = gameDataRepository.getAllActionDefinitions();
          console.log('getCandidateActions called with actor:', actor.id);
          console.log(
            'All actions:',
            allActions.map((a) => a.id)
          );

          const filtered = allActions.filter((action) => {
            // Check if actor has required components
            if (action.required_components?.actor) {
              for (const comp of action.required_components.actor) {
                const hasComp = !!entityManager.getComponentData(
                  actor.id,
                  comp
                );
                console.log(`Actor ${actor.id} has ${comp}: ${hasComp}`);
                if (!hasComp) {
                  return false;
                }
              }
            }
            return true;
          });

          console.log(
            'Filtered actions:',
            filtered.map((a) => a.id)
          );
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
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
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
    /**
     *
     * @param config
     */
    function setupEntities(config = {}) {
      const {
        targetFacingAway = true,
        targetHasAssparts = true,
        leftAssCovered = false,
        rightAssCovered = false,
        actorHasPenis = true,
      } = config;

      const entities = [
        {
          id: 'actor1',
          components: {
            'personal-space-states:closeness': {
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
            'personal-space-states:closeness': {
              partners: ['actor1'],
            },
            'facing-states:facing_away': {
              facing_away_from: targetFacingAway ? ['actor1'] : [],
            },
            ...(targetHasAssparts && {
              'anatomy:body': {
                body: {
                  root: 'torso1',
                },
              },
            }),
            // Add clothing components for socket coverage
            // For partial coverage, we need custom slots; for full coverage, use torso_lower
            ...((leftAssCovered || rightAssCovered) && {
              'clothing:equipment': {
                equipped: {
                  // If both are covered, use torso_lower like actual game
                  ...(leftAssCovered &&
                    rightAssCovered && {
                      torso_lower: {
                        base: ['underwear_item'],
                      },
                    }),
                  // For partial coverage testing, use custom slots
                  ...(leftAssCovered &&
                    !rightAssCovered && {
                      left_custom: {
                        base: ['left_cover'],
                      },
                    }),
                  ...(rightAssCovered &&
                    !leftAssCovered && {
                      right_custom: {
                        base: ['right_cover'],
                      },
                    }),
                },
              },
              'clothing:slot_metadata': {
                slotMappings: {
                  // Full coverage via torso_lower
                  ...(leftAssCovered &&
                    rightAssCovered && {
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
                          'right_ass',
                        ],
                      },
                    }),
                  // Partial coverage for testing
                  ...(leftAssCovered &&
                    !rightAssCovered && {
                      left_custom: {
                        coveredSockets: ['left_ass'],
                      },
                    }),
                  ...(rightAssCovered &&
                    !leftAssCovered && {
                      right_custom: {
                        coveredSockets: ['right_ass'],
                      },
                    }),
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
      if (targetHasAssparts) {
        entities.push(
          {
            id: 'torso1',
            components: {
              'anatomy:part': {
                parent: null,
                children: ['leftAss1', 'rightAss1'],
                subType: 'torso',
              },
            },
          },
          {
            id: 'leftAss1',
            components: {
              'anatomy:part': {
                parent: 'torso1',
                children: [],
                subType: 'ass_cheek',
              },
            },
          },
          {
            id: 'rightAss1',
            components: {
              'anatomy:part': {
                parent: 'torso1',
                children: [],
                subType: 'ass_cheek',
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
          if (rootId === 'torso1' && partType === 'ass_cheek') {
            return ['leftAss1', 'rightAss1'];
          }
          return [];
        }
      );

      // The real isSocketCovered operator will be used - no mocking needed
      // It will check clothing:equipment and clothing:slot_metadata components
    }

    it('should discover action when all conditions are met', async () => {
      // Arrange - target facing away, has ass parts, not covered, actor has penis
      setupEntities({
        targetFacingAway: true,
        targetHasAssparts: true,
        leftAssCovered: false,
        rightAssCovered: false,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Debug: Log all discovered actions and target entity state
      console.log(
        'All discovered actions:',
        result.actions.map((a) => a.id)
      );
      console.log('Full result:', JSON.stringify(result, null, 2));
      const target1 = entityManager.getEntityInstance('target1');
      console.log(
        'Target1 components:',
        JSON.stringify(target1.components, null, 2)
      );

      // Check if scope is being evaluated correctly
      const scopeContext = {
        actor: actorEntity,
        entity: target1,
      };
      const hasPartOfTypeResult = jsonLogicEval.evaluate(
        { hasPartOfType: ['.', 'ass_cheek'] },
        scopeContext
      );
      console.log('Target has ass_cheek parts:', hasPartOfTypeResult);

      const isSocketCoveredLeftResult = jsonLogicEval.evaluate(
        { isSocketCovered: ['.', 'left_ass'] },
        scopeContext
      );
      console.log('Target left_ass is covered:', isSocketCoveredLeftResult);

      const isSocketCoveredRightResult = jsonLogicEval.evaluate(
        { isSocketCovered: ['.', 'right_ass'] },
        scopeContext
      );
      console.log('Target right_ass is covered:', isSocketCoveredRightResult);

      // Check facing away condition
      const facingAwayResult = jsonLogicEval.evaluate(
        { condition_ref: 'facing-states:actor-in-entity-facing-away' },
        scopeContext
      );
      console.log('Actor is in entity facing away:', facingAwayResult);

      // Check if actor has penis
      const actorHasPenisResult = jsonLogicEval.evaluate(
        { hasPartOfType: ['actor', 'penis'] },
        scopeContext
      );
      console.log('Actor has penis:', actorHasPenisResult);

      // Check if actor has required components
      console.log(
        'Actor components:',
        JSON.stringify(actorEntity.components, null, 2)
      );

      // Try evaluating the full scope
      const fullScopeLogic = {
        and: [
          { condition_ref: 'facing-states:actor-in-entity-facing-away' },
          {
            or: [
              {
                and: [
                  { hasPartOfType: ['.', 'ass_cheek'] },
                  { not: { isSocketCovered: ['.', 'left_ass'] } },
                ],
              },
              {
                and: [
                  { hasPartOfType: ['.', 'ass_cheek'] },
                  { not: { isSocketCovered: ['.', 'right_ass'] } },
                ],
              },
            ],
          },
        ],
      };
      const fullScopeResult = jsonLogicEval.evaluate(
        fullScopeLogic,
        scopeContext
      );
      console.log('Full scope evaluation result:', fullScopeResult);

      // Check if action is in the candidate actions
      const candidateActions = gameDataRepository.getAllActionDefinitions();
      console.log(
        'Candidate actions:',
        candidateActions.map((a) => a.id)
      );

      // Check what prerequisite evaluation returns
      const prereqResult = prerequisiteEvaluationService.evaluate(
        rubPenisBetweenAssCheeksAction.prerequisites,
        rubPenisBetweenAssCheeksAction,
        actorEntity,
        null
      );
      console.log('Prerequisite evaluation result:', prereqResult);

      // Check if scope is registered
      const registeredScope = scopeRegistry.getScope(
        'sex-dry-intimacy:actors_with_exposed_ass_facing_away'
      );
      console.log('Scope is registered:', !!registeredScope);

      // Assert
      const rubActions = result.actions.filter(
        (action) =>
          action.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks'
      );
      expect(rubActions).toHaveLength(1);
      expect(rubActions[0].params.targetId).toBe('target1');
    });

    it('should discover action when only left ass is uncovered', async () => {
      // Arrange - only left ass uncovered
      setupEntities({
        targetFacingAway: true,
        targetHasAssparts: true,
        leftAssCovered: false,
        rightAssCovered: true,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubActions = result.actions.filter(
        (action) =>
          action.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks'
      );
      expect(rubActions).toHaveLength(1);
      expect(rubActions[0].params.targetId).toBe('target1');
    });

    it('should discover action when only right ass is uncovered', async () => {
      // Arrange - only right ass uncovered
      setupEntities({
        targetFacingAway: true,
        targetHasAssparts: true,
        leftAssCovered: true,
        rightAssCovered: false,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubActions = result.actions.filter(
        (action) =>
          action.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks'
      );
      expect(rubActions).toHaveLength(1);
      expect(rubActions[0].params.targetId).toBe('target1');
    });

    it('should not discover action when both ass sockets are covered', async () => {
      // Arrange - both ass sockets covered
      setupEntities({
        targetFacingAway: true,
        targetHasAssparts: true,
        leftAssCovered: true,
        rightAssCovered: true,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubActions = result.actions.filter(
        (action) =>
          action.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks'
      );
      expect(rubActions).toHaveLength(0);
    });

    it('should not discover action when target is not facing away', async () => {
      // Arrange - target not facing away
      setupEntities({
        targetFacingAway: false,
        targetHasAssparts: true,
        leftAssCovered: false,
        rightAssCovered: false,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubActions = result.actions.filter(
        (action) =>
          action.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks'
      );
      expect(rubActions).toHaveLength(0);
    });

    it('should not discover action when target lacks ass parts', async () => {
      // Arrange - target has no ass parts
      setupEntities({
        targetFacingAway: true,
        targetHasAssparts: false,
        leftAssCovered: false,
        rightAssCovered: false,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubActions = result.actions.filter(
        (action) =>
          action.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks'
      );
      expect(rubActions).toHaveLength(0);
    });

    it('should not discover action when actor lacks penis', async () => {
      // Arrange - actor has no penis
      setupEntities({
        targetFacingAway: true,
        targetHasAssparts: true,
        leftAssCovered: false,
        rightAssCovered: false,
        actorHasPenis: false,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const rubActions = result.actions.filter(
        (action) =>
          action.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks'
      );
      expect(rubActions).toHaveLength(0);
    });

    it('should not discover action when target wears torso_lower clothing (base layer)', async () => {
      // This test validates the fix for the bug where actions were available
      // even when target was wearing clothing in torso_lower slot

      // Arrange - target wearing underwear in torso_lower base layer
      setupEntities({
        targetFacingAway: true,
        targetHasAssparts: true,
        leftAssCovered: true, // This will add torso_lower clothing
        rightAssCovered: true,
        actorHasPenis: true,
      });

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert - action should NOT be available when target wears clothing
      const rubActions = result.actions.filter(
        (action) =>
          action.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks'
      );
      expect(rubActions).toHaveLength(0);
    });

    it('should not discover action when target wears torso_lower clothing (underwear layer)', async () => {
      // Test with underwear layer specifically
      const entities = [
        {
          id: 'actor1',
          components: {
            'personal-space-states:closeness': {
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
            'personal-space-states:closeness': {
              partners: ['actor1'],
            },
            'facing-states:facing_away': {
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
                  underwear: ['panties'], // Underwear layer
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
                    'right_ass',
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
              children: ['leftAss1', 'rightAss1'],
              subType: 'torso',
            },
          },
        },
        {
          id: 'leftAss1',
          components: {
            'anatomy:part': {
              parent: 'torso1',
              children: [],
              subType: 'ass_cheek',
            },
          },
        },
        {
          id: 'rightAss1',
          components: {
            'anatomy:part': {
              parent: 'torso1',
              children: [],
              subType: 'ass_cheek',
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
          if (rootId === 'torso1' && partType === 'ass_cheek') {
            return ['leftAss1', 'rightAss1'];
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
      const rubActions = result.actions.filter(
        (action) =>
          action.id === 'sex-dry-intimacy:rub_penis_between_ass_cheeks'
      );
      expect(rubActions).toHaveLength(0);
    });
  });
});
