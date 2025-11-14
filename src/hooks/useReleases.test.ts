import { describe, it, expect } from 'vitest';
import { buildSourceArchiveUrl } from './useReleases';

describe('buildSourceArchiveUrl', () => {
  it('builds ZIP archive URL correctly', () => {
    const url = buildSourceArchiveUrl('owner', 'repo', 'v1.0.0', 'zip');
    expect(url).toBe('https://github.com/owner/repo/archive/refs/tags/v1.0.0.zip');
  });

  it('builds TAR.GZ archive URL correctly', () => {
    const url = buildSourceArchiveUrl('owner', 'repo', 'v1.0.0', 'tar.gz');
    expect(url).toBe('https://github.com/owner/repo/archive/refs/tags/v1.0.0.tar.gz');
  });
});