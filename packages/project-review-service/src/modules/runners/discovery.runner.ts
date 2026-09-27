import fs from 'fs';
import path from 'path';
import { DiscoveryResult } from './types.js';
import logger from '../../shared/config/logger.config.js';
import env from '../../shared/config/env.config.js';

// a token lifts GitHub's limit from 60 to 5000 requests/hour: needed for any real cohort
export const githubHeaders: Record<string, string> = {
  'User-Agent': 'Knowhere-Discovery/2.0',
  ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {})
};

// Denylist, not allowlist: every text file counts, so ANY language/stack is read (C, Java, Node,
// Go, Rust, Elixir, Assembly, Arduino, notebooks, ...) without having to be listed here.
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|avif|bmp|ico|icns|tiff?|psd|ai|sketch|fig|mp[34]|m4a|wav|ogg|flac|webm|mov|avi|mkv|woff2?|ttf|otf|eot|pdf|docx?|xlsx?|pptx?|zip|tar|gz|tgz|bz2|xz|7z|rar|jar|war|ear|class|o|obj|a|lib|so|dylib|dll|exe|bin|out|elf|pyc|pyo|whl|wasm|db|sqlite3?|lockb|pack|idx|keystore|jks|p12|pem|crt)$/i;
const NOISE =
  /(^|\/)(node_modules|\.git|dist|build|out|target|obj|\.next|\.nuxt|\.svelte-kit|\.turbo|\.gradle|\.idea|\.vscode|coverage|vendor|__pycache__|\.venv|venv|env|Pods|DerivedData|cmake-build-[^/]*)\/|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.lock|poetry\.lock|Pipfile\.lock|Cargo\.lock|Gemfile\.lock|go\.sum|\.DS_Store)$|\.min\.(js|css)$|\.map$/i;

/** Files worth reading to judge a project, whatever its stack: any non-binary, non-generated file. */
export const isSourceFile = (path: string) => !BINARY_EXT.test(path) && !NOISE.test(path);

/** Fetched content that is really binary (NUL bytes) is skipped whatever its extension. */
export const isTextContent = (content: string) => !content.slice(0, 8000).includes('\u0000');

/**
 * Lower = read first. Stack-neutral: entry-point names in any language, then code over docs/
 * config, then shallower files; tests and docs last (the organiser's keywords can still lift them).
 */
export const sourcePriority = (path: string) => {
  const p = path.toLowerCase();
  const base = p.split('/').pop() || p;
  const depth = p.split('/').length - 1;
  const isEntry =
    /^(index|main|app|server|program|start|run|mod|lib|core|__main__|manage)\.[a-z0-9]+$/.test(
      base
    );
  const isManifest =
    /^(package\.json|pom\.xml|build\.gradle(\.kts)?|cmakelists\.txt|makefile|cargo\.toml|go\.mod|requirements\.txt|pyproject\.toml|gemfile|composer\.json|[^/]*\.(csproj|sln)|dockerfile)$/.test(
      base
    );
  const isDocOrTest =
    /(^|\/)(docs?|tests?|__tests__|spec|examples?)\/|\.(test|spec)\.|\.(md|txt|rst)$/.test(p);
  return (isEntry ? 0 : isManifest ? 1 : isDocOrTest ? 4 : 2) + Math.min(depth, 5) * 0.1;
};

/**
 * owner/repo from whatever students actually paste: .git suffixes, /tree/main links, any casing,
 * or their GitHub Pages site (user.github.io/repo -> github.com/user/repo). null = not a repo.
 */
