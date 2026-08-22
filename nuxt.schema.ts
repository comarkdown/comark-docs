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
        /** A wordmark shipped with the layer (`comark` | `comark-content`). */
        mark: '',
        light: '',
        dark: '',
      },
      /** Sibling sites listed in the brand popover; empty = no popover. */
      ecosystem: [],
      /** Show the search button (header and mobile drawer). */
      search: true,
      /**
       * Main navigation tabs. A group maps top-level content sections to a tab.
       */
      nav: [],
      /** Right-side icon links. */
      links: [],
    },
    footer: {
      /** Full credits line; empty = `© ${year} ${owner}.` */
      credits: '',
      /** Copyright holder when it isn't the site itself; empty = site name. */
      owner: '',
      /** Optional icon rendered before the credits. */
      icon: '',
      links: [],
    },
    toc: {
      title: 'On this page',
    },
    assistant: {
      /** Enable the "Ask AI" assistant */
      enabled: false,
      /** Suggested questions shown before the first message, grouped by category. */
      faqQuestions: [],
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
      ogImage: {
        /** Accent colour of the OG template (mark column, headline, rule). */
        accent: '#fafafa',
        /** Strapline along the bottom of the OG image; empty = site description. */
        tagline: '',
        /** Mark drawn in the left column; `wordmark` renders the site name. */
        mark: 'wordmark',
      },
      llms: {
        /** Description emitted under the llms.txt heading. */
        description: '',
        /**
         * "When to use" guidance for agents, emitted as the first llms.txt section (markdown).
         * Name the jobs the product is right for and how an agent should call it. Empty = no section.
         */
        whenToUse: '',
        /** Extra links appended to llms.txt. */
        links: [],
      },
      /**
       * schema.org SoftwareApplication identity, emitted as JSON-LD on the landing page. Empty = none.
       * The `organization` sub-key is emitted as a separate top-level Organization node — give it
       * `contactPoint` (with `contactType` and an email or phone) and `address` (a `PostalAddress`)
       * so agents can verify the business behind the site.
       */
      schemaOrg: {},
      /** Extra links appended to the docs page aside. */
      asideLinks: [],
    },
  },
})
