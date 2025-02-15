import type {
  Slot,
  VNode,
} from 'vue'
import { capitalize } from 'lodash-es'
import {
  Comment,
  Text,
} from 'vue'

const NumberFormat = new Intl.NumberFormat('en-PK')
export const numberFormat = (value: number) => NumberFormat.format(value)
export function noop() {
  return null
}

export const isChrome = navigator.userAgent.includes('Chrome')

export function getComponentName(url: string) {
  const parser = document.createElement('a')
  const searchObject: Record<string, any> = {}
  let queries: string[] = []
  let split: string[] = []
  let i = 0
  // Let the browser do the work
  parser.href = url
  // Convert query string to object
  queries = parser.search.replace(/^\?/, '').split('&')
  for (; i < queries.length; i++) {
    split = queries[i].split('=')
    searchObject[split[0]] = split[1]
  }

  return `${capitalize(parser.pathname.split('/').filter(r => !!r).join(' ') || 'Data')}...`
}

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function getSlotText(slot: any) {
  if (!slot) {
    return ''
  }

  const children = slot()

  // return slots.default?.children?.map((vnode: any) => (vnode.text || vnode.elm.innerText)).join('') ?? ''
  return children.map((node: any) => {
    if (!node.children || typeof node.children === 'string') {
      return node.children || ''
    }
    else if (Array.isArray(node.children)) {
      return getSlotText(node.children)
    }
    else if (node.children.default) {
      return getSlotText(node.children.default())
    }
    else {
      return ['']
    }
  }).join('')
}

export function hasSlotContent(slot?: Slot, slotProps = {}) {
  if (!slot) {
    return false
  }

  return slot(slotProps).some((vnode: VNode) => {
    if (vnode.type === Comment) {
      return false
    }

    if (Array.isArray(vnode.children) && !vnode.children.length) {
      return false
    }

    return (
      vnode.type !== Text
      || (typeof vnode.children === 'string' && vnode.children.trim() !== '')
    )
  })
}

export function guid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
export function globToRegex(glob: string): RegExp {
  const escapedChars = new Set([
    '$',
    '^',
    '+',
    '.',
    '*',
    '(',
    ')',
    '|',
    '\\',
    '?',
    '{',
    '}',
    '[',
    ']',
  ])

  const tokens = ['^']
  let inGroup = false

  for (let i = 0; i < glob.length; ++i) {
    const c = glob[i]

    if (c === '\\' && i + 1 < glob.length) {
      const char = glob[++i]
      tokens.push(escapedChars.has(char) ? `\\${char}` : char)
      continue
    }

    if (c === '*') {
      const beforeDeep = glob[i - 1]
      let starCount = 1

      while (glob[i + 1] === '*') {
        starCount++
        i++
      }

      const afterDeep = glob[i + 1]

      const isDeep = starCount > 1
        && (beforeDeep === '/' || beforeDeep === undefined)
        && (afterDeep === '/' || afterDeep === undefined)

      if (isDeep) {
        tokens.push('((?:[^/]*(?:\/|$))*)')
        i++
      }
      else {
        tokens.push('([^/]*)')
      }

      continue
    }

    switch (c) {
      case '?':
        tokens.push('.')
        break
      case '[':
        tokens.push('[')
        break
      case ']':
        tokens.push(']')
        break
      case '{':
        inGroup = true
        tokens.push('(')
        break
      case '}':
        inGroup = false
        tokens.push(')')
        break
      case ',':
        if (inGroup) {
          tokens.push('|')
          break
        }

        tokens.push(`\\${c}`)
        break
      default:
        tokens.push(escapedChars.has(c) ? `\\${c}` : c)
    }
  }

  tokens.push('$')
  return new RegExp(tokens.join(''))
}
