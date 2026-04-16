import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.ConditionalRender({
      component: Component.Backlinks(),
      condition: (page) => {
        const slug = page.fileData.slug ?? ""
        return slug.startsWith("5---indexes/") || slug.startsWith("4---tags/")
      },
    }),
  ],
  footer: Component.Footer(),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({
      sortFn: (a, b) => {
        if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
          const dateA = a.data?.date ? new Date(a.data.date).getTime() : 0
          const dateB = b.data?.date ? new Date(b.data.date).getTime() : 0
          return dateB - dateA
        }
        return a.isFolder ? -1 : 1
      },
      mapFn: (node) => {
        if (node.isFolder) {
          if (node.slugSegment === "2---source-material") {
            node.displayName = "Source Material"
          } else if (node.slugSegment === "3---atomic-notes") {
            node.displayName = "Atomic Notes"
          } else if (node.slugSegment === "4---tags") {
            node.displayName = "Tags"
          } else if (node.slugSegment === "5---indexes") {
            node.displayName = "Indexes"
          }
        }
      },
    }),
  ],
  right: [
    Component.Graph({
      localGraph: { showTags: false },
      globalGraph: { showTags: false },
    }),
    Component.DesktopOnly(Component.TableOfContents()),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      sortFn: (a, b) => {
        if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
          const dateA = a.data?.date ? new Date(a.data.date).getTime() : 0
          const dateB = b.data?.date ? new Date(b.data.date).getTime() : 0
          return dateB - dateA
        }
        return a.isFolder ? -1 : 1
      },
      mapFn: (node) => {
        if (node.isFolder) {
          if (node.slugSegment === "2---source-material") {
            node.displayName = "Source Material"
          } else if (node.slugSegment === "3---atomic-notes") {
            node.displayName = "Atomic Notes"
          } else if (node.slugSegment === "4---tags") {
            node.displayName = "Tags"
          } else if (node.slugSegment === "5---indexes") {
            node.displayName = "Indexes"
          }
        }
      },
    }),
  ],
  right: [],
}
