# LLM Configuration Schema (`llm-configs.json`)

This document provides comprehensive developer documentation for the `llm-configs.json` file, which is used to configure
various Large Language Models (LLMs) for the ILLMAdapter. All field definitions are based on "Table 3: Key Parameters
for External LLM Configuration File"[cite: 467, 468].

## Root Structure

The `llm-configs.json` file is a JSON object with the following top-level properties:

- `defaultLlmId` (string, optional [cite: 459]):

  - **Purpose**: Specifies the `id` of the LLM configuration to be used by default if no other selection is actively
    made. [cite: 459] This ID must correspond to one of the keys in the `llms` object.
  - **Data Type**: `string`
  - **Required**: No. If omitted, the application will require an LLM to be explicitly selected.
  - **Example**: `"openai-gpt-4o-toolcall"`

- `llms` (object, required [cite: 459]):
  - **Purpose**: An object that acts as a dictionary. Each key in this object is a unique LLM configuration `id` (
    string), and the value is an LLM Configuration Object (defined below) detailing the settings for that specific
    LLM. [cite: 459]
  - **Data Type**: `object`
  - **Required**: Yes.
  - **Example**:
    ```json
    {
      "defaultLlmId": "openai-gpt-4o-toolcall",
      "llms": {
        "openai-gpt-4o-toolcall": {
          /* ... LLM Configuration Object ... */
        },
        "openrouter-claude3-haiku-jsonschema": {
          /* ... LLM Configuration Object ... */
        }
      }
    }
    ```

## LLM Configuration Object Structure

Each individual LLM configuration object, nested within the `llms` dictionary, defines the parameters for a specific LLM
setup. The following fields are based on Table 3[cite: 468]:

- `id` (string, required):

  - **Purpose**: A unique identifier for this specific LLM configuration. [cite: 468] This ID is used internally to
    select and reference the configuration and must match the key used in the `llms` dictionary.
  - **Data Type**: `string`
  - **Required**: Yes.
  - **Example**: `"openai-gpt-4o-toolcall"`[cite: 468], `"openrouter-claude3-haiku-jsonschema"`

- `displayName` (string, required):

  - **Purpose**: A user-friendly name for this configuration, suitable for display in logs, debugging information, or
    potential future UI elements. [cite: 468]
  - **Data Type**: `string`
  - **Required**: Yes.
  - **Example**: `"OpenAI GPT-4o (Tool Call)"`[cite: 468], `"Anthropic Claude 3 Haiku (OpenRouter JSON Schema)"`

- `apiKeyEnvVar` (string, optional):

  - **Purpose**: Specifies the name of the environment variable that holds the API key for the LLM
    service. [cite: 468] This is primarily used for cloud-based services.
  - **Data Type**: `string`
  - **Required**: No. Omit or set to `null` if the LLM does not require an API key (e.g., for most locally hosted LLMs
    accessed via `localhost`).
  - **Security Note**: API keys themselves should never be hardcoded in this file. They should be securely stored in
    environment variables.
  - **Example**: `"OPENAI_API_KEY"`[cite: 468], `"OPENROUTER_API_KEY"`

- `endpointUrl` (string, required):

  - **Purpose**: The base URL for the LLM's API endpoint. [cite: 468]
  - **Data Type**: `string`
  - **Required**: Yes.
  - **Example (OpenAI)**: `"https://api.openai.com/v1/chat/completions"` [cite: 468]
  - **Example (OpenRouter)**: `"https://openrouter.ai/api/v1/chat/completions"`
  - **Example (Ollama local)**: `"http://localhost:11434/api/chat"`
  - **Example (Llama.cpp server local)**: `"http://localhost:8080/v1/chat/completions"`

- `modelIdentifier` (string, required):

  - **Purpose**: The specific model name or identifier as recognized by the API provider or service. [cite: 468]
  - **Data Type**: `string`
  - **Required**: Yes.
  - **Example (OpenAI)**: `"gpt-4o"` [cite: 468]
  - **Example (OpenRouter/Anthropic)**: `"anthropic/claude-3-haiku-20240307"`
  - **Example (Ollama)**: `"llama3:latest"`, `"mistral"`
  - **Example (Llama.cpp server)**: `"your-local-model.gguf"` (this is a placeholder; actual model name depends on the
    file served)

- `apiType` (string, required):

  - **Purpose**: An enumerated string indicating the API family or specific type of the API. [cite: 468] This allows
    the ILLMAdapter to select the correct internal logic for request formatting, response parsing, and feature
    utilization.
  - **Data Type**: `string`
  - **Required**: Yes.
  - **Valid Values**:
    - `"openai"`: For OpenAI models or compatible APIs (excluding Llama.cpp server which has its own type).
    - `"openrouter"`: For models accessed via OpenRouter.
    - `"ollama"`: For local models served by Ollama.
    - `"llama_cpp_server_openai_compatible"`: For local models served by a Llama.cpp server exposing an
      OpenAI-compatible API. [cite: 468]
    - `"tgi_openai_compatible"`: For local models served by Hugging Face TGI exposing an OpenAI-compatible
      API. [cite: 468]
    - Potentially others like `"anthropic"` if direct integration is added.
  - **Example**: `"openai"`[cite: 468], `"openrouter"`, `"ollama"`

- `promptFrame` (object | string, optional):

  - **Purpose**: Defines a model-specific system prompt, template, or instructions for constructing the final prompt
    sent to the LLM. [cite: 468] This helps in tailoring the interaction to the nuances of different models.
  - **Data Type**: `object` or `string`
  - **Required**: No.
  - **Example (object for system prompt)**:
    ```json
    "promptFrame": {
      "system": "You are an AI assistant for a text-based adventure game. Your primary goal is to decide the character's next action and what they would say."
    }
    ```
    (as in [cite: 468] but adapted for a common use case)
  - **Example (string for direct instruction)**:
    ```json
    "promptFrame": "You are an NPC in a fantasy game. Provide your action and speech as a JSON object with keys 'action' and 'speech'. Example: {\"action\": \"MOVE_EAST\", \"speech\": \"I shall investigate further!\"}. Ensure your output is ONLY the JSON object."
    ```

