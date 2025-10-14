import { LegacyFallbackFormatter } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyFallbackFormatter.js';

describe('LegacyFallbackFormatter', () => {
  let commandFormatter;
  let formatter;

  beforeEach(() => {
    commandFormatter = {
      format: jest.fn().mockReturnValue({ ok: true, value: 'legacy-command' }),
    };

    formatter = new LegacyFallbackFormatter({
      commandFormatter,
      entityManager: { getEntityInstance: jest.fn() },
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
});
