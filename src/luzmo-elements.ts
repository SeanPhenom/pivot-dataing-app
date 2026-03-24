import '@luzmo/embed'
import '@luzmo/analytics-components-kit/item-grid'
import '@luzmo/analytics-components-kit/item-slot-picker-panel'
import '@luzmo/analytics-components-kit/item-option-panel'
import '@luzmo/lucero/button'
import '@luzmo/lucero/progress-circle'

if (typeof window !== 'undefined') {
  const itemGridConstructor = window.customElements.get('luzmo-item-grid')
  const hasGridAlias = window.customElements.get('luzmo-grid')

  if (itemGridConstructor && !hasGridAlias) {
    const ItemGridBase = itemGridConstructor as { new (): HTMLElement }
    class LuzmoGridAlias extends ItemGridBase {}
    window.customElements.define('luzmo-grid', LuzmoGridAlias)
  }
}