- `contextTokenLimit` (number, optional):

  - **Purpose**: Specifies the maximum number of tokens (input + output) that the model can handle in a single
    interaction. [cite: 468] Used for managing prompt length and avoiding errors.
  - **Data Type**: `number`
  - **Required**: No. However, it's highly recommended for effective context management.
  - **Example**: `128000` (for GPT-4o [cite: 468]), `8192` (for a local Llama3 via Ollama)

- `jsonOutputStrategy` (object, required):

  - **Purpose**: An object that defines the method the ILLMAdapter should use to elicit structured JSON output (
    specifically `{'action': 'string', 'speech': 'string'}`) from the LLM. [cite: 468]
  - **Data Type**: `object`
  - **Required**: Yes. This object must contain at least the `method` field.
  - **Fields**:

    - `method` (string, required):

      - **Purpose**: An enumerated string specifying the JSON generation strategy to employ. [cite: 468]
      - **Data Type**: `string`
      - **Required**: Yes.
      - **Valid Values**:
        - `"tool_calling"`: Utilizes the LLM's native tool/function calling feature. Requires
          `toolName`. [cite: 468]
        - `"native_json_mode"`: Uses the LLM's built-in JSON mode (e.g., OpenAI's
          `response_format: { type: "json_object" }`, Ollama's `format: "json"`). [cite: 468]
        - `"gbnf_grammar"`: Employs a GBNF (Grammar-Based Normative Formalism) grammar to constrain the LLM's
          output to a specific JSON structure. Requires `grammar`. [cite: 468]
        - `"openrouter_json_schema"`: Leverages OpenRouter's feature to enforce a JSON schema. [cite: 468]
        - `"prompt_engineering"`: Relies solely on prompt engineering to elicit JSON. This is generally the
          least reliable and should be used as a fallback. [cite: 527]
      - **Example**: `"tool_calling"`[cite: 468], `"native_json_mode"`

    - `toolName` (string, optional):

      - **Purpose**: The name of the tool (or function) to be invoked if `method` is `"tool_calling"`. [cite: 468]
        This tool should be defined to accept `action` and `speech` parameters.
      - **Data Type**: `string`
      - **Required**: Yes, if `method` is `"tool_calling"`.
      - **Example**: `"get_action_speech"` [cite: 468]

    - `grammar` (string, optional):
      - **Purpose**: The GBNF grammar content as a string, or a path to a `.gbnf` file, if `method` is
        `"gbnf_grammar"`. [cite: 468] The grammar must define the `{'action': 'string', 'speech': 'string'}`
        structure.
      - **Data Type**: `string`
      - **Required**: Yes, if `method` is `"gbnf_grammar"`.
      - **Example (inline string)**:
        `"root ::= \"{\\\"action\\\": \\\"\" ([^\\\"\\\\]|\\\\.)* \"\\\", \\\"speech\\\": \\\"\" ([^\\\"\\\\]|\\\\.)* \"\\\"}\""`
      - **Example (path)**: `"./grammars/action_speech.gbnf"` [cite: 468]

  - **Example `jsonOutputStrategy` objects**:
    - For Tool Calling:
      ```json
      "jsonOutputStrategy": {
        "method": "tool_calling",
        "toolName": "get_action_speech"
      }
      ```
    - For OpenRouter JSON Schema:
      ```json
      "jsonOutputStrategy": {
        "method": "openrouter_json_schema"
      }
      ```
    - For Ollama Native JSON:
      ```json
      "jsonOutputStrategy": {
        "method": "native_json_mode"
      }
      ```
    - For GBNF Grammar:
      ```json
      "jsonOutputStrategy": {
        "method": "gbnf_grammar",
        "grammar": "root ::= \"{\\\"action\\\": \\\"\" ([^\\\"\\\\]|\\\\.)* \"\\\", \\\"speech\\\": \\\"\" ([^\\\"\\\\]|\\\\.)* \"\\\"}\""
      }
      ```

- `defaultParameters` (object, optional):

  - **Purpose**: An object containing default parameters to be sent with each API request to the LLM, such as
    `temperature`, `max_tokens` (for output), `top_p`, etc. [cite: 468] These parameters are model-specific.
  - **Data Type**: `object`
  - **Required**: No. If omitted, the LLM provider's defaults will apply, or the adapter may set its own baseline
    defaults. The `LlmConfigLoader` initializes this to `{}` if not present.
  - **Example**:
    ```json
    "defaultParameters": {
      "temperature": 0.7,
      "max_tokens": 300,
      "top_p": 0.95
    }
    ```
    (Adapted from [cite: 468])

- `providerSpecificHeaders` (object, optional):
  - **Purpose**: An object containing additional HTTP headers that need to be sent with requests to this specific LLM
    provider. [cite: 468]
  - **Data Type**: `object`
  - **Required**: No. The `LlmConfigLoader` initializes this to `{}` if not present.
  - **Example (for OpenRouter)**:
    ```json
    "providerSpecificHeaders": {
      "HTTP-Referer": "[https://yourgame.com/my-awesome-adventure](https://yourgame.com/my-awesome-adventure)",
      "X-Title": "My Awesome Text Adventure"
    }
    ```
    (Adapted from [cite: 468] and user's JSON)

This schema provides the necessary flexibility to configure a wide range of LLMs and control their interaction behavior
through the ILLMAdapter.
