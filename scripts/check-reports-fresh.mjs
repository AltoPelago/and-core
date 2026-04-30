import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);

const reportJobs = [
  {
    label: 'reference parser CTS report',
    args: [
      'scripts/run-cts.mjs',
      '--adapter',
      './implementations/reference-parser/adapter.mjs',
      '--json',
      '--quiet',
    ],
    reportPath: 'cts/reports/reference-parser-report.json',
  },
  {
    label: 'reference subset CTS report',
    args: [
      'scripts/run-cts.mjs',
      '--adapter',
      './implementations/reference-subset/adapter.mjs',
      '--json',
      '--quiet',
    ],
    reportPath: 'cts/reports/reference-subset-report.json',
  },
  {
    label: 'baseline adapter CTS report',
    args: ['scripts/run-cts.mjs', '--adapter', './cts/examples/baseline-adapter.mjs', '--json', '--quiet'],
    reportPath: 'cts/reports/baseline-adapter-report.json',
  },
  {
    label: 'canonical emitter report',
    args: ['scripts/check-canonical-emitter.mjs'],
    reportPath: 'cts/reports/reference-canonical-report.json',
  },
  {
    label: 'HTML renderer report',
    args: ['scripts/check-html-renderer.mjs'],
    reportPath: 'cts/reports/reference-html-report.json',
  },
];

function runReport(job, outPath) {
  const result = spawnSync(process.execPath, [...job.args, '--out', outPath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${job.label} generation failed`);
  }
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'and-report-check-'));
  const stale = [];

  try {
    for (const job of reportJobs) {
      const generatedPath = path.join(tempDir, path.basename(job.reportPath));
      runReport(job, generatedPath);

      const currentPath = path.join(repoRoot, job.reportPath);
      const [generated, current] = await Promise.all([fs.readFile(generatedPath), fs.readFile(currentPath)]);
      if (!generated.equals(current)) {
        stale.push(job.reportPath);
      }
    }
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }

  if (stale.length > 0) {
    throw new Error(`CTS report artifacts are stale. Run npm run cts:report:all and commit:\n${stale.join('\n')}`);
  }

  console.log('CTS report artifacts are fresh.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
