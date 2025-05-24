// src/llms/constants/llmConstants.js
// --- FILE START ---

export const DEFAULT_FALLBACK_ACTION = {
    actionDefinitionId: "core:wait",
    commandString: "wait",
    speech: "I am having trouble thinking right now."
};
export const DEFAULT_FALLBACK_ACTION_JSON_STRING = JSON.stringify(DEFAULT_FALLBACK_ACTION);

export const DEFAULT_PROXY_SERVER_URL = 'http://localhost:3001/api/llm-request';

export const CLOUD_API_TYPES = ['openrouter', 'openai', 'anthropic'];

// MODIFICATION START (Ticket 2.2)
export const OPENAI_TOOL_NAME = "game_ai_action_speech";
export const ANTHROPIC_TOOL_NAME = "get_game_ai_action_speech";
export const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

export const GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA = {
    type: "object",
    properties: {
        action: {
            type: "string",
            description: "The specific game command or action to be performed by the character (e.g., 'MOVE_NORTH', 'PICKUP_ITEM lantern'). Must be a valid game command."
        },
        speech: {
            type: "string",
            description: "The line of dialogue the character should speak. Can be an empty string if no speech is appropriate."
        }
    },
    required: ["action", "speech"]
};
// MODIFICATION END (Ticket 2.2)

// MODIFICATION START (Ticket 2.3)
export const OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA = {
    name: "game_ai_action_speech_output", // A descriptive name for the schema
    strict: true, // Enforces strict adherence, disallowing additional properties
    schema: { // The JSON Schema object itself
        type: "object",
        properties: {
            action: {
                type: "string",
                description: "A concise game command string representing the character's action (e.g., 'USE_ITEM torch', 'LOOK_AROUND', 'SPEAK_TO goblin')." //
            },
            speech: {
                type: "string",
                description: "The exact line of dialogue the character should speak. Can be empty if no speech is appropriate." //
            }
        },
        required: ["action", "speech"] //
    }
};

// --- FILE END ---