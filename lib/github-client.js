'use strict'

const logger = require('bole')('github-client')
const querystring = require('querystring')
const fetch = require('node-fetch')

const headersSym = Symbol('headers')
const statusSym = Symbol('status')

module.exports = class Client {
  constructor ({url, token, defaults = {}, username = '(anon)'} = {}) {
    this.url = url
    this.token = token
    this.username = username
    this.defaults = defaults
  }

  async getOrgs () {
    return this.request('/user/orgs')
  }

  async getSelf () {
    return this.request('/user')
  }

  async search (terms = []) {
    return this.request('/search/code', {
      headers: {
        'accept': 'application/vnd.github.v3.text-match+json'
      }, 
      query: {
        q: [].concat(
          terms,
          this.defaults.orgs.map(xs => `org:${xs}`)
        ).join(' ')
      }
    })
  }

  async request (url, {headers = {}, query = {}} = {}) {
    const q = querystring.stringify(query)
    const response = await fetch(`${this.url}${url}${q ? '?' + q : ''}`, {
      headers: {
        authorization: `token ${this.token}`,
        'user-agent': `gsv cli (github search vehicle${this.username ? ', user=' + this.username : ''})`,
        ...headers
      }
    })

    if (response.status > 399) {
      throw Object.assign(new RangeError(
        `expected response.status to be <400, got ${response.status}`
      ), {
        status: response.status,
        body: await response.text()
      })
    }

    const results = await response.json()
    results[headersSym] = response.headers
    results[statusSym] = response.status
    const link = response.headers.get('link')

    if (link) {
      console.log(link)
    }

    return results
  }
}
