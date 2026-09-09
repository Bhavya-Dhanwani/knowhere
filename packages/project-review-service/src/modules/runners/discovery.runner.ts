import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DiscoveryResult,
  FileClassification,
  RepositoryFileRecord,
  RepositoryManifest,
  ToolExecutionRecord
} from './types.js';
import logger from '../../shared/config/logger.config.js';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.c': 'C',
  '.cc': 'C++',
  '.cpp': 'C++',
  '.cs': 'C#',
  '.css': 'CSS',
  '.dart': 'Dart',
  '.go': 'Go',
  '.html': 'HTML',
  '.java': 'Java',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.kt': 'Kotlin',
  '.php': 'PHP',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.rs': 'Rust',
  '.scala': 'Scala',
  '.scss': 'SCSS',
  '.sh': 'Shell',
  '.sql': 'SQL',
  '.swift': 'Swift',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.vue': 'Vue',
  '.xml': 'XML'
};

const IGNORED_DIRECTORY_REASONS: Record<string, string> = {
  '.git': 'Git metadata',
  '.idea': 'IDE metadata',
  '.next': 'Generated Next.js output',
  '.turbo': 'Generated build cache',
  '.vscode': 'IDE metadata',
  coverage: 'Generated coverage output',
  dist: 'Generated distribution output',
  node_modules: 'Installed dependencies',
  target: 'Generated compiler output',
  vendor: 'Vendored dependencies'
};

const CONFIG_NAMES = new Set([
  'dockerfile',
  'makefile',
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
  'requirements.txt',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  'cargo.toml',
  'go.mod',
  'docker-compose.yml',
  'docker-compose.yaml'
]);
const CONFIG_EXTENSIONS = new Set([
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.conf',
  '.properties'
]);
const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.txt']);
const ASSET_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.eot',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.mp4',
  '.ogg',
  '.otf',
  '.pdf',
  '.png',
  '.svg',
  '.ttf',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2'
]);

const executionRecord = (startedAt: number): ToolExecutionRecord => ({
  status: 'SUCCEEDED',
  attempted: true,
  tool: 'repository-discovery',
  durationMs: Date.now() - startedAt,
  observedAt: new Date().toISOString()
});
const isTestPath = (relativePath: string): boolean =>
  /(^|\/)(__tests__|tests?|spec)(\/|$)/i.test(relativePath) ||
  /\.(test|spec)\.[^.]+$/i.test(relativePath);
const classify = (relativePath: string): FileClassification => {
  const normalized = relativePath.replace(/\\/g, '/');
  const base = path.basename(normalized).toLowerCase();
  const extension = path.extname(base).toLowerCase();
  if (isTestPath(normalized)) return 'TEST';
  if (LANGUAGE_BY_EXTENSION[extension]) return 'SOURCE';
  if (CONFIG_NAMES.has(base) || CONFIG_EXTENSIONS.has(extension) || base.startsWith('.env'))
    return 'CONFIGURATION';
  if (DOC_EXTENSIONS.has(extension) || /^readme/i.test(base)) return 'DOCUMENTATION';
  if (ASSET_EXTENSIONS.has(extension)) return 'ASSET';
  return 'IGNORED';
};
const isBinary = (buffer: Buffer): boolean => buffer.subarray(0, 8192).includes(0);

