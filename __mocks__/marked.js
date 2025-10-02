const render = (input) => `<p>${input.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`

function marked(input) {
  return render(input)
}

marked.parse = (input) => render(input)

module.exports = { marked }
