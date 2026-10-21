import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const remove = vi.fn();
const from = vi.fn((_bucket: string) => ({ remove }));

vi.mock('./supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args), storage: { from: (bucket: string) => from(bucket) } } }));

import { releaseDeletedCaseImages } from './caseImageCleanupService';

const image = (name: string) => `https://project.supabase.co/storage/v1/object/public/case-images/user/${name}`;

describe('releaseDeletedCaseImages', () => {
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset();
    from.mockClear();
    remove.mockResolvedValue({ data: [], error: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('asks the database which images are unused, then removes only those', async () => {
    rpc.mockResolvedValue({ data: ['user/a.png'], error: null });
    await releaseDeletedCaseImages({ image_url: image('a.png'), image_urls: [image('a.png'), image('b.png'), ''] });
    expect(rpc).toHaveBeenCalledWith('releasable_case_images', { p_references: [image('a.png'), image('b.png')] });
    expect(from).toHaveBeenCalledWith('case-images');
    expect(remove).toHaveBeenCalledWith(['user/a.png']);
  });

  it('removes nothing when every image is still linked elsewhere or the case had none', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await releaseDeletedCaseImages({ image_urls: [image('a.png')] });
    await releaseDeletedCaseImages({ image_url: null, image_urls: null });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('never throws, because the case itself is already deleted', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('function missing') });
    await expect(releaseDeletedCaseImages({ image_url: image('a.png') })).resolves.toBeUndefined();
    rpc.mockResolvedValue({ data: ['user/a.png'], error: null });
    remove.mockResolvedValue({ data: null, error: new Error('denied') });
    await expect(releaseDeletedCaseImages({ image_url: image('a.png') })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
