import type { Tool } from '../llm/types';
import type { ResearchSession } from './research-session';
import type { TemporaryResearchKB } from './temp-kb';

export type { Tool };

function sanitizeValidation(
  result: { valid: boolean; errors: string[]; warnings: string[] }
): { valid: boolean; errors: string[]; warnings: string[] } {
  const maxItems = 5;
  const maxChars = 300;

  const truncate = (s: string) => s.length > maxChars ? s.slice(0, maxChars) + '... (truncated)' : s;

  return {
    valid: result.valid,
    errors: result.errors.slice(0, maxItems).map(truncate),
    warnings: result.warnings.slice(0, maxItems).map(truncate),
  };
}

export interface ToolContext {
  code: string;
  setCode: (code: string) => void;
  validate: () => Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;
  searchSkills: (query: string, category?: string) => Promise<SkillPreview[]>;
  getSkillFull: (path: string, sessionId: string) => Promise<SkillFull | null>;
  webSearch: (query: string) => Promise<string>;  // Web search via OpenRouter :online
  askUser: (questions: string[], context?: string) => void;
  setSpec: (key: string, value: unknown, unit?: string, critical?: boolean, note?: string) => { isUpdate: boolean; previousValue?: unknown } | void;
  updateScratchpad: (entry: {
    action: string;
    result: 'success' | 'error' | 'warning';
    details?: string;
    issues?: string[];
    learnings?: string[];
  }) => void;
  createSkill: (args: { title: string; tags: string[]; content: string; schematicBase64?: string; update?: boolean }) => Promise<{ success: boolean; path?: string; error?: string; updated?: boolean }>;
  fetchRasterImage: (url: string, name: string) => Promise<{
    success: boolean;
    path?: string;
    absolutePath?: string;
    error?: string;
    stored?: boolean;
    contentType?: string;
  }>;
  fetchSvgSchematic: (url: string, name: string) => Promise<{
    success: boolean;
    path?: string;
    absolutePath?: string;
    error?: string;
    stored?: boolean;
  }>;
  webFetch: (url: string) => Promise<{ success: boolean; html?: string; error?: string }>;
  vectorizeSchematic: (args: { imageBase64?: string; storedImagePath?: string; name: string; threshold?: number }) => Promise<{ success: boolean; path?: string; absolutePath?: string; svg?: string; error?: string; note?: string }>;
  fetchPdfSchematic: (url: string) => Promise<{
    success: boolean;
    pageCount?: number;
    text?: string;
    metadata?: unknown;
    images?: { base64?: string; path?: string; index: number; width: number; height: number; sizeBytes: number }[];
    imageCount?: number;
    stored?: boolean;
    error?: string;
  }>;
  sessionId: string;  // Current session ID for asset storage

  // Verification hint (for repair attempts - explains expected features to verifier)
  setVerificationHint: (hint: string) => void;

  // Research session for systematic web research (queue URLs, cache content)
  researchSession: ResearchSession;

  // Temporary Knowledge Base for research findings
  tempKB: TemporaryResearchKB;
}

// Skill preview from search
export interface SkillPreview {
  title: string;
  tags: string[];
  preview: string;
  path: string;
  source: string;
}

// Full skill content (schematic has path to session asset)
export interface SkillFull {
  title: string;
  tags: string[];
  content: string;
  path: string;
  source: string;
  schematic?: { type: 'svg' | 'png'; path: string };
}

// URL noise patterns to filter out
const URL_NOISE_PATTERNS = [
  /\.css(\?|$)/i,
  /\.js(\?|$)/i,
  /favicon/i,
  /\.ico(\?|$)/i,
  /\.woff2?(\?|$)/i,
  /\.ttf(\?|$)/i,
  /\.eot(\?|$)/i,
  /assets\/production\//i,
  /githubassets\.com/i,
  /googletagmanager\.com/i,
  /googlesyndication\.com/i,
  /google-analytics\.com/i,
  /analytics/i,
  /tracking/i,
  /advertisement/i,
  /pagead/i,
  /doubleclick/i,
  /s3\.amazonaws\.com.*assets/i,
  /cdn\..*\/(js|css|fonts)\//i,
  /polyfill/i,
  /bundle\.(js|css)/i,
  /chunk\./i,
  /vendor\./i,
  /manifest\./i,
];

