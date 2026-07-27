export default defineNuxtSchema({
  appConfig: {
    seo: {
      /** Site name used in title templates, OG tags and JSON-LD. */
      siteName: '',
    },
    header: {
      /** Title displayed next to the logo (defaults to the site name). */
      title: '',
      /** Link target of the header logo. */
      to: '/',
      logo: {
        alt: '',
        light: '',
        dark: '',
      },
      /** Show the search button. */
      search: true,
      /** Show the color mode toggle. */
      colorMode: true,
      /**
       * Main navigation tabs. Each group maps top-level content sections to a
       * tab; `link: 'section'` links to the section index instead of its
       * first leaf page. Empty = one tab per top-level content section.
       */
      nav: [],
      /** Right-side icon links. */
      links: [],
    },
    footer: {
      /** Bottom-left credits; empty = `© ${siteName} ${year}`. */
      credits: '',
      links: [],
    },
    toc: {
      title: 'On this page',
    },
    github: {
      /** Repository owner (inferred from git when unset). */
      owner: '',
      /** Repository name (inferred from git when unset). */
      name: '',
      /** Production content branch. */
      branch: 'main',
      /** Content directory, relative to the repository root. */
      contentDir: 'content',
      /** Repository URL. */
      url: '',
    },
    docs: {
      rss: {
        /** RSS feed title; empty = `${siteName} Documentation`. */
        title: '',
      },
      llms: {
        /** Description emitted under the llms.txt heading. */
        description: '',
        /** Extra links appended to llms.txt. */
        links: [],
      },
      /**
       * schema.org SoftwareApplication identity emitted as JSON-LD on the
       * landing page. Empty = no SoftwareApplication block.
       */
      schemaOrg: {},
      /** Extra links appended to the docs page aside. */
      asideLinks: [],
    },
  },
})
