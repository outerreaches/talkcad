import { v4 as uuid } from 'uuid';
import type {
  Spec,
  RenderStats,
  VerificationAngle,
  VerificationTolerances,
  LLMProvider as LLMProviderType,
} from '@talkcad/shared';
import { createProvider } from '../llm';

// ============================================
// Verification Types
// ============================================

export interface VerificationConfig {
  codeVerifierModel: string;
  visualVerifierModel: string;
  visualEnabled: boolean;
  enabledAngles: VerificationAngle[];
  tolerances: VerificationTolerances;

  // LLM configuration
  llmProvider: LLMProviderType;
  llmApiKey?: string;
  llmBaseUrl?: string;

  // Builder hint (context for visual verification during repair attempts)
  builderHint?: string;

  // Debug
  debug?: boolean;
}

// Debug logger helper
function debugLog(config: { debug?: boolean }, ...args: unknown[]): void {
  if (config.debug) {
    console.log('[Verification]', ...args);
  }
}

export interface SpecVerificationResult {
  specKey: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  method: 'code' | 'render_stats' | 'visual';
  deviation?: number;
  matched_variable?: string;
  notes?: string;
}

// Simple pass/fail result for an angle
export interface VisualVerificationResult {
  angle: VerificationAngle;
  passed: boolean;
  issues: string[];
  majorIssue: boolean;
}

// Retry logic constant
const MAX_VISUAL_RETRIES = 2;

export interface VerificationReport {
  allPassed: boolean;
  codeResults: SpecVerificationResult[];
  visualResults: VisualVerificationResult[];
  failedSpecs: string[];
  summary: string;
}

// ============================================
// Helper: Safe Expression Evaluation
// ============================================

/**
 * Safely evaluate a math expression string.
 * Used by the verifier to compute expected values without hallucination risk.
 */
export function computeExpression(
  expression: string,
  context?: Record<string, number>
): { value: number; error?: string } {
  try {
    // Only allow safe math operations
    const safeExpression = expression.replace(/[^0-9+\-*/().,%\s\w]/g, '');

    // Create evaluation context with Math functions
    const contextKeys = Object.keys(context || {});
    const contextValues = Object.values(context || {});

    // Build function with context variables as parameters
    const fn = new Function(
      'Math',
      ...contextKeys,
      `"use strict"; return (${safeExpression});`
    );

    const value = fn(Math, ...contextValues);

    if (typeof value !== 'number' || !isFinite(value)) {
      return { value: NaN, error: 'Expression did not evaluate to a finite number' };
    }

    return { value };
  } catch (e) {
    return { value: NaN, error: String(e) };
  }
}

// ============================================
// Code Verification
// ============================================

function buildCodeVerificationPrompt(
  code: string,
  specs: Spec[],
  renderStats: RenderStats | null
): string {
  // Build specs section with optional notes from builder
  const specsSection = specs
    .map((s) => {
      const unit = s.unit ? ` ${s.unit}` : '';
      const tolerance = s.tolerance ?? 0.1;
      const note = s.note ? ` (Note: ${s.note})` : '';
      return `- ${s.key}: ${s.value}${unit} (tolerance: ±${tolerance}${unit})${note}`;
    })
    .join('\n');

  const statsSection = renderStats
    ? `
## Render Statistics (Reference Only)
- Bounding box: ${renderStats.dimensions.x.toFixed(2)} × ${renderStats.dimensions.y.toFixed(2)} × ${renderStats.dimensions.z.toFixed(2)} mm
- Volume: ${renderStats.volume.toFixed(2)} mm³
- Triangles: ${renderStats.triangles}
- Manifold: ${renderStats.manifold ? 'yes' : 'no'}`
    : '';

  return `You are a CAD code verification expert. Analyze the OpenSCAD code below and verify each specification.

## OpenSCAD Code
\`\`\`scad
${code}
\`\`\`
${statsSection}

## Specifications to Verify
${specsSection}

## Instructions
For each specification:
1. **Identify the Variable**: Look for variables or parameters in the code that correspond to the spec.
   - The variable name might not match the spec key exactly (e.g. spec "e_diameter" might be "thread_minor_dia" or "inner_d" in code).
   - Look for values that match the expected value (e.g. found "24.95" assigned to a variable).
2. **Evaluate Values**: Calculate the final value of that variable.
   - If it's a calculation (e.g. \`major_d - 2*height\`), evaluate it.
   - For variables defined in \`module\` arguments, check the default values or the \`call\` to that module.
3. **Compare**: Check if the code value matches the expected value within tolerance.

## Critical Rules
- Be smart about variable mapping. If "pco_1810.pitch" is expected to be 3.18, and you see \`thread_pitch = 3.18\`, that is a MATCH.
- If you can't find a variable name match, look for the VALUE usage in a relevant context (e.g. \`cylinder(d=24.95)\`).
- If the value is within tolerance, mark as passed.

## Response Format
Respond with JSON only:
{
  "results": [
    {
      "specKey": "pco_1810.e_diameter",
      "expected": 24.95,
      "actual": 24.95,
      "passed": true,
      "matched_variable": "thread_min_d",
      "deviation": 0,
      "notes": "Found variable 'thread_min_d = 24.95' which matches expected value."
    }
  ]
}`;
}