export const parseGithubRepo = (url: string) => {
  const u = url.trim().replace(/\/+$/, '');
  const gh = u.match(/(?:^|[/.])github\.com\/([^/\s?#]+)\/([^/\s?#]+)/i);
  if (gh) return { owner: gh[1], repo: gh[2].replace(/\.git$/i, '') };
  const pages = u.match(/^(?:https?:\/\/)?([^./\s]+)\.github\.io(?:\/([^/?#\s]+))?/i);
  if (pages) return { owner: pages[1], repo: pages[2] || `${pages[1]}.github.io` };
  return null;
};

/**
 * Pins a submission to the exact commit its branch points at right now, so every evaluation
 * (and every re-run) scores the code the team actually submitted, not later pushes.
 * Returns { error } for a wrong URL/branch so the student learns at submit time, not from a 0.
 */
export async function resolveCommit(
  repoUrl: string,
  branch: string
): Promise<{ sha?: string; branch?: string; error?: string }> {
  const gh = parseGithubRepo(repoUrl);
  if (!gh)
    return {
      error:
        'Paste your GitHub repository link, like https://github.com/you/project (a profile link or another site is not enough)'
    };
  const api = `https://api.github.com/repos/${gh.owner}/${gh.repo}`;
  const get = (url: string) =>
    fetch(url, { headers: githubHeaders, signal: AbortSignal.timeout(8000) });
  const defaultBranch = async () => {
    const repo = await get(api);
    return repo.ok
      ? ((await repo.json()) as { default_branch?: string }).default_branch
      : undefined;
  };
  try {
    let ref = branch.trim() || (await defaultBranch()) || 'main';
    let res = await get(`${api}/commits/${encodeURIComponent(ref)}`);
    // the form's untouched "main" on a repo whose default is master/dev/...: use the real default
    // branch instead of rejecting the student
    if ([404, 409, 422].includes(res.status) && branch.trim() === 'main') {
      const fallback = await defaultBranch();
      if (fallback && fallback !== 'main') {
        ref = fallback;
        res = await get(`${api}/commits/${encodeURIComponent(ref)}`);
      }
    }
    if (res.status === 404 || res.status === 422 || res.status === 409)
      return {
        error: `Could not find branch "${ref}" in ${gh.owner}/${gh.repo}. Is the repository public and the branch name right?`
      };
    // rate limit / outage: accept the submission unpinned rather than block the student
    if (!res.ok) return { branch: ref || undefined };
    return { sha: ((await res.json()) as { sha: string }).sha, branch: ref };
  } catch {
    return { branch: branch.trim() || undefined };
  }
}

export class ProjectDiscoveryRunner {
  /**
   * Discovers repo structure, languages, dependencies, and OpenAPI specifications.
   */
  public static async discover(
    repoPathOrUrl: string,
    branch = 'main',
    submissionId = 'sub-unknown'
  ): Promise<DiscoveryResult> {
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
        const getAllFiles = (dir: string, base = ''): string[] => {
          let results: string[] = [];
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const relPath = base ? `${base}/${entry.name}` : entry.name;
            const fullPath = path.join(dir, entry.name);
            if (
              entry.name === '.git' ||
              entry.name === 'node_modules' ||
              entry.name === 'dist' ||
              entry.name === 'build' ||
              entry.name === '.next' ||
              entry.name === '.turbo'
            ) {
              continue;
            }
            if (entry.isDirectory()) {
              results = results.concat(getAllFiles(fullPath, relPath));
            } else {
              results.push(relPath);
            }
          }
          return results;
        };

        const files = getAllFiles(repoPathOrUrl);
        result.fileList = files;
        result.keyFileSnippets = {};

        // 1. Read README
        const readmeFile = files.find((f) => /^readme(\.(md|txt|markdown))?$/i.test(f));
        if (readmeFile) {
          result.rawReadme = fs.readFileSync(path.join(repoPathOrUrl, readmeFile), 'utf-8');
        }

        // 2. Read every text file (any language), same filter as remote repos
        for (const relPath of files) {
          if (isSourceFile(relPath)) {
            try {
              const content = fs.readFileSync(path.join(repoPathOrUrl, relPath), 'utf-8');
              if (isTextContent(content)) result.keyFileSnippets[relPath] = content.slice(0, 10000);
            } catch {}
          }
        }

        // 3. Language & Dependency detection
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
        const htmlFiles = files.filter((f) => f.endsWith('.html') || f.endsWith('.htm'));
        if (htmlFiles.length > 0 && result.detectedFrameworks.length === 0) {
          result.primaryLanguage = 'HTML';
          result.detectedFrameworks.push('HTML5 / Web');
        }

        // 4. OpenAPI / Swagger discovery
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
      const parsed = parseGithubRepo(repoPathOrUrl);

      if (!parsed) {
        logger.warn({ repoPathOrUrl }, 'Repository URL is not a valid GitHub repository');
        result.repoValid = false;
        result.repoErrorMessage = `Repository URL "${repoPathOrUrl}" is invalid (must be a valid GitHub repository)`;
        result.primaryLanguage = 'None';
      } else {
        const { owner, repo } = parsed;
        const targetBranch = branch && branch.trim() ? branch.trim() : 'main';

        // 1. Fetch real language statistics from GitHub API
        try {
          const langRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
            headers: githubHeaders,
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
        // not wrapped in try/catch on purpose: a rate limit or outage must fail the run (so it
        // can be re-run) instead of silently scoring the project as an empty repository
        const treeRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`,
          { headers: githubHeaders, signal: AbortSignal.timeout(15000) }
        );
        if (treeRes.status === 404 || treeRes.status === 409) {
          result.repoValid = false;
          result.repoErrorMessage = `Repository "${owner}/${repo}" at "${targetBranch}" was not found, is private, or is empty`;
        } else if (!treeRes.ok) {
          throw new Error(
            `GitHub API returned ${treeRes.status} reading the repository tree (rate limit or outage); set GITHUB_TOKEN and re-run`
          );
        } else {
          const treeData = (await treeRes.json()) as { tree?: Array<{ path: string }> };
          if (Array.isArray(treeData.tree)) {
            filePaths = treeData.tree.map((t) => t.path);
            result.fileList = filePaths;
          }
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
                headers: githubHeaders,
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
                headers: githubHeaders,
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
                headers: githubHeaders,
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
              headers: githubHeaders,
              signal: AbortSignal.timeout(4000)
            }
          );
          if (readmeRes.ok) {
            result.rawReadme = await readmeRes.text();
          }
        } catch {}

        // 8. Fetch real file contents across the entire repository for deep code inspection
        // every text file of any stack, entry points first
        const relevantFiles = filePaths
          .filter((p) => isSourceFile(p))
          // entry points and app code first, so a capped fetch still gets what matters
          .sort((a, b) => sourcePriority(a) - sourcePriority(b))
          // ponytail: fetch cap; a monorepo bigger than this loses its least-central files
          .slice(0, 400);

        // Fetch the selected files in concurrent batches
        const snippets: Record<string, string> = {};
        const BATCH_SIZE = 10;
        for (let i = 0; i < relevantFiles.length; i += BATCH_SIZE) {
          const batch = relevantFiles.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (kf) => {
              try {
                const kRes = await fetch(
                  `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/${kf}`,
                  {
                    headers: githubHeaders,
                    signal: AbortSignal.timeout(6000)
                  }
                );
                if (kRes.ok) {
                  const content = await kRes.text();
                  if (isTextContent(content)) snippets[kf] = content.slice(0, 10000);
                }
              } catch {}
            })
          );
        }
        result.keyFileSnippets = snippets;
      }
    }

    if (result.fileList && result.fileList.length > 0) {
      result.repoValid = true;
    } else {
      result.repoValid = false;
      result.repoErrorMessage =
        result.repoErrorMessage || 'Repository is empty or unreachable: 0 files discovered';
      result.primaryLanguage = 'None';
    }

    // 9. Execute Mistral + LangChain Deep Project Discovery Agent (Whole-Project Inspection)
    if (result.repoValid && result.fileList && result.fileList.length > 0) {
      try {
        const { MistralDiscoveryAgent } = await import('../ai/discovery.agent.js');
        const deepDiscovery = await MistralDiscoveryAgent.analyzeProject(submissionId, {
          repoUrl: repoPathOrUrl,
          branch,
          allFilePaths: result.fileList || [],
          allFilesContent: result.keyFileSnippets || {},
          rawReadme: result.rawReadme,
          languagesBreakdown: result.languages
        });
        result.deepAnalysis = deepDiscovery;
        if (
          deepDiscovery.primaryLanguage &&
          (!result.primaryLanguage || result.primaryLanguage === 'Unknown')
        ) {
          result.primaryLanguage = deepDiscovery.primaryLanguage;
        }
        if (
          Array.isArray(deepDiscovery.detectedFrameworks) &&
          deepDiscovery.detectedFrameworks.length > 0
        ) {
          for (const fw of deepDiscovery.detectedFrameworks) {
            if (!result.detectedFrameworks.includes(fw)) {
              result.detectedFrameworks.push(fw);
            }
          }
        }
      } catch (err) {
        logger.warn(
          { err, submissionId },
          'Mistral deep discovery agent failed, continuing with static discovery metadata'
        );
      }
    } else {
      result.deepAnalysis = {
        primaryLanguage: 'None',
        detectedFrameworks: [],
        uiArchitecture: {
          pageCount: 0,
          pages: [],
          stylingApproach: 'None',
          visualAndMediaAssets: [],
          responsiveness: 'None',
          semanticStructureQuality: 'INCOMPLETE'
        },
        functionalityAndLogic: {
          interactiveFeatures: [],
          clientSideScripts: [],
          crossPageNavigation: false,
          formsAndInputsCount: 0
        },
        complexityAndScope: {
          tier: 'ELEMENTARY_STARTER',
          estimatedTotalLines: 0,
          fileCount: 0,
          hasMultimedia: false,
          technicalDepthScore: 0,
          minorAspectsAndNuances: []
        },
        executiveSummary: `Repository inspection failed: ${result.repoErrorMessage}`
      };
    }

    logger.info(
      {
        primaryLanguage: result.primaryLanguage,
        detectedFrameworks: result.detectedFrameworks,
        fileCount: result.fileList?.length || 0,
        hasOpenApi: result.hasOpenApi,
        scopeTier: result.deepAnalysis?.complexityAndScope?.tier
      },
      'Project Discovery Stage Completed'
    );

    return result;
  }
}

export default ProjectDiscoveryRunner;
