# LLM Proxy Server API Contract

This document defines the API contract for communication between the client-side `ILLMAdapter` and the backend LLM Proxy
Server. The proxy server's primary role is to securely manage API keys for cloud-based LLM services, abstracting this
concern from the client.

## 1. Client-to-Proxy Communication

The client-side `ILLMAdapter` sends requests to the proxy server, which then forwards them to the appropriate LLM
provider after securely attaching the necessary API key.

### 1.1. Request Format

* **Endpoint**: `/api/llm-request` (or a similarly configured central endpoint)
  * **Method**: `POST`
  * **Content-Type**: `application/json`

### 1.2. Request Body Schema

The JSON body of the POST request from the client to the proxy must adhere to the following schema:

    {
      "type": "object",
      "properties": {
        "llmId": {
          "type": "string",
          "description": "The unique identifier for the target LLM configuration (e.g., 'openrouter-claude3-haiku-json-schema'). This ID is known from the `llm-configs.json` file. The proxy server uses this ID to determine the target LLM provider's actual endpoint, retrieve the correct API key securely from its environment, and potentially apply any proxy-side logging or rate-limiting logic."
        },
        "targetPayload": {
          "type": "object",
          "description": "The fully constructed JSON payload that the client-side ILLMAdapter intends for the *actual* LLM provider. This includes all LLM-specific parameters like 'model', 'messages' (or 'prompt'), 'temperature', 'max_tokens', 'tools', 'response_format', etc.. The proxy server will generally forward this payload as is to the target LLM, after adding authentication.",
          "additionalProperties": true
        },
        "targetHeaders": {
          "type": "object",
          "description": "An optional object containing any provider-specific HTTP headers (excluding 'Authorization' and typically 'Content-Type') that the client-side ILLMAdapter has constructed for the actual LLM provider (e.g., {'anthropic-version': '2023-06-01', 'X-Title': 'My Game App'}). The proxy will merge these with its own required headers (like 'Authorization' and 'Content-Type') before forwarding the request.",
          "additionalProperties": true
        }
      },
      "required": [
        "llmId",
        "targetPayload"
      ]
    }

#### Example Client-to-Proxy Request Body:

    {
      "llmId": "openrouter-claude3-haiku-json-schema",
      "targetPayload": {
        "model": "anthropic/claude-3-haiku-20240307",
        "messages": [
          {
            "role": "user",
            "content": "Generate a description for a fantasy character."
          }
        ],
        "temperature": 0.7,
        "max_tokens": 150,
        "response_format": {
          "type": "json_schema",
          "json_schema": {
            "name": "character_description",
            "strict": true,
            "schema": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "description": { "type": "string" }
              },
              "required": ["name", "description"]
            }
          }
        }
      },
      "targetHeaders": {
        "HTTP-Referer": "https://yourgame.com",
        "X-Title": "My Awesome Text Adventure"
      }
    }

## 2. Proxy-to-Client Error Responses

When the proxy server encounters an error *that it can identify and handle before or during the forwarding process to
the LLM provider*, or if the proxy itself has an internal issue, it will respond to the client with an error message in
the following JSON schema.

This schema is for errors originating *within the proxy*, not necessarily for all errors received *from* the downstream
LLM API (though the proxy might choose to wrap those in this format if it makes sense for client-side handling).

### 2.1. Error Response Body Schema

    {
      "type": "object",
      "properties": {
        "error": {
          "type": "boolean",
          "description": "Always `true` to indicate an error response."
        },
        "message": {
          "type": "string",
          "description": "A human-readable error message describing the issue encountered by the proxy."
        },
        "stage": {
          "type": "string",
          "description": "An optional identifier indicating where the error occurred within the proxy. This helps in diagnosing issues.",
          "enum": [
            "request_validation",
            "llm_config_lookup_error",
            "api_key_retrieval_error",
            "llm_endpoint_resolution_error",
            "llm_forwarding_error_network",
            "llm_forwarding_error_http_client",
            "llm_forwarding_error_http_server",
            "internal_proxy_error"
          ]
        },
        "details": {
          "type": "object",
          "description": "An optional object containing any additional structured details about the error. The content of this object may vary depending on the 'stage'.",
          "additionalProperties": true
        },
        "originalStatusCode": {
            "type": "integer",
            "description": "The HTTP status code that the proxy is returning to the client for this error (e.g., 400, 401, 500)."
        }
      },
      "required": [
        "error",
        "message",
        "originalStatusCode"
      ]
    }

