# CLAUDE.md - LLM Proxy Server Project Context

## 🚀 Project Overview

The LLM Proxy Server is a critical Node.js Express microservice within the Living Narrative Engine ecosystem, designed to provide secure API key management and request forwarding for Large Language Model (LLM) providers.

### Core Purpose

- **API Key Security**: Securely manages and injects API keys for cloud LLM services (OpenRouter, OpenAI, Anthropic, etc.)
- **Request Proxying**: Acts as a trusted intermediary between client applications and LLM providers
- **Configuration Abstraction**: Centralizes LLM endpoint configuration and authentication methods
- **Security & Performance**: Implements comprehensive middleware for rate limiting, validation, caching, and optimization

### Role in Living Narrative Engine

This microservice operates independently from the main application, typically running on port 3001, and serves as the secure gateway for all LLM interactions. Client-side applications never handle API keys directly, ensuring credential security.

## 🏗️ Architecture & Design Patterns

### System Architecture

```
Client Application          LLM Proxy Server           LLM Providers
     ↓                            ↓                         ↓
Browser/Game Client  →  Express.js Microservice  →  OpenRouter/OpenAI/etc.
                         ├── Security Middleware
                         ├── Request Controller
                         ├── API Key Service
                         ├── Cache Service
                         └── HTTP Agent Pool
```

### Layered Architecture

- **Presentation Layer**: Express controllers and middleware
- **Business Logic Layer**: Services for API keys, LLM requests, configuration
- **Infrastructure Layer**: File system, HTTP agents, caching, logging
- **Configuration Layer**: Environment-based configuration management

### Design Patterns

- **Dependency Injection**: Constructor-based dependency injection throughout
- **Singleton Pattern**: AppConfigService for centralized configuration
- **Factory Pattern**: Service creation and middleware composition
- **Strategy Pattern**: Multiple API key retrieval strategies (env vars, files)
- **Middleware Pattern**: Composable Express middleware stack

## 🛠️ Technology Stack & Dependencies

### Core Runtime

- **Node.js**: ES modules (`"type": "module"`) with modern JavaScript features
- **Express**: 5.1.0 - High-performance web framework

### Security & Middleware

- **helmet**: 8.1.0 - Security headers and protections
- **cors**: 2.8.5 - Cross-origin resource sharing
- **express-rate-limit**: 7.5.1 - Rate limiting and abuse prevention
- **express-validator**: 7.2.1 - Input validation and sanitization
- **compression**: 1.8.0 - Response compression

### Development & Quality

- **eslint**: 9.28.0 - Code linting with Jest and JSDoc plugins
- **prettier**: 3.5.3 - Code formatting
- **typescript**: 5.8.3 - Type checking for JavaScript
- **jest**: 30.0.4 - Testing framework with coverage
- **supertest**: 7.1.3 - HTTP integration testing

### Configuration & Environment

- **dotenv**: 17.0.1 - Environment variable management

## 📁 Project Structure & Organization

