let { join } = require('path')
let {
  compileProject,
  compileHandler,
} = require('./_compile')

let architectures = {
  x86_64: 'x86_64-unknown-linux-gnu',
  arm64: 'aarch64-unknown-linux-gnu',
}

module.exports = {
  set: {
    runtimes: function ({ inventory }) {
      let { _arc, _project, aws } = inventory.inv
      let { deployStage } = _arc
      let { arc } = _project

      let build = '.build'
      if (arc.rust) {
        let settings = Object.fromEntries(arc.rust)
        if (settings.build && typeof settings.build === 'string') {
          build = settings.build
        }
      }

      // The Rust Runtime for AWS Lambda defaults to X86; although arm64 is the better option, it is still not available in all default regions
      let architecture = 'x86_64'
      if (Object.keys(architectures).includes(aws.architecture)) {
        architecture = aws.architecture
      }

      let buildSubpath = deployStage ? join(architectures[architecture], 'release') : 'debug'
      return {
        name: 'rust',
        type: 'compiled',
        build,
        buildSubpath,
        baseRuntime: 'provided.al2',
      }
    }
  },
  deploy: {
    start: compileProject
  },
  sandbox: {
    start: compileProject,
    watcher: async function (params) {
      let { filename, /* event, */ inventory } = params
      if (filename.endsWith('.rs')) {
        let { lambdasBySrcDir } = inventory.inv

        // Second pass filter by Lambda dir
        let lambda = Object.values(lambdasBySrcDir).find(({ src }) => filename.startsWith(src))

        if (!lambda) { return }

        let start = Date.now()
        let { name, pragma } = lambda
        console.log(`Recompiling handler: @${pragma} ${name}`)
        try {
          await compileHandler({ inventory, lambda })
          console.log(`Compiled in ${(Date.now() - start) / 1000}s\n`)
        }
        catch (err) {
          console.log('Rust compilation error:', err)
        }
      }
    }
  },
}
