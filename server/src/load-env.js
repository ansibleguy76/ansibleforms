// load the .env.development file ; it loads a bunch of environment variables
// we are not doing this for production, where the variables are coming from the actual environment
// so this is dev only.... it must be done before any other import
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The settings page writes persistent/.env, so it must be loaded in production too -
// that file is the only store that can hold DB_HOST and friends, which are needed before
// any database is reachable. Loaded FIRST so a real environment variable still wins:
// dotenv never overwrites a variable that is already set.
const managedEnv = process.env.MANAGED_ENV_PATH || `${__dirname}/../persistent/.env`;
if (existsSync(managedEnv)) {
  console.log(`Importing managed env file : ${managedEnv}`);
  dotenv.config({ path: managedEnv });
}

if (process.env.NODE_ENV !== 'production' || process.env.FORCE_DOTENV==1 || process.env.FORCE_DOTENV=="1" ){
  console.log(`Importing .env file : ${__dirname}/../.env.${process.env.NODE_ENV}` )
  dotenv.config({ path: `${__dirname}/../.env.${process.env.NODE_ENV}` })
}else{
  console.log(`Not importing .env file, running in production mode` )
}