'use strict';

let _anthropic = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) {
    // Lazy-load to avoid startup crash when SDK is installed but key is absent
    const Anthropic = require('@anthropic-ai/sdk');
    _anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * Analyze aggregated chart data using Claude and return structured insights.
 * @param {{ reportName: string, chartType: string, xAxis: string, yAxis: string, aggData: object[] }} opts
 * @returns {{ keyFinding: string, insights: string[] }}
 */
async function analyzeChartData({ reportName, chartType, xAxis, yAxis, aggData }) {
  const client = getClient();
  if (!client) {
    const err = new Error('AI analysis is not configured on this server. Add ANTHROPIC_API_KEY to backend/.env to enable this feature.');
    err.code = 'AI_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }

  // Send at most 30 data points (top by yAxis value) to keep prompt compact
  const topData = [...aggData]
    .sort((a, b) => (Number(b[yAxis]) || 0) - (Number(a[yAxis]) || 0))
    .slice(0, 30);

  const prompt = `You are a sharp data analyst. Analyze this chart data concisely.
Report: "${reportName}", Chart type: ${chartType}, Metric: ${yAxis} grouped by ${xAxis}

Data (sorted by ${yAxis} descending):
${JSON.stringify(topData)}

Return ONLY valid JSON with no markdown, no explanation:
{
  "keyFinding": "<single sentence, max 15 words, the most important takeaway>",
  "insights": [
    "<specific insight 1 with numbers and category names>",
    "<specific insight 2 with numbers and category names>",
    "<specific insight 3 with numbers and category names>",
    "<specific insight 4 with numbers and category names>"
  ]
}

Be specific: reference actual category names and values. Focus on: concentration, outliers, ratios, and distribution patterns.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '';

  // Extract JSON even if Claude wraps it in markdown code fences
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('AI returned an unexpected format. Please try again.');
  }

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('AI response could not be parsed. Please try again.');
  }

  if (typeof parsed.keyFinding !== 'string' || !Array.isArray(parsed.insights)) {
    throw new Error('AI response is missing required fields. Please try again.');
  }

  return {
    keyFinding: String(parsed.keyFinding).slice(0, 250),
    insights: parsed.insights.slice(0, 4).map((s) => String(s).slice(0, 350)),
  };
}

module.exports = { analyzeChartData };
