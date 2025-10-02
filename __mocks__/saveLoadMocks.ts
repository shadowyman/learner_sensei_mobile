/* eslint-disable no-unused-vars */
/* global Blob, FileReader, ProgressEvent, HTMLAnchorElement, document, Node, URL, window, setTimeout */

import { jest } from '@jest/globals'
import type { SpyInstance } from 'jest-mock'

type PendingRead = {
  reader: TestFileReader
}

type QueuedAction =
  | { kind: 'resolve'; data: string }
  | { kind: 'reject'; error: unknown }

type FileReaderHandler = (event: ProgressEvent<FileReader>) => unknown

class TestFileReader {
  result: string | null = null
  onload: FileReaderHandler | null = null
  onerror: FileReaderHandler | null = null
  readAsText(): void {
    pendingReads.push({ reader: this })
    flushQueue()
  }
}

const pendingReads: PendingRead[] = []
const queuedActions: QueuedAction[] = []

function flushQueue(): void {
  while (pendingReads.length > 0 && queuedActions.length > 0) {
    const pending = pendingReads.shift()!
    const action = queuedActions.shift()!
    if (action.kind === 'resolve') {
      globalThis.setTimeout(() => {
        pending.reader.result = action.data
        const loadEvent = { target: pending.reader } as unknown as ProgressEvent<FileReader>
        pending.reader.onload?.(loadEvent)
      }, 0)
    } else {
      globalThis.setTimeout(() => {
        pending.reader.result = null
        ;(pending.reader as any).error = action.error
        const errorEvent = { target: pending.reader, error: action.error } as unknown as ProgressEvent<FileReader>
        pending.reader.onerror?.(errorEvent)
      }, 0)
    }
  }
}

export interface FileReaderController {
  resolveNext(data: string): void
  rejectNext(error: unknown): void
  pendingCount(): number
  restore(): void
}

export function installFileReaderMock(): FileReaderController {
  const original = (globalThis as any).FileReader
  ;(globalThis as any).FileReader = TestFileReader as unknown as typeof FileReader
  const resolveNext = (data: string) => {
    queuedActions.push({ kind: 'resolve', data })
    flushQueue()
  }
const rejectNext = (error: unknown) => {
    queuedActions.push({ kind: 'reject', error })
    flushQueue()
  }
  const restore = () => {
    pendingReads.length = 0
    queuedActions.length = 0
    ;(globalThis as any).FileReader = original
  }
  return {
    resolveNext,
    rejectNext,
    pendingCount: () => pendingReads.length,
    restore
  }
}

export type AnchorController = {
  anchors: HTMLAnchorElement[]
  restore: () => void
}

export function installAnchorMock(): AnchorController {
  const anchors: HTMLAnchorElement[] = []
  const originalCreateElement = document.createElement.bind(document)
  const spy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName.toLowerCase() === 'a') {
      const anchor = originalCreateElement('a') as HTMLAnchorElement
      anchor.click = jest.fn()
      anchors.push(anchor)
      return anchor
    }
    return originalCreateElement(tagName)
  })
  return {
    anchors,
    restore: () => {
      spy.mockRestore()
      anchors.length = 0
    }
  }
}

export type DownloadSpies = {
  createObjectURL: SpyInstance<(...args: any[]) => string>
  revokeObjectURL: SpyInstance<(...args: any[]) => void>
  appendChild: SpyInstance<(...args: any[]) => Node>
  removeChild: SpyInstance<(...args: any[]) => Node>
  restore: () => void
}

export function installDownloadSpies(): DownloadSpies {
  const originalCreate = (URL as unknown as Record<string, unknown>).createObjectURL as ((blob: Blob) => string) | undefined
  const originalRevoke = (URL as unknown as Record<string, unknown>).revokeObjectURL as ((url: string) => void) | undefined
  let createdCreate = false
  let createdRevoke = false
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as Record<string, unknown>).createObjectURL = () => 'blob:stub'
    createdCreate = true
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    (URL as unknown as Record<string, unknown>).revokeObjectURL = () => {}
    createdRevoke = true
  }
  const createObjectURL = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
  const revokeObjectURL = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const appendChild = jest.spyOn(document.body, 'appendChild')
  const removeChild = jest.spyOn(document.body, 'removeChild')
  return {
    createObjectURL,
    revokeObjectURL,
    appendChild,
    removeChild,
    restore: () => {
      createObjectURL.mockRestore()
      revokeObjectURL.mockRestore()
      appendChild.mockRestore()
      removeChild.mockRestore()
      if (createdCreate) {
        if (originalCreate) {
          (URL as unknown as Record<string, unknown>).createObjectURL = originalCreate
        } else {
          delete (URL as unknown as Record<string, unknown>).createObjectURL
        }
      }
      if (createdRevoke) {
        if (originalRevoke) {
          (URL as unknown as Record<string, unknown>).revokeObjectURL = originalRevoke
        } else {
          delete (URL as unknown as Record<string, unknown>).revokeObjectURL
        }
      }
    }
  }
}

export type WindowAIController = {
  createChat: jest.Mock
  resetHistory: () => void
  restore: () => void
}

export function installWindowAIMock(): WindowAIController {
  const w = window as any
  const original = w.ai
  const createChat = jest.fn(({ history, config }: any) => ({ history, config }))
  w.ai = {
    chats: {
      create: createChat
    }
  }
  return {
    createChat,
    resetHistory: () => {
      createChat.mockClear()
    },
    restore: () => {
      w.ai = original
    }
  }
}

export type NavigatorController = {
  restore: () => void
}

export function overrideUserAgent(value: string): NavigatorController {
  const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent')
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value
  })
  return {
    restore: () => {
      if (descriptor) {
        Object.defineProperty(window.navigator, 'userAgent', descriptor)
      }
    }
  }
}

export function flushTimers(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}
