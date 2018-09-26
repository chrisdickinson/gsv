'use strict'

module.exports = setup

const inquirer = require('inquirer')
const toml = require('@iarna/toml')
const {promisify} = require('util')
const _open = require('opener')
const path = require('path')
const fs = require('fs')

const GitHubClient = require('./github-client')

const open = promisify(_open)

async function setup (url) {
  const {hasGitHubToken} = await inquirer.prompt({
    type: 'confirm',
    name: 'hasGitHubToken',
    message: 'Do you have a GitHub personal access token you would like to use?'
  })

  if (!hasGitHubToken) {
    console.log(`Opening GitHub.com. Please generate an access token and copy it into the following prompt.

We will request the following OAuth scopes (https://git.io/fAvkK):
- "read:user": to read your username.
- "read:org": to read the list of orgs that your user belongs to.
- "repo": to allow code search to find results from private packages.

Close the GitHub browser window after copying the token.\n`)
    await inquirer.prompt({
      prefix: '',
      type: 'input',
      message: '\rHit ENTER to continue.',
      name: 'nothing'
    })

    await open(
      `${url.replace('api.', '')}/settings/tokens/new?description=gsv+cli+code+search&scopes=read:org,read:user,repo`
    )
    await { then (r) { setTimeout(r, 1000) } }
  }

  const {token} = await inquirer.prompt({
    type: 'input',
    name: 'token',
    message: 'Please enter a GitHub personal access token:',
  })

  const unauthclient = new GitHubClient({token, url})
  const user = await unauthclient.getSelf().catch(err => {
    if (err.status === 401) {
      throw new Error('Error authenticating! Did you enter the token correctly?')
    }

    throw new Error(`Caught unexpected error talking to GitHub: ${err.body}`)
  })

  const client = new GitHubClient({token, url, username: user.login})

  console.log(`Successfully logged in as ${user.login}!`)

  const orgs = await client.getOrgs()


  const {selected} = await inquirer.prompt({
    type: 'checkbox',
    name: 'selected',
    message: 'Select all orgs you would like to search by default:',
    choices: orgs.map(xs => xs.login).sort()
  })

  const filename = path.join((
    process.platform === 'win32'
    ? process.env.USERPROFILE
    : process.env.HOME
  ), '.gsvrc')

  console.log(`Saving ${filename} in TOML format. To re-run this prompt, delete that file. Happy searching! <3`)

  fs.writeFileSync(filename, toml.stringify({
    url,
    defaults: {orgs: selected},
    username: user.login,
    token
  }))
}

// b0801548d19d2824362a2388c94037d63345f9e0
