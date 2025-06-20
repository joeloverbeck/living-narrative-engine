import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { resolvePlaceholders } from '../../../src/utils/contextUtils.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createMockLogger } from '../testUtils.js';

describe('resolvePlaceholders integration', () => {
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('resolves placeholders from evaluationContext', () => {
    const input = {
      text: 'Value is {context.score}',
      value: '{context.score}',
    };
    const execCtx = { evaluationContext: { context: { score: 42 } } };

    const result = resolvePlaceholders(input, execCtx, logger);
    expect(result).toEqual({ text: 'Value is 42', value: 42 });
  });

  it('falls back to actor name when not directly available', () => {
    const actor = {
      id: 'a1',
      getComponentData: jest.fn((id) =>
        id === NAME_COMPONENT_ID ? { text: 'Hero' } : undefined
      ),
    };
    const result = resolvePlaceholders('Hello {actor.name}', { actor }, logger);
    expect(result).toBe('Hello Hero');
  });

  it('honors skipKeys during resolution', () => {
    const execCtx = { actor: { id: 'a1', name: 'Hero' } };
    const input = { keep: '{actor.name}', use: '{actor.name}' };
    const result = resolvePlaceholders(input, execCtx, logger, '', ['keep']);
    expect(result).toEqual({ keep: '{actor.name}', use: 'Hero' });
  });

  it('logs a warning when placeholder is missing', () => {
    resolvePlaceholders('Missing {unknown}', {}, logger);
    expect(logger.warn).toHaveBeenCalledWith(
      'PlaceholderResolver: Placeholder "{unknown}" not found in provided data sources. Replacing with empty string.'
    );
  });

  it('does not warn for optional placeholders', () => {
    const out = resolvePlaceholders('Maybe {unknown?}', {}, logger);
    expect(out).toBe('Maybe ');
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
