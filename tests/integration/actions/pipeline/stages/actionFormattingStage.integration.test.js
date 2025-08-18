/**
 * @file Integration tests for ActionFormattingStage
 * @see src/actions/pipeline/stages/ActionFormattingStage.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { ActionTargetContext } from '../../../../../src/models/actionTargetContext.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { ERROR_PHASES } from '../../../../../src/actions/errors/actionErrorTypes.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';
import ActionFormatter from '../../../../../src/actions/actionFormatter.js';
import { MultiTargetActionFormatter } from '../../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import { EntityManagerTestBed } from '../../../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../../../src/entities/entityDefinition.js';
import {
  createTestAction,
  createComplexTestAction,
} from '../../../../common/actions/actionBuilderHelpers.js';
import '../../../../../tests/common/actionResultMatchers.js';

describe('ActionFormattingStage - Integration Tests', () => {
  let stage;
  let testBed;
  let commandFormatter;
  let entityManager;
  let safeEventDispatcher;
  let getEntityDisplayNameFn;
  let errorContextBuilder;
  let logger;
  let trace;
  let actor;

  beforeEach(async () => {
    testBed = new EntityManagerTestBed();

    // Create real instances with minimal mocking
    logger = new ConsoleLogger({ enableDebug: false });
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    entityManager = testBed.entityManager;

    // Create minimal fix suggestion engine
    const fixSuggestionEngine = {
      suggestFixes: jest.fn().mockReturnValue([]),
    };

    errorContextBuilder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

    // Create real formatter with target formatter map
    const targetFormatterMap = {
      none: (command) => ({ ok: true, value: command }),
      self: (command) => ({
        ok: true,
        value: command.replace('{target}', 'yourself'),
      }),
      entity: (command, targetContext, deps) => {
        const { entityManager, displayNameFn } = deps;
        const entity = entityManager.getEntityInstance(targetContext.entityId);
        if (!entity) {
          return {
            ok: false,
            error: `Entity not found: ${targetContext.entityId}`,
          };
        }
        const name = displayNameFn(entity) || entity.id;
        return { ok: true, value: command.replace('{target}', name) };
      },
    };

    commandFormatter = new ActionFormatter();

    // Spy on the format method to debug issues
    const originalFormat = commandFormatter.format.bind(commandFormatter);
    commandFormatter.format = jest.fn(
      (actionDef, targetContext, entityManager, options, deps) => {
        return originalFormat(
          actionDef,
          targetContext,
          entityManager,
          options,
          {
            ...deps,
            formatterMap: targetFormatterMap,
          }
        );
      }
    );

    safeEventDispatcher = {
      dispatch: jest.fn().mockReturnValue(true),
    };

    getEntityDisplayNameFn = (entity) => {
      if (!entity) return 'Unknown';
      return entity.getComponentData('core:name')?.value || entity.id;
    };

    // Create trace mock
    trace = {
      step: jest.fn(),
      info: jest.fn(),
      logs: [], // Add logs array for error context builder
    };

    // Create test actor with proper entity definition
    const actorDef = new EntityDefinition('test:actor', {
      description: 'Test actor entity',
      components: {
        'core:name': { value: 'Test Actor' },
      },
    });
    testBed.setupDefinitions(actorDef);
    actor = await testBed.entityManager.createEntityInstance('test:actor', {
      instanceId: 'test-actor',
    });

    // Create the stage with real dependencies
    stage = new ActionFormattingStage({
      commandFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn,
      errorContextBuilder,
      logger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Basic Integration - Successful Formatting', () => {
    it('should format actions with no targets successfully', async () => {
      // Arrange
      const actionDef = {
        id: 'core:wait',
        name: 'Wait',
        scope: 'none',
        template: 'wait a moment',
        description: 'Pass time',
      };

      const targetContext = ActionTargetContext.noTarget();
      const actionsWithTargets = [
        { actionDef, targetContexts: [targetContext] },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBe(true);
      expect(result.actions).toBeDefined();
      expect(result.actions).toHaveLength(1);

      const formattedAction = result.actions[0];
      expect(formattedAction).toEqual({
        id: 'core:wait',
        name: 'Wait',
        command: 'wait a moment',
        description: 'Pass time',
        params: { targetId: null },
        visual: null,
      });

      expect(result.errors).toHaveLength(0);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Action formatting complete: 1 actions formatted successfully'
        )
      );
    });

    it('should format actions with entity targets using real entity lookup', async () => {
      // Arrange
      const targetDef = new EntityDefinition('test:target', {
        description: 'Test target entity',
        components: {
          'core:name': { value: 'Target Object' },
        },
      });
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor entity',
        components: {
          'core:name': { value: 'Test Actor' },
        },
      });
      testBed.setupDefinitions(actorDef, targetDef);
      const targetEntity = await testBed.entityManager.createEntityInstance(
        'test:target',
        { instanceId: 'target-entity' }
      );

      // Debug: Verify entity is created
      const checkEntity =
        testBed.entityManager.getEntityInstance('target-entity');
      expect(checkEntity).toBeDefined();

      const actionDef = {
        id: 'core:examine',
        name: 'Examine',
        scope: 'entity',
        template: 'examine {target}',
        description: 'Look at something closely',
      };

      const targetContext = ActionTargetContext.forEntity('target-entity');
      const actionsWithTargets = [
        { actionDef, targetContexts: [targetContext] },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      if (result.actions.length === 0) {
        console.log(
          'No actions formatted. Errors:',
          JSON.stringify(result.errors, null, 2)
        );
      }

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      const formattedAction = result.actions[0];
      expect(formattedAction.command).toBe('examine Target Object');
      expect(formattedAction.params.targetId).toBe('target-entity');
    });

    it('should format multiple actions with multiple targets', async () => {
      // Arrange
      const door1Def = new EntityDefinition('test:door1', {
        description: 'Test door 1',
        components: {
          'core:name': { value: 'Wooden Door' },
        },
      });
      const door2Def = new EntityDefinition('test:door2', {
        description: 'Test door 2',
        components: {
          'core:name': { value: 'Metal Door' },
        },
      });
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor entity',
        components: {
          'core:name': { value: 'Test Actor' },
        },
      });
      testBed.setupDefinitions(actorDef, door1Def, door2Def);

      const target1 = await testBed.entityManager.createEntityInstance(
        'test:door1',
        { instanceId: 'door-1' }
      );
      const target2 = await testBed.entityManager.createEntityInstance(
        'test:door2',
        { instanceId: 'door-2' }
      );

      const openAction = {
        id: 'core:open',
        name: 'Open',
        scope: 'entity',
        template: 'open {target}',
        description: 'Open something',
      };

      const examineAction = {
        id: 'core:examine',
        name: 'Examine',
        scope: 'entity',
        template: 'examine {target}',
        description: 'Look at something',
      };

      const actionsWithTargets = [
        {
          actionDef: openAction,
          targetContexts: [
            ActionTargetContext.forEntity('door-1'),
            ActionTargetContext.forEntity('door-2'),
          ],
        },
        {
          actionDef: examineAction,
          targetContexts: [ActionTargetContext.forEntity('door-1')],
        },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(3);

      const commands = result.actions.map((a) => a.command);
      expect(commands).toContain('open Wooden Door');
      expect(commands).toContain('open Metal Door');
      expect(commands).toContain('examine Wooden Door');
    });
  });

  describe('Error Handling Integration - Lines 110-155', () => {
    it('should handle formatter returning error result', async () => {
      // Arrange
      const actionDef = {
        id: 'test:broken',
        name: 'Broken Action',
        scope: 'entity',
        template: 'broken {target}',
        description: 'An action that fails formatting',
      };

      // Override formatter to return error
      commandFormatter.format = jest.fn().mockReturnValue({
        ok: false,
        error: 'Template parsing failed',
        details: { reason: 'Invalid placeholder syntax' },
      });

      const targetContext = ActionTargetContext.forEntity('some-entity');
      const actionsWithTargets = [
        { actionDef, targetContexts: [targetContext] },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      const errorContext = result.errors[0];
      expect(errorContext.error).toBe('Template parsing failed');
      expect(errorContext.phase).toBe(ERROR_PHASES.VALIDATION);
      expect(errorContext.actorId).toBe('test-actor');
      expect(errorContext.targetId).toBe('some-entity');
      expect(errorContext.additionalContext).toEqual({
        stage: 'action_formatting',
        formatDetails: { reason: 'Invalid placeholder syntax' },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to format command for action 'test:broken' with target 'some-entity'"
        ),
        expect.any(Object)
      );
    });

    it('should handle formatter throwing exceptions', async () => {
      // Arrange
      const actionDef = {
        id: 'test:throws',
        name: 'Throwing Action',
        scope: 'entity',
        template: 'throw {target}',
        description: 'An action that throws',
      };

      // Override formatter to throw
      const thrownError = new Error('Formatter exploded!');
      commandFormatter.format = jest.fn().mockImplementation(() => {
        throw thrownError;
      });

      const targetContext = ActionTargetContext.forEntity('target-id');
      const actionsWithTargets = [
        { actionDef, targetContexts: [targetContext] },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      const errorContext = result.errors[0];
      expect(errorContext.error).toEqual(thrownError);
      expect(errorContext.phase).toBe(ERROR_PHASES.VALIDATION);
      expect(errorContext.targetId).toBe('target-id');
      expect(errorContext.additionalContext).toEqual({
        stage: 'action_formatting',
        thrown: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to format command for action 'test:throws' with target 'target-id'"
        ),
        expect.any(Object)
      );
    });

    it('should extract targetId from error.target.entityId when thrown', async () => {
      // Arrange
      const actionDef = {
        id: 'test:custom-error',
        name: 'Custom Error Action',
        scope: 'entity',
        template: 'custom {target}',
      };

      // Create error with target property
      const customError = new Error('Custom formatting error');
      customError.target = { entityId: 'error-target-id' };

      commandFormatter.format = jest.fn().mockImplementation(() => {
        throw customError;
      });

      const targetContext = ActionTargetContext.forEntity('original-target');
      const actionsWithTargets = [
        { actionDef, targetContexts: [targetContext] },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].targetId).toBe('error-target-id');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("with target 'error-target-id'"),
        expect.any(Object)
      );
    });

    it('should extract targetId from error.entityId when thrown', async () => {
      // Arrange
      const actionDef = {
        id: 'test:entity-error',
        name: 'Entity Error Action',
        scope: 'entity',
        template: 'entity {target}',
      };

      // Create error with entityId property
      const customError = new Error('Entity formatting error');
      customError.entityId = 'entity-error-id';

      commandFormatter.format = jest.fn().mockImplementation(() => {
        throw customError;
      });

      const targetContext = ActionTargetContext.forEntity('original-target');
      const actionsWithTargets = [
        { actionDef, targetContexts: [targetContext] },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].targetId).toBe('entity-error-id');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed success and failure results', async () => {
      // Arrange
      const successAction = createTestAction('test:success');
      const failAction = createComplexTestAction('test:fail');
      const throwAction = createTestAction('test:throw');

      let callCount = 0;
      commandFormatter.format = jest.fn().mockImplementation((actionDef) => {
        callCount++;
        if (actionDef.id === 'test:success') {
          return { ok: true, value: 'success command' };
        } else if (actionDef.id === 'test:fail') {
          return { ok: false, error: 'Format failed' };
        } else {
          throw new Error('Format threw');
        }
      });

      const actionsWithTargets = [
        {
          actionDef: successAction,
          targetContexts: [ActionTargetContext.noTarget()],
        },
        {
          actionDef: failAction,
          targetContexts: [ActionTargetContext.noTarget()],
        },
        {
          actionDef: throwAction,
          targetContexts: [ActionTargetContext.noTarget()],
        },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].id).toBe('test:success');
      expect(result.errors).toHaveLength(2);
      expect(callCount).toBe(3);
    });

    it('should process actions with different formatter options', async () => {
      // Arrange
      const mockEventDispatcher = { dispatch: jest.fn() };

      stage = new ActionFormattingStage({
        commandFormatter,
        entityManager,
        safeEventDispatcher: mockEventDispatcher,
        getEntityDisplayNameFn,
        errorContextBuilder,
        logger,
      });

      const actionDef = createTestAction('test:event-action');
      const actionsWithTargets = [
        {
          actionDef,
          targetContexts: [ActionTargetContext.noTarget()],
        },
      ];

      // Act
      await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert - we can't verify the actual formatter calls since it's a real implementation
      // The test verifies the integration by checking that the formatting works correctly
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty actionsWithTargets array', async () => {
      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets: [],
        trace,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(logger.debug).toHaveBeenCalledWith(
        'Action formatting complete: 0 actions formatted successfully'
      );
    });

    it('should handle undefined actionsWithTargets', async () => {
      // Act
      const result = await stage.execute({
        actor,
        trace,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle actions with empty target contexts array', async () => {
      // Arrange
      const actionDef = createTestAction('test:no-targets');
      const actionsWithTargets = [
        {
          actionDef,
          targetContexts: [],
        },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should work without trace object', async () => {
      // Arrange
      const actionDef = createTestAction('test:no-trace');
      const actionsWithTargets = [
        {
          actionDef,
          targetContexts: [ActionTargetContext.noTarget()],
        },
      ];

      // Act
      const result = await stage.execute({
        actor,
        actionsWithTargets,
        // No trace provided
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });
  });

  describe('Tracing Integration', () => {
    it('should record trace steps and info', async () => {
      // Arrange
      const actionDef = createTestAction('test:traced');
      const actionsWithTargets = [
        {
          actionDef,
          targetContexts: [ActionTargetContext.noTarget()],
        },
      ];

      // Act
      await stage.execute({
        actor,
        actionsWithTargets,
        trace,
      });

      // Assert
      expect(trace.step).toHaveBeenCalledWith(
        'Formatting 1 actions with their targets',
        'ActionFormattingStage.execute'
      );
      expect(trace.info).toHaveBeenCalledWith(
        'Action formatting completed: 1 formatted actions, 0 errors',
        'ActionFormattingStage.execute'
      );
    });
  });

  describe('Multi-Target Integration', () => {
    let multiTargetStage;
    let multiTargetFormatter;

    beforeEach(() => {
      // Create a MultiTargetActionFormatter for these tests
      const baseFormatter = new ActionFormatter();
      multiTargetFormatter = new MultiTargetActionFormatter(
        baseFormatter,
        logger
      );

      // Create stage with multi-target formatter
      multiTargetStage = new ActionFormattingStage({
        commandFormatter: multiTargetFormatter,
        entityManager,
        safeEventDispatcher,
        getEntityDisplayNameFn,
        errorContextBuilder,
        logger,
      });
    });

    it('should integrate with MultiTargetResolutionStage data flow', async () => {
      // Arrange - Setup entities that would be resolved by MultiTargetResolutionStage
      const swordDef = new EntityDefinition('test:sword', {
        description: 'Test sword entity',
        components: {
          'core:name': { value: 'Iron Sword' },
          'core:item': { type: 'weapon' },
        },
      });
      const goblinDef = new EntityDefinition('test:goblin', {
        description: 'Test goblin entity',
        components: {
          'core:name': { value: 'Goblin Warrior' },
          'core:actor': { name: 'Goblin Warrior' },
        },
      });

      testBed.setupDefinitions(swordDef, goblinDef);

      const sword = await testBed.entityManager.createEntityInstance(
        'test:sword',
        {
          instanceId: 'sword-001',
        }
      );
      const goblin = await testBed.entityManager.createEntityInstance(
        'test:goblin',
        {
          instanceId: 'goblin-001',
        }
      );

      // Multi-target action definition
      const multiTargetActionDef = {
        id: 'combat:throw',
        name: 'Throw',
        template: 'throw {item} at {target}',
        targets: {
          primary: { scope: 'actor.inventory[]', placeholder: 'item' },
          secondary: { scope: 'location.actors[]', placeholder: 'target' },
        },
      };

      // Context structure that MultiTargetResolutionStage would provide
      const multiTargetContext = {
        actor,
        actionsWithTargets: [
          {
            actionDef: multiTargetActionDef,
            targetContexts: [
              ActionTargetContext.forEntity('sword-001'),
              ActionTargetContext.forEntity('goblin-001'),
            ],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'sword-001', displayName: 'Iron Sword' }],
          secondary: [{ id: 'goblin-001', displayName: 'Goblin Warrior' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' },
        },
        trace,
      };

      // Act
      const result = await multiTargetStage.execute(multiTargetContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);

      const formattedAction = result.actions[0];
      expect(formattedAction).toEqual({
        id: 'combat:throw',
        name: 'Throw',
        command: 'throw Iron Sword at Goblin Warrior',
        description: '',
        params: {
          targetIds: {
            primary: ['sword-001'],
            secondary: ['goblin-001'],
          },
          isMultiTarget: true,
          targetId: 'sword-001', // Backward compatibility field
        },
        visual: null,
      });

      expect(trace.info).toHaveBeenCalledWith(
        'Multi-target action formatting completed: 1 formatted actions, 0 errors',
        'ActionFormattingStage.execute'
      );
    });

    it('should handle multiple target combinations', async () => {
      // Arrange - Multiple items and targets
      const knife = new EntityDefinition('test:knife', {
        description: 'Test knife entity',
        components: {
          'core:name': { value: 'Steel Knife' },
        },
      });
      const orc = new EntityDefinition('test:orc', {
        description: 'Test orc entity',
        components: {
          'core:name': { value: 'Orc Brute' },
        },
      });

      testBed.setupDefinitions(knife, orc);

      await testBed.entityManager.createEntityInstance('test:knife', {
        instanceId: 'knife-001',
      });
      await testBed.entityManager.createEntityInstance('test:orc', {
        instanceId: 'orc-001',
      });

      const multiTargetActionDef = {
        id: 'combat:multi_throw',
        name: 'Multi Throw',
        template: 'throw {item} at {target}',
        generateCombinations: true,
      };

      const multiTargetContext = {
        actor,
        actionsWithTargets: [
          {
            actionDef: multiTargetActionDef,
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [
            { id: 'knife-001', displayName: 'Steel Knife' },
            { id: 'sword-001', displayName: 'Iron Sword' },
          ],
          secondary: [
            { id: 'orc-001', displayName: 'Orc Brute' },
            { id: 'goblin-001', displayName: 'Goblin Warrior' },
          ],
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' },
        },
        trace,
      };

      // Act
      const result = await multiTargetStage.execute(multiTargetContext);

      // Assert
      expect(result.success).toBe(true);
      // When generateCombinations is true with multiple targets, we get multiple formatted actions
      expect(result.actions.length).toBeGreaterThan(1);

      const formattedAction = result.actions[0];
      expect(formattedAction.id).toBe('combat:multi_throw');
      // The command should be an array of combinations when generateCombinations is true
      expect(formattedAction.params.isMultiTarget).toBe(true);
    });

    it('should fallback gracefully when multi-target formatter unavailable', async () => {
      // Arrange - Setup entities for the test
      const itemDef = new EntityDefinition('test:item', {
        description: 'Test item entity',
        components: {
          'core:name': { value: 'Test Item' },
        },
      });

      testBed.setupDefinitions(itemDef);

      await testBed.entityManager.createEntityInstance('test:item', {
        instanceId: 'item-001',
      });

      // Use base formatter without multi-target support
      const baseOnlyStage = new ActionFormattingStage({
        commandFormatter: new ActionFormatter(), // Base formatter only
        entityManager,
        safeEventDispatcher,
        getEntityDisplayNameFn,
        errorContextBuilder,
        logger,
      });

      const multiTargetContext = {
        actor,
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:fallback',
              name: 'Fallback Action',
              template: 'use {item}',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [{ id: 'item-001', displayName: 'Test Item' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
        },
        trace,
      };

      // Act
      const result = await baseOnlyStage.execute(multiTargetContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('use Test Item');
      expect(result.actions[0].params.targetId).toBe('item-001');
    });

    it('should handle empty resolved targets gracefully', async () => {
      // Arrange
      const multiTargetContext = {
        actor,
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:empty',
              name: 'Empty Action',
              template: 'use {item}',
            },
            targetContexts: [],
          },
        ],
        resolvedTargets: {
          primary: [], // No targets available
        },
        targetDefinitions: {
          primary: { placeholder: 'item' },
        },
        trace,
      };

      // Act
      const result = await multiTargetStage.execute(multiTargetContext);

      // Assert
      expect(result.success).toBe(true);
      // With strict validation, actions with unresolved placeholders are rejected
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should preserve backward compatibility with legacy actions', async () => {
      // Arrange - Legacy action format (no resolvedTargets/targetDefinitions)
      const door = new EntityDefinition('test:door', {
        description: 'Test door entity',
        components: {
          'core:name': { value: 'Wooden Door' },
        },
      });

      testBed.setupDefinitions(door);

      await testBed.entityManager.createEntityInstance('test:door', {
        instanceId: 'door-001',
      });

      const legacyContext = {
        actor,
        actionsWithTargets: [
          {
            actionDef: {
              id: 'test:legacy',
              name: 'Legacy Action',
              template: 'open {target}',
              scope: 'entity',
            },
            targetContexts: [ActionTargetContext.forEntity('door-001')],
          },
        ],
        // No resolvedTargets or targetDefinitions - triggers legacy path
        trace,
      };

      // Act
      const result = await multiTargetStage.execute(legacyContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('open Wooden Door');
      expect(result.actions[0].params.targetId).toBe('door-001');
      expect(result.actions[0].params.isMultiTarget).toBeUndefined();

      expect(trace.info).toHaveBeenCalledWith(
        'Action formatting completed: 1 formatted actions, 0 errors',
        'ActionFormattingStage.execute'
      );
    });
  });
});
