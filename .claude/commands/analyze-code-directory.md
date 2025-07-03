# Analyze Code Directory

Comprehensive analysis of a code directory and all its subdirectories to understand architecture, detect vulnerabilities, identify improvement opportunities, and provide strategic recommendations for enhanced robustness and features.

## Directory Path: $ARGUMENTS

## Analysis Process

### 1. **Validate Input**
   - Verify the directory exists and is readable
   - Confirm it's a valid code directory (contains source files)
   - Check for common code file extensions (.js, .ts, .jsx, .tsx, etc.)
   - Exit with clear error if validation fails

### 2. **Recursive Directory Structure Discovery**
   - **IMPORTANT**: Analyze the target directory AND all subdirectories recursively
   - Map all subdirectories and their purposes at every level
   - Catalog all code files with their roles throughout the hierarchy
   - Identify configuration files and their impact across all levels
   - Create a visual tree structure showing the complete directory hierarchy
   - Note any special files (index files, main exports, etc.) at any depth
   - Track directory depth and complexity metrics

### 3. **Entry Point Analysis**
   - **External Callers Discovery**
     - Search entire codebase for imports/requires of modules in target directory and subdirectories
     - Map which external modules depend on this directory tree
     - Identify primary vs secondary entry points at all levels
     - Analyze export patterns (default vs named exports)
   
   - **Public API Surface**
     - List all exported functions, classes, and constants from all files
     - Categorize exports by purpose and subdirectory
     - Identify which exports are actually used externally
     - Note any exports that appear to be internal but are exposed

### 4. **System Behavior Mapping**
   - **Module Responsibilities**
     - For each module across all subdirectories, determine its primary purpose
     - Map relationships between modules within the entire directory tree
     - Identify core business logic vs utility functions at each level
     - Document state management patterns throughout the hierarchy
   
   - **Functional Decomposition**
     - Trace key workflows through modules across subdirectories
     - Identify decision points and branching logic
     - Map error handling strategies at all levels
     - Document side effects and external interactions

### 5. **External Connection Points**
   - **Outbound Dependencies**
     - List all external modules imported by any file in the directory tree
     - Categorize dependencies (system, business, utility, third-party)
     - Identify potential coupling issues across subdirectories
     - Map data contracts with external modules
   
   - **Integration Interfaces**
     - Document API calls to external services from any subdirectory
     - Identify database/storage interactions at all levels
     - Map event emitters/listeners throughout the hierarchy
     - Trace message passing or pub/sub patterns

### 6. **Data Flow Analysis**
   - **Input Sources**
     - Trace where data enters the system at any level
     - Document expected data formats and validation
     - Identify data transformation entry points across subdirectories
   
   - **Processing Pipeline**
     - Map how data flows through different modules and subdirectories
     - Identify transformation stages at each level
     - Document validation and sanitization points
     - Trace error propagation paths through the hierarchy
   
   - **Output Destinations**
     - Document where processed data goes from any subdirectory
     - Map return value patterns across the tree
     - Identify side effects and mutations at all levels
     - Trace data persistence points

### 7. **Comprehensive Vulnerability Analysis**
   - **Input Validation Vulnerabilities**
     - Identify missing or inadequate input validation
     - Find unvalidated user inputs across all files
     - Check for proper data type validation
   
   - **Authentication & Authorization**
     - Identify missing auth checks in any subdirectory
     - Detect potential privilege escalation paths
     - Find exposed sensitive operations
     - Check for proper session management
   
   - **Data Security Issues**
     - Search for hardcoded credentials or API keys
     - Identify sensitive data exposure risks
     - Detect insecure data storage patterns
     - Find potential data leakage points
   
   - **Dependency Vulnerabilities**
     - Check for known vulnerable dependencies
     - Identify outdated packages with security issues
     - Detect insecure dependency configurations
     - Find potential supply chain risks
   
   - **Code-Level Security Flaws**
     - Detect race conditions and concurrency issues
     - Identify insecure randomness usage
     - Find potential buffer overflows or memory issues
     - Check for insecure cryptographic practices

