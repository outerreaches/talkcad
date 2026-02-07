import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useSettingsStore } from '../store';
import type { AutonomyMode, NegotiationLevel, LLMProvider, VerificationAngle } from '@talkcad/shared';

const VERIFICATION_ANGLES: { value: VerificationAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'iso', label: 'Isometric' },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LLM_PROVIDERS: { value: LLMProvider; label: string; requiresApiKey: boolean; requiresBaseUrl: boolean; keyUrl?: string }[] = [
  // Cloud providers
  { value: 'openrouter', label: 'OpenRouter', requiresApiKey: true, requiresBaseUrl: false, keyUrl: 'https://openrouter.ai/keys' },
  { value: 'openai', label: 'OpenAI', requiresApiKey: true, requiresBaseUrl: false, keyUrl: 'https://platform.openai.com/api-keys' },
  { value: 'gemini', label: 'Google Gemini', requiresApiKey: true, requiresBaseUrl: false, keyUrl: 'https://aistudio.google.com/apikey' },
  { value: 'groq', label: 'Groq', requiresApiKey: true, requiresBaseUrl: false, keyUrl: 'https://console.groq.com/keys' },
  // Local providers
  { value: 'ollama', label: 'Ollama (Local)', requiresApiKey: false, requiresBaseUrl: true },
  { value: 'lmstudio', label: 'LM Studio (Local)', requiresApiKey: false, requiresBaseUrl: true },
  { value: 'llamacpp', label: 'llama.cpp (Local)', requiresApiKey: false, requiresBaseUrl: true },
  // Custom
  { value: 'custom', label: 'Custom (OpenAI-Compatible)', requiresApiKey: true, requiresBaseUrl: true },
];

const AUTONOMY_OPTIONS: { value: AutonomyMode; label: string; description: string }[] = [
  { value: 'guided', label: 'Guided', description: 'User-driven (No research or auto-verify)' },
  { value: 'researched', label: 'Researched', description: 'Research & Build (No auto-verify)' },
  { value: 'verified', label: 'Verified', description: 'Full Loop (Research + Build + Verify + Repair)' },
  { value: 'ralph', label: 'Ralph Wiggum', description: 'Infinite Self-Healing Loop (Clears context and resumes from existing state)' },
];