#### `stage` Enum Values Explained:

* `request_validation`: The client's request to the proxy was malformed or missing required fields (e.g., `llmId` or
  `targetPayload` missing).
  * `llm_config_lookup_error`: The proxy could not find its internal configuration associated with the provided `llmId` (
    e.g., to determine the API key name or target LLM URL).
  * `api_key_retrieval_error`: The proxy failed to retrieve the necessary API key from its environment variables or secure
    storage, based on the configuration linked to `llmId`.
  * `llm_endpoint_resolution_error`: The proxy could not determine the actual target LLM API endpoint URL based on the
    `llmId`.
  * `llm_forwarding_error_network`: The proxy encountered a network issue when attempting to connect to the downstream LLM
    provider (e.g., DNS lookup failure, connection timeout).
  * `llm_forwarding_error_http_client`: The downstream LLM provider responded with a 4xx HTTP error code (e.g., 400 Bad
    Request from LLM, 401 Unauthorized from LLM if key was rejected, 429 Rate Limit).
  * `llm_forwarding_error_http_server`: The downstream LLM provider responded with a 5xx HTTP error code (e.g., 500
    Internal Server Error from LLM).
  * `internal_proxy_error`: An unexpected server-side error occurred within the proxy itself.

### 2.2. Example Proxy Error Responses

#### Example 1: Request Validation Error

*HTTP Status Code from Proxy to Client: 400 Bad Request*

    {
      "error": true,
      "message": "Client request validation failed.",
      "stage": "request_validation",
      "details": {
        "missingFields": ["targetPayload"],
        "invalidFields": [
          {
            "field": "llmId",
            "value": 123,
            "reason": "Must be a string."
          }
        ]
      },
      "originalStatusCode": 400
    }

#### Example 2: API Key Retrieval Error

*HTTP Status Code from Proxy to Client: 500 Internal Server Error* (or 401/403 if more appropriate for the specific
scenario of the proxy not being able to fulfill due to its own auth setup issues for the target)

    {
      "error": true,
      "message": "Failed to retrieve API key for the specified LLM provider.",
      "stage": "api_key_retrieval_error",
      "details": {
        "llmId": "some-cloud-llm",
        "reason": "The environment variable 'EXPECTED_API_KEY_ENV_VAR' is not set on the proxy server."
      },
      "originalStatusCode": 500
    }

#### Example 3: LLM Forwarding Network Error

*HTTP Status Code from Proxy to Client: 502 Bad Gateway*

    {
      "error": true,
      "message": "Network error occurred while attempting to forward request to the LLM provider.",
      "stage": "llm_forwarding_error_network",
      "details": {
        "llmId": "another-cloud-llm",
        "targetUrl": "https://api.llmprovider.com/v1/chat/completions",
        "errorFromFetch": "ECONNREFUSED"
      },
      "originalStatusCode": 502
    }

#### Example 4: Downstream LLM API returns an error (e.g. 400 Bad Request from LLM)

*HTTP Status Code from Proxy to Client: Might be the same as what the LLM returned (e.g., 400), or the proxy might
choose a more generic 502/503 if it considers the downstream provider unavailable.*
*This example assumes the proxy relays the HTTP status code of the LLM's error response.*

    {
      "error": true,
      "message": "The LLM provider returned an error: Invalid 'model' parameter.",
      "stage": "llm_forwarding_error_http_client",
      "details": {
        "llmId": "openai-gpt-4o",
        "llmApiStatusCode": 400,
        "llmApiResponseBody": {
          "error": {
            "message": "Invalid 'model' parameter. Please check the model name.",
            "type": "invalid_request_error",
            "param": "model",
            "code": null
          }
        }
      },
      "originalStatusCode": 400
    }

## 3. Contract Stability

Changes to this API contract, especially to required fields or fundamental structures, should be considered breaking
changes and managed accordingly with versioning or clear communication to client-side developers.

## 4. Security Considerations

* The proxy server **MUST NOT** log the actual `targetPayload` or sensitive parts of `targetHeaders` if they contain
  user-specific or confidential information from the game prompt, unless absolutely necessary for debugging and with
  appropriate data protection measures in place.
  * The `llmId` should be treated as an identifier and not directly expose sensitive details about the backend
    configuration if it were to be inadvertently logged on the client side.
  * The proxy must securely retrieve API keys and never expose them to the client or in its own logs.