### 8. **Robustness Recommendations**
   - **Error Handling Enhancements**
     - Identify missing try-catch blocks across all files
     - Suggest comprehensive error handling strategies
     - Recommend proper error logging and monitoring
     - Propose graceful degradation patterns
   
   - **Fault Tolerance Improvements**
     - Suggest retry mechanisms for external calls
     - Recommend circuit breaker patterns
     - Propose timeout configurations
     - Identify single points of failure
   
   - **Defensive Programming**
     - Recommend input sanitization improvements
     - Suggest assertion and precondition checks
     - Propose defensive copying strategies
     - Identify areas needing defensive defaults
   
   - **Resource Management**
     - Suggest proper resource cleanup patterns
     - Recommend connection pooling strategies
     - Propose memory management improvements
     - Identify potential resource leaks

### 9. **Feature Enhancement Opportunities**
   - **Existing Feature Improvements**
     - Analyze current features for enhancement potential
     - Suggest performance optimizations
     - Recommend usability improvements
     - Identify feature consolidation opportunities
   
   - **New Feature Suggestions**
     - Based on patterns found, suggest complementary features
     - Identify gaps in current functionality
     - Propose integration possibilities
     - Recommend API enhancements
   
   - **Performance Enhancements**
     - Identify caching opportunities
     - Suggest lazy loading implementations
     - Recommend batch processing where applicable
     - Propose async/parallel processing improvements
   
   - **Developer Experience**
     - Suggest better logging and debugging features
     - Recommend API documentation improvements
     - Propose development tool integrations
     - Identify automation opportunities

### 10. **Critical Observations & Insights**
   - **Technical Debt Assessment**
     - Identify accumulated technical debt across subdirectories
     - Quantify refactoring effort needed
     - Prioritize debt reduction opportunities
     - Suggest incremental improvement strategies
   
   - **Architectural Concerns**
     - Identify architectural anti-patterns
     - Detect coupling and cohesion issues
     - Find scalability bottlenecks
     - Suggest architectural improvements
   
   - **Code Quality Issues**
     - Identify code smells throughout the hierarchy
     - Detect duplicated code across subdirectories
     - Find overly complex functions/classes
     - Suggest simplification strategies
   
   - **Maintenance Challenges**
     - Identify hard-to-maintain code patterns
     - Detect missing or outdated documentation
     - Find inconsistent coding styles
     - Suggest standardization approaches

