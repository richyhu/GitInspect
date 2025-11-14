import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
// 导入必要的库和组件
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Github, Moon, Sun, Search, Copy, ExternalLink, FileText, Code, Globe, FileCheck, Book, ChevronDown, ChevronRight, Star, GitBranch, Users, Key, Globe as GlobeIcon, X, History, Eye, EyeOff, Trash2, Download, CheckSquare, Square, Info, Tag } from 'lucide-react';
import { marked } from 'marked';
import React from 'react';
import { useReleases, buildSourceArchiveUrl } from '@/hooks/useReleases';

// 仓库数据类型定义
interface License {
  name: string;
  url: string;
}

interface RepositoryData {
  owner: string;
  name: string;
  full_name: string;
  description: string;
  stars: number;
  forks: number;
  contributors: number;
  created_at: string;
  updated_at: string;
  homepage: string;
  license: License;
  clone_url: string;
  ssh_url: string;
}

// 文件树节点类型
interface FileTreeNode {
  name: string;
  type: 'file' | 'dir';
  size: number;
  children?: FileTreeNode[];
  path?: string;
  sha?: string;
}

// GitHub API 相关配置
const GITHUB_API_BASE_URL = 'https://api.github.com';
const GITHUB_RAW_BASE_URL = 'https://raw.githubusercontent.com';
// 公用令牌（仅作为请求的后备值，不在UI显示或本地存储）
const PUBLIC_GITHUB_TOKEN = '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';

// 添加超时处理的fetch包装函数
const fetchWithTimeout = async (resource: string, options: Record<string, any> = {}, timeout: number = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// 基础mock数据 - 仅在API调用失败时使用
const baseMockData: RepositoryData = {
  owner: 'user',
  name: 'repo',
  full_name: 'user/repo',
  description: 'Mock data for repository',
  stars: 0,
  forks: 0,
  contributors: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  homepage: '',
  license: {
    name: 'Unknown License',
    url: ''
  },
  clone_url: 'https://github.com/user/repo.git',
  ssh_url: 'git@github.com:user/repo.git'
};

// 基础mock文件树 - 仅在API调用失败时使用
const baseMockFileTree: FileTreeNode[] = [
  { name: '.gitignore', type: 'file', size: 1024 },
  { name: 'LICENSE', type: 'file', size: 1536 },
  { name: 'README.md', type: 'file', size: 2048 },
  { name: 'package.json', type: 'file', size: 1280 },
  { 
    name: 'src', 
    type: 'dir', 
    size: 0,
    children: [
      { name: 'index.js', type: 'file', size: 512 },
      { name: 'components', type: 'dir', size: 0, 
        children: [
          { name: 'App.js', type: 'file', size: 2560 },
          { name: 'Header.js', type: 'file', size: 1536 }
        ]
      },
      { name: 'utils', type: 'dir', size: 0,
        children: [
          { name: 'helper.js', type: 'file', size: 1024 }
        ]
      }
    ]
  }
];

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 文件类型图标映射
const getFileIcon = (type: string, name: string) => {
  if (type === 'dir') return <ChevronRight className="w-4 h-4 mr-2" />;
  
  const ext = name.split('.').pop()?.toLowerCase() || '';
  
  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return <Code className="w-4 h-4 mr-2" />;
    case 'html':
      return <FileText className="w-4 h-4 mr-2" />;
    case 'md':
      return <Book className="w-4 h-4 mr-2" />;
    case 'json':
      return <FileCheck className="w-4 h-4 mr-2" />;
    default:
      return <FileText className="w-4 h-4 mr-2" />;
  }
};

// 解析GitHub仓库URL或路径
const parseGitHubInput = (input: string): string | null => {
  // 匹配 username/repo 格式
  const directMatch = input.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/);
  if (directMatch) return directMatch[0];
  
  // 匹配GitHub URL格式
  const urlMatch = input.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch.length >= 3) return `${urlMatch[1]}/${urlMatch[2]}`;
  
  return null;
};

// 构建API请求头（在未提供令牌时使用公用令牌作为后备）
const getHeaders = (apiToken: string = '') => {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json'
  };
  const effective = apiToken && apiToken.trim() ? apiToken.trim() : PUBLIC_GITHUB_TOKEN;
  if (effective) headers['Authorization'] = `token ${effective}`;
  
  return headers;
};

