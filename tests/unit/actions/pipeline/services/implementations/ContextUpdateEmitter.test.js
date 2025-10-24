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

  it('reinitialises actionsWithTargets when context lacks an array and preserves entity references', () => {
    const actor = { id: 'actor-scout' };
    const allyEntity = { id: 'ally-entity' };
    const relicEntity = { id: 'relic-entity' };
    const nestedRelicEntity = { id: 'nested-relic-entity' };
    const deepEntity = { id: 'deep-entity' };
    const originalTargetContext = {
      entity: allyEntity,
      placeholder: 'support-slot',
      metadata: { hint: 'original' },
    };

    const componentEntity = {
      hasComponent: () => true,
      getComponentData: () => ({ vision: 'keen' }),
      tag: 'component-entity',
    };

    const candidateWithEntity = {
      entity: allyEntity,
      label: 'support-ally',
      traits: ['cunning'],
    };

    const items = [
      {
        actionDef: { id: 'action-scout' },
        resolvedTargets: {
          [ACTOR_ROLE]: actor,
          allies: [candidateWithEntity, 'string-placeholder'],
          relic: {
            entity: relicEntity,
            nested: {
              guardian: {
                entity: nestedRelicEntity,
                qualifiers: [{ entity: deepEntity, type: 'spirit' }],
              },
            },
          },
          sentinel: componentEntity,
        },
        targetContexts: undefined,
        targetDefinitions: null,
        originalIndex: 0,
        sourceFormat: 'actionsWithTargets',
        originalRef: {
          actionDef: { id: 'action-scout' },
          customFlag: true,
          targetContexts: [originalTargetContext],
        },
      },
    ];

    const context = { actionsWithTargets: { unexpected: true } };
    const metadata = { sharedResolvedTargetsRef: null, stageUpdates: [] };

    const results = emitter.applyTargetValidationResults({
      context,
      format: 'actionsWithTargets',
      items,
      metadata,
      validatedItems: items,
    });

    expect(Array.isArray(context.actionsWithTargets)).toBe(true);
    expect(context.actionsWithTargets).toHaveLength(1);
    const rebuilt = context.actionsWithTargets[0];

    expect(rebuilt).toMatchObject({
      actionDef: items[0].actionDef,
      customFlag: true,
    });

    expect(rebuilt.targetContexts).toHaveLength(1);
    expect(rebuilt.targetContexts[0]).not.toBe(originalTargetContext);
    expect(rebuilt.targetContexts[0].entity).toBe(allyEntity);

    const sanitizedTargets = rebuilt.resolvedTargets;
    expect(sanitizedTargets).toEqual(
      expect.objectContaining({
        allies: [
          expect.objectContaining({
            label: 'support-ally',
            entity: allyEntity,
          }),
          'string-placeholder',
        ],
        relic: expect.objectContaining({
          entity: relicEntity,
          nested: expect.objectContaining({
            guardian: expect.objectContaining({
              entity: nestedRelicEntity,
              qualifiers: [
                expect.objectContaining({
                  entity: deepEntity,
                  type: 'spirit',
                }),
              ],
            }),
          }),
        }),
        sentinel: componentEntity,
      })
    );
    expect(sanitizedTargets.allies[0]).not.toBe(candidateWithEntity);
    expect(sanitizedTargets.allies[0].entity).toBe(allyEntity);
    expect(sanitizedTargets.relic).not.toBe(items[0].resolvedTargets.relic);
    expect(sanitizedTargets.relic.entity).toBe(relicEntity);
    expect(
      sanitizedTargets.relic.nested.guardian.qualifiers[0].entity,
    ).toBe(deepEntity);
    expect(sanitizedTargets.sentinel).toBe(componentEntity);

    expect(results).toHaveLength(1);
    expect(results[0].keptTargets).toEqual(sanitizedTargets);
    expect(results[0].targetContexts).toEqual([]);
  });

  it('synchronises shared resolved targets for candidate actions while skipping invalid entries', () => {
    const actor = { id: 'actor-hunter' };
    const sharedTargets = {
      primary: [{ id: 'stale-primary', entity: { id: 'stale-primary-entity' } }],
      backup: { entity: { id: 'stale-backup-entity' } },
      stale: { id: 'remove-me' },
    };

    const actionA = {
      id: 'action-alpha',
      resolvedTargets: { shouldBeReplaced: true },
    };
    const actionB = {
      id: 'action-beta',
      resolvedTargets: { lingering: true },
    };

    const primaryEntity = { id: 'primary-ally' };
    const backupEntity = { id: 'backup-ally' };

    const items = [
      {
        actionDef: actionA,
        resolvedTargets: {
          [ACTOR_ROLE]: actor,
          primary: [
            { entity: primaryEntity, role: 'primary', score: 1 },
            { entity: primaryEntity, info: { entity: primaryEntity } },
          ],
          backup: {
            entity: backupEntity,
            metadata: {
              tag: 'support',
              nested: [{ entity: backupEntity, tier: 2 }],
            },
          },
        },
        targetContexts: 'not-an-array',
        targetDefinitions: null,
        originalIndex: 0,
        sourceFormat: 'candidateActions',
        originalRef: null,
      },
      {
        actionDef: actionB,
        resolvedTargets: null,
        targetContexts: null,
        targetDefinitions: null,
        originalIndex: 1,
        sourceFormat: 'candidateActions',
        originalRef: null,
      },
    ];

    const metadata = {
      sharedResolvedTargetsRef: sharedTargets,
      stageUpdates: [
        {
          stage: 'TargetComponentValidation',
          type: 'pruner',
          actionId: 'action-alpha',
          removedTargets: null,
          removalReasons: null,
        },
        {
          stage: 'TargetComponentValidation',
          type: 'pruner',
          actionId: 'action-beta',
          removedTargets: [
            {
              role: 'primary',
              targetId: 'primary-ally',
            },
          ],
          removalReasons: ['Insufficient score'],
        },
        {
          stage: 'TargetComponentValidation',
          type: 'audit',
          actionId: null,
          removedTargets: [{ role: 'global' }],
          removalReasons: ['global'],
        },
      ],
    };

    const context = {
      candidateActions: [actionA, actionB],
      resolvedTargets: sharedTargets,
    };

    const results = emitter.applyTargetValidationResults({
      context,
      format: 'candidateActions',
      items,
      metadata,
      validatedItems: items,
    });

    expect(context.candidateActions).toEqual([actionA, actionB]);
    expect(actionA.resolvedTargets).toEqual({
      primary: [
        { entity: primaryEntity, role: 'primary', score: 1 },
        { entity: primaryEntity, info: { entity: primaryEntity } },
      ],
      backup: {
        entity: backupEntity,
        metadata: { tag: 'support', nested: [{ entity: backupEntity, tier: 2 }] },
      },
    });
    expect(actionA.resolvedTargets.primary[0]).not.toBe(
      items[0].resolvedTargets.primary[0],
    );
    expect(actionA.resolvedTargets.primary[0].entity).toBe(primaryEntity);
    expect(
      actionA.resolvedTargets.backup.metadata.nested[0].entity,
    ).toBe(backupEntity);
    expect(actionB.resolvedTargets).toBeUndefined();

    expect(sharedTargets).toEqual(
      expect.objectContaining({
        primary: [
          expect.objectContaining({
            entity: primaryEntity,
            role: 'primary',
          }),
          expect.objectContaining({ entity: primaryEntity }),
        ],
        backup: expect.objectContaining({
          entity: backupEntity,
          metadata: expect.objectContaining({
            nested: [expect.objectContaining({ entity: backupEntity, tier: 2 })],
          }),
        }),
      })
    );
    expect(sharedTargets.stale).toBeUndefined();
    expect(sharedTargets.primary[0]).not.toBe(items[0].resolvedTargets.primary[0]);
    expect(sharedTargets.primary[0].entity).toBe(primaryEntity);
    expect(sharedTargets.backup.metadata.nested[0].entity).toBe(backupEntity);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      actionId: 'action-alpha',
      kept: true,
      targetContexts: [],
    });
    expect(results[0].stageUpdates).toEqual([
      expect.objectContaining({
        actionId: 'action-alpha',
        removedTargets: [],
        removalReasons: [],
      }),
    ]);
    expect(results[1]).toMatchObject({
      actionId: 'action-beta',
      kept: true,
      keptTargets: null,
    });
    expect(results[1].stageUpdates).toEqual([
      expect.objectContaining({
        actionId: 'action-beta',
        removedTargets: [
          expect.objectContaining({ role: 'primary', targetId: 'primary-ally' }),
        ],
        removalReasons: ['Insufficient score'],
      }),
    ]);
  });
});