```
llm-proxy-server/
├── src/                          # Main application source
│   ├── core/                     # Server initialization & startup
│   │   └── server.js            # Main Express app & graceful shutdown
│   ├── config/                   # Configuration management
│   │   ├── appConfig.js         # AppConfigService singleton
│   │   ├── constants.js         # Application constants & defaults
│   │   └── llmConfigService.js  # LLM configuration loading
│   ├── handlers/                 # Request controllers
│   │   └── llmRequestController.js # Main LLM request handling
│   ├── middleware/               # Express middleware
│   │   ├── rateLimiting.js      # Rate limiting configuration
│   │   ├── security.js          # Security headers & protections
│   │   ├── timeout.js           # Request timeout handling
│   │   └── validation.js        # Input validation & sanitization
│   ├── services/                 # Business logic services
│   │   ├── apiKeyService.js     # API key retrieval & caching
│   │   ├── cacheService.js      # LRU caching implementation
│   │   ├── httpAgentService.js  # HTTP connection pooling
│   │   └── llmRequestService.js # LLM provider communication
│   ├── utils/                    # Shared utilities
│   │   ├── errorFormatter.js    # Error response formatting
│   │   ├── loggerUtils.js       # Logging utilities & masking
│   │   ├── proxyApiUtils.js     # Retry logic & API utilities
│   │   └── responseUtils.js     # Response helper functions
│   ├── interfaces/               # Type definitions & interfaces
│   │   ├── IFileSystemReader.js # File system abstraction
│   │   └── ILlmConfigService.js # Configuration service interface
│   ├── consoleLogger.js         # Console logger implementation
│   ├── nodeFileSystemReader.js  # Node.js file system implementation
│   └── proxyLlmConfigLoader.js  # LLM configuration loader
├── tests/                        # Comprehensive test suite
│   ├── unit/                     # Unit tests (mirrors src structure)
│   ├── integration/              # End-to-end integration tests
│   ├── contract/                 # API contract validation tests
│   ├── performance/              # Load testing & benchmarks
│   ├── common/                   # Test utilities & helpers
│   │   ├── builders.js          # Test data builders
│   │   ├── helpers.js           # Test helper functions
│   │   ├── mocks.js             # Mock implementations
│   │   └── testServerUtils.js   # Server testing utilities
│   └── utils/                    # Utility function tests
├── coverage/                     # Test coverage reports
├── reports/                      # Analysis & documentation reports
├── package.json                  # Project configuration & scripts
├── jest.config.js               # Jest testing configuration
├── eslint.config.js             # ESLint linting configuration
├── tsconfig.json                # TypeScript type checking
├── babel.config.cjs             # Babel transpilation
├── README.md                     # Project documentation
├── PROXY_API_CONTRACT.md         # API contract specification
└── .env                         # Environment configuration (create from .env.example)
```

### Key File Purposes

- **`src/core/server.js`**: Main Express application with comprehensive startup logging and graceful shutdown
- **`src/config/appConfig.js`**: Singleton service for environment variable management with validation
- **`src/handlers/llmRequestController.js`**: Primary request controller handling LLM proxy requests
- **`src/services/`**: Core business logic with clear separation of concerns
- **`src/middleware/`**: Reusable Express middleware for security, validation, and performance
- **`PROXY_API_CONTRACT.md`**: Defines the API contract between clients and the proxy server

## 🧪 Testing Strategy & Scripts

### Test Scripts (package.json)

#### Primary Test Commands

```bash
# Run full test suite with coverage
npm run test

# Run unit tests only (excludes performance tests)
npm run test:unit

# Run performance and load testing
npm run test:performance

# Run tests sequentially for debugging
npm run test:single

# Run tests in CI mode (optimized for automation)
npm run test:ci
```

#### Development Quality Commands

```bash
# Code formatting
npm run format              # Format all files
npm run format:check        # Check formatting without changes

# Code linting
npm run lint               # Fix ESLint issues automatically

# Type checking
npm run typecheck          # Run TypeScript type checking
```

#### Server Commands

```bash
# Development (with file watching)
npm run dev

# Production
npm start
```

### Test Organization & Coverage

#### Test Types & Structure

1. **Unit Tests** (`/tests/unit/`)
   - Mirror the `src/` directory structure
   - Test individual functions and classes in isolation
   - Mock external dependencies
   - Focus on business logic and edge cases

2. **Integration Tests** (`/tests/integration/`)
   - End-to-end workflow testing
   - API endpoint testing with real HTTP requests
   - Service integration validation
   - Error handling and recovery testing

3. **Contract Tests** (`/tests/contract/`)
   - API contract validation against schema
   - Request/response format verification
   - Error response format testing
   - Regression testing for API changes

4. **Performance Tests** (`/tests/performance/`)
   - Load testing and benchmarking
   - Memory usage analysis
   - Cache performance validation
   - HTTP agent pooling efficiency

#### Coverage Requirements