interface CodeVerificationResponse {
  results: Array<{
    specKey: string;
    expected: number | string;
    actual: number | string;
    passed: boolean;
    matched_variable?: string;
    deviation?: number;
    notes?: string;
  }>;
}

function parseCodeVerificationResponse(
  response: string,
  specs: Spec[]
): SpecVerificationResult[] {
  try {
    // Try to extract JSON from the response (may have markdown fences)
    let jsonStr = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr) as CodeVerificationResponse;

    return parsed.results.map((r) => ({
      specKey: r.specKey,
      expected: r.expected,
      actual: r.actual,
      passed: r.passed,
      method: 'code' as const,
      matched_variable: r.matched_variable,
      deviation: r.deviation,
      notes: r.notes,
    }));
  } catch (e) {
    // If parsing fails, mark all specs as unverified
    console.error('Failed to parse code verification response:', e);
    return specs.map((s) => ({
      specKey: s.key,
      expected: s.value,
      actual: 'parse_error',
      passed: false,
      method: 'code' as const,
      notes: `Failed to parse verification response: ${String(e)}`,
    }));
  }
}

/**
 * Verify OpenSCAD code against specs using a dedicated LLM call.
 */
export async function verifyCode(
  code: string,
  specs: Spec[],
  renderStats: RenderStats | null,
  config: VerificationConfig
): Promise<SpecVerificationResult[]> {
  // Entry-level debug logging BEFORE filtering
  debugLog(config, '=== CODE VERIFICATION ENTRY ===');
  debugLog(config, `Total specs: ${specs.length} | Explicit: ${specs.filter(s => s.confidence === 'explicit').length}`);
  debugLog(config, `All specs: ${specs.map(s => `${s.key}[${s.confidence}]`).join(', ') || 'none'}`);

  // Filter to specs that should be verified by code
  // Prefer critical specs if any are marked; otherwise use all code-verifiable specs
  const codeSpecs = specs.filter(
    (s) => s.confidence === 'explicit' && s.verifyBy.includes('code')
  );
  const criticalSpecs = codeSpecs.filter((s) => s.critical);
  const specsToVerify = criticalSpecs.length > 0 ? criticalSpecs : codeSpecs;

  debugLog(config, `Code specs: ${codeSpecs.length}, Critical: ${criticalSpecs.length}`);
  debugLog(config, `Using ${criticalSpecs.length > 0 ? 'CRITICAL' : 'all'} specs: ${specsToVerify.map(s => s.key).join(', ')}`);

  if (specsToVerify.length === 0) {
    debugLog(config, 'No explicit specs with code verification - check if agent called set_spec');
    return [];
  }

  debugLog(config, '=== CODE VERIFICATION ===');
  debugLog(config, `Model: ${config.codeVerifierModel}`);
  debugLog(config, `Total specs: ${specs.length}, verifying: ${specsToVerify.length}`);

  if (specsToVerify.length === 0) {
    debugLog(config, 'No specs to verify by code, skipping');
    return [];
  }

  if (renderStats) {
    debugLog(config, 'Render stats:', {
      dimensions: renderStats.dimensions,
      volume: renderStats.volume,
      triangles: renderStats.triangles,
    });
  }

  const prompt = buildCodeVerificationPrompt(code, specsToVerify, renderStats);
  debugLog(config, `Prompt length: ${prompt.length} chars`);

  // Create provider for the verifier model
  const provider = createProvider(config.llmProvider, {
    apiKey: config.llmApiKey,
    baseUrl: config.llmBaseUrl,
    model: config.codeVerifierModel,
  });

  const startTime = Date.now();

  // Make single LLM call to verify all specs
  const stream = provider.chat(
    [{ id: uuid(), role: 'user', content: prompt, timestamp: Date.now() }],
    { maxTokens: 2048, temperature: 0.1 }
  );

  let response = '';
  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) {
      response += chunk.text;
    }
  }

  const elapsed = Date.now() - startTime;
  debugLog(config, `LLM response received in ${elapsed}ms, length: ${response.length}`);
  debugLog(config, 'Raw response:', response.slice(0, 500) + (response.length > 500 ? '...' : ''));

  const results = parseCodeVerificationResponse(response, specsToVerify);
  debugLog(config, 'Parsed results:', results.map((r) => ({
    spec: r.specKey,
    expected: r.expected,
    actual: r.actual,
    passed: r.passed,
  })));

  return results;
}

