import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../route-utils';
import { proxyAwareFetch } from '../../utils/proxy-fetch';
import { resolveDesktopAuthAppId, resolveDesktopAuthBaseUrl } from '../../utils/desktop-auth-config';

type ApiResponse<T> = {
  code: number;
  msg?: string;
  data?: T;
};

type CategoryItem = {
  category_id: number;
  name: string;
};

type ArticleItem = {
  article_id: number;
  article_title?: string;
  dec?: string;
  create_time?: string;
  image?: { file_path?: string };
  category?: { name?: string };
};

type ArticleListData = {
  list?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
    data?: ArticleItem[];
  };
};

async function callBackend<T>(path: string, query: Record<string, string>): Promise<ApiResponse<T>> {
  const base = resolveDesktopAuthBaseUrl();
  const qs = new URLSearchParams(query).toString();
  const url = `${base}/api/${path}${qs ? `?${qs}` : ''}`;
  const resp = await proxyAwareFetch(url, { method: 'GET' });
  const text = await resp.text();
  let parsed: ApiResponse<T>;
  try {
    parsed = JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new Error(`Growth API ${path} returned non-JSON: ${text}`);
  }
  if (!resp.ok) throw new Error(parsed.msg || `Growth API ${path} failed: HTTP ${resp.status}`);
  return parsed;
}

export async function handleGrowthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  if (url.pathname === '/api/growth/categories' && req.method === 'GET') {
    try {
      const appId = resolveDesktopAuthAppId();
      const result = await callBackend<{ category?: CategoryItem[] }>('plus.article.article/category', { app_id: appId });
      if (result.code !== 1) {
        sendJson(res, 502, { success: false, error: result.msg || 'Failed to load categories' });
        return true;
      }
      sendJson(res, 200, { success: true, categories: result.data?.category || [] });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error), categories: [] });
    }
    return true;
  }

  if (url.pathname === '/api/growth/articles' && req.method === 'GET') {
    try {
      const appId = resolveDesktopAuthAppId();
      const categoryId = (url.searchParams.get('categoryId') || '0').trim() || '0';
      const page = (url.searchParams.get('page') || '1').trim() || '1';
      const listRows = (url.searchParams.get('listRows') || '20').trim() || '20';
      const result = await callBackend<ArticleListData>('plus.article.article/index', {
        app_id: appId,
        category_id: categoryId,
        page,
        list_rows: listRows,
      });
      if (result.code !== 1) {
        sendJson(res, 502, { success: false, error: result.msg || 'Failed to load articles' });
        return true;
      }
      sendJson(res, 200, {
        success: true,
        list: result.data?.list || { current_page: 1, last_page: 1, per_page: Number(listRows), total: 0, data: [] },
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/growth/article-detail' && req.method === 'GET') {
    try {
      const appId = resolveDesktopAuthAppId();
      const articleId = (url.searchParams.get('articleId') || '').trim();
      if (!articleId) {
        sendJson(res, 400, { success: false, error: 'articleId is required' });
        return true;
      }
      const result = await callBackend<{ detail?: unknown }>('plus.article.article/detail', {
        app_id: appId,
        article_id: articleId,
      });
      if (result.code !== 1) {
        sendJson(res, 502, { success: false, error: result.msg || 'Failed to load article detail' });
        return true;
      }
      sendJson(res, 200, { success: true, detail: result.data?.detail || null });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error), detail: null });
    }
    return true;
  }

  return false;
}
