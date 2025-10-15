/**
 * @file Unit tests for ContextUpdateEmitter
 */

import ContextUpdateEmitter from '../../../../../../src/actions/pipeline/services/implementations/ContextUpdateEmitter.js';
import TargetValidationIOAdapter from '../../../../../../src/actions/pipeline/adapters/TargetValidationIOAdapter.js';
import { ACTOR_ROLE } from '../../../../../../src/actions/pipeline/TargetRoleRegistry.js';

describe('ContextUpdateEmitter', () => {
  let adapter;
  let emitter;

  beforeEach(() => {
    adapter = new TargetValidationIOAdapter();
    emitter = new ContextUpdateEmitter();
  });

  it('synchronises legacy candidate actions and stage updates deterministically', () => {
    const actor = { id: 'actor-1', name: 'Hero' };
    const candidateActions = [
      {
        id: 'action-keep',
        resolvedTargets: {
          primary: [{ id: 'enemy-1', name: 'Goblin' }],
          support: { id: 'support-legacy', name: 'Old Support' },
        },
      },
      {
        id: 'action-drop',
        resolvedTargets: {
          primary: [{ id: 'enemy-2', name: 'Orc' }],
        },
      },
    ];

    const context = {
      actor,
      candidateActions,
      resolvedTargets: {
        primary: { id: 'stale-primary' },
        support: { id: 'stale-support' },
      },
    };

    const { format, items, metadata } = adapter.normalize(context);
    expect(format).toBe('candidateActions');

    // Simulate validation/pruning mutations
    items[0].resolvedTargets = {
      primary: [{ id: 'enemy-1', name: 'Goblin' }],
      support: [{ id: 'support-1', name: 'Priest' }],
      [ACTOR_ROLE]: actor,
    };
    items[0].targetContexts = [
      { type: 'entity', entityId: 'enemy-1', placeholder: 'primary' },
      { type: 'entity', entityId: 'support-1', placeholder: 'support' },
    ];
    items[1].resolvedTargets = null;

    metadata.stageUpdates = [
      {
        stage: 'TargetComponentValidation',
        type: 'targetCandidatePruner',
        actionId: 'action-drop',
        removedTargets: [
          {
            role: 'primary',
            targetId: 'enemy-2',
            placeholder: 'primary',
            reason: 'Missing required component',
            reasonCode: 'missing_component',
          },
        ],
        removalReasons: ['Missing required targets'],
      },
    ];

    const results = emitter.applyTargetValidationResults({
      context,
      format,
      items,
      metadata,
      validatedItems: [items[0]],
    });

    expect(context.candidateActions).toHaveLength(1);
    expect(context.candidateActions[0]).toBe(candidateActions[0]);
    expect(candidateActions[0].resolvedTargets).toEqual({
      primary: [{ id: 'enemy-1', name: 'Goblin' }],
      support: [{ id: 'support-1', name: 'Priest' }],
    });
    expect(candidateActions[1].resolvedTargets).toBeUndefined();
    expect(context.resolvedTargets).toEqual({
      primary: [{ id: 'enemy-1', name: 'Goblin' }],
      support: [{ id: 'support-1', name: 'Priest' }],
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      actionId: 'action-keep',
      kept: true,
      keptTargets: {
        primary: [{ id: 'enemy-1', name: 'Goblin' }],
        support: [{ id: 'support-1', name: 'Priest' }],
      },
    });
    expect(results[1]).toMatchObject({
      actionId: 'action-drop',
      kept: false,
      keptTargets: null,
      stageUpdates: [
        expect.objectContaining({
          actionId: 'action-drop',
          removedTargets: [
            expect.objectContaining({
              role: 'primary',
              targetId: 'enemy-2',
            }),
          ],
          removalReasons: ['Missing required targets'],
        }),
      ],
    });
  });

  it('rebuilds actionsWithTargets payloads without mutating originals', () => {
    const actor = { id: 'actor-1', name: 'Hero' };
    const originalEntry = {
      actionDef: {
        id: 'multi-action',
        resolvedTargets: {
          primary: [{ id: 'enemy-legacy' }],
        },
      },
      resolvedTargets: {
        primary: [{ id: 'enemy-legacy' }],
      },
      targetDefinitions: {
        primary: { optional: false },
      },
      targetContexts: [{ type: 'entity', entityId: 'enemy-legacy', placeholder: 'primary' }],
      custom: 'preserved-metadata',
    };

    const context = {
      actor,
      actionsWithTargets: [originalEntry],
    };

    const { format, items, metadata } = adapter.normalize(context);
    expect(format).toBe('actionsWithTargets');

    items[0].resolvedTargets = {
      primary: [{ id: 'enemy-1', name: 'Goblin' }],
      support: [{ id: 'support-1', name: 'Priest' }],
      [ACTOR_ROLE]: actor,
    };
    items[0].targetContexts = [
      { type: 'entity', entityId: 'enemy-1', placeholder: 'primary' },
      { type: 'entity', entityId: 'support-1', placeholder: 'support' },
    ];

    const results = emitter.applyTargetValidationResults({
      context,
      format,
      items,
      metadata,
      validatedItems: items,
    });

    expect(context.actionsWithTargets).toHaveLength(1);
    expect(context.actionsWithTargets[0]).not.toBe(originalEntry);
    expect(context.actionsWithTargets[0]).toMatchObject({
      actionDef: originalEntry.actionDef,
      custom: 'preserved-metadata',
      resolvedTargets: {
        primary: [{ id: 'enemy-1', name: 'Goblin' }],
        support: [{ id: 'support-1', name: 'Priest' }],
      },
      targetContexts: [
        { type: 'entity', entityId: 'enemy-1', placeholder: 'primary' },
        { type: 'entity', entityId: 'support-1', placeholder: 'support' },
      ],
    });

    expect(results[0]).toMatchObject({
      actionId: 'multi-action',
      kept: true,
      targetContexts: [
        { type: 'entity', entityId: 'enemy-1', placeholder: 'primary' },
        { type: 'entity', entityId: 'support-1', placeholder: 'support' },
      ],
    });
  });

  it('clears shared resolved targets when no actions survive validation', () => {
    const actor = { id: 'actor-2', name: 'Mage' };
    const candidateActions = [
      {
        id: 'action-a',
        resolvedTargets: {
          primary: [{ id: 'enemy-a' }],
        },
      },
      {
        id: 'action-b',
        resolvedTargets: {
          primary: [{ id: 'enemy-b' }],
        },
      },
    ];

    const context = {
      actor,
      candidateActions,
      resolvedTargets: {
        primary: [{ id: 'stale' }],
      },
    };

    const { format, items, metadata } = adapter.normalize(context);
    expect(format).toBe('candidateActions');

    items.forEach((item) => {
      item.resolvedTargets = null;
    });

    metadata.stageUpdates = [
      {
        stage: 'TargetComponentValidation',
        type: 'targetCandidatePruner',
        actionId: 'action-a',
        removedTargets: [],
        removalReasons: ['No valid targets'],
      },
      {
        stage: 'TargetComponentValidation',
        type: 'targetCandidatePruner',
        actionId: 'action-b',
        removedTargets: [],
        removalReasons: ['No valid targets'],
      },
    ];

    const results = emitter.applyTargetValidationResults({
      context,
      format,
      items,
      metadata,
      validatedItems: [],
    });

    expect(context.candidateActions).toHaveLength(0);
    expect(context.resolvedTargets).toEqual({});
    expect(candidateActions[0].resolvedTargets).toBeUndefined();
    expect(candidateActions[1].resolvedTargets).toBeUndefined();

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.kept === false)).toBe(true);
  });

  it('clears shared resolved targets when no items are processed', () => {
    const context = {
      candidateActions: [],
      resolvedTargets: {
        primary: [{ id: 'stale-target' }],
        support: { id: 'stale-support' },
      },
    };

    const metadata = {
      sharedResolvedTargetsRef: context.resolvedTargets,
    };

    const results = emitter.applyTargetValidationResults({
      context,
      format: 'candidateActions',
      items: [],
      metadata,
      validatedItems: [],
    });

    expect(results).toEqual([]);
    expect(context.candidateActions).toEqual([]);
    expect(context.resolvedTargets).toEqual({});
  });
});
