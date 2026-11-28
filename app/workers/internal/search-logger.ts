/**
 * Logging for the search worker.
 *
 * Triggered by `?debug=search` param.
 */
import type { Logger } from 'comark-content/runtime'

const PREFIX = '[search:worker]'

let debug = false

export function setDebug(value: boolean): void {
  debug = value
}

function log(...args: unknown[]): void {
  if (debug) console.info(PREFIX, ...args)
}

/**
 * Warn and error are deliberately ungated: the FTS plugin reports a missing snapshot through this
 * channel, and that failure is otherwise indistinguishable from "the query matched nothing".
 */
export const logger: Logger = {
  debug: (tag, ...args) => log(`${tag}:`, ...args),
  info: (tag, ...args) => log(`${tag}:`, ...args),
  warn: (tag, ...args) => console.warn(`${PREFIX} ${tag}:`, ...args),
  error: (tag, ...args) => console.error(`${PREFIX} ${tag}:`, ...args),
}
