/**
 * @module src/prompting/promptAssembler.js
 */

import { StringAccumulator } from '../utils/stringAccumulator.js';

/**
 * @typedef {import('../interfaces/IPromptElementAssembler.js').IPromptElementAssembler} IPromptElementAssembler
 * @typedef {import('../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 */

/**
 * @typedef {object} PromptAssemblerElement
 * @property {string} key - Unique identifier for the element.
 * @property {IPromptElementAssembler} assembler - Assembler instance responsible for rendering this element.
 * @property {object} elementConfig - Configuration object passed to the assembler.
 * @property {object} promptData - Data object passed to the assembler.
 */

/**
 * @typedef {object} PromptAssemblerOptions
 * @property {PromptAssemblerElement[]} elements - Ordered array of elements to assemble into the prompt.
 * @property {PlaceholderResolver} placeholderResolver - Resolver for interpolating placeholders in element output.
 */

/**
 * @class PromptAssembler
 * @description
 * Internal utility for concatenating a pre-filtered, ordered list of renderable elements into a prompt string.
 * Catches and collects per-element errors, allowing assembly to continue.
 * @internal
 */
export class PromptAssembler {
  /**
   * @param {PromptAssemblerOptions} options
   */
  constructor({ elements, placeholderResolver }) {
    if (!Array.isArray(elements)) {
      throw new Error('PromptAssembler: `elements` must be a non-empty array.');
    }
    if (
      !placeholderResolver ||
      typeof placeholderResolver.resolve !== 'function'
    ) {
      throw new Error(
        'PromptAssembler: `placeholderResolver` is required and must implement `.resolve()`.'
      );
    }
    /** @private @type {PromptAssemblerElement[]} */
    this.elements = elements;
    /** @private @type {PlaceholderResolver} */
    this.placeholderResolver = placeholderResolver;
    /** @private @type {Map<string, PromptAssemblerElement>} */
    this.elementsMap = new Map(elements.map((el) => [el.key, el]));
  }

  /**
   * Iterates over the configured elements in order, invoking each assembler.
   * Uses StringAccumulator to efficiently build the prompt string.
   * Collects any per-element errors without interrupting assembly.
   *
   * @returns {{ prompt: string, errors: Array<{ key: string, error: Error }> }}
   */
  build() {
    const accumulator = new StringAccumulator();
    /** @type {Array<{ key: string, error: Error }>} */
    const errors = [];

    for (const { key, assembler, elementConfig, promptData } of this.elements) {
      try {
        const fragment = assembler.assemble(
          elementConfig,
          promptData,
          this.placeholderResolver,
          this.elementsMap
        );
        accumulator.append(fragment);
      } catch (error) {
        errors.push({ key, error });
      }
    }

    return {
      prompt: accumulator.toString(),
      errors,
    };
  }
}
