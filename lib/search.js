'use strict'

module.exports = search

const minimist = require('minimist')
const ora = require('ora')
const chalk = require('chalk')

const messages = [
  '🦑 Reticulating splines...',
  '💥 Collecting entropy...',
  '👀 Building BSP viz tree...',
  '🌉 Relocating to San Francisco...',
  '📄 Collating theorems...',
  '💻 Building expert system...',
  '⚗️  Simming outcomes...'
]
async function search ({ argv = [], client = null } = {}) {
  const args = minimist(argv)
  const term = args._[0]
  let idx = Math.floor(Math.random() * messages.length)
  const spinner = ora(messages[idx]).start()
  const ival = setInterval(() => {
    idx = (idx + 1) % messages.length
    spinner.text = messages[idx]
  }, 166)
  const results = await client.search(args._)
  clearInterval(ival)
  spinner.stop()

  for (const result of results.items) {
    const repo = result.repository.full_name
    const path = result.path
    const sha = result.sha

    console.log(`${chalk.green(repo)} ${chalk.magenta(path)} (${chalk.blue(sha)}):`)
    if (args.l) continue
    for (const match of result.text_matches) {
      const fragment = match.fragment
      console.log(fragment
        .split('\n')
        .map(line => chalk.grey('... ') + line.split(RegExp(term, 'i')).join(chalk.yellow(term)))
        .join('\n'))
    }
  }
}