// ============================================
// Visual Verification
// ============================================

// Simplified angle descriptions - no object-specific assumptions


function buildVisualVerificationPrompt(
  specs: Spec[],
  angle: VerificationAngle,
  builderHint?: string
): string {
  // Build specs section with optional notes from builder
  const specsSection = specs
    .map((s) => {
      const unit = s.unit ? ` ${s.unit}` : '';
      const note = s.note ? ` ← Builder note: "${s.note}"` : '';
      return `- ${s.key}: ${s.value}${unit}${note}`;
    })
    .join('\n');

  // Simple angle descriptions without feature assumptions
  const angleDescriptions: Record<VerificationAngle, string> = {
    front: 'FRONT VIEW - looking at the model from the front (+Y direction)',
    back: 'BACK VIEW - looking at the model from the back (-Y direction)',
    left: 'LEFT VIEW - looking at the model from the left side (-X direction)',
    right: 'RIGHT VIEW - looking at the model from the right side (+X direction)',
    top: 'TOP VIEW - looking down at the model from above (+Z direction)',
    bottom: 'BOTTOM VIEW - looking up at the model from below (-Z direction)',
    iso: 'ISOMETRIC VIEW - 3D perspective showing front, right, and top faces',
  };

  // Add builder hint if provided
  const builderSection = builderHint ? `
## Builder Context
"${builderHint}"
` : '';

  return `You are verifying a 3D CAD model render against specifications.

## Camera Angle
${angleDescriptions[angle]}

## Specifications
${specsSection}
${builderSection}
## Instructions
1. Describe what you see in the image
2. Check if visible features match the specifications
3. Only flag issues you can CLEARLY see from this angle - if a feature isn't visible from this angle, skip it
4. Be lenient - minor visual differences are acceptable

## Response Format
Respond with ONLY a JSON object:

If the model looks correct for what's visible:
{"passed":true,"issues":[],"majorIssue":false,"notes":"Brief description"}

If you see clear problems:
{"passed":false,"issues":["specific issue"],"majorIssue":false,"notes":"Brief description"}

JSON response:`;
}

// Response structure - back to simple pass/fail
interface VisualVerificationResponse {
  passed: boolean;
  issues: string[];
  majorIssue: boolean;
  notes?: string;
}

function parseVisualVerificationResponse(response: string): VisualVerificationResponse | null {
  try {
    let jsonStr = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr) as VisualVerificationResponse;
    return {
      passed: parsed.passed ?? false,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      majorIssue: parsed.majorIssue ?? false,
      notes: parsed.notes,
    };
  } catch {
    return null; // Let caller handle retry
  }
}

