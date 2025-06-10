// load the .env.development file ; it loads a bunch of environment variables
// we are not doing this for production, where the variables are coming from the actual environment
// so this is dev only.... it must be done before any other import
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV !== 'production' || process.env.FORCE_DOTENV==1 || process.env.FORCE_DOTENV=="1" ){
  console.log(`Importing .env file : ${__dirname}/../.env.${process.env.NODE_ENV}` )
  dotenv.config({ path: `${__dirname}/../.env.${process.env.NODE_ENV}` })
}else{
  console.log(`Not importing .env file, running in production mode` )
}