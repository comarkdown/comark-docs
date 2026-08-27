export default defineAppConfig({
  ui: {
    colors: {
      primary: 'neutral',
      neutral: 'neutral',
    },
    container: {
      base: 'px-6',
    },
    header: {
      slots: {
        root: 'backdrop-blur-none bg-default',
        left: 'lg:flex-none',
        header: 'px-6',
        right: 'gap-2',
        body: 'h-full',
      },
    },
    footer: {
      slots: {
        root: 'border-t border-default',
        container: 'flex flex-col-reverse lg:flex-row gap-4',
        center: 'hidden',
        left: 'text-sm text-muted',
        right: 'gap-x-2',
      },
    },
    navigationMenu: {
      slots: {
        link: 'font-normal',
      },
    },
    contentNavigation: {
      slots: {
        linkLeadingIcon: 'grayscale',
        listWithChildren: 'ms-0 border-none',
        itemWithChildren: 'data-[state=open]:mb-2',
        trigger: 'font-medium',
      },
      variants: {
        level: {
          true: {
            item: 'ps-0 ms-0',
            itemWithChildren: 'ps-0 ms-0',
          },
        },
        active: {
          true: {
            link: 'font-normal text-highlighted',
          },
        },
      },
    },
    contentToc: {
      slots: {
        trigger: 'font-normal text-muted',
      },
    },
    contentSurround: {
      slots: {
        root: 'gap-4',
        link: 'bg-white dark:bg-muted py-4 px-4 border-muted',
        linkLeading:
          'mb-0 bg-muted bg-transparent ring-transparent p-0 group-hover:ring-transparent group-hover:bg-transparent',
        linkLeadingIcon: 'size-4',
        linkDescription: 'truncate',
        linkTitle: 'mb-0',
      },
    },
    pageHero: {
      slots: {
        title: 'font-medium text-5xl sm:text-6xl lg:text-12xl tracking-tighter',
        description: 'text-lg sm:text-xl mt-6',
        container: 'max-w-6xl',
      },
    },
    page: {
      slots: {
        right: 'lg:pt-4',
      },
    },
    pageBody: {
      base: 'text-accented',
    },
    pageAside: {
      slots: {
        root: 'pt-12',
      },
    },
    pageHeader: {
      slots: {
        root: 'lg:pt-12 border-b-0',
        headline: 'hidden',
        title: 'text-4xl font-medium',
      },
    },
    pageSection: {
      slots: {
        title: 'font-medium'
      }
    },
    pageCTA: {
      slots: {
        title: 'font-medium'
      }
    },
    pageLinks: {
      slots: {
        linkLeadingIcon: 'size-3.5',
      },
    },
    prose: {
      a: {
        base: 'rounded-none border-current hover:text-muted hover:border-current [&>code]:border-current hover:[&>code]:text-muted hover:[&>code]:border-current',
      },
      codePreview: {
        slots: {
          preview: 'flex-col *:w-full [&_a]:w-fit',
        },
      },
      codeIcon: {
        'nitro.config.ts': 'i-unjs-nitro',
        'astro.config.mjs': 'i-simple-icons:astro',
        'vite.config.ts': 'i-logos-vite-icon',
        'vite.config.mjs': 'i-logos-vite-icon',
        'next.config.ts': 'i-simple-icons-nextjs',
        astro: 'i-simple-icons:astro',
        nitro: 'i-unjs-nitro',
        md: 'i-custom-comark',
        mdc: 'i-custom-comark',
        react: 'i-logos-react',
        html: 'i-vscode-icons-file-type-html',
        svelte: 'i-logos-svelte-icon',
        next: 'i-logos-nextjs-icon',
        nuxt: 'i-logos-nuxt-icon',
        vite: 'i-logos-vite-icon',
        angular: 'i-logos-angular-icon',
        ansi: 'i-lucide-terminal',
        typescript: 'i-vscode-icons-file-type-typescript-official',
        ts: 'i-vscode-icons-file-type-typescript-official',
        yaml: 'i-vscode-icons-file-type-light-yaml-official',
        yml: 'i-vscode-icons-file-type-light-yaml-official'
      },
      codeGroup: {
        slots: {
          list: 'bg-(--geist-background-200)',
        },
      },
      pre: {
        slots: {
          filename: 'text-[13px]/5',
          header: 'bg-(--geist-background-200) border-muted',
          base: 'bg-(--geist-background-100) border-muted **:[.line.highlight]:bg-(--geist-blue-300)! **:[.line.highlight]:[box-shadow:inset_2px_0_0_0_var(--geist-blue-900)] [font-variant-ligatures:none] text-[13px]/5',
        },
      },
      code: {
        base: '[font-variant-ligatures:none]'
      },
      h2: {
        slots: {
          base: 'font-medium',
        },
      },
      h3: {
        slots: {
          base: 'font--medium',
        },
      },
      cardGroup: {
        base: 'gap-4 my-4',
      },
      card: {
        slots: {
          base: 'bg-white dark:bg-muted dark:border-muted sm:p-4',
          icon: 'size-4',
          title: 'font-medium text-sm',
          description: 'text-sm',
        },
      },
      td: {
        base: 'bg-white dark:bg-muted/80',
      },
    },
    icons: {
      // info: 'i-tabler-info-square-rounded-filled',
    },
  },
  // `seo.siteName`, `header.title` and `github.*` are deliberately NOT defaulted here: modules/config.ts seeds
  // them into `nuxt.options.appConfig`, and app.config values — even empty strings — would win over those.
  header: {
    to: '/',
    logo: {
      alt: '',
      // Wordmark shipped with the layer ('comark' | 'comark-content'); takes precedence over the fallbacks below.
      mark: '',
      light: '',
      dark: '',
    },
    // Sibling sites listed in the brand popover; empty = no popover.
    ecosystem: [] as { mark?: string; to: string; label?: string }[],
    search: true,
    // No `colorMode` key: the always-visible toggle is in AppFooter, the header's is a mobile-drawer duplicate.
    // Main navigation tabs; empty = one tab per top-level content section.
    nav: [] as { label: string; sections: string[]; link?: 'first-leaf' | 'section' }[],
    links: [],
  },
  footer: {
    // Full credits line; empty = `© ${year} ${owner}.`
    credits: '',
    // Copyright holder when it isn't the site itself; empty = `seo.siteName`.
    owner: '',
    // Optional icon rendered before the credits.
    icon: '',
    // defu *concatenates* app.config arrays across layers, so any default here would append to (never replace)
    // the consumer's list — hence empty array defaults throughout.
    links: [],
  },
  toc: {
    title: 'On this page',
  },
  assistant: {
    // Shows the "Ask AI" (requires AI_GATEWAY_API_KEY).
    enabled: false,
    // Suggested questions shown before the first message, grouped by category.
    faqQuestions: [] as { category: string; items: string[] }[],
  },
  docs: {
    rss: {
      // Empty = `${seo.siteName} Documentation`.
      title: '',
    },
    ogImage: {
      // Accent colour of the OG template (mark column, headline, rule).
      accent: '#fafafa',
      // Strapline along the bottom; empty = `site.description`.
      tagline: ''
    },
    llms: {
      description: '',
      links: [] as { title: string; description: string; href: string }[],
    },
    // schema.org SoftwareApplication identity for the landing page JSON-LD; empty = no block emitted.
    schemaOrg: {},
    // Extra links appended to the docs page aside (below Copy page / Edit).
    asideLinks: [] as { label: string; icon?: string; to: string; target?: string }[],
  },
})
