import { describe, expect, it } from 'vitest';
import {
  countUnreadSessionsUnderAgent,
  getAgentIdFromSessionKey,
  isSessionUnread,
} from '@/stores/sidebar-unread';

describe('sidebar-unread helpers', () => {
  it('getAgentIdFromSessionKey', () => {
    expect(getAgentIdFromSessionKey('agent:foo:session-1')).toBe('foo');
    expect(getAgentIdFromSessionKey('main:main')).toBe('main');
  });

  it('isSessionUnread respects per-session watermark and active view', () => {
    const sessionLastActivity = { 'agent:a:s1': 200, 'agent:a:s2': 300 };
    const wm = { 'agent:a:s1': 100, 'agent:a:s2': 200 };
    expect(isSessionUnread('agent:a:s1', sessionLastActivity, wm, 'agent:a:s1', true)).toBe(false);
    expect(isSessionUnread('agent:a:s2', sessionLastActivity, wm, 'agent:a:s1', true)).toBe(true);
    expect(isSessionUnread('agent:a:s2', sessionLastActivity, wm, 'agent:a:s1', false)).toBe(true);
  });

  it('countUnreadSessionsUnderAgent excludes current session on chat', () => {
    const sessions = [{ key: 'agent:a:s1' }, { key: 'agent:a:s2' }];
    const sessionLastActivity = {
      'agent:a:s1': 200,
      'agent:a:s2': 300,
    };
    const wm = { 'agent:a:s1': 100, 'agent:a:s2': 100 };
    expect(
      countUnreadSessionsUnderAgent('a', sessions, sessionLastActivity, wm, 'agent:a:s1', true),
    ).toBe(1);
    expect(
      countUnreadSessionsUnderAgent('a', sessions, sessionLastActivity, wm, 'agent:a:s1', false),
    ).toBe(2);
  });

  it('countUnreadSessionsUnderAgent respects per-session watermark', () => {
    const sessions = [{ key: 'agent:a:s1' }];
    const sessionLastActivity = { 'agent:a:s1': 50 };
    expect(countUnreadSessionsUnderAgent('a', sessions, sessionLastActivity, { 'agent:a:s1': 50 }, '', false)).toBe(0);
    expect(countUnreadSessionsUnderAgent('a', sessions, sessionLastActivity, { 'agent:a:s1': 49 }, '', false)).toBe(1);
  });
});
