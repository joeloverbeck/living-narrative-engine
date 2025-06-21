/* eslint-env es2022 */
/**
 * @module LLMChooser
 * @description
 *  Wraps prompt generation, LLM invocation and response parsing.
 *  Implements the contract sketched in Ticket 6.
 */

/** @typedef {import('../../prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline */
/** @typedef {import('../interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */

/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
import { ILLMChooser } from '../ports/iLLMChooser.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

export class LLMChooser extends ILLMChooser {
  /** @type {IAIPromptPipeline}   */ #promptPipeline;
  /** @type {ILLMAdapter}         */ #llmAdapter;
  /** @type {ILLMResponseProcessor}*/ #responseProcessor;
  /** @type {ILogger}             */ #logger;

  /**
   * @param {{
   *   promptPipeline: IAIPromptPipeline,
   *   llmAdapter: ILLMAdapter,
   *   responseProcessor: ILLMResponseProcessor,
   *   logger: ILogger
   * }} deps
   */
  constructor({ promptPipeline, llmAdapter, responseProcessor, logger }) {
    super();

    if (!promptPipeline?.generatePrompt)
      throw new Error('LLMChooser: promptPipeline invalid');
    if (!llmAdapter?.getAIDecision)
      throw new Error('LLMChooser: llmAdapter invalid');
    if (!responseProcessor?.processResponse)
      throw new Error('LLMChooser: responseProcessor invalid');
    if (!logger?.debug) throw new Error('LLMChooser: logger invalid');

    this.#promptPipeline = promptPipeline;
    this.#llmAdapter = llmAdapter;
    this.#responseProcessor = responseProcessor;
    this.#logger = logger;
  }

  /**
   * Generate a prompt, call the LLM and parse its answer.
   *
   * @param {{
   *   actor:    import('../../entities/entity.js').default,
   *   context:  import('../interfaces/ITurnContext.js').ITurnContext,
   *   actions:  Array,               // The definitive, indexed list of actions
   *   abortSignal?: AbortSignal
   * }} options
   * @returns {Promise<{ index: number|null, speech: string|null }>}
   */
  async choose({ actor, context, actions, abortSignal }) {
    this.#logger.debug(`LLMChooser.choose → actor=${actor.id}`);

    const prompt = await this.#promptPipeline.generatePrompt(
      actor,
      context,
      actions
    );
    if (!prompt) throw new Error('Prompt pipeline produced empty prompt');

    const raw = await this.#llmAdapter.getAIDecision(prompt, abortSignal);
    const parsed = await this.#responseProcessor.processResponse(raw, actor.id);

    const { action, extractedData } = parsed; // after processResponse()
    return {
      index: action.chosenIndex,
      speech: action.speech,
      thoughts: extractedData?.thoughts ?? null,
      notes: extractedData?.notes ?? null,
    };
  }
}