- **Branches**: 78% minimum coverage
- **Functions**: 94% minimum coverage
- **Lines**: 80% minimum coverage
- **Statements**: 90% minimum coverage

#### Test Utilities & Helpers

- **`/tests/common/builders.js`**: Test data builders and factories
- **`/tests/common/helpers.js`**: Common test helper functions
- **`/tests/common/mocks.js`**: Mock implementations for services
- **`/tests/common/testServerUtils.js`**: Server testing utilities

### Jest Configuration

- **Test Environment**: Node.js
- **Coverage Directory**: `./coverage`
- **Coverage Reporters**: JSON, LCOV, text, HTML
- **Mock Clearing**: Automatic between tests
- **Performance Test Exclusion**: Default runs exclude performance tests

## ⚙️ Configuration Management

### Environment Variables

#### Core Server Configuration

```bash
# Server port (default: 3001)
PROXY_PORT=3001

# CORS allowed origins (comma-separated)
PROXY_ALLOWED_ORIGIN=http://localhost:8080,http://127.0.0.1:8080

# LLM configuration file path (default: ../config/llm-configs.json)
LLM_CONFIG_PATH=/path/to/llm-configs.json

# API key file root directory
PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES=/secure/path/to/api_keys

# Environment mode
NODE_ENV=development
```

#### Cache Configuration

```bash
# Enable/disable caching (default: true)
CACHE_ENABLED=true

# Cache TTL in milliseconds (default: 300000 - 5 minutes)
CACHE_DEFAULT_TTL=300000

# Maximum cache entries (default: 1000)
CACHE_MAX_SIZE=1000

# API key cache TTL (default: 300000 - 5 minutes)
API_KEY_CACHE_TTL=300000
```

#### HTTP Agent Configuration

```bash
# Enable HTTP agent pooling (default: true)
HTTP_AGENT_ENABLED=true

# Keep-alive connections (default: true)
HTTP_AGENT_KEEP_ALIVE=true

# Maximum sockets per host (default: 50)
HTTP_AGENT_MAX_SOCKETS=50

# Socket timeout in ms (default: 60000)
HTTP_AGENT_TIMEOUT=60000
```

### AppConfigService Pattern

The `AppConfigService` implements a singleton pattern for centralized configuration management:

```javascript
// Access singleton instance
const appConfigService = getAppConfigService(logger);

// Get configuration values with defaults and validation
const port = appConfigService.getProxyPort();
const cacheConfig = appConfigService.getCacheConfig();
const httpAgentConfig = appConfigService.getHttpAgentConfig();
```

#### Key Features:

- **Runtime Validation**: All environment variables validated on startup
- **Default Values**: Sensible defaults for all configuration options
- **Detailed Logging**: Configuration status logged during initialization
- **Type Safety**: Methods return properly typed configuration objects

## 🔒 Security & Performance Features

### Security Middleware Stack

1. **Helmet**: Security headers (CSP, HSTS, X-Frame-Options, etc.)
2. **CORS**: Cross-origin resource sharing with configurable origins
3. **Rate Limiting**: Adaptive rate limiting with IP tracking and suspicious pattern detection
4. **Input Validation**: express-validator with custom sanitization
5. **Header Sanitization**: Prototype pollution and injection prevention
6. **Request Size Limits**: Configurable payload size restrictions

### Performance Optimizations

1. **Caching**: LRU cache with TTL for API keys and responses
2. **HTTP Agent Pooling**: Connection reuse and socket management
3. **Compression**: Gzip compression for responses
4. **Timeout Management**: Request timeout handling with graceful degradation

### Rate Limiting Strategy

- **General API**: 100 requests per 15 minutes
- **LLM Requests**: 10 requests per minute (stricter)
- **Adaptive Limiting**: Suspicious pattern detection and escalation
- **IP Extraction**: Proxy-aware IP detection from headers

### Validation & Sanitization

```javascript
// Input validation pipeline
validateRequestHeaders() →
validateLlmRequest() →
handleValidationErrors →
sanitizeHeaders() →
Controller
```

