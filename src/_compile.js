let { rmSync } = require('fs')
let { rm } = require('fs/promises')
let { spawn } = require('child_process')
let minimist = require('minimist')

async function compileProject ({ inventory }) {
  let { inv } = inventory
  let { build } = inv._project

  let start = Date.now()
  // It's ok to block Sandbox for this, we can't serve requests until it's done anyway
  rmSync(build, { recursive: true, force: true })

  let ok = true
  console.log(`Compiling Rust`)

  async function go (lambda) {
    if (lambda.config.runtime !== 'rust') return
    try {
      await compileHandler({ inventory, lambda })
    }
    catch (err) {
      ok = false
      console.log(`Rust compilation error:`, err)
    }
  }
  let compiles = Object.values(inv.lambdasBySrcDir).map(go)
  await Promise.allSettled(compiles)
  if (ok) console.log(`Compiled project in ${(Date.now() - start) / 1000}s`)
}

async function compileHandler (params) {
  let { inventory, lambda } = params
  let { deployStage: stage } = inventory.inv._arc
  let { arc } = inventory.inv._project
  let { build, src } = lambda
  stage = stage || 'testing'
  let arch = lambda.config.architecture === 'arm64' ? '--arm64' : ''

  let command = `cargo build --target-dir ${build}`
  if (stage !== 'testing') {
    command = `cargo lambda build --release${arch} --target-dir ${build}`
  }
  if (arc.rust) {
    let settings = Object.fromEntries(arc.rust)
    if (settings?.customCommand?.[stage]) {
      command = settings.customCommand[stage]
    }
  }

  console.log(`Compiling handler: @${lambda.pragma} ${lambda.name}`)
  let alias = {
    debug: [ 'd' ],
    verbose: [ 'v' ],
  }
  let args = minimist(process.argv.slice(2), { alias })
  let isVerbose = args.verbose || args.debug

  // Run the build
  await rm(build, { recursive: true, force: true })

  let cmdArgs = command.split(' ')
  let cmd = cmdArgs.shift()
  await new Promise((res, rej) => {
    let child = spawn(cmd, cmdArgs, {
      cwd: src,
      shell: true,
    })
    let buf = []
    child.stdout.on('data', data => {
      buf.push(data)
      if (isVerbose) process.stdout.write(data)
    })
    child.stderr.on('data', data => {
      buf.push(data)
      if (isVerbose) process.stderr.write(data)
    })
    child.on('error', rej)
    child.on('close', res)
  })
}

module.exports = {
  compileHandler,
  compileProject,
}
