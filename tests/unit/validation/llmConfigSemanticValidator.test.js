/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
import { describe, test, expect } from '@jest/globals';
import {
  performSemanticValidations,
  SemanticErrorTypes,
} from '../../../src/validation/llmConfigSemanticValidator.js';

describe('performSemanticValidations', () => {
  test('returns error when configs map is not an object', () => {
    const result = performSemanticValidations(null);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      errorType: SemanticErrorTypes.INVALID_CONFIGS_STRUCTURE,
      path: '(root).configs',
    });
  });

  test('reports invalid config object entries', () => {
    const result = performSemanticValidations({ bad: null });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      configId: 'bad',
      errorType: SemanticErrorTypes.INVALID_CONFIG_OBJECT,
    });
  });

  test('detects missing promptElements when assembly order is provided', () => {
    const result = performSemanticValidations({
      cfg: { promptAssemblyOrder: ['foo'] },
    });
    // two errors are returned: missing prompt elements and the missing key
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          configId: 'cfg',
          errorType: SemanticErrorTypes.MISSING_PROMPT_ELEMENTS_FOR_ASSEMBLY,
          path: 'promptElements',
        }),
      ])
    );
  });

  test('flags non-string assembly order entries', () => {
    const result = performSemanticValidations({
      cfg: {
        promptElements: [{ key: 'foo' }],
        promptAssemblyOrder: [{ bad: true }],
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      configId: 'cfg',
      errorType: SemanticErrorTypes.INVALID_ASSEMBLY_KEY_TYPE,
      path: 'promptAssemblyOrder[0]',
    });
  });

  test('flags missing prompt element keys referenced in assembly order', () => {
    const result = performSemanticValidations({
      cfg: {
        promptElements: [{ key: 'foo' }],
        promptAssemblyOrder: ['bar'],
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      configId: 'cfg',
      errorType: SemanticErrorTypes.MISSING_ASSEMBLY_KEY,
      path: 'promptAssemblyOrder[0]',
    });
  });

  test('returns empty array when configuration is semantically valid', () => {
    const result = performSemanticValidations({
      cfg: {
        promptElements: [{ key: 'foo' }],
        promptAssemblyOrder: ['foo'],
      },
    });
    expect(result).toEqual([]);
  });

  test('ignores prototype properties in the configs map', () => {
    const proto = {
      inherited: {
        promptElements: [{ key: 'foo' }],
        promptAssemblyOrder: ['foo'],
      },
    };
    const map = Object.create(proto);
    const result = performSemanticValidations(map);
    expect(result).toEqual([]);
  });

  test('handles non-array promptElements and assembly order gracefully', () => {
    const result = performSemanticValidations({
      cfg: {
        promptElements: { key: 'foo' },
        promptAssemblyOrder: 'foo',
      },
    });
    expect(result).toEqual([]);
  });

  test('missing keys on prompt elements are detected via assembly order', () => {
    const result = performSemanticValidations({
      cfg: {
        promptElements: [{}],
        promptAssemblyOrder: ['foo'],
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      configId: 'cfg',
      errorType: SemanticErrorTypes.MISSING_ASSEMBLY_KEY,
    });
  });
});