## 🎯 Development Guidelines & Conventions

### Code Style & Conventions

#### Naming Patterns

- **Files**: camelCase (`apiKeyService.js`, `llmRequestController.js`)
- **Classes**: PascalCase (`ApiKeyService`, `LlmRequestController`)
- **Functions**: camelCase (`getApiKey`, `validateRequest`)
- **Constants**: UPPER_SNAKE_CASE (`HTTP_HEADER_CONTENT_TYPE`, `CACHE_DEFAULT_TTL`)
- **Private Fields**: Prefix with `#` (`#logger`, `#cacheService`)

#### File Structure Template

```javascript
/**
 * @file Brief description of file purpose
 * @see relatedFile.js
 */

// Standard imports
import { something } from './path.js';

// Type imports (JSDoc)
/** @typedef {import('./types.js').MyType} MyType */

// Constants (if any)
const LOCAL_CONSTANT = 'value';

/**
 * Main class with comprehensive JSDoc
 */
class MyService {
  /** @type {ILogger} */
  #logger;

  /**
   * Constructor with dependency validation
   * @param {ILogger} logger - Logger instance
   */
  constructor(logger) {
    if (!logger) throw new Error('logger is required');
    this.#logger = logger;
  }
}

export default MyService;
```

#### JSDoc Requirements

- **Classes**: Full documentation including purpose and usage examples
- **Public Methods**: Complete parameter and return type documentation
- **Type Definitions**: Import types for better IDE support
- **Error Cases**: Document thrown errors and conditions

### Error Handling Patterns

#### Standardized Error Objects

```javascript
{
  message: 'Human-readable error description',
  stage: 'machine_readable_error_stage',
  details: {
    // Structured error context
    llmId: 'provider-model-id',
    attemptedAction: 'api_key_retrieval',
    originalErrorMessage: 'underlying error'
  }
}
```

#### Error Handling Guidelines

- **Never log directly**: Use event dispatching or structured error objects
- **Fail fast**: Validate dependencies and inputs early
- **Provide context**: Include relevant information in error details
- **Use domain errors**: Create specific error types for different failure modes

### Module Organization

- **Single Responsibility**: Each module has one clear purpose
- **Interface-based Design**: Use interfaces for testability and flexibility
- **Dependency Injection**: Constructor-based injection for all services
- **Clear Exports**: Use named exports for utilities, default exports for main classes

## 🔧 Code Quality Standards

### Linting Configuration (ESLint)

#### Core Rules

- **ESLint Recommended**: Base rule set for JavaScript best practices
- **JSDoc Integration**: Required documentation for public APIs
- **Jest Support**: Testing-specific rules and globals
- **No Console**: Warnings for console usage (exceptions for server startup)

#### JSDoc Requirements

```javascript
// Required for all public methods
/**
 * Retrieves API key for specified LLM configuration
 * @param {LLMModelConfig} llmConfig - LLM configuration object
 * @returns {Promise<ApiKeyResult>} API key result with error handling
 * @throws {Error} When llmConfig is invalid or missing
 */
async getApiKey(llmConfig) {
  // Implementation
}
```

### Prettier Configuration

- **Single Quotes**: Consistent string formatting
- **Trailing Commas**: ES5-compatible trailing commas
- **Tab Width**: 2 spaces for indentation
- **Line Length**: 80 characters maximum
- **Semicolons**: Required for statement termination

### TypeScript Integration

- **Type Checking**: JSDoc-based type checking for JavaScript files
- **Strict Mode**: Enabled for maximum type safety
- **No Emit**: Type checking only, no transpilation
- **Module Resolution**: Node.js-style module resolution

### Quality Commands Workflow

```bash
# Complete quality check workflow
npm run lint        # Fix linting issues
npm run format      # Format code consistently
npm run typecheck   # Verify type correctness
npm run test        # Run full test suite
```

## 🚀 Common Development Workflows

### Development Setup

