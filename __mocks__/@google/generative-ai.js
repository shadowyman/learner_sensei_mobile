class GoogleGenerativeAI {
  constructor() {
    this.apiKey = null
  }

  getGenerativeModel() {
    return {
      generateContent: async () => ({ response: { text: () => '' } }),
      generateContentStream: async () => ({ stream: [] })
    }
  }
}

module.exports = { GoogleGenerativeAI }

