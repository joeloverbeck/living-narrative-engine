import { describe, it, expect, beforeEach } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { ActionFormattingStage } from '../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { ActionIndexingService } from '../../../src/turns/services/actionIndexingService.js';

describe('Multi-target action formatting integration', () => {
  let formatter;
  let mockLogger;
  let baseFormatter;
  let formattingStage;
  let indexingService;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    baseFormatter = new ActionCommandFormatter();
    formatter = new MultiTargetActionFormatter(baseFormatter, mockLogger);

    const mockEntityManager = {};
    const mockEventDispatcher = {
      emit: jest.fn(),
    };

    formattingStage = new ActionFormattingStage({
      commandFormatter: formatter,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });

    indexingService = new ActionIndexingService({ logger: mockLogger });
  });

  it('should generate separate actions with unique params for each target', async () => {
    // Setup action definition and targets
    const actionDef = {
      id: 'personal-space:get_close',
      name: 'Get Close',
      template: 'get close to {target}',
      description: 'Move closer to target',
    };

    const resolvedTargets = {
      primary: [
        {
          id: 'p_erotica:amaia_castillo_instance',
          displayName: 'Amaia Castillo',
        },
        { id: 'p_erotica:jon_urena_instance', displayName: 'Jon Ureña' },
      ],
    };

    const targetDefinitions = {
      primary: {
        placeholder: 'target',
        optional: false,
      },
    };

    // Create the context for the formatting stage
    const context = {
      actor: { id: 'test_actor' },
      resolvedTargets,
      targetDefinitions,
      actionsWithTargets: [
        { actionDef, resolvedTargets, targetDefinitions, isMultiTarget: true },
      ],
    };

    // Execute the formatting stage
    const result = await formattingStage.execute(context);

    expect(result.success).toBe(true);

    const formattedActions = result.actions;

    // Should have 2 separate actions
    expect(formattedActions).toHaveLength(2);

    // Check that each action has unique params
    const firstAction = formattedActions[0];
    const secondAction = formattedActions[1];

    // Verify commands are correct
    expect(firstAction.command).toBe('get close to Amaia Castillo');
    expect(secondAction.command).toBe('get close to Jon Ureña');

    // Verify params are unique (each has only one target)
    expect(firstAction.params.targetIds.primary).toHaveLength(1);
    expect(firstAction.params.targetIds.primary[0]).toBe(
      'p_erotica:amaia_castillo_instance'
    );
    expect(firstAction.params.targetId).toBe(
      'p_erotica:amaia_castillo_instance'
    );

    expect(secondAction.params.targetIds.primary).toHaveLength(1);
    expect(secondAction.params.targetIds.primary[0]).toBe(
      'p_erotica:jon_urena_instance'
    );
    expect(secondAction.params.targetId).toBe('p_erotica:jon_urena_instance');

    // Now test that these don't get deduplicated
    const discovered = formattedActions.map((action) => ({
      id: action.id,
      command: action.command,
      params: action.params,
      description: action.description,
    }));

    const indexed = indexingService.indexActions('test_actor', discovered);

    // Both actions should be indexed (not deduplicated)
    expect(indexed).toHaveLength(2);
    expect(indexed[0].commandString).toBe('get close to Amaia Castillo');
    expect(indexed[1].commandString).toBe('get close to Jon Ureña');
  });

  it('should handle backward compatibility with string-only formatters', async () => {
    // Test that the system still works with formatters that return strings
    const mockFormatter = {
      formatMultiTarget: jest.fn().mockReturnValue({
        ok: true,
        value: ['command 1', 'command 2'], // Just strings, not objects
      }),
      format: jest.fn(),
    };

    const mockEntityManager = {};
    const mockEventDispatcher = {
      emit: jest.fn(),
    };

    const stage = new ActionFormattingStage({
      commandFormatter: mockFormatter,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });

    const context = {
      actor: { id: 'test_actor' },
      resolvedTargets: {
        primary: [
          { id: 'target1', displayName: 'Target 1' },
          { id: 'target2', displayName: 'Target 2' },
        ],
      },
      targetDefinitions: {
        primary: { placeholder: 'target' },
      },
      actionsWithTargets: [
        {
          actionDef: { id: 'test:action', name: 'Test' },
          resolvedTargets: {
            primary: [
              { id: 'target1', displayName: 'Target 1' },
              { id: 'target2', displayName: 'Target 2' },
            ],
          },
          targetDefinitions: { primary: { placeholder: 'target' } },
          isMultiTarget: true,
        },
      ],
    };

    const result = await stage.execute(context);

    expect(result.success).toBe(true);
    const actions = result.actions;
    expect(actions).toHaveLength(2);

    // When formatter returns strings, it should still work but with all targets
    // (backward compatibility mode)
    expect(actions[0].command).toBe('command 1');
    expect(actions[1].command).toBe('command 2');
  });
});
