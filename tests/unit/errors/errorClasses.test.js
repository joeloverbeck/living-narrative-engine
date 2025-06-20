import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActorError } from '../../../src/errors/actorError.js';
import { ActorMismatchError } from '../../../src/errors/actorMismatchError.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';
import ModsLoaderError from '../../../src/errors/modsLoaderError.js';
import PromptTooLongError from '../../../src/errors/promptTooLongError.js';
import {
  LLMInteractionError,
  ApiKeyError,
  InsufficientCreditsError,
  ContentPolicyError,
  PermissionError,
  BadRequestError,
  MalformedResponseError,
} from '../../../src/errors/llmInteractionErrors.js';

describe('custom error classes', () => {
  let original;
  beforeEach(() => {
    original = Error.captureStackTrace;
  });
  afterEach(() => {
    Error.captureStackTrace = original;
  });

  it('ActorError handles missing captureStackTrace', () => {
    Error.captureStackTrace = undefined;
    const err = new ActorError('a');
    expect(err.name).toBe('ActorError');
    expect(err.message).toBe('a');
    expect(err.stack).toBeDefined();
  });

  it('ActorMismatchError stores context', () => {
    const err = new ActorMismatchError('mismatch', {
      expectedActorId: 'e',
      actualActorId: 'a',
      operation: 'op',
    });
    expect(err.expectedActorId).toBe('e');
    expect(err.actualActorId).toBe('a');
    expect(err.operation).toBe('op');
  });

  it('ModDependencyError and ModsLoaderError support causes', () => {
    const cause = new Error('root');
    const modErr = new ModDependencyError('mod', cause);
    const worldErr = new ModsLoaderError('world', cause);
    expect(modErr.cause).toBe(cause);
    expect(worldErr.cause).toBe(cause);
  });

  it('PromptTooLongError stores token details', () => {
    const err = new PromptTooLongError('too long', {
      estimatedTokens: 10,
      promptTokenSpace: 5,
    });
    expect(err.estimatedTokens).toBe(10);
    expect(err.promptTokenSpace).toBe(5);
  });

  it('LLMInteractionError subclasses set names correctly', () => {
    const base = new LLMInteractionError('base', {
      status: 400,
      llmId: 'x',
      responseBody: {},
    });
    expect(base.status).toBe(400);
    expect(base.llmId).toBe('x');
    const classes = [
      ApiKeyError,
      InsufficientCreditsError,
      ContentPolicyError,
      PermissionError,
      BadRequestError,
      MalformedResponseError,
    ];
    for (const Cls of classes) {
      const e = new Cls('msg');
      expect(e).toBeInstanceOf(LLMInteractionError);
      expect(e.name).toBe(Cls.name);
    }
  });
});