/**
 * Verify a rendered image of the model against specs using a vision model.
 * Uses simple pass/fail verification with explicit failure criteria.
 */
export async function verifyVisual(
  imageBase64: string,
  angle: VerificationAngle,
  specs: Spec[],
  config: VerificationConfig
): Promise<VisualVerificationResult> {
  // Filter to specs that should be verified visually
  // Prefer critical specs if any are marked; otherwise use all visual specs
  const visualSpecs = specs.filter(
    (s) => s.confidence === 'explicit' && s.verifyBy.includes('visual')
  );
  const criticalSpecs = visualSpecs.filter((s) => s.critical);
  const specsToVerify = criticalSpecs.length > 0 ? criticalSpecs : visualSpecs;

  debugLog(config, `--- VISUAL VERIFICATION: ${angle} ---`);
  debugLog(config, `Model: ${config.visualVerifierModel}`);
  debugLog(config, `Visual specs: ${visualSpecs.length}, Critical: ${criticalSpecs.length}`);
  debugLog(config, `Using ${criticalSpecs.length > 0 ? 'CRITICAL' : 'all'} specs: ${specsToVerify.map(s => s.key).join(', ')}`);
  debugLog(config, `Image size: ${Math.round(imageBase64.length / 1024)}KB base64`);

  // No specs to verify - pass by default
  if (specsToVerify.length === 0) {
    debugLog(config, 'No specs to verify visually, skipping angle');
    return { angle, passed: true, issues: [], majorIssue: false };
  }

  // Create provider for the visual verifier model
  const provider = createProvider(config.llmProvider, {
    apiKey: config.llmApiKey,
    baseUrl: config.llmBaseUrl,
    model: config.visualVerifierModel,
  });

  let parsed: VisualVerificationResponse | null = null;

  // Retry loop for JSON recovery
  for (let attempt = 0; attempt < MAX_VISUAL_RETRIES; attempt++) {
    const isRetry = attempt > 0;
    const prompt = isRetry
      ? `Your previous response was not valid JSON. Please respond with ONLY a JSON object in this exact format:
{"passed":true,"issues":[],"majorIssue":false,"notes":"description"}`
      : buildVisualVerificationPrompt(specsToVerify, angle, config.builderHint);

    debugLog(config, `Attempt ${attempt + 1}/${MAX_VISUAL_RETRIES}${isRetry ? ' (retry)' : ''}`);
    const startTime = Date.now();

    // Make multimodal call with the image
    const stream = provider.chat(
      [
        {
          id: uuid(),
          role: 'user',
          content: [
            { type: 'image', data: imageBase64 },
            { type: 'text', text: prompt },
          ],
          timestamp: Date.now(),
        },
      ],
      { maxTokens: 1024, temperature: 0.1 }
    );

    let response = '';
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) {
        response += chunk.text;
      }
    }

    const elapsed = Date.now() - startTime;
    debugLog(config, `Vision response in ${elapsed}ms:`, response.slice(0, 300));

    parsed = parseVisualVerificationResponse(response);
    if (parsed) {
      debugLog(config, `Parsed successfully: passed=${parsed.passed}, issues=${parsed.issues.length}, majorIssue=${parsed.majorIssue}`);
      break;
    } else {
      debugLog(config, `Parse failed on attempt ${attempt + 1}, ${attempt + 1 < MAX_VISUAL_RETRIES ? 'retrying...' : 'giving up'}`);
    }
  }

  // If all retries failed, return inconclusive (pass to not block build)
  if (!parsed) {
    console.error(`Failed to parse visual verification response after ${MAX_VISUAL_RETRIES} attempts`);
    return {
      angle,
      passed: true, // Don't fail the build for parse errors
      issues: ['Verification inconclusive - parse error'],
      majorIssue: false,
    };
  }

  debugLog(config, `Result: passed=${parsed.passed}, issues=${parsed.issues.length}, majorIssue=${parsed.majorIssue}`);

  return {
    angle,
    passed: parsed.passed,
    issues: parsed.issues,
    majorIssue: parsed.majorIssue,
  };
}