1. **Environment Configuration**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev  # File watching enabled
   ```

### Testing Workflow

1. **Run Tests During Development**:

   ```bash
   npm run test:single  # Sequential execution for debugging
   ```

2. **Test Specific Components**:

   ```bash
   npm run test:unit -- --testNamePattern="ApiKeyService"
   ```

3. **Performance Testing**:
   ```bash
   npm run test:performance
   ```

### Code Quality Workflow

1. **Before Committing**:

   ```bash
   npm run lint && npm run format && npm run typecheck && npm run test
   ```

2. **Fix Quality Issues**:
   ```bash
   npm run lint     # Auto-fix ESLint issues
   npm run format   # Auto-format code
   ```

### Debugging & Troubleshooting

#### Server Startup Issues

- Check environment variable configuration in logs
- Verify LLM configuration file path and format
- Ensure API key files are accessible if using file-based keys

#### Test Failures

- Use `npm run test:single` for detailed output
- Check mock implementations in `/tests/common/`
- Verify test data builders are generating valid data

#### Performance Issues

- Run performance tests to identify bottlenecks
- Check cache hit rates in logs
- Monitor HTTP agent pool usage

### Production Deployment

1. **Environment Setup**:
   - Set `NODE_ENV=production`
   - Configure production-appropriate rate limits
   - Set up proper logging and monitoring

2. **Build & Start**:

   ```bash
   npm start  # Production mode
   ```

3. **Health Checks**:
   - Verify server startup logs
   - Test API endpoint availability
   - Check LLM configuration loading

## 🔗 Integration Points

### Client Integration

Clients communicate with the proxy server via the `/api/llm-request` endpoint:

```typescript
// Client request format
{
  llmId: 'provider-model-identifier',
  targetPayload: {
    // LLM-specific parameters
    model: 'claude-3-haiku',
    messages: [...],
    temperature: 0.7
  },
  targetHeaders: {
    // Optional provider-specific headers
    'anthropic-version': '2023-06-01'
  }
}
```

### LLM Configuration

The server loads LLM configurations from `llm-configs.json` with support for:

- Multiple API key sources (environment variables, files)
- Provider-specific headers and parameters
- Retry configuration and timeout settings
- Local vs. cloud provider detection

### Logging & Monitoring

- **Structured Logging**: JSON-formatted logs with request correlation
- **Performance Metrics**: Response times, cache hit rates, error rates
- **Security Events**: Rate limiting triggers, validation failures
- **Health Monitoring**: Service availability and dependency status

---

## 📚 Key Concepts & Best Practices

### Dependency Injection Pattern

All services use constructor-based dependency injection for testability and flexibility:

```javascript
class ServiceExample {
  constructor(logger, configService, otherDependency) {
    // Validate all dependencies
    if (!logger) throw new Error('logger is required');

    this.#logger = logger;
    // Store other dependencies
  }
}
```

### Configuration Management

Use the AppConfigService singleton for all configuration access:

```javascript
// Get configuration values
const config = appConfigService.getCacheConfig();
const isEnabled = appConfigService.isCacheEnabled();
```

### Error Handling Strategy

- **Standardized Errors**: Use consistent error object structure
- **Early Validation**: Validate inputs at service boundaries
- **Graceful Degradation**: Handle failures without crashing
- **Detailed Logging**: Provide context for debugging

### Performance Considerations

- **Cache Strategically**: Cache API keys and configuration data
- **Pool Connections**: Use HTTP agent pooling for external requests
- **Validate Efficiently**: Implement fast-path validation for common cases
- **Monitor Resources**: Track memory usage and connection counts

### Security Principles

- **Defense in Depth**: Multiple layers of security validation
- **Least Privilege**: Minimal required permissions and access
- **Input Sanitization**: Validate and sanitize all external inputs
- **Rate Limiting**: Protect against abuse and resource exhaustion

---

_This document serves as the comprehensive development guide for the LLM Proxy Server. Follow these patterns and guidelines to maintain consistency and quality across the codebase._
