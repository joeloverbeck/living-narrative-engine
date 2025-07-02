// src/services/promptElementAssemblers/perceptionLogAssembler.js

import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';
import { resolveWrapper } from '../../utils/wrapperUtils.js';
import { validateAssemblerParams } from './assemblerValidation.js';

export const PERCEPTION_LOG_ENTRY_KEY = 'perception_log_entry';
export const PERCEPTION_LOG_WRAPPER_KEY = 'perception_log_wrapper';

export class PerceptionLogAssembler extends IPromptElementAssembler {
  #logger;

  static #cleanTimestampAttributes(str) {
    if (!str) return '';
    const original = str;
    let cleaned = str.replace(
      /timestamp\s*=\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s>]+)/gi,
      ''
    );
    if (cleaned !== original) {
      cleaned = cleaned.replace(/\s\s+/g, ' ');
      cleaned = cleaned.replace(/\s+>/g, '>');
      cleaned = cleaned.trim();
    }
    return cleaned;
  }

  constructor({ logger = console } = {}) {
    super();
    this.#logger = logger;
  }

  /** @inheritdoc */
  assemble(
    elementConfig,
    promptData,
    placeholderResolver,
    allPromptElementsMap
  ) {
    const { valid } = validateAssemblerParams({
      elementConfig,
      promptData,
      placeholderResolver,
      allPromptElementsMap,
      logger: this.#logger,
      functionName: 'PerceptionLogAssembler.assemble',
      requireAllPromptElementsMap: true,
    });
    if (!valid) {
      return '';
    }

    // Resolve wrapper prefix/suffix
    const { prefix: wrapperPrefix, suffix: wrapperSuffix } = resolveWrapper(
      elementConfig,
      placeholderResolver,
      promptData
    );

    // Check for empty or missing log array
    const logEntries = promptData.perceptionLogArray;
    if (!Array.isArray(logEntries) || logEntries.length === 0) {
      this.#logger.debug(
        `Perception log array for '${elementConfig.key}' missing or empty`
      );
      return wrapperPrefix || wrapperSuffix
        ? `${wrapperPrefix}${wrapperSuffix}`
        : '';
    }

    // Handle missing entry config
    const entryConfig = allPromptElementsMap.get(PERCEPTION_LOG_ENTRY_KEY);
    if (!entryConfig) {
      this.#logger.warn(`Missing '${PERCEPTION_LOG_ENTRY_KEY}' config`);
      this.#logger.debug(
        `Entries were not formatted or added to output due to missing '${PERCEPTION_LOG_ENTRY_KEY}' config.`
      );
      return `${wrapperPrefix}${wrapperSuffix}`;
    }

    // Assemble each entry
    let assembledEntries = '';
    for (const entry of logEntries) {
      if (!entry || typeof entry !== 'object') {
        this.#logger.warn('Invalid perception log entry encountered', {
          entry,
        });
        continue;
      }

      // Normalize content
      let content = entry.content;
      if (content === null || content === undefined) {
        content = '';
      } else if (typeof content !== 'string') {
        content = String(content);
      }

      // Clean and resolve entry wrappers
      const rawPref = PerceptionLogAssembler.#cleanTimestampAttributes(
        entryConfig.prefix || ''
      );
      const rawSuf = PerceptionLogAssembler.#cleanTimestampAttributes(
        entryConfig.suffix || ''
      );

      const entryForResolution = { ...entry };
      delete entryForResolution.timestamp;

      const resolvedEntryPrefix = placeholderResolver.resolve(
        rawPref,
        entryForResolution,
        promptData
      );
      const resolvedEntrySuffix = placeholderResolver.resolve(
        rawSuf,
        entryForResolution,
        promptData
      );

      assembledEntries += `${resolvedEntryPrefix}${content}${resolvedEntrySuffix}`;
    }

    // Final debugging
    if (assembledEntries === '') {
      this.#logger.debug(`all log entries resulted in empty strings`);
    } else {
      this.#logger.debug(
        `Perception log wrapper for '${elementConfig.key}' processed with formatted entries.`
      );
    }

    return `${wrapperPrefix}${assembledEntries}${wrapperSuffix}`;
  }
}

export default PerceptionLogAssembler;
