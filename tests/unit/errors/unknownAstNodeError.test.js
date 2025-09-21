import { describe, it, expect } from '@jest/globals';
import BaseError from '../../../src/errors/baseError.js';
import { UnknownAstNodeError } from '../../../src/errors/unknownAstNodeError.js';

describe('UnknownAstNodeError', () => {
  it('extends BaseError and exposes contextual information', () => {
    const error = new UnknownAstNodeError('JsonLogic');

    expect(error).toBeInstanceOf(UnknownAstNodeError);
    expect(error).toBeInstanceOf(BaseError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Unknown AST node type: JsonLogic');
    expect(error.code).toBe('UNKNOWN_AST_NODE_ERROR');
    expect(error.name).toBe('UnknownAstNodeError');
    expect(error.nodeType).toBe('JsonLogic');
    expect(error.getContext()).toEqual({ nodeType: 'JsonLogic' });

    const serialized = error.toJSON();
    expect(serialized.context).toEqual({ nodeType: 'JsonLogic' });
    expect(serialized.code).toBe('UNKNOWN_AST_NODE_ERROR');
  });

  it('reports severity metadata for monitoring workflows', () => {
    const error = new UnknownAstNodeError('ElseNode');

    expect(error.getSeverity()).toBe('error');
    expect(error.isRecoverable()).toBe(false);
    expect(error.recoverable).toBe(false);
    expect(error.severity).toBe('error');
  });
});
