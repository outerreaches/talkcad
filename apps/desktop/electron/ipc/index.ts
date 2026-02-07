/**
 * IPC Handler Registration
 * Central entry point for all IPC handlers
 */
import { BrowserWindow } from 'electron';
import { registerFsHandlers } from './fs';
import { registerSkillsHandlers } from './skills';
import { registerFetchHandlers } from './fetch';
import { registerVectorizeHandlers } from './vectorize';
import { registerPdfHandlers } from './pdf';
import { registerOpenscadHandlers, detectOpenSCAD } from './openscad';
import { registerSessionHandlers } from './session';
import { registerConfigHandlers } from './config';
import { registerLlmHandlers } from './llm';

export { detectOpenSCAD };

export function registerAllHandlers(getMainWindow: () => BrowserWindow | null) {
    registerFsHandlers(getMainWindow);
    registerSkillsHandlers();
    registerFetchHandlers();
    registerVectorizeHandlers();
    registerPdfHandlers();
    registerOpenscadHandlers();
    registerSessionHandlers();
    registerConfigHandlers();
    registerLlmHandlers();
}
