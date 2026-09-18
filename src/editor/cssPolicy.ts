import { cssLanguage } from '@codemirror/lang-css'

export interface CssSyntaxError {
  from: number
  to: number
}

export interface CssSelectorReference {
  from: number
  to: number
  selector: string
}

export interface CssAnalysis {
  syntaxErrors: CssSyntaxError[]
  selectors: CssSelectorReference[]
  globalSelectors: CssSelectorReference[]
}

export type CssScopeFailureCode = 'invalid-css' | 'invalid-scope-selector' | 'global-selector'

export interface CssScopeResult {
  css: string
  scoped: boolean
  failures: CssScopeFailureCode[]
  analysis: CssAnalysis
}

const globalSelectorPattern = /(^|[\s>+~,(])(?:html|body)(?=$|[\s>+~.#[:),])|:root\b/i

const isNestedRuleSet = (node: { parent: { name: string; parent: unknown } | null }) => {
  let parent = node.parent
  while (parent) {
    if (parent.name === 'RuleSet') {
      return true
    }
    parent = parent.parent as typeof parent
  }
  return false
}

export const analyzeCss = (source: string): CssAnalysis => {
  const tree = cssLanguage.parser.parse(source)
  const syntaxErrors: CssSyntaxError[] = []
  const selectors: CssSelectorReference[] = []

  tree.iterate({
    enter(node) {
      if (node.type.isError) {
        syntaxErrors.push({ from: node.from, to: node.to })
        return
      }

      if (node.name !== 'RuleSet' || isNestedRuleSet(node.node)) {
        return
      }

      const block = node.node.getChild('Block')
      if (!block || block.from <= node.from) {
        return
      }

      const selector = source.slice(node.from, block.from).trim()
      if (selector) {
        selectors.push({ from: node.from, to: block.from, selector })
      }
    },
  })

  return {
    syntaxErrors,
    selectors,
    globalSelectors: selectors.filter(({ selector }) => globalSelectorPattern.test(selector)),
  }
}

const isValidScopeSelector = (scopeSelector: string) => {
  const value = scopeSelector.trim()
  if (!value || /[,{};]/.test(value)) {
    return false
  }

  try {
    document.querySelector(value)
    return true
  } catch {
    return false
  }
}

export const scopeCss = (source: string, scopeSelector: string): CssScopeResult => {
  const analysis = analyzeCss(source)
  const failures: CssScopeFailureCode[] = []

  if (analysis.syntaxErrors.length) {
    failures.push('invalid-css')
  }
  if (!isValidScopeSelector(scopeSelector)) {
    failures.push('invalid-scope-selector')
  }
  if (analysis.globalSelectors.length) {
    failures.push('global-selector')
  }

  if (failures.length) {
    return { css: source, scoped: false, failures, analysis }
  }

  const tree = cssLanguage.parser.parse(source)
  const insertionPoints: number[] = []

  tree.iterate({
    enter(node) {
      if (node.name !== 'RuleSet' || isNestedRuleSet(node.node)) {
        return
      }

      const block = node.node.getChild('Block')
      if (!block) {
        return
      }

      insertionPoints.push(node.from)
      for (
        let child = node.node.firstChild;
        child && child.from < block.from;
        child = child.nextSibling
      ) {
        if (child.name === ',') {
          insertionPoints.push(child.to)
        }
      }
    },
  })

  const prefix = `:where(${scopeSelector.trim()}) `
  let css = source
  insertionPoints
    .sort((left, right) => right - left)
    .forEach((position) => {
      css = `${css.slice(0, position)}${prefix}${css.slice(position)}`
    })

  return { css, scoped: true, failures, analysis }
}
