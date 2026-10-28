/** A channel description without its "## " headings and [title](https://…) link markup, on one line. */
export const plainMessage = (text: string) =>
  text
    .replace(/^## /gm, '')
    .replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
