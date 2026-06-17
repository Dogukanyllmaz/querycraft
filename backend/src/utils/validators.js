'use strict';

const Joi = require('joi');

const signupSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const connectionSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  connection_type: Joi.string().valid('mysql', 'postgresql', 'sqlserver').required(),
  host: Joi.string().min(1).max(255).required(),
  port: Joi.number().integer().min(1).max(65535).required(),
  database: Joi.string().min(1).max(255).required(),
  username: Joi.string().min(1).max(255).required(),
  password: Joi.string().min(1).max(500).required(),
});

const reportSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  connection_id: Joi.string().uuid().required(),
  config: Joi.object({
    table: Joi.string().min(1).required(),
    columns: Joi.array().items(Joi.string()).default([]),
    filters: Joi.array().items(
      Joi.object({
        column: Joi.string().required(),
        operator: Joi.string().valid('=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL', 'IN').required(),
        value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.allow(null)),
      })
    ).default([]),
    orderBy: Joi.object({
      column: Joi.string().required(),
      direction: Joi.string().valid('ASC', 'DESC').default('ASC'),
    }).optional(),
    limit: Joi.number().integer().min(1).max(10000).default(1000),
    joins: Joi.array().items(
      Joi.object({
        table: Joi.string().min(1).required(),
        type: Joi.string().valid('INNER', 'LEFT', 'RIGHT').required(),
        on: Joi.object({
          leftColumn: Joi.string().required(),
          rightColumn: Joi.string().required(),
        }).required(),
      })
    ).default([]),
    chart: Joi.object({
      type: Joi.string().valid('bar', 'line', 'area', 'pie').required(),
      xAxis: Joi.string().min(1).required(),
      yAxis: Joi.string().min(1).required(),
    }).optional(),
    aggregations: Joi.array().items(
      Joi.object({
        fn: Joi.string().valid('COUNT', 'SUM', 'AVG', 'MIN', 'MAX').required(),
        column: Joi.string().min(1).required(),
        alias: Joi.string().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).required(),
      })
    ).default([]),
  }).required(),
});

module.exports = { signupSchema, loginSchema, connectionSchema, reportSchema };
