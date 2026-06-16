'use strict';

require('dotenv').config();
const path = require('path');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../../data/app.db');

module.exports = { DB_PATH };
