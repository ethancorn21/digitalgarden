import { QuartzTransformerPlugin } from "../types"

const obsidianDateRegex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/

export const ObsidianNoteDate: QuartzTransformerPlugin = () => ({
  name: "ObsidianNoteDate",
  markdownPlugins() {
    return [
      () => (_tree, file) => {
        const content = String(file.value)
        const firstLine = content.split("\n")[0].trim()
        const match = firstLine.match(obsidianDateRegex)
        if (match) {
          const parsed = new Date(match[1].replace(" ", "T"))
          if (!isNaN(parsed.getTime())) {
            if (!file.data.dates) {
              file.data.dates = { created: parsed, modified: parsed, published: parsed }
            } else {
              file.data.dates.created = parsed
              file.data.dates.modified = parsed
            }
          }
        }
      },
    ]
  },
})