// File extensions we can process (SVG, PDF, images)
const PROCESSABLE_FILE_EXT_RE = /\.(svg|pdf|png|jpe?g|webp|gif)(\?.*)?$/i;

function extractUrlsFromText(text: string): string[] {
  const urls = new Set<string>();
  const re = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
  for (const match of text.matchAll(re)) {
    const u = match[0].replace(/[.,;:]+$/, '');
    if (u.startsWith('http://') || u.startsWith('https://')) urls.add(u);
  }
  return Array.from(urls);
}

function isUsefulUrl(url: string): boolean {
  return !URL_NOISE_PATTERNS.some(p => p.test(url));
}

function splitUrlsByType(urls: string[]): { fileUrls: string[]; pageUrls: string[] } {
  const useful = urls.filter(isUsefulUrl);
  const fileUrls = useful.filter((u) => PROCESSABLE_FILE_EXT_RE.test(u));
  const pageUrls = useful.filter((u) => !PROCESSABLE_FILE_EXT_RE.test(u));
  return { fileUrls, pageUrls };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  switch (name) {
    case 'retrieve_skill': {
      const skills = await context.searchSkills(
        args.query as string,
        args.category as string | undefined
      );
      return { skills };
    }

    case 'retrieve_skill_full': {
      // Pass sessionId so main.ts can copy schematic to session assets if present
      const skill = await context.getSkillFull(args.path as string, context.sessionId);
      if (!skill) {
        return { error: 'Skill not found', path: args.path };
      }
      // Schematic path is already set by main.ts if skill has one
      return { skill };
    }

    case 'create_skill': {
      const result = await context.createSkill({
        title: args.title as string,
        tags: args.tags as string[],
        content: args.content as string,
        schematicBase64: args.schematicBase64 as string | undefined,
        update: args.update as boolean | undefined,
      });
      return result;
    }

    case 'ask_clarification': {
      const questions = (args.questions as string).split('\n').filter(Boolean);
      context.askUser(questions, args.context as string | undefined);
      return { status: 'questions_sent', questions };
    }

    case 'generate_openscad': {
      context.setCode(args.code as string);
      const validation = await context.validate();
      const sanitized = sanitizeValidation(validation);
      return {
        status: 'code_updated',
        description: args.description,
        valid: sanitized.valid,
        errors: sanitized.errors,
        warnings: sanitized.warnings
      };
    }

    case 'edit_openscad': {
      // Backward-compatible: support either:
      // - { search, replace, description? }   (current tool schema)
      // - { edits: stringified JSON array, reason? } (older schema)
      const edits: Array<{ find: string; replace: string }> = [];

      const search = args.search;
      const replace = args.replace;
      if (typeof search === 'string' && typeof replace === 'string') {
        edits.push({ find: search, replace });
      } else if (typeof args.edits === 'string') {
        try {
          const parsed = JSON.parse(args.edits) as Array<{ find: string; replace: string }>;
          if (Array.isArray(parsed)) {
            for (const e of parsed) {
              if (typeof e?.find === 'string' && typeof e?.replace === 'string') {
                edits.push({ find: e.find, replace: e.replace });
              }
            }
          }
        } catch {
          // fall through to validation error below
        }
      }

      if (edits.length === 0) {
        return {
          status: 'error',
          error: 'edit_openscad requires {search, replace} (or legacy {edits})',
        };
      }

      let code = context.code;
      for (const edit of edits) {
        code = code.replace(edit.find, edit.replace);
      }

      context.setCode(code);
      const validation = await context.validate();
      const sanitized = sanitizeValidation(validation);
      return {
        status: 'code_edited',
        edits_applied: edits.length,
        description: args.description,
        valid: sanitized.valid,
        errors: sanitized.errors,
        warnings: sanitized.warnings,
      };
    }

    case 'validate_openscad': {
      const result = await context.validate();
      const sanitized = sanitizeValidation(result);
      return {
        status: sanitized.valid ? 'valid' : 'error',
        valid: sanitized.valid,
        errors: sanitized.errors,
        warnings: sanitized.warnings
      };
    }

    case 'replace_lines': {
      const startLine = args.start_line as number;
      const endLine = args.end_line as number;
      const newCode = args.new_code as string;

      const lines = context.code.split('\n');
      const lineCount = lines.length;

      // Validate line numbers
      if (startLine < 1 || endLine < 1 || startLine > lineCount || endLine > lineCount) {
        return {
          status: 'error',
          error: `Invalid line range: ${startLine}-${endLine}. File has ${lineCount} lines.`,
        };
      }
      if (startLine > endLine) {
        return {
          status: 'error',
          error: `start_line (${startLine}) must be <= end_line (${endLine}).`,
        };
      }

      // Perform the replacement (0-indexed splice)
      const newLines = newCode.split('\n');
      const before = lines.slice(0, startLine - 1);
      const after = lines.slice(endLine);
      const updatedCode = [...before, ...newLines, ...after].join('\n');

      context.setCode(updatedCode);
      const validation = await context.validate();
      const sanitized = sanitizeValidation(validation);

      return {
        status: 'lines_replaced',
        replaced: { start: startLine, end: endLine, linesRemoved: endLine - startLine + 1 },
        inserted: { lines: newLines.length },
        newLineCount: updatedCode.split('\n').length,
        description: args.description,
        valid: sanitized.valid,
        errors: sanitized.errors,
        warnings: sanitized.warnings,
      };
    }

    case 'read_code': {
      const code = context.code;
      if (!code || code.trim().length === 0) {
        return { status: 'empty', message: 'No code exists yet' };
      }
      // Return code with line numbers for easier reference
      const lines = code.split('\n');
      const numberedCode = lines
        .map((line, i) => `${String(i + 1).padStart(3, ' ')} | ${line}`)
        .join('\n');
      return {
        status: 'success',
        code: numberedCode,
        lineCount: lines.length,
      };
    }

    case 'set_spec': {
      const result = context.setSpec(
        args.key as string,
        args.value,
        args.unit as string | undefined,
        args.critical as boolean | undefined,
        args.note as string | undefined
      );
      if (result?.isUpdate) {
        return {
          status: 'spec_updated',
          key: args.key,
          value: args.value,
          critical: args.critical ?? false,
          previousValue: result.previousValue,
          message: 'Existing spec was updated with new value'
        };
      }
      return { status: 'spec_recorded', key: args.key, value: args.value, critical: args.critical ?? false, note: args.note };
    }

    case 'set_verification_hint': {
      context.setVerificationHint(args.hint as string);
      return { status: 'hint_set', hint: args.hint };
    }

    case 'expand_spec': {
      const parentKey = args.parent_key as string;
      const source = (args.source as string) || 'inferred';

      let subSpecs: Array<{ key: string; value: unknown; unit?: string }>;
      try {
        subSpecs = JSON.parse(args.sub_specs as string);
      } catch {
        return { status: 'error', message: 'Failed to parse sub_specs JSON' };
      }

      if (!Array.isArray(subSpecs) || subSpecs.length === 0) {
        return { status: 'error', message: 'sub_specs must be a non-empty array' };
      }

      const created: string[] = [];
      for (const subSpec of subSpecs) {
        const fullKey = `${parentKey}.${subSpec.key}`;
        context.setSpec(
          fullKey,
          subSpec.value,
          subSpec.unit,
          undefined  // Not marking expanded specs as critical by default
        );
        created.push(fullKey);
      }

      return {
        status: 'specs_expanded',
        parent_key: parentKey,
        sub_specs_created: created,
        count: created.length,
        source,
      };
    }

    case 'update_scratchpad': {
      context.updateScratchpad({
        action: args.action as string,
        result: args.result as 'success' | 'error' | 'warning',
        details: args.details as string | undefined,
        issues: args.issues ? (args.issues as string).split(',').map((s) => s.trim()) : undefined,
        learnings: args.learnings
          ? (args.learnings as string).split(',').map((s) => s.trim())
          : undefined,
      });
      return { status: 'scratchpad_updated' };
    }

    case 'web_search': {
      const query = args.query as string;
      const session = context.researchSession;

      // Perform the search
      const results = await context.webSearch(query);
      session.recordSearch(query);

      // Extract URLs from results for the queue (background only)
      const urls = extractUrlsFromText(results);
      const { fileUrls, pageUrls } = splitUrlsByType(urls);
      const allUrls = [...fileUrls, ...pageUrls];
      session.addUrls(allUrls, query, 'search');

      // Parse and formatting for DIRECT agent consumption
      let summary = '';
      try {
        const parsed = JSON.parse(results);
        if (Array.isArray(parsed?.results)) {
          // Return rich summary: Title + URL + Snippet
          summary = parsed.results.slice(0, 8).map((r: { title?: string; url?: string; content?: string }) =>
            `[${r.title || 'Untitled'}](${r.url})\n${r.content ? `"${r.content.slice(0, 150)}..."` : ''}`
          ).join('\n\n');
        }
      } catch {
        summary = results.slice(0, 500);
      }

      return {
        status: 'success',
        query,
        results_preview: summary,
        result_count: allUrls.length,
        message: `Found ${allUrls.length} results. Top results:\n\n${summary}\n\nUse web_fetch(url) to read a specific page, or fetch_next() to explore automatically.`,
      };
    }

    case 'web_fetch': {
      const fetchArgs = args as { url: string };
      if (!fetchArgs.url) return { status: 'error', error: 'Missing url' };

      const session = context.researchSession;
      const res = await context.webFetch(fetchArgs.url);

      if (res.success) {
        const html = res.html || '';

        // Use the new text extraction
        const { extractTextFromHtml } = await import('./research-session');
        const extracted = extractTextFromHtml(html);

        // Cache the content in the session (background)
        session.cacheContent(fetchArgs.url, {
          url: fetchArgs.url,
          fetchedAt: Date.now(),
          title: extracted.title,
          extractedText: extracted.text,
          extractedUrls: extracted.urls,
          rawLength: html.length,
        });
        session.markFetched(fetchArgs.url, true);

        // Filter for file URLs (PDF/SVG/IMG) that the agent might want
        const fileUrls = extracted.urls.filter(u => /\.(pdf|svg|png|jpe?g)$/i.test(u));

        return {
          status: 'success',
          url: fetchArgs.url,
          title: extracted.title,
          content: extracted.text.slice(0, 5000), // Return generous amount of text
          file_links: fileUrls.slice(0, 10),
          message: `Fetched ${extracted.title}. Analyzed ${extracted.text.length} chars.`,
        };
      }

      session.markFetched(fetchArgs.url, false, res.error);
      return { status: 'error', error: res.error };
    }

    case 'fetch_next': {
      const session = context.researchSession;
      const next = session.getNextPendingUrl();

      if (!next) {
        const stats = session.getStats();
        return {
          status: 'exhausted',
          message: 'No more URLs to fetch. Research queue is empty.',
          stats,
          suggestion: stats.contentCached > 0
            ? 'Use extract_from_cache to search cached content for dimensions.'
            : 'Use web_search with a different query to find more sources.',
        };
      }

      // Check if it's a GitHub URL - use API instead of HTML scraping
      const githubMatch = next.url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (githubMatch) {
        const { fetchGitHubRepoFiles } = await import('./research-session');
        const result = await fetchGitHubRepoFiles(next.url);

        if (result.error) {
          session.markFetched(next.url, false, result.error);
          const stats = session.getStats();
          return {
            status: 'fetch_failed',
            url: next.url,
            error: result.error,
            remaining: stats.urlsPending,
            message: `GitHub API error. ${stats.urlsPending} URLs remaining.`,
          };
        }

        // Add file download URLs to queue
        const downloadUrls = result.files.map(f => f.downloadUrl);
        session.addUrls(downloadUrls, next.query, 'extracted');
        session.markFetched(next.url, true);

        // Cache a summary
        session.cacheContent(next.url, {
          url: next.url,
          fetchedAt: Date.now(),
          title: `GitHub: ${githubMatch[1]}/${githubMatch[2]}`,
          extractedText: `Files: ${result.files.map(f => f.name).join(', ')}`,
          extractedUrls: downloadUrls,
          rawLength: 0,
        });

        const stats = session.getStats();
        return {
          status: 'success',
          url: next.url,
          type: 'github_repo',
          files_found: result.files.map(f => ({ name: f.name, size: f.size })),
          urls_added: downloadUrls.length,
          remaining: stats.urlsPending,
          message: `Found ${result.files.length} files via GitHub API. ${stats.urlsPending} URLs remaining.`,
        };
      }

      // Regular HTTP fetch
      const res = await context.webFetch(next.url);

      if (!res.success) {
        session.markFetched(next.url, false, res.error);
        const stats = session.getStats();
        return {
          status: 'fetch_failed',
          url: next.url,
          error: res.error,
          remaining: stats.urlsPending,
          message: `Failed: ${res.error}. ${stats.urlsPending} URLs remaining.`,
        };
      }

      const html = res.html || '';
      const { extractTextFromHtml } = await import('./research-session');
      const extracted = extractTextFromHtml(html);

      // Check if we got meaningful content
      if (extracted.text.length < 100) {
        session.markNoContent(next.url);
        const stats = session.getStats();
        return {
          status: 'no_content',
          url: next.url,
          remaining: stats.urlsPending,
          message: `Page had no useful content. ${stats.urlsPending} URLs remaining.`,
        };
      }

      // Cache the content
      session.cacheContent(next.url, {
        url: next.url,
        fetchedAt: Date.now(),
        title: extracted.title,
        extractedText: extracted.text,
        extractedUrls: extracted.urls,
        rawLength: html.length,
      });
      session.markFetched(next.url, true);

      // Add discovered URLs to queue
      const added = session.addUrls(extracted.urls, next.query, 'extracted');

      const stats = session.getStats();
      return {
        status: 'success',
        url: next.url,
        title: extracted.title,
        content: extracted.text.slice(0, 3000), // Truncate for context
        urls_discovered: added,
        remaining: stats.urlsPending,
        cached_pages: stats.contentCached,
        message: `Content cached (${extracted.text.length} chars). ${stats.urlsPending} URLs remaining.`,
      };
    }

    case 'get_research_status': {
      const session = context.researchSession;
      const stats = session.getStats();
      const summary = session.getSummary();

      return {
        status: 'ok',
        ...stats,
        queries_performed: summary.queriesPerformed,
        content_sources: summary.contentSources.slice(0, 10),
        recommendation: stats.isExhausted
          ? stats.contentCached > 0
            ? 'Queue exhausted. Use extract_from_cache to search cached content.'
            : 'Queue exhausted with no content. Try a different search query.'
          : stats.urlsPending > 0
            ? `Call fetch_next to process ${stats.urlsPending} pending URLs.`
            : 'No URLs queued. Use web_search to find sources.',
      };
    }

    case 'extract_from_cache': {
      const topic = args.topic as string;
      if (!topic) return { status: 'error', error: 'Missing topic' };

      const session = context.researchSession;
      const { extractDimensionPatterns } = await import('./research-session');

      const allContent = session.getAllCachedContent();
      if (allContent.length === 0) {
        return {
          status: 'no_cache',
          message: 'No cached content to search. Use web_search and fetch_next first.',
        };
      }

      const results: Array<{ url: string; title: string; matches: string[] }> = [];

      for (const cached of allContent) {
        const matches = extractDimensionPatterns(cached.extractedText, topic);
        if (matches.length > 0) {
          results.push({
            url: cached.url,
            title: cached.title,
            matches: matches.slice(0, 5), // Limit matches per source
          });
        }
      }

      return {
        status: results.length > 0 ? 'found' : 'not_found',
        topic,
        sources_scanned: allContent.length,
        matches: results,
        message: results.length > 0
          ? `Found ${results.reduce((sum, r) => sum + r.matches.length, 0)} dimension patterns across ${results.length} sources.`
          : `No dimension patterns found for "${topic}" in ${allContent.length} cached pages.`,
      };
    }

    case 'fetch_raster_image': {
      const fetchArgs = args as { url: string; name: string };
      if (!fetchArgs.url || !fetchArgs.name) return { status: 'error', error: 'Missing url or name' };

      const res = await context.fetchRasterImage(fetchArgs.url, fetchArgs.name);
      if (res.success) {
        return {
          status: 'image_stored',
          path: res.path,
          message: `Image stored to ${res.path}. Use vectorize_schematic with this path to convert to SVG.`
        };
      }
      return { status: 'error', error: res.error };
    }

    case 'fetch_svg_schematic': {
      const fetchArgs = args as { url: string; name: string };
      if (!fetchArgs.url || !fetchArgs.name) return { status: 'error', error: 'Missing url or name' };

      const res = await context.fetchSvgSchematic(fetchArgs.url, fetchArgs.name);
      if (res.success) {
        return {
          status: 'svg_stored',
          path: res.path,
          message: `SVG stored to ${res.path}. You can import it directly using linear_extrude(height) import("${res.path}").`
        };
      }
      return { status: 'error', error: res.error };
    }

    case 'vectorize_schematic': {
      const imageBase64 = args.imageBase64 as string | undefined;
      const storedImagePath = args.storedImagePath as string | undefined;
      if (!imageBase64 && !storedImagePath) {
        return { status: 'error', error: 'Either imageBase64 or storedImagePath is required' };
      }
      const result = await context.vectorizeSchematic({
        imageBase64,
        storedImagePath,
        name: args.name as string,
        threshold: args.threshold as number | undefined,
      });
      if (!result.success) {
        return { status: 'error', error: result.error };
      }
      return {
        status: 'vectorized',
        path: result.path,
        note: result.note,
        message: `SVG created at ${result.path}. Use: linear_extrude(height) import("${result.path}", center=true);`,
      };
    }

    case 'fetch_pdf_schematic': {
      const result = await context.fetchPdfSchematic(args.url as string);
      if (!result.success) {
        return { status: 'error', error: result.error };
      }
      const first = result.images?.[0];
      return {
        status: 'pdf_parsed',
        pageCount: result.pageCount,
        textPreview: result.text?.slice(0, 1000),
        imageCount: result.imageCount,
        images: result.images?.slice(0, 5), // Return first 5 images max
        message: result.imageCount && result.imageCount > 0
          ? (first?.path
            ? `Found ${result.imageCount} embedded images (stored as session assets). Use vectorize_schematic with storedImagePath, e.g. {"storedImagePath":"${first.path}","name":"schematic"}.`
            : `Found ${result.imageCount} embedded images. Use vectorize_schematic with imageBase64 to convert to SVG.`)
          : 'No embedded images found. Use text content for dimensions or search for PNG/JPG versions.',
      };
    }

    // === Temp KB Tools ===

    case 'submit_research_finding': {
      const topic = args.topic as string;
      const type = args.type as any;
      const data = args.data;
      const confidence = args.confidence as any;

      if (!topic || !type || !data || !confidence) {
        return { status: 'error', error: 'Missing required fields (topic, type, data, confidence)' };
      }

      const id = context.tempKB.submit({
        topic,
        type,
        data,
        confidence,
        sourceUrl: args.sourceUrl as string | undefined,
        sourceDescription: args.sourceDescription as string | undefined,
      });

      return {
        status: 'finding_submitted',
        id,
        topic,
        message: `Finding submitted for topic "${topic}"`
      };
    }

    case 'get_research_finding': {
      const topic = args.topic as string;
      if (!topic) return { status: 'error', error: 'Missing topic' };

      const finding = context.tempKB.get(topic);
      if (!finding) {
        return { status: 'not_found', topic, message: 'No finding exists for this topic' };
      }

      // Mark as used by this tool call
      // (Using a placeholder ID since we don't have the current tool call ID here easily without refactoring)
      context.tempKB.markUsed(finding.id, 'tool_consumption');

      return {
        status: 'found',
        finding: {
          topic: finding.topic,
          type: finding.type,
          data: finding.data,
          sourceUrl: finding.sourceUrl,
          confidence: finding.confidence,
        }
      };
    }

    case 'list_research_findings': {
      const type = args.type as any;
      let findings = context.tempKB.list();

      if (type) {
        findings = findings.filter(f => f.type === type);
      }

      return {
        status: 'success',
        count: findings.length,
        findings: findings.map(f => ({
          topic: f.topic,
          type: f.type,
          confidence: f.confidence,
          hasSource: f.hasSource,
        })),
        message: findings.length > 0
          ? `Found ${findings.length} findings. Use get_research_finding(topic) to read data.`
          : 'No findings in temporary KB.'
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
