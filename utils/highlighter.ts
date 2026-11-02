import rangi from 'comark/plugins/rangi'
import { geistTheme } from './geist.ts'

/** The code highlighter content is parsed with, unless a site sets `comarkDocs.highlighter`. */
export default rangi({ theme: geistTheme })