### 11. **Generate Comprehensive Report**
   Create a markdown report with the following enhanced structure:

   ```markdown
   # Code Directory Analysis Report
   
   ## Executive Summary
   - Directory Analyzed: [path] (including all subdirectories)
   - Analysis Date: [current date]
   - Total Files: [count across all subdirectories]
   - Total Subdirectories: [count]
   - Directory Depth: [maximum depth]
   - Total Lines of Code: [approximate]
   - Architecture Style: [identified pattern]
   - Security Score: [1-10]
   - Robustness Score: [1-10]
   - Overall Health Score: [1-10]
   
   ## Directory Overview
   ### Recursive Structure
   ```
   [Visual tree representation showing all subdirectories]
   ```
   
   ### Key Statistics
   - Modules: [count with breakdown by type and subdirectory]
   - External Dependencies: [count]
   - Entry Points: [count at each level]
   - Vulnerabilities Found: [count by severity]
   - Test Coverage: [if applicable]
   
   ## Entry Points Analysis
   ### Primary Entry Points
   [For each main entry point across all subdirectories:]
   - **[Module/File Name]** (path/to/file)
     - Purpose: [description]
     - External Callers: [list with file:line references]
     - Exported API: [key functions/classes]
     - Usage Patterns: [how it's typically used]
   
   ### Secondary Entry Points
   [Less frequently used entry points with similar structure]
   
   ## System Behavior
   ### Core Responsibilities
   [For each major responsibility across the directory tree:]
   1. **[Responsibility Name]**
      - Modules Involved: [list with paths]
      - Key Functions: [main functions]
      - Business Logic: [summary]
      - Data Transformations: [overview]
   
   ### Workflow Analysis
   [For each major workflow spanning subdirectories:]
   - **[Workflow Name]**
     - Entry Point: [where it starts]
     - Processing Steps: [ordered list with subdirectory traversal]
     - Exit Points: [where it completes]
     - Error Handling: [strategy]
   
   ## External Connections
   ### Dependencies Map
   - **System Dependencies**
     [List with usage context and subdirectory locations]
   - **Business Logic Dependencies**
     [List with coupling analysis across subdirectories]
   - **Third-Party Libraries**
     [List with version concerns and security status]
   
   ### Integration Points
   [For each integration found in any subdirectory:]
   - **[Integration Name]**
     - Type: [API/Database/Event/etc.]
     - Location: [subdirectory path]
     - Direction: [Inbound/Outbound/Bidirectional]
     - Data Contract: [format/schema]
     - Error Handling: [approach]
   
   ## Data Flow Patterns
   ### Input Processing
   - Sources: [where data comes from across subdirectories]
   - Validation: [how it's validated at each level]
   - Transformation Pipeline: [step-by-step through subdirectories]
   
   ### Data Transformations
   [For each major transformation across the hierarchy:]
   - **[Transformation Name]**
     - Location: [subdirectory/file]
     - Input Format: [structure]
     - Processing Logic: [summary]
     - Output Format: [structure]
     - Side Effects: [if any]
   
   ### Output Patterns
   - Destinations: [where data goes from each subdirectory]
   - Formats: [output structures]
   - Persistence: [if applicable]
   
   ## Vulnerability Analysis
   ### Critical Vulnerabilities
   [For each critical vulnerability found:]
   - **[Vulnerability Type]**
     - Severity: [Critical/High/Medium/Low]
     - Location: [file:line in subdirectory]
     - Description: [detailed explanation]
     - Exploitation Risk: [assessment]
     - Remediation: [specific fix recommendation]
   
   ### Security Risk Summary
   - Input Validation: [score and issues found]
   - Authentication: [score and weaknesses]
   - Data Security: [score and exposures]
   - Dependencies: [vulnerable count and details]
   - Code Security: [score and flaws]
   
   ## Robustness Analysis
   ### Current State Assessment
   - Error Handling Coverage: [percentage and gaps]
   - Fault Tolerance: [current mechanisms]
   - Resource Management: [assessment]
   - Defensive Programming: [score]
   
   ### Robustness Improvements
   [Priority-ordered list:]
   1. **[Improvement Area]**
      - Current State: [assessment]
      - Recommendation: [specific action]
      - Implementation Effort: [Low/Medium/High]
      - Impact: [expected benefit]
   
   ## Feature Enhancement Opportunities
   ### Quick Win Features
   [Low-effort, high-impact improvements:]
   1. **[Feature Name]**
      - Description: [what it does]
      - Implementation: [brief approach]
      - Effort: [hours/days]
      - Value: [business/user benefit]
   
   ### Strategic Features
   [Higher-effort, transformative features:]
   1. **[Feature Name]**
      - Description: [comprehensive explanation]
      - Prerequisites: [what's needed]
      - Implementation Roadmap: [phases]
      - Expected ROI: [benefits vs effort]
   
   ## Critical Observations
   ### Technical Debt
   - Total Debt Score: [1-10]
   - Major Debt Items: [prioritized list]
   - Refactoring Effort: [person-days estimate]
   - Risk if Unaddressed: [assessment]
   
   ### Architectural Issues
   [For each major issue:]
   - **[Issue Name]**
     - Impact: [current problems]
     - Root Cause: [analysis]
     - Solution: [architectural change needed]
     - Migration Path: [how to fix incrementally]
   
   ### Code Quality Concerns
   - Duplication: [percentage and locations]
   - Complexity: [hotspots across subdirectories]
   - Maintainability: [score and issues]
   - Documentation: [coverage and gaps]
   
   ## Recommendations
   ### Immediate Actions (This Week)
   1. [Security-critical fix with step-by-step guide]
   2. [High-impact, low-effort improvement]
   3. [Critical bug fix needed]
   
   ### Short-term Improvements (This Month)
   1. [Robustness enhancement with implementation plan]
   2. [Feature addition with design outline]
   3. [Technical debt reduction task]
   
   ### Long-term Strategy (This Quarter)
   1. [Architectural improvement with migration strategy]
   2. [Major feature implementation with phases]
   3. [Platform enhancement with roadmap]
   
   ## Risk Assessment
   ### Security Risks
   - Overall Risk Level: [Critical/High/Medium/Low]
   - Immediate Threats: [list]
   - Mitigation Priority: [ordered actions]
   
   ### Operational Risks
   - Stability Concerns: [assessment]
   - Performance Risks: [identified bottlenecks]
   - Scalability Limits: [current constraints]
   
   ## Appendix
   ### File-by-File Analysis
   [Detailed breakdown of each file across all subdirectories]
   
   ### Dependency Graph
   [Visual or textual representation of dependencies]
   
   ### Vulnerability Details
   [Comprehensive vulnerability information with CVEs if applicable]
   
   ### Metrics Summary
   [Detailed metrics for each subdirectory]
   ```

