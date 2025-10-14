import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import ActionCommandFormatter from '../../../../../src/actions/actionFormatter.js';

function createStageWithFallback(baseCommandFormatterOverrides = {}) {
  const baseFormatter = new ActionCommandFormatter();
  const commandFormatter = {
    formatMultiTarget: jest
      .fn()
      .mockReturnValue({ ok: false, error: 'force fallback' }),
    format: baseFormatter.format.bind(baseFormatter),
    ...baseCommandFormatterOverrides,
  };

  const entityDisplayNames = new Map([
    ['bob', 'Bob'],
    ['pants1', 'pants'],
    ['skirt1', 'skirt'],
  ]);

  const entityManager = {
    getEntityInstance: jest.fn((id) => ({ id })),
  };

  const safeEventDispatcher = { dispatch: jest.fn() };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const errorContextBuilder = { buildErrorContext: jest.fn() };

  return new ActionFormattingStage({
    commandFormatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn: (entity, fallback) =>
      entityDisplayNames.get(entity?.id) ?? fallback,
    errorContextBuilder,
    logger,
  });
}

describe('ActionFormattingStage legacy fallback for rub over clothes actions', () => {
  let stage;

  beforeEach(() => {
    stage = createStageWithFallback();
  });

  function buildContext(template) {
    return {
      actor: { id: 'alice' },
      actionsWithTargets: [
        {
          actionDef: {
            id: template.includes('penis')
              ? 'sex:rub_penis_over_clothes'
              : 'sex:rub_vagina_over_clothes',
            name: 'Rub Over Clothes',
            template,
            targets: {
              primary: { placeholder: 'primary' },
              secondary: { placeholder: 'secondary', contextFrom: 'primary' },
            },
          },
          targetContexts: [
            {
              type: 'entity',
              entityId: 'bob',
              displayName: 'Bob',
              placeholder: 'primary',
            },
            {
              type: 'entity',
              entityId: template.includes('penis') ? 'pants1' : 'skirt1',
              displayName: template.includes('penis') ? 'pants' : 'skirt',
              placeholder: 'secondary',
              contextFromId: 'bob',
            },
          ],
          resolvedTargets: {
            primary: [
              {
                id: 'bob',
                displayName: 'Bob',
                type: 'entity',
              },
            ],
            secondary: [
              {
                id: template.includes('penis') ? 'pants1' : 'skirt1',
                displayName: template.includes('penis') ? 'pants' : 'skirt',
                type: 'entity',
                contextFromId: 'bob',
              },
            ],
          },
          targetDefinitions: {
            primary: { placeholder: 'primary' },
            secondary: { placeholder: 'secondary', contextFrom: 'primary' },
          },
          isMultiTarget: true,
        },
      ],
    };
  }

  it('replaces placeholders when formatting rub_penis_over_clothes via legacy fallback', async () => {
    const context = buildContext("rub {primary}'s penis over the {secondary}");

    const result = await stage.execute(context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].command).toBe("rub Bob's penis over the pants");
    expect(result.actions[0].command).not.toMatch(/\{[^}]+\}/);
  });

  it('replaces placeholders when formatting rub_vagina_over_clothes via legacy fallback', async () => {
    const context = buildContext("rub {primary}'s vagina over the {secondary}");

    const result = await stage.execute(context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].command).toBe("rub Bob's vagina over the skirt");
    expect(result.actions[0].command).not.toMatch(/\{[^}]+\}/);
  });
});
