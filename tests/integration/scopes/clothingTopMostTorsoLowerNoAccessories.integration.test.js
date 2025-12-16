/**
 * @file Integration tests for target_topmost_torso_lower_clothing_no_accessories scope
 * @description Comprehensive test suite for the clothing scope system, specifically testing
 * the problematic scope that excludes accessories layer. Tests both direct scope resolution
 * and integration with the fondle_ass action to ensure proper behavior.
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
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
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
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const targetTopMostTorsoLowerNoAccessoriesScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/clothing/scopes/target_topmost_torso_lower_clothing_no_accessories.scope'
  ),
  'utf8'
);

// Import primary scope for comparison
const intimacyActorsScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/caressing/scopes/actors_with_ass_cheeks_facing_each_other_or_behind_target.scope'
  ),
  'utf8'
);

// Import actual action files
import fondleAssAction from '../../../data/mods/caressing/actions/fondle_ass.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Clothing TopMost Torso Lower No Accessories Scope Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;
  let clothingStepResolver;
  let slotAccessResolver;
  let entitiesGateway;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);

    // Create entities gateway wrapper for resolvers
    entitiesGateway = {
      getComponentData: (entityId, componentId) => {
        return entityManager.getComponentData(entityId, componentId);
      },
    };

    // Create clothing resolvers
    clothingStepResolver = createClothingStepResolver({ entitiesGateway });
    slotAccessResolver = createSlotAccessResolver({ entitiesGateway });

    // Mock body graph service for custom operators
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    const dataRegistry = new InMemoryDataRegistry({ logger });

    // Register the conditions used by the scope and action
    dataRegistry.store(
      'conditions',
      'positioning:both-actors-facing-each-other',
      {
        id: 'positioning:both-actors-facing-each-other',
        description:
          'Checks if both actors are facing each other (neither is facing away from the other).',
        logic: {
          and: [
            {
              '!': {
                in: [
                  { var: 'entity.id' },
                  {
                    var: 'actor.components.positioning:facing_away.facing_away_from',
                  },
                ],
              },
            },
            {
              '!': {
                in: [
                  { var: 'actor.id' },
                  {
                    var: 'entity.components.positioning:facing_away.facing_away_from',
                  },
                ],
              },
            },
          ],
        },
      }
    );

    // Register the prerequisite condition for the action
    dataRegistry.store('conditions', 'affection:actor-is-in-closeness', {
      id: 'affection:actor-is-in-closeness',
      description:
        'Checks if the actor is currently in closeness with someone.',
      logic: {
        '>': [
          { var: 'actor.components.positioning:closeness.partners.length' },
          0,
        ],
      },
    });

    // Create a proper gameDataRepository that returns conditions from dataRegistry
    const gameDataRepository = {
      getConditionDefinition: (id) => {
        const condition = dataRegistry.get('conditions', id);
        logger.debug(
          `gameDataRepository.getConditionDefinition('${id}') returning:`,
          condition
        );
        return condition;
      },
    };

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
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

    // Parse and register the clothing-specific scopes
    const targetScopeDefinitions = parseScopeDefinitions(
      targetTopMostTorsoLowerNoAccessoriesScopeContent,
      'target_topmost_torso_lower_clothing_no_accessories.scope'
    );

    const primaryScopeDefinitions = parseScopeDefinitions(
      intimacyActorsScopeContent,
      'actors_with_ass_cheeks_facing_each_other_or_behind_target.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'clothing:target_topmost_torso_lower_clothing_no_accessories':
        targetScopeDefinitions.get(
          'clothing:target_topmost_torso_lower_clothing_no_accessories'
        ),
      'caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target':
        primaryScopeDefinitions.get(
          'caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target'
        ),
    });

    scopeEngine = new ScopeEngine();

    const validatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    const targetResolutionService = createTargetResolutionServiceWithMocks({
      logger,
      scopeEngine,
      entityManager,
      scopeRegistry,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicEval,
      dslParser: new DefaultDslParser({ logger }),
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });

    // Create prerequisite service mock
    const prerequisiteEvaluationService = {
      evaluate: jest.fn((prerequisites, actionDef, actor) => {
        logger.debug('Prerequisite evaluation called for:', actionDef?.id);
        logger.debug('  Actor:', actor?.id);
        logger.debug('  Prerequisites:', prerequisites);
        const result = true;
        logger.debug('  Result:', result);
        return result;
      }),
    };

    // Create multi-target formatter
    const baseFormatter = new ActionCommandFormatter();
    const multiTargetFormatter = new MultiTargetActionFormatter(
      baseFormatter,
      logger
    );

    // Create the ActionPipelineOrchestrator

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
        getCandidateActions: jest.fn().mockImplementation((actor) => {
          logger.debug('getCandidateActions called with actor:', actor?.id);
          logger.debug('Actor has components:', !!actor?.components);
          logger.debug(
            'Actor closeness partners:',
            actor?.components?.['positioning:closeness']?.partners
          );
          logger.debug('Returning action:', fondleAssAction.id);
          return [fondleAssAction];
        }),
      },
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: multiTargetFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
      unifiedScopeResolver: (() => {
        const unifiedScopeResolver = createMockUnifiedScopeResolver({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser({ logger }),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        });

        return unifiedScopeResolver;
      })(),
      targetContextBuilder: createMockTargetContextBuilder(entityManager),
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
      multiTargetResolutionStage: (() => {
        // Create a custom mock that properly handles multi-target actions
        const {
          PipelineStage,
        } = require('../../../src/actions/pipeline/PipelineStage.js');
        const {
          PipelineResult,
        } = require('../../../src/actions/pipeline/PipelineResult.js');

        return new (class extends PipelineStage {
          constructor() {
            super('MockMultiTargetResolution');
          }

          async executeInternal(context) {
            const { candidateActions, actor } = context;

            const actionsWithTargets = [];

            for (const actionDef of candidateActions) {
              // Check if this is a multi-target action
              const isMultiTarget =
                actionDef.targets && typeof actionDef.targets === 'object';

              if (isMultiTarget && actionDef.id === 'caressing:fondle_ass') {
                // For fondle_ass, check closeness relationships
                const actorCloseness =
                  actor.components?.['positioning:closeness'];
                if (!actorCloseness?.partners?.length) continue;

                // Check each potential target
                for (const partnerId of actorCloseness.partners) {
                  const target = entityManager.getEntityInstance(partnerId);
                  if (!target) continue;

                  // Check if target has closeness back to actor
                  const targetCloseness =
                    target.components?.['positioning:closeness'];
                  if (!targetCloseness?.partners?.includes(actor.id)) continue;

                  // For the secondary scope, we need to check if the target has clothing
                  // that would be resolved by the topmost_torso_lower_no_accessories scope
                  const equipment = target.components?.['clothing:equipment'];
                  if (equipment?.equipped?.torso_lower) {
                    // Simulate the scope resolution logic
                    const torsoLowerSlot = equipment.equipped.torso_lower;
                    let resolvedClothing = null;

                    // Check layers in priority order, excluding accessories
                    const layers = ['outer', 'base', 'underwear']; // No accessories
                    for (const layer of layers) {
                      if (torsoLowerSlot[layer]) {
                        resolvedClothing = torsoLowerSlot[layer];
                        break;
                      }
                    }

                    if (resolvedClothing) {
                      actionsWithTargets.push({
                        actionDef,
                        targetContexts: [
                          {
                            type: 'entity',
                            entityId: partnerId,
                            displayName: partnerId,
                            placeholder: 'primary',
                          },
                          {
                            type: 'entity',
                            entityId: resolvedClothing,
                            displayName: resolvedClothing,
                            placeholder: 'secondary',
                            contextFromId: partnerId,
                          },
                        ],
                        resolvedTargets: {
                          primary: [
                            {
                              id: partnerId,
                              displayName: partnerId,
                              entity: target,
                            },
                          ],
                          secondary: [
                            {
                              id: resolvedClothing,
                              displayName: resolvedClothing,
                              entity: null,
                              contextFromId: partnerId,
                            },
                          ],
                        },
                        targetDefinitions: actionDef.targets,
                        isMultiTarget: true,
                      });
                    }
                  }
                }
              }
            }

            return PipelineResult.success({
              data: {
                ...context.data,
                actionsWithTargets,
              },
            });
          }
        })();
      })(),
    });

    actionDiscoveryService = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });

    // Register the fondle_ass action
    dataRegistry.store('actions', fondleAssAction.id, fondleAssAction);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper function to create actor with closeness relationship
   *
   * @param {string} actorId - The ID of the actor to create
   * @param {string} partnerId - The ID of the partner to establish closeness with
   * @param {boolean} facingAway - Whether the actor is facing away from the partner
   * @returns {string} The actor ID
   */
  function createActorWithCloseness(actorId, partnerId, facingAway = false) {
    // Set up actor's closeness data
    const actorClosenessData = {
      partners: [partnerId],
    };
    entityManager.addComponent(
      actorId,
      'positioning:closeness',
      actorClosenessData
    );

    // Set up actor's facing_away data if applicable
    if (facingAway) {
      entityManager.addComponent(actorId, 'positioning:facing_away', {
        facing_away_from: [partnerId],
      });
    }

    // Set up partner's closeness data for bidirectional relationship
    const partnerClosenessData = {
      partners: [actorId],
    };
    entityManager.addComponent(
      partnerId,
      'positioning:closeness',
      partnerClosenessData
    );

    return actorId;
  }

  /**
   * Helper function to create target with specific clothing configuration
   *
   * @param {string} targetId - The ID of the target entity to create
   * @param {object} clothingConfig - Clothing configuration
   * @param {string} clothingConfig.outer - Item ID for outer layer
   * @param {string} clothingConfig.base - Item ID for base layer
   * @param {string} clothingConfig.underwear - Item ID for underwear layer
   * @param {string} clothingConfig.accessories - Item ID for accessories layer
   * @returns {string} The target ID
   */
  function createTargetWithClothingLayers(targetId, clothingConfig = {}) {
    const equipmentData = {
      equipped: {
        torso_lower: {},
      },
    };

    // Add clothing layers as specified
    if (clothingConfig.outer) {
      equipmentData.equipped.torso_lower.outer = clothingConfig.outer;
      entityManager.addComponent(clothingConfig.outer, 'core:name', {
        name: 'outer garment',
      });
    }
    if (clothingConfig.base) {
      equipmentData.equipped.torso_lower.base = clothingConfig.base;
      entityManager.addComponent(clothingConfig.base, 'core:name', {
        name: 'base garment',
      });
    }
    if (clothingConfig.underwear) {
      equipmentData.equipped.torso_lower.underwear = clothingConfig.underwear;
      entityManager.addComponent(clothingConfig.underwear, 'core:name', {
        name: 'underwear garment',
      });
    }
    if (clothingConfig.accessories) {
      equipmentData.equipped.torso_lower.accessories =
        clothingConfig.accessories;
      entityManager.addComponent(clothingConfig.accessories, 'core:name', {
        name: 'accessory item',
      });
    }

    entityManager.addComponent(targetId, 'clothing:equipment', equipmentData);

    return targetId;
  }

  /**
   * Helper function to directly test scope resolution
   *
   * @param {string} targetId - The target entity ID
   * @returns {string|null} The resolved clothing item ID or null
   */
  function resolveTargetTopMostTorsoLowerNoAccessories(targetId) {
    // Simulate the scope resolution: target.topmost_clothing_no_accessories.torso_lower
    const clothingAccessObject = clothingStepResolver.resolve(
      {
        type: 'Step',
        field: 'topmost_clothing_no_accessories',
        parent: { type: 'Variable', name: 'target' },
      },
      {
        dispatcher: {
          resolve: () => new Set([targetId]),
        },
        trace: {
          addLog: (level, message, source, data) => {
            logger[level](`[${source}] ${message}`, data);
          },
        },
      }
    );

    const clothingAccess = Array.from(clothingAccessObject)[0];
    if (!clothingAccess) return null;

    const slotResult = slotAccessResolver.resolve(
      {
        type: 'Step',
        field: 'torso_lower',
        parent: {
          type: 'Step',
          field: 'topmost_clothing_no_accessories',
        },
      },
      {
        dispatcher: {
          resolve: () => new Set([clothingAccess]),
        },
        trace: {
          addLog: (level, message, source, data) => {
            logger[level](`[${source}] ${message}`, data);
          },
        },
      }
    );

    const resolvedItems = Array.from(slotResult);
    return resolvedItems.length > 0 ? resolvedItems[0] : null;
  }

  describe('Direct Scope Resolution Tests', () => {
    it('should resolve outer layer clothing when present', () => {
      // Arrange
      const targetId = 'target1';
      createTargetWithClothingLayers(targetId, {
        outer: 'jeans_123',
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBe('jeans_123');
    });

    it('should resolve base layer clothing when no outer layer', () => {
      // Arrange
      const targetId = 'target1';
      createTargetWithClothingLayers(targetId, {
        base: 'pants_456',
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBe('pants_456');
    });

    it('should resolve underwear layer when no outer or base layers', () => {
      // Arrange
      const targetId = 'target1';
      createTargetWithClothingLayers(targetId, {
        underwear: 'boxers_789',
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBe('boxers_789');
    });

    it('should NOT resolve accessories layer items', () => {
      // Arrange
      const targetId = 'target1';
      createTargetWithClothingLayers(targetId, {
        accessories: 'belt_999',
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBeNull();
    });

    it('should prioritize outer over base and underwear', () => {
      // Arrange
      const targetId = 'target1';
      createTargetWithClothingLayers(targetId, {
        outer: 'jeans_123',
        base: 'pants_456',
        underwear: 'boxers_789',
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBe('jeans_123');
    });

    it('should prioritize base over underwear when no outer', () => {
      // Arrange
      const targetId = 'target1';
      createTargetWithClothingLayers(targetId, {
        base: 'pants_456',
        underwear: 'boxers_789',
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBe('pants_456');
    });

    it('should ignore accessories even when mixed with other layers', () => {
      // Arrange
      const targetId = 'target1';
      createTargetWithClothingLayers(targetId, {
        base: 'pants_456',
        accessories: 'belt_999',
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBe('pants_456');
    });

    it('should return null when equipment component is missing', () => {
      // Arrange
      const targetId = 'target1';
      // Don't add any equipment component

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when torso_lower slot is missing', () => {
      // Arrange
      const targetId = 'target1';
      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: 'shirt_123',
          },
        },
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when torso_lower slot is empty', () => {
      // Arrange
      const targetId = 'target1';
      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          torso_lower: {},
        },
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Fondle Ass Action Integration Tests', () => {
    it('should find action when target has outer layer clothing', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1');
      createTargetWithClothingLayers('target1', {
        outer: 'jeans_123',
      });

      // Mock the condition evaluation to return true
      jsonLogicEval.evaluate = jest.fn().mockReturnValue(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const fondleAssActions = result.actions.filter(
        (action) => action.id === 'caressing:fondle_ass'
      );

      expect(fondleAssActions).toHaveLength(1);
      expect(fondleAssActions[0].params.isMultiTarget).toBe(true);
      expect(fondleAssActions[0].params.targetIds.primary).toEqual(['target1']);
      expect(fondleAssActions[0].params.targetIds.secondary).toEqual([
        'jeans_123',
      ]);
    });

    it('should find action when target has base layer clothing', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1');
      createTargetWithClothingLayers('target1', {
        base: 'pants_456',
      });

      // Mock the condition evaluation to return true
      jsonLogicEval.evaluate = jest.fn().mockReturnValue(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const fondleAssActions = result.actions.filter(
        (action) => action.id === 'caressing:fondle_ass'
      );

      expect(fondleAssActions).toHaveLength(1);
      expect(fondleAssActions[0].params.targetIds.secondary).toEqual([
        'pants_456',
      ]);
    });

    it('should find action when target has underwear layer clothing', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1');
      createTargetWithClothingLayers('target1', {
        underwear: 'boxers_789',
      });

      // Mock the condition evaluation to return true
      jsonLogicEval.evaluate = jest.fn().mockReturnValue(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const fondleAssActions = result.actions.filter(
        (action) => action.id === 'caressing:fondle_ass'
      );

      expect(fondleAssActions).toHaveLength(1);
      expect(fondleAssActions[0].params.targetIds.secondary).toEqual([
        'boxers_789',
      ]);
    });

    it('should NOT find action when target only has accessories', async () => {
      // Arrange - This is the core issue scenario
      const actorId = createActorWithCloseness('actor1', 'target1');
      createTargetWithClothingLayers('target1', {
        accessories: 'belt_999',
      });

      // Mock the condition evaluation to return true
      jsonLogicEval.evaluate = jest.fn().mockReturnValue(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const fondleAssActions = result.actions.filter(
        (action) => action.id === 'caressing:fondle_ass'
      );

      expect(fondleAssActions).toHaveLength(0);
    });

    it('should NOT find action when target has no equipment', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1');
      // Don't add any equipment component to target1

      // Mock the condition evaluation to return true
      jsonLogicEval.evaluate = jest.fn().mockReturnValue(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const fondleAssActions = result.actions.filter(
        (action) => action.id === 'caressing:fondle_ass'
      );

      expect(fondleAssActions).toHaveLength(0);
    });

    it('should prioritize correctly when multiple layers are present', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1');
      createTargetWithClothingLayers('target1', {
        outer: 'jeans_123',
        base: 'pants_456',
        underwear: 'boxers_789',
        accessories: 'belt_999',
      });

      // Mock the condition evaluation to return true
      jsonLogicEval.evaluate = jest.fn().mockReturnValue(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const fondleAssActions = result.actions.filter(
        (action) => action.id === 'caressing:fondle_ass'
      );

      expect(fondleAssActions).toHaveLength(1);
      expect(fondleAssActions[0].params.targetIds.secondary).toEqual([
        'jeans_123',
      ]);
    });

    it('should render action template correctly', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1');
      createTargetWithClothingLayers('target1', {
        base: 'pants_456',
      });

      // Mock the condition evaluation to return true
      jsonLogicEval.evaluate = jest.fn().mockReturnValue(true);

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const fondleAssActions = result.actions.filter(
        (action) => action.id === 'caressing:fondle_ass'
      );

      expect(fondleAssActions).toHaveLength(1);
      const action = fondleAssActions[0];

      // Template should be properly formatted
      const commandText = Array.isArray(action.command)
        ? action.command[0]
        : action.command;
      expect(commandText).toMatch(/fondle .+'s ass over the .+/);
      expect(commandText).not.toContain('{primary}');
      expect(commandText).not.toContain('{secondary}');
    });
  });

  describe('Real-World Scenario Tests', () => {
    it('should reproduce the original Jon/Silvia issue', () => {
      // Arrange - Recreate the exact scenario from the trace
      const silviaId = 'p_erotica:silvia_instance';
      const jonId = 'p_erotica:jon_urena_instance';

      // Silvia has a skirt in torso_lower/base
      createTargetWithClothingLayers(silviaId, {
        base: 'clothing:pink_short_flared_skirt',
      });

      // Jon has a belt in torso_lower/accessories (this was the issue)
      createTargetWithClothingLayers(jonId, {
        accessories: 'clothing:dark_brown_leather_belt',
      });

      // Act - Test both directions

      // Jon → Silvia (this always worked)
      const jonTargetingSilvia =
        resolveTargetTopMostTorsoLowerNoAccessories(silviaId);
      expect(jonTargetingSilvia).toBe('clothing:pink_short_flared_skirt');

      // Silvia → Jon (this fails because belt is in accessories layer)
      const silviaTargetingJon =
        resolveTargetTopMostTorsoLowerNoAccessories(jonId);
      expect(silviaTargetingJon).toBeNull(); // This is the expected behavior with no_accessories scope
    });

    it('should work correctly when character has pants instead of just belt', () => {
      // Arrange
      const targetId = 'character_with_pants';
      createTargetWithClothingLayers(targetId, {
        base: 'clothing:dark_indigo_denim_jeans',
        accessories: 'clothing:dark_brown_leather_belt',
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBe('clothing:dark_indigo_denim_jeans'); // Pants are selected, belt ignored
    });

    it('should demonstrate the difference between regular topmost_clothing and no_accessories version', () => {
      // Arrange
      const targetId = 'test_character';
      createTargetWithClothingLayers(targetId, {
        accessories: 'belt_only',
      });

      // Act - Test the no_accessories version (our scope)
      const noAccessoriesResult =
        resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Act - Test what regular topmost_clothing would return
      const regularClothingAccessObject = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing', // Regular topmost_clothing
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: {
            resolve: () => new Set([targetId]),
          },
          trace: null,
        }
      );

      const regularClothingAccess = Array.from(regularClothingAccessObject)[0];
      let regularResult = null;
      if (regularClothingAccess) {
        const regularSlotResult = slotAccessResolver.resolve(
          {
            type: 'Step',
            field: 'torso_lower',
            parent: {
              type: 'Step',
              field: 'topmost_clothing',
            },
          },
          {
            dispatcher: {
              resolve: () => new Set([regularClothingAccess]),
            },
            trace: null,
          }
        );
        const regularResolvedItems = Array.from(regularSlotResult);
        regularResult =
          regularResolvedItems.length > 0 ? regularResolvedItems[0] : null;
      }

      // Assert
      expect(noAccessoriesResult).toBeNull(); // no_accessories excludes belt
      expect(regularResult).toBe('belt_only'); // regular topmost_clothing includes belt
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null or undefined clothing data gracefully', () => {
      // Arrange
      const targetId = 'target_with_null_clothing';
      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          torso_lower: {
            base: null,
            outer: undefined,
          },
        },
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle empty strings in clothing data', () => {
      // Arrange
      const targetId = 'target_with_empty_clothing';
      entityManager.addComponent(targetId, 'clothing:equipment', {
        equipped: {
          torso_lower: {
            base: '',
            outer: '   ',
          },
        },
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      // Note: The current system treats whitespace strings as valid clothing items
      // This test documents the current behavior rather than ideal behavior
      expect(result).toBe('   '); // outer layer takes priority, even if it's whitespace
    });

    it('should handle malformed equipment data', () => {
      // Arrange
      const targetId = 'target_with_malformed_equipment';
      entityManager.addComponent(targetId, 'clothing:equipment', {
        // Missing equipped property
        someOtherProperty: 'invalid',
      });

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle entity that does not exist', () => {
      // Arrange
      const targetId = 'nonexistent_entity';

      // Act
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Performance and Logging Tests', () => {
    it('should handle large numbers of clothing items efficiently', () => {
      // Arrange
      const targetId = 'target_with_many_items';
      const equipmentData = {
        equipped: {},
      };

      // Create many slots with many layers
      for (let i = 0; i < 10; i++) {
        const slotName = `slot_${i}`;
        equipmentData.equipped[slotName] = {
          outer: `outer_${i}`,
          base: `base_${i}`,
          underwear: `underwear_${i}`,
          accessories: `accessories_${i}`,
        };
      }

      // Add our test slot
      equipmentData.equipped.torso_lower = {
        base: 'target_item',
      };

      entityManager.addComponent(targetId, 'clothing:equipment', equipmentData);

      // Act
      const startTime = performance.now();
      const result = resolveTargetTopMostTorsoLowerNoAccessories(targetId);
      const endTime = performance.now();

      // Assert
      expect(result).toBe('target_item');
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });
});
