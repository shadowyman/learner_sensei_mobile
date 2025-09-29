import { TextDecoder, TextEncoder } from 'node:util'
import { webcrypto, randomUUID } from 'node:crypto'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'

const globalAny = globalThis as Record<string, any>
const windowRef = globalAny.window ?? globalAny

if (!globalAny.TextEncoder) {
  globalAny.TextEncoder = TextEncoder
}

if (!globalAny.TextDecoder) {
  globalAny.TextDecoder = TextDecoder
}

if (!globalAny.crypto) {
  globalAny.crypto = webcrypto
}

if (!globalAny.crypto.randomUUID) {
  globalAny.crypto.randomUUID = () => {
    if (typeof webcrypto.randomUUID === 'function') {
      return webcrypto.randomUUID()
    }
    return randomUUID()
  }
}

if (!globalAny.DOMRect) {
  globalAny.DOMRect = class {
    x: number
    y: number
    width: number
    height: number
    top: number
    right: number
    bottom: number
    left: number
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x
      this.y = y
      this.width = width
      this.height = height
      this.top = y
      this.left = x
      this.right = x + width
      this.bottom = y + height
    }
    toJSON() {
      return {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        top: this.top,
        right: this.right,
        bottom: this.bottom,
        left: this.left
      }
    }
  }
}

if (!globalAny.ResizeObserver) {
  globalAny.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!globalAny.IntersectionObserver) {
  globalAny.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

if (!windowRef.matchMedia) {
  windowRef.matchMedia = (query: string) => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      }
    }
  }
}

const elementPrototype = windowRef.HTMLElement?.prototype ?? windowRef.Element?.prototype
if (elementPrototype && !elementPrototype.scrollIntoView) {
  elementPrototype.scrollIntoView = function () {}
}

const createStorage = () => {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    }
  }
}

if (!windowRef.localStorage) {
  windowRef.localStorage = createStorage()
}

if (!windowRef.sessionStorage) {
  windowRef.sessionStorage = createStorage()
}

const resolvedBlob = typeof globalAny.Blob === 'function' ? globalAny.Blob : NodeBlob
if (!globalAny.Blob) {
  globalAny.Blob = resolvedBlob
}

const fallbackFile = typeof NodeFile === 'function' ? NodeFile : class extends resolvedBlob {
  name: string
  lastModified: number
  constructor(parts: BlobPart[], name: string, options: FilePropertyBag = {}) {
    super(parts, options)
    this.name = name
    this.lastModified = options.lastModified ?? Date.now()
  }
}

if (!globalAny.File) {
  globalAny.File = fallbackFile
}

if (!windowRef.ai) {
  windowRef.ai = {
    canCreateTextSession: async () => false,
    createTextSession: async () => ({
      prompt: async () => ({ response: '' }),
      close: async () => {}
    })
  }
}

if (!windowRef.hljs) {
  windowRef.hljs = {
    highlightAuto: (value: string) => ({ value })
  }
}

if (!windowRef.anime) {
  windowRef.anime = () => ({
    finished: Promise.resolve(),
    pause() {},
    play() {},
    restart() {}
  })
}

if (!globalAny.createTestBlob) {
  globalAny.createTestBlob = (content: BlobPart[], type = 'application/octet-stream') => {
    return new globalAny.Blob(content, { type })
  }
}

if (!globalAny.createTestFile) {
  globalAny.createTestFile = (name: string, content: BlobPart[], type = 'application/octet-stream') => {
    return new globalAny.File(content, name, { type })
  }
}

if (!globalAny.PointerEvent) {
  class PointerEventShim extends MouseEvent {
    constructor(type: string, eventInitDict?: MouseEventInit) {
      super(type, eventInitDict)
    }
  }
  globalAny.PointerEvent = PointerEventShim
}
