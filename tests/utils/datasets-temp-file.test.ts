import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { createDataset } from '../../src/utils/datasets';
import { commonHandlers, TEST_HOST } from '../common';

/**
 * `createDataset` serialises in-memory rows to a temp file and the upload reads
 * that file back as a separate, later step (`fs.readFile` in
 * dataset-service.ts, after an `await`). A single fixed path in `os.tmpdir()`
 * therefore let two concurrent calls interleave write/write/read, so both
 * uploads carried the second writer's rows -- silently, because each dataset's
 * own name and id were still correct.
 */

const DATASET_ID = 'ds-temp-file-test';

/** Rows the server actually received, keyed by the dataset name sent with them. */
const uploadedRowsByName = new Map<string, string>();

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
    return HttpResponse.json({
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
  });

const server = setupServer(
  ...commonHandlers,
  http.post(`${TEST_HOST}/datasets`, postDatasetsHandler)
);

// Own TMPDIR for this file. `os.tmpdir()` reads the env on every call, so the
// SDK's `mkdtemp` lands here -- which makes counting leftovers deterministic.
// jest runs test files in parallel workers and datasets.test.ts also creates
// datasets, so counting the shared tmpdir would race against a sibling worker.
let sandboxTmp: string;
let originalTmpDir: string | undefined;

beforeAll(() => {
  process.env.GALILEO_API_KEY = 'test-key';
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  originalTmpDir = process.env.TMPDIR;
  sandboxTmp = mkdtempSync(join(tmpdir(), 'galileo-sdk-test-'));
  process.env.TMPDIR = sandboxTmp;
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => uploadedRowsByName.clear());
afterAll(() => {
  server.close();
  if (originalTmpDir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = originalTmpDir;
  rmSync(sandboxTmp, { recursive: true, force: true });
});

describe('createDataset temp file isolation', () => {
  test('concurrent calls each upload their own rows', async () => {
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

  test('the dict-of-arrays form is isolated too', async () => {
    await Promise.all([
      createDataset({ name: 'gamma', content: { col: ['gamma-row'] } }),
      createDataset({ name: 'delta', content: { col: ['delta-row'] } })
    ]);

    expect(uploadedRowsByName.get('gamma')).toContain('gamma-row');
    expect(uploadedRowsByName.get('gamma')).not.toContain('delta-row');
    expect(uploadedRowsByName.get('delta')).toContain('delta-row');
  });

  test('the temp directory is removed after the upload', async () => {
    // Unique paths would otherwise leak one directory per call, where the old
    // shared file was simply overwritten.
    const leftovers = () =>
      readdirSync(sandboxTmp).filter((entry) =>
        entry.startsWith('galileo-dataset-')
      );

    expect(leftovers()).toHaveLength(0);
    await createDataset({ name: 'epsilon', content: [{ col: 'epsilon-row' }] });
    expect(leftovers()).toHaveLength(0);
  });
});
