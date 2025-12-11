/**
 * @file Tests for MultiTargetActionFormatter dot-notation placeholder support.
 */

import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';

describe('MultiTargetActionFormatter - dot notation placeholders', () => {
  let formatter;
  let baseFormatter;
  let logger;
  const mockEntityManager = {};

  beforeEach(() => {
    baseFormatter = { format: jest.fn() };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    formatter = new MultiTargetActionFormatter(baseFormatter, logger);
  });

  it('resolves primary target name placeholders', () => {
    const actionDef = {
      id: 'containers:open_container',
      template: 'Open {primary.name}',
    };

    const resolvedTargets = {
      primary: [
        {
          id: 'container-1',
          displayName: 'Ancient Chest',
        },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'container' },
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      mockEntityManager,
      {},
      { targetDefinitions }
    );

    expect(result.ok).toBe(true);
    expect(result.value).toBe('Open Ancient Chest');
  });

  it('resolves multi-target combinations with dot notation placeholders', () => {
    const actionDef = {
      id: 'containers:take_from_container',
      template: 'take {secondary.name} from {primary.name}',
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [
        {
          id: 'container-1',
          displayName: 'Ancient Chest',
        },
      ],
      secondary: [
        { id: 'item-1', displayName: 'Silver Key' },
        { id: 'item-2', displayName: 'Gold Ring' },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'container' },
      secondary: { placeholder: 'item' },
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      mockEntityManager,
      {},
      { targetDefinitions }
    );

    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(2);
    const commands = result.value.map((entry) => entry.command);
    expect(commands).toEqual([
      'take Silver Key from Ancient Chest',
      'take Gold Ring from Ancient Chest',
    ]);
  });

  it('falls back to target id when template requests it explicitly', () => {
    const actionDef = {
      id: 'containers:put_in_container',
      template: 'Put {secondary.id} in {primary.name}',
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [
        {
          id: 'container-77',
          displayName: 'Supply Crate',
        },
      ],
      secondary: [{ id: 'item-3', displayName: 'Bandage' }],
    };

    const targetDefinitions = {
      primary: { placeholder: 'container' },
      secondary: { placeholder: 'item' },
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      mockEntityManager,
      {},
      { targetDefinitions }
    );

    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].command).toBe('Put item-3 in Supply Crate');
  });
});
