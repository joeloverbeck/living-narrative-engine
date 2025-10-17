/**
 * @file Integration tests for ActionFormattingStage standard execution paths without action-aware tracing.
 * @description Ensures the stage formats actions correctly when operating in legacy mode and when
 *              using per-action metadata while interacting with real pipeline collaborators.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionFormattingStage } from '../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.debug = this.#collect('debug');
    this.info = this.#collect('info');
    this.warn = this.#collect('warn');
    this.error = this.#collect('error');
    this.messages = { debug: [], info: [], warn: [], error: [] };
  }

  #collect(level) {
    return (...args) => {
      this.messages[level].push(args.map((value) => String(value)).join(' '));
    };
  }
}

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    return true;
  }
}

class RecordingErrorContextBuilder {
  constructor() {
    this.calls = [];
  }

  buildErrorContext(payload) {
    const context = { ...payload };
    this.calls.push(context);
    return context;
  }
}

class DeterministicCommandFormatter {
  constructor() {
    this.behaviors = new Map();
    this.formatCalls = [];
    this.formatMultiTargetCalls = [];
  }

  setBehavior(actionId, behavior) {
    this.behaviors.set(actionId, behavior);
  }

  format(actionDef, targetContext) {
    this.formatCalls.push({ actionId: actionDef.id, targetContext });
    const behavior = this.behaviors.get(actionDef.id);
    if (behavior?.format === 'fail') {
      return {
        ok: false,
        error: new Error(`format failure for ${actionDef.id}`),
        details: { reason: 'legacy-format-failed' },
      };
    }
    const displayName = targetContext.displayName || targetContext.entityId;
    return {
      ok: true,
      value: `${actionDef.name}:${displayName}`,
    };
  }

  formatMultiTarget(actionDef, resolvedTargets) {
    this.formatMultiTargetCalls.push({
      actionId: actionDef.id,
      resolvedTargets,
    });
    const behavior = this.behaviors.get(actionDef.id);
    if (behavior?.multi === 'fail') {
      return {
        ok: false,
        error: new Error(`multi failure for ${actionDef.id}`),
        details: { reason: 'multi-format-failed' },
      };
    }

    if (behavior?.multi === 'array') {
      return {
        ok: true,
        value: [
          {
            command: `${actionDef.id}:alpha`,
            targets: { primary: resolvedTargets.primary },
          },
          `${actionDef.id}:beta`,
        ],
      };
    }

    return {
      ok: true,
      value: `${actionDef.id}:multi-formatted`,
    };
  }
}

describe('ActionFormattingStage standard execution (no action-aware trace)', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {RecordingLogger} */
  let logger;
  /** @type {RecordingDispatcher} */
  let dispatcher;
  /** @type {RecordingErrorContextBuilder} */
  let errorBuilder;
  /** @type {DeterministicCommandFormatter} */
  let commandFormatter;
  /** @type {ActionFormattingStage} */
  let stage;
  /** @type {(entityId: string) => string} */
  let getEntityDisplayName;

  beforeEach(() => {
    logger = new RecordingLogger();
    dispatcher = new RecordingDispatcher();
    errorBuilder = new RecordingErrorContextBuilder();
    commandFormatter = new DeterministicCommandFormatter();
    commandFormatter.format = commandFormatter.format.bind(commandFormatter);
    commandFormatter.formatMultiTarget =
      commandFormatter.formatMultiTarget.bind(commandFormatter);

    entityManager = new SimpleEntityManager([
      {
        id: 'actor-1',
        components: {
          'core:profile': { name: 'Astra' },
        },
      },
      {
        id: 'target-1',
        components: {
          'core:profile': { name: 'Target One' },
        },
      },
      {
        id: 'target-2',
        components: {
          'core:profile': { name: 'Target Two' },
        },
      },
      {
        id: 'target-3',
        components: {
          'core:profile': { name: 'Target Three' },
        },
      },
    ]);

    getEntityDisplayName = (entityId) => {
      const entity = entityManager.getEntityInstance(entityId);
      return entity?.components['core:profile']?.name || entityId;
    };

    stage = new ActionFormattingStage({
      commandFormatter,
      entityManager,
      safeEventDispatcher: dispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorContextBuilder: errorBuilder,
      logger,
    });
  });

  it('formats actions using per-action metadata, including fallbacks and error propagation', async () => {
    commandFormatter.setBehavior('multi-fallback', { multi: 'fail' });
    commandFormatter.setBehavior('multi-error', {
      multi: 'fail',
      format: 'fail',
    });
    commandFormatter.setBehavior('multi-success', { multi: 'array' });

    const result = await stage.executeInternal({
      actor: { id: 'actor-1' },
      actionsWithTargets: [
        {
          actionDef: { id: 'multi-success', name: 'Multi Success' },
          targetContexts: [
            {
              type: 'entity',
              entityId: 'target-1',
              displayName: 'Target One',
              placeholder: 'target',
            },
          ],
          resolvedTargets: {
            primary: [{ id: 'target-1', displayName: 'Target One' }],
          },
          targetDefinitions: {
            primary: { placeholder: 'target' },
          },
          isMultiTarget: true,
        },
        {
          actionDef: {
            id: 'multi-fallback',
            name: 'Multi Fallback',
            template: 'Use {primary}',
          },
          targetContexts: [
            {
              type: 'entity',
              entityId: 'target-2',
              displayName: 'Target Two',
              placeholder: 'primary',
            },
          ],
          resolvedTargets: {
            primary: [{ id: 'target-2', displayName: 'Target Two' }],
          },
          targetDefinitions: {
            primary: { placeholder: 'primary' },
          },
          isMultiTarget: true,
        },
        {
          actionDef: {
            id: 'multi-error',
            name: 'Multi Error',
            template: 'Strike {primary}',
          },
          targetContexts: [
            {
              type: 'entity',
              entityId: 'target-3',
              displayName: 'Target Three',
              placeholder: 'primary',
            },
          ],
          resolvedTargets: {
            primary: [{ id: 'target-3', displayName: 'Target Three' }],
          },
          targetDefinitions: {
            primary: { placeholder: 'primary' },
          },
          isMultiTarget: true,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(3);

    const commands = result.actions.map((action) => ({
      id: action.id,
      command: action.command,
    }));
    expect(commands).toEqual([
      { id: 'multi-success', command: 'multi-success:alpha' },
      { id: 'multi-success', command: 'multi-success:beta' },
      { id: 'multi-fallback', command: 'Multi Fallback:Target Two' },
    ]);

    expect(result.errors).toHaveLength(1);
    expect(errorBuilder.calls).toHaveLength(1);
    expect(errorBuilder.calls[0]).toMatchObject({
      actionDef: { id: 'multi-error' },
      actorId: 'actor-1',
      targetId: 'target-3',
      additionalContext: { stage: 'action_formatting' },
    });

    expect(commandFormatter.formatMultiTargetCalls).toHaveLength(3);
    expect(
      commandFormatter.formatCalls.some(
        (call) => call.actionId === 'multi-fallback'
      )
    ).toBe(true);
    expect(
      commandFormatter.formatCalls.some(
        (call) => call.actionId === 'multi-error'
      )
    ).toBe(true);
  });

  it('formats legacy actions and logs warnings when multi-target definitions are processed via the legacy path', async () => {
    commandFormatter.setBehavior('legacy-multi', { multi: 'fail' });
    commandFormatter.setBehavior('legacy-error', { format: 'fail' });

    const result = await stage.executeInternal({
      actor: { id: 'actor-1' },
      actionsWithTargets: [
        {
          actionDef: {
            id: 'legacy-multi',
            name: 'Legacy Multi',
            template: 'Speak to {target}',
            targets: { primary: { placeholder: 'target' } },
          },
          targetContexts: [
            {
              type: 'entity',
              entityId: 'target-1',
              displayName: 'Target One',
              placeholder: 'target',
            },
            {
              type: 'entity',
              entityId: 'target-2',
              displayName: 'Target Two',
              placeholder: 'target',
            },
          ],
        },
        {
          actionDef: {
            id: 'legacy-error',
            name: 'Legacy Error',
            template: 'Signal {target}',
          },
          targetContexts: [
            {
              type: 'entity',
              entityId: 'target-3',
              displayName: 'Target Three',
              placeholder: 'target',
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(2);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'legacy-multi',
          command: 'Legacy Multi:Target One',
          params: expect.objectContaining({ targetId: 'target-1' }),
        }),
        expect.objectContaining({
          id: 'legacy-multi',
          command: 'Legacy Multi:Target Two',
          params: expect.objectContaining({ targetId: 'target-2' }),
        }),
      ])
    );

    expect(result.errors).toHaveLength(1);
    expect(errorBuilder.calls).toHaveLength(1);
    expect(errorBuilder.calls[0]).toMatchObject({
      actionDef: { id: 'legacy-error' },
      targetId: 'target-3',
    });

    expect(logger.messages.warn).toHaveLength(0);
  });

  it('processes top-level multi-target resolution data when no per-action metadata is provided', async () => {
    commandFormatter.setBehavior('global-multi', { multi: 'fail' });

    const result = await stage.executeInternal({
      actor: { id: 'actor-1' },
      actionsWithTargets: [
        {
          actionDef: {
            id: 'global-multi',
            name: 'Global Multi',
            template: 'Use {primary} on {secondary}',
            targets: {
              primary: { placeholder: 'primary' },
              secondary: { placeholder: 'secondary' },
            },
          },
        },
      ],
      resolvedTargets: {
        primary: [{ id: 'target-1', displayName: 'Target One' }],
        secondary: [{ id: 'target-2', displayName: 'Target Two' }],
      },
      targetDefinitions: {
        primary: { placeholder: 'primary' },
        secondary: { placeholder: 'secondary' },
      },
    });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([
      {
        id: 'global-multi',
        name: 'Global Multi',
        command: 'Global Multi:Target One',
        description: '',
        params: {
          targetId: 'target-1',
          isMultiTarget: true,
          targetIds: {
            primary: ['target-1'],
            secondary: ['target-2'],
          },
        },
        visual: null,
      },
    ]);

    expect(commandFormatter.formatMultiTargetCalls).toHaveLength(1);
    expect(
      commandFormatter.formatCalls.some(
        (call) => call.actionId === 'global-multi'
      )
    ).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
