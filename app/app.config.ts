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
        title: 'font-semibold text-5xl sm:text-6xl lg:text-6xl tracking-tighter',
        description: 'text-lg sm:text-xl mt-6',
        container: 'max-w-5xl',
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
        title: 'text-4xl font-semibold',
      },
    },
    pageLinks: {
      slots: {
        linkLeadingIcon: 'size-3.5',
      },
    },
    prose: {
      codeGroup: {
        slots: {
          list: 'bg-muted',
        },
      },
      pre: {
        slots: {
          header: 'bg-muted border-muted',
          base: 'bg-white dark:bg-default border-muted',
        },
      },
      h2: {
        slots: {
          base: 'font-semibold',
        },
      },
      h3: {
        slots: {
          base: 'font-semibold',
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

      // callout: {
      //   variants: {
      //     color: {
      //       info: {
      //         base: 'border-muted bg-muted text-toned [&_a]:text-primary [&_a]:hover:border-primary [&_a]:outline-primary/25 [&_a]:focus-visible:outline-3 [&_a]:focus-visible:has-[>code]:outline-0 [&_code]:text-primary-600 dark:[&_code]:text-primary-300 [&_code]:border-primary/25 [&_a]:[&>code]:outline-primary/25 [&_a]:hover:[&>code]:border-primary [&_a]:hover:[&>code]:text-primary [&_a]:focus-visible:[&>code]:border-primary [&_a]:focus-visible:[&>code]:text-primary [&>ul]:marker:text-primary/50',
      //       },
      //       success: {
      //         base: 'border-muted bg-muted text-toned [&_a]:text-primary [&_a]:hover:border-primary [&_a]:outline-primary/25 [&_a]:focus-visible:outline-3 [&_a]:focus-visible:has-[>code]:outline-0 [&_code]:text-primary-600 dark:[&_code]:text-primary-300 [&_code]:border-primary/25 [&_a]:[&>code]:outline-primary/25 [&_a]:hover:[&>code]:border-primary [&_a]:hover:[&>code]:text-primary [&_a]:focus-visible:[&>code]:border-primary [&_a]:focus-visible:[&>code]:text-primary [&>ul]:marker:text-primary/50'
      //       }
      //     }
      //   }
      // }
    },
    icons: {
      // info: 'i-tabler-info-square-rounded-filled',
    },
  },
  // `seo.siteName`, `header.title` and `github.*` are intentionally NOT
  // defaulted here: modules/config.ts seeds them into `nuxt.options.appConfig`
  // (from site config / local git), and app.config values — even empty
  // strings — would take precedence over those seeded values.
  header: {
    to: '/',
    logo: {
      alt: '',
      light: '',
      dark: '',
    },
    search: true,
    colorMode: true,
    // Main navigation tabs; empty = one tab per top-level content section.
    nav: [] as { label: string; sections: string[]; link?: 'first-leaf' | 'section' }[],
    links: [],
  },
  footer: {
    // Bottom-left credits; empty = `© ${siteName} ${year}`.
    credits: '',
    links: [
      {
        icon: 'i-lucide-rss',
        to: '/rss.xml',
        target: '_blank',
        'aria-label': 'RSS Feed',
      },
    ],
  },
  toc: {
    title: 'On this page',
  },
  docs: {
    rss: {
      // Empty = `${seo.siteName} Documentation`.
      title: '',
    },
    llms: {
      description: '',
      links: [] as { title: string; description: string; href: string }[],
    },
    // Optional schema.org SoftwareApplication identity for the landing page
    // JSON-LD; empty = no SoftwareApplication block is emitted.
    schemaOrg: {},
    // Extra links appended to the docs page aside (below Copy page / Edit).
    asideLinks: [] as { label: string; icon?: string; to: string; target?: string }[],
  },
})