export class ProjectDiscoveryRunner {
  public static async discover(repositoryPath: string): Promise<DiscoveryResult> {
    const startedAt = Date.now();
    const maxFiles = Number(process.env.DISCOVERY_MAX_FILES || 50_000);
    const maxFileBytes = Number(process.env.DISCOVERY_MAX_FILE_BYTES || 5 * 1024 * 1024);
    const maxAnalyzedBytes = Number(process.env.DISCOVERY_MAX_ANALYZED_BYTES || 100 * 1024 * 1024);
    const root = path.resolve(repositoryPath);
    const records: RepositoryFileRecord[] = [];
    const languages: Record<string, number> = {};
    const fileContents = new Map<string, string>();
    let totalBytes = 0;
    let analyzedBytes = 0;
    let truncated = false;
    let truncationReason: string | undefined;

    const walk = async (directory: string): Promise<void> => {
      if (truncated) return;
      let entries;
      try {
        entries = await fs.readdir(directory, { withFileTypes: true });
      } catch (error) {
        records.push({
          path: path.relative(root, directory).replace(/\\/g, '/') || '.',
          sizeBytes: 0,
          classification: 'IGNORED',
          ignoredReason: `Directory read failed: ${error instanceof Error ? error.message : String(error)}`
        });
        return;
      }

      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (records.length >= maxFiles) {
          truncated = true;
          truncationReason = `Repository exceeded DISCOVERY_MAX_FILES=${maxFiles}`;
          return;
        }
        const absolutePath = path.join(directory, entry.name);
        const relativePath = path.relative(root, absolutePath).replace(/\\/g, '/');
        if (entry.isSymbolicLink()) {
          records.push({
            path: relativePath,
            sizeBytes: 0,
            classification: 'IGNORED',
            ignoredReason: 'Symbolic links are not followed during discovery'
          });
          continue;
        }
        if (entry.isDirectory()) {
          const ignoredReason = IGNORED_DIRECTORY_REASONS[entry.name.toLowerCase()];
          if (ignoredReason) {
            records.push({
              path: `${relativePath}/`,
              sizeBytes: 0,
              classification: entry.name === '.git' ? 'IGNORED' : 'GENERATED',
              ignoredReason
            });
          } else await walk(absolutePath);
          continue;
        }
        if (!entry.isFile()) continue;

        try {
          const stat = await fs.stat(absolutePath);
          totalBytes += stat.size;
          let classification = classify(relativePath);
          let ignoredReason: string | undefined;
          let sha256: string | undefined;
          let language: string | undefined;
          if (stat.size > maxFileBytes) {
            classification = 'IGNORED';
            ignoredReason = `File exceeds DISCOVERY_MAX_FILE_BYTES=${maxFileBytes}`;
          } else if (analyzedBytes + stat.size > maxAnalyzedBytes) {
            classification = 'IGNORED';
            ignoredReason = `Repository exceeds DISCOVERY_MAX_ANALYZED_BYTES=${maxAnalyzedBytes}`;
            truncated = true;
            truncationReason = ignoredReason;
          } else {
            const content = await fs.readFile(absolutePath);
            analyzedBytes += content.byteLength;
            if (isBinary(content)) classification = 'BINARY';
            else {
              sha256 = createHash('sha256').update(content).digest('hex');
              language = LANGUAGE_BY_EXTENSION[path.extname(relativePath).toLowerCase()];
              if (language) languages[language] = (languages[language] || 0) + stat.size;
              if (classification !== 'ASSET' && classification !== 'IGNORED')
                fileContents.set(relativePath, content.toString('utf8'));
              if (classification === 'IGNORED') ignoredReason = 'Unsupported file type';
            }
          }
          records.push({
            path: relativePath,
            sizeBytes: stat.size,
            classification,
            language,
            ignoredReason,
            sha256
          });
        } catch (error) {
          records.push({
            path: relativePath,
            sizeBytes: 0,
            classification: 'IGNORED',
            ignoredReason: `File analysis failed: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
    };

    await walk(root);
    const fileList = records
      .filter((record) => !record.path.endsWith('/'))
      .map((record) => record.path);
    const packageManagers = new Set<string>();
    const buildSystems = new Set<string>();
    const testFrameworks = new Set<string>();
    const databases = new Set<string>();
    const frameworks = new Set<string>();
    const dependencies = new Set<string>();
    const openApiEndpoints = new Set<string>();

    for (const [relativePath, content] of fileContents) {
      const base = path.basename(relativePath).toLowerCase();
      if (base === 'package.json') {
        packageManagers.add(
          fileList.some((file) => file.endsWith('pnpm-lock.yaml')) ? 'pnpm' : 'npm'
        );
        try {
          const pkg = JSON.parse(content) as Record<string, unknown>;
          const allDependencies: Record<string, string> = {
            ...((pkg.dependencies as Record<string, string> | undefined) || {}),
            ...((pkg.devDependencies as Record<string, string> | undefined) || {})
          };
          Object.keys(allDependencies).forEach((dependency) => dependencies.add(dependency));
          if (allDependencies.react) frameworks.add('React');
          if (allDependencies.next) frameworks.add('Next.js');
          if (allDependencies.vue) frameworks.add('Vue');
          if (allDependencies.express) frameworks.add('Express');
          if (allDependencies['@nestjs/core']) frameworks.add('NestJS');
          if (allDependencies.mongoose) databases.add('MongoDB');
          if (allDependencies.pg || allDependencies.postgres || allDependencies.prisma)
            databases.add('PostgreSQL');
          if (allDependencies.jest) testFrameworks.add('Jest');
          if (allDependencies.vitest) testFrameworks.add('Vitest');
          if (allDependencies['@playwright/test']) testFrameworks.add('Playwright');
          buildSystems.add('Node.js scripts');
        } catch {
          /* malformed manifest remains visible in the file manifest */
        }
      } else if (base === 'requirements.txt' || base === 'pyproject.toml') {
        packageManagers.add(base === 'pyproject.toml' ? 'Python/PEP 517' : 'pip');
        frameworks.add('Python');
        content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'))
          .forEach((dependency) => dependencies.add(dependency.split(/[<>=~!\s]/)[0]));
        if (/pytest/i.test(content)) testFrameworks.add('pytest');
        if (/django/i.test(content)) frameworks.add('Django');
        if (/fastapi/i.test(content)) frameworks.add('FastAPI');
      } else if (base === 'go.mod') {
        packageManagers.add('Go modules');
        buildSystems.add('Go');
      } else if (base === 'cargo.toml') {
        packageManagers.add('Cargo');
        buildSystems.add('Cargo');
      } else if (base === 'pom.xml' || base === 'build.gradle')
        buildSystems.add(base === 'pom.xml' ? 'Maven' : 'Gradle');

      if (/(openapi|swagger)\.(json|ya?ml)$/i.test(relativePath)) {
        if (relativePath.toLowerCase().endsWith('.json')) {
          try {
            const spec = JSON.parse(content) as { paths?: Record<string, unknown> };
            Object.keys(spec.paths || {}).forEach((endpoint) => openApiEndpoints.add(endpoint));
          } catch {
            /* malformed specification is reported by the absence of extracted endpoints */
          }
        } else
          for (const match of content.matchAll(/^\s{0,4}(\/[^:\s]+):\s*$/gm))
            openApiEndpoints.add(match[1]);
      }
    }

    const readmeEntry = [...fileContents.entries()].find(([file]) =>
      /^readme(?:\.[^/]+)?$/i.test(file)
    );
    const relevantFiles = records.filter((record) =>
      ['SOURCE', 'TEST', 'CONFIGURATION', 'DOCUMENTATION'].includes(record.classification)
    );
    const priority = (file: string) =>
      /(^|\/)(package\.json|readme|main\.|index\.|app\.|server\.|routes?\.|openapi|swagger)/i.test(
        file
      )
        ? 0
        : isTestPath(file)
          ? 1
          : 2;
    const snippetCandidates = relevantFiles
      .filter((record) => fileContents.has(record.path))
      .sort((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path))
      .slice(0, Number(process.env.DISCOVERY_MAX_SNIPPETS || 50));
    const keyFileSnippets = Object.fromEntries(
      snippetCandidates.map((record) => [
        record.path,
        fileContents.get(record.path)!.slice(0, 8_000)
      ])
    );
    const manifest: RepositoryManifest = {
      totalFiles: fileList.length,
      relevantFiles: relevantFiles.length,
      analyzedFiles: relevantFiles.filter((record) => Boolean(record.sha256)).length,
      ignoredFiles: records.filter((record) => record.classification === 'IGNORED').length,
      failedFiles: records.filter((record) => record.ignoredReason?.includes('failed')).length,
      binaryFiles: records.filter((record) => record.classification === 'BINARY').length,
      generatedFiles: records.filter((record) => record.classification === 'GENERATED').length,
      totalBytes,
      truncated,
      truncationReason,
      files: records
    };
    const sortedLanguages = Object.entries(languages).sort(([, a], [, b]) => b - a);
    const result: DiscoveryResult = {
      execution: executionRecord(startedAt),
      languages,
      primaryLanguage: sortedLanguages[0]?.[0] || 'Unknown',
      sbomPackageCount: dependencies.size,
      topDependencies: [...dependencies].sort().slice(0, 100),
      hasOpenApi: [...fileContents.keys()].some((file) =>
        /(openapi|swagger)\.(json|ya?ml)$/i.test(file)
      ),
      openApiEndpointsCount: openApiEndpoints.size,
      openApiEndpoints: [...openApiEndpoints].sort(),
      detectedFrameworks: [...frameworks].sort(),
      detectedPackageManagers: [...packageManagers].sort(),
      detectedBuildSystems: [...buildSystems].sort(),
      detectedTestFrameworks: [...testFrameworks].sort(),
      detectedDatabases: [...databases].sort(),
      rawReadme: readmeEntry?.[1] || '',
      fileList,
      keyFileSnippets,
      manifest
    };
    logger.info(
      { primaryLanguage: result.primaryLanguage, manifest },
      'Repository discovery completed'
    );
    return result;
  }
}

export default ProjectDiscoveryRunner;
