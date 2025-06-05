// src/errors/promptError.test.js
// --- FILE START ---

import { PromptError } from '../../src/errors/promptError.js';
import { describe, expect, test } from '@jest/globals'; // Adjust path as needed

describe('PromptError', () => {
  const defaultMessage = 'Something went wrong during prompting.';

  test('should create an instance of PromptError and Error', () => {
    const error = new PromptError(defaultMessage);
    expect(error).toBeInstanceOf(PromptError);
    expect(error).toBeInstanceOf(Error);
  });

  test('should have the correct name property', () => {
    const error = new PromptError(defaultMessage);
    expect(error.name).toBe('PromptError');
  });

  test('should set the message correctly', () => {
    const error = new PromptError(defaultMessage);
    expect(error.message).toBe(defaultMessage);
  });

  test('should store the originalError in the cause property when provided', () => {
    const originalCause = new Error('Underlying issue');
    const error = new PromptError(defaultMessage, originalCause);
    expect(error.cause).toBe(originalCause);
  });

  test('should have cause property undefined when originalError is not provided', () => {
    const error = new PromptError(defaultMessage);
    expect(error.cause).toBeUndefined();
  });

  test('should store non-Error originalError in the cause property', () => {
    const originalCause = 'Just a string cause';
    const error = new PromptError(defaultMessage, originalCause);
    expect(error.cause).toBe(originalCause);
  });

  test('should have a stack trace', () => {
    const error = new PromptError(defaultMessage);
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
    // Check if the stack trace includes the class name
    expect(error.stack).toContain('PromptError');
    // Check if the stack trace includes the message
    expect(error.stack).toContain(defaultMessage);
  });
});

// --- FILE END ---