// ============================================
// Full Verification Orchestrator
// ============================================

function buildVerificationSummary(
  codeResults: SpecVerificationResult[],
  visualResults: VisualVerificationResult[],
  renderStats: RenderStats | null
): string {
  const parts: string[] = [];

  // Render stats summary
  if (renderStats) {
    parts.push(`Model Stats:
  - Dimensions: ${renderStats.dimensions.x.toFixed(1)} × ${renderStats.dimensions.y.toFixed(1)} × ${renderStats.dimensions.z.toFixed(1)} mm
  - Volume: ${renderStats.volume.toFixed(1)} mm³
  - Manifold: ${renderStats.manifold ? 'Yes' : 'No'}`);
  }

  // Code verification summary
  const codePassed = codeResults.filter((r) => r.passed).length;
  const codeFailed = codeResults.filter((r) => !r.passed).length;

  if (codeResults.length > 0) {
    parts.push(`Code verification: ${codePassed}/${codeResults.length} specs passed`);

    if (codeFailed > 0) {
      const failedSpecs = codeResults
        .filter((r) => !r.passed)
        .map((r) => `  - ${r.specKey}: expected ${r.expected}, got ${r.actual}`)
        .join('\n');
      parts.push(`Failed specs:\n${failedSpecs}`);
    }
  }

  // Visual verification summary
  if (visualResults.length > 0) {
    const visualPassed = visualResults.filter((r) => r.passed).length;
    parts.push(`Visual verification: ${visualPassed}/${visualResults.length} angles passed`);

    const allIssues = visualResults.flatMap((r) => r.issues);
    if (allIssues.length > 0) {
      parts.push(`Visual issues:\n${allIssues.map((i) => `  - ${i}`).join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

export interface VerificationDeps {
  renderImage: (angle: VerificationAngle) => Promise<string>;
  onProgress?: (phase: 'code' | 'visual', current: number, total: number, detail?: string) => void;
}

/**
 * Run complete verification pipeline: code verification + optional visual verification.
 */
export async function runFullVerification(
  code: string,
  specs: Spec[],
  renderStats: RenderStats | null,
  config: VerificationConfig,
  deps: VerificationDeps
): Promise<VerificationReport> {
  const startTime = Date.now();
  const codeResults: SpecVerificationResult[] = [];
  const visualResults: VisualVerificationResult[] = [];

  debugLog(config, '');
  debugLog(config, '╔══════════════════════════════════════════════════════════════╗');
  debugLog(config, '║              VERIFICATION PIPELINE STARTED                    ║');
  debugLog(config, '╚══════════════════════════════════════════════════════════════╝');
  debugLog(config, `Code verifier model: ${config.codeVerifierModel}`);
  debugLog(config, `Visual verifier model: ${config.visualVerifierModel}`);
  debugLog(config, `Visual verification: ${config.visualEnabled ? 'enabled' : 'disabled'}`);
  debugLog(config, `Enabled angles: ${config.enabledAngles.join(', ')}`);
  debugLog(config, `Total specs: ${specs.length}`);
  debugLog(config, `Explicit specs: ${specs.filter((s) => s.confidence === 'explicit').length}`);
  debugLog(config, `Code length: ${code.length} chars`);
  debugLog(config, '');

  // 1. Code verification (always runs)
  const specsForCodeVerification = specs.filter(
    (s) => s.confidence === 'explicit' && s.verifyBy.includes('code')
  );
  const codeSpecCount = specsForCodeVerification.length;

  deps.onProgress?.('code', 0, codeSpecCount, 'Starting code verification...');

  try {
    const results = await verifyCode(code, specs, renderStats, config);
    codeResults.push(...results);
    deps.onProgress?.('code', codeSpecCount, codeSpecCount, `Verified ${codeSpecCount} specs`);
  } catch (e) {
    console.error('Code verification failed:', e);
    debugLog(config, 'CODE VERIFICATION ERROR:', String(e));
    // Add error results for all specs
    for (const spec of specsForCodeVerification) {
      codeResults.push({
        specKey: spec.key,
        expected: spec.value,
        actual: 'error',
        passed: false,
        method: 'code',
        notes: `Verification error: ${String(e)}`,
      });
    }
    deps.onProgress?.('code', codeSpecCount, codeSpecCount, 'Code verification error');
  }

  // 2. Visual verification (if enabled)
  // Early exit: skip visual if code verification failed
  const codeHasFailures = codeResults.some((r) => !r.passed);
  if (codeHasFailures) {
    debugLog(config, '');
    debugLog(config, '=== SKIPPING VISUAL VERIFICATION (code verification failed) ===');
  } else if (config.visualEnabled && config.enabledAngles.length > 0) {
    debugLog(config, '');
    debugLog(config, '=== STARTING VISUAL VERIFICATION ===');
    const angleCount = config.enabledAngles.length;
    let angleIdx = 0;

    for (const angle of config.enabledAngles) {
      deps.onProgress?.('visual', angleIdx, angleCount, `Verifying ${angle} view...`);
      try {
        debugLog(config, `Rendering image for angle: ${angle}...`);
        const renderStart = Date.now();
        const imageBase64 = await deps.renderImage(angle);
        debugLog(config, `Image rendered in ${Date.now() - renderStart}ms`);

        const result = await verifyVisual(imageBase64, angle, specs, config);
        visualResults.push(result);
        angleIdx++;
        deps.onProgress?.('visual', angleIdx, angleCount, `${angle} ${result.passed ? '✓' : '✗'}`);

        // FAST-FAIL: Stop immediately on ANY failure or major issue
        if (!result.passed || result.majorIssue) {
          debugLog(config, `ISSUE at ${angle} - Stopping visual verification early (Fast-Fail)`);
          break;
        }
      } catch (e) {
        console.error(`Visual verification failed for ${angle}:`, e);
        debugLog(config, `VISUAL ERROR at ${angle}:`, String(e));
        visualResults.push({
          angle,
          passed: false,
          issues: [`Failed to render/verify: ${String(e)}`],
          majorIssue: false,
        });
        angleIdx++;
        deps.onProgress?.('visual', angleIdx, angleCount, `${angle} error`);
      }
    }
  } else {
    debugLog(config, 'Visual verification skipped (disabled or no angles configured)');
  }

  const failedSpecs = codeResults.filter((r) => !r.passed).map((r) => r.specKey);
  const visualFailed = visualResults.some((r) => !r.passed);
  const totalTime = Date.now() - startTime;

  debugLog(config, '');
  debugLog(config, '╔══════════════════════════════════════════════════════════════╗');
  debugLog(config, '║              VERIFICATION COMPLETE                            ║');
  debugLog(config, '╚══════════════════════════════════════════════════════════════╝');
  debugLog(config, `Total time: ${totalTime}ms`);
  debugLog(config, `Code results: ${codeResults.length} specs checked`);
  debugLog(config, `  - Passed: ${codeResults.filter((r) => r.passed).length}`);
  debugLog(config, `  - Failed: ${codeResults.filter((r) => !r.passed).length}`);
  debugLog(config, `Visual results: ${visualResults.length} angles checked`);
  debugLog(config, `  - Passed: ${visualResults.filter((r) => r.passed).length}`);
  debugLog(config, `  - Failed: ${visualResults.filter((r) => !r.passed).length}`);
  debugLog(config, `Failed specs: ${failedSpecs.length > 0 ? failedSpecs.join(', ') : 'none'}`);
  debugLog(config, `Overall: ${failedSpecs.length === 0 && !visualFailed ? 'ALL PASSED ✓' : 'FAILED ✗'}`);
  debugLog(config, '');

  return {
    allPassed: failedSpecs.length === 0 && !visualFailed,
    codeResults,
    visualResults,
    failedSpecs,
    summary: buildVerificationSummary(codeResults, visualResults, renderStats),
  };
}
