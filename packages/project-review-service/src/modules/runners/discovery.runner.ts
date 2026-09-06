import fs from 'fs';
import path from 'path';
import { DiscoveryResult } from './types.js';
import logger from '../../shared/config/logger.config.js';

export class ProjectDiscoveryRunner {
  /**
   * Discovers repo structure, languages, dependencies, and OpenAPI specifications.
   */
  public static async discover(repoPathOrUrl: string, branch = 'main'): Promise<DiscoveryResult> {
    logger.info({ repoPathOrUrl, branch }, 'Executing Project Discovery Stage');

    // Default clean discovery structure (zero hardcoded fake frameworks or languages)
    const result: DiscoveryResult = {
      languages: {},
      primaryLanguage: 'Unknown',
      sbomPackageCount: 0,
      topDependencies: [],
      hasOpenApi: false,
      openApiEndpointsCount: 0,
      openApiEndpoints: [],
      detectedFrameworks: [],
      rawReadme: '',
      fileList: [],
      keyFileSnippets: {}
    };

    // Case A: If local directory exists, inspect real files on disk
    if (fs.existsSync(repoPathOrUrl)) {
      try {
        const files = fs.readdirSync(repoPathOrUrl);
        result.fileList = files;

        // 1. Read README
        const readmeFile = files.find((f) => /^readme(\.(md|txt|markdown))?$/i.test(f));
        if (readmeFile) {
          result.rawReadme = fs.readFileSync(path.join(repoPathOrUrl, readmeFile), 'utf-8');
        }

        // 2. Language & Dependency detection
        const packageJsonPath = path.join(repoPathOrUrl, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          result.detectedFrameworks.push('Node.js');
          const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          result.topDependencies = Object.keys(deps).slice(0, 20);
          result.sbomPackageCount = Object.keys(deps).length;

          if (deps['express']) result.detectedFrameworks.push('Express');
          if (deps['react']) result.detectedFrameworks.push('React');
          if (deps['next']) result.detectedFrameworks.push('Next.js');
          if (deps['@nestjs/core']) result.detectedFrameworks.push('NestJS');
          if (deps['typescript']) result.primaryLanguage = 'TypeScript';
          else result.primaryLanguage = 'JavaScript';
        }

        const requirementsPath = path.join(repoPathOrUrl, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
          result.detectedFrameworks.push('Python');
          result.primaryLanguage = 'Python';
          const lines = fs.readFileSync(requirementsPath, 'utf-8').split('\n').filter(Boolean);
          result.topDependencies.push(...lines.slice(0, 15));
          result.sbomPackageCount += lines.length;
        }

        // Check HTML files
        const htmlFiles = files.filter((f) => f.endsWith('.html'));
        if (htmlFiles.length > 0 && result.detectedFrameworks.length === 0) {
          result.primaryLanguage = 'HTML';
          result.detectedFrameworks.push('HTML5 / Web');
        }

        // 3. OpenAPI / Swagger discovery
        const swaggerCandidates = ['swagger.json', 'swagger.yaml', 'openapi.json', 'openapi.yaml'];
        for (const candidate of swaggerCandidates) {
          const candidatePath = path.join(repoPathOrUrl, candidate);
          if (fs.existsSync(candidatePath)) {
            result.hasOpenApi = true;
            try {
              const specContent = fs.readFileSync(candidatePath, 'utf-8');
              const parsed = JSON.parse(specContent);
              if (parsed.paths) {
                result.openApiEndpoints = Object.keys(parsed.paths);
                result.openApiEndpointsCount = result.openApiEndpoints.length;
              }
            } catch {}
            break;
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Error while inspecting local repo directory');
      }
    } else if (
      typeof repoPathOrUrl === 'string' &&
      (repoPathOrUrl.includes('github.com') || repoPathOrUrl.startsWith('http'))
    ) {
      // Case B: Real Remote GitHub Repository Discovery via GitHub API & Raw Content
      const cleanUrl = repoPathOrUrl
        .trim()
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '');
      const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);

      if (match) {
        const [, owner, repo] = match;
        const targetBranch = branch && branch.trim() ? branch.trim() : 'main';

        // 1. Fetch real language statistics from GitHub API
        try {
          const langRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
            headers: { 'User-Agent': 'Knowhere-Discovery/2.0' },
            signal: AbortSignal.timeout(5000)
          });
          if (langRes.ok) {
            const langs = (await langRes.json()) as Record<string, number>;
            result.languages = langs;
            const sorted = Object.entries(langs).sort(([, a], [, b]) => b - a);
            if (sorted.length > 0) {
              result.primaryLanguage = sorted[0][0];
            }
          }
        } catch (e) {
          logger.warn({ e }, 'GitHub languages API lookup failed');
        }

        // 2. Fetch full repository tree from GitHub Git Trees API
        let filePaths: string[] = [];
        try {
          const treeRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`,
            {
              headers: { 'User-Agent': 'Knowhere-Discovery/2.0' },
              signal: AbortSignal.timeout(6000)
            }
          );
          if (treeRes.ok) {
            const treeData = (await treeRes.json()) as { tree?: Array<{ path: string }> };
            if (Array.isArray(treeData.tree)) {
              filePaths = treeData.tree.map((t) => t.path);
              result.fileList = filePaths;
            }
          }
        } catch (e) {
          logger.warn({ e }, 'GitHub git tree API lookup failed');
        }

        // 3. Fallback language detection if API didn't return languages
        if (!result.primaryLanguage || result.primaryLanguage === 'Unknown') {
          const hasHtml = filePaths.some((p) => p.endsWith('.html'));
          const hasTs = filePaths.some((p) => p.endsWith('.ts') || p.endsWith('.tsx'));
          const hasJs = filePaths.some((p) => p.endsWith('.js') || p.endsWith('.jsx'));
          const hasPy = filePaths.some((p) => p.endsWith('.py'));
          if (hasHtml && !hasTs && !hasJs) result.primaryLanguage = 'HTML';
          else if (hasTs) result.primaryLanguage = 'TypeScript';
          else if (hasJs) result.primaryLanguage = 'JavaScript';
          else if (hasPy) result.primaryLanguage = 'Python';
          else if (hasHtml) result.primaryLanguage = 'HTML';
        }

        // 4. Inspect real package.json ONLY if it actually exists in filePaths
        const hasPackageJson = filePaths.some((p) => /(^|\/)package\.json$/i.test(p));
        if (hasPackageJson) {
          try {
            const pkgRes = await fetch(
              `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/package.json`,
              {
                headers: { 'User-Agent': 'Knowhere-Discovery/2.0' },
                signal: AbortSignal.timeout(4000)
              }
            );
            if (pkgRes.ok) {
              const pkg = (await pkgRes.json()) as Record<string, any>;
              const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
              result.topDependencies = Object.keys(deps).slice(0, 20);
              result.sbomPackageCount = Object.keys(deps).length;
              result.detectedFrameworks.push('Node.js');
              if (deps['express']) result.detectedFrameworks.push('Express');
              if (deps['react']) result.detectedFrameworks.push('React');
              if (deps['next']) result.detectedFrameworks.push('Next.js');
              if (deps['vue']) result.detectedFrameworks.push('Vue');
            }
          } catch {}
        } else {
          // If no package.json, check for HTML/static project
          const htmlFiles = filePaths.filter((p) => p.endsWith('.html'));
          if (htmlFiles.length > 0) {
            result.detectedFrameworks.push('HTML5 / Web');
          }
        }

        // 5. Inspect requirements.txt ONLY if it exists in filePaths
        const hasReqs = filePaths.some((p) => /(^|\/)requirements\.txt$/i.test(p));
        if (hasReqs) {
          try {
            const reqRes = await fetch(
              `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/requirements.txt`,
              {
                headers: { 'User-Agent': 'Knowhere-Discovery/2.0' },
                signal: AbortSignal.timeout(4000)
              }
            );
            if (reqRes.ok) {
              const txt = await reqRes.text();
              const lines = txt
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith('#'));
              result.topDependencies.push(...lines.slice(0, 15));
              result.sbomPackageCount += lines.length;
              result.detectedFrameworks.push('Python');
            }
          } catch {}
        }

        // 6. Inspect OpenAPI / Swagger ONLY if it exists in filePaths
        const swaggerFile = filePaths.find((p) => /(swagger|openapi)\.(json|yaml|yml)$/i.test(p));
        if (swaggerFile) {
          result.hasOpenApi = true;
          try {
            const sRes = await fetch(
              `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/${swaggerFile}`,
              {
                headers: { 'User-Agent': 'Knowhere-Discovery/2.0' },
                signal: AbortSignal.timeout(4000)
              }
            );
            if (sRes.ok) {
              const specText = await sRes.text();
              const parsed = JSON.parse(specText);
              if (parsed.paths) {
                result.openApiEndpoints = Object.keys(parsed.paths);
                result.openApiEndpointsCount = result.openApiEndpoints.length;
              }
            }
          } catch {}
        }

        // 7. Fetch raw README
        const readmeFile =
          filePaths.find((p) => /^readme(\.(md|markdown|txt))?$/i.test(p)) || 'README.md';
        try {
          const readmeRes = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/${readmeFile}`,
            {
              headers: { 'User-Agent': 'Knowhere-Discovery/2.0' },
              signal: AbortSignal.timeout(4000)
            }
          );
          if (readmeRes.ok) {
            result.rawReadme = await readmeRes.text();
          }
        } catch {}

        // 8. Fetch real key file snippets (e.g. index.html, other pages) for grounded code evaluation
        const relevantFiles = filePaths.filter((p) => {
          const lower = p.toLowerCase();
          return (
            (lower.endsWith('.html') ||
              lower.endsWith('.js') ||
              lower.endsWith('.ts') ||
              lower.endsWith('.jsx') ||
              lower.endsWith('.tsx') ||
              lower.endsWith('.css') ||
              lower.endsWith('.py')) &&
            !lower.includes('node_modules') &&
            !lower.includes('.git') &&
            !lower.includes('dist')
          );
        });

        // Ensure index.html or main entry is prioritized first
        relevantFiles.sort((a, b) => {
          const aIndex = a.toLowerCase().includes('index') ? -1 : 1;
          const bIndex = b.toLowerCase().includes('index') ? -1 : 1;
          return aIndex - bIndex;
        });

        const selectedFiles = relevantFiles.slice(0, 4);
        result.keyFileSnippets = {};
        for (const kf of selectedFiles) {
          try {
            const kRes = await fetch(
              `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/${kf}`,
              {
                headers: { 'User-Agent': 'Knowhere-Discovery/2.0' },
                signal: AbortSignal.timeout(4000)
              }
            );
            if (kRes.ok) {
              const content = await kRes.text();
              result.keyFileSnippets[kf] = content.slice(0, 3000);
            }
          } catch {}
        }
      }
    }

    // Ensure primaryLanguage has a sensible default if completely empty
    if (!result.primaryLanguage || result.primaryLanguage === 'Unknown') {
      result.primaryLanguage = result.detectedFrameworks.includes('HTML5 / Web')
        ? 'HTML'
        : 'Generic Code';
    }

    logger.info(
      {
        primaryLanguage: result.primaryLanguage,
        detectedFrameworks: result.detectedFrameworks,
        fileCount: result.fileList?.length || 0,
        hasOpenApi: result.hasOpenApi
      },
      'Project Discovery Stage Completed'
    );

    return result;
  }
}

export default ProjectDiscoveryRunner;
