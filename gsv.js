#!/usr/bin/env node
'use strict'

const toml = require('@iarna/toml')
const rc = require('rc')

const config = rc('gsv', {
  url: 'https://api.github.com'
}, [], xs => toml.parse(xs))

if (!config.token) {
  const setup = require('./lib/setup.js')

  return setup(config.url).catch(err => {
    process.stderr.write(err.message)
    process.exit(1)
  })
}

const GitHubClient = require('./lib/github-client')

require('./lib/search')({
  argv: process.argv.slice(2),
  client: new GitHubClient({
    url: config.url,
    defaults: config.defaults,
    username: config.username,
    token: config.token
  })
}).catch(err => {
  process.stderr.write(err.stack)
  process.stderr.write(err.body)
  process.exit(1)
})
