import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import TargetResolutionResultBuilder from '../../../../../../src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';
import { InvalidArgumentError } from '../../../../../../src/errors/invalidArgumentError.js';

function createMockContext(overrides = {}) {
  return {
    actor: { id: 'actor-1', name: 'Test Actor' },
    trace: {},
    data: { stage: 'multi-target-resolution' },
    ...overrides,
  };
}

function createMockActionDef(overrides = {}) {
  return {
    id: 'test:action',
    name: 'Test Action',
    targets: {
      primary: { scope: 'test_scope' },
    },
    ...overrides,
  };
}

function createMockResolvedTargets(overrides = {}) {
  const base = {
    primary: [
      { id: 'target-1' },
      { id: 'target-2', entity: { id: 'target-2', name: 'Target 2' } },
    ],
    secondary: [],
  };

  return { ...base, ...overrides };
}

function createMockTargetContexts(overrides = []) {
  const base = [{ targetKey: 'primary', candidates: ['target-1', 'target-2'] }];
  return overrides.length > 0 ? overrides : base;
}

function createMockEntityManager() {
  return {
    getEntityInstance: jest.fn((id) => ({ id, name: `Entity ${id}` })),
  };
}

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('TargetResolutionResultBuilder', () => {
  let entityManager;
  let logger;
  let builder;
  let context;

  beforeEach(() => {
    entityManager = createMockEntityManager();
    logger = createMockLogger();
    builder = new TargetResolutionResultBuilder({ entityManager, logger });
    context = createMockContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should validate entityManager dependency', () => {
      expect(() => new TargetResolutionResultBuilder({ logger })).toThrow(
        InvalidArgumentError
      );
    });

    it('should validate logger dependency', () => {
      expect(() => new TargetResolutionResultBuilder({ entityManager })).toThrow(
        InvalidArgumentError
      );
    });

    it('should throw if entityManager is missing getEntityInstance', () => {
      const badEntityManager = { getEntityInstance: 'not-a-function' };

      expect(
        () =>
          new TargetResolutionResultBuilder({
            entityManager: badEntityManager,
            logger,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should initialize with valid dependencies', () => {
      expect(builder).toBeInstanceOf(TargetResolutionResultBuilder);
    });
  });

  describe('buildLegacyResult', () => {
    it('should build result with resolved targets', () => {
      const resolvedTargets = createMockResolvedTargets();
      const targetContexts = createMockTargetContexts();
      const conversionResult = { targetDefinitions: { primary: { scope: 'legacy_scope' } } };
      const actionDef = createMockActionDef();

      const result = builder.buildLegacyResult(
        context,
        resolvedTargets,
        targetContexts,
        conversionResult,
        actionDef
      );

      expect(result.success).toBe(true);
      expect(result.data.resolvedTargets).toBe(resolvedTargets);
      expect(result.data.targetContexts).toBe(targetContexts);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      expect(result.data.actionsWithTargets[0].actionDef).toBe(actionDef);
    });

    it('should include legacy conversion metadata or fallback definitions when missing', () => {
      const resolvedTargets = createMockResolvedTargets();
      const targetContexts = createMockTargetContexts();
      const conversionResult = {
        targetDefinitions: { primary: { scope: 'legacy_scope', placeholder: 'foo' } },
      };
      const actionDef = createMockActionDef();

      const withConversion = builder.buildLegacyResult(
        context,
        resolvedTargets,
        targetContexts,
        conversionResult,
        actionDef
      );

      expect(
        withConversion.data.actionsWithTargets[0].targetDefinitions.primary.scope
      ).toBe('legacy_scope');

      const withoutConversion = builder.buildLegacyResult(
        context,
        resolvedTargets,
        targetContexts,
        null,
        actionDef
      );

      expect(
        withoutConversion.data.actionsWithTargets[0].targetDefinitions.primary.scope
      ).toEqual(actionDef.targets);
    });

    it('should attach action definition fields via attachMetadata', () => {
      const result = builder.buildLegacyResult(
        context,
        createMockResolvedTargets(),
        createMockTargetContexts(),
        null,
        createMockActionDef()
      );

      const action = result.data.actionsWithTargets[0];
      expect(action.actionDef).toBeDefined();
      expect(action.targetDefinitions).toBeDefined();
      expect(action.resolvedTargets).toBeDefined();
    });

    it('should include targetContexts for backward compatibility', () => {
      const targetContexts = createMockTargetContexts();
      const result = builder.buildLegacyResult(
        context,
        createMockResolvedTargets(),
        targetContexts,
        null,
        createMockActionDef()
      );

      expect(result.data.targetContexts).toBe(targetContexts);
    });

    it('should call attachMetadata with isMultiTarget=false', () => {
      const attachSpy = jest.spyOn(builder, 'attachMetadata');
      const resolvedTargets = createMockResolvedTargets();
      const targetContexts = createMockTargetContexts();
      const actionDef = createMockActionDef();

      builder.buildLegacyResult(
        context,
        resolvedTargets,
        targetContexts,
        null,
        actionDef
      );

      expect(attachSpy).toHaveBeenCalledWith(
        expect.objectContaining({ actionDef }),
        resolvedTargets,
        expect.any(Object),
        false
      );
      attachSpy.mockRestore();
    });

    it('should handle empty resolved targets', () => {
      const result = builder.buildLegacyResult(
        context,
        null,
        createMockTargetContexts(),
        null,
        createMockActionDef()
      );

      expect(result.data.resolvedTargets).toBeNull();
      expect(result.data.actionsWithTargets[0].resolvedTargets).toEqual({});
    });

    it('should return a PipelineResult.success payload containing actionsWithTargets', () => {
      const result = builder.buildLegacyResult(
        context,
        createMockResolvedTargets(),
        createMockTargetContexts(),
        null,
        createMockActionDef()
      );

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.actionsWithTargets)).toBe(true);
    });
  });

  describe('buildMultiTargetResult', () => {
    it('should build result with resolved targets', () => {
      const resolvedTargets = createMockResolvedTargets();
      const targetContexts = createMockTargetContexts();
      const targetDefinitions = { primary: { scope: 'actors' } };
      const actionDef = createMockActionDef();

      const result = builder.buildMultiTargetResult(
        context,
        resolvedTargets,
        targetContexts,
        targetDefinitions,
        actionDef
      );

      expect(result.success).toBe(true);
      expect(result.data.resolvedTargets).toBe(resolvedTargets);
      expect(result.data.targetDefinitions).toBe(targetDefinitions);
      expect(result.data.actionsWithTargets[0].actionDef).toBe(actionDef);
    });

    it('should include detailed resolution results (default empty object)', () => {
      const result = builder.buildMultiTargetResult(
        context,
        createMockResolvedTargets(),
        createMockTargetContexts(),
        { primary: { scope: 'actors' } },
        createMockActionDef()
      );

      expect(result.data.detailedResolutionResults).toEqual({});
    });

    it('should attach target definitions', () => {
      const targetDefinitions = { primary: { scope: 'actors' } };
      const result = builder.buildMultiTargetResult(
        context,
        createMockResolvedTargets(),
        createMockTargetContexts(),
        targetDefinitions,
        createMockActionDef()
      );

      expect(result.data.actionsWithTargets[0].targetDefinitions).toBe(
        targetDefinitions
      );
    });

    it('should attach metadata with isMultiTarget=true', () => {
      const attachSpy = jest.spyOn(builder, 'attachMetadata');
      const resolvedTargets = createMockResolvedTargets();
      const targetDefinitions = { primary: { scope: 'actors' } };
      const actionDef = createMockActionDef();

      builder.buildMultiTargetResult(
        context,
        resolvedTargets,
        createMockTargetContexts(),
        targetDefinitions,
        actionDef
      );

      expect(attachSpy).toHaveBeenCalledWith(
        expect.objectContaining({ actionDef }),
        resolvedTargets,
        targetDefinitions,
        true
      );
      attachSpy.mockRestore();
    });

    it('should mutate action definitions with resolved targets and target definitions', () => {
      const resolvedTargets = createMockResolvedTargets();
      const targetDefinitions = { primary: { scope: 'actors' } };
      const actionDef = createMockActionDef();

      builder.buildMultiTargetResult(
        context,
        resolvedTargets,
        createMockTargetContexts(),
        targetDefinitions,
        actionDef
      );

      expect(actionDef.resolvedTargets).toBe(resolvedTargets);
      expect(actionDef.targetDefinitions).toBe(targetDefinitions);
      expect(actionDef.isMultiTarget).toBe(true);
    });

    it('should handle multiple target types and preserve contexts', () => {
      const resolvedTargets = createMockResolvedTargets({
        primary: [{ id: 'target-1' }],
        secondary: [{ id: 'target-3' }],
      });
      const targetContexts = createMockTargetContexts([
        { targetKey: 'primary', candidates: ['target-1'] },
        { targetKey: 'secondary', candidates: ['target-3'] },
      ]);
      const result = builder.buildMultiTargetResult(
        context,
        resolvedTargets,
        targetContexts,
        { primary: { scope: 'actors' }, secondary: { scope: 'items' } },
        createMockActionDef()
      );

      expect(result.data.targetContexts).toBe(targetContexts);
      expect(result.data.actionsWithTargets[0].resolvedTargets).toEqual(
        resolvedTargets
      );
    });
  });

  describe('buildFinalResult', () => {
    it('should aggregate all actionsWithTargets', () => {
      const actions = [
        { actionDef: createMockActionDef({ id: 'a1' }), targetContexts: [] },
        { actionDef: createMockActionDef({ id: 'a2' }), targetContexts: [] },
      ];
      const result = builder.buildFinalResult(
        context,
        actions,
        [],
        null,
        null,
        []
      );

      expect(result.data.actionsWithTargets).toBe(actions);
      expect(result.data.actionsWithTargets).toHaveLength(2);
    });

    it('should include targetContexts when provided', () => {
      const targetContexts = createMockTargetContexts();
      const result = builder.buildFinalResult(
        context,
        [],
        targetContexts,
        null,
        null,
        []
      );

      expect(result.data.targetContexts).toBe(targetContexts);
    });

    it('should include last resolved targets and definitions only when both supplied', () => {
      const resolvedTargets = createMockResolvedTargets();
      const targetDefinitions = { primary: { scope: 'actors' } };

      const resultWithoutDefinitions = builder.buildFinalResult(
        context,
        [],
        [],
        resolvedTargets,
        null,
        []
      );
      expect(resultWithoutDefinitions.data.resolvedTargets).toBeUndefined();
      expect(resultWithoutDefinitions.data.targetDefinitions).toBeUndefined();

      const resultWithDefinitions = builder.buildFinalResult(
        context,
        [],
        [],
        resolvedTargets,
        targetDefinitions,
        []
      );
      expect(resultWithDefinitions.data.resolvedTargets).toBe(resolvedTargets);
      expect(resultWithDefinitions.data.targetDefinitions).toBe(
        targetDefinitions
      );
    });

    it('should pass errors through PipelineResult.success', () => {
      const errors = [new Error('test')];
      const result = builder.buildFinalResult(
        context,
        [],
        [],
        null,
        null,
        errors
      );

      expect(result.errors).toBe(errors);
    });

    it('should handle empty action arrays gracefully', () => {
      const result = builder.buildFinalResult(
        context,
        [],
        [],
        null,
        null,
        []
      );

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]);
    });
  });

  describe('attachMetadata', () => {
    it('should mark legacy format correctly', () => {
      const action = { actionDef: createMockActionDef() };
      builder.attachMetadata(action, createMockResolvedTargets(), {}, false);

      expect(action.isMultiTarget).toBe(false);
    });

    it('should mark multi-target format correctly', () => {
      const action = { actionDef: createMockActionDef() };
      builder.attachMetadata(action, createMockResolvedTargets(), {}, true);

      expect(action.isMultiTarget).toBe(true);
    });

    it('should hydrate resolved target entities using entityManager.getEntityInstance', () => {
      const action = { actionDef: createMockActionDef() };
      const resolvedTargets = {
        primary: [{ id: 'missing-entity' }],
      };

      builder.attachMetadata(action, resolvedTargets, {}, false);

      expect(entityManager.getEntityInstance).toHaveBeenCalledWith(
        'missing-entity'
      );
      expect(action.resolvedTargets.primary[0].entity).toEqual({
        id: 'missing-entity',
        name: 'Entity missing-entity',
      });
    });

    it('should gracefully warn when provided an invalid action payload', () => {
      builder.attachMetadata(null, createMockResolvedTargets(), {}, false);
      expect(logger.warn).toHaveBeenCalledWith(
        'TargetResolutionResultBuilder.attachMetadata received invalid action payload'
      );
    });

    it('should handle zero targets by leaving resolvedTargets empty', () => {
      const action = { actionDef: createMockActionDef() };
      builder.attachMetadata(action, {}, {}, false);

      expect(action.resolvedTargets).toEqual({});
    });
  });

  describe('Result shape expectations', () => {
    it('should expose actionsWithTargets entries with targetContexts', () => {
      const actions = [
        {
          actionDef: createMockActionDef(),
          targetContexts: createMockTargetContexts(),
        },
      ];
      const result = builder.buildFinalResult(
        context,
        actions,
        createMockTargetContexts(),
        null,
        null,
        []
      );

      expect(result.data.actionsWithTargets[0].targetContexts).toEqual(
        actions[0].targetContexts
      );
    });

    it('should surface resolvedTargets and targetDefinitions on the top-level data payload when available', () => {
      const resolvedTargets = createMockResolvedTargets();
      const targetDefinitions = { primary: { scope: 'actors' } };

      const result = builder.buildFinalResult(
        context,
        [],
        createMockTargetContexts(),
        resolvedTargets,
        targetDefinitions,
        []
      );

      expect(result.data.resolvedTargets).toBe(resolvedTargets);
      expect(result.data.targetDefinitions).toBe(targetDefinitions);
    });

    it('should remain idempotent for identical inputs', () => {
      const makeInputs = () => ({
        ctx: createMockContext(),
        actions: [
          {
            actionDef: createMockActionDef(),
            targetContexts: createMockTargetContexts(),
            resolvedTargets: createMockResolvedTargets(),
          },
        ],
        targetContexts: createMockTargetContexts(),
        resolvedTargets: createMockResolvedTargets(),
        targetDefinitions: { primary: { scope: 'actors' } },
      });

      const first = makeInputs();
      const second = makeInputs();

      const resultA = builder.buildFinalResult(
        first.ctx,
        first.actions,
        first.targetContexts,
        first.resolvedTargets,
        first.targetDefinitions,
        []
      );
      const resultB = builder.buildFinalResult(
        second.ctx,
        second.actions,
        second.targetContexts,
        second.resolvedTargets,
        second.targetDefinitions,
        []
      );

      expect(resultA).toEqual(resultB);
    });
  });
});
