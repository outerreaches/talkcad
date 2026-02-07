/**
 * ResearchSession - Manages URL queue, content cache, and search history
 * for systematic web research within the agent loop.
 * 
 * This prevents the wasteful pattern of:
 *   search → random fetch → fail → search again
 * 
 * Instead:
 *   search → queue URLs → fetch systematically → cache content → extract facts
 */

export interface QueuedUrl {
  url: string;
  source: 'search' | 'extracted';
  query: string;
  priority: number;
  status: 'pending' | 'fetched' | 'failed' | 'no_content';
  errorReason?: string;
  addedAt: number;
  fetchedAt?: number;
}

export interface CachedContent {
  url: string;
  fetchedAt: number;
  title: string;
  extractedText: string;
  extractedUrls: string[];
  rawLength: number;
}

export interface ResearchFinding {
  topic: string;
  data: string;
  sourceUrl: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ResearchSessionStats {
  searchesPerformed: number;
  urlsTotal: number;
  urlsPending: number;
  urlsFetched: number;
  urlsFailed: number;
  contentCached: number;
  findingsPending: number;
  isExhausted: boolean;
}

export class ResearchSession {
  private urls: Map<string, QueuedUrl> = new Map();
  private contentCache: Map<string, CachedContent> = new Map();
  private searchHistory: Set<string> = new Set();
  private pendingFindings: ResearchFinding[] = [];

  /**
   * Normalize a search query for deduplication
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .sort()
      .join(' ')
      .trim();
  }

  /**
   * Check if a similar search has already been performed
   */
  hasSearched(query: string): boolean {
    return this.searchHistory.has(this.normalizeQuery(query));
  }

  /**
   * Record that a search was performed
   */
  recordSearch(query: string): void {
    this.searchHistory.add(this.normalizeQuery(query));
  }

