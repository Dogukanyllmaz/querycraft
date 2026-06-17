'use strict';

const { FILTER_OPERATORS, SORT_DIRECTIONS, MAX_ROWS_PER_QUERY } = require('../config/constants');

function validateIdentifier(name) {
  // Allow: word chars only, or "table.column" qualified form
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(name)) {
    const err = new Error(`Invalid identifier: ${name}`);
    err.statusCode = 400;
    err.code = 'INVALID_IDENTIFIER';
    throw err;
  }
}

const JOIN_TYPES = { INNER: 'join', LEFT: 'leftJoin', RIGHT: 'rightJoin' };
const AGG_FNS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];

function buildQuery(k, config) {
  const { table, columns, filters = [], orderBy, limit = 1000, joins = [], aggregations = [] } = config;

  validateIdentifier(table);
  columns.forEach(validateIdentifier);

  const safeLimit = Math.min(parseInt(limit) || 1000, MAX_ROWS_PER_QUERY);

  let query;
  if (aggregations.length > 0) {
    // Validate aggregation definitions
    for (const agg of aggregations) {
      if (!AGG_FNS.includes(agg.fn)) {
        const err = new Error(`Invalid aggregation function: ${agg.fn}`);
        err.statusCode = 400; err.code = 'INVALID_AGG_FN';
        throw err;
      }
      validateIdentifier(agg.alias);
      if (agg.column !== '*') validateIdentifier(agg.column);
    }

    // GROUP BY selected columns + aggregate expressions
    if (columns.length > 0) {
      query = k(table).select(columns).groupBy(columns).limit(safeLimit);
    } else {
      query = k(table).limit(safeLimit);
    }
    for (const agg of aggregations) {
      const col = agg.column === '*' ? '*' : agg.column;
      const expr = `${col} as ${agg.alias}`;
      switch (agg.fn) {
        case 'COUNT': query = query.count(expr); break;
        case 'SUM':   query = query.sum(expr);   break;
        case 'AVG':   query = query.avg(expr);   break;
        case 'MIN':   query = query.min(expr);   break;
        case 'MAX':   query = query.max(expr);   break;
      }
    }
  } else {
    query = k(table).select(columns).limit(safeLimit);
  }

  for (const join of joins) {
    validateIdentifier(join.table);
    validateIdentifier(join.on.leftColumn);
    validateIdentifier(join.on.rightColumn);
    const joinFn = JOIN_TYPES[join.type] ?? 'join';
    query = query[joinFn](join.table, join.on.leftColumn, join.on.rightColumn);
  }

  for (const filter of filters) {
    validateIdentifier(filter.column);

    if (!FILTER_OPERATORS.includes(filter.operator)) {
      const err = new Error(`Invalid operator: ${filter.operator}`);
      err.statusCode = 400;
      err.code = 'INVALID_OPERATOR';
      throw err;
    }

    switch (filter.operator) {
      case 'IS NULL':
        query = query.whereNull(filter.column);
        break;
      case 'IS NOT NULL':
        query = query.whereNotNull(filter.column);
        break;
      case 'IN': {
        const vals = String(filter.value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
        if (vals.length === 0) break;
        query = query.whereIn(filter.column, vals);
        break;
      }
      case 'LIKE':
      case 'NOT LIKE':
        query = query.where(filter.column, filter.operator, `%${filter.value}%`);
        break;
      default:
        query = query.where(filter.column, filter.operator, filter.value);
    }
  }

  if (orderBy) {
    validateIdentifier(orderBy.column);
    const direction = SORT_DIRECTIONS.includes(orderBy.direction?.toUpperCase())
      ? orderBy.direction.toUpperCase()
      : 'ASC';
    query = query.orderBy(orderBy.column, direction);
  }

  return query;
}

module.exports = { buildQuery, validateIdentifier };
