import TargetValidationIOAdapter from '../../../../../src/actions/pipeline/adapters/TargetValidationIOAdapter.js';
import {
  ACTOR_ROLE,
  LEGACY_TARGET_ROLE,
  PRIMARY_ROLE,
  SECONDARY_ROLE,
} from '../../../../../src/actions/pipeline/TargetRoleRegistry.js';

describe('TargetValidationIOAdapter', () => {
  const actor = { id: 'actor-1' };

  it('returns an empty format when no actions or candidates are provided', () => {
    const adapter = new TargetValidationIOAdapter();
    const normalized = adapter.normalize({});

    expect(normalized.format).toBe('empty');
    expect(normalized.items).toEqual([]);
    expect(normalized.metadata).toEqual({
      actor: null,
      sharedResolvedTargetsRef: null,
    });

    const rebuilt = adapter.rebuild({
      format: normalized.format,
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems: [],
    });

    expect(rebuilt).toEqual({
      data: { candidateActions: [] },
      continueProcessing: false,
    });
  });

  it('normalizes actionsWithTargets payloads while preserving entity references and rebuilds sanitized data', () => {
    const entityWithLifecycle = {
      id: 'entity-1',
      hasComponent: () => true,
      getComponentData: () => ({ foo: 'bar' }),
    };
    const primaryCandidate = {
      entity: entityWithLifecycle,
      metadata: { state: 'initial' },
    };
    const primitiveCandidate = 'primitive-target';
    const originalTargetContext = [
      {
        entity: { id: 'ctx-entity' },
        nested: {
          entity: { id: 'nested-entity' },
        },
      },
    ];

    const context = {
      actor,
      actionsWithTargets: [
        {
          actionDef: {
            id: 'with-source-resolved',
            required_components: {},
            targetDefinitions: {
              [PRIMARY_ROLE]: { placeholder: 'actionDef.primary' },
            },
          },
          resolvedTargets: {
            [PRIMARY_ROLE]: [primaryCandidate, primitiveCandidate],
            custom: { entity: { id: 'custom-entity' } },
          },
          targetContexts: originalTargetContext,
        },
        {
          actionDef: {
            id: 'actor-only',
            required_components: {},
            targets: {
              [PRIMARY_ROLE]: { placeholder: 'targets.primary' },
            },
          },
        },
      ],
    };

    const adapter = new TargetValidationIOAdapter();
    const normalized = adapter.normalize(context);

    expect(normalized.format).toBe('actionsWithTargets');
    expect(normalized.items).toHaveLength(2);

    const [firstItem, secondItem] = normalized.items;

    // Placeholder metadata falls back to the action definition when the source lacks it.
    expect(firstItem.placeholderSource).toBe(firstItem.targetDefinitions);
    expect(firstItem.targetDefinitions).toBe(
      context.actionsWithTargets[0].actionDef.targetDefinitions
    );

    // Resolved targets are cloned while preserving entity references and adding the actor role.
    expect(firstItem.resolvedTargets).not.toBe(
      context.actionsWithTargets[0].resolvedTargets
    );
    expect(firstItem.resolvedTargets[PRIMARY_ROLE][0]).not.toBe(
      primaryCandidate
    );
    expect(firstItem.resolvedTargets[PRIMARY_ROLE][0].entity).toBe(
      entityWithLifecycle
    );
    expect(firstItem.resolvedTargets[PRIMARY_ROLE][1]).toBe(primitiveCandidate);
    expect(firstItem.resolvedTargets.custom).not.toBe(
      context.actionsWithTargets[0].resolvedTargets.custom
    );
    expect(firstItem.resolvedTargets.custom.entity).toBe(
      context.actionsWithTargets[0].resolvedTargets.custom.entity
    );
    expect(firstItem.resolvedTargets[ACTOR_ROLE]).toBe(actor);

    // Target contexts are cloned recursively while keeping entity references intact.
    expect(firstItem.targetContexts).toHaveLength(1);
    expect(firstItem.targetContexts).not.toBe(originalTargetContext);
    expect(firstItem.targetContexts[0]).not.toBe(originalTargetContext[0]);
    expect(firstItem.targetContexts[0].entity).toBe(
      originalTargetContext[0].entity
    );
    firstItem.targetContexts[0].metadata = 'mutated';
    expect(originalTargetContext[0].metadata).toBeUndefined();

    // Placeholder metadata falls back to the `targets` definition when the action definition lacks targetDefinitions.
    expect(secondItem.placeholderSource).toBe(secondItem.targetDefinitions);
    expect(secondItem.targetDefinitions).toBe(
      context.actionsWithTargets[1].actionDef.targets
    );
    expect(secondItem.resolvedTargets).toEqual({ [ACTOR_ROLE]: actor });

    const rebuilt = adapter.rebuild({
      format: normalized.format,
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems: normalized.items,
    });

    expect(rebuilt.continueProcessing).toBe(true);
    expect(rebuilt.data.actionsWithTargets).toHaveLength(2);

    const [rebuiltFirst, rebuiltSecond] = rebuilt.data.actionsWithTargets;
    expect(rebuiltFirst.resolvedTargets).toEqual({
      [PRIMARY_ROLE]: [primaryCandidate, primitiveCandidate],
      custom: { entity: { id: 'custom-entity' } },
    });
    expect(rebuiltFirst.resolvedTargets[PRIMARY_ROLE][0]).not.toBe(
      firstItem.resolvedTargets[PRIMARY_ROLE][0]
    );
    expect(rebuiltFirst.resolvedTargets[PRIMARY_ROLE][0].entity).toBe(
      entityWithLifecycle
    );
    expect(rebuiltSecond.resolvedTargets).toBeNull();
  });

  it('normalizes diverse candidate actions, covering placeholder fallbacks and target derivations', () => {
    const entityWithLifecycle = {
      id: 'component-entity',
      hasComponent: () => true,
      getComponentData: () => ({ status: 'ok' }),
    };
    const sharedSecondary = { entity: { id: 'secondary-entity' } };

    const context = {
      actor,
      candidateActions: [
        {
          id: 'with-own-resolved',
          resolvedTargets: {
            [PRIMARY_ROLE]: entityWithLifecycle,
          },
          targetDefinitions: {
            [PRIMARY_ROLE]: { placeholder: 'from-target-definitions' },
          },
        },
        {
          id: 'targets-fallback',
          targets: {
            [PRIMARY_ROLE]: { placeholder: 'from-targets' },
          },
        },
        {
          id: 'legacy',
          target_entity: [{ entity: { id: 'legacy-entity' } }],
        },
        {
          id: 'multi',
          target_entities: {
            [PRIMARY_ROLE]: [{ entity: { id: 'primary-entity' } }],
            [SECONDARY_ROLE]: sharedSecondary,
          },
        },
      ],
    };

    const adapter = new TargetValidationIOAdapter();
    const normalized = adapter.normalize(context);

    expect(normalized.format).toBe('candidateActions');
    expect(normalized.items).toHaveLength(4);

    const [withOwnResolved, targetsFallback, legacy, multi] = normalized.items;

    expect(withOwnResolved.placeholderSource).toBe(
      context.candidateActions[0].targetDefinitions
    );
    expect(withOwnResolved.resolvedTargets[PRIMARY_ROLE]).toBe(
      entityWithLifecycle
    );
    expect(withOwnResolved.resolvedTargets[ACTOR_ROLE]).toBe(actor);

    expect(targetsFallback.placeholderSource).toBe(
      context.candidateActions[1].targets
    );
    expect(targetsFallback.resolvedTargets).toEqual({ [ACTOR_ROLE]: actor });

    expect(legacy.resolvedTargets).toEqual({
      [LEGACY_TARGET_ROLE]: [{ entity: { id: 'legacy-entity' } }],
      [ACTOR_ROLE]: actor,
    });
    expect(legacy.placeholderSource).toBeNull();

    expect(multi.resolvedTargets[PRIMARY_ROLE][0].entity).toBe(
      context.candidateActions[3].target_entities[PRIMARY_ROLE][0].entity
    );
    expect(multi.resolvedTargets[SECONDARY_ROLE]).not.toBe(sharedSecondary);
    expect(multi.resolvedTargets[SECONDARY_ROLE].entity).toBe(
      sharedSecondary.entity
    );
    expect(multi.resolvedTargets[ACTOR_ROLE]).toBe(actor);
  });

  it('uses shared resolved targets when provided and preserves item ordering during rebuilds', () => {
    const sharedResolvedTargets = {
      [LEGACY_TARGET_ROLE]: [{ id: 'shared-legacy' }],
    };

    const context = {
      actor,
      resolvedTargets: sharedResolvedTargets,
      candidateActions: [{ id: 'first' }, { id: 'second' }, { id: 'third' }],
    };

    const adapter = new TargetValidationIOAdapter();
    const normalized = adapter.normalize(context);

    expect(normalized.metadata.sharedResolvedTargetsRef).toBe(
      sharedResolvedTargets
    );
    expect(normalized.items).toHaveLength(3);
    normalized.items.forEach((item) => {
      expect(item.resolvedTargets).toEqual({
        [LEGACY_TARGET_ROLE]: [{ id: 'shared-legacy' }],
        [ACTOR_ROLE]: actor,
      });
    });

    const validatedItems = [normalized.items[2], normalized.items[0]];
    const rebuilt = adapter.rebuild({
      format: normalized.format,
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems,
    });

    expect(rebuilt.continueProcessing).toBe(true);
    expect(rebuilt.data.candidateActions).toEqual([
      context.candidateActions[0],
      context.candidateActions[2],
    ]);

    const emptyRebuilt = adapter.rebuild({
      format: normalized.format,
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems: [],
    });

    expect(emptyRebuilt.continueProcessing).toBe(false);
    expect(emptyRebuilt.data.candidateActions).toEqual([]);
  });
});
