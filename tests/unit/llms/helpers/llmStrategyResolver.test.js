import { describe, test, expect } from '@jest/globals';
import { LLMStrategyResolver } from '../../../../src/llms/helpers/llmStrategyResolver.js';

class A {}
class B {}

const map = { api: { methodA: A, methodB: B } };

describe('LLMStrategyResolver', () => {
  test('returns mapped strategy class', () => {
    const resolver = new LLMStrategyResolver(map);
    expect(resolver.resolveStrategy('api', 'methodA')).toBe(A);
  });

  test('returns undefined for unknown mapping', () => {
    const resolver = new LLMStrategyResolver(map);
    expect(resolver.resolveStrategy('api', 'missing')).toBeUndefined();
  });
});
