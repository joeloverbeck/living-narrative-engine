/**
 * @file Structured error payload for expression prerequisite evaluation failures.
 */

class ExpressionPrerequisiteError extends Error {
  /**
   * @param {object} details
   * @param {string} details.message
   * @param {string} details.code
   * @param {string} details.category
   * @param {string} details.expressionId
   * @param {string | undefined} details.modId
   * @param {number} details.prerequisiteIndex
   * @param {string} details.logicSummary
   * @param {string | undefined} details.resolvedLogicSummary
   * @param {Array<{path: string, value: any, missing: boolean, hasDefault: boolean}>} details.vars
   */
  constructor(details) {
    super(details.message);
    this.name = 'ExpressionPrerequisiteError';
    this.code = details.code;
    this.category = details.category;
    this.expressionId = details.expressionId;
    this.modId = details.modId;
    this.prerequisiteIndex = details.prerequisiteIndex;
    this.logicSummary = details.logicSummary;
    this.resolvedLogicSummary = details.resolvedLogicSummary;
    this.vars = details.vars;
  }

  /**
   * @returns {object} JSON-safe error payload
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      expressionId: this.expressionId,
      modId: this.modId,
      prerequisiteIndex: this.prerequisiteIndex,
      logicSummary: this.logicSummary,
      resolvedLogicSummary: this.resolvedLogicSummary,
      vars: this.vars,
    };
  }
}

export default ExpressionPrerequisiteError;
