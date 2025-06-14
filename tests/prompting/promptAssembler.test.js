/* eslint-env node */
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect"] }] */

import { jest, test, describe, beforeEach, expect } from '@jest/globals';

import { PromptAssembler } from '../../src/prompting/promptAssembler.js';

describe('PromptAssembler', () => {
  let placeholderResolver;
  let allElementsMap; // stub Map passed to every constructor

  beforeEach(() => {
    // Stub resolver that returns the input value
    placeholderResolver = { resolve: jest.fn((value) => value) };
    allElementsMap = new Map(); // content not important for these unit tests
  });

  test('builds prompt with multiple assemblers in order', () => {
    const assembler1 = { assemble: jest.fn(() => 'Hello ') };
    const assembler2 = { assemble: jest.fn(() => 'World!') };
    const elements = [
      {
        key: 'first',
        assembler: assembler1,
        elementConfig: {},
        promptData: {},
      },
      {
        key: 'second',
        assembler: assembler2,
        elementConfig: {},
        promptData: {},
      },
    ];
    const pa = new PromptAssembler({
      elements,
      placeholderResolver,
      allElementsMap,
    });
    const result = pa.build();

    expect(result.prompt).toBe('Hello World!');
    expect(result.errors).toEqual([]);
    expect(assembler1.assemble).toHaveBeenCalledWith(
      {},
      {},
      placeholderResolver,
      allElementsMap
    );
    expect(assembler2.assemble).toHaveBeenCalledWith(
      {},
      {},
      placeholderResolver,
      allElementsMap
    );
  });

  test('catches error from failing assembler and continues', () => {
    const assembler1 = { assemble: jest.fn(() => 'X') };
    const error = new Error('fail');
    const assembler2 = {
      assemble: jest.fn(() => {
        throw error;
      }),
    };
    const assembler3 = { assemble: jest.fn(() => 'Y') };
    const elements = [
      {
        key: 'a',
        assembler: assembler1,
        elementConfig: { foo: 1 },
        promptData: { bar: 2 },
      },
      {
        key: 'b',
        assembler: assembler2,
        elementConfig: { foo: 3 },
        promptData: { bar: 4 },
      },
      {
        key: 'c',
        assembler: assembler3,
        elementConfig: { foo: 5 },
        promptData: { bar: 6 },
      },
    ];
    const pa = new PromptAssembler({
      elements,
      placeholderResolver,
      allElementsMap,
    });
    const result = pa.build();

    expect(result.prompt).toBe('XY');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ key: 'b', error });
  });

  test('constructor throws if elements is not an array', () => {
    expect(
      () =>
        new PromptAssembler({
          elements: null,
          placeholderResolver,
          allElementsMap,
        })
    ).toThrow('elements');
    expect(
      () =>
        new PromptAssembler({
          elements: {},
          placeholderResolver,
          allElementsMap,
        })
    ).toThrow('elements');
  });

  test('constructor throws if placeholderResolver invalid', () => {
    expect(
      () =>
        new PromptAssembler({
          elements: [],
          placeholderResolver: null,
          allElementsMap,
        })
    ).toThrow('placeholderResolver');
    expect(
      () =>
        new PromptAssembler({
          elements: [],
          placeholderResolver: {},
          allElementsMap,
        })
    ).toThrow('placeholderResolver');
  });

  test('build on empty elements returns empty prompt and no errors', () => {
    const pa = new PromptAssembler({
      elements: [],
      placeholderResolver,
      allElementsMap,
    });
    const result = pa.build();

    expect(result.prompt).toBe('');
    expect(result.errors).toEqual([]);
  });
});