  /**
   * Score a URL for priority (higher = fetch first)
   */
  private scoreUrl(url: string, query: string): number {
    let score = 50;

    // Boost for known good sources
    if (url.includes('github.com')) score += 25;
    if (url.includes('raw.githubusercontent.com')) score += 30;
    if (url.includes('grabcad.com')) score += 20;
    if (url.includes('thingiverse.com')) score += 15;
    if (url.includes('printables.com')) score += 15;
    if (url.includes('datasheets')) score += 20;
    if (url.includes('datasheet')) score += 20;
    if (url.includes('specs') || url.includes('specifications')) score += 15;

    // Boost for file extensions we can process
    if (/\.(pdf)$/i.test(url)) score += 35;
    if (/\.(svg)$/i.test(url)) score += 30;
    if (/\.(png|jpe?g)$/i.test(url)) score += 20;

    // Penalize known bad patterns
    if (url.includes('login')) score -= 40;
    if (url.includes('signup')) score -= 40;
    if (url.includes('register')) score -= 40;
    if (url.includes('pinterest')) score -= 35;
    if (url.includes('facebook')) score -= 30;
    if (url.includes('twitter')) score -= 30;
    if (url.includes('instagram')) score -= 30;
    if (url.includes('reddit.com/r/')) score -= 10; // Reddit threads often low value
    if (url.includes('amazon.com')) score -= 20;
    if (url.includes('ebay.com')) score -= 20;

    // Boost if URL contains query keywords
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const kw of keywords) {
      if (url.toLowerCase().includes(kw)) score += 8;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Add URLs to the queue (deduplicates automatically)
   */
  addUrls(urls: string[], query: string, source: 'search' | 'extracted'): number {
    let added = 0;
    const now = Date.now();

    for (const url of urls) {
      // Skip if already in queue
      if (this.urls.has(url)) continue;

      // Skip obviously bad URLs
      if (!url.startsWith('http')) continue;
      if (url.length > 500) continue;

      this.urls.set(url, {
        url,
        source,
        query,
        priority: this.scoreUrl(url, query),
        status: 'pending',
        addedAt: now,
      });
      added++;
    }

    return added;
  }

  /**
   * Get the next highest-priority pending URL
   */
  getNextPendingUrl(): QueuedUrl | null {
    let best: QueuedUrl | null = null;
    let bestPriority = -1;

    for (const queued of this.urls.values()) {
      if (queued.status === 'pending' && queued.priority > bestPriority) {
        best = queued;
        bestPriority = queued.priority;
      }
    }

    return best;
  }

  /**
   * Mark a URL as fetched (successfully or failed)
   */
  markFetched(url: string, success: boolean, errorReason?: string): void {
    const queued = this.urls.get(url);
    if (queued) {
      queued.status = success ? 'fetched' : 'failed';
      queued.fetchedAt = Date.now();
      if (errorReason) queued.errorReason = errorReason;
    }
  }

  /**
   * Mark a URL as having no useful content
   */
  markNoContent(url: string): void {
    const queued = this.urls.get(url);
    if (queued) {
      queued.status = 'no_content';
      queued.fetchedAt = Date.now();
    }
  }

  /**
   * Cache fetched content
   */
  cacheContent(url: string, content: CachedContent): void {
    this.contentCache.set(url, content);
  }

  /**
   * Get cached content for a URL
   */
  getCachedContent(url: string): CachedContent | null {
    return this.contentCache.get(url) || null;
  }

  /**
   * Get all cached content
   */
  getAllCachedContent(): CachedContent[] {
    return Array.from(this.contentCache.values());
  }

  /**
   * Add a pending finding (to be submitted to temp KB)
   */
  addFinding(finding: ResearchFinding): void {
    this.pendingFindings.push(finding);
  }

  /**
   * Get and clear pending findings
   */
  consumeFindings(): ResearchFinding[] {
    const findings = [...this.pendingFindings];
    this.pendingFindings = [];
    return findings;
  }

  /**
   * Get session statistics
   */
  getStats(): ResearchSessionStats {
    let pending = 0, fetched = 0, failed = 0;

    for (const queued of this.urls.values()) {
      switch (queued.status) {
        case 'pending': pending++; break;
        case 'fetched': fetched++; break;
        case 'failed':
        case 'no_content': failed++; break;
      }
    }

    return {
      searchesPerformed: this.searchHistory.size,
      urlsTotal: this.urls.size,
      urlsPending: pending,
      urlsFetched: fetched,
      urlsFailed: failed,
      contentCached: this.contentCache.size,
      findingsPending: this.pendingFindings.length,
      isExhausted: pending === 0 && this.searchHistory.size > 0,
    };
  }

  /**
   * Check if research should stop
   */
  shouldStop(budget: { maxSearches: number; maxFetches: number }): { stop: boolean; reason: string } {
    const stats = this.getStats();

    // Success: found useful content
    if (stats.findingsPending > 0) {
      return { stop: true, reason: 'found_data' };
    }

    // Exhausted: no more URLs to try
    if (stats.urlsPending === 0 && stats.searchesPerformed > 0) {
      return { stop: true, reason: 'urls_exhausted' };
    }

    // Budget: can't search or fetch anymore
    if (stats.searchesPerformed >= budget.maxSearches && stats.urlsFetched >= budget.maxFetches) {
      return { stop: true, reason: 'budget_exhausted' };
    }

    // Failure pattern: many fetches, no useful content
    if (stats.urlsFetched > 5 && stats.contentCached === 0) {
      return { stop: true, reason: 'all_fetches_failed' };
    }

    return { stop: false, reason: '' };
  }

  /**
   * Get a summary for handoff to next round-trip
   */
  getSummary(): {
    searchesPerformed: number;
    urlsFetched: number;
    urlsFailed: number;
    contentSources: string[];
    queriesPerformed: string[];
    exhausted: boolean;
  } {
    const stats = this.getStats();
    return {
      searchesPerformed: stats.searchesPerformed,
      urlsFetched: stats.urlsFetched,
      urlsFailed: stats.urlsFailed,
      contentSources: Array.from(this.contentCache.keys()),
      queriesPerformed: Array.from(this.searchHistory),
      exhausted: stats.isExhausted,
    };
  }

  /**
   * Clear the session
   */
  clear(): void {
    this.urls.clear();
    this.contentCache.clear();
    this.searchHistory.clear();
    this.pendingFindings = [];
  }
}

/**
 * Extract clean text content from HTML (local parsing, no external APIs)
 */
export function extractTextFromHtml(html: string): {
  title: string;
  text: string;
  urls: string[];
} {

  // Strip script, style, and other non-content tags
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Extract title
  const titleMatch = cleaned.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || '';

  // PRE-PROCESS TABLES: Convert to readable text before stripping tags
  // This is crucial for "Label: Value" specs in datasheets
  cleaned = cleaned.replace(/<tr[^>]*>[\s\S]*?<\/tr>/gi, (row) => {
    const cells = row.match(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi);
    if (!cells) return row;

    const cellTexts = cells.map(cell => {
      return cell.replace(/<[^>]+>/g, '').trim();
    });

    // If it looks like a key-value pair (2 cells), format as "Key: Value"
    if (cellTexts.length === 2) {
      return `\n${cellTexts[0]}: ${cellTexts[1]}\n`;
    }
    // Otherwise just space-separate
    return `\n${cellTexts.join(' | ')}\n`;
  });

  // PRE-PROCESS LISTS
  cleaned = cleaned.replace(/<li[^>]*>/gi, '\n- ');

  // Try to find main content containers
  let mainContent = '';
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*class="[^"]*(?:content|article|post|entry|spec|data)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*id="(?:content|main|article|spec)"[^>]*>([\s\S]*?)<\/div>/gi,
    /<table[^>]*>([\s\S]*?)<\/table>/gi, // Explicitly look for tables as content
  ];

  for (const pattern of contentPatterns) {
    const matches = cleaned.matchAll(pattern);
    for (const match of matches) {
      if (match[0].length > mainContent.length && match[0].length > 100) {
        mainContent = match[0];
      }
    }
  }

  // Fallback: use body content
  if (!mainContent) {
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    mainContent = bodyMatch?.[1] || cleaned;
  }

  // Strip remaining tags, decode entities, normalize whitespace
  const text = mainContent
    .replace(/<br\s*\/?>/gi, '\n') // Preserve line breaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract URLs (filter for useful ones)
  const urls = extractUsefulUrls(html);

