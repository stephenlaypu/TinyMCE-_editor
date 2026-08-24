import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tokensPath = path.join(projectRoot, 'src', 'editor', 'tinymce', 'cmsFormattingTokens.json')
const outputPath = path.join(projectRoot, 'public', 'cms-editor', 'cms-content', 'formatting.css')
const tokens = JSON.parse(await readFile(tokensPath, 'utf8'))

const textColorRules = tokens.textColors.map(
  ({ value, className }) => `.cms-color-${className} { color: ${value}; }`,
)

const backgroundColorRules = tokens.backgroundColors.flatMap(({ value, className }) => [
    `.cms-bg-${className} { background-color: ${value}; }`,
    `.cms-table-bg-${className} { background-color: ${value}; }`,
    `.cms-table tr.cms-row-bg-${className} > th,\n.cms-table tr.cms-row-bg-${className} > td { background-color: ${value}; }`,
    `.cms-cell-bg-${className} { background-color: ${value}; }`,
  ])

const createTableCellSelector = (className) =>
  [
    `.${className} > tr > :is(th, td)`,
    `.${className} > :is(thead, tbody, tfoot) > tr > :is(th, td)`,
  ].join(',\n')

const borderColorRules = tokens.borderColors.flatMap(({ value, className }) => [
    `.cms-border-${className} { border-color: ${value}; }`,
    `.cms-table-border-${className},\n${createTableCellSelector(`cms-table-border-${className}`)} { border-color: ${value}; }`,
    `.cms-table tr.cms-row-border-${className},\n.cms-table tr.cms-row-border-${className} > :is(th, td) { border-color: ${value}; }`,
    `.cms-cell-border-${className} { border-color: ${value}; }`,
  ])

const borderStyleRules = tokens.borderStyles.flatMap(({ value, className }) => [
  `.cms-border-style-${className} { border-style: ${value}; }`,
  `.cms-table-border-style-${className},\n${createTableCellSelector(`cms-table-border-style-${className}`)} { border-style: ${value}; }`,
  `.cms-table tr.cms-row-border-style-${className},\n.cms-table tr.cms-row-border-style-${className} > :is(th, td) { border-style: ${value}; }`,
  `.cms-cell-border-style-${className} { border-style: ${value}; }`,
])

const verticalAlignRules = tokens.verticalAlignments.map(
  ({ value, className }) => `.cms-cell-valign-${className} { vertical-align: ${value}; }`,
)

const listStyleRules = tokens.listStyles.map(
  ({ value, className }) => `.cms-list-${className} { list-style-type: ${value}; }`,
)

const fontRules = tokens.fontFamilies
  .filter(({ fontFamily }) => fontFamily)
  .map(({ value, fontFamily }) => `.${value} { font-family: ${fontFamily}; }`)

const fontSizeRules = tokens.fontSizes
  .filter(({ fontSize }) => fontSize)
  .map(({ className, fontSize }) => `.${className} { font-size: ${fontSize}; }`)

const css = `/* Generated from src/editor/tinymce/cmsFormattingTokens.json. */

/* Alignment */
.cms-align-left { text-align: left; }
.cms-align-center { text-align: center; }
.cms-align-right { text-align: right; }
.cms-align-justify { text-align: justify; }

.cms-row-align-left > :is(td, th),
.cms-cell-align-left { text-align: left; }
.cms-row-align-center > :is(td, th),
.cms-cell-align-center { text-align: center; }
.cms-row-align-right > :is(td, th),
.cms-cell-align-right { text-align: right; }
.cms-row-align-justify > :is(td, th),
.cms-cell-align-justify { text-align: justify; }

img.cms-align-left,
figure.cms-align-left,
table.cms-table-align-left { margin-left: 0; margin-right: auto; }
img.cms-align-center,
figure.cms-align-center,
table.cms-table-align-center { margin-left: auto; margin-right: auto; }
img.cms-align-right,
figure.cms-align-right,
table.cms-table-align-right { margin-left: auto; margin-right: 0; }

/* Text colors */
${textColorRules.join('\n')}

/* Background colors */
${backgroundColorRules.join('\n')}

/* Border colors */
${borderColorRules.join('\n')}

/* Border styles */
${borderStyleRules.join('\n')}

/* Cell vertical alignment */
${verticalAlignRules.join('\n')}

/* List styles */
${listStyleRules.join('\n')}

/* Font families */
${fontRules.join('\n')}

/* Font sizes */
${fontSizeRules.join('\n')}
`

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, css, 'utf8')
