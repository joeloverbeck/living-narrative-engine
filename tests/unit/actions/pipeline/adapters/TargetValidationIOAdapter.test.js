import TargetValidationIOAdapter from '../../../../../src/actions/pipeline/adapters/TargetValidationIOAdapter.js';
import { LEGACY_TARGET_ROLE, PRIMARY_ROLE } from '../../../../../src/actions/pipeline/TargetRoleRegistry.js';

describe('TargetValidationIOAdapter', () => {
  const actor = { id: 'actor-1' };

  it('normalizes and rebuilds actionsWithTargets payloads', () => {
    const context = {
      actor,
      actionsWithTargets: [
        {
          actionDef: {
            id: 'multi-1',
            required_components: {},
          },
          resolvedTargets: {
            [PRIMARY_ROLE]: [{ id: 'entity-1' }],
          },
          targetDefinitions: {
            [PRIMARY_ROLE]: { placeholder: 'target.primary' },
          },
          targetContexts: [
            {
              type: 'entity',
              placeholder: 'target.primary',
              entityId: 'entity-1',
            },
          ],
        },
      ],
    };

    const adapter = new TargetValidationIOAdapter();
    const normalized = adapter.normalize(context);

    expect(normalized).toMatchSnapshot();

    const rebuilt = adapter.rebuild({
      format: normalized.format,
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems: normalized.items,
    });

    expect(rebuilt.continueProcessing).toBe(true);
    expect(rebuilt.data.actionsWithTargets).toEqual(context.actionsWithTargets);
  });

  it('rebuilds candidateActions payloads with sanitized targets', () => {
    const context = {
      actor,
      resolvedTargets: {
        [LEGACY_TARGET_ROLE]: [{ id: 'legacy-1' }],
      },
      candidateActions: [
        {
          id: 'legacy-action',
          resolvedTargets: {
            [LEGACY_TARGET_ROLE]: [{ id: 'legacy-1' }],
          },
          required_components: {},
          targetDefinitions: {
            [LEGACY_TARGET_ROLE]: { placeholder: 'target.single' },
          },
        },
        {
          id: 'secondary-action',
          target_entities: {
            [PRIMARY_ROLE]: { id: 'entity-2' },
          },
          required_components: {},
        },
      ],
    };

    const adapter = new TargetValidationIOAdapter();
    const normalized = adapter.normalize(context);

    expect(normalized.format).toBe('candidateActions');
    expect(normalized.items).toHaveLength(2);

    const validatedItems = [normalized.items[0]];
    validatedItems[0].resolvedTargets = {
      ...validatedItems[0].resolvedTargets,
      [LEGACY_TARGET_ROLE]: [{ id: 'legacy-1' }],
    };

    const rebuilt = adapter.rebuild({
      format: normalized.format,
      items: normalized.items,
      metadata: normalized.metadata,
      validatedItems,
    });

    expect(rebuilt.continueProcessing).toBe(true);
    expect(rebuilt.data.candidateActions).toHaveLength(1);
    expect(rebuilt.data.candidateActions[0].resolvedTargets).toEqual({
      [LEGACY_TARGET_ROLE]: [{ id: 'legacy-1' }],
    });
    expect(context.resolvedTargets[LEGACY_TARGET_ROLE]).toEqual([
      { id: 'legacy-1' },
    ]);
  });
});