### 12. **Save Report**
   - Generate timestamp in format: YYYY-MM-DD-HH-MM-SS
   - Extract directory name from path for filename
   - Save to `reports/code-directory-analysis-[timestamp]-[directory-name].md`
   - Display summary in console including vulnerability count and priority recommendations
   - Provide path to full report

## Validation Commands
```bash
# Verify report was generated
ls reports/code-directory-analysis-*.md | tail -1

# Check report structure completeness
grep -E "## (Vulnerability|Robustness|Feature Enhancement|Critical Observations)" reports/code-directory-analysis-*.md | tail -4

# Validate recursive analysis
grep -c "subdirector" reports/code-directory-analysis-*.md

# Check security findings
grep -c "Severity:" reports/code-directory-analysis-*.md
```

## Usage Example
```
# Analyze a specific code directory and all subdirectories
claude --use-command analyze-code-directory src/anatomy/

# Analyze a nested directory tree
claude --use-command analyze-code-directory src/services/database/

# Analyze entire source tree
claude --use-command analyze-code-directory src/
```

## Quality Checklist
- [ ] All files in directory and subdirectories analyzed
- [ ] Recursive directory traversal completed
- [ ] Entry points correctly identified at all levels
- [ ] External callers mapped with file:line references
- [ ] Data flow documented end-to-end across subdirectories
- [ ] Vulnerabilities detected and categorized by severity
- [ ] Robustness gaps identified with specific recommendations
- [ ] Feature enhancement opportunities documented
- [ ] Architecture patterns identified across the hierarchy
- [ ] Critical observations and insights provided
- [ ] Actionable recommendations prioritized by impact/effort
- [ ] Report is comprehensive yet readable
- [ ] Security considerations thoroughly addressed
- [ ] Improvement opportunities clearly prioritized

## Error Handling
- Invalid directory path: Clear error message with correct usage
- Empty directory: Report this as finding, check subdirectories
- No code files: Suggest checking path or file extensions
- Permission issues: Advise on access rights, skip inaccessible subdirectories
- Large directories: Implement sampling or pagination for performance
- Circular dependencies: Detect and report without infinite loops

## Analysis Techniques
- **Static Analysis**: Parse code structure without execution
- **Pattern Matching**: Identify common vulnerability patterns
- **Dependency Analysis**: Track import/require relationships
- **Complexity Metrics**: Calculate cyclomatic complexity
- **Security Scanning**: Check against known vulnerability databases
- **Best Practice Validation**: Compare against industry standards

## Future Enhancements
- Machine learning-based vulnerability prediction
- Automated fix generation for common issues
- Integration with CI/CD pipelines
- Real-time monitoring integration
- Comparative analysis between versions
- Automated security patch recommendations
- Performance profiling integration
- Container and cloud deployment analysis