import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TargetCandidatePruner from '../../../../../../src/actions/pipeline/services/implementations/TargetCandidatePruner.js';

const createLogger = () => ({
  debug: jest.fn(),
});

describe('TargetCandidatePruner', () => {
  let pruner;

  beforeEach(() => {
    pruner = new TargetCandidatePruner({ logger: createLogger() });
  });

  it('keeps candidates that satisfy all required components', () => {
    const actionDef = {
      id: 'test:action',
      required_components: {
        primary: ['core:ready'],
      },
      targetDefinitions: {
        primary: { placeholder: 'primary' },
      },
    };

    const resolvedTargets = {
      primary: {
        id: 'npc-1',
        components: {
          'core:ready': {},
        },
      },
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets,
      targetContexts: [],
    });

    expect(result.keptTargets).not.toBe(resolvedTargets);
    expect(result.keptTargets.primary.id).toBe('npc-1');
    expect(result.removedTargets).toHaveLength(0);
    expect(result.removalReasons).toHaveLength(0);
  });

  it('removes candidates missing required components and reports metadata', () => {
    const actionDef = {
      id: 'test:action',
      required_components: {
        primary: ['core:ready'],
      },
      targetDefinitions: {
        primary: { placeholder: 'friend' },
      },
    };

    const resolvedTargets = {
      primary: {
        id: 'npc-2',
        components: {},
      },
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets,
      targetContexts: [
        {
          type: 'entity',
          placeholder: 'friend',
          entityId: 'npc-2',
        },
      ],
    });

    expect(result.keptTargets.primary).toBeNull();
    expect(result.removedTargets).toHaveLength(1);
    expect(result.removedTargets[0]).toMatchObject({
      role: 'primary',
      targetId: 'npc-2',
      placeholder: 'friend',
      reasonCode: 'missing_required_component',
    });
    expect(result.removalReasons).toEqual([
      'Target (primary) must have component: core:ready',
    ]);
  });

  it('derives placeholder metadata from target contexts when definitions omit it', () => {
    const actionDef = {
      id: 'test:action',
      required_components: {
        secondary: ['core:ready'],
      },
    };

    const resolvedTargets = {
      secondary: [
        {
          id: 'npc-3',
          components: {},
        },
      ],
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets,
      targetContexts: [
        {
          type: 'entity',
          placeholder: 'support',
          entityId: 'npc-3',
        },
      ],
    });

    expect(result.keptTargets.secondary).toEqual([]);
    expect(result.removedTargets[0].placeholder).toBe('support');
  });

  it('produces identical pruning results under lenient strictness configuration', () => {
    const actionDef = {
      id: 'test:action',
      required_components: {
        primary: ['core:ready'],
      },
      targetDefinitions: {
        primary: { placeholder: 'primary' },
      },
    };

    const resolvedTargets = {
      primary: {
        id: 'npc-4',
        components: {},
      },
    };

    const strictResult = pruner.prune({
      actionDef,
      resolvedTargets,
      targetContexts: [],
    });

    const lenientResult = pruner.prune({
      actionDef,
      resolvedTargets,
      targetContexts: [],
      config: { strictness: 'lenient', placeholderSource: actionDef.targetDefinitions },
    });

    expect(lenientResult).toEqual(strictResult);
  });

  it('returns empty results when resolved targets are missing despite requirements', () => {
    const actionDef = {
      id: 'test:action',
      required_components: { primary: ['core:ready'] },
    };

    const result = new TargetCandidatePruner().prune({
      actionDef,
      resolvedTargets: undefined,
    });

    expect(result).toEqual({
      keptTargets: null,
      removedTargets: [],
      removalReasons: [],
    });
  });

  it('short-circuits when the registry reports no roles to validate', () => {
    const registry = {
      getRolesWithRequirements: jest.fn(() => []),
      getPlaceholderForRole: jest.fn(() => 'unused'),
    };
    const resolvedTargets = { primary: { id: 'npc-keep' } };

    const result = pruner.prune({
      actionDef: {
        id: 'test:action',
        required_components: { primary: ['core:ready'] },
      },
      resolvedTargets,
      registry,
    });

    expect(registry.getRolesWithRequirements).toHaveBeenCalledWith({
      primary: ['core:ready'],
    });
    expect(result.keptTargets).toEqual(resolvedTargets);
    expect(result.keptTargets).not.toBe(resolvedTargets);
    expect(result.removedTargets).toEqual([]);
    expect(result.removalReasons).toEqual([]);
  });

  it('skips roles that do not have resolved target entries', () => {
    const actionDef = {
      id: 'test:action',
      required_components: {
        primary: ['core:ready'],
        secondary: ['core:ready'],
      },
      targetDefinitions: {
        primary: { placeholder: 'primary' },
        secondary: { placeholder: 'secondary' },
      },
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets: {
        primary: {
          id: 'npc-keep',
          components: { 'core:ready': {} },
        },
      },
    });

    expect(result.keptTargets).toEqual({
      primary: {
        id: 'npc-keep',
        components: { 'core:ready': {} },
      },
    });
    expect(result.removedTargets).toEqual([]);
    expect(result.removalReasons).toEqual([]);
  });

  it('records metadata when a required role has no resolved candidates', () => {
    const actionDef = {
      id: 'test:action',
      required_components: {
        primary: ['core:ready'],
      },
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets: { primary: [] },
      config: {
        placeholderSource: {
          primary: { placeholder: 'support-slot' },
        },
      },
    });

    expect(result.keptTargets.primary).toEqual([]);
    expect(result.removedTargets).toContainEqual({
      role: 'primary',
      targetId: null,
      placeholder: 'support-slot',
      reason: 'No primary target available for validation',
      reasonCode: 'missing_candidate',
    });
    expect(result.removalReasons).toEqual([
      'No primary target available for validation',
    ]);
  });

  it('treats null and entity-less candidates as missing', () => {
    const actionDef = {
      id: 'test:action',
      required_components: {
        primary: ['core:ready'],
        secondary: ['core:ready'],
      },
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets: {
        primary: [null],
        secondary: [{ entity: null }],
      },
    });

    expect(result.keptTargets.primary).toEqual([]);
    expect(result.keptTargets.secondary).toEqual([]);
    expect(result.removedTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'primary',
          targetId: null,
          reason: 'No primary target available for validation',
          reasonCode: 'missing_candidate',
        }),
        expect.objectContaining({
          role: 'secondary',
          targetId: null,
          reason: 'Target (secondary) must have component: core:ready',
          reasonCode: 'missing_required_component',
        }),
      ])
    );
  });

  it('ignores blank component identifiers and honours hasComponent lookups', () => {
    const hasComponent = jest.fn((componentId) => {
      if (componentId === 'core:ready') {
        return true;
      }
      throw new Error(`Unexpected component ${componentId}`);
    });

    const entity = { id: 'npc-5', hasComponent };
    const actionDef = {
      id: 'test:action',
      required_components: {
        primary: ['core:ready', '', null],
      },
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets: { primary: { entity } },
    });

    expect(result.keptTargets.primary).toEqual({ entity });
    expect(hasComponent).toHaveBeenCalledTimes(1);
    expect(result.removedTargets).toHaveLength(0);
  });

  it('logs evaluation failures and missing components even when logger fallback is used', () => {
    const throwingEntity = {
      hasComponent: jest.fn(() => {
        throw new Error('boom');
      }),
    };

    const fallbackPruner = new TargetCandidatePruner({ logger: {} });

    const result = fallbackPruner.prune({
      actionDef: {
        id: 'test:action',
        required_components: { primary: ['core:ready'] },
      },
      resolvedTargets: {
        primary: { entity: throwingEntity },
      },
    });

    expect(throwingEntity.hasComponent).toHaveBeenCalledWith('core:ready');
    expect(result.removedTargets[0]).toMatchObject({
      role: 'primary',
      reason: 'Target (primary) must have component: core:ready',
      reasonCode: 'missing_required_component',
    });
  });

  it('falls back to action targets when placeholder definitions are missing elsewhere', () => {
    const actionDef = {
      id: 'test:action',
      required_components: { primary: ['core:ready'] },
      targets: {
        primary: { placeholder: 'targets-slot' },
      },
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets: {
        primary: {
          id: 'npc-6',
          components: {},
        },
      },
      targetContexts: [
        {
          type: 'entity',
          entityId: 'npc-6',
          placeholder: '',
        },
      ],
    });

    expect(result.removedTargets[0].placeholder).toBe('targets-slot');
  });

  it('treats empty requirement arrays as automatically satisfied when a registry enumerates the role', () => {
    const registry = {
      getRolesWithRequirements: () => ['primary'],
    };

    const candidate = { id: 'npc-7' };
    const result = pruner.prune({
      actionDef: {
        id: 'test:action',
        required_components: { primary: [] },
      },
      resolvedTargets: { primary: candidate },
      registry,
    });

    expect(result.keptTargets.primary).toEqual(candidate);
    expect(result.removedTargets).toEqual([]);
  });

  it('defaults non-array requirement definitions to an empty list', () => {
    const actionDef = {
      id: 'test:action',
      required_components: { primary: 'invalid-definition' },
    };

    const candidate = { id: 'npc-8' };
    const result = pruner.prune({
      actionDef,
      resolvedTargets: { primary: candidate },
    });

    expect(result.keptTargets.primary).toEqual(candidate);
    expect(result.removedTargets).toEqual([]);
  });

  it('prefers registry placeholder overrides when provided', () => {
    const registry = {
      getRolesWithRequirements: () => ['primary'],
      getPlaceholderForRole: jest.fn(() => 'override-slot'),
    };

    const actionDef = {
      id: 'test:action',
      required_components: { primary: ['core:ready'] },
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets: {
        primary: {
          id: 'npc-9',
          components: {},
        },
      },
      registry,
    });

    expect(registry.getPlaceholderForRole).toHaveBeenCalledWith(
      'primary',
      null
    );
    expect(result.removedTargets[0].placeholder).toBe('override-slot');
  });

  it('ignores non-entity target contexts when building placeholder lookups', () => {
    const actionDef = {
      id: 'test:action',
      required_components: { primary: ['core:ready'] },
    };

    const result = pruner.prune({
      actionDef,
      resolvedTargets: {
        primary: {
          id: 'npc-10',
          components: {},
        },
      },
      targetContexts: [
        { type: 'item', placeholder: 'ignored', entityId: 'npc-10' },
        { type: 'entity', entityId: '', placeholder: 'ignored' },
        { type: 'entity', entityId: 'npc-10' },
      ],
    });

    expect(result.removedTargets[0].placeholder).toBeNull();
  });
});
