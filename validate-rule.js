const Ajv = require('ajv').default;
const ajv = new Ajv();
const ruleSchema = require('./data/schemas/rule.schema.json');
const rule = require('./data/mods/containers/rules/handle_take_from_container.rule.json');

const valid = ajv.validate(ruleSchema, rule);
if (!valid) {
  console.log('INVALID RULE:');
  console.log(JSON.stringify(ajv.errors, null, 2));
  process.exit(1);
} else {
  console.log('Rule is VALID');
}
