'use strict';
import { evalSandbox } from './formEngine/node/sandbox.js';

/**
 * The `services` the form engine (formEngine/resolve.js) calls out to, bound to one user and
 * one form : server expressions, the form's own queries (resolved through the query policy,
 * so a caller can never choose the SQL) and the node sandbox for runLocal.
 *
 * Shared by the MCP tools and the launch validation, so both evaluate a form exactly the way
 * the browser's /api/v2/expression and /api/v2/query calls would for that user.
 *
 * @param {object} args
 * @param {object} args.user          req.user.user
 * @param {object} args.formConfig    Form.load(roles, name)
 * @param {object} args.formObj       formConfig.forms[0]
 * @param {string} [args.subformName]
 * @param {object} args.deps          { Expression, Query, resolveFormQuery }
 */
export function createFormServices({ user, formConfig, formObj, subformName, deps }) {
  const { Expression, Query, resolveFormQuery } = deps;
  return {
    evalSandbox,
    serverExpression: (expression, field) => Expression.execute(expression, !!field.noLog),
    query: async (field, resolved) => {
      const q = await resolveFormQuery({
        user,
        formName: formObj.name,
        subformName,
        fieldName: field.name,
        values: resolved,
        formConfig,
      });
      return Query.findAll(q.query, q.jq, q.config, !!field.noLog, q.values);
    },
  };
}

export default { createFormServices };
