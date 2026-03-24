import type * as React from 'react'

type LuzmoElementProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
> &
  Record<string, unknown>

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'luzmo-embed-dashboard': LuzmoElementProps
      'luzmo-embed-viz-item': LuzmoElementProps
      'luzmo-grid': LuzmoElementProps
      'luzmo-item-grid': LuzmoElementProps
      'luzmo-item-slot-picker-panel': LuzmoElementProps
      'luzmo-item-option-panel': LuzmoElementProps
      'luzmo-button': LuzmoElementProps
      'luzmo-progress-circle': LuzmoElementProps
    }
  }
}

export {}
