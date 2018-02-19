'use strict'

const upload = require('bugsnag-sourcemaps').upload
const join = require('path').join
const parallel = require('run-parallel-limit')

const LOG_PREFIX = `[BugsnagSourceMapUploaderPlugin]`
const PUBLIC_PATH_ERR =
  'Cannot determine "minifiedUrl" argument for bugsnag-sourcemaps. ' +
  'Please set "publicPath" in Webpack config ("output" section) ' +
  'or set "publicPath" in BugsnagSourceMapUploaderPlugin constructor.'

class BugsnagSourceMapUploaderPlugin {
  constructor (options) {
    this.apiKey = options.apiKey
    this.publicPath = options.publicPath
    this.appVersion = options.appVersion
    this.overwrite = options.overwrite
    this.endpoint = options.endpoint
  }

  apply (compiler) {
    compiler.plugin('after-emit', (compilation, cb) => {
      const stats = compilation.getStats().toJson()
      const publicPath = this.publicPath || stats.publicPath

      if (!publicPath) {
        console.warn(`${LOG_PREFIX} ${PUBLIC_PATH_ERR}`)
        return cb()
      }

      const chunkToSourceMapDescriptor = chunk => {
        // find a .map file in this chunk
        const map = chunk.files.find(file => /.+\.map(\?.*)?$/.test(file))

        // find a corresponding source file in the chunk
        const source = chunk.files.find(file => file === map.replace('.map', ''))

        if (!source || !map) {
          console.warn(`${LOG_PREFIX} no source/map pair found for chunk "${chunk.name}"`)
          return cb()
        }

        return {
          source: compilation.assets[source].existsAt,
          map: compilation.assets[map].existsAt,
          url: join(publicPath, source)
        }
      }

      const sourceMaps = stats.chunks.map(chunkToSourceMapDescriptor)
      parallel(sourceMaps.map(sm => cb => {
        console.log(`${LOG_PREFIX} uploading sourcemap for "${sm.url}"`)
        upload(this.getUploadOpts(sm), cb)
      }), 10, cb)
    })
  }

  getUploadOpts (sm) {
    const opts = {
      apiKey: this.apiKey,
      appVersion: this.appVersion,
      minifiedUrl: sm.url,
      minifiedFile: sm.source,
      sourceMap: sm.map
    }
    if (this.endpoint) opts.endpoint = this.endpoint
    if (this.overwrite) opts.overwrite = this.overwrite
    return opts
  }
}

module.exports = BugsnagSourceMapUploaderPlugin
