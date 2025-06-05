// src/services/promptElementAssemblers/standardElementAssembler.test.js
// --- FILE START ---
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { StandardElementAssembler } from '../../../src/prompting/assembling/standardElementAssembler.js'; // Adjust path as needed
import { createMockLogger } from '../../testUtils.js'; // Adjust path for your test utils
// We will use the actual snakeToCamel from textUtils since it's a utility function
import { snakeToCamel } from '../../../src/utils/textUtils.js';

// Mock PlaceholderResolver
const mockPlaceholderResolverInstance = {
  resolve: jest.fn(),
};

// Mock class to instantiate PlaceholderResolver if needed, though we'll pass the mocked instance directly
jest.mock('../../../src/utils/placeholderResolver.js', () => ({
  PlaceholderResolver: jest.fn(() => mockPlaceholderResolverInstance),
}));

describe('StandardElementAssembler', () => {
  let mockLogger;
  let assembler;
  // This is the mock instance we control for PlaceholderResolver's methods
  let activeMockPlaceholderResolver;

  beforeEach(() => {
    mockLogger = createMockLogger();
    // Reset and reassign the mock for placeholderResolver.resolve for each test
    mockPlaceholderResolverInstance.resolve.mockReset();
    activeMockPlaceholderResolver = mockPlaceholderResolverInstance; // Use the module-level mock instance

    assembler = new StandardElementAssembler({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with a logger', () => {
      expect(assembler).toBeInstanceOf(StandardElementAssembler);
      // Indirectly check logger by causing an error/warning in assemble
      assembler.assemble(null, {}, activeMockPlaceholderResolver);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('assemble', () => {
    const samplePromptData = {
      userQueryContent: 'Tell me a joke.',
      characterSheetContent: 'You are a helpful AI.',
      globalVar: 'testValue',
    };
    const sampleAllPromptElementsMap = new Map(); // Not used by this assembler

    it('should return an empty string and log error if elementConfig is missing', () => {
      const result = assembler.assemble(
        null,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'StandardElementAssembler.assemble: Missing required parameters (elementConfig, promptData, or placeholderResolver).',
        expect.objectContaining({ elementConfigProvided: false })
      );
    });

    it('should return an empty string and log error if promptData is missing', () => {
      const elementConfig = { key: 'test_key' };
      const result = assembler.assemble(
        elementConfig,
        null,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'StandardElementAssembler.assemble: Missing required parameters (elementConfig, promptData, or placeholderResolver).',
        expect.objectContaining({ promptDataProvider: false })
      );
    });

    it('should return an empty string and log error if placeholderResolver is missing', () => {
      const elementConfig = { key: 'test_key' };
      const result = assembler.assemble(
        elementConfig,
        samplePromptData,
        null,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'StandardElementAssembler.assemble: Missing required parameters (elementConfig, promptData, or placeholderResolver).',
        expect.objectContaining({ placeholderResolverProvided: false })
      );
    });

    it('should return an empty string and log warning if elementConfig.key is missing or invalid', () => {
      activeMockPlaceholderResolver.resolve.mockImplementation((str) => str); // Default pass-through

      let elementConfig = { prefix: 'p', suffix: 's' }; // No key
      let result = assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `StandardElementAssembler.assemble: Invalid or missing 'key' in elementConfig. Cannot process element.`,
        { elementConfig }
      );
      mockLogger.warn.mockClear();

      // @ts-ignore
      elementConfig = { key: 123, prefix: 'p', suffix: 's' }; // Invalid key type
      result = assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `StandardElementAssembler.assemble: Invalid or missing 'key' in elementConfig. Cannot process element.`,
        { elementConfig }
      );
    });

    it('should correctly assemble with prefix, content, and suffix', () => {
      const elementConfig = {
        key: 'user_query',
        prefix: 'User: {globalVar} ',
        suffix: ' EndQuery',
      };
      activeMockPlaceholderResolver.resolve.mockImplementation((str, data) => {
        if (str === elementConfig.prefix) return `User: ${data.globalVar} `;
        if (str === elementConfig.suffix) return ' EndQuery';
        return str;
      });

      const result = assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      const expectedContentKey = snakeToCamel(elementConfig.key) + 'Content'; // userQueryContent

      expect(activeMockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        elementConfig.prefix,
        samplePromptData
      );
      expect(activeMockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        elementConfig.suffix,
        samplePromptData
      );
      expect(result).toBe(
        `User: testValue ${samplePromptData[expectedContentKey]} EndQuery`
      );
    });

    it('should handle missing prefix (default to empty string)', () => {
      const elementConfig = { key: 'user_query', suffix: ' EndQuery' }; // No prefix
      activeMockPlaceholderResolver.resolve.mockImplementation((str, _data) => {
        if (str === '') return ''; // For the undefined prefix
        if (str === elementConfig.suffix) return ' EndQuery';
        return str;
      });

      const result = assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(activeMockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        '',
        samplePromptData
      ); // Prefix defaults to ""
      expect(result).toBe(`${samplePromptData.userQueryContent} EndQuery`);
    });

    it('should handle missing suffix (default to empty string)', () => {
      const elementConfig = { key: 'user_query', prefix: 'User: ' }; // No suffix
      activeMockPlaceholderResolver.resolve.mockImplementation((str, _data) => {
        if (str === elementConfig.prefix) return 'User: ';
        if (str === '') return ''; // For the undefined suffix
        return str;
      });
      const result = assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(activeMockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        '',
        samplePromptData
      ); // Suffix defaults to ""
      expect(result).toBe(`User: ${samplePromptData.userQueryContent}`);
    });

    it('should derive content key correctly using snakeToCamel', () => {
      const elementConfig = { key: 'character_sheet' };
      activeMockPlaceholderResolver.resolve.mockReturnValue(''); // Assume no prefix/suffix for simplicity

      assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      // Check that promptData.characterSheetContent was accessed, which is derived via snakeToCamel
      // This is implicitly tested by checking the output:
      expect(
        assembler.assemble(
          elementConfig,
          samplePromptData,
          activeMockPlaceholderResolver,
          sampleAllPromptElementsMap
        )
      ).toBe(samplePromptData.characterSheetContent);
    });

    it('should use empty string for content if key is not in promptData (null or undefined)', () => {
      const elementConfig = { key: 'missing_key' }; // missingKeyContent will be undefined
      activeMockPlaceholderResolver.resolve.mockReturnValue('');
      const result = assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "StandardElementAssembler: Content for 'missing_key' (derived key: 'missingKeyContent') is null or undefined. Treating as empty string."
      );
    });

    it('should use empty string for content if rawContent in promptData is null', () => {
      const elementConfig = { key: 'null_content_key' };
      const localPromptData = {
        ...samplePromptData,
        nullContentKeyContent: null,
      };
      activeMockPlaceholderResolver.resolve.mockReturnValue('');

      const result = assembler.assemble(
        elementConfig,
        localPromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "StandardElementAssembler: Content for 'null_content_key' (derived key: 'nullContentKeyContent') is null or undefined. Treating as empty string."
      );
    });

    it('should use empty string and log warning if rawContent is not a string, null, or undefined', () => {
      const elementConfig = { key: 'numeric_content_key' };
      const localPromptData = {
        ...samplePromptData,
        numericContentKeyContent: 123,
      };
      activeMockPlaceholderResolver.resolve.mockReturnValue('');

      const result = assembler.assemble(
        elementConfig,
        localPromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "StandardElementAssembler: Content for 'numeric_content_key' (derived key: 'numericContentKeyContent') is not a string, null, or undefined. It is of type 'number'. Treating as empty string for this element."
      );
    });

    it('should return only prefix and suffix if content is empty/missing', () => {
      const elementConfig = {
        key: 'missing_key',
        prefix: 'Start:',
        suffix: ':End',
      };
      activeMockPlaceholderResolver.resolve.mockImplementation((str, _data) => {
        if (str === 'Start:') return 'Start:';
        if (str === ':End') return ':End';
        return '';
      });
      const result = assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('Start::End');
    });

    it('should return an empty string and log debug if prefix, content, and suffix are all empty', () => {
      const elementConfig = { key: 'another_missing_key' }; // No prefix/suffix by default
      activeMockPlaceholderResolver.resolve.mockReturnValue(''); // Resolved prefix/suffix are empty
      // promptData does not have anotherMissingKeyContent, so content is empty

      const result = assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "StandardElementAssembler: Content for 'another_missing_key' (derived key: 'anotherMissingKeyContent') is null or undefined. Treating as empty string."
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "StandardElementAssembler: Element 'another_missing_key' is entirely empty (prefix, content, suffix). Output for this element is empty."
      );
    });

    it('should assemble correctly when only content is present', () => {
      const elementConfig = { key: 'user_query' }; // No prefix/suffix
      activeMockPlaceholderResolver.resolve.mockReturnValue('');

      const result = assembler.assemble(
        elementConfig,
        samplePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe(samplePromptData.userQueryContent);
      // Ensure debug for empty element is NOT called if content exists
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('is entirely empty (prefix, content, suffix)')
      );
    });
  });
});
// --- FILE END ---
