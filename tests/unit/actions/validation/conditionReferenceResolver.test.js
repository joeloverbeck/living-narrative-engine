import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { resolveReferences } from '../../../../src/actions/validation/conditionReferenceResolver.js';
import { resolveConditionRefs } from '../../../../src/utils/conditionRefResolver.js';

jest.mock('../../../../src/utils/conditionRefResolver.js');

describe('resolveReferences', () => {
  const mockRepo = { getConditionDefinition: jest.fn() };
  const mockLogger = { debug: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to resolveConditionRefs with a new Set by default', () => {
    const logic = { condition_ref: 'cond1' };
    const resolved = { any: 'value' };
    resolveConditionRefs.mockReturnValue(resolved);

    const result = resolveReferences(logic, mockRepo, mockLogger);

    expect(resolveConditionRefs).toHaveBeenCalledTimes(1);
    const args = resolveConditionRefs.mock.calls[0];
    expect(args[0]).toBe(logic);
    expect(args[1]).toBe(mockRepo);
    expect(args[2]).toBe(mockLogger);
    expect(args[3]).toBeInstanceOf(Set);
    expect(result).toBe(resolved);
  });

  it('passes through provided visited set', () => {
    const logic = { condition_ref: 'cond2' };
    const visited = new Set(['cond2']);
    resolveConditionRefs.mockReturnValue('ok');

    resolveReferences(logic, mockRepo, mockLogger, visited);

    expect(resolveConditionRefs).toHaveBeenCalledWith(
      logic,
      mockRepo,
      mockLogger,
      visited
    );
  });

  it('propagates errors from resolveConditionRefs', () => {
    const err = new Error('boom');
    resolveConditionRefs.mockImplementation(() => {
      throw err;
    });

    expect(() => resolveReferences({}, mockRepo, mockLogger)).toThrow(err);
  });
});
