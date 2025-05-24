// src/llms/strategies/base/BaseCompletionLLMStrategy.js
// --- UPDATED FILE START ---

import {BaseLLMStrategy} from './baseLLMStrategy.js'; // Assuming PascalCase

/**
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @class BaseCompletionLLMStrategy
 * @extends BaseLLMStrategy
 * @description Base strategy for LLMs that use a completion-based API structure (single prompt string).
 */
export class BaseCompletionLLMStrategy extends BaseLLMStrategy {
    /**
     * Constructs a new BaseCompletionLLMStrategy.
     * @param {ILogger} logger - The logger instance.
     */
    constructor(logger) {
        super(logger);
    }

    /**
     * Constructs the prompt payload for completion-based LLM APIs.
     * This method uses the `promptFrame` from the LLM configuration to structure
     * the `gameSummary` into a single `prompt` string.
     *
     * @protected
     * @param {string} gameSummary - The detailed textual representation of the game state.
     * @param {object | string | undefined} promptFrame - The promptFrame object from the LLM configuration.
     * @param {LLMModelConfig} llmConfig - The full LLM configuration, including apiType.
     * @returns {{prompt: string}} An object containing a `prompt` string.
     */
    _constructPromptPayload(gameSummary, promptFrame, llmConfig) {
        this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload: Constructing prompt. apiType: '${llmConfig.apiType}'.`, {promptFrame});

        const trimmedGameSummary = gameSummary.trim();
        let finalPromptString = trimmedGameSummary; // Start with trimmed gameSummary

        const hasActualPromptFrameObject = promptFrame && typeof promptFrame === 'object' && Object.keys(promptFrame).length > 0;
        const isNonEmptyStringPromptFrame = typeof promptFrame === 'string' && promptFrame.trim() !== '';
        let meaningfulFrameContentProvided = false;

        if (isNonEmptyStringPromptFrame) {
            finalPromptString = `${promptFrame.trim()}\n\n${trimmedGameSummary}`;
            meaningfulFrameContentProvided = true;
        } else if (hasActualPromptFrameObject) {
            let systemPart = '';
            let prefixPart = '';
            let suffixPart = '';

            if (typeof promptFrame.system === 'string' && promptFrame.system.trim() !== '') {
                systemPart = `${promptFrame.system.trim()}\n\n`;
                this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload: Applying 'promptFrame.system' as a prefix for apiType '${llmConfig.apiType}'.`);
                meaningfulFrameContentProvided = true;
            }
            if (typeof promptFrame.user_prefix === 'string' && promptFrame.user_prefix.trim() !== '') {
                prefixPart = `${promptFrame.user_prefix.trim()} `;
                meaningfulFrameContentProvided = true;
            }
            if (typeof promptFrame.user_suffix === 'string' && promptFrame.user_suffix.trim() !== '') {
                suffixPart = ` ${promptFrame.user_suffix.trim()}`;
                meaningfulFrameContentProvided = true;
            }
            // Construct with parts, ensuring gameSummary is in the middle
            finalPromptString = `${systemPart}${prefixPart}${trimmedGameSummary}${suffixPart}`;
        }
        // If only gameSummary was present (or promptFrame was truly empty and did not set meaningfulFrameContentProvided)
        // finalPromptString is already just trimmedGameSummary.

        // Warning logic:
        // Warn if no meaningful content was derived from promptFrame AND
        // the apiType is one that might benefit (non-chat, non-common-local).
        if (!meaningfulFrameContentProvided) {
            const chatApiTypes = ['openai', 'openrouter', 'anthropic'];
            const localApiTypesForLogging = ['ollama', 'llama_cpp_server_openai_compatible', 'tgi_openai_compatible'];

            if (llmConfig.apiType && !chatApiTypes.includes(llmConfig.apiType) && !localApiTypesForLogging.includes(llmConfig.apiType)) {
                this.logger.warn(`BaseCompletionLLMStrategy._constructPromptPayload: promptFrame is missing or effectively empty for apiType '${llmConfig.apiType}' which might benefit from it. Applying default prompt string structure.`);
            }
        }

        // The final string is already composed of trimmed parts, and separators like \n\n are intentionally placed.
        // No final global trim should be applied here to preserve formatting like trailing newlines if gameSummary was empty.
        // However, if the entire string is meant to be trimmed (e.g. if promptFrame was null and gameSummary was "  "), then a final trim is ok.
        // The tests expect "Instruction.\n\n" if gameSummary is empty, so we should NOT trim if that's the only content.
        // The current construction already handles trimming of individual components.
        // A final trim would only affect leading/trailing whitespace of the *entire* assembled string.
        // Example: if finalPromptString = "  Actual Content  ", it becomes "Actual Content".
        // If finalPromptString = "Instruction.\n\n", it remains "Instruction.\n\n".
        // The issue arises if finalPromptString became, for example, "   " (all whitespace) and then trim made it "".
        // Or if it was "Content\n\n   " -> "Content\n\n".
        // The previous `const trimmedPrompt = finalPromptString.trim();` was the main culprit for removing desired newlines.
        // By building with `trimmedGameSummary` and `*.trim()` for frame parts, `finalPromptString` should be mostly clean.
        // A final trim is generally safe for leading/trailing spaces of the whole prompt but dangerous for newlines if they are the only thing trailing.
        // Given test `expect(result.prompt).toBe("Instruction.\n\n");`
        // if finalPromptString is "Instruction.\n\n", then finalPromptString.trim() is "Instruction." - this is the problem.
        // So, we should not do a final .trim() on the whole string if we want to preserve trailing newlines from a prefix.

        // Let's adjust construction slightly for clarity and correct handling of empty gameSummary:
        let constructedPrompt = "";
        if (isNonEmptyStringPromptFrame) {
            constructedPrompt = promptFrame.trim();
            if (trimmedGameSummary !== "" || constructedPrompt !== "") { // Add separator if there's content to separate or if frame itself has content
                constructedPrompt += "\n\n";
            }
            constructedPrompt += trimmedGameSummary;
            meaningfulFrameContentProvided = true;
        } else if (hasActualPromptFrameObject) {
            let systemPart = '';
            let prefixPart = '';
            let suffixPart = '';
            let tempMeaningful = false;

            if (typeof promptFrame.system === 'string' && promptFrame.system.trim() !== '') {
                systemPart = promptFrame.system.trim();
                if (trimmedGameSummary !== "" || systemPart !== "") {
                    systemPart += "\n\n";
                }
                tempMeaningful = true;
                this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload: Applying 'promptFrame.system' as a prefix for apiType '${llmConfig.apiType}'.`);
            }
            if (typeof promptFrame.user_prefix === 'string' && promptFrame.user_prefix.trim() !== '') {
                prefixPart = promptFrame.user_prefix.trim() + (trimmedGameSummary !== "" ? " " : ""); // Add space only if gameSummary follows
                tempMeaningful = true;
            }
            if (typeof promptFrame.user_suffix === 'string' && promptFrame.user_suffix.trim() !== '') {
                suffixPart = (trimmedGameSummary !== "" || prefixPart !== "" || systemPart !== "" ? " " : "") + promptFrame.user_suffix.trim();
                tempMeaningful = true;
            }
            constructedPrompt = `${systemPart}${prefixPart}${trimmedGameSummary}${suffixPart}`;
            if (tempMeaningful) meaningfulFrameContentProvided = true;
        } else {
            constructedPrompt = trimmedGameSummary;
        }

        // Re-evaluate warning based on meaningful content derived
        if (!meaningfulFrameContentProvided) {
            const chatApiTypes = ['openai', 'openrouter', 'anthropic'];
            const localApiTypesForLogging = ['ollama', 'llama_cpp_server_openai_compatible', 'tgi_openai_compatible'];
            if (llmConfig.apiType && !chatApiTypes.includes(llmConfig.apiType) && !localApiTypesForLogging.includes(llmConfig.apiType)) {
                this.logger.warn(`BaseCompletionLLMStrategy._constructPromptPayload: promptFrame is missing or effectively empty for apiType '${llmConfig.apiType}' which might benefit from it. Applying default prompt string structure.`);
            }
        }
        // The prompt is now built from trimmed components with intentional newlines.
        // A final overall trim is usually desired for completion prompts to remove any accidental leading/trailing spaces.
        // BUT it will remove the trailing "\n\n" if gameSummary is empty.
        // The tests expect "Instruction.\n\n" when gameSummary is empty.
        // So, conditional trim or build more carefully.

        // If promptFrame was used and gameSummary is empty, constructedPrompt might be "Instruction.\n\n".
        // If promptFrame was not used and gameSummary is empty, constructedPrompt is "".
        // A simple .trim() at the end will break the "Instruction.\n\n" case.

        // Let's revert to a simpler construction and handle trimming carefully.
        let builtPrompt = trimmedGameSummary;
        let framePrefix = "";
        let frameSuffix = ""; // Not really used in completion like this, prefix is main.
        meaningfulFrameContentProvided = false;

        if (isNonEmptyStringPromptFrame) {
            framePrefix = `${promptFrame.trim()}\n\n`;
            meaningfulFrameContentProvided = true;
        } else if (hasActualPromptFrameObject) {
            let tempPrefix = "";
            if (typeof promptFrame.system === 'string' && promptFrame.system.trim() !== '') {
                tempPrefix += `${promptFrame.system.trim()}\n\n`;
                meaningfulFrameContentProvided = true;
                this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload: Applying 'promptFrame.system' as a prefix for apiType '${llmConfig.apiType}'.`);
            }
            if (typeof promptFrame.user_prefix === 'string' && promptFrame.user_prefix.trim() !== '') {
                tempPrefix += `${promptFrame.user_prefix.trim()} `; // Space after prefix
                meaningfulFrameContentProvided = true;
            }
            framePrefix = tempPrefix;

            if (typeof promptFrame.user_suffix === 'string' && promptFrame.user_suffix.trim() !== '') {
                frameSuffix = ` ${promptFrame.user_suffix.trim()}`; // Space before suffix
                meaningfulFrameContentProvided = true;
            }
        }

        builtPrompt = `${framePrefix}${trimmedGameSummary}${frameSuffix}`;

        if (!meaningfulFrameContentProvided) {
            const chatApiTypes = ['openai', 'openrouter', 'anthropic'];
            const localApiTypesForLogging = ['ollama', 'llama_cpp_server_openai_compatible', 'tgi_openai_compatible'];
            if (llmConfig.apiType && !chatApiTypes.includes(llmConfig.apiType) && !localApiTypesForLogging.includes(llmConfig.apiType)) {
                this.logger.warn(`BaseCompletionLLMStrategy._constructPromptPayload: promptFrame is missing or effectively empty for apiType '${llmConfig.apiType}' which might benefit from it. Applying default prompt string structure.`);
            }
        }
        // If builtPrompt is "Instruction.\n\n  " (game summary was spaces), this will become "Instruction.\n\n"
        // If builtPrompt is "Instruction.\n\n", this will become "Instruction." -> Problem!
        // The only safe way to meet the test "Instruction.\n\n" is to not trim if gameSummary was empty.

        finalPromptString = builtPrompt;
        if (trimmedGameSummary === "" && framePrefix.endsWith("\n\n") && frameSuffix === "") {
            // Preserve the trailing newlines from the prefix if game summary is empty
            finalPromptString = framePrefix; // which is already like "Instruction.\n\n"
        } else {
            finalPromptString = builtPrompt.trim(); // Trim normally otherwise
        }


        this.logger.debug(`BaseCompletionLLMStrategy._constructPromptPayload: Constructed single 'prompt' string. Preview: ${finalPromptString.substring(0, 70) + (finalPromptString.length > 70 ? '...' : '')}`);
        return {prompt: finalPromptString};
    }
}

// --- UPDATED FILE END ---