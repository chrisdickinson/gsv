'use strict'

const parseLinkHeader = require('parse-link-header')
const logger = require('bole')('github-client')
const querystring = require('querystring')
const fetch = require('node-fetch')

const headersSym = Symbol('headers')
const statusSym = Symbol('status')
const linkSym = Symbol('link')

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
    const result = await this.request(`${this.url}/search/code`, {
      query: {
        q: [].concat(
          terms,
          this.defaults.orgs.map(xs => `org:${xs}`)
        ).join(' ')
      }
    })
    let links = result[linkSym]
    if (!links) return result
    do {
      const page = await this.request(links.next.url)
      result.items = result.items.concat(page.items)
      links = page[linkSym]
    } while (links.next)
    return result
  }

  async request (url, { headers = {}, query = {} } = {}) {
    const q = querystring.stringify(query)
    const finalUrl = `${url}${q ? '?' + q : ''}`
    const response = await fetch(finalUrl, {
      headers: {
        accept: 'application/vnd.github.v3.text-match+json',
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
    let link = response.headers.get('link')

    if (link) {
      results[linkSym] = parseLinkHeader(link)
    }

    return results
  }
}
