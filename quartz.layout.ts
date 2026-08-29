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
      ],
    }),
    Component.Explorer({
      folderClickBehavior: "collapse",
      // first-time visitors (no saved fileTree in localStorage) get the tree expanded
      folderDefaultState: "open",
      defaultOpenFolders: ["2---atomic-notes"],
      sortFn: (a, b) => {
        if (a.isFolder && b.isFolder) {
          // order comes from the folder's numeric prefix (e.g. "2---atomic-notes"),
          // never from displayName — displayName is cosmetic only (mapFn strips the number)
          // NOTE: no helper function here — esbuild wraps named fns with a __name()
          // call that doesn't exist when Explorer evals this via `new Function(...)`
          const aMatch = a.slugSegment?.match(/^(\d+)---/)
          const bMatch = b.slugSegment?.match(/^(\d+)---/)
          const aOrder = aMatch ? parseInt(aMatch[1], 10) : Infinity
          const bOrder = bMatch ? parseInt(bMatch[1], 10) : Infinity
          if (aOrder !== bOrder) return aOrder - bOrder
          return a.displayName.localeCompare(b.displayName, "en", { numeric: true, sensitivity: "base" })
        }
        if (!a.isFolder && !b.isFolder) {
          // surfacing rule: a note edited within the last 30 days sorts by its
          // modified date, so revisiting an old note floats it to the top; once the
          // window lapses it falls back to created and drops to its chronological
          // spot, so a stray reformat commit can't permanently reorder the tree.
          // NOTE: inlined, no helper fn — esbuild wraps named fns with a __name()
          // call that doesn't exist when Explorer evals this via `new Function(...)`
          const surfaceWindowMs = 30 * 24 * 60 * 60 * 1000
          const now = Date.now()
          const aCreated = a.data?.date ? new Date(a.data.date).getTime() : 0
          const bCreated = b.data?.date ? new Date(b.data.date).getTime() : 0
          const aMod = a.data?.edited ? new Date(a.data.edited).getTime() : 0
          const bMod = b.data?.edited ? new Date(b.data.edited).getTime() : 0
          const aDate = aMod > aCreated && now - aMod < surfaceWindowMs ? aMod : aCreated
          const bDate = bMod > bCreated && now - bMod < surfaceWindowMs ? bMod : bCreated
          if (bDate !== aDate) return bDate - aDate
          // fallback: alphabetical when dates are equal (e.g. shallow CI clone gives same git date)
          return a.displayName.localeCompare(b.displayName, "en", { numeric: true, sensitivity: "base" })
        }
        return a.isFolder ? -1 : 1
      },
      mapFn: (node) => {
        if (node.isFolder) {
          if (node.slugSegment === "2---atomic-notes") {
            node.displayName = "Atomic Notes"
          } else if (node.slugSegment === "3---source-material") {
            node.displayName = "Source Material"
          } else if (node.slugSegment === "4---tags") {
            node.displayName = "Tags"
          } else if (node.slugSegment === "5---indexes") {
            node.displayName = "Indexes"
          } else if (node.slugSegment === "7---attachments") {
            node.displayName = "Attachments"
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
      folderClickBehavior: "collapse",
      // first-time visitors (no saved fileTree in localStorage) get the tree expanded
      folderDefaultState: "open",
      defaultOpenFolders: ["2---atomic-notes"],
      sortFn: (a, b) => {
        if (a.isFolder && b.isFolder) {
          // order comes from the folder's numeric prefix (e.g. "2---atomic-notes"),
          // never from displayName — displayName is cosmetic only (mapFn strips the number)
          // NOTE: no helper function here — esbuild wraps named fns with a __name()
          // call that doesn't exist when Explorer evals this via `new Function(...)`
          const aMatch = a.slugSegment?.match(/^(\d+)---/)
          const bMatch = b.slugSegment?.match(/^(\d+)---/)
          const aOrder = aMatch ? parseInt(aMatch[1], 10) : Infinity
          const bOrder = bMatch ? parseInt(bMatch[1], 10) : Infinity
          if (aOrder !== bOrder) return aOrder - bOrder
          return a.displayName.localeCompare(b.displayName, "en", { numeric: true, sensitivity: "base" })
        }
        if (!a.isFolder && !b.isFolder) {
          // surfacing rule: a note edited within the last 30 days sorts by its
          // modified date, so revisiting an old note floats it to the top; once the
          // window lapses it falls back to created and drops to its chronological
          // spot, so a stray reformat commit can't permanently reorder the tree.
          // NOTE: inlined, no helper fn — esbuild wraps named fns with a __name()
          // call that doesn't exist when Explorer evals this via `new Function(...)`
          const surfaceWindowMs = 30 * 24 * 60 * 60 * 1000
          const now = Date.now()
          const aCreated = a.data?.date ? new Date(a.data.date).getTime() : 0
          const bCreated = b.data?.date ? new Date(b.data.date).getTime() : 0
          const aMod = a.data?.edited ? new Date(a.data.edited).getTime() : 0
          const bMod = b.data?.edited ? new Date(b.data.edited).getTime() : 0
          const aDate = aMod > aCreated && now - aMod < surfaceWindowMs ? aMod : aCreated
          const bDate = bMod > bCreated && now - bMod < surfaceWindowMs ? bMod : bCreated
          if (bDate !== aDate) return bDate - aDate
          return a.displayName.localeCompare(b.displayName, "en", { numeric: true, sensitivity: "base" })
        }
        return a.isFolder ? -1 : 1
      },
      mapFn: (node) => {
        if (node.isFolder) {
          if (node.slugSegment === "2---atomic-notes") {
            node.displayName = "Atomic Notes"
          } else if (node.slugSegment === "3---source-material") {
            node.displayName = "Source Material"
          } else if (node.slugSegment === "4---tags") {
            node.displayName = "Tags"
          } else if (node.slugSegment === "5---indexes") {
            node.displayName = "Indexes"
          } else if (node.slugSegment === "7---attachments") {
            node.displayName = "Attachments"
          }
        }
      },
    }),
  ],
  right: [],
}
