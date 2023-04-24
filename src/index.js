let { join, parse } = require('path')
let { execSync } = require('child_process')
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
      }
    }
  },
  create: {
    handlers: async (params) => {
      let { pragma, src } = params.lambda
      // `cargo lambda new` insists on creating its own directory, so work from its parent dir
      let { dir: cwd, name } = parse(src)

      let eventTypes = {
        http: 'apigw_http',
        ws: 'apigw_websockets',
        events: 'sns::SnsEvent',
        queues: 'sqs::SqsEvent',
        scheduled: 'cloudwatch_events::CloudWatchEvent',
        'tables-streams': 'dynamodb::Event',
      }

      let typeFlags = ' --event-type '
      if ([ 'http', 'ws' ].includes(pragma)) {
        typeFlags = ` --http --http-feature `
      }

      let cmd = `cargo lambda new` +           // Creates new Lambda
              typeFlags + eventTypes[pragma] + // Flags + event types defined above
              ` --bin-name bootstrap ` +       // Specifies 'bootstrap' as the output bin
              ` --no-interactive ${name}`
      execSync(cmd, { cwd })
    },
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
