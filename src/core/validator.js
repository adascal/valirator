import { getRule } from './rules';
import { isFunction, isObject, isArray, noop, getObjectOverride, formatMessage } from './utils';

export async function validateRule(rule, expected, value, message, rules, messages, property, obj, schema) {
  const {
    check: defaultRule,
    message: defaultMessage
  } = getRule(rule);

  const overriddenRule = rules && (getObjectOverride(rules, rule) || rules[rule]);
  const overriddenMessage = messages && (getObjectOverride(messages, rule) || messages[rule]);

  const isValid = await (isFunction(overriddenRule) ? overriddenRule : (defaultRule || noop))(value, expected, property, obj, schema, defaultRule);

  if (isValid !== true) {
    return await formatMessage(overriddenMessage || message || defaultMessage, value, expected, property, obj, rule);
  }
}

export async function validateValue(value, rules = {}, messages = {}, property, obj, schema) {
  let errors = {};

  for (const rule in rules) {
    if (rules.hasOwnProperty(rule)) {
      const expected = rules[rule];
      const message = messages[rule];

      const result = await validateRule(rule, expected, value, message, rules, messages, property, obj, schema);

      if (result) {
        errors[rule] = result;
      }
    }
  }

  return new ValidationResult(errors);
}

export async function validateProperty(property, obj, properties = {}, rules = {}, messages = {}) {
  const {
    rules: propertyRules = {},
    messages: propertyMessages = {},
    properties: propertyProperties
  } = properties[property];

  propertyRules.__proto__ = rules;
  propertyMessages.__proto__ = messages;

  const value = obj[property];

  if (propertyProperties) {
    if (isArray(value)) {
      return await validateArray(value, propertyProperties, rules, messages);
    } else if (isObject(value)) {
      return await validateObject(value, propertyProperties, rules, messages);
    }
  } else {
    return validateValue(value, propertyRules, propertyMessages, property, obj, properties)
  }
}

export async function validateArray(array, properties, rules = {}, messages = {}) {
  let errors = {};
  const ln = array.length;

  for (let i = 0; i < ln; i++) {
    errors[i] = await validateObject(array[i], properties, rules, messages);
  }

  return new ValidationResult(errors);
}

export async function validateObject(obj, properties, rules = {}, messages = {}) {
  let errors = {};

  for (const property in properties) {
    if (properties.hasOwnProperty(property)) {
      errors[property] = await validateProperty(property, obj, properties, rules, messages);
    }
  }

  return new ValidationResult(errors);
}

export async function validate(schema, obj) {
  const {
    rules,
    messages,
    properties,
  } = schema;

  return await validateObject(obj, properties || schema, rules, messages);
}

export class ValidationResult {
  constructor(errors) {
    return {
      ...this,
      ...errors,
      hasErrors() {
        return Object
          .keys(errors)
          .some(key => {
            if (errors[key].hasErrors) {
              return errors[key].hasErrors();
            }

            return errors[key];
          });
      },
      isValid() {
        return !this.hasErrors();
      },
      hasErrorsOfTypes(...types) {
        return Object
          .keys(errors)
          .some(key => {
            if (errors[key].hasErrorsOfTypes) {
              return errors[key].hasErrorsOfTypes(...types);
            }

            return types.includes(key);
          });
      },
      getErrorsAsArray(...exclude) {
        return Object
          .keys(errors)
          .filter(key => !exclude.includes(key))
          .map(key => errors[key]);
      },
      getFirstError(...exclude) {
        return this.getErrorsAsArray(exclude)[0];
      }
    };
  }
}

export class ValidationSchema {
  constructor(schema) {
    this.validate = validate.bind(this, schema);
  }
}
