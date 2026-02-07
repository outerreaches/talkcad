import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { useSettingsStore } from './store';
import { useExportSTL } from './hooks';

export default function App() {
  const setOpenSCADPath = useSettingsStore((s) => s.setOpenSCADPath);
  const openscadPath = useSettingsStore((s) => s.openscadPath);

  // Best-effort: hydrate secrets/settings from config.json (shared with CLI)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.api?.settings?.load) return;

    window.api.settings.load()
      .then((disk) => {
        if (!disk) return;
        const s = useSettingsStore.getState();

        // Hydrate OpenSCAD path independently (it's not a secret).
        const diskOpenSCADPath =
          typeof (disk as any).openscadPath === 'string' ? (disk as any).openscadPath.trim() : '';
        const localOpenSCADPath =
          typeof s.openscadPath === 'string' ? s.openscadPath.trim() : '';
        if (!localOpenSCADPath && diskOpenSCADPath) {
          s.setOpenSCADPath(diskOpenSCADPath);
          window.api.openscad.setPath(diskOpenSCADPath).catch(() => { /* best effort */ });
        }

        // Only hydrate if local state looks "empty" (avoid clobbering localStorage settings).
        const hasLocalKey = typeof s.llmApiKey === 'string' && s.llmApiKey.trim().length > 0;
        const hasDiskKey = typeof (disk as any).llmApiKey === 'string' && (disk as any).llmApiKey.trim().length > 0;
        if (hasLocalKey || !hasDiskKey) return;

        s.setLLMConfig({
          provider: (disk as any).llmProvider,
          model: (disk as any).llmModel,
          apiKey: (disk as any).llmApiKey,
          baseUrl: (disk as any).llmBaseUrl,
        });

        if (typeof (disk as any).autonomyMode === 'string') s.setAutonomyMode((disk as any).autonomyMode);
        if (typeof (disk as any).maxIterations === 'number') s.setMaxIterations((disk as any).maxIterations);
        if (typeof (disk as any).maxResearchRoundTrips === 'number') s.setMaxResearchRoundTrips((disk as any).maxResearchRoundTrips);
        if (typeof (disk as any).maxBuilderAttempts === 'number') s.setMaxBuilderAttempts((disk as any).maxBuilderAttempts);
        if (typeof (disk as any).maxRepairAttempts === 'number') s.setMaxRepairAttempts((disk as any).maxRepairAttempts);
        if (typeof (disk as any).webToolsEnabled === 'boolean') s.setWebToolsEnabled((disk as any).webToolsEnabled);

        if (typeof (disk as any).codeVerifierModel === 'string') s.setCodeVerifierModel((disk as any).codeVerifierModel);
        if (typeof (disk as any).visualVerifierModel === 'string') s.setVisualVerifierModel((disk as any).visualVerifierModel);
        if (typeof (disk as any).visualVerificationEnabled === 'boolean') s.setVisualVerificationEnabled((disk as any).visualVerificationEnabled);
        if (Array.isArray((disk as any).verificationAngles)) s.setVerificationAngles((disk as any).verificationAngles);
        if (typeof (disk as any).verificationTolerance === 'number') s.setVerificationTolerance((disk as any).verificationTolerance);

        if (typeof (disk as any).autoCompression === 'boolean') s.setAutoCompression((disk as any).autoCompression);
        if (typeof (disk as any).summarizerModel === 'string') s.setSummarizerModel((disk as any).summarizerModel);
        if (typeof (disk as any).contextThreshold === 'number') s.setContextThreshold((disk as any).contextThreshold);
      })
      .catch((e) => console.warn('Failed to load config.json settings:', e));
  }, []);

  // Detect OpenSCAD on startup
  useEffect(() => {
    const configured = typeof openscadPath === 'string' ? openscadPath.trim() : '';
    if (configured) {
      window.api.openscad.setPath(configured).catch(() => { /* best effort */ });
      return;
    }

    window.api.openscad.detectPath().then((path) => {
      if (path) {
        setOpenSCADPath(path);
        console.log('OpenSCAD found:', path);
      } else {
        console.warn('OpenSCAD not found');
      }
    });
  }, [openscadPath, setOpenSCADPath]);

  // Handle File > Export STL menu action
  useExportSTL();

  return <Layout />;
}