const NEGOTIATION_OPTIONS: { value: NegotiationLevel; label: string; description: string }[] = [
  { value: 'agreeable', label: 'Agreeable', description: 'Does what you say' },
  { value: 'helpful', label: 'Helpful', description: 'Warns about issues' },
  { value: 'opinionated', label: 'Opinionated', description: 'Suggests alternatives' },
  { value: 'strict', label: 'Strict', description: 'Pushes back on bad specs' },
  { value: 'cranky', label: 'Cranky Shop Teacher', description: 'Full pushback mode' },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const settings = useSettingsStore();
  const [apiKey, setApiKey] = useState(settings.llmApiKey);
  const [baseUrl, setBaseUrl] = useState(settings.llmBaseUrl);
  const [openscadPathInput, setOpenscadPathInput] = useState(settings.openscadPath || '');

  const provider: LLMProvider =
    LLM_PROVIDERS.some((p) => p.value === settings.llmProvider)
      ? settings.llmProvider
      : 'openrouter';

  useEffect(() => {
    if (!isOpen) return;
    setApiKey(settings.llmApiKey);
    setBaseUrl(settings.llmBaseUrl);
    setOpenscadPathInput(settings.openscadPath || '');
  }, [isOpen, settings.llmApiKey, settings.llmBaseUrl, settings.openscadPath]);

  const handleSave = async () => {
    const nextOpenSCAD = openscadPathInput.trim();
    settings.setOpenSCADPath(nextOpenSCAD.length > 0 ? nextOpenSCAD : null);
    try {
      if (typeof window !== 'undefined' && window.api?.openscad?.setPath) {
        await window.api.openscad.setPath(nextOpenSCAD);
      }
    } catch (e) {
      console.warn('Failed to set OpenSCAD path:', e);
    }

    settings.setLLMConfig({ apiKey, baseUrl });

    // Best-effort: also sync to shared config.json (used by CLI)
    try {
      const s = useSettingsStore.getState();
      if (typeof window !== 'undefined' && window.api?.settings?.save) {
        await window.api.settings.save({
          llmProvider: s.llmProvider,
          llmModel: s.llmModel,
          llmApiKey: s.llmApiKey,
          llmBaseUrl: s.llmBaseUrl,
          autonomyMode: s.autonomyMode,
          maxIterations: s.maxIterations,
          maxResearchRoundTrips: s.maxResearchRoundTrips,
          maxBuilderAttempts: s.maxBuilderAttempts,
          maxRepairAttempts: s.maxRepairAttempts,
          webToolsEnabled: s.webToolsEnabled,
          codeVerifierModel: s.codeVerifierModel,
          visualVerifierModel: s.visualVerifierModel,
          visualVerificationEnabled: s.visualVerificationEnabled,
          verificationAngles: s.verificationAngles,
          verificationTolerance: s.verificationTolerance,
          openscadPath: s.openscadPath,
          autoCompression: s.autoCompression,
          summarizerModel: s.summarizerModel,
          contextThreshold: s.contextThreshold,
        });
      }
    } catch (e) {
      console.warn('Failed to persist config.json:', e);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-800 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-medium">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-auto max-h-[60vh]">
          {/* LLM Provider */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">LLM Provider</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => settings.setLLMConfig({ provider: e.target.value as LLMProvider })}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {LLM_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic API Key field */}
              {LLM_PROVIDERS.find(p => p.value === provider)?.requiresApiKey && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      provider === 'openrouter' ? 'sk-or-...' :
                        provider === 'openai' ? 'sk-...' :
                          provider === 'groq' ? 'gsk_...' :
                            'API key'
                    }
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {LLM_PROVIDERS.find(p => p.value === provider)?.keyUrl && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Get your key at <a href={LLM_PROVIDERS.find(p => p.value === provider)?.keyUrl} target="_blank" rel="noopener" className="text-blue-400 hover:underline">{LLM_PROVIDERS.find(p => p.value === provider)?.keyUrl?.replace('https://', '')}</a>
                    </p>
                  )}
                </div>
              )}

              {/* Dynamic Base URL field */}
              {LLM_PROVIDERS.find(p => p.value === provider)?.requiresBaseUrl && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={
                      provider === 'ollama' ? 'http://localhost:11434' :
                        provider === 'lmstudio' ? 'http://localhost:1234' :
                          provider === 'llamacpp' ? 'http://localhost:8080' :
                              'http://localhost:8080'
                    }
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Model field - always shown */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Model</label>
                <input
                  type="text"
                  value={settings.llmModel}
                  onChange={(e) => settings.setLLMConfig({ model: e.target.value })}
                  placeholder={
                    provider === 'openrouter' ? 'anthropic/claude-sonnet-4' :
                      provider === 'openai' ? 'gpt-4o' :
                          provider === 'gemini' ? 'gemini-2.5-flash' :
                            provider === 'groq' ? 'llama-3.3-70b-versatile' :
                              'llama3.2'
                  }
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-zinc-200">Web access tools</div>
                    <div className="text-xs text-zinc-500">
                      Disable to prevent `web_search`, `web_fetch`, and remote `fetch_*` tools from being available.
                      For fully offline use: pick Ollama/LM Studio and disable this.
                    </div>
                    <div className="text-xs text-amber-400/90 mt-1">
                      Note: Web search currently requires an <span className="font-medium">OpenRouter</span> API key.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => settings.setWebToolsEnabled(!settings.webToolsEnabled)}
                    className={clsx(
                      'w-12 h-6 rounded-full transition-colors relative',
                      settings.webToolsEnabled ? 'bg-blue-600' : 'bg-zinc-600'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform',
                        settings.webToolsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Autonomy Mode */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Autonomy Mode</h3>
            <div className="grid grid-cols-2 gap-2">
              {AUTONOMY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => settings.setAutonomyMode(opt.value)}
                  className={clsx(
                    'text-left p-2 rounded border transition-colors',
                    settings.autonomyMode === opt.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-600 hover:border-zinc-500'
                  )}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-zinc-500">{opt.description}</div>
                </button>
              ))}
            </div>

            {/* Limits Configuration */}
            <div className="mt-3 grid grid-cols-2 gap-4 border-t border-zinc-700/50 pt-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Max Iterations (Ralph)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.maxIterations}
                  onChange={(e) => settings.setMaxIterations(parseInt(e.target.value) || 10)}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Fresh restarts in Ralph mode</p>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Builder Limit</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.maxBuilderAttempts}
                  onChange={(e) => settings.setMaxBuilderAttempts(parseInt(e.target.value) || 10)}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Max attempts to write code per loop</p>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Research Limit</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={settings.maxResearchRoundTrips}
                  onChange={(e) => settings.setMaxResearchRoundTrips(parseInt(e.target.value) || 3)}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Max web search roundtrips</p>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Repair Limit</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.maxRepairAttempts}
                  onChange={(e) => settings.setMaxRepairAttempts(parseInt(e.target.value) || 3)}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Max fixes after verification failure</p>
              </div>
            </div>
          </section>

          {/* Negotiation Style */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Agent Personality</h3>
            <div className="space-y-2">
              {NEGOTIATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => settings.setNegotiationLevel(opt.value)}
                  className={clsx(
                    'w-full text-left p-2 rounded border transition-colors',
                    settings.negotiationLevel === opt.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-600 hover:border-zinc-500'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-xs text-zinc-500">{opt.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Context Management */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Context Management</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-200">Auto-Compression</div>
                  <div className="text-xs text-zinc-500">Automatically summarize old messages when context fills up</div>
                </div>
                <button
                  onClick={() => settings.setAutoCompression(!settings.autoCompression)}
                  className={clsx(
                    'w-12 h-6 rounded-full transition-colors relative',
                    settings.autoCompression ? 'bg-blue-600' : 'bg-zinc-600'
                  )}
                >
                  <div
                    className={clsx(
                      'w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform',
                      settings.autoCompression ? 'translate-x-6' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {settings.autoCompression && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Summarizer Model</label>
                    <input
                      type="text"
                      value={settings.summarizerModel}
                      onChange={(e) => settings.setSummarizerModel(e.target.value)}
                      placeholder="openai/gpt-4o-mini"
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Cheap/fast model for summarizing old messages
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Compression Threshold (%)</label>
                    <input
                      type="number"
                      min={50}
                      max={95}
                      value={settings.contextThreshold}
                      onChange={(e) => settings.setContextThreshold(parseInt(e.target.value) || 80)}
                      className="w-24 bg-zinc-700 border border-zinc-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Compress when context reaches this % of model limit
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Context Limit (tokens)</label>
                    <input
                      type="number"
                      min={0}
                      max={2000000}
                      step={1000}
                      value={settings.contextLimit}
                      onChange={(e) => settings.setContextLimit(parseInt(e.target.value) || 0)}
                      className="w-32 bg-zinc-700 border border-zinc-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Override model context limit (0 = use default)
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Verification */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Verification</h3>
            <div className="space-y-3">
              {/* Visual verification toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-200">Visual Verification</div>
                  <div className="text-xs text-zinc-500">Use vision model to verify renders from multiple angles</div>
                </div>
                <button
                  onClick={() => settings.setVisualVerificationEnabled(!settings.visualVerificationEnabled)}
                  className={clsx(
                    'w-12 h-6 rounded-full transition-colors relative',
                    settings.visualVerificationEnabled ? 'bg-blue-600' : 'bg-zinc-600'
                  )}
                >
                  <div
                    className={clsx(
                      'w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform',
                      settings.visualVerificationEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Code Verifier Model */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Code Verifier Model</label>
                <input
                  type="text"
                  value={settings.codeVerifierModel}
                  onChange={(e) => settings.setCodeVerifierModel(e.target.value)}
                  placeholder="anthropic/claude-sonnet-4"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Model used to verify code matches specs
                </p>
              </div>

              {/* Code Verification Tolerance */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Code Verification Tolerance (mm)</label>
                <input
                  type="number"
                  min={0.01}
                  max={5}
                  step={0.1}
                  value={settings.verificationTolerance}
                  onChange={(e) => settings.setVerificationTolerance(parseFloat(e.target.value) || 0.1)}
                  className="w-24 bg-zinc-700 border border-zinc-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  How close values must be to pass verification (default: 0.1mm)
                </p>
              </div>

              {/* Visual Verifier Model */}
              {settings.visualVerificationEnabled && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Visual Verifier Model</label>
                    <input
                      type="text"
                      value={settings.visualVerifierModel}
                      onChange={(e) => settings.setVisualVerifierModel(e.target.value)}
                      placeholder="anthropic/claude-sonnet-4"
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Vision model used to verify rendered images
                    </p>
                  </div>

                  {/* Camera Angles */}
                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">Verification Angles</label>
                    <div className="flex flex-wrap gap-2">
                      {VERIFICATION_ANGLES.map((angle) => {
                        const isEnabled = settings.verificationAngles.includes(angle.value);
                        return (
                          <button
                            key={angle.value}
                            onClick={() => {
                              const current = settings.verificationAngles;
                              const next = isEnabled
                                ? current.filter((a) => a !== angle.value)
                                : [...current, angle.value];
                              settings.setVerificationAngles(next);
                            }}
                            className={clsx(
                              'px-2 py-1 text-xs rounded border transition-colors',
                              isEnabled
                                ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
                            )}
                          >
                            {angle.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Select which camera angles to render for visual verification
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* OpenSCAD */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">OpenSCAD</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={openscadPathInput}
                onChange={(e) => setOpenscadPathInput(e.target.value)}
                placeholder="Path to OpenSCAD executable..."
                className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                onClick={async () => {
                  const p = openscadPathInput.trim();
                  settings.setOpenSCADPath(p.length > 0 ? p : null);
                  try { await window.api.openscad.setPath(p); } catch { /* ignore */ }
                }}
                className="px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm hover:bg-zinc-600 transition-colors"
              >
                Set
              </button>
              <button
                onClick={async () => {
                  const path = await window.api.openscad.detectPath();
                  if (path) {
                    setOpenscadPathInput(path);
                    settings.setOpenSCADPath(path);
                  }
                }}
                className="px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm hover:bg-zinc-600 transition-colors"
              >
                Detect
              </button>
            </div>
            {settings.openscadPath && (
              <p className="text-xs text-green-400 mt-1">✓ Found: {settings.openscadPath}</p>
            )}
          </section>

          {/* Preview */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Preview</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Mesh Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.meshColor}
                    onChange={(e) => settings.setMeshColor(e.target.value)}
                    className="w-10 h-10 rounded border border-zinc-600 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={settings.meshColor}
                    onChange={(e) => settings.setMeshColor(e.target.value)}
                    placeholder="#60a5fa"
                    className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Color of the 3D mesh in the preview viewport
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
