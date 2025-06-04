# LLM Proxy Server

## 1. Overview

The LLM Proxy Server is a crucial backend component designed to enhance the security and manageability of interactions
between the client-side `ILLMAdapter` and various cloud-based Large Language Model (LLM) providers.

Its primary purposes are:

- **API Key Security**: To securely manage and inject API keys for cloud LLM services (e.g., OpenRouter, OpenAI,
  Anthropic). Client-side applications (like the `ILLMAdapter` running in a browser) should never handle these keys
  directly. The proxy acts as a trusted intermediary, preventing API key exposure to end-users.
- **Centralized Request Handling**: Provides a single endpoint for the client to send LLM requests, which the proxy then
  forwards to the appropriate LLM provider based on configuration.
- **Configuration Abstraction**: It uses its `llm-configs.json` file (now defaulting to a path outside its own
  directory,
  typically `../config/llm-configs.json` relative to the proxy server's location) to determine target LLM endpoints and
  specific headers, abstracting these details from the client if necessary.

This server is essential when the `ILLMAdapter` operates in a client-side environment, ensuring that sensitive
credentials are not compromised.

## 2. Setup Instructions

### 2.1. Prerequisites

- **Node.js**: Ensure you have Node.js installed. It is recommended to use the latest Long-Term Support (LTS) version. (
  The `server.js` uses ES module syntax like `import`, so a modern Node.js version is required, e.g., v14.x.x or newer).
- **npm**: Node Package Manager, which comes with Node.js.

### 2.2. Installation

1.  Navigate to the `llm-proxy-server/` directory in your terminal:

    cd path/to/your/project/llm-proxy-server

2.  Install the necessary dependencies:

        npm install

    This will install `express`, `dotenv`, `cors`, and any other packages listed in `package.json`.

## 3. Configuration

The proxy server is configured primarily through environment variables. A `.env.example` file is provided in the
`llm-proxy-server/` directory to guide you in setting up your local `.env` file.

### 3.1. Environment Variables

Create a `.env` file in the `llm-proxy-server/` directory by copying `.env.example`:

        cp .env.example .env

Then, edit the `.env` file with your specific configurations:

- **`PROXY_PORT`**: The port on which the proxy server will listen.

  - Example: `PROXY_PORT=3001`
  - Defaults to `3001` if not set in `server.js`.

- **`PROXY_ALLOWED_ORIGIN`**: Specifies the origins (e.g., where your main game application is served from) that are
  allowed to make requests to this proxy server (CORS configuration).

  - Example for a single origin: `PROXY_ALLOWED_ORIGIN=http://localhost:8080`
  - Example for multiple origins (comma-separated): `PROXY_ALLOWED_ORIGIN=http://localhost:8080,http://127.0.0.1:8080`
  - If not set, CORS will not be specifically configured, potentially blocking cross-origin requests.

- **`LLM_CONFIG_PATH`**: The path to the `llm-configs.json` file that the proxy server will use. This path can be
  absolute or relative.

  - **New Default**: If this environment variable is not set, the proxy server will now attempt to load the
    configuration from `../config/llm-configs.json` (relative to the `llm-proxy-server/server.js` file). This means it
    expects the `llm-configs.json` to be in a `config` directory located one level above the `llm-proxy-server`
    directory.
  - Example to override the default: `LLM_CONFIG_PATH=/path/to/your/custom/llm-configs.json`
  - Example to use a file named `proxy-specific-configs.json` inside the `llm-proxy-server` directory itself:
    `LLM_CONFIG_PATH=./proxy-specific-configs.json`

- **`PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES`**: The absolute path on the proxy server's filesystem where API key
  _files_ are stored. This is used if an LLM configuration in `llm-configs.json` specifies an `apiKeyFileName`.

  - Example: `PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES=/secure/path/to/api_keys`
  - If not set, API key retrieval from files will not be possible.

- **API Key Variables (e.g., `OPENROUTER_API_KEY_ENV_VAR_PLACEHOLDER`, `ANTHROPIC_API_KEY_ENV_VAR_PLACEHOLDER`)**: The
  proxy server needs access to the _actual_ API keys for the LLM providers it will forward requests to.

  - If an LLM configuration in the proxy's `llm-configs.json` specifies an `apiKeyEnvVar` (e.g., `"MY_PROVIDER_KEY"`),
    the proxy server will look for an environment variable named `MY_PROVIDER_KEY` in its own environment (i.e., in
    this `.env` file or system environment) to get the actual API key.
  - **Important**: The names in `.env.example` like `OPENROUTER_API_KEY_ENV_VAR_PLACEHOLDER` are placeholders for the
    _actual API key values_ you need to set in your `.env` file. The proxy will use the string value of `apiKeyEnvVar`
    from its `llm-configs.json` as the _name_ of the environment variable to look up.
  - Example entry in the proxy's `.env` file, assuming `llm-configs.json` (used by the proxy) has an entry with
    `apiKeyEnvVar: "OPENROUTER_KEY_FOR_PROXY"`:

          OPENROUTER_KEY_FOR_PROXY="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

  - And if `llm-configs.json` (used by the proxy) has an entry with `apiKeyEnvVar: "OPENAI_KEY_FOR_PROXY"`:

          OPENAI_KEY_FOR_PROXY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

### 3.2. `llm-configs.json` Usage by the Proxy

The proxy server loads its `llm-configs.json` file at startup. The path to this file is determined by the
`LLM_CONFIG_PATH` environment variable.
**By default, it now attempts to load this file from `../config/llm-configs.json` (relative
to `llm-proxy-server/server.js`), aiming to use a shared configuration file from the parent project's `config`
directory.**
This file informs the proxy about the LLM configurations it needs to handle. When the proxy receives a request from a
client with a specific `llmId`:

1. The proxy looks up the configuration for that `llmId` in its loaded `llmConfigs.llms` object.
2. It primarily uses the following fields from the matched LLM configuration:
   - `endpointUrl`: The actual target URL of the LLM provider to which the request will be forwarded.
   - `apiKeyEnvVar`: If present, this string is used as the _name_ of an environment variable that the proxy server
     will read from its own environment to obtain the actual API key for the LLM provider.
   - `apiKeyFileName`: If `apiKeyEnvVar` is not used or fails, and `apiKeyFileName` is present, this string is used as
     the _name_ of a file (e.g., `my_api_key.txt`). The proxy will attempt to read this file from the directory
     specified by the `PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES` environment variable to obtain the actual API key.
   - `providerSpecificHeaders`: An object containing any additional HTTP headers that should be sent to the target LLM
     provider (e.g., `{"HTTP-Referer": "...", "X-Title": "..."}`). The proxy will merge these with standard headers
     like `Content-Type` and the `Authorization` header it constructs.
   - `defaultParameters`: Can contain retry parameters such as `maxRetries`, `baseDelayMs`, and `maxDelayMs`. The proxy
     uses these values for its `Workspace_retry` logic when making calls to the downstream LLM provider.
   - `apiType`: Used by the proxy to determine if the LLM is a cloud service requiring an API key or a local service
     that might not need one handled by the proxy.

Ensure the `llm-configs.json` file used by the proxy (whether the shared default or a custom one via `LLM_CONFIG_PATH`)
accurately reflects the details necessary for the proxy to connect to and authenticate with the downstream LLM services.

## 4. Running the Proxy

The proxy server can be run using `npm` scripts defined in its `package.json` file located in the `llm-proxy-server/`
directory:

- **For production or general use**:

        npm start

  This script executes `node server.js`.

- **For development (with auto-restarting on file changes)**:

        npm run dev

  This script executes `node --watch server.js`, which will automatically restart the server when relevant project files
  are changed. This feature is built into recent versions of Node.js.

Upon successful startup, the console will display messages indicating the port the server is listening on, the resolved
absolute path to the `llm-configs.json` it's attempting to use, and the status of its CORS configuration.

## 5. API Endpoint

The proxy server exposes a single main API endpoint for client-side `ILLMAdapter` instances to send their LLM requests.

- **Endpoint**: `POST /api/llm-request`
- **Method**: `POST`
- **Content-Type**: `application/json`

### 5.1. Expected Request Body

The client (`ILLMAdapter`) must send a JSON payload to this endpoint. The structure of this payload is defined in the
`llm-proxy-server/LLM_PROXY_API_CONTRACT.md` document. The key fields in the request body are:

- `llmId` (string, required): The unique identifier for the LLM configuration that the client intends to use. This ID
  must correspond to an entry in the proxy's `llm-configs.json` file.
- `targetPayload` (object, required): The JSON payload that is intended for the actual LLM provider. This includes all
  LLM-specific parameters like `model`, `messages` (or `prompt`), `temperature`, `max_tokens`, `tools`,
  `response_format`, etc.
- `targetHeaders` (object, optional): An object containing any provider-specific HTTP headers (excluding `Authorization`
  and typically `Content-Type`) that the client has constructed for the target LLM provider.

For the complete and authoritative schema, please refer to the `llm-proxy-server/LLM_PROXY_API_CONTRACT.md` file.

### 5.2. Expected Responses

- **Success**: If the proxy successfully forwards the request to the specified LLM provider and receives a response, it
  will relay the LLM provider's entire response (including the HTTP status code and the response body, typically JSON)
  back to the client.
- **Error**:
  - If the proxy server encounters an issue before or during the forwarding process (e.g., the client's request to the
    proxy is invalid, the proxy fails to retrieve an API key, or there's a network error when the proxy tries to call
    the LLM provider), it will respond to the client with an HTTP error status code (such as 400, 500, or 502) and a
    JSON body detailing the proxy-specific error.
  - If the downstream LLM provider returns an error (e.g., a 4xx or 5xx HTTP status code), the proxy will typically
    relay that error status and body back to the client. In some cases, such as a 5xx error from the LLM provider, the
    proxy might respond with a 502 Bad Gateway status to the client.

For detailed error response schemas and `stage` explanations, refer to `llm-proxy-server/LLM_PROXY_API_CONTRACT.md`.

## 6. Project Structure (Brief Overview)

The `llm-proxy-server/` directory contains the following key files and directories:

- `server.js`: The main Express.js application file that sets up the server, defines routes, and includes middleware.
- `proxyLlmConfigLoader.js`: A module responsible for loading and parsing the `llm-configs.json` file specifically for
  the proxy's operational needs.
- `package.json`: Defines project metadata, lists dependencies, and contains the `npm` scripts for running and managing
  the server.
- `.env`: (This file is created by you, typically by copying `.env.example`) Stores environment-specific configurations
  such as the port number, allowed CORS origins, and actual API key values or paths to key files.
- `.env.example`: A template file providing a reference for the structure and variables needed in the `.env` file.
- `llm-configs.json`: **Note:** The proxy server now defaults to loading this configuration from
  `../config/llm-configs.json` (relative to `llm-proxy-server/server.js`). If the `LLM_CONFIG_PATH` environment variable
  is set, it will use that path instead. This file details LLM providers, endpoints, and API key retrieval methods.
- `LLM_PROXY_API_CONTRACT.md`: A document that defines the API contract for communication between the client-side
  `ILLMAdapter` and this proxy server, including request and error response schemas.
- `README.md`: This documentation file.
- `node_modules/`: This directory is created by `npm` to store the project's installed dependencies. It is typically not
  committed to version control.

## 7. Logging

The proxy server uses the native `console` object for logging its operations. Logged information includes:

- Server startup messages, including the port it's listening on, the resolved path to the LLM configuration file being
  used, and
  CORS status.
- Confirmation of successful LLM configuration loading, or critical error messages if loading fails.
- Details of incoming requests to the `/api/llm-request` endpoint, including a summary of the client's payload.
- Results of LLM configuration lookups based on the `llmId` provided by the client.
- Attempts to retrieve API keys, indicating the source (environment variable or file) and whether the retrieval was
  successful.
- Details of the request being prepared for forwarding to the downstream LLM provider, such as the target URL, headers (
  excluding sensitive parts like the Authorization token itself), and a sanitized preview of the payload.
- Initiation of calls to the LLM provider, including retry parameters if applicable.
- Information on responses received from the LLM provider that are being relayed to the client, including the HTTP
  status and a preview of the response body.
- Errors encountered during the process of forwarding requests or errors that are relayed from the LLM provider,
  including relevant status codes and error details.
- Information on unhandled errors that are caught by the global error handling middleware.

Review the console output of the running proxy server for detailed insights into its operational status and for
troubleshooting any issues.
