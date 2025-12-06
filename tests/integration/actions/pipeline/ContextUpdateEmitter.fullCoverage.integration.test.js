/**
 * @file Integration tests for ContextUpdateEmitter covering edge cases across
 *       both actionsWithTargets and candidateActions rebuild paths.
 */

import { describe, it, expect } from '@jest/globals';
import ContextUpdateEmitter from '../../../../src/actions/pipeline/services/implementations/ContextUpdateEmitter.js';
import { TargetValidationIOAdapter } from '../../../../src/actions/pipeline/adapters/TargetValidationIOAdapter.js';
import { ACTOR_ROLE } from '../../../../src/actions/pipeline/TargetRoleRegistry.js';

const createEntity = (id) => ({
  id,
  hasComponent: () => true,
  getComponentData: () => ({ id }),
});

describe('ContextUpdateEmitter integration with TargetValidationIOAdapter', () => {
  it('returns empty results when no items are provided', () => {
    const emitter = new ContextUpdateEmitter();

    const context = { candidateActions: [{ id: 'keep-existing' }] };

    const results = emitter.applyTargetValidationResults({
      context,
      format: 'empty',
      items: [],
      metadata: {},
      validatedItems: [],
    });

    expect(results).toEqual([]);
    expect(context).toEqual({ candidateActions: [{ id: 'keep-existing' }] });
  });

  it('rebuilds actionsWithTargets payloads while cloning metadata and stripping actor targets', () => {
    const emitter = new ContextUpdateEmitter();
    const adapter = new TargetValidationIOAdapter();

    const actor = createEntity('actor:1');
    const enemy = createEntity('enemy:1');
    const support = createEntity('support:1');

    const pipelineContext = {
      actor,
      resolvedTargets: {
        enemy: { entity: enemy },
        stale: { entity: support },
      },
      actionsWithTargets: [
        {
          actionDef: {
            id: 'action:keep',
            label: 'keep me',
            resolvedTargets: {
              [ACTOR_ROLE]: actor,
              enemy: {
                entity: enemy,
                metadata: { threat: 'high' },
              },
            },
          },
          targetDefinitions: { enemy: { placeholder: 'primary' } },
          targetContexts: [{ entity: enemy, relation: 'hostile' }],
        },
        {
          actionDef: {
            id: 'action:empty-targets',
            label: 'no targets',
            resolvedTargets: null,
          },
        },
      ],
    };

    const normalized = adapter.normalize(pipelineContext);
    normalized.metadata.stageUpdates = [
      {
        stage: 'validation-stage',
        type: 'filtered',
        actionId: 'action:keep',
        removedTargets: [{ role: 'enemy', reason: 'range' }],
        removalReasons: ['range'],
      },
      {
        stage: 'validation-stage',
        type: 'skipped',
        actionId: 'action:empty-targets',
        removedTargets: [{ role: 'enemy', reason: 'missing' }],
        removalReasons: ['missing'],
      },
    ];

    const mutatedContext = {
      actor,
      resolvedTargets: pipelineContext.resolvedTargets,
    };

    const results = emitter.applyTargetValidationResults({
      context: mutatedContext,
      format: normalized.format,
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems: normalized.items,
    });

    expect(mutatedContext.actionsWithTargets).toHaveLength(2);
    const [keptEntry, emptyEntry] = mutatedContext.actionsWithTargets;

    expect(keptEntry.actionDef.id).toBe('action:keep');
    expect(keptEntry.resolvedTargets).toEqual({
      enemy: {
        entity: enemy,
        metadata: { threat: 'high' },
      },
    });
    expect(keptEntry.resolvedTargets.enemy.entity).toBe(enemy);
    expect(keptEntry.targetContexts).toEqual([
      { entity: enemy, relation: 'hostile' },
    ]);

    expect(emptyEntry.actionDef.id).toBe('action:empty-targets');
    expect(emptyEntry.resolvedTargets).toEqual({
      enemy: { entity: enemy },
      stale: { entity: support },
    });
    expect(emptyEntry.targetContexts).toEqual([]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      actionId: 'action:keep',
      kept: true,
      keptTargets: {
        enemy: {
          entity: enemy,
          metadata: { threat: 'high' },
        },
      },
      targetContexts: [{ entity: enemy, relation: 'hostile' }],
      stageUpdates: [
        {
          stage: 'validation-stage',
          type: 'filtered',
          actionId: 'action:keep',
          removedTargets: [{ role: 'enemy', reason: 'range' }],
          removalReasons: ['range'],
        },
      ],
    });

    expect(results[1]).toMatchObject({
      actionId: 'action:empty-targets',
      kept: true,
      keptTargets: {
        enemy: { entity: enemy },
        stale: { entity: support },
      },
      targetContexts: [],
      stageUpdates: [
        {
          stage: 'validation-stage',
          type: 'skipped',
          actionId: 'action:empty-targets',
          removedTargets: [{ role: 'enemy', reason: 'missing' }],
          removalReasons: ['missing'],
        },
      ],
    });
  });

  it('synchronises shared resolved targets for candidateActions while preserving entity references', () => {
    const emitter = new ContextUpdateEmitter();
    const adapter = new TargetValidationIOAdapter();

    const actor = createEntity('actor:2');
    const ally = createEntity('ally:1');
    const support = createEntity('support:primary');
    const nested = createEntity('support:nested');
    const child = createEntity('child');

    const candidateActions = [
      {
        id: 'candidate:kept',
        label: 'kept',
        resolvedTargets: {
          [ACTOR_ROLE]: actor,
          ally,
          support: [
            {
              entity: support,
              nested: { entity: nested, meta: { detail: 'nested' } },
              extra: { entity: child, value: 3 },
            },
            'spectator',
          ],
        },
        targetContexts: null,
      },
      {
        id: 'candidate:null-targets',
        label: 'kept without targets',
        resolvedTargets: null,
      },
      {
        id: 'candidate:dropped',
        label: 'remove me',
        resolvedTargets: {
          ally,
          support: { entity: support },
        },
      },
    ];

    const pipelineContext = {
      actor: null,
      candidateActions: candidateActions.map((action) => ({ ...action })),
      resolvedTargets: null,
    };

    const normalized = adapter.normalize(pipelineContext);
    normalized.metadata.sharedResolvedTargetsRef = {
      ally: { entity: ally },
      stale: { entity: support },
    };
    normalized.metadata.stageUpdates = [
      {
        stage: 'validation-stage',
        type: 'kept',
        actionId: 'candidate:kept',
        removedTargets: [],
        removalReasons: [],
      },
      {
        stage: 'validation-stage',
        type: 'kept',
        actionId: 'candidate:null-targets',
        removedTargets: [],
        removalReasons: [],
      },
    ];

    const validatedItems = [normalized.items[0], normalized.items[1]];
    expect(normalized.items[1].resolvedTargets).toBeNull();

    const results = emitter.applyTargetValidationResults({
      context: pipelineContext,
      format: normalized.format,
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems,
    });

    expect(pipelineContext.candidateActions).toHaveLength(2);
    expect(pipelineContext.candidateActions.map((action) => action.id)).toEqual(
      ['candidate:kept', 'candidate:null-targets']
    );

    const keptAction = pipelineContext.candidateActions[0];
    expect(keptAction.resolvedTargets).toEqual({
      ally,
      support: [
        {
          entity: support,
          nested: { entity: nested, meta: { detail: 'nested' } },
          extra: { entity: child, value: 3 },
        },
        'spectator',
      ],
    });
    expect(keptAction.resolvedTargets.ally).toBe(ally);
    expect(keptAction.resolvedTargets.support[0].entity).toBe(support);
    expect(keptAction.resolvedTargets.support[0].nested.entity).toBe(nested);
    expect(keptAction.resolvedTargets.support[0].extra.entity).toBe(child);

    const nullTargetAction = pipelineContext.candidateActions[1];
    expect(nullTargetAction.resolvedTargets).toBeNull();

    expect(normalized.items[2].actionDef.resolvedTargets).toBeUndefined();

    expect(normalized.metadata.sharedResolvedTargetsRef).toEqual({
      ally,
      support: [
        {
          entity: support,
          nested: { entity: nested, meta: { detail: 'nested' } },
          extra: { entity: child, value: 3 },
        },
        'spectator',
      ],
    });

    expect(results).toHaveLength(3);
    expect(
      results.map((result) => ({
        actionId: result.actionId,
        kept: result.kept,
      }))
    ).toEqual([
      { actionId: 'candidate:kept', kept: true },
      { actionId: 'candidate:null-targets', kept: true },
      { actionId: 'candidate:dropped', kept: false },
    ]);

    expect(results[0].keptTargets.support[1]).toBe('spectator');
    expect(results[1].targetContexts).toEqual([]);

    // Secondary pass with missing shared targets reference to cover early exit branch
    const secondaryContext = {
      actor,
      candidateActions: [
        {
          id: 'candidate:secondary',
          resolvedTargets: null,
        },
      ],
    };
    const secondaryNormalized = adapter.normalize(secondaryContext);
    secondaryNormalized.items[0].targetContexts = undefined;

    const secondaryResults = emitter.applyTargetValidationResults({
      context: secondaryContext,
      format: secondaryNormalized.format,
      items: secondaryNormalized.items,
      metadata: secondaryNormalized.metadata,
      validatedItems: secondaryNormalized.items,
    });

    expect(secondaryResults[0].keptTargets).toBeNull();
    expect(secondaryResults[0].targetContexts).toEqual([]);
  });
});
