'use strict';

const SUPPORTED_DB_TYPES = ['mysql', 'postgresql', 'sqlserver'];

const MAX_ROWS_PER_QUERY = 10000;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;
const PREVIEW_ROW_LIMIT = 50;

const FILTER_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IN', 'IS NULL', 'IS NOT NULL'];

const SORT_DIRECTIONS = ['ASC', 'DESC'];

module.exports = {
  SUPPORTED_DB_TYPES,
  MAX_ROWS_PER_QUERY,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PREVIEW_ROW_LIMIT,
  FILTER_OPERATORS,
  SORT_DIRECTIONS,
};
