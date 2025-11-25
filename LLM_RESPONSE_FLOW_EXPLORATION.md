# LLM Response Processing Flow - Complete Exploration

## Overview
This document maps the complete flow of LLM responses in the Living Narrative Engine, from prompt generation through response validation and parsing.

---

## 1. Response Flow Architecture

### High-Level Flow Diagram
```
Turn Handler
    ↓
LLMChooser.choose()
    ↓
[1] AIPromptPipeline.generatePrompt()  ← Prompt generation
    ↓
[2] ConfigurableLLMAdapter.getAIDecision()  ← Raw LLM request
    ↓
[3] LLMRequestExecutor.executeRequest()  ← Request execution
    ↓
[4] Strategy.execute()  ← Strategy-specific execution
    ↓
[5] HTTP Client Request  ← Network call
    ↓
[6] Strategy._extractJsonOutput()  ← JSON extraction from response
    ↓
[7] Raw JSON string returned to LLMChooser
    ↓
[8] LLMResponseProcessor.processResponse()  ← **RESPONSE PROCESSING STARTS**
    ├─ #parseResponse() - JSON parsing/repair
    ├─ #validateSchema() - Schema validation
    └─ #extractData() - Data extraction
    ↓
Validated action data returned to Turn Handler
```

---

## 2. Key Components

### A. Response Request Phase

**File:** `src/turns/adapters/configurableLLMAdapter.js`
- **Method:** `getAIDecision(gameSummary, abortSignal, requestOptions)`
- **Responsibility:** Orchestrates LLM request
- **Key Steps:**
  1. Validates configuration (line 329-340)
  2. Validates token limits (line 343)
  3. Gets API key (line 346)
  4. Creates strategy (line 349)
  5. Delegates to requestExecutor (line 356-364)
  6. Maps errors using errorMapper (line 374-376)

**Returns:** Raw JSON string from LLM

**Error Handling:** 
- ConfigurationError for missing/invalid config
- PromptTooLongError for token violations
- Mapped errors via LLMErrorMapper

---

### B. Request Execution Phase

**File:** `src/llms/services/llmRequestExecutor.js`
- **Method:** `executeRequest(options)`
- **Responsibility:** Executes the actual request via strategy
- **Key Steps:**
  1. Validates request options (line 43-278)
  2. Handles abort signals (line 64-68)
  3. Calls strategy.execute() (line 71-78)
  4. Error logging (line 85-91)

**Features:**
- Abort signal handling
- Retry logic with exponential backoff (executeWithRetry method)
- Error classification (isRetryableError method)

**Returns:** Raw JSON string from strategy

---

### C. Strategy Execution Phase

**File:** `src/llms/strategies/base/baseOpenRouterStrategy.js`
- **Method:** `execute(params)`
- **Responsibility:** Strategy-specific execution
- **Key Steps:**
  1. Validates execute params (line 574-577)
  2. Builds provider payload (line 579-584)
  3. Prepares HTTP request (line 586-592)
  4. Handles response (line 594-602)

**Sub-Components:**
- `_constructPromptPayload()` - Creates messages array
- `_buildProviderRequestPayloadAdditions()` - Strategy-specific additions
- `#sendRequest()` - Makes actual HTTP call (line 404)
- `#extractJson()` - Extracts JSON from response (line 524-528)
- `#handleResponse()` - Orchestrates response handling (line 505-554)

**Returns:** JSON string extracted from response

**Error Handling:**
- ConfigurationError for invalid params
- LLMStrategyError for unexpected errors
- HttpClientError passed through

---

### D. JSON Extraction Phase

**File:** `src/llms/strategies/openRouterToolCallingStrategy.js` (example)
- **Method:** `_extractJsonOutput(responseData, llmConfig, providerRequestPayload)`
- **Responsibility:** Extracts JSON from provider-specific response format
- **Implementation:** Tool-calling specific extraction logic

**For OpenRouter Tool Calling:**
- Extracts from tool_calls array
- Validates tool call structure
- Gets function.arguments (JSON string)

