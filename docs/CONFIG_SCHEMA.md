# LLM Configuration Schema (`llm-configs.json`)

This file defines the structure for configuring various Large Language Models (LLMs) that the ILLMAdapter can interface
with.

## Root Structure

The `llm-configs.json` file is a JSON object with the following top-level properties:

- `defaultLlmId` (string, required): Specifies the `id` of the LLM configuration to be used by default if no other
  selection is actively made. This ID must correspond to one of the keys in the `llms` object. [cite: 158, 200]
- `llms` (object, required): An object that acts as a dictionary. Each key in this object is a unique LLM configuration
  ID (string), and the value is an LLM Configuration Object (defined below) detailing the settings for that specific
  LLM. [cite: 158]

**Example:**

```json
{
  "defaultLlmId": "openrouter-claude3-haiku",
  "llms": {
    "openrouter-claude3-haiku": {
      // ... LLM Configuration Object for Claude 3 Haiku via OpenRouter
    },
    "local-ollama-mistral": {
      // ... LLM Configuration Object for a local Mistral model via Ollama
    }
    // ... other LLM configurations
  }
}
```

LLM Configuration Object Structure
Each individual LLM configuration object, nested within the llms dictionary, must adhere to the following structure:

id (string, required): A unique identifier for this specific LLM configuration. This ID is used internally to select and
reference the configuration. It should match the key used in the llms dictionary.
Example: "openrouter-claude3-haiku", "local-ollama-mistral"
displayName (string, required): A user-friendly name for this configuration. This name can be used for display in logs,
debugging information, or potential future UI elements.
Example: "Claude 3 Haiku (OpenRouter)", "Local Mistral (Ollama)"
apiKeyFileName (string, optional): The filename (e.g., "openrouter_api_key.txt") located at the project root, which
contains the API key for this LLM service. This field should be omitted if the LLM does not require an API key (e.g.,
typically for local LLMs accessed via localhost).
Security Note: This file MUST NOT be committed to version control. Add its name to the .gitignore file. The file should
contain only the API key string.
Example: "openrouter_api_key.txt", "my_anthropic_key.secret"
endpointUrl (string, required): The base URL for the LLM's API endpoint.
Example (OpenRouter): "https://openrouter.ai/api/v1/chat/completions"
Example (Ollama local): "http://localhost:11434/api/chat"
modelIdentifier (string, required): The specific model name or identifier as recognized by the API provider or service.
Example (OpenRouter/Anthropic): "anthropic/claude-3-haiku-20240307"
Example (Ollama): "mistral"
Example (OpenAI): "gpt-4o"
apiType (string enum, required): An enumerated string indicating the family or specific type of the API. This helps the
ILLMAdapter select the correct internal logic for request formatting, response parsing, and feature utilization.
Supported values include:
"openrouter": For models accessed via OpenRouter.
"openai": For models accessed directly via OpenAI's API.
"anthropic": For models accessed directly via Anthropic's API.
"ollama": For local models served by Ollama.
"llama_cpp_server_openai_compatible": For local models served by a Llama.cpp server exposing an OpenAI-compatible API.
Example: "openrouter", "ollama"
Example LLM Configuration Object:
{
"id": "openrouter-claude3-haiku",
"displayName": "Claude 3 Haiku (OpenRouter via API Key File)",
"apiKeyFileName": "openrouter_api_key.txt",
"endpointUrl": "[https://openrouter.ai/api/v1/chat/completions](https://openrouter.ai/api/v1/chat/completions)",
"modelIdentifier": "anthropic/claude-3-haiku-20240307",
"apiType": "openrouter"
}

{
"id": "local-ollama-mistral-7b",
"displayName": "Local Mistral 7B (Ollama)",
// "apiKeyFileName" is omitted as local Ollama typically doesn't require it
"endpointUrl": "http://localhost:11434/api/chat", // Or /api/generate depending on usage
"modelIdentifier": "mistral:7b-instruct-q4_K_M", // Example specific model tag
"apiType": "ollama"
}