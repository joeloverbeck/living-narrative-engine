# CLAUDE.md - LLM Proxy Server Guidelines

## 🎯 Project Overview

This is a **Node.js Express API server** that acts as a secure proxy for LLM services, managing API keys and routing requests to various LLM providers. It uses ES modules (type: "module") and follows a layered architecture pattern.

**Core Purpose**: Provide a secure intermediary layer between clients and LLM APIs, handling authentication, rate limiting, and request/response transformation.

## 🏗️ Code Architecture & Structure

### Directory Layout

```
llm-proxy-server/
├── src/
│   ├── core/
│   │   └── server.js           # Entry point
│   ├── controllers/
│   │   └── LlmRequestController.js
│   ├── services/
│   │   ├── LlmConfigService.js
│   │   ├── ApiKeyService.js
│   │   └── LlmRequestService.js
│   ├── config/
│   │   ├── appConfig.js        # Main configuration
│   │   └── constants.js        # Centralized constants
│   ├── utils/
│   │   └── errorFormatter.js
│   └── middleware/
│       └── errorHandler.js
├── tests/
│   ├── unit/                   # Unit tests mirror src structure
│   └── integration/            # Integration tests
└── package.json
```

### Module Organization Rules

- **Maximum file size: 500 lines** - Split larger files into focused modules
- **One class/service per file** - Maintain single responsibility
- **Group by feature** - Keep related functionality together
- **Use index.js for exports** - When multiple related modules exist

## 🎨 Key Design Patterns

### 1. Dependency Injection

```javascript
// Always inject dependencies through constructor
class LlmRequestService {
  #apiKeyService;
  #llmConfigService;

  constructor(apiKeyService, llmConfigService) {
    this.#apiKeyService = apiKeyService;
    this.#llmConfigService = llmConfigService;
  }
}
```

### 2. Private Class Fields

- Use `#` prefix for private fields
- Encapsulate internal state
- Provide public methods for controlled access

### 3. Interface-Based Design

- Services implement consistent interfaces
- Controllers depend on abstractions
- Easy to swap implementations

### 4. Error Handling Pattern

```javascript
// Standardized error responses
try {
  // operation
} catch (error) {
  return res.status(500).json(formatError(error));
}
```

## 📋 Development Guidelines

### Adding New Endpoints

1. Create route in appropriate controller
2. Implement business logic in service layer
3. Add validation middleware if needed
4. Update API documentation
5. Write comprehensive tests

### Service Creation Pattern

```javascript
// 1. Define the service with private fields
class NewService {
  #dependency;

  constructor(dependency) {
    this.#dependency = dependency;
  }

  async performAction(params) {
    // Implementation
  }
}

// 2. Export as singleton or factory
export default NewService;
```

### Configuration Management

- All app config in `config/appConfig.js`
- Constants in `config/constants.js`
- Environment variables accessed through config
- Never hardcode values in services

## 🧪 Testing Requirements

### Test Structure

- **Location**: Tests in `/tests/unit/` and `/tests/integration/`
- **Naming**: `[filename].test.js`
- **Coverage**: Minimum 80% required

### Test Patterns

```javascript
describe('ServiceName', () => {
  let service;
  let mockDependency;

  beforeEach(() => {
    mockDependency = {
      /* mocks */
    };
    service = new ServiceName(mockDependency);
  });

  describe('methodName', () => {
    it('should handle expected case', () => {});
    it('should handle edge case', () => {});
    it('should handle error case', () => {});
  });
});
```

### Testing Checklist

- [ ] Unit tests for all public methods
- [ ] Integration tests for API endpoints
- [ ] Error scenarios covered
- [ ] Mocks properly implemented
- [ ] Test data isolated

## 🔧 Code Standards

### ESLint Rules

- **JSDoc required** for all public methods
- **No var** - Use const/let
- **Semicolons required**
- **2-space indentation**
- **Single quotes** for strings

### JSDoc Example

```javascript
/**
 * Processes an LLM request through the appropriate provider
 * @param {Object} requestData - The request payload
 * @param {string} requestData.model - Model identifier
 * @param {string} requestData.prompt - User prompt
 * @returns {Promise<Object>} LLM response
 * @throws {Error} If provider is unavailable
 */
async processRequest(requestData) {
  // Implementation
}
```

### Code Quality Rules

- **No console.log** in production code
- **Async/await** over promise chains
- **Early returns** to reduce nesting
- **Descriptive variable names**
- **Comment complex logic** with `// Reason:`

## 📡 API Contract

Reference the `PROXY_API_CONTRACT.md` file for:

- Endpoint specifications
- Request/response formats
- Authentication requirements
- Error response structures

## 🔨 Common Tasks

### Adding a New LLM Provider

1. Create provider service in `services/providers/`
2. Implement standard interface methods
3. Register in `LlmConfigService`
4. Add configuration in `appConfig.js`
5. Write provider-specific tests

### Modifying Request Flow

1. Update `LlmRequestController` for routing changes
2. Modify `LlmRequestService` for processing logic
3. Ensure backward compatibility
4. Update integration tests

### Adding Middleware

1. Create in `middleware/` directory
2. Follow Express middleware pattern
3. Register in `server.js`
4. Document middleware purpose
5. Test middleware isolation

## 🚨 Error Handling

### Standard Error Response

```json
{
  "error": {
    "message": "Human-readable error",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Error Types

- **400**: Client errors (validation, bad request)
- **401**: Authentication failures
- **403**: Authorization failures
- **500**: Server errors
- **503**: Service unavailable

## 🔒 Security Considerations

### API Key Handling

- Never log API keys
- Sanitize error messages
- Use environment variables
- Implement rate limiting
- Validate all inputs

### Request Validation

- Sanitize user inputs
- Validate request schemas
- Check content types
- Limit request sizes
- Implement timeouts

## 🚀 Performance Guidelines

- Use caching where appropriate
- Implement connection pooling
- Optimize database queries
- Monitor memory usage
- Profile critical paths

## 📝 Documentation Requirements

- Update README.md for setup changes
- Document all API changes
- Maintain changelog
- Comment non-obvious code
- Keep examples current

## ⚠️ Important Reminders

1. **Always run tests** before committing
2. **Check ESLint** with `npm run lint`
3. **Update tests** when modifying logic
4. **Never expose** sensitive configuration
5. **Follow patterns** established in codebase
6. **Ask questions** when requirements unclear

---

Remember: This is a critical security component. All changes must maintain the integrity of API key protection and request isolation.
