import { describe, it, expect } from '@jest/globals';
import ContextUpdateEmitter from '../../../../src/actions/pipeline/services/implementations/ContextUpdateEmitter.js';
import TargetValidationIOAdapter from '../../../../src/actions/pipeline/adapters/TargetValidationIOAdapter.js';
import { ACTOR_ROLE } from '../../../../src/actions/pipeline/TargetRoleRegistry.js';

const createEntity = (id, components = {}) => ({
  id,
  components,
  componentTypeIds: Object.keys(components),
  getComponentData(type) {
    return components[type] ?? null;
  },
  hasComponent(type) {
    return Object.prototype.hasOwnProperty.call(components, type);
  },
  getAllComponents() {
    return components;
  },
});

const createCandidate = (entity, extras = {}) => ({
  id: entity.id,
  entity,
  ...extras,
});

describe('ContextUpdateEmitter additional branch coverage integration', () => {
  it('preserves existing actionsWithTargets entries when normalized items rely on original references', () => {
    const emitter = new ContextUpdateEmitter();
    const adapter = new TargetValidationIOAdapter();

    const actor = createEntity('actor:branches');
    const companion = createEntity('companion:1', { 'core:ally': {} });

    const baseEntry = {
      actionDef: {
        name: 'branch-only-action',
      },
      targetDefinitions: { companion: { placeholder: 'primary' } },
      targetContexts: [
        {
          type: 'entity',
          entity: companion,
          entityId: companion.id,
          placeholder: 'companion',
        },
      ],
      resolvedTargets: {
        [ACTOR_ROLE]: createCandidate(actor),
        companion: [createCandidate(companion, { mood: 'calm' })],
        direct: companion,
      },
    };

    const dropEntry = {
      actionDef: {
        id: 'branch:drop-me',
        name: 'Drop Me',
      },
      resolvedTargets: {
        [ACTOR_ROLE]: createCandidate(actor),
        companion: [createCandidate(companion)],
      },
      targetContexts: [
        {
          type: 'entity',
          entity: companion,
          entityId: companion.id,
          placeholder: 'companion',
        },
      ],
    };

    const context = {
      actor,
      actionsWithTargets: [baseEntry, dropEntry],
    };

    const normalized = adapter.normalize(context);
    const primaryItem = normalized.items[0];
    const secondaryItem = normalized.items[1];

    // Force fallback branches to use original references while leaving context array intact.
    primaryItem.targetDefinitions = undefined;
    primaryItem.targetContexts = undefined;
    primaryItem.resolvedTargets = {
      [ACTOR_ROLE]: createCandidate(actor),
    };

    const metadata = {
      ...normalized.metadata,
      stageUpdates: 'not-an-array',
    };

    const results = emitter.applyTargetValidationResults({
      context,
      format: normalized.format,
      items: normalized.items,
      metadata,
      validatedItems: [primaryItem],
    });

    expect(normalized.format).toBe('actionsWithTargets');
    expect(Array.isArray(context.actionsWithTargets)).toBe(true);
    expect(context.actionsWithTargets).toHaveLength(1);

    const [rebuiltEntry] = context.actionsWithTargets;
    expect(rebuiltEntry.actionDef).toBe(primaryItem.actionDef);
    expect(rebuiltEntry.targetDefinitions).toEqual(baseEntry.targetDefinitions);
    expect(rebuiltEntry.targetContexts).toEqual(baseEntry.targetContexts);
    expect(rebuiltEntry.targetContexts[0].entity).toBe(companion);
    expect(rebuiltEntry.resolvedTargets).toBeNull();

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      actionId: null,
      kept: true,
      keptTargets: null,
      stageUpdates: [],
    });
    expect(results[1]).toMatchObject({
      actionId: secondaryItem.actionDef.id,
      kept: false,
    });
  });

  it('initialises actionsWithTargets when context has no array and preserves direct entity references', () => {
    const emitter = new ContextUpdateEmitter();
    const adapter = new TargetValidationIOAdapter();

    const actor = createEntity('actor:init-array');
    const ally = createEntity('ally:init');

    const context = {
      actor,
      actionsWithTargets: null,
      resolvedTargets: {
        ally,
      },
    };

    const normalized = adapter.normalize({
      actor,
      actionsWithTargets: [
        {
          actionDef: { id: 'init:ally', name: 'Ally Action' },
          resolvedTargets: {
            [ACTOR_ROLE]: createCandidate(actor),
            ally,
          },
          targetContexts: [
            {
              type: 'entity',
              entity: ally,
              entityId: ally.id,
              placeholder: 'ally',
            },
          ],
        },
      ],
    });

    const [item] = normalized.items;
    item.originalRef = null;

    const results = emitter.applyTargetValidationResults({
      context,
      format: normalized.format,
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems: [item],
    });

    expect(context.actionsWithTargets).toHaveLength(1);
    const [rebuiltEntry] = context.actionsWithTargets;
    expect(rebuiltEntry.resolvedTargets.ally).toBe(ally);
    expect(rebuiltEntry.targetContexts[0].entity).toBe(ally);
    expect(results[0].keptTargets.ally).toBe(ally);
  });

  it('updates candidateActions while trimming shared targets and normalising stage update metadata', () => {
    const emitter = new ContextUpdateEmitter();
    const adapter = new TargetValidationIOAdapter();

    const actor = createEntity('actor:candidate');
    const support = createEntity('support:1');
    const nested = createEntity('nested:1');
    const friend = createEntity('friend:1');
    const obsolete = createEntity('obsolete:1');

    const keepAction = {
      label: 'keep-targets',
      resolvedTargets: {
        [ACTOR_ROLE]: createCandidate(actor),
        support: [
          createCandidate(support, {
            extras: {
              watchers: [{ id: 'spectator:1' }],
            },
          }),
          { id: 'label-only', note: 'no entity present' },
        ],
        nested: {
          entity: nested,
          detail: { summary: 'info', list: [1, { tag: 'deep' }] },
        },
        literal: 'value',
        direct: support,
      },
    };

    const actorOnlyAction = {
      label: 'actor-only',
      resolvedTargets: {
        [ACTOR_ROLE]: createCandidate(actor),
      },
    };

    const dropAction = {
      id: 'candidate:drop',
      resolvedTargets: {
        [ACTOR_ROLE]: createCandidate(actor),
        friend: [createCandidate(friend, { mood: 'calm' })],
      },
    };

    const context = {
      actor,
      candidateActions: [keepAction, actorOnlyAction, dropAction],
      resolvedTargets: {
        support: [createCandidate(support)],
        nested: { entity: nested },
        obsolete: [createCandidate(obsolete)],
      },
    };

    const normalized = adapter.normalize(context);

    const metadata = {
      ...normalized.metadata,
      sharedResolvedTargetsRef: {
        support: [createCandidate(createEntity('stale-support'))],
        nested: { entity: createEntity('stale-nested') },
        obsolete: [createCandidate(createEntity('stale-obsolete'))],
      },
      stageUpdates: [
        {
          stage: 'sync-stage',
          type: 'normalise',
          removedTargets: null,
          removalReasons: 'not-an-array',
        },
        {
          stage: 'sync-stage',
          type: 'pruned',
          actionId: dropAction.id,
          removedTargets: [{ role: 'friend', reason: 'filtered-out' }],
          removalReasons: ['filtered-out'],
        },
      ],
    };

    // Force a validated item to have null resolved targets to exercise guard clauses.
    normalized.items[1].resolvedTargets = null;

    const results = emitter.applyTargetValidationResults({
      context,
      format: normalized.format,
      items: normalized.items,
      metadata,
      validatedItems: [normalized.items[0], normalized.items[1]],
    });

    expect(normalized.format).toBe('candidateActions');
    expect(results).toHaveLength(3);

    expect(results[0]).toMatchObject({
      actionId: null,
      kept: true,
      keptTargets: expect.objectContaining({
        support: expect.arrayContaining([
          expect.objectContaining({ entity: support }),
          expect.objectContaining({
            id: 'label-only',
            note: 'no entity present',
          }),
        ]),
        nested: expect.objectContaining({ entity: nested }),
        literal: 'value',
      }),
      stageUpdates: [
        expect.objectContaining({
          actionId: null,
          removedTargets: [],
          removalReasons: [],
        }),
      ],
    });

    expect(results[1]).toMatchObject({
      actionId: null,
      kept: true,
      keptTargets: null,
      stageUpdates: [
        expect.objectContaining({ removedTargets: [], removalReasons: [] }),
      ],
    });

    expect(results[2]).toMatchObject({
      actionId: dropAction.id,
      kept: false,
      stageUpdates: [
        expect.objectContaining({
          actionId: dropAction.id,
          removedTargets: [{ role: 'friend', reason: 'filtered-out' }],
          removalReasons: ['filtered-out'],
        }),
      ],
    });

    expect(context.candidateActions).toHaveLength(2);
    expect(context.candidateActions[0]).toBe(keepAction);
    expect(context.candidateActions[0].resolvedTargets.support[0].entity).toBe(
      support
    );
    expect(context.candidateActions[0].resolvedTargets.support[0]).not.toBe(
      normalized.items[0].resolvedTargets.support[0]
    );
    expect(context.candidateActions[0].resolvedTargets.support[1]).toEqual(
      expect.objectContaining({ id: 'label-only', note: 'no entity present' })
    );
    expect(context.candidateActions[1]).toBe(actorOnlyAction);
    expect(
      Object.prototype.hasOwnProperty.call(actorOnlyAction, 'resolvedTargets')
    ).toBe(false);

    expect(metadata.sharedResolvedTargetsRef).toEqual(
      expect.objectContaining({
        support: expect.arrayContaining([
          expect.objectContaining({ entity: support }),
        ]),
        nested: expect.objectContaining({ entity: nested }),
      })
    );
    expect(metadata.sharedResolvedTargetsRef.obsolete).toBeUndefined();
  });

  it('skips shared target synchronisation when metadata reference is missing and handles empty items', () => {
    const emitter = new ContextUpdateEmitter();
    const adapter = new TargetValidationIOAdapter();

    const actor = createEntity('actor:empty');

    const context = {
      actor,
      candidateActions: [
        {
          id: 'empty:action',
          resolvedTargets: null,
        },
      ],
    };

    const normalized = adapter.normalize(context);
    normalized.items[0].resolvedTargets = null;

    const metadata = {
      ...normalized.metadata,
      sharedResolvedTargetsRef: null,
      stageUpdates: [],
    };

    const results = emitter.applyTargetValidationResults({
      context,
      format: normalized.format,
      items: normalized.items,
      metadata,
      validatedItems: normalized.items,
    });

    expect(results).toHaveLength(1);
    expect(results[0].keptTargets).toBeNull();
    expect(metadata.sharedResolvedTargetsRef).toBeNull();

    const emptyResults = emitter.applyTargetValidationResults({
      context,
      format: 'empty',
      items: [],
      metadata: {},
      validatedItems: [],
    });

    expect(emptyResults).toEqual([]);
  });

  it('ignores unsupported formats while still returning result metadata', () => {
    const emitter = new ContextUpdateEmitter();
    const adapter = new TargetValidationIOAdapter();

    const actor = createEntity('actor:unsupported');
    const ally = createEntity('ally:unsupported');

    const context = {
      actor,
      candidateActions: [
        {
          id: 'unsupported:action',
          resolvedTargets: {
            [ACTOR_ROLE]: createCandidate(actor),
            ally: [createCandidate(ally)],
          },
        },
      ],
    };

    const normalized = adapter.normalize(context);

    const results = emitter.applyTargetValidationResults({
      context: { ...context },
      format: 'empty',
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems: [],
    });

    expect(results).toHaveLength(1);
    expect(results[0].actionId).toBe('unsupported:action');
    expect(results[0].kept).toBe(false);
    expect(context.candidateActions[0].resolvedTargets.ally[0].entity).toBe(
      ally
    );
  });
});
