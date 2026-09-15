import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { GalileoConfig } from 'galileo-generated';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

import { createDataset } from '../../src/utils/datasets';
import { commonHandlers, TEST_HOST } from '../common';

/**
 * `createDataset` serialises in-memory rows to a temp file, and the upload reads
 * that file back as a separate, later step (`fs.readFile` in
 * dataset-service.ts, after an `await`). A single fixed path in `os.tmpdir()`
 * therefore let two concurrent calls interleave write/write/read, so both
 * uploads carried the second writer's rows -- silently, because each dataset's
 * own name and id were still correct.
 *
 * Kept separate from datasets.test.ts on purpose: the `jest.mock('os')` below
 * must stay file-scoped. Redirecting `os.tmpdir()` is what makes the cleanup
 * assertions meaningful -- setting `process.env.TMPDIR` does not work, because
 * jest gives each test file its own `process.env` copy while `os.tmpdir()`
 * reads the real process env, leaving the sandbox permanently empty and the
 * assertion inert. It also keeps the assertions off the shared temp directory,
 * which sibling jest workers write to.
 */

// Must be `mock`-prefixed: jest rejects other out-of-scope names in a factory.
let mockSandboxTmp: string;
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  tmpdir: () => mockSandboxTmp
}));

// Lets one test fail the serialisation write *after* mkdtemp has run, which is
// the only way to reach that leak path. Scoped to dataset temp files, so the
// suite's own writes (and every other fs call) pass straight through.
let mockFailDatasetWrite = false;
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    writeFileSync: (target: unknown, ...rest: unknown[]) => {
      if (mockFailDatasetWrite && String(target).includes('galileo-dataset-')) {
        throw new Error('simulated write failure');
      }
      return (actual.writeFileSync as (...args: unknown[]) => unknown)(
        target,
        ...rest
      );
    }
  };
});

const DATASET_ID = 'ds-temp-file-test';

/** Rows the server actually received, keyed by the dataset name sent with them. */
const uploadedRowsByName = new Map<string, string>();

const datasetResponse = (name: string) => ({
  id: DATASET_ID,
  name,
  column_names: ['col'],
  project_count: 0,
  num_rows: 1,
  created_at: '2021-09-10T00:00:00Z',
  updated_at: '2021-09-10T00:00:00Z',
  created_by_user: null,
  current_version_index: 0,
  draft: false
});

const postDatasetsHandler = jest
  .fn()
  .mockImplementation(async ({ request }) => {
    const form = await request.formData();
    const name = String(form.get('name'));
    const file = form.get('file');
    uploadedRowsByName.set(
      name,
      file instanceof Blob ? await file.text() : String(file)
    );
    return HttpResponse.json(datasetResponse(name));
  });

const server = setupServer(
  ...commonHandlers,
  http.post(`${TEST_HOST}/datasets`, postDatasetsHandler)
);

const leftovers = (): string[] =>
  readdirSync(mockSandboxTmp).filter((entry) =>
    entry.startsWith('galileo-dataset-')
  );

beforeAll(() => {
  process.env.GALILEO_API_KEY = 'test-key';
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  GalileoConfig.reset();
  mockSandboxTmp = mkdtempSync(
    join(jest.requireActual('os').tmpdir(), 'galileo-sdk-test-')
  );
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => {
  server.resetHandlers();
  uploadedRowsByName.clear();
});
afterAll(() => {
  server.close();
  rmSync(mockSandboxTmp, { recursive: true, force: true });
});

describe('createDataset temp file isolation', () => {
  test('test create dataset concurrently uploads each call its own rows', async () => {
    // Both calls run their synchronous serialisation before either upload's
    // `await fs.readFile`, so a shared path means the first writer's content is
    // already gone by the time its own upload reads it back.
    await Promise.all([
      createDataset({ name: 'alpha', content: [{ col: 'alpha-row' }] }),
      createDataset({ name: 'beta', content: [{ col: 'beta-row' }] })
    ]);

    expect(uploadedRowsByName.get('alpha')).toContain('alpha-row');
    expect(uploadedRowsByName.get('alpha')).not.toContain('beta-row');
    expect(uploadedRowsByName.get('beta')).toContain('beta-row');
    expect(uploadedRowsByName.get('beta')).not.toContain('alpha-row');
  });

  test('test create dataset concurrently with dict-of-arrays content', async () => {
    await Promise.all([
      createDataset({ name: 'gamma', content: { col: ['gamma-row'] } }),
      createDataset({ name: 'delta', content: { col: ['delta-row'] } })
    ]);

    expect(uploadedRowsByName.get('gamma')).toContain('gamma-row');
    expect(uploadedRowsByName.get('gamma')).not.toContain('delta-row');
    expect(uploadedRowsByName.get('delta')).toContain('delta-row');
  });

  test('test create dataset removes the temp directory after upload', async () => {
    // Unique paths would otherwise leak one directory per call, where the old
    // shared file was simply overwritten.
    expect(leftovers()).toHaveLength(0);
    await createDataset({ name: 'epsilon', content: [{ col: 'epsilon-row' }] });
    expect(leftovers()).toHaveLength(0);
  });

  test('test create dataset removes the temp directory when the upload fails', async () => {
    // The reason cleanup sits in a `finally`.
    server.use(
      http.post(`${TEST_HOST}/datasets`, () =>
        HttpResponse.json({ detail: 'nope' }, { status: 500 })
      )
    );

    expect(leftovers()).toHaveLength(0);
    await expect(
      createDataset({ name: 'zeta', content: [{ col: 'zeta-row' }] })
    ).rejects.toThrow();
    expect(leftovers()).toHaveLength(0);
  });

  test('test create dataset removes the temp directory when serialisation fails', async () => {
    // mkdtemp succeeds before the write, and on failure the caller never
    // receives the directory -- so `createDataset`'s `finally` cannot clean up
    // and it would be orphaned.
    expect(leftovers()).toHaveLength(0);
    mockFailDatasetWrite = true;
    try {
      await expect(
        createDataset({ name: 'theta', content: [{ col: 'theta-row' }] })
      ).rejects.toThrow('simulated write failure');
    } finally {
      mockFailDatasetWrite = false;
    }
    expect(leftovers()).toHaveLength(0);
  });

  test('test create dataset never removes a caller-supplied path', async () => {
    // Cleanup is a recursive force-remove of a directory. If a caller-supplied
    // path were ever treated as temp, it would delete the user's own directory.
    const userDir = mkdtempSync(join(mockSandboxTmp, 'user-owned-'));
    const userFile = join(userDir, 'rows.jsonl');
    writeFileSync(userFile, '{"col":"user-row"}\n', { encoding: 'utf-8' });

    await createDataset({ name: 'eta', content: userFile });

    expect(readdirSync(userDir)).toContain('rows.jsonl');
    expect(uploadedRowsByName.get('eta')).toContain('user-row');
  });
});
