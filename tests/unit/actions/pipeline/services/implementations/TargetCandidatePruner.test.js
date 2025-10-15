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
});
