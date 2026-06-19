import { useState } from 'react'
import { Sparkles, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { reportsService, type AiInsightsResult, type AggEntry } from '@/services/reports'
import type { ChartConfig } from '@/services/reports'

interface AiInsightsProps {
  reportId:    string
  reportName:  string
  aggData:     AggEntry[]
  chartConfig: ChartConfig
}

type Status = 'idle' | 'loading' | 'success' | 'error' | 'unconfigured'

export function AiInsights({ reportId, reportName, aggData, chartConfig }: AiInsightsProps) {
  const [status,    setStatus]  = useState<Status>('idle')
  const [result,    setResult]  = useState<AiInsightsResult | null>(null)
  const [errorMsg,  setErrorMsg] = useState('')

  async function handleAnalyze() {
    setStatus('loading')
    setResult(null)
    setErrorMsg('')
    try {
      const res = await reportsService.analyze(reportId, {
        aggData,
        xAxis:     chartConfig.xAxis,
        yAxis:     chartConfig.yAxis,
        chartType: chartConfig.type,
      })
      setResult(res.data.data)
      setStatus('success')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; message?: string }; status?: number } }
      if (e.response?.data?.error === 'AI_NOT_CONFIGURED' || e.response?.status === 503) {
        setStatus('unconfigured')
      } else {
        setErrorMsg(e.response?.data?.message ?? 'Analysis failed. Please try again.')
        setStatus('error')
      }
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI Analysis
            <span className="ml-1 text-[10px] font-normal text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 leading-none">
              Powered by Claude
            </span>
          </CardTitle>
          {status === 'success' && (
            <button
              onClick={handleAnalyze}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Re-analyze
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-3 py-5 text-center">
            <p className="text-sm text-slate-500 max-w-xs">
              Get AI-powered insights about the patterns and trends in your chart data.
            </p>
            <Button variant="outline" size="sm" onClick={handleAnalyze}>
              <Sparkles className="h-3.5 w-3.5" />
              Analyze with AI
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-3 py-5 justify-center">
            <Spinner className="h-4 w-4" />
            <span className="text-sm text-slate-500">Analyzing chart data…</span>
          </div>
        )}

        {status === 'success' && result && (
          <div className="space-y-4 animate-fade-in">
            {/* Key finding callout */}
            <div className="rounded-lg bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800 leading-snug">{result.keyFinding}</p>
            </div>
            {/* Numbered insights */}
            <ul className="space-y-2.5">
              {result.insights.map((insight, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                  <span className="mt-0.5 h-4 w-4 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-100 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
              <button onClick={handleAnalyze} className="text-xs text-red-500 hover:text-red-700 underline">
                Try again
              </button>
            </div>
          </div>
        )}

        {status === 'unconfigured' && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-amber-800 font-medium">AI analysis is not configured</p>
              <p className="text-xs text-amber-700">
                Add{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code>
                {' '}to{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">backend/.env</code>
                {' '}to enable this feature.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
