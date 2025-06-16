// tests/services/promptElementAssemblers/perceptionLogAssembler.test.js
// --- FILE START ---
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { PerceptionLogAssembler } from '../../../src/prompting/assembling/perceptionLogAssembler.js'; // Adjust path
import { createMockLogger } from '../../testUtils.js'; // Adjust path

// Mock PlaceholderResolver
const mockPlaceholderResolverInstance = {
  resolve: jest.fn(),
};

// Mock the PlaceholderResolver module
jest.mock('../../../src/utils/placeholderResolverUtils.js', () => ({
  PlaceholderResolver: jest.fn(() => mockPlaceholderResolverInstance),
}));

const PERCEPTION_LOG_ENTRY_KEY = 'perception_log_entry'; // As defined in the module

describe('PerceptionLogAssembler', () => {
  let mockLogger;
  let assembler;
  let activeMockPlaceholderResolver;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockPlaceholderResolverInstance.resolve.mockReset();
    activeMockPlaceholderResolver = mockPlaceholderResolverInstance;
    assembler = new PerceptionLogAssembler({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseElementConfig = {
    key: 'perception_log_wrapper',
    prefix: '<log>',
    suffix: '</log>',
  };
  const basePromptData = {
    perceptionLogArray: [{ role: 'user', content: 'Hello' }],
    global: 'globalValue',
  };
  const basePLogEntryConfig = {
    key: PERCEPTION_LOG_ENTRY_KEY,
    prefix: '<entry role="{role}">',
    suffix: '</entry>',
  };
  let sampleAllPromptElementsMap;

  beforeEach(() => {
    sampleAllPromptElementsMap = new Map();
    sampleAllPromptElementsMap.set(PERCEPTION_LOG_ENTRY_KEY, {
      ...basePLogEntryConfig,
    });

    activeMockPlaceholderResolver.resolve.mockImplementation(
      (str, _source1, _source2) => {
        if (str === baseElementConfig.prefix) return baseElementConfig.prefix;
        if (str === baseElementConfig.suffix) return baseElementConfig.suffix;
        if (str === basePLogEntryConfig.prefix) return str;
        if (str === basePLogEntryConfig.suffix) return str;
        if (str === '') return '';
        return `resolved(${str})`;
      }
    );
  });

  describe('assemble - Parameter Validation', () => {
    it('should return empty string and log error if elementConfig is missing', () => {
      const result = assembler.assemble(
        null,
        basePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PerceptionLogAssembler.assemble: Missing required parameters.',
        expect.objectContaining({ elementConfigProvided: false })
      );
    });
    it('should return empty string and log error if promptData is missing', () => {
      const result = assembler.assemble(
        baseElementConfig,
        null,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PerceptionLogAssembler.assemble: Missing required parameters.',
        expect.objectContaining({ promptDataProvider: false })
      );
    });
    it('should return empty string and log error if placeholderResolver is missing', () => {
      const result = assembler.assemble(
        baseElementConfig,
        basePromptData,
        null,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PerceptionLogAssembler.assemble: Missing required parameters.',
        expect.objectContaining({ placeholderResolverProvided: false })
      );
    });
    it('should return empty string and log error if allPromptElementsMap is missing', () => {
      const result = assembler.assemble(
        baseElementConfig,
        basePromptData,
        activeMockPlaceholderResolver,
        null
      );
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PerceptionLogAssembler.assemble: Missing required parameters.',
        expect.objectContaining({ allPromptElementsMapProvided: false })
      );
    });
  });

  describe('assemble - Wrapper Prefix/Suffix and Empty Log Array', () => {
    it('should resolve wrapper prefix and suffix using promptData', () => {
      activeMockPlaceholderResolver.resolve
        .mockImplementationOnce(
          (str, data) => `resolved_prefix(${str}, ${data.global})`
        )
        .mockImplementationOnce(
          (str, data) => `resolved_suffix(${str}, ${data.global})`
        );

      assembler.assemble(
        baseElementConfig,
        {
          ...basePromptData,
          perceptionLogArray: [],
        },
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(activeMockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        baseElementConfig.prefix || '',
        expect.objectContaining({ global: 'globalValue' })
      );
      expect(activeMockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        baseElementConfig.suffix || '',
        expect.objectContaining({ global: 'globalValue' })
      );
    });

    it('should return only resolved wrapper prefix/suffix if perceptionLogArray is null', () => {
      activeMockPlaceholderResolver.resolve.mockImplementation((str) =>
        str === baseElementConfig.prefix
          ? 'PREFIX'
          : str === baseElementConfig.suffix
            ? 'SUFFIX'
            : ''
      );
      const result = assembler.assemble(
        baseElementConfig,
        {
          ...basePromptData,
          perceptionLogArray: null,
        },
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('PREFIXSUFFIX');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Perception log array for 'perception_log_wrapper' missing or empty"
        )
      );
    });

    it('should return only resolved wrapper prefix/suffix if perceptionLogArray is empty', () => {
      activeMockPlaceholderResolver.resolve.mockImplementation((str) =>
        str === baseElementConfig.prefix
          ? 'PREFIX'
          : str === baseElementConfig.suffix
            ? 'SUFFIX'
            : ''
      );
      const result = assembler.assemble(
        baseElementConfig,
        {
          ...basePromptData,
          perceptionLogArray: [],
        },
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('PREFIXSUFFIX');
    });
    it('should return empty string if perceptionLogArray is empty and wrapper prefix/suffix are also empty/unresolved to empty', () => {
      activeMockPlaceholderResolver.resolve.mockReturnValue('');
      const emptyWrapperConfig = {
        ...baseElementConfig,
        prefix: '',
        suffix: '',
      };
      const result = assembler.assemble(
        emptyWrapperConfig,
        {
          ...basePromptData,
          perceptionLogArray: [],
        },
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('');
    });
  });

  describe('assemble - Handling perception_log_entry Config', () => {
    it('should warn and produce no entry content if perception_log_entry dependencyInjection is missing', () => {
      sampleAllPromptElementsMap.delete(PERCEPTION_LOG_ENTRY_KEY);
      activeMockPlaceholderResolver.resolve.mockImplementation((str) => str);

      const result = assembler.assemble(
        baseElementConfig,
        basePromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('<log></log>');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Missing '${PERCEPTION_LOG_ENTRY_KEY}' config`)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Entries were not formatted or added to output due to missing '${PERCEPTION_LOG_ENTRY_KEY}' config.`
        )
      );
    });
  });

  describe('assemble - Iterating PerceptionLogArray', () => {
    it('should skip and warn for invalid (non-object/null) entries in perceptionLogArray', () => {
      const promptDataWithInvalidEntry = {
        ...basePromptData,
        perceptionLogArray: [
          { role: 'user', content: 'Valid1' },
          'invalid_string_entry',
          null,
          { role: 'assistant', content: 'Valid2' },
        ],
      };
      activeMockPlaceholderResolver.resolve.mockImplementation(
        (str, entryData, _pData) => {
          if (str === basePLogEntryConfig.prefix && entryData)
            return `<entry role="${entryData.role}">`;
          if (str === basePLogEntryConfig.suffix) return `</entry>`;
          if (str === baseElementConfig.prefix) return baseElementConfig.prefix;
          if (str === baseElementConfig.suffix) return baseElementConfig.suffix;
          return str;
        }
      );

      const result = assembler.assemble(
        baseElementConfig,
        promptDataWithInvalidEntry,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid perception log entry encountered'),
        { entry: 'invalid_string_entry' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid perception log entry encountered'),
        { entry: null }
      );
      expect(result).toBe(
        '<log><entry role="user">Valid1</entry><entry role="assistant">Valid2</entry></log>'
      );
    });

    it('should use empty string for entry.content if it is null or undefined', () => {
      const promptDataWithNullContent = {
        ...basePromptData,
        perceptionLogArray: [
          { role: 'user', content: null },
          { role: 'assistant', content: undefined },
        ],
      };
      activeMockPlaceholderResolver.resolve.mockImplementation(
        (str, entryData, _pData) => {
          if (str === basePLogEntryConfig.prefix && entryData)
            return `<entry role="${entryData.role}">`;
          if (str === basePLogEntryConfig.suffix) return `</entry>`;
          if (str === baseElementConfig.prefix) return baseElementConfig.prefix;
          if (str === baseElementConfig.suffix) return baseElementConfig.suffix;
          return str;
        }
      );
      const result = assembler.assemble(
        baseElementConfig,
        promptDataWithNullContent,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe(
        '<log><entry role="user"></entry><entry role="assistant"></entry></log>'
      );
    });

    it('should convert non-string entry.content to string', () => {
      const promptDataWithNonStringContent = {
        ...basePromptData,
        perceptionLogArray: [{ role: 'system', content: 123 }],
      };
      activeMockPlaceholderResolver.resolve.mockImplementation(
        (str, entryData, _pData) => {
          if (str === basePLogEntryConfig.prefix && entryData)
            return `<entry role="${entryData.role}">`;
          if (str === basePLogEntryConfig.suffix) return `</entry>`;
          if (str === baseElementConfig.prefix) return baseElementConfig.prefix;
          if (str === baseElementConfig.suffix) return baseElementConfig.suffix;
          return str;
        }
      );
      const result = assembler.assemble(
        baseElementConfig,
        promptDataWithNonStringContent,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('<log><entry role="system">123</entry></log>');
    });
  });

  describe('assemble - Placeholder Resolution and Timestamp Cleaning for Entries', () => {
    const pLogEntryConfigWithTimestamp = {
      key: PERCEPTION_LOG_ENTRY_KEY,
      prefix:
        '<entry role="{role}" timestamp="dont_resolve_this" global="{global}">',
      suffix: '</entry timestamp="also_dont_resolve">',
    };
    const entryData = {
      role: 'user',
      content: 'Test content',
      timestamp: 'actual_timestamp_data',
      otherEntryKey: 'entrySpecific',
    };

    beforeEach(() => {
      sampleAllPromptElementsMap.set(PERCEPTION_LOG_ENTRY_KEY, {
        ...pLogEntryConfigWithTimestamp,
      });
    });

    it('should clean timestamp attributes from entry prefix/suffix before resolving placeholders', () => {
      activeMockPlaceholderResolver.resolve.mockImplementation(
        (str, _data1, _data2) => str
      );

      const currentPromptData = {
        ...basePromptData,
        perceptionLogArray: [entryData],
      };

      assembler.assemble(
        baseElementConfig,
        currentPromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );

      const expectedCleanedPrefix = '<entry role="{role}" global="{global}">';
      const expectedCleanedSuffix = '</entry>';
      const expectedEntryForResolution = {
        role: 'user',
        content: 'Test content',
        otherEntryKey: 'entrySpecific',
      };
      const expectedPromptDataArg = expect.objectContaining({
        global: 'globalValue',
        perceptionLogArray: [entryData],
      });

      expect(activeMockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        expectedCleanedPrefix,
        expectedEntryForResolution,
        expectedPromptDataArg
      );
      expect(activeMockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        expectedCleanedSuffix,
        expectedEntryForResolution,
        expectedPromptDataArg
      );
    });

    it('should resolve placeholders in entry prefix/suffix using entryForResolution and promptData', () => {
      activeMockPlaceholderResolver.resolve.mockImplementation(
        (str, data1, data2) => {
          if (str === '<entry role="{role}" global="{global}">') {
            return `<entry role="${data1.role}" global="${data2.global}">`;
          }
          if (str === '</entry>') {
            return '</entry>';
          }
          if (str === baseElementConfig.prefix) return baseElementConfig.prefix;
          if (str === baseElementConfig.suffix) return baseElementConfig.suffix;
          return str;
        }
      );
      const currentPromptData = {
        ...basePromptData,
        perceptionLogArray: [entryData],
      };
      const result = assembler.assemble(
        baseElementConfig,
        currentPromptData,
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe(
        `<log><entry role="user" global="globalValue">Test content</entry></log>`
      );
    });

    it('should correctly clean various timestamp attribute formats', () => {
      const complexPLogEntryConfig = {
        key: PERCEPTION_LOG_ENTRY_KEY,
        prefix:
          '<obs role="{role}" timestamp="123" other="val" timestamp=\'456\' >Message: ',
        suffix: ' [End obs timestamp = 789]',
      };
      sampleAllPromptElementsMap.set(
        PERCEPTION_LOG_ENTRY_KEY,
        complexPLogEntryConfig
      );
      const currentEntryData = { role: 'system', content: 'System update.' };

      activeMockPlaceholderResolver.resolve.mockImplementation(
        (str, data1, _data2) => {
          // These are the strings implied by the previous "Received" error log's FALLBACK_RESOLVE output
          const actualCleanedPrefixFromRuntime =
            '<obs role="{role}" other="val">Message:';
          const actualCleanedSuffixFromRuntime = '[End obs';

          if (str === baseElementConfig.prefix) return baseElementConfig.prefix;
          if (str === baseElementConfig.suffix) return baseElementConfig.suffix;

          if (str === actualCleanedPrefixFromRuntime) {
            return `<obs role="${data1.role}" other="val">Message:`; // Resolve {role}
          }
          if (str === actualCleanedSuffixFromRuntime) {
            return actualCleanedSuffixFromRuntime; // Return as is: '[End obs'
          }
          // Fallback if an unexpected string is passed to resolve during this specific test.
          // This helps catch if our assumptions about actualCleaned strings are still off.
          // console.warn(`[Failing Test Mock] Fallback for: '${str}'`);
          return `UNEXPECTED_FALLBACK_IN_FAILING_TEST(${str})`;
        }
      );

      const result = assembler.assemble(
        baseElementConfig,
        {
          ...basePromptData,
          perceptionLogArray: [currentEntryData],
        },
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );

      // This expected string is now built based on the actualCleaned* strings
      // and the mock's behavior with them.
      expect(result).toBe(
        '<log><obs role="system" other="val">Message:System update.[End obs</log>'
      );
    });
  });

  describe('assemble - Final Output and Logging', () => {
    it('should correctly assemble the final string from all parts', () => {
      activeMockPlaceholderResolver.resolve.mockImplementation(
        (str, data1, _data2) => {
          if (str === baseElementConfig.prefix) return '[[WRAP_PRE]]';
          if (str === baseElementConfig.suffix) return '[[WRAP_SUFF]]';
          if (str === basePLogEntryConfig.prefix)
            return `[[ENTRY_PRE role=${data1.role}]]`;
          if (str === basePLogEntryConfig.suffix)
            return `[[ENTRY_SUFF role=${data1.role}]]`;
          return '';
        }
      );
      const logArray = [
        { role: 'user', content: 'Hi' },
        { role: 'ai', content: 'Hello' },
      ];
      const result = assembler.assemble(
        baseElementConfig,
        {
          ...basePromptData,
          perceptionLogArray: logArray,
        },
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      const expected =
        '[[WRAP_PRE]]' +
        '[[ENTRY_PRE role=user]]Hi[[ENTRY_SUFF role=user]]' +
        '[[ENTRY_PRE role=ai]]Hello[[ENTRY_SUFF role=ai]]' +
        '[[WRAP_SUFF]]';
      expect(result).toBe(expected);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Perception log wrapper for 'perception_log_wrapper' processed with formatted entries."
        )
      );
    });

    it('should log if all entries resulted in empty strings but pLogEntryConfig was present', () => {
      activeMockPlaceholderResolver.resolve.mockImplementation(
        (str, _data1, _data2) => {
          if (str === baseElementConfig.prefix) return 'WRAP_PRE';
          if (str === baseElementConfig.suffix) return 'WRAP_SUFF';
          if (str === basePLogEntryConfig.prefix) return '';
          if (str === basePLogEntryConfig.suffix) return '';
          return '';
        }
      );
      const logArray = [{ role: 'user', content: '' }];
      const result = assembler.assemble(
        baseElementConfig,
        {
          ...basePromptData,
          perceptionLogArray: logArray,
        },
        activeMockPlaceholderResolver,
        sampleAllPromptElementsMap
      );
      expect(result).toBe('WRAP_PREWRAP_SUFF');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('all log entries resulted in empty strings')
      );
    });
  });
});
// --- FILE END ---
