import { useEffect, useCallback } from 'react';
import { useEditorStore, useRenderStore } from '../store';

/**
 * Hook to handle File > Export STL menu action
 * Listens for menu event and prompts user to save the current STL
 */
export function useExportSTL() {
    const code = useEditorStore((s) => s.code);
    const setRendering = useRenderStore((s) => s.setRendering);

    const handleExportSTL = useCallback(async () => {
        if (!code || !code.trim()) {
            console.warn('No OpenSCAD code to export');
            return;
        }

        try {
            const filePath = await window.api.dialog.saveFile({
                title: 'Export STL',
                defaultPath: 'model.stl',
                filters: [{ name: 'STL Files', extensions: ['stl'] }],
            });

            if (filePath) {
                setRendering(true);
                const result = await window.api.openscad.render(code, 'stl', { mode: 'final' });
                setRendering(false);

                if (!result.success || !result.output) {
                    console.error('OpenSCAD export failed:', result.errors || []);
                    return;
                }

                await window.api.fsBinary.writeFile(filePath, result.output);
                console.log('STL exported to:', filePath);
            }
        } catch (error) {
            setRendering(false);
            console.error('Failed to export STL:', error);
        }
    }, [code, setRendering]);

    useEffect(() => {
        const cleanup = window.api.menu.onExportSTL(handleExportSTL);
        return cleanup;
    }, [handleExportSTL]);
}
