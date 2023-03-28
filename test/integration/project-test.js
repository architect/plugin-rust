let { join } = require('path')
let { rmSync } = require('fs')
let test = require('tape')
let { get } = require('tiny-json-http')
let sandbox = require('@architect/sandbox')

let port = 6666
let mock = join(process.cwd(), 'test', 'mock')
let cwd, build
let url = path => `http://localhost:${port}/${path}`

function reset () {
  rmSync(build, { recursive: true, force: true })
}

/**
 * Ideally these tests would also exercise the watcher method
 * However, running / terminating the Sandbox in a child process is a bit onerous so let's consider it a TODO
 */
test('Start Sandbox (default project)', async t => {
  t.plan(1)
  cwd = join(mock)
  build = join(cwd, '.build')
  reset()
  await sandbox.start({ cwd, port, quiet: true })
  t.pass('Started Sandbox')
})

test('Handlers compiled', async t => {
  t.plan(3)
  let result
  result = await get({ url: url('ok') })
  t.deepEqual(result.body, { ok: true }, 'Compiled handler returned correct body')
  try {
    result = await get({ url: url('fail') })
    t.fail('Expected an error')
  }
  catch (err) {
    t.match(err.body, /oh noes/, 'Compiled handler returned an error')
    t.equal(err.statusCode, 500, 'Error is 500')
  }
})

test('Shut down Sandbox', async t => {
  t.plan(1)
  await sandbox.end()
  reset()
  t.pass('Shut down Sandbox')
})
