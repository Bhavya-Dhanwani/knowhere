import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectDiscoveryRunner } from '../src/modules/runners/discovery.runner.js';
import { FrontendEvalRunner } from '../src/modules/runners/frontend.runner.js';
import { RepositoryRunner } from '../src/modules/runners/repository.runner.js';
import { KubernetesSandboxManifestGenerator } from '../src/modules/runners/sandbox.runner.js';

describe('truthful evaluation runners', () => {
  it('recursively manifests source files and explicitly ignores generated directories', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'review-discovery-test-'));
    try {
      await fs.mkdir(path.join(root, 'src', 'nested'), { recursive: true });
      await fs.mkdir(path.join(root, 'node_modules', 'dependency'), { recursive: true });
      await fs.writeFile(path.join(root, 'src', 'nested', 'feature.ts'), 'export const value = 1;');
      await fs.writeFile(path.join(root, 'package.json'), '{"dependencies":{"zod":"1.0.0"}}');
      await fs.writeFile(path.join(root, 'node_modules', 'dependency', 'index.js'), 'ignored');

      const result = await ProjectDiscoveryRunner.discover(root);
      expect(result.execution.status).toBe('SUCCEEDED');
      expect(result.fileList).toContain('src/nested/feature.ts');
      expect(result.manifest.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'src/nested/feature.ts', classification: 'SOURCE' }),
          expect.objectContaining({ path: 'node_modules/', classification: 'GENERATED' })
        ])
      );
      expect(result.manifest.analyzedFiles).toBeGreaterThan(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('does not manufacture browser scores when the runner is absent', async () => {
    const previous = process.env.BROWSER_EVALUATION_RUNNER_URL;
    delete process.env.BROWSER_EVALUATION_RUNNER_URL;
    try {
      const result = await FrontendEvalRunner.evaluate('https://example.test');
      expect(result.execution.status).toBe('UNAVAILABLE');
      expect(result.lighthouse).toBeUndefined();
    } finally {
      if (previous) process.env.BROWSER_EVALUATION_RUNNER_URL = previous;
    }
  });

  it('rejects repository URLs that could become command input', () => {
    expect(() =>
      RepositoryRunner.validateRepositoryUrl('https://github.com/org/repo.git;whoami')
    ).toThrow('Only canonical');
  });

  it('generates a non-root, gVisor, deny-by-default sandbox job', () => {
    const resources = KubernetesSandboxManifestGenerator.generate({
      evaluationId: 'abc123',
      repositoryUrl: 'https://github.com/org/repo.git',
      commitSha: 'a'.repeat(40),
      image: 'runner@sha256:1234',
      command: ['/runner/evaluate']
    }) as Array<Record<string, any>>;
    const policy = resources.find((resource) => resource.kind === 'NetworkPolicy');
    const job = resources.find((resource) => resource.kind === 'Job');
    expect(policy?.spec.egress).toEqual([]);
    expect(job?.spec.template.spec.runtimeClassName).toBe('gvisor');
    expect(job?.spec.template.spec.automountServiceAccountToken).toBe(false);
    expect(job?.spec.template.spec.containers[0].securityContext.capabilities.drop).toEqual([
      'ALL'
    ]);
  });
});
