import { buildRecentConversationHistory } from '../src/conversationHistory'

describe('conversation history builder', () => {
  test('uses DOM chat order and excludes the current user input', () => {
    const messageArea = document.createElement('div')
    messageArea.innerHTML = `
      <div id="msg-1" class="message-bubble" data-sender="sensei"><div class="message-text">Welcome intro.</div></div>
      <div id="msg-2" class="message-bubble" data-sender="user"><div class="message-text">What is decomposition?</div></div>
      <div id="msg-3" class="message-bubble" data-sender="sensei"><div class="message-text">Break the problem into smaller parts.</div></div>
      <div id="msg-4" class="message-bubble" data-sender="user"><div class="message-text">I still do not get it.</div></div>
    `

    expect(buildRecentConversationHistory({
      currentUserInput: 'I still do not get it.',
      userInputHistory: ['What is decomposition?', 'I still do not get it.'],
      lastSenseiResponses: ['Break the problem into smaller parts.', 'Welcome intro.'],
      messageArea,
      streamingMessagesRawText: new Map([['msg-3', 'Break the problem into smaller parts.']])
    })).toEqual([
      { role: 'sensei', content: 'Welcome intro.' },
      { role: 'user', content: 'What is decomposition?' },
      { role: 'sensei', content: 'Break the problem into smaller parts.' }
    ])
  })

  test('falls back to oldest-to-newest array history when DOM extraction is unavailable', () => {
    expect(buildRecentConversationHistory({
      currentUserInput: 'Current follow up',
      userInputHistory: ['Prior question', 'Current follow up'],
      lastSenseiResponses: ['Prior answer', 'Module intro']
    })).toEqual([
      { role: 'sensei', content: 'Module intro' },
      { role: 'user', content: 'Prior question' },
      { role: 'sensei', content: 'Prior answer' }
    ])
  })

  test('ignores transient phase selection and loading bubbles in DOM history', () => {
    const messageArea = document.createElement('div')
    messageArea.innerHTML = `
      <div id="msg-1" class="message-bubble" data-sender="sensei"><div class="message-text">Module intro.</div></div>
      <div id="msg-2" class="message-bubble" data-sender="sensei"><div class="message-text">Where would you like to begin?<div class="phase-buttons-container"><button>Teaching</button><button>Exploration</button><button>Wrap Up</button></div></div></div>
      <div id="msg-3" class="message-bubble" data-sender="sensei"><div class="message-text"><div class="phase-loading-container">Sensei is generating a teaching plan</div></div></div>
      <div id="msg-4" class="message-bubble" data-sender="user"><div class="message-text">I want to explore.</div></div>
      <div id="msg-5" class="message-bubble" data-sender="sensei"><div class="message-text">Let's use questions.</div></div>
    `

    expect(buildRecentConversationHistory({
      currentUserInput: '',
      userInputHistory: ['I want to explore.'],
      lastSenseiResponses: ["Let's use questions.", 'Module intro.'],
      messageArea
    })).toEqual([
      { role: 'sensei', content: 'Module intro.' },
      { role: 'user', content: 'I want to explore.' },
      { role: 'sensei', content: "Let's use questions." }
    ])
  })
})
