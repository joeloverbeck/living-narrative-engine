import { describe, test, expect } from '@jest/globals';
import { getLlmId } from '../../../../src/llms/utils/llmUtils.js';

describe('getLlmId', () => {
  test('returns configId when present', () => {
    const config = { configId: 'llm-123' };
    expect(getLlmId(config)).toBe('llm-123');
  });

  test('returns fallback when configId missing', () => {
    expect(getLlmId({})).toBe('UnknownLLM');
    expect(getLlmId(null)).toBe('UnknownLLM');
    expect(getLlmId(undefined)).toBe('UnknownLLM');
  });
});
