import Knex from 'knex';
import config from './knexfile.js';

const environment = process.env.NODE_ENV ?? 'development';
const knexConfig = (config as Record<string, Knex.Knex.Config>)[environment];

const db = Knex(knexConfig);

export default db;
