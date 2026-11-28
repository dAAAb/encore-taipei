import { Component, type ReactNode } from 'react'

/** If a set throws while building (an odd GPU, a missing API), render the fallback set instead of a blank canvas. */
export class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('[scene] falling back:', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
