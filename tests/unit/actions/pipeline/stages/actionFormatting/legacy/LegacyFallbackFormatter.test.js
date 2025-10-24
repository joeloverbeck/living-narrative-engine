import { LegacyFallbackFormatter } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyFallbackFormatter.js';

describe('LegacyFallbackFormatter', () => {
  let commandFormatter;
  let entityManager;
  let formatter;

  beforeEach(() => {
    commandFormatter = {
      format: jest.fn().mockReturnValue({ ok: true, value: 'legacy-command' }),
    };

    entityManager = { getEntityInstance: jest.fn() };

    formatter = new LegacyFallbackFormatter({
      commandFormatter,
      entityManager,
      getEntityDisplayNameFn: jest.fn(),
    });
  });

  it('transforms multi-target templates into legacy friendly format', () => {
    const actionDefinition = {
      id: 'act-1',
      template: 'Use {primary} with {secondary}',
    };

    const targetContext = {
      entityId: 'entity-1',
      displayName: ' Primary Hero ',
      placeholder: 'primary',
    };

    const targetDefinitions = {
      primary: { placeholder: 'primary' },
      secondary: { placeholder: 'secondary' },
    };

    const resolvedTargets = {
      primary: [{ id: 'entity-1', displayName: 'Primary Hero' }],
      secondary: [{ id: 'entity-2', displayName: 'Helper Ally' }],
    };

    const prepared = formatter.prepareFallback({
      actionDefinition,
      targetContext,
      targetDefinitions,
      resolvedTargets,
    });

    expect(prepared.actionDefinition.template).toBe(
      'Use {target} with Helper Ally'
    );
    expect(prepared.targetContext).toEqual({
      entityId: 'entity-1',
      displayName: 'Primary Hero',
    });
  });

  it('returns an error result when fallback context cannot be prepared', () => {
    const actionDefinition = { id: 'act-2', template: 'Look at {primary}' };

    const result = formatter.formatWithFallback({
      actionDefinition,
      targetContext: null,
      formatterOptions: {},
      targetDefinitions: undefined,
      resolvedTargets: undefined,
    });

    expect(result).toEqual({
      ok: false,
      error: 'Legacy fallback target context not available',
    });
  });

  it('preserves missing action definitions when building the fallback payload', () => {
    const prepared = formatter.prepareFallback({
      actionDefinition: null,
      targetContext: {
        entityId: 'entity-7',
        displayName: '  Nominal Hero  ',
        placeholder: 'primary',
      },
      targetDefinitions: undefined,
      resolvedTargets: undefined,
    });

    expect(prepared.actionDefinition).toBeNull();
    expect(prepared.targetContext).toEqual({
      entityId: 'entity-7',
      displayName: 'Nominal Hero',
    });
  });

  it('forwards sanitized options to the command formatter', () => {
    const actionDefinition = {
      id: 'act-3',
      template: 'Inspect {primary}',
    };

    const targetContext = {
      entityId: 'entity-3',
      displayName: ' Scout ',
      placeholder: 'primary',
    };

    const prepared = formatter.prepareFallback({
      actionDefinition,
      targetContext,
      targetDefinitions: undefined,
      resolvedTargets: undefined,
    });

    const logger = { info: jest.fn() };
    const safeEventDispatcher = { dispatch: jest.fn() };

    formatter.formatWithFallback({
      preparedFallback: prepared,
      formatterOptions: {
        logger,
        debug: 'true',
        safeEventDispatcher,
        extraneous: 'ignored',
      },
    });

    expect(commandFormatter.format).toHaveBeenCalledWith(
      prepared.actionDefinition,
      { entityId: 'entity-3', displayName: 'Scout' },
      expect.anything(),
      {
        logger,
        debug: true,
        safeEventDispatcher,
      },
      { displayNameFn: expect.any(Function) }
    );
  });

  it('returns the original action definition when no template changes are required', () => {
    const actionDefinition = {
      id: 'act-5',
      template: 'Observe surroundings',
    };

    const prepared = formatter.prepareFallback({
      actionDefinition,
      targetContext: {
        entityId: 'entity-5',
        displayName: ' Explorer ',
        placeholder: 'primary',
      },
      targetDefinitions: undefined,
      resolvedTargets: undefined,
    });

    expect(prepared.actionDefinition).toBe(actionDefinition);
    expect(prepared.targetContext).toEqual({
      entityId: 'entity-5',
      displayName: 'Explorer',
    });
  });

  it('preserves non-string templates without modification', () => {
    const actionDefinition = {
      id: 'act-6',
      template: 42,
    };

    const prepared = formatter.prepareFallback({
      actionDefinition,
      targetContext: {
        entityId: 'entity-6',
        displayName: '  Analyst ',
        placeholder: 'primary',
      },
      targetDefinitions: undefined,
      resolvedTargets: undefined,
    });

    expect(prepared.actionDefinition).toBe(actionDefinition);
    expect(prepared.actionDefinition.template).toBe(42);
  });

  it('derives placeholders from resolved targets when definitions are absent', () => {
    const actionDefinition = {
      id: 'act-4',
      template: 'Guard {primary} against {secondary} and {tertiary}',
    };

    const targetContext = {
      entityId: 'entity-4',
      displayName: ' Captain ',
      placeholder: 'primary',
    };

    const resolvedTargets = {
      primary: [{ id: 'entity-4', displayName: 'Captain' }],
      secondary: [],
      tertiary: [{ name: 'Third Ally' }],
    };

    const prepared = formatter.prepareFallback({
      actionDefinition,
      targetContext,
      targetDefinitions: undefined,
      resolvedTargets,
    });

    expect(prepared.actionDefinition.template).toBe(
      'Guard {target} against and Third Ally'
    );
    expect(prepared.targetContext).toEqual({
      entityId: 'entity-4',
      displayName: 'Captain',
    });

    const result = formatter.formatWithFallback({
      preparedFallback: prepared,
      formatterOptions: null,
    });

    expect(result).toEqual({ ok: true, value: 'legacy-command' });
    expect(commandFormatter.format).toHaveBeenLastCalledWith(
      prepared.actionDefinition,
      { entityId: 'entity-4', displayName: 'Captain' },
      entityManager,
      {},
      { displayNameFn: expect.any(Function) }
    );
  });
});
