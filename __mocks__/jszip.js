class JSZip {
  constructor() {
    this._files = new Map()
  }

  file(name, content) {
    this._files.set(name, content)
    return this
  }

  async generateAsync() {
    return new Blob([])
  }
}

module.exports = JSZip
module.exports.default = JSZip

