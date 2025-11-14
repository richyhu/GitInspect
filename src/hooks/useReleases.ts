import { useEffect, useRef, useState } from 'react';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type?: string;
}

export interface ReleaseInfo {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

const GITHUB_API_BASE_URL = 'https://api.github.com';
// 公用令牌（后备使用，不在UI显示或本地存储）
const PUBLIC_GITHUB_TOKEN = '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';

type Status = 'idle' | 'loading' | 'success' | 'error';

// 内存缓存，避免多次进入同一仓库重复请求
const memoryCache = new Map<string, { ts: number; data: ReleaseInfo[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10分钟缓存

function getHeaders(apiToken: string = ''): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  const effective = apiToken && apiToken.trim() ? apiToken.trim() : PUBLIC_GITHUB_TOKEN;
  if (effective) headers.Authorization = `token ${effective}`;
  return headers;
}

function loadLocalCache(key: string): ReleaseInfo[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.ts || !parsed.data) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data as ReleaseInfo[];
  } catch {
    return null;
  }
}

function saveLocalCache(key: string, data: ReleaseInfo[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export function useReleases(owner: string | undefined, repo: string | undefined, apiToken: string) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [releases, setReleases] = useState<ReleaseInfo[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!owner || !repo) return;
    const cacheKey = `releases_cache:${owner}/${repo}`;
    const mem = memoryCache.get(cacheKey);
    const local = loadLocalCache(cacheKey);

    if (mem && Date.now() - mem.ts <= CACHE_TTL_MS) {
      setReleases(mem.data);
      setStatus('success');
      setError(null);
      return;
    }
    if (local) {
      setReleases(local);
      setStatus('success');
      setError(null);
      // SWR：同时后台刷新
    }

    setStatus(local ? 'success' : 'loading');
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/releases`, {
      headers: getHeaders(apiToken),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`获取发行版失败：${res.status}`);
        const json = (await res.json()) as any[];
        const data: ReleaseInfo[] = json.map((r) => ({
          id: r.id,
          tag_name: r.tag_name,
          name: r.name ?? r.tag_name,
          body: r.body ?? '',
          published_at: r.published_at ?? r.created_at,
          draft: !!r.draft,
          prerelease: !!r.prerelease,
          assets: (r.assets ?? []).map((a: any) => ({
            name: a.name,
            browser_download_url: a.browser_download_url,
            size: a.size,
            content_type: a.content_type,
          })),
        }));
        setReleases(data);
        setStatus('success');
        setError(null);
        memoryCache.set(cacheKey, { ts: Date.now(), data });
        saveLocalCache(cacheKey, data);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : '获取发行版失败');
        setStatus('error');
      });

    return () => {
      abortRef.current?.abort();
    };
  }, [owner, repo, apiToken]);

  const refresh = () => {
    if (!owner || !repo) return;
    // 强制忽略缓存，重新请求
    memoryCache.delete(`releases_cache:${owner}/${repo}`);
    saveLocalCache(`releases_cache:${owner}/${repo}`, []);
    // 触发 effect 重新加载
    setStatus('loading');
    setError(null);
  };

  return { status, error, releases, refresh };
}

// 构造源码压缩包下载链接（更稳定的 refs/tags 形式）
export function buildSourceArchiveUrl(owner: string, repo: string, tag: string, format: 'zip' | 'tar.gz') {
  const suffix = format === 'zip' ? 'zip' : 'tar.gz';
  return `https://github.com/${owner}/${repo}/archive/refs/tags/${tag}.${suffix}`;
}