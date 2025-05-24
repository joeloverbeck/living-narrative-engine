// src/llms/constants/llmConstants.js
// --- FILE START ---

export const DEFAULT_FALLBACK_ACTION = {
    actionDefinitionId: "core:wait",
    commandString: "wait",
    speech: "I am having trouble thinking right now."
};
export const DEFAULT_FALLBACK_ACTION_JSON_STRING = JSON.stringify(DEFAULT_FALLBACK_ACTION);

export const CLOUD_API_TYPES = ['openrouter', 'openai', 'anthropic'];

// MODIFICATION START (Ticket 2.2)
export const OPENAI_TOOL_NAME = "game_ai_action_speech";
export const ANTHROPIC_TOOL_NAME = "get_game_ai_action_speech";
export const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

export const GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA = {
    type: "object",
    properties: {
        actionDefinitionId: {
            type: "string",
            description: "The unique System ID of the action chosen by the character (e.g., 'core:go', 'app:take_item'). This corresponds to the 'System ID' from the list of available actions."
        },
        commandString: {
            type: "string",
            description: "The fully specified game command string that the game engine will parse (e.g., 'go north', 'take the rusty key from the old chest', 'wait'). This is based on the 'Base Command' and augmented with necessary details."
        },
        speech: {
            type: "string",
            description: "The exact line of dialogue the character should speak. Can be an empty string if no speech is appropriate."
        }
    },
    required: ["actionDefinitionId", "commandString", "speech"]
};
// MODIFICATION END (Ticket 2.2)

// MODIFICATION START (Ticket 2.3)
export const OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA = {
    name: "game_ai_action_speech_output", // A descriptive name for the schema
    strict: true, // Enforces strict adherence, disallowing additional properties
    schema: { // The JSON Schema object itself
        type: "object",
        properties: {
            actionDefinitionId: {
                type: "string",
                description: "The unique System ID of the action chosen by the character (e.g., 'core:go', 'app:take_item'). This corresponds to the 'System ID' from the list of available actions."
            },
            commandString: {
                type: "string",
                description: "The fully specified game command string that the game engine will parse (e.g., 'go north', 'take the rusty key from the old chest', 'wait'). This is based on the 'Base Command' and augmented with necessary details."
            },
            speech: {
                type: "string",
                description: "The exact line of dialogue the character should speak. Can be an empty string if no speech is appropriate."
            }
        },
        required: ["actionDefinitionId", "commandString", "speech"]
    }
};

// --- FILE END ---