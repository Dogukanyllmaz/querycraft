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

function buildQuery(k, config) {
  const { table, columns, filters = [], orderBy, limit = 1000, joins = [] } = config;

  validateIdentifier(table);
  columns.forEach(validateIdentifier);

  const safeLimit = Math.min(parseInt(limit) || 1000, MAX_ROWS_PER_QUERY);

  let query = k(table).select(columns).limit(safeLimit);

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
