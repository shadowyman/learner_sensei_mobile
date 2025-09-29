const proxy = new Proxy({}, {
  get: () => ''
})

module.exports = proxy
module.exports.default = proxy