// 获取特定目录的内容
const fetchDirectoryContent = async (owner: string, repo: string, path: string, apiToken: string = ''): Promise<FileTreeNode[]> => {
  try {
    const response = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contents/${path}`, {
      headers: getHeaders(apiToken)
    });
    
    if (!response.ok) {
      throw new Error('获取目录内容失败');
    }
    
    const contents = await response.json();
    
    // 构建子目录内容节点
    const nodes: FileTreeNode[] = contents.map((item: any) => ({
      name: item.name,
      type: item.type === 'dir' ? 'dir' : 'file',
      size: item.size || 0,
      path: item.path,
      sha: item.sha,
      // 对于目录，初始化为undefined，展开时再加载
      children: undefined
    }));
    
    // 排序
    nodes.sort((a, b) => {
      if (a.type === 'dir' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return nodes;
  } catch (error) {
    console.error(`获取目录${path}内容错误:`, error);
    // 出错时返回空数组
    return [];
  }
};

// 文件树组件
const FileTree = ({ files, owner, repo, apiToken }: { files: any[], owner: string, repo: string, apiToken: string }) => {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [fileTree, setFileTree] = useState<any[]>(files);
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{active: boolean; percent: number; text: string}>({active: false, percent: 0, text: ''});
  const [defaultBranch, setDefaultBranch] = useState<string>('');

  const ensureDefaultBranch = async () => {
    if (defaultBranch) return defaultBranch;
    try {
      const res = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}`, { headers: getHeaders(apiToken) }, 15000);
      const json = await res.json();
      const branch = json.default_branch || 'main';
      setDefaultBranch(branch);
      return branch;
    } catch {
      setDefaultBranch('main');
      return 'main';
    }
  };

  const loadJSZip = async (): Promise<any> => {
    // 动态加载 JSZip 以避免安装依赖
    // @ts-ignore
    if (window.JSZip) {
      // @ts-ignore
      return window.JSZip;
    }
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('JSZip 加载失败'));
      document.head.appendChild(s);
    });
    // @ts-ignore
    return window.JSZip;
  };

  const addSelected = (path: string, checked: boolean) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (checked) next.add(path); else next.delete(path);
      return next;
    });
  };

  const getNodePath = (node: any) => node.path || node.name;

  const fetchDescription = async (path: string) => {
    try {
      const res = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=1`, { headers: getHeaders(apiToken) }, 15000);
      const commits = await res.json();
      const msg = Array.isArray(commits) && commits[0]?.commit?.message ? commits[0].commit.message : '暂无描述';
      setDescriptions(prev => ({ ...prev, [path]: msg }));
    } catch {
      setDescriptions(prev => ({ ...prev, [path]: '暂无描述' }));
    }
  };

  const collectFilesRecursively = async (node: any, acc: { path: string; name: string; size: number }[] = []): Promise<{ path: string; name: string; size: number }[]> => {
    if (node.type === 'file') {
      acc.push({ path: node.path || node.name, name: node.name, size: node.size || 0 });
      return acc;
    }
    // 目录：确保 children 可用
    let children = node.children;
    if (!children || children.length === 0) {
      try {
        const fetched = await fetchDirectoryContent(owner, repo, node.path, apiToken);
        updateFileTree(node.path, fetched);
        children = fetched;
      } catch (e) {
        console.error('获取目录失败:', e);
      }
    }
    for (const child of children || []) {
      await collectFilesRecursively(child, acc);
    }
    return acc;
  };

  const fetchFileBlob = async (branch: string, path: string): Promise<Blob> => {
    const url = `${GITHUB_RAW_BASE_URL}/${owner}/${repo}/${branch}/${path}`;
    const res = await fetchWithTimeout(url, { headers: getHeaders(apiToken) }, 30000);
    const buf = await res.arrayBuffer();
    return new Blob([buf]);
  };

  const downloadAll = async () => {
    setProgress({ active: true, percent: 0, text: '准备下载仓库...' });
    const branch = await ensureDefaultBranch();
    const url = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/zipball/${branch}`;
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const filename = `${repo}_${yyyy}${mm}${dd}.zip`;
    try {
      const res = await fetchWithTimeout(url, { headers: getHeaders(apiToken) }, 60000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('已开始下载全部文件');
    } catch (e) {
      console.warn('获取 ZIP 失败，降级为直接链接', e);
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      a.target = '_blank';
      a.download = filename; // 跨域可能被忽略，但仍尝试设置
      a.click();
      toast.info('已跳转至 GitHub 下载页面，文件名可能为默认');
    } finally {
      setProgress({ active: false, percent: 0, text: '' });
    }
  };

  const downloadSelected = async () => {
    if (selectedPaths.size === 0) {
      toast('请选择要下载的文件/文件夹');
      return;
    }
    setProgress({ active: true, percent: 0, text: '正在收集选中文件...' });
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const branch = await ensureDefaultBranch();

    // 收集所有文件
    const nodesByPath = new Map<string, any>();
    const indexNodes = (nodes: any[]) => {
      for (const n of nodes) {
        nodesByPath.set(getNodePath(n), n);
        if (n.children) indexNodes(n.children);
      }
    };
    indexNodes(fileTree);

    const allFiles: { path: string; name: string; size: number }[] = [];
    for (const p of selectedPaths) {
      const n = nodesByPath.get(p);
      if (!n) continue;
      // 递归收集
      const collected = await collectFilesRecursively(n);
      allFiles.push(...collected);
    }

    if (allFiles.length === 0) {
      toast('没有可下载的文件');
      setProgress({ active: false, percent: 0, text: '' });
      return;
    }

    // 并发限制
    const concurrency = 5;
    let completed = 0;
    const queue = allFiles.slice();

    const worker = async () => {
      while (queue.length) {
        const item = queue.shift()!;
        setProgress(prev => ({ ...prev, text: `获取 ${item.path}...` }));
        try {
          const blob = await fetchFileBlob(branch, item.path);
          const arrayBuffer = await blob.arrayBuffer();
          const compression = item.size > 10 * 1024 * 1024 ? 'STORE' : 'DEFLATE';
          zip.file(item.path, arrayBuffer, { binary: true, compression });
        } catch (e) {
          console.error('获取文件失败', item.path, e);
        } finally {
          completed++;
          const percent = Math.round((completed / allFiles.length) * 50); // 前半程进度
          setProgress(prev => ({ ...prev, percent }));
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));

    setProgress(prev => ({ ...prev, text: '正在打包 ZIP...', percent: 60 }));
    const blob = await zip.generateAsync({ type: 'blob' }, (meta: any) => {
      const pct = 60 + Math.round((meta.percent || 0) * 0.4); // 打包占后 40%
      setProgress(prev => ({ ...prev, percent: Math.min(99, pct) }));
    });
    const a = document.createElement('a');
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    a.href = URL.createObjectURL(blob);
    a.download = `${repo}_${yyyy}${mm}${dd}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('已开始下载选中项');
    setProgress({ active: false, percent: 0, text: '' });
  };
  
  // 更新文件树中特定路径的子节点
  const updateFileTree = (path: string, newChildren: any[]) => {
    const updateNode = (nodes: any[], targetPath: string): any[] => {
      return nodes.map(node => {
        if (node.path === targetPath && node.type === 'dir') {
          // 更新当前目录的子节点
          return {
            ...node,
            children: newChildren
          };
        }
        // 递归更新子目录
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: updateNode(node.children, targetPath)
          };
        }
        return node;
      });
    };
    
    setFileTree(updateNode(fileTree, path));
  };
  
  // 展开/折叠目录
  const toggleDir = async (file: any) => {
    const dirId = file.path || file.name;
    const newExpandedDirs = new Set(expandedDirs);
    
    // 如果目录已展开，则折叠它
    if (newExpandedDirs.has(dirId)) {
      newExpandedDirs.delete(dirId);
      setExpandedDirs(newExpandedDirs);
      return;
    }
    
    // 如果目录还没有子节点或子节点为空，则加载子内容
    if (!file.children || file.children.length === 0) {
      setLoadingDirs(prev => new Set(prev).add(dirId));
      try {
          const children = await fetchDirectoryContent(owner, repo, file.path, apiToken);
        updateFileTree(file.path, children);
      } catch (error) {
        console.error(`加载目录${file.name}内容失败:`, error);
      } finally {
        setLoadingDirs(prev => {
          const newLoading = new Set(prev);
          newLoading.delete(dirId);
          return newLoading;
        });
      }
    }
    
    // 展开目录
    newExpandedDirs.add(dirId);
    setExpandedDirs(newExpandedDirs);
  };
  
  // 递归渲染文件树
  const renderFiles = (filesList: any[], level: number = 0) => {
    return filesList.map((file) => (
      <div key={`${file.path || file.name}-${file.sha || ''}`} className="flex items-center py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
        <div className="flex items-center" style={{ marginLeft: `${level * 16}px` }}>
          {file.type === 'dir' ? (
            <button 
              onClick={() => toggleDir(file)}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white w-full justify-start"
            >
              {loadingDirs.has(file.path || file.name) ? (
                <span className="w-4 h-4 mr-2 inline-block">
                  <i className="fas fa-spinner fa-spin"></i>
                </span>
              ) : expandedDirs.has(file.path || file.name) ? (
                <ChevronDown className="w-4 h-4 mr-2" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-2" />
              )}
              <span>{file.name}</span>
            </button>
          ) : (
            <div className="flex items-center">
              {getFileIcon(file.type, file.name)}
              <span>{file.name}</span>
            </div>
          )}
        </div>
        <div className="ml-auto text-gray-500 text-sm">
          {file.type === 'file' && formatFileSize(file.size)}
        </div>
      </div>
    ));
  };
  
  // 递归检查是否有展开的子目录
  const hasExpandedChildren = (node: any): boolean => {
    if (node.type === 'dir' && expandedDirs.has(node.path || node.name)) {
      return true;
    }
    if (node.children) {
      return node.children.some((child: any) => hasExpandedChildren(child));
    }
    return false;
  };
  
  // 递归渲染展开的目录和文件
  const renderFileTree = (nodes: any[], level: number = 0) => {
    return nodes.map((node) => {
      const isExpanded = node.type === 'dir' && expandedDirs.has(node.path || node.name);
      const nodePath = getNodePath(node);
      const isChecked = selectedPaths.has(nodePath);
      
      return (
        <React.Fragment key={`${node.path || node.name}-${node.sha || ''}`}>
          <div className="flex items-center py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title={selectMode ? (descriptions[nodePath] || '加载描述中...') : undefined}>
            <div className="flex items-center" style={{ marginLeft: `${level * 16}px` }}>
              {selectMode && (
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={isChecked}
                  onChange={(e) => {
                    addSelected(nodePath, e.target.checked);
                    if (e.target.checked) fetchDescription(nodePath);
                  }}
                />
              )}
              {node.type === 'dir' ? (
                <button 
                  onClick={() => toggleDir(node)}
                  className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white w-full justify-start"
                >
                  {loadingDirs.has(node.path || node.name) ? (
                    <span className="w-4 h-4 mr-2 inline-block">
                      <i className="fas fa-spinner fa-spin"></i>
                    </span>
                  ) : isExpanded ? (
                    <ChevronDown className="w-4 h-4 mr-2" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2" />
                  )}
                  <span>{node.name}</span>
                </button>
              ) : (
                <div className="flex items-center">
                  {getFileIcon(node.type, node.name)}
                  <span>{node.name}</span>
                </div>
              )}
            </div>
            <div className="ml-auto text-gray-500 text-sm">
              {node.type === 'file' && formatFileSize(node.size)}
            </div>
          </div>
          
          {/* 渲染展开目录的子节点 */}
          {isExpanded && node.children && node.children.length > 0 && (
            <div className="pl-4">
              {renderFileTree(node.children, level + 1)}
            </div>
          )}
        </React.Fragment>
      );
    });
  };
  
  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-gray-900 overflow-auto relative">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={downloadAll} className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
          <Download className="w-4 h-4" /> 下载全部
        </button>
        <button onClick={() => setSelectMode(!selectMode)} className="px-3 py-1 text-sm rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 flex items-center gap-1">
          {selectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />} 选择下载
        </button>
        {selectMode && (
          <>
            <button onClick={() => {
              const all = new Set<string>();
              const markAll = (nodes: any[]) => {
                for (const n of nodes) { all.add(getNodePath(n)); if (n.children) markAll(n.children); }
              };
              markAll(fileTree);
              setSelectedPaths(all);
            }} className="px-3 py-1 text-sm rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700">全选</button>
            <button onClick={() => setSelectedPaths(new Set())} className="px-3 py-1 text-sm rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700">取消全选</button>
            <button onClick={downloadSelected} className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700">下载选中项</button>
            <div className="ml-auto text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Info className="w-3 h-3" /> 在选择模式下，悬停可查看描述
            </div>
          </>
        )}
      </div>

      {renderFileTree(fileTree)}

      {/* 进度遮罩 */}
      {progress.active && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded p-4 w-80">
            <div className="text-sm mb-2">{progress.text}</div>
            <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded">
              <div className="bg-blue-600 h-2 rounded" style={{ width: `${progress.percent}%` }}></div>
            </div>
            <div className="text-right text-xs mt-1">{progress.percent}%</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Markdown渲染组件
const MarkdownRenderer = ({ content }: { content: string }) => {
  // 使用marked库进行Markdown解析和渲染
  const renderMarkdown = (markdown: string): string => {
    // 配置marked选项
    marked.setOptions({
      breaks: true,
      gfm: true // 启用GitHub风格的Markdown
    });
    
    // 明确使用同步解析以满足返回 string 的类型要求
    return marked.parse(markdown, { async: false });
  };
  
  return (
    <div className="overflow-x-auto">
      <div 
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  );
};

// 克隆代码组件
const CloneCodeSection = ({ repoData }: { repoData: RepositoryData }) => {
  const [activeTab, setActiveTab] = useState<'https' | 'ssh'>('https');
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success('已复制到剪贴板!');
      })
      .catch(() => {
        toast.error('复制失败，请重试。');
      });
  };
  
  const getCloneCommand = () => {
    return activeTab === 'https' 
      ? `git clone ${repoData.clone_url}` 
      : `git clone ${repoData.ssh_url}`;
  };
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'https' 
            ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          onClick={() => setActiveTab('https')}
        >
          HTTPS
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'ssh' 
            ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          onClick={() => setActiveTab('ssh')}
        >
          SSH
        </button>
      </div>
      <div className="bg-white dark:bg-gray-900 p-4 flex justify-between items-center">
        <code className="text-sm text-gray-800 dark:text-gray-200">{getCloneCommand()}</code>
        <button
          onClick={() => copyToClipboard(getCloneCommand())}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// 主页面组件
export default function Home() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [repoInput, setRepoInput] = useState('');
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('repo_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const [repoData, setRepoData] = useState<RepositoryData | null>(null);
  const [readmeContent, setReadmeContent] = useState('');
  const [licenseContent, setLicenseContent] = useState('');
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [apiToken, setApiToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [revealToken, setRevealToken] = useState(false);
  // 多语言README相关状态
  const [availableReadmes, setAvailableReadmes] = useState<Array<{name: string, path: string}>>([]);
  const [selectedReadme, setSelectedReadme] = useState<string>('README.md');

  // 返回首页：重置所有与仓库相关的状态
  const resetToHome = () => {
    setRepoInput('');
    setRepoData(null);
    setReadmeContent('');
    setLicenseContent('');
    setFileTree([]);
    setIsLoading(false);
    setError(null);
    setActiveTab('overview');
    setAvailableReadmes([]);
    setSelectedReadme('README.md');
    setShowTokenInput(false);
    setRevealToken(false);
    setShowSuggestions(false);
    setHighlightIndex(-1);
  };
  
  // 构建API请求头（使用已在文件顶部定义的函数，这里保留引用以便参数传递）
  // 注意：getHeaders 函数已在文件顶部定义，这里通过参数传递当前组件的apiToken状态
  
   // 获取仓库基本信息 - 添加超时和优化
  const fetchRepoInfo = async (owner: string, repo: string): Promise<RepositoryData> => {
    try {
      // 先获取基本仓库信息
      const repoResponse = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}`, {
        headers: getHeaders(apiToken)
      });
      
      if (!repoResponse.ok) {
        throw new Error(`获取仓库信息失败: ${repoResponse.statusText}`);
      }
      
      const repoInfo = await repoResponse.json();
      
      // 贡献者数量是可选的，使用Promise.allSettled确保即使失败也能返回基本信息
      const contributorsPromise = fetchWithTimeout(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contributors`, {
        headers: getHeaders(apiToken)
      }).then(res => res.ok ? res.json() : []);
      
      const contributors = await contributorsPromise;
      const contributorsCount = Array.isArray(contributors) ? contributors.length : 0;
      
      return {
        owner: repoInfo.owner.login,
        name: repoInfo.name,
        full_name: repoInfo.full_name,
        description: repoInfo.description || '',
        stars: repoInfo.stargazers_count,
        forks: repoInfo.forks_count,
        contributors: contributorsCount,
        created_at: repoInfo.created_at,
        updated_at: repoInfo.updated_at,
        homepage: repoInfo.homepage || '',
        license: repoInfo.license ? {
          name: repoInfo.license.name,
          url: repoInfo.license.url
        } : { name: '无许可证', url: '' },
        clone_url: repoInfo.clone_url,
        ssh_url: repoInfo.ssh_url
      };
    } catch (error) {
      console.error('获取仓库信息错误:', error);
      throw error;
    }
  };
  
  // 添加超时处理的fetch包装函数（已在文件顶部定义）
  // 注意：fetchWithTimeout 函数已在文件顶部定义，这里不再重复定义

  // 获取README内容 - 改进版，增加重试机制和多种路径尝试
  const fetchReadmeContent = async (owner: string, repo: string, readmePath: string = 'README.md'): Promise<string> => {
    // 尝试的分支列表
    const branchesToTry = ['main', 'master', 'develop'];
    
    // 重试函数
    const retryWithBranches = async (path: string): Promise<string> => {
      for (const branch of branchesToTry) {
        try {
          // 尝试直接获取指定路径的README文件
          const response = await fetchWithTimeout(`${GITHUB_RAW_BASE_URL}/${owner}/${repo}/${branch}/${path}`, {
            headers: getHeaders()
          });
          
          if (response.ok) {
            return await response.text();
          }
        } catch (error) {
          console.log(`从${branch}分支获取README失败:`, error);
          // 继续尝试下一个分支
          continue;
        }
      }
      
      // 如果所有分支都失败，尝试通过API获取
      try {
        const apiResponse = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contents/${readmePath}`, {
          headers: {
            ...getHeaders(apiToken),
            'Accept': 'application/vnd.github.v3.raw'
          }
        });
        
        if (apiResponse.ok) {
          return await apiResponse.text();
        }
      } catch (apiError) {
        console.error('通过API获取README错误:', apiError);
      }
      
      // 所有尝试都失败
      return `# ${repo}\n\n无法从多个来源加载README。`;
    };
    
    try {
      // 先尝试用户指定的路径
      const content = await retryWithBranches(readmePath);
      if (content && !content.includes('无法从多个来源加载')) {
        return content;
      }
      
      // 如果指定路径失败，尝试其他常见的README格式
      const commonReadmePaths = ['README.md', 'README.markdown', 'Readme.md'];
      for (const path of commonReadmePaths) {
        if (path !== readmePath) {
          const fallbackContent = await retryWithBranches(path);
          if (fallbackContent && !fallbackContent.includes('无法从多个来源加载')) {
            return fallbackContent;
          }
        }
      }
      
      return `# ${repo}\n\n在此仓库中未找到合适的README文件。`;
    } catch (error) {
      console.error('获取README出现严重错误:', error);
      return `# ${repo}\n\n无法加载README。请检查您的网络连接或稍后再试。`;
    }
  };
  
  // 获取仓库中所有可用的README文件
  const fetchAvailableReadmes = async (owner: string, repo: string): Promise<Array<{name: string, path: string}>> => {
    try {
      // 获取默认分支
      const repoResponse = await fetch(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}`, {
        headers: getHeaders(apiToken)
      });
      
      if (!repoResponse.ok) {
        throw new Error('获取仓库信息失败');
      }
      
      const repoInfo = await repoResponse.json();
      const defaultBranch = repoInfo.default_branch;
      
      // 获取根目录内容
      const treeResponse = await fetch(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contents`, {
        headers: getHeaders(apiToken)
      });
      
      if (!treeResponse.ok) {
        throw new Error('获取仓库内容失败');
      }
      
      const contents = await treeResponse.json();
      const readmes: Array<{name: string, path: string}> = [];
      
      // 查找所有README文件
      contents.forEach((item: any) => {
        if (item.name.toUpperCase().startsWith('README') && 
            (item.name.endsWith('.md') || item.name.endsWith('.markdown'))) {
          readmes.push({
            name: item.name,
            path: item.name
          });
        }
      });
      
      // 如果没有找到README.md，但找到了其他README，默认选择第一个
      if (readmes.length > 0 && !readmes.some(r => r.name === 'README.md')) {
        setSelectedReadme(readmes[0].name);
      }
      
      return readmes;
    } catch (error) {
      console.error('获取可用README文件错误:', error);
      // 出错时返回默认的README.md
      return [{ name: 'README.md', path: 'README.md' }];
    }
  };
  
   // 获取许可证内容 - 添加超时处理
  const fetchLicenseContent = async (owner: string, repo: string): Promise<string> => {
    try {
      const response = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/license`, {
        headers: getHeaders(apiToken)
      });
      
      if (!response.ok) {
        return '在此仓库中未找到许可证文件。';
      }
      
      const licenseData = await response.json();
      // 解码base64内容
      const content = atob(licenseData.content.replace(/\n/g, ''));
      return content;
    } catch (error) {
      console.error('获取许可证错误:', error);
      return '无法加载许可证。';
    }
  };
  
  // 获取文件树 - 优化版，添加超时和简化逻辑
  const fetchFileTree = async (owner: string, repo: string, apiToken: string = ''): Promise<FileTreeNode[]> => {
    try {
      // 首先尝试获取根目录内容（非递归，更快）
      const rootResponse = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contents`, {
        headers: getHeaders(apiToken)
      });
      
      if (!rootResponse.ok) {
        throw new Error('获取仓库根目录内容失败');
      }
      
      const rootContents = await rootResponse.json();
      
      // 构建文件树节点，保留完整的原始数据
      const rootNodes: FileTreeNode[] = rootContents.map((item: any) => ({
        name: item.name,
        type: item.type === 'dir' ? 'dir' : 'file',
        size: item.size || 0,
        path: item.path,
        sha: item.sha,
        // 对于目录，初始化为undefined，展开时再加载
        children: undefined
      }));
      
      // 对节点进行排序，目录在前，文件在后，按名称字母顺序
      rootNodes.sort((a, b) => {
        if (a.type === 'dir' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
      
      return rootNodes.length > 0 ? rootNodes : baseMockFileTree;
    } catch (error) {
      console.error('获取文件树错误:', error);
      // 如果失败，返回基础mock文件树
      return baseMockFileTree;
    }
  };
  
   // 获取仓库数据 - 优化版，实现渐进式加载
  const fetchRepositoryData = async (repoPath: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [owner, repo] = repoPath.split('/');
      if (!owner || !repo) {
        throw new Error('无效的仓库路径');
      }
      
      // 首先获取基本仓库信息（优先级最高）
      const repoInfo = await fetchRepoInfo(owner, repo);
      setRepoData(repoInfo);
      
      // 然后并行获取其他数据，这样可以先显示基本信息
      const [availableReadmes, readme] = await Promise.all([
        fetchAvailableReadmes(owner, repo),
        fetchReadmeContent(owner, repo, selectedReadme)
      ]);
      
      setAvailableReadmes(availableReadmes);
      setReadmeContent(readme);
      
      // 最后获取文件树和许可证（相对不那么重要的数据）
      const [license, files] = await Promise.all([
        fetchLicenseContent(owner, repo),
         fetchFileTree(owner, repo)
      ]);
      
      setLicenseContent(license);
      setFileTree(files);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取仓库数据失败';
      
      // 处理GitHub API限流
      if (errorMessage.includes('403') || errorMessage.includes('rate limit')) {
        setError('GitHub API 速率限制已超出。请添加API令牌以获取更高限制。');
        setShowTokenInput(true);
        toast.error('速率限制已超出。添加GitHub API令牌以获取更多请求。');
      } else if (errorMessage.includes('404')) {
        setError('仓库未找到。请检查仓库名称或URL。');
      } else if (errorMessage.includes('aborted')) {
        setError('请求超时。请重试或添加GitHub API令牌以加快访问速度。');
      } else {
        setError(`获取仓库数据失败: ${errorMessage}`);
      }
      
      // 在API调用失败时使用基于输入的模拟数据
      const [owner, repo] = repoPath.split('/');
      const fallbackData = {
        ...baseMockData,
        owner: owner || '用户',
        name: repo || '仓库',
        full_name: repoPath,
        description: `无法加载 ${repoPath} 的数据`,
        clone_url: `https://github.com/${repoPath}.git`,
        ssh_url: `git@github.com:${repoPath}.git`
      };
      
      setRepoData(fallbackData);
      setReadmeContent(`# ${fallbackData.name}\n\n无法加载仓库数据。请检查您的输入并重试。`);
      setLicenseContent('无法加载许可证。');
      setFileTree(baseMockFileTree);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 搜索历史维护
  const addToHistory = (entry: string) => {
    setHistory(prev => {
      const next = [entry, ...prev.filter(v => v !== entry)].slice(0, 8);
      try { localStorage.setItem('repo_history', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedRepo = parseGitHubInput(repoInput.trim());
    
    if (parsedRepo) {
      addToHistory(parsedRepo);
      fetchRepositoryData(parsedRepo);
    } else {
      setError('无效的GitHub仓库URL或路径。请使用"用户名/仓库名"格式或有效的GitHub URL。');
    }
  };
  
  // 切换标签页
  const tabs = [
    { id: 'overview', label: '概览' },
    { id: 'files', label: '文件' },
    { id: 'releases', label: '发行版' },
    { id: 'clone', label: '克隆' }
  ];
  
  // 令牌初始化加载
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gh_api_token');
      if (saved) setApiToken(saved);
    } catch {}
  }, []);
  
  const saveToken = () => {
    try {
      if (apiToken) {
        localStorage.setItem('gh_api_token', apiToken);
        toast.success('令牌已保存');
      } else {
        localStorage.removeItem('gh_api_token');
        toast.success('令牌已清除');
      }
    } catch {
      toast.error('保存令牌失败');
    }
  };
  const clearToken = () => {
    try {
      localStorage.removeItem('gh_api_token');
      setApiToken('');
      toast.success('令牌已清除');
    } catch {
      toast.error('清除令牌失败');
    }
  };
  
  const testToken = async () => {
    try {
      const res = await fetch(`${GITHUB_API_BASE_URL}/rate_limit`, { headers: getHeaders(apiToken) });
      if (res.ok) {
        const json = await res.json();
        const remaining = json.rate?.remaining ?? json.resources?.core?.remaining ?? '未知';
        toast.success(`令牌有效，剩余配额：${remaining}`);
      } else {
        toast.error(`令牌无效或权限不足：${res.status}`);
      }
    } catch {
      toast.error('令牌测试失败，请检查网络或令牌');
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* 头部 */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button
            type="button"
            onClick={resetToHome}
            className="flex items-center select-none cursor-pointer hover:opacity-90"
            aria-label="返回首页"
          >
            <Github className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-bold">GitHub 仓库浏览器</h1>
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800"
            aria-label="切换主题"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>
      
       {/* 主内容 */}
       <main className="flex-1 container mx-auto px-4 py-8">
         {/* 搜索表单 */}
        <div className="max-w-2xl mx-auto mb-8">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => { setRepoInput(e.target.value); setShowSuggestions(true); setHighlightIndex(-1); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (!showSuggestions || history.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightIndex(i => Math.min(i + 1, history.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightIndex(i => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && highlightIndex >= 0) {
                  e.preventDefault();
                  const pick = history[highlightIndex];
                  setRepoInput(pick);
                  setShowSuggestions(false);
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false);
                }
              }}
              placeholder="输入GitHub仓库（例如：用户名/仓库名）或URL"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
            />
            {repoInput && (
              <button
                type="button"
                aria-label="清空输入"
                onClick={() => setRepoInput('')}
                className="absolute right-24 top-2 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center"
            >
              <Search className="h-4 w-4 mr-2" />
              搜索
            </button>
            {showSuggestions && history.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-10 overflow-hidden">
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                  <History className="w-3.5 h-3.5 mr-1" /> 历史搜索
                </div>
                {history.map((h, idx) => (
                  <button
                    key={h}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setRepoInput(h); setShowSuggestions(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${idx===highlightIndex ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </form>
          
          {/* API Token输入区域 */}
          {showTokenInput && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center">
                  <Key className="h-4 w-4 mr-2" />
                  GitHub API 令牌
                </h4>
                <button
                  onClick={() => setShowTokenInput(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <span className="text-sm">隐藏</span>
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                添加令牌可以提高您的API速率限制。从GitHub <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">设置</a> 获取。
              </p>
              <div className="mt-2 flex items-center">
                <input
                  type={revealToken ? 'text' : 'password'}
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="输入您的GitHub API令牌"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setRevealToken(v => !v)}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm border-y border-r border-gray-300 dark:border-gray-700"
                  aria-label={revealToken ? '隐藏令牌' : '显示令牌'}
                >
                  {revealToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={saveToken}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-r-lg"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={testToken}
                  className="ml-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm"
                >
                  测试令牌
                </button>
                <button
                  type="button"
                  onClick={clearToken}
                  className="ml-2 px-3 py-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> 清除令牌
                </button>
              </div>
            </div>
          )}
          
          {/* 错误提示 */}
           {error && (
             <motion.div 
               className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 shadow-sm"
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.3 }}
             >
               <div className="flex items-start">
                 <div className="flex-shrink-0 mt-0.5">
                   <i className="fas fa-exclamation-circle text-red-500"></i>
                 </div>
                 <div className="ml-3 flex-1">
                   <h4 className="text-sm font-medium">加载失败</h4>
                   <div className="mt-1 text-sm">{error}</div>
                   <div className="mt-2 flex space-x-2">
                     <button 
                       onClick={() => {
                         // 清除错误并重试
                         setError(null);
                         if (repoInput.trim()) {
                           const parsedRepo = parseGitHubInput(repoInput.trim());
                           if (parsedRepo) {
                             fetchRepositoryData(parsedRepo);
                           }
                         }
                       }}
                       className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                     >
                       <i className="fas fa-redo-alt mr-1.5"></i>
                       重试
                     </button>
                     {error.includes('速率限制') && (
                       <button 
                         onClick={() => setShowTokenInput(true)}
                         className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-700 text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                       >
                         <i className="fas fa-key mr-1.5"></i>
                         添加API令牌
                       </button>
                     )}
                   </div>
                 </div>
               </div>
             </motion.div>
           )}
        </div>
        
         {/* 加载状态覆盖层 */}
          {isLoading && (
            <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-sm">
              <div className="relative">
                <motion.div 
                  className="h-16 w-16 rounded-full border-4 border-blue-100 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                />
                <motion.div 
                  className="absolute top-0 left-0 h-16 w-16 rounded-full border-4 border-transparent border-t-green-500"
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                />
              </div>
              <motion.p 
                className="mt-6 text-gray-800 dark:text-gray-200 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                正在加载仓库数据...
              </motion.p>
              <motion.div 
                className="mt-4 flex items-center space-x-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.4s' }}></span>
              </motion.div>
              
              {/* 加载超时提示 */}
              <motion.div 
                className="mt-4 text-center text-sm text-gray-700 dark:text-gray-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 5, duration: 0.5 }}
              >
                <p>加载时间较长？这可能是因为网络问题或API限制</p>
                <button 
                  onClick={() => {
                    // 重新提交当前搜索
                    if (repoInput.trim()) {
                      const parsedRepo = parseGitHubInput(repoInput.trim());
                      if (parsedRepo) {
                        fetchRepositoryData(parsedRepo);
                      }
                    }
                  }}
                  className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  点击重新尝试
                </button>
              </motion.div>
            </div>
          )}
        
        {/* 仓库信息展示 */}
        {repoData && !isLoading && (
          <div className="max-w-4xl mx-auto">
            {/* 仓库标题和元数据 */}
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-2xl font-bold flex items-center">
                {repoData.owner}/{repoData.name}
                <a 
                  href={`https://github.com/${repoData.full_name}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">{repoData.description}</p>
              
              {/* 仓库统计信息 */}
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Star className="h-4 w-4 mr-1 text-yellow-500" />
                  <span>{repoData.stars.toLocaleString()}</span>
                </div>
                 <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <GitBranch className="h-4 w-4 mr-1" />
                  <span>{repoData.forks.toLocaleString()}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Users className="h-4 w-4 mr-1" />
                  <span>{repoData.contributors.toLocaleString()} 位贡献者</span>
                </div>
              </div>
            </div>
            
            {/* 标签导航 */}
            <div className="flex mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                    activeTab === tab.id 
                      ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* 内容区域 */}
            <div className="space-y-6">
              {/* 概览标签内容 */}
              {activeTab === 'overview' && (
                <>
                  {/* README 部分 */}
                  <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center mb-2 md:mb-0">
                        <Book className="h-5 w-5 mr-2" />
                        项目说明
                      </h3>
                      {/* 多语言README选择器 */}
                      {availableReadmes.length > 1 && (
                        <div className="flex items-center">
                          <GlobeIcon className="h-4 w-4 mr-2 text-gray-500" />
                          <select
                            value={selectedReadme}
                            onChange={(e) => {
                              const newReadmePath = e.target.value;
                              setSelectedReadme(newReadmePath);
                              if (repoData) {
                                fetchReadmeContent(repoData.owner, repoData.name, newReadmePath)
                                  .then(content => setReadmeContent(content));
                              }
                            }}
                            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {availableReadmes.map(readme => (
                              <option key={readme.path} value={readme.path}>
                                {readme.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <MarkdownRenderer content={readmeContent} />
                  </div>
                  
                  {/* 关于信息部分 */}
                  <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800">
                    <h3 className="text-xl font-bold mb-4 flex items-center">
                      <FileCheck className="h-5 w-5 mr-2" />
                      关于项目
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">拥有者</p>
                        <p className="font-medium">{repoData.owner}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">创建时间</p>
                        <p>{new Date(repoData.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">最后更新</p>
                        <p>{new Date(repoData.updated_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">许可证</p>
                        <p>{repoData.license.name}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 示例网站部分 */}
                  {repoData.homepage && (
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800">
                      <h3 className="text-xl font-bold mb-4 flex items-center">
                        <Globe className="h-5 w-5 mr-2" />
                        项目网站
                      </h3>
                      <a 
                        href={repoData.homepage} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                      >
                        {repoData.homepage}
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </a>
                    </div>
                  )}
                  
                  {/* 许可证部分 */}
                  <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800">
                    <h3 className="text-xl font-bold mb-4 flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      许可证内容
                    </h3>
                    <div className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-300 font-mono overflow-x-auto">
                      {licenseContent}
                    </div>
                  </div>
                </>
              )}
              
              {/* 文件标签内容 */}
              {activeTab === 'files' && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800">
                   <h3 className="text-xl font-bold mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    仓库文件
                  </h3>
                   <FileTree files={fileTree} owner={repoData.owner} repo={repoData.name} apiToken={apiToken} />
                </div>
              )}

              {/* 发行版标签内容 */}
              {activeTab === 'releases' && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <Tag className="h-5 w-5 mr-2" />
                    发行版
                  </h3>
                  <ReleasesPanel owner={repoData.owner} repo={repoData.name} apiToken={apiToken} onClose={() => setActiveTab('files')} />
                </div>
              )}
              
              {/* 克隆标签内容 */}
              {activeTab === 'clone' && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <Code className="h-5 w-5 mr-2" />
                    克隆仓库
                  </h3>
                  <CloneCodeSection repoData={repoData} />
                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    <p>使用上面的命令将此仓库克隆到您的本地机器。</p>
                    <p className="mt-2">克隆后，请查看项目根目录下的 <code>good/</code>（含 <code>css/</code> 与 <code>js/</code>），核心功能文件位于 <code>good/js/core.js</code>。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
         {/* 初始状态提示 */}
         {!repoData && !isLoading && !error && (
           <div className="flex flex-col items-center justify-center py-16 text-center">
             <Github className="h-16 w-16 text-gray-300 dark:text-gray-700 mb-4" />
             <h2 className="text-xl font-bold mb-2">GitHub 仓库浏览器</h2>
             <p className="text-gray-600 dark:text-gray-400 max-w-md mb-4">
               输入GitHub仓库名称或URL，查看该仓库的详细信息。
             </p>
             <div className="flex flex-wrap gap-2 justify-center">
               <button 
                 onClick={() => setRepoInput('facebook/react')}
                 className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-700"
               >
                 尝试: facebook/react
               </button>
               <button 
                 onClick={() => setRepoInput('vuejs/vue')}
                 className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-700"
               >
                 尝试: vuejs/vue
               </button>
               <button 
                 onClick={() => setRepoInput('angular/angular')}
                 className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-700"
               >
                 尝试: angular/angular
               </button>
               <button 
                 onClick={() => setShowTokenInput(true)}
                 className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md text-sm hover:bg-blue-200 dark:hover:bg-blue-800/40"
               >
                 添加API令牌
               </button>
             </div>
           </div>
         )}
      </main>
      
        {/* 页脚 */}
        <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-6 w-full">
          <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400 text-sm">
            <p>GitHub 仓库浏览器 - 一个查看GitHub仓库详细信息的工具</p>
            <p className="mt-1">© 2025 Richy Hu</p>
          </div>
        </footer>
     </div>
  );
}

// 发行版面板组件
export function ReleasesPanel({ owner, repo, apiToken, onClose }: { owner: string; repo: string; apiToken: string; onClose?: () => void }) {
  const { status, error, releases, refresh } = useReleases(owner, repo, apiToken);
  return (
    <div className="mt-6 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center">
          <Tag className="h-4 w-4 mr-2 text-gray-600 dark:text-gray-300" />
          <span className="font-medium">发行版</span>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900">
        {status === 'loading' && (
          <div className="p-6 text-sm text-gray-700 dark:text-gray-300">正在加载发行版...</div>
        )}
        {status === 'error' && (
          <div className="p-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start">
                <Info className="h-4 w-4 mt-0.5 mr-2" />
                <div>
                  <div className="text-sm font-medium">获取发行版失败</div>
                  <div className="text-sm mt-1">{error}</div>
                  <button
                    className="mt-2 px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white"
                    onClick={refresh}
                  >
                    重试
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {status === 'success' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {releases.length === 0 ? (
              <div className="p-6 text-sm text-gray-600 dark:text-gray-400">暂无发行版。</div>
            ) : (
              releases.map((r) => (
                <div key={r.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold">{r.name || r.tag_name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">版本：{r.tag_name} · 发布：{new Date(r.published_at).toLocaleString()}</div>
                      {(r.draft || r.prerelease) && (
                        <div className="mt-1 text-xs inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                          {r.draft ? '草稿' : '预发布'}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 md:mt-0 flex flex-wrap gap-2">
                      <a
                        href={buildSourceArchiveUrl(owner, repo, r.tag_name, 'zip')}
                        className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Download className="h-4 w-4 mr-1" /> 源码 ZIP
                      </a>
                      <a
                        href={buildSourceArchiveUrl(owner, repo, r.tag_name, 'tar.gz')}
                        className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        <Download className="h-4 w-4 mr-1" /> 源码 TAR.GZ
                      </a>
                    </div>
                  </div>
                  {r.body ? (
                    <div className="mt-3">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownRenderer content={r.body} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-500">无更新说明</div>
                  )}
                  {r.assets && r.assets.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">已编译的二进制/附件</div>
                      <div className="flex flex-wrap gap-2">
                        {r.assets.map((a) => (
                          <a
                            key={a.browser_download_url}
                            href={a.browser_download_url}
                            className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                          >
                            <Download className="h-4 w-4 mr-1" /> {a.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}