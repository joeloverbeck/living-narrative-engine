// src/utils/PlaceholderResolver.test.js
// --- FILE START ---
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { PlaceholderResolver } from '../../../src/utils/placeholderResolverUtils.js';
import { parsePlaceholderKey } from '../../../src/utils/placeholderPatterns.js';
import { buildResolutionSources } from '../../../src/utils/placeholderSources.js';
import { createMockLogger } from '../testUtils.js'; // Adjust path as needed (assuming testUtils.js from previous adjustment)
import * as loggerUtils from '../../../src/utils/loggerUtils.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('parsePlaceholderKey', () => {
  it('strips trailing ? and marks optional', () => {
    expect(parsePlaceholderKey('key?')).toEqual({ key: 'key', optional: true });
  });

  it('trims whitespace and handles non-optional', () => {
    expect(parsePlaceholderKey('  path.to.val  ')).toEqual({
      key: 'path.to.val',
      optional: false,
    });
  });
});

describe('PlaceholderResolver', () => {
  let mockLogger;
  let resolver;

  beforeEach(() => {
    mockLogger = createMockLogger();
    resolver = new PlaceholderResolver(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should use the provided logger', () => {
      // Test indirectly: if a warning occurs, the provided logger should be called.
      resolver.resolve('test {missing}', {});
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should default to console if no logger is provided', () => {
      // This is harder to test without intercepting console.
      // We assume it works and mainly test with the mocked logger.
      const resolverWithoutLogger = new PlaceholderResolver();
      expect(resolverWithoutLogger).toBeInstanceOf(PlaceholderResolver);
      // To truly test console, one might spy on global.console.warn temporarily.
      // For now, this is an implicit check.
    });

    it('should call ensureValidLogger with the provided logger', () => {
      const spy = jest.spyOn(loggerUtils, 'ensureValidLogger');
      const logger = createMockLogger();

      new PlaceholderResolver(logger);
      expect(spy).toHaveBeenCalledWith(logger, 'PlaceholderResolver');
      spy.mockRestore();
    });

    it('should fall back to console when logger is invalid', () => {
      const invalidLogger = { log: 123 };
      const ensureSpy = jest.spyOn(loggerUtils, 'ensureValidLogger');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const resolverWithInvalid = new PlaceholderResolver(invalidLogger);
      expect(resolverWithInvalid).toBeInstanceOf(PlaceholderResolver);
      expect(ensureSpy).toHaveBeenCalledWith(
        invalidLogger,
        'PlaceholderResolver'
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      resolverWithInvalid.resolve('test {missing}', {});
      expect(warnSpy).toHaveBeenCalledTimes(2);
      warnSpy.mockRestore();
      ensureSpy.mockRestore();
    });
  });

  describe('resolve', () => {
    it('should return an empty string if input str is null', () => {
      expect(resolver.resolve(null, {})).toBe('');
    });

    it('should return an empty string if input str is undefined', () => {
      expect(resolver.resolve(undefined, {})).toBe('');
    });

    it('should return an empty string if input str is not a string', () => {
      // @ts-ignore
      expect(resolver.resolve(123, {})).toBe('');
      // @ts-ignore
      expect(resolver.resolve({}, {})).toBe('');
    });

    it('should return the original string if it contains no placeholders', () => {
      const str = 'Hello world, no placeholders here.';
      expect(resolver.resolve(str, { name: 'Test' })).toBe(str);
    });

    it('should return an empty string if the input string is empty', () => {
      expect(resolver.resolve('', { name: 'Test' })).toBe('');
    });

    it('should resolve a single placeholder from a single data source', () => {
      const str = 'Hello {name}!';
      const data = { name: 'Alice' };
      expect(resolver.resolve(str, data)).toBe('Hello Alice!');
    });

    it('should resolve multiple placeholders from a single data source', () => {
      const str = 'User: {username}, Age: {age}.';
      const data = { username: 'bob', age: 30 };
      expect(resolver.resolve(str, data)).toBe('User: bob, Age: 30.');
    });

    it('should resolve placeholders with leading/trailing spaces in keys within braces', () => {
      const str = 'Value: {  key  }';
      const data = { key: 'testValue' };
      expect(resolver.resolve(str, data)).toBe('Value: testValue');
    });

    it('should resolve placeholders from the first matching data source if multiple are provided', () => {
      const str = 'Name: {name}, City: {city}.';
      const data1 = { name: 'Data1Name' };
      const data2 = { name: 'Data2Name', city: 'Data2City' };
      const data3 = { city: 'Data3City' };
      expect(resolver.resolve(str, data1, data2, data3)).toBe(
        'Name: Data1Name, City: Data2City.'
      );
    });

    it('should skip non-object data sources gracefully', () => {
      const str = 'Value: {key}';
      const data1 = { key: 'actualValue' };
      // @ts-ignore
      expect(
        resolver.resolve(str, null, data1, undefined, 'string_source', 123)
      ).toBe('Value: actualValue');
      expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings for invalid sources, just for missing keys
    });

    it('should replace placeholder with an empty string and log a warning if key is not found in any data source', () => {
      const str = 'Hello {name}, from {city}.';
      const data = { name: 'Alice' };
      expect(resolver.resolve(str, data)).toBe('Hello Alice, from .');
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PlaceholderResolver: Placeholder "{city}" not found in provided data sources. Replacing with empty string.'
      );
    });

    it('should replace with empty string for multiple missing keys and log warnings for each', () => {
      const str = 'Data: {val1} {val2} {val3}';
      const data = { val2: 'Found' };
      expect(resolver.resolve(str, data)).toBe('Data:  Found ');
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PlaceholderResolver: Placeholder "{val1}" not found in provided data sources. Replacing with empty string.'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PlaceholderResolver: Placeholder "{val3}" not found in provided data sources. Replacing with empty string.'
      );
    });

    it('should replace placeholder with an empty string if its value is null in data source', () => {
      const str = 'Value: {key}';
      const data = { key: null };
      expect(resolver.resolve(str, data)).toBe('Value: ');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should replace placeholder with an empty string if its value is undefined in data source', () => {
      const str = 'Value: {key}';
      const data = { key: undefined };
      expect(resolver.resolve(str, data)).toBe('Value: ');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should convert number values to strings', () => {
      const str = 'Count: {count}, Price: {price}';
      const data = { count: 5, price: 10.99 };
      expect(resolver.resolve(str, data)).toBe('Count: 5, Price: 10.99');
    });

    it('should convert boolean values to strings', () => {
      const str = 'Is Active: {isActive}, Is Admin: {isAdmin}';
      const data = { isActive: true, isAdmin: false };
      expect(resolver.resolve(str, data)).toBe(
        'Is Active: true, Is Admin: false'
      );
    });

    it('should handle empty string values correctly', () => {
      const str = 'Text: [{text}]';
      const data = { text: '' };
      expect(resolver.resolve(str, data)).toBe('Text: []');
    });

    it('should handle complex strings with multiple types of placeholders and missing keys', () => {
      const str =
        'User: {user}, ID: {id}, Status: {status}, Role: {role}, Zip: {zip}';
      const data1 = { user: 'johndoe', id: 123 };
      const data2 = { status: true, role: null }; // zip is missing
      expect(resolver.resolve(str, data1, data2)).toBe(
        'User: johndoe, ID: 123, Status: true, Role: , Zip: '
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PlaceholderResolver: Placeholder "{zip}" not found in provided data sources. Replacing with empty string.'
      );
    });

    it('should not confuse object prototype properties with data source keys', () => {
      const str = 'Value: {toString}';
      const data = { myKey: 'myValue' }; // does not have 'toString' as own property
      expect(resolver.resolve(str, data)).toBe('Value: ');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PlaceholderResolver: Placeholder "{toString}" not found in provided data sources. Replacing with empty string.'
      );
    });

    it('should correctly resolve a key that exists as an own property, even if it matches a prototype property name', () => {
      const str = 'Value: {toString}';
      const data = { toString: 'custom_to_string_value' };
      expect(resolver.resolve(str, data)).toBe('Value: custom_to_string_value');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should resolve dotted paths using nested objects', () => {
      const str = 'Name: {user.info.name}';
      const data = { user: { info: { name: 'Alice' } } };
      expect(resolver.resolve(str, data)).toBe('Name: Alice');
    });

    it('should handle placeholders that include dashes in keys', () => {
      const str = 'Weird: {key.with.dots} and {key-with-dashes}';
      const data = {
        key: { with: { dots: 'dots_ok' } },
        'key-with-dashes': 'dashes_ok',
      };
      expect(resolver.resolve(str, data)).toBe('Weird: dots_ok and dashes_ok');
    });

    it('should support optional placeholders with trailing ?', () => {
      const str = 'Maybe {missing.value?}!';
      const data = { greeting: 'hi' };
      expect(resolver.resolve(str, data)).toBe('Maybe !');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should support optional placeholders with surrounding spaces', () => {
      const str = 'Maybe {  missing.value?  }!';
      const data = {};
      expect(resolver.resolve(str, data)).toBe('Maybe !');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('resolves optional placeholders with spaces when present', () => {
      const str = 'Value: {  key?  }';
      const data = { key: 'yes' };
      expect(resolver.resolve(str, data)).toBe('Value: yes');
    });

    it('should handle strings with only a placeholder', () => {
      const str = '{only_me}';
      const data = { only_me: 'just_value' };
      expect(resolver.resolve(str, data)).toBe('just_value');
    });

    it('should handle strings with adjacent placeholders', () => {
      const str = '{first}{second}';
      const data = { first: 'part1', second: 'part2' };
      expect(resolver.resolve(str, data)).toBe('part1part2');
    });
  });

  describe('resolveStructure', () => {
    it('should resolve placeholders when input is a string', () => {
      const result = resolver.resolveStructure('Hello {name}', {
        name: 'Alice',
      });
      expect(result).toBe('Hello Alice');
    });

    it('should resolve placeholders when input is an array', () => {
      const result = resolver.resolveStructure(['{a}', '{b}'], {
        a: 1,
        b: 'x',
      });
      expect(result).toEqual([1, 'x']);
    });

    it('should recursively resolve placeholders in objects and arrays', () => {
      const input = {
        greeting: 'Hello {name}',
        age: '{age}',
        nested: ['{name}', { deep: '{age}' }],
      };
      const result = resolver.resolveStructure(input, { name: 'Bob', age: 42 });
      expect(result).toEqual({
        greeting: 'Hello Bob',
        age: 42,
        nested: ['Bob', { deep: 42 }],
      });
    });

    it('should resolve placeholders when input is an object', () => {
      const result = resolver.resolveStructure({ val: '{x}' }, { x: 'y' });
      expect(result).toEqual({ val: 'y' });
    });

    it('should return undefined for unresolved full placeholders', () => {
      const input = '{missing}';
      const result = resolver.resolveStructure(input, { present: 'yes' });
      expect(result).toBeUndefined();
    });

    it('should support optional placeholders with trailing ?', () => {
      const input = '{missing?}';
      const result = resolver.resolveStructure(input, { value: 1 });
      expect(result).toBeUndefined();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('buildResolutionSources', () => {
    it('should build sources from execution context and resolve placeholders', () => {
      const executionContext = {
        evaluationContext: { context: { val: 'foo' } },
        actor: { components: { [NAME_COMPONENT_ID]: { text: 'Hero' } } },
      };
      const { sources, fallback } = buildResolutionSources(executionContext);
      const result = resolver.resolveStructure(
        '{context.val} {actor.name}',
        sources,
        fallback
      );
      expect(result).toBe('foo Hero');
    });
  });

  describe('_handleFullString and _replaceEmbedded', () => {
    it('resolves a full placeholder and logs debug', () => {
      const res = resolver._handleFullString('{name}', [{ name: 'Alice' }]);
      expect(res).toEqual({ changed: true, value: 'Alice' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Resolved full string placeholder {name} to: Alice'
        )
      );
    });

    it('returns undefined and logs warning when full placeholder missing', () => {
      const res = resolver._handleFullString('{missing}', [{}]);
      expect(res).toEqual({ changed: true, value: undefined });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PlaceholderResolver: Placeholder "{missing}" not found in provided data sources. Replacing with empty string.'
      );
    });

    it('resolves optional full-string placeholders with spaces', () => {
      const res = resolver._handleFullString('{ key? }', [{ key: 'ok' }]);
      expect(res).toEqual({ changed: true, value: 'ok' });
    });

    it('returns undefined without warning for optional full-string placeholders', () => {
      const res = resolver._handleFullString('{ missing? }', [{}]);
      expect(res).toEqual({ changed: true, value: undefined });
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('replaces embedded placeholders in a string', () => {
      const res = resolver._replaceEmbedded('Hello {name}', [{ name: 'Bob' }]);
      expect(res).toEqual({ changed: true, value: 'Hello Bob' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Replaced embedded placeholder {name} with string: "Bob"'
        )
      );
    });

    it('returns unchanged when no placeholders present', () => {
      const res = resolver._replaceEmbedded('Nothing here', [{}]);
      expect(res).toEqual({ changed: false, value: 'Nothing here' });
    });
  });
});
// --- FILE END ---
