import { afterEach, describe, expect, it } from 'vitest'
import { resetRuntimeConfig, setRuntimeConfig } from './setup'
import { contentPrefix } from '../server/utils/paths'

afterEach(resetRuntimeConfig)

describe('contentPrefix', () => {
  it('normalises the trailing slash', () => {
    expect(contentPrefix()).toBe('content/')
    setRuntimeConfig({ contentDir: 'docs/content/' })
    expect(contentPrefix()).toBe('docs/content/')
  })
})
