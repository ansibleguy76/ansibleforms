const { resolve } = require('path')
const history = require('connect-history-api-fallback')
const express = require('express')
if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` })
}
const logger = require('./src/lib/logger');
const configureAPI = require('./src/configure')
const app = express()

const { PORT = 3000 } = process.env

// API
configureAPI(app)

// UI
const publicPath = resolve(__dirname, './views')
const staticConf = { maxAge: '1y', etag: false }

app.use(express.static(publicPath, staticConf))
app.use('/', history())

// Go
app.listen(PORT, () => logger.info(`App running on port ${PORT}!`))
