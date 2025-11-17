export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow assigning raw planning state hashes to context.state outside GoalEvaluationContextAdapter',
      recommended: false,
    },
    schema: [],
    messages: {
      noRawState:
        'Use GoalEvaluationContextAdapter or PlanningStateView to provide evaluation context. Avoid assigning raw hashes via context.state = state.',
    },
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        if (
          node.left &&
          node.left.type === 'MemberExpression' &&
          !node.left.computed &&
          node.left.property?.type === 'Identifier' &&
          node.left.property.name === 'state' &&
          node.left.object?.type === 'Identifier' &&
          node.left.object.name === 'context' &&
          node.right?.type === 'Identifier' &&
          node.right.name === 'state'
        ) {
          context.report({
            node,
            messageId: 'noRawState',
          });
        }
      },
    };
  },
};
