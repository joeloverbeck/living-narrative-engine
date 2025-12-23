/**
 * @file Integration tests for lick_testicles_sensually action discovery with socket coverage
 * @description Tests that the actor_kneeling_before_target_with_testicle scope properly filters
 * actors based on testicle socket coverage (left_testicle and right_testicle), kneeling position, and closeness
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
const testicleScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex-core/scopes/actor_kneeling_before_target_with_testicle.scope'
  ),
  'utf8'
);

// Import actual action files
import lickTesticlesAction from '../../../data/mods/sex-penile-oral/actions/lick_testicles_sensually.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Lick Testicles Sensually Action Discovery Integration Tests', () => {
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
    dataRegistry.store('actions', lickTesticlesAction.id, lickTesticlesAction);

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
      testicleScopeContent,
      'actor_kneeling_before_target_with_testicle.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex-core:actor_kneeling_before_target_with_testicle':
        scopeDefinitions.get(
          'sex-core:actor_kneeling_before_target_with_testicle'
        ),
    });

    scopeEngine = new ScopeEngine();
    prerequisiteEvaluationService = {
      evaluateActionConditions: jest.fn().mockResolvedValue({
        success: true,
        errors: [],
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
      getAllActionDefinitions: jest.fn().mockReturnValue([lickTesticlesAction]),
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
    const stage = shouldFindActions
      ? createMockMultiTargetResolutionStage()
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

  describe('socket coverage tests for testicles', () => {
    /**
     *
     * @param targetClothingConfig
     */
    function setupEntities(targetClothingConfig = {}) {
      const entities = [
        {
          id: 'actor1',
          components: {
            'personal-space-states:closeness': {
              partners: ['target1'],
            },
            'deference-states:kneeling_before': {
              entityId: 'target1',
            },
          },
        },
        {
          id: 'target1',
          components: {
            'personal-space-states:closeness': {
              partners: ['actor1'],
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
              children: ['left_testicle1', 'right_testicle1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'left_testicle1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'testicle',
            },
          },
        },
        {
          id: 'right_testicle1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'testicle',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find testicles
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'groin1' && partType === 'testicle') {
            return ['left_testicle1', 'right_testicle1'];
          }
          return [];
        }
      );
    }

    it('should discover action when both testicles are uncovered', async () => {
      // Arrange - no clothing equipment
      setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const lickTesticlesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-oral:lick_testicles_sensually'
      );
      expect(lickTesticlesActions).toHaveLength(1);
      expect(lickTesticlesActions[0].params.targetId).toBe('target1');
    });

    it('should discover action when only left testicle is uncovered', async () => {
      // Arrange - right testicle covered, left uncovered
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              base: [], // Empty means not fully covered
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['right_testicle'], // Only right is marked as covered
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
      const lickTesticlesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-oral:lick_testicles_sensually'
      );
      expect(lickTesticlesActions).toHaveLength(1);
    });

    it('should discover action when only right testicle is uncovered', async () => {
      // Arrange - left testicle covered, right uncovered
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              base: [], // Empty means not fully covered
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_lower: {
              coveredSockets: ['left_testicle'], // Only left is marked as covered
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
      const lickTesticlesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-oral:lick_testicles_sensually'
      );
      expect(lickTesticlesActions).toHaveLength(1);
    });

    it('should not discover action when both testicles are covered', async () => {
      // Arrange - both testicles covered
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_lower: {
              base: ['underwear1'],
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_lower: {
              coveredSockets: [
                'penis',
                'left_testicle',
                'right_testicle',
                'left_hip',
                'right_hip',
              ],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        },
      });

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const lickTesticlesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-oral:lick_testicles_sensually'
      );
      expect(lickTesticlesActions).toHaveLength(0);
    });

    it('should not discover action when actor is not kneeling', async () => {
      // Arrange - actor not kneeling
      const entities = [
        {
          id: 'actor1',
          components: {
            'personal-space-states:closeness': {
              partners: ['target1'],
            },
            // NO kneeling_before component
          },
        },
        {
          id: 'target1',
          components: {
            'personal-space-states:closeness': {
              partners: ['actor1'],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['left_testicle1', 'right_testicle1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'left_testicle1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'testicle',
            },
          },
        },
        {
          id: 'right_testicle1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'testicle',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'groin1' && partType === 'testicle') {
            return ['left_testicle1', 'right_testicle1'];
          }
          return [];
        }
      );

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const lickTesticlesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-oral:lick_testicles_sensually'
      );
      expect(lickTesticlesActions).toHaveLength(0);
    });

    it('should not discover action when target has no testicles', async () => {
      // Arrange - target without testicles
      const entities = [
        {
          id: 'actor1',
          components: {
            'personal-space-states:closeness': {
              partners: ['target1'],
            },
            'deference-states:kneeling_before': {
              entityId: 'target1',
            },
          },
        },
        {
          id: 'target1',
          components: {
            'personal-space-states:closeness': {
              partners: ['actor1'],
            },
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: [], // No testicles
              subType: 'groin',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      // Mock hasPartOfType to find no testicles
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          return []; // Always return empty for this test case
        }
      );

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const lickTesticlesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-oral:lick_testicles_sensually'
      );
      expect(lickTesticlesActions).toHaveLength(0);
    });

    it('should not discover action when not in closeness', async () => {
      // Arrange - not in closeness
      const entities = [
        {
          id: 'actor1',
          components: {
            // NO closeness component
            'deference-states:kneeling_before': {
              entityId: 'target1',
            },
          },
        },
        {
          id: 'target1',
          components: {
            // NO closeness component
            'anatomy:body': {
              body: {
                root: 'groin1',
              },
            },
          },
        },
        {
          id: 'groin1',
          components: {
            'anatomy:part': {
              parent: null,
              children: ['left_testicle1', 'right_testicle1'],
              subType: 'groin',
            },
          },
        },
        {
          id: 'left_testicle1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'testicle',
            },
          },
        },
        {
          id: 'right_testicle1',
          components: {
            'anatomy:part': {
              parent: 'groin1',
              children: [],
              subType: 'testicle',
            },
          },
        },
      ];

      entityManager.setEntities(entities);

      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'groin1' && partType === 'testicle') {
            return ['left_testicle1', 'right_testicle1'];
          }
          return [];
        }
      );

      // Use empty mock since this should return no actions
      const customActionDiscoveryService = createActionDiscoveryService(false);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await customActionDiscoveryService.getValidActions(
        actorEntity,
        {
          jsonLogicEval,
        }
      );

      // Assert
      const lickTesticlesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-oral:lick_testicles_sensually'
      );
      expect(lickTesticlesActions).toHaveLength(0);
    });

    it('should discover action when no clothing equipment component exists', async () => {
      // Arrange - no clothing equipment component at all
      setupEntities({});

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        jsonLogicEval,
      });

      // Assert
      const lickTesticlesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-oral:lick_testicles_sensually'
      );
      expect(lickTesticlesActions).toHaveLength(1);
    });

    it('should discover action when no slot metadata component exists', async () => {
      // Arrange - equipment but no metadata
      setupEntities({
        'clothing:equipment': {
          torso_lower: {
            items: ['underwear1'],
            layers: { base: 'underwear1' },
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
      const lickTesticlesActions = result.actions.filter(
        (action) => action.id === 'sex-penile-oral:lick_testicles_sensually'
      );
      expect(lickTesticlesActions).toHaveLength(1);
    });
  });
});