  return { title, text, urls };
}

/**
 * Extract useful URLs from HTML
 */
function extractUsefulUrls(html: string): string[] {
  const urls = new Set<string>();

  // Extract href attributes
  const hrefRe = /href\s*=\s*["']([^"'#]+)["']/gi;
  for (const match of html.matchAll(hrefRe)) {
    const url = match[1]?.trim();
    if (url && url.startsWith('http') && isUsefulUrl(url)) {
      urls.add(url);
    }
  }

  // Extract src attributes (for images)
  const srcRe = /src\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(srcRe)) {
    const url = match[1]?.trim();
    if (url && url.startsWith('http') && /\.(png|jpe?g|gif|svg|pdf)$/i.test(url)) {
      urls.add(url);
    }
  }

  return Array.from(urls);
}

/**
 * Filter out garbage URLs
 */
function isUsefulUrl(url: string): boolean {
  const noisePatterns = [
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
    /cdn\..*\/(js|css|fonts)\//i,
    /polyfill/i,
    /bundle\.(js|css)/i,
    /chunk\./i,
    /vendor\./i,
    /manifest\./i,
    /login/i,
    /signup/i,
    /register/i,
    /facebook\.com/i,
    /twitter\.com/i,
    /instagram\.com/i,
    /pinterest\.com/i,
  ];

  return !noisePatterns.some(p => p.test(url));
}

/**
 * Extract dimension patterns from text
 */
export function extractDimensionPatterns(text: string, topic: string): string[] {
  const results: string[] = [];

  // Common dimension patterns
  const patterns = [
    // "25.4 mm" or "25.4mm"
    /(\d+\.?\d*)\s*(mm|cm|m|in|inch|inches|ft|feet)/gi,
    // "25.4 x 18.2 mm" or "25.4x18.2mm"
    /(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*(mm|cm|m|in)/gi,
    // "25.4 x 18.2 x 5.0 mm"
    /(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*(mm|cm|m|in)/gi,
    // Metric Threads: "M3", "M3.5", "M3x10"
    /\bM(\d+\.?\d*)(?:[x×](\d+\.?\d*))?/gi,
    // Imperial Threads: "1/4-20", "4-40 UNC"
    /\b(\d+)\/(\d+)-(\d+)\b/gi,
    /\b(\d+)-(\d+)\s*(UNC|UNF)/gi,
    // Tolerances: "5.0 ± 0.1", "5.0 +0.1/-0.05"
    /(\d+\.?\d*)\s*(?:mm|in)?\s*[±+]\s*(\d+\.?\d*)/gi,
    // "Diameter: 5.0" (Label: Value patterns common in specs)
    /(?:diameter|width|height|length|depth|thickness)[\s:]+(\d+\.?\d*)\s*(?:mm|cm|in)?/gi,
  ];

  // Get context around the topic keywords
  const topicKeywords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const matchText = match[0];
      const matchIndex = match.index || 0;

      // Get surrounding context (100 chars before and after)
      const contextStart = Math.max(0, matchIndex - 100);
      const contextEnd = Math.min(text.length, matchIndex + matchText.length + 100);
      const context = text.slice(contextStart, contextEnd);

      // Check if context contains topic keywords
      const contextLower = context.toLowerCase();
      const isRelevant = topicKeywords.some(kw => contextLower.includes(kw));

      if (isRelevant) {
        results.push(context.trim());
      }
    }
  }

  return [...new Set(results)]; // Deduplicate
}

/**
 * Fetch GitHub repository file listing via API
 */
export async function fetchGitHubRepoFiles(
  url: string
): Promise<{ files: Array<{ name: string; path: string; downloadUrl: string; size: number }>; error?: string }> {
  // Parse GitHub URL to extract owner/repo/path
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.*))?/);
  if (!match) {
    return { files: [], error: 'Not a valid GitHub repository URL' };
  }

  const [, owner, repo, path] = match;
  const apiPath = path ? `/${path}` : '';

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents${apiPath}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TalkCAD-Agent',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { files: [], error: 'Repository or path not found' };
      }
      if (response.status === 403) {
        return { files: [], error: 'GitHub API rate limit exceeded' };
      }
      return { files: [], error: `GitHub API error: ${response.status}` };
    }

    const items = await response.json();

    // Handle single file response
    if (!Array.isArray(items)) {
      if (items.download_url) {
        return {
          files: [{
            name: items.name,
            path: items.path,
            downloadUrl: items.download_url,
            size: items.size,
          }],
        };
      }
      return { files: [] };
    }

    // Filter for useful files
    const usefulExtensions = /\.(md|txt|pdf|svg|png|jpe?g|scad|stl|step|stp)$/i;
    const files = items
      .filter((item: { type: string; name: string }) =>
        item.type === 'file' && usefulExtensions.test(item.name)
      )
      .map((item: { name: string; path: string; download_url: string; size: number }) => ({
        name: item.name,
        path: item.path,
        downloadUrl: item.download_url,
        size: item.size,
      }));

    return { files };
  } catch (error) {
    return { files: [], error: String(error) };
  }
}