**Returns:** JSON string ready for parsing

---

### E. Response Processing Phase (PRIMARY FOCUS)

**File:** `src/turns/services/LLMResponseProcessor.js`
- **Interface:** `ILLMResponseProcessor`
- **Main Method:** `processResponse(llmJsonResponse, actorId)`

#### 2.E.1 Step 1: JSON Parsing

**Method:** `#parseResponse(llmJsonResponse, actorId)` (line 99-125)

**Process:**
1. Type validation - ensures response is string (line 100-104)
2. Calls `llmJsonService.parseAndRepair()` (line 107-109)

**Error Handling:**
- Throws LLMProcessingError if not string
- Catches parse errors from JSON repair
- Dispatches error event via safeEventDispatcher (line 112-122)

**Flow into JSON Repair:**
```
llmJsonResponse (raw string)
    ↓
LlmJsonService.parseAndRepair()
    ├─ cleanLLMJsonOutput() - Remove markdown/prefixes
    ├─ initialParse() - Try JSON.parse first
    └─ repairAndParse() if parse fails
        ├─ repairJson() from @toolsycc/json-repair
        └─ JSON.parse() again
    ↓
Parsed object or JsonProcessingError
```

**Cleaning (src/utils/jsonCleaning.js):**
- Removes markdown code blocks (```json)
- Strips conversational prefixes ("Sure, here's...")
- Handles JSON wrapped in extra text

**Repair (src/utils/jsonRepair.js):**
- Uses @toolsycc/json-repair library
- Fixes common JSON issues:
  - Unquoted keys
  - Single quotes → double quotes
  - Missing commas
  - Trailing commas
  - Unclosed strings/objects

**Error Events Dispatched:**
- Parse failure → safeDispatchError with rawResponse
- Repair failure → safeDispatchError with error details

#### 2.E.2 Step 2: Schema Validation

**Method:** `#validateSchema(parsed, actorId)` (line 134-156)

**Schema Reference:** `LLM_TURN_ACTION_RESPONSE_SCHEMA_ID` from llmOutputSchemas.js

**Schema Requirements (v4):**
```javascript
{
  type: 'object',
  additionalProperties: false,
  required: ['chosenIndex', 'speech', 'thoughts'],
  properties: {
    chosenIndex: { type: 'integer', minimum: 1 },
    speech: { type: 'string' },
    thoughts: { type: 'string' },
    notes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text', 'subject', 'subjectType'],
        properties: {
          text: { type: 'string', minLength: 1 },
          subject: { type: 'string', minLength: 1 },
          subjectType: { type: 'string', enum: [multiple values] },
          context: { type: 'string' } // optional
        },
        additionalProperties: false
      }
    }
  }
}
```

**Validation Process:**
1. Uses ISchemaValidator to validate against schema (line 135-138)
2. Checks isValid flag (line 139)
3. If invalid:
   - Dispatches error event with validation errors (line 142-150)
   - Throws LLMProcessingError with error details (line 151-154)

**Validator:** AJV (Another JSON Schema Validator)
- Centrally configured in ajvSchemaValidator.js
- Strict validation with no defaults/coercion

#### 2.E.3 Step 3: Data Extraction

**Method:** `#extractData(parsed, actorId)` (line 164-176)

**Process:**
1. Destructures validated JSON (line 165):
   - chosenIndex
   - speech
   - thoughts
   - notes (optional)

2. Logs debug info (line 166-168)

3. Returns structured result:
```javascript
{
  action: {
    chosenIndex: number,
    speech: string
  },
  extractedData: {
    thoughts: string,
    notes?: Array<{text, subject, context?, timestamp?}>
  }
}
```

**Special Handling:**
- Notes included conditionally (line 173)
- Thoughts always extracted
- Chosenindex used as action selector

---

## 3. Error Handling & Failure Points

### Error Classification

**By Stage:**

| Stage | Error Type | Handling |
|-------|-----------|----------|
| Type Check | LLMProcessingError | safeDispatchError + throw |
| JSON Parsing | JsonProcessingError | safeDispatchError + repair attempt |
| JSON Repair | JsonProcessingError | safeDispatchError + throw |
| Schema Validation | LLMProcessingError | safeDispatchError + throw |
| Data Extraction | N/A | No errors possible |

**By Severity:**

| Severity | Error | Response |
|----------|-------|----------|
| Critical | Type error (not string) | Throw + dispatch |
| High | Parse failure after repair | Throw + dispatch |
| High | Schema validation failure | Throw + dispatch |
| Warning | Initial parse fails (repair succeeds) | Log warn + continue |
| Info | Successful repair | Log debug |

### Error Event Dispatching

**Pattern:** `safeDispatchError(dispatcher, errorMsg, details, logger)`

**Called In:**
1. Type validation failure (line 112-122)
2. Parse/repair failure (line 112-122)
3. Schema validation failure (line 142-150)

**Event Structure:**
```javascript
{
  type: 'SYSTEM_ERROR_OCCURRED',
  payload: {
    error: error.message,
    context: {
      actorId: string,
      rawResponse?: string,
      error?: string,
      stack?: string,
      errors?: Array,
      parsed?: object
    }
  }
}
```

**Guarantees:**
- Never throws from event dispatch (wrapped in try/catch)
- Graceful degradation if dispatcher unavailable
- Logged to logger as fallback

---

## 4. Where Metrics Could Be Inserted

### 4.1 Natural Integration Points

**A. After JSON Parsing (High Signal)**
```
Location: LLMResponseProcessor.#parseResponse() - line 107-109
Metrics:
- Time to parse/repair
- Success/failure of initial parse
- Success/failure of repair attempt
- Raw response length
- Cleaned response length
- Repair strategies applied
```

**B. After Schema Validation (Medium Signal)**
```
Location: LLMResponseProcessor.#validateSchema() - line 135-138
Metrics:
- Schema validation success/failure
- Validation error types
- Validated schema version
- Actor-specific validation patterns
```

**C. After Data Extraction (Low Signal)**
```
Location: LLMResponseProcessor.#extractData() - line 164-176
Metrics:
- Data completeness (all fields present)
- Notes array size
- Speech/thoughts length
- Chosen action validity
```

**D. Request Execution Level**
```
Location: LLMRequestExecutor.executeRequest() - line 42-97
Metrics:
- Total request time
- Retry attempts
- Retry success rate
- Abort signal usage
- Strategy execution time
```

**E. Strategy Execution Level**
```
Location: BaseOpenRouterStrategy.execute() - line 564-603
Metrics:
- Strategy execution time
- HTTP call duration
- JSON extraction duration
- Payload sizes
- Provider-specific metrics
```

**F. Configuration/Adapter Level**
```
Location: ConfigurableLLMAdapter.getAIDecision() - line 287-378
Metrics:
- Token estimation accuracy
- Token limit violations
- API key resolution time
- LLM selection (which config chosen)
- Total adapter time
```

### 4.2 Hierarchical Metrics Structure

```
LLM Decision Process (total time)
├─ Prompt Generation
│  ├─ Game state building
│  └─ Prompt assembly
├─ LLM Request
│  ├─ Configuration validation
│  ├─ Token validation
│  ├─ API key resolution
│  └─ HTTP request execution
└─ Response Processing
   ├─ JSON Parsing & Repair
   │  ├─ Cleaning time
   │  ├─ Initial parse time
   │  ├─ Repair time (if needed)
   │  └─ Success/failure
   ├─ Schema Validation
   │  ├─ Validation time
   │  └─ Validation errors
   └─ Data Extraction
      └─ Extraction time
```

### 4.3 Recommended Entry Points for New MetricsCollector

**Option 1: Wrap at LLMChooser level (Coarse-Grained)**
```javascript
// In LLMChooser.choose()
const startTime = performance.now();
const prompt = await this.#promptPipeline.generatePrompt(...);
metricsCollector.recordPromptGeneration(performance.now() - startTime);

const rawTime = performance.now();
const raw = await this.#llmAdapter.getAIDecision(prompt, abortSignal);
metricsCollector.recordLLMRequest(performance.now() - rawTime);

const parseTime = performance.now();
const parsed = await this.#responseProcessor.processResponse(raw, actor.id);
metricsCollector.recordResponseProcessing(performance.now() - parseTime);
```

**Option 2: Inject at LLMResponseProcessor level (Fine-Grained)**
```javascript
// In LLMResponseProcessor constructor
constructor({ 
  schemaValidator, 
  logger, 
  safeEventDispatcher, 
  llmJsonService,
  metricsCollector // NEW
}) { ... }

// In #parseResponse()
const parseStart = performance.now();
const parsed = await this.#llmJsonService.parseAndRepair(...);
this.#metricsCollector?.recordJsonParsing({
  duration: performance.now() - parseStart,
  inputLength: llmJsonResponse.length,
  outputValid: true
});

// In #validateSchema()
const validateStart = performance.now();
const { isValid, errors } = this.#schemaValidator.validate(...);
this.#metricsCollector?.recordSchemaValidation({
  duration: performance.now() - validateStart,
  isValid,
  errorCount: errors?.length || 0
});
```

**Option 3: Extend BaseOpenRouterStrategy (Provider-Level)**
```javascript
// In #sendRequest()
const requestStart = performance.now();
const responseData = await this.#httpClient.request(...);
this.logger.debug('Request time: ' + (performance.now() - requestStart) + 'ms');
// Could emit metric event here

// In #extractJson()
const extractStart = performance.now();
const extracted = await this._extractJsonOutput(...);
// Could emit metric event here
```

---

## 5. Current Error/Failure Handling

### Errors That Bubble Up

1. **LLMProcessingError** - From LLMResponseProcessor
   - Type validation failure
   - Schema validation failure
   - JSON parsing/repair failure
   - Caught by turn handler → ends turn

2. **JsonProcessingError** - From jsonRepair utility
   - Initial parse failure
   - Repair failure
   - Wrapped in LLMProcessingError

3. **ConfigurationError** - From ConfigurableLLMAdapter
   - Missing LLM config
   - Token limit exceeded
   - Invalid configuration
   - Caught by adapter → throws to caller

4. **LLMStrategyError** - From strategy execution
   - HTTP client errors
   - Response extraction failures
   - Unexpected errors during execution
   - Passed through adapter error mapper

5. **HttpClientError** - From HTTP client
   - Network errors
   - Status code errors (401, 429, 5xx)
   - Mapped by LLMErrorMapper
   - Mapped to domain errors (ApiKeyError, RateLimitError, etc.)

### Error Event System

**Primary Event:** `SYSTEM_ERROR_OCCURRED`
- Dispatched via safeEventDispatcher
- Contains error context
- Logged to system error stream
- Can be monitored by UI/logging systems

**Advantages:**
- Non-blocking error handling
- Centralized error tracking
- Observability without error throwing

---

## 6. Response Validation Summary

### Two-Level Validation

**Level 1: Structural Validation**
- JSON parseable (with repair if needed)
- All required fields present (chosenIndex, speech, thoughts)
- All fields have correct types
- No unexpected additional properties

**Level 2: Semantic Validation**
- chosenIndex is integer ≥ 1
- chosenIndex ≤ available actions count (validated in turn handler)
- speech and thoughts are strings (can be empty)
- notes array items have required fields if present

### What Gets Validated

✅ **Validated by Schema:**
- Field presence
- Field types
- Field lengths (minLength for text, subject)
- Enum values (subjectType)
- No additional properties

❌ **NOT Validated:**
- chosenIndex upper bound (action exists)
- Speech/thoughts content quality
- Notes relevance/accuracy
- Semantic correctness

**Why:** Schema validation focuses on format. Semantic validation happens at turn execution time.

---

## 7. Response Format Examples

### Successful Response

```json
{
  "chosenIndex": 2,
  "speech": "I'll investigate the strange noise.",
  "thoughts": "This could be dangerous. I should be cautious but curious.",
  "notes": [
    {
      "text": "Suspicious sound in the darkness",
      "subject": "Strange noise phenomenon",
      "subjectType": "observation",
      "context": "Near the old abandoned house"
    }
  ]
}
```

### Minimal Valid Response

```json
{
  "chosenIndex": 1,
  "speech": "",
  "thoughts": ""
}
```

### Response After Repair

Original (malformed):
```
{chosenIndex: 1, speech: "Hello, 'world'", thoughts: "Thinking...}
```

After repair:
```json
{"chosenIndex": 1, "speech": "Hello, 'world'", "thoughts": "Thinking..."}
```

---

## 8. Integration with Turn System

**Caller:** `LLMChooser.choose()` (line 59-79)
- Receives raw LLM response string (line 69)
- Calls processResponse (line 70)
- Gets action index, speech, thoughts, notes
- Returns to turn handler for action execution

**Failure Mode:**
- If processResponse throws → exception bubbles to turn handler
- Turn handler catches and calls `endTurn(error)`
- Turn ends with error state
- Action not executed

**Success Mode:**
- Action index used to select action from validated actions list
- Speech stored in action context
- Thoughts stored in actor memory
- Notes stored in actor notes system
- Action executes normally

---

## 9. Existing Instrumentation

### Logging Points

**Debug Level:**
- Parser success (line 83-88 in llmJsonService.js)
- Repair attempts (line 92-101 in llmJsonService.js)
- Validation success (line 166-168 in LLMResponseProcessor.js)
- Request execution (line 80-82 in llmRequestExecutor.js)

**Warn Level:**
- Parse failures triggering repair (line 92-101 in jsonRepair.js)
- Request failures with retry (line 165-170 in llmRequestExecutor.js)

**Error Level:**
- Type validation failures
- Schema validation failures
- All repair/parse failures
- Configuration errors

### Event Dispatch Points

Only in response processing errors:
- safeDispatchError called on parse failure (line 112-122)
- safeDispatchError called on validation failure (line 142-150)

No metrics collection points currently exist.

---

## 10. Metrics Collection Opportunities

### Recommended Metrics to Collect

**Parsing Metrics:**
- JSON parse success rate (%)
- Average parse time (ms)
- Repair rate (% needing repair)
- Repair success rate (%)
- Response length distribution

**Validation Metrics:**
- Schema validation success rate (%)
- Average validation time (ms)
- Most common validation errors
- Error types distribution
- Failed validations by actor

**End-to-End Metrics:**
- Total response processing time (ms)
- Success rate (% passing all steps)
- Time per stage breakdown
- Failures per stage
- Retry attempts and success

**LLM Quality Metrics:**
- Action selection validity
- Response structure compliance
- Missing field rate
- Malformed JSON rate
- Repair need rate

### Where to Add Collector

**Best Location:** Dependency injection into LLMResponseProcessor
- Minimal code changes
- Access to all processing stages
- Non-blocking collection
- Can be enabled/disabled via config
- Clean separation of concerns

**Secondary Location:** LLMChooser (if wanting aggregate metrics)
- Higher-level view
- Can track full decision flow
- Less granular but simpler

---

## Summary

The LLM response processing pipeline in Living Narrative Engine is well-structured with clear stages:

1. **Raw response extraction** from provider API (in strategy)
2. **JSON cleaning** (removing markdown/prefixes)
3. **JSON parsing with repair** (using @toolsycc/json-repair)
4. **Schema validation** (AJV against LLM_TURN_ACTION_RESPONSE_SCHEMA_ID v4)
5. **Data extraction** (structuring into action + metadata)

**Error handling** is comprehensive with:
- Multiple levels of validation
- Safe event dispatching
- Detailed error context
- Graceful failure modes

**Metrics opportunities exist** at multiple levels with the **LLMResponseProcessor** being the ideal insertion point for fine-grained metrics collection on parsing, validation, and data extraction.

The system is production-ready and could benefit from metrics instrumentation to monitor LLM output quality and processing performance.
