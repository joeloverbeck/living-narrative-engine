import { describe, it, expect, beforeEach } from '@jest/globals';
import { ExecutionPlaceholderResolver } from '../../../src/utils/executionPlaceholderResolver.js';

/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
import { createMockLogger } from '../testUtils.js';

describe('ExecutionPlaceholderResolver', () => {
  /** @type {ILogger} */
  let logger;
  /** @type {ExecutionPlaceholderResolver} */
  let resolver;

  beforeEach(() => {
    logger = createMockLogger();
    resolver = new ExecutionPlaceholderResolver(logger);
  });

  it('buildSources returns same data as buildResolutionSources', () => {
    const exec = { evaluationContext: { context: { val: 'a' } } };
    const built = resolver.buildSources(exec);
    expect(built.sources[2].context.val).toBe('a');
  });

  it('resolvePathFromContext resolves a simple path', () => {
    const exec = { actor: { id: 'a1' } };
    const value = resolver.resolvePathFromContext('actor.id', exec);
    expect(value).toBe('a1');
  });

  it('resolveFromContext resolves placeholders in structure', () => {
    const exec = {
      actor: { name: 'Hero' },
      evaluationContext: { context: { val: 5 } },
    };
    const result = resolver.resolveFromContext(
      'Val {context.val} {actor.name}',
      exec
    );
    expect(result).toBe('Val 5 Hero');
  });
});
