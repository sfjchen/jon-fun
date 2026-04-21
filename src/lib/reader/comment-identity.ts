'use client'

import { v4 as uuidv4 } from 'uuid'

const FP_KEY = 'reader-comment-fingerprint-v1'
const NAME_KEY = 'reader-comment-display-name-v1'

export type ReaderCommentIdentity = {
  fingerprint: string
  displayName: string
}

export function getReaderCommentFingerprint(): string {
  if (typeof window === 'undefined') return ''
  let fp = window.localStorage.getItem(FP_KEY)
  if (!fp) {
    fp = uuidv4()
    window.localStorage.setItem(FP_KEY, fp)
  }
  return fp
}

export function getReaderCommentDisplayName(): string {
  if (typeof window === 'undefined') return 'Reader'
  return window.localStorage.getItem(NAME_KEY) ?? 'Reader'
}

export function setReaderCommentDisplayName(name: string): void {
  if (typeof window === 'undefined') return
  const t = name.trim().slice(0, 64)
  if (t) window.localStorage.setItem(NAME_KEY, t)
  else window.localStorage.removeItem(NAME_KEY)
}

export function getReaderCommentIdentity(): ReaderCommentIdentity {
  return {
    fingerprint: getReaderCommentFingerprint(),
    displayName: getReaderCommentDisplayName(),
  }
}
