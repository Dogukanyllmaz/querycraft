import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
            <pre className="text-xs text-red-700 bg-red-100 p-3 rounded overflow-auto whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              onClick={() => { this.setState({ error: null }); window.history.back() }}
            >
              Go back
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
