export interface AccessibilityStandardReference {
  successCriteria: readonly string[]
  detectionCodes?: readonly string[]
  auditCodes?: readonly string[]
}

export type EditorAccessibilityAssessment = 'automatic' | 'review'

export interface AccessibilityRuleDefinition {
  title: string
  assessment: EditorAccessibilityAssessment
  standard: AccessibilityStandardReference
}

// 僅收錄 TinyMCE 內容片段能預檢的規則。頁面 shell、前台互動與整站認證不在此 catalog。
export const accessibilityRuleCatalog = {
  'font-size-absolute-unit': {
    title: '固定字級單位',
    assessment: 'automatic',
    standard: { successCriteria: ['1.4.4'], detectionCodes: ['CS2140401C'] },
  },
  'text-contrast': {
    title: '文字對比',
    assessment: 'automatic',
    standard: {
      successCriteria: ['1.4.3'],
      auditCodes: ['GN2140300E', 'GN2140301E', 'GN2140302E', 'GN2140303E'],
    },
  },
  'heading-empty': {
    title: '空白標題',
    assessment: 'automatic',
    standard: {
      successCriteria: ['1.3.1', '2.4.6'],
      detectionCodes: ['HM1130100C'],
      auditCodes: ['HM1130104E'],
    },
  },
  'heading-order': {
    title: '標題階層',
    assessment: 'automatic',
    standard: {
      successCriteria: ['1.3.1', '2.4.6'],
      detectionCodes: ['HM1130100C'],
      auditCodes: ['HM1130104E'],
    },
  },
  'duplicate-id': {
    title: '重複 ID',
    assessment: 'automatic',
    standard: { successCriteria: ['4.1.1'] },
  },
  'form-label': {
    title: '表單欄位名稱',
    assessment: 'automatic',
    standard: {
      successCriteria: ['1.3.1', '3.3.2', '4.1.2'],
      detectionCodes: ['HM1410200C'],
      auditCodes: ['GN1410200E'],
    },
  },
  'button-name': {
    title: '按鈕名稱',
    assessment: 'automatic',
    standard: {
      successCriteria: ['4.1.2'],
      detectionCodes: ['HM1410200C'],
      auditCodes: ['GN1410200E'],
    },
  },
  'list-structure': {
    title: '清單結構',
    assessment: 'automatic',
    standard: { successCriteria: ['1.3.1'] },
  },
  'image-alt': {
    title: '圖片替代文字',
    assessment: 'automatic',
    standard: {
      successCriteria: ['1.1.1'],
      detectionCodes: ['HM1110100C'],
      auditCodes: ['HM1110100E', 'HM1110112E'],
    },
  },
  'image-alt-quality': {
    title: '圖片替代文字品質',
    assessment: 'review',
    standard: { successCriteria: ['1.1.1'], auditCodes: ['HM1110100E', 'HM1110112E'] },
  },
  'image-decorative-review': {
    title: '裝飾圖片確認',
    assessment: 'review',
    standard: {
      successCriteria: ['1.1.1'],
      detectionCodes: ['HM1110106C'],
      auditCodes: ['HM1110112E'],
    },
  },
  'link-text': {
    title: '鏈結目的',
    assessment: 'review',
    standard: {
      successCriteria: ['2.4.4'],
      detectionCodes: ['HM1240401C'],
      auditCodes: ['HM1240400E', 'GN1240401E'],
    },
  },
  'iframe-title': {
    title: '框架標題',
    assessment: 'automatic',
    standard: {
      successCriteria: ['4.1.2'],
      detectionCodes: ['HM1410201C'],
      auditCodes: ['GN1410200E'],
    },
  },
  'table-caption': {
    title: '表格標題',
    assessment: 'review',
    standard: { successCriteria: ['1.3.1'], auditCodes: ['HM1130108E', 'HM1130109E'] },
  },
  'table-header': {
    title: '表格表頭',
    assessment: 'automatic',
    standard: { successCriteria: ['1.3.1'], auditCodes: ['HM1130107E'] },
  },
  'table-header-empty': {
    title: '空白表頭',
    assessment: 'automatic',
    standard: { successCriteria: ['1.3.1'], auditCodes: ['HM1130107E'] },
  },
  'table-header-association': {
    title: '表頭關聯',
    assessment: 'review',
    standard: {
      successCriteria: ['1.3.1'],
      detectionCodes: ['HM1130101C'],
      auditCodes: ['HM1130110E'],
    },
  },
  'video-captions': {
    title: '影片字幕',
    assessment: 'automatic',
    standard: { successCriteria: ['1.2.2'], auditCodes: ['GN1120200E'] },
  },
  'video-text-alternative': {
    title: '影片替代內容',
    assessment: 'automatic',
    standard: {
      successCriteria: ['1.2.3'],
      auditCodes: ['GN1120300E', 'GN1120301E', 'GN1120302E'],
    },
  },
  'aria-reference': {
    title: 'ARIA 參照',
    assessment: 'automatic',
    standard: { successCriteria: ['1.3.1', '4.1.2'] },
  },
  'positive-tabindex': {
    title: '焦點順序',
    assessment: 'review',
    standard: {
      successCriteria: ['2.4.3'],
      auditCodes: ['GN1240300E', 'GN1240301E'],
    },
  },
  'media-autoplay': {
    title: '自動播放音訊',
    assessment: 'review',
    standard: { successCriteria: ['1.4.2'], auditCodes: ['GN1140200E'] },
  },
  'moving-content': {
    title: '移動或閃爍內容',
    assessment: 'review',
    standard: { successCriteria: ['2.2.2', '2.3.1'] },
  },
  'language-tag': {
    title: '局部語言',
    assessment: 'automatic',
    standard: {
      successCriteria: ['3.1.2'],
      detectionCodes: ['HM2310200C'],
      auditCodes: ['HM2310200E'],
    },
  },
} as const satisfies Record<string, AccessibilityRuleDefinition>

export type AccessibilityRuleId = keyof typeof accessibilityRuleCatalog

export const getAccessibilityRuleDefinition = (
  rule: AccessibilityRuleId,
): AccessibilityRuleDefinition => accessibilityRuleCatalog[rule]
