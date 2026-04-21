/**
 * Mobile connect: WeChat QR + 一码登录（desktop auth）QR.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShellUiStore } from '@/stores/shell-ui';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import { buildQrChannelEventName } from '@/lib/channel-alias';
import { normalizeQrImageSource } from '@/lib/qr-image';
import { CHANNEL_NAMES } from '@/types/channel';
import { useChannelsStore } from '@/stores/channels';
import { toast } from 'sonner';

type ConnectChannel = 'wechat' | 'maxin';
type DesktopAuthStatus =
  | 'pending'
  | 'opened'
  | 'authorized'
  | 'cancelled'
  | 'confirmed'
  | 'expired'
  | 'consumed'
  | 'error';

type DesktopAuthStartResponse = {
  success?: boolean;
  ticket?: string;
  qrcodeUrl?: string;
  expiresIn?: number;
  error?: string;
};

type DesktopAuthPollResponse = {
  success?: boolean;
  status?: DesktopAuthStatus;
  token?: string;
  userId?: string | number;
  message?: string;
  error?: string;
};

type DesktopAuthVerifySessionResponse = {
  success?: boolean;
  loggedIn?: boolean;
  userId?: string | number;
  nickName?: string;
  avatarUrl?: string;
  error?: string;
};

type DesktopAuthLogoutResponse = {
  success?: boolean;
  loggedIn?: boolean;
  error?: string;
};

type DesktopAuthCancelTicketResponse = {
  success?: boolean;
  error?: string;
};

/** 一码登录：二维码上所有状态提示共用同一遮罩（满铺码区，文案单独留内边距） */
const MAXIN_QR_OVERLAY_CLASS =
  'absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md text-center bg-white/70 dark:bg-zinc-950/70 backdrop-blur-[2px]';

function normalizeDesktopAuthErrorMessage(raw: unknown, t: (k: string, o?: Record<string, unknown>) => string): string {
  const message = String(raw instanceof Error ? raw.message : raw);
  if (
    message.includes('CLAWX_DESKTOP_AUTH_APP_ID')
    || message.includes('missing appid')
    || message.includes('缺少appid')
  ) {
    return t('maxinConnect.notConfiguredHint', {
      defaultValue: '当前版本暂未配置一码登录，请联系管理员或使用其他登录方式。',
    });
  }
  return message;
}

function normalizePollStatus(raw: unknown): DesktopAuthStatus {
  if (typeof raw !== 'string' || !raw.trim()) return 'pending';
  const s = raw.trim().toLowerCase();
  switch (s) {
    case 'pending':
    case 'opened':
    case 'authorized':
    case 'cancelled':
    case 'confirmed':
    case 'expired':
    case 'consumed':
    case 'error':
      return s;
    default:
      return 'pending';
  }
}

export function WeChatConnectModal() {
  const { t } = useTranslation('settings');
  const { t: tChannels } = useTranslation('channels');
  const open = useShellUiStore((s) => s.wechatConnectModalOpen);
  const closeWechatConnectModal = useShellUiStore((s) => s.closeWechatConnectModal);
  const [channel, setChannel] = useState<ConnectChannel>('wechat');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [maxinReloadKey, setMaxinReloadKey] = useState(0);
  const maxinStatusRef = useRef<DesktopAuthStatus | null>(null);
  const [maxinStatusHint, setMaxinStatusHint] = useState<DesktopAuthStatus | null>(null);
  const [maxinErrorHint, setMaxinErrorHint] = useState<string | null>(null);
  const [maxinLoggedIn, setMaxinLoggedIn] = useState(false);
  const [maxinDisplayName, setMaxinDisplayName] = useState('');
  const [maxinAvatarUrl, setMaxinAvatarUrl] = useState('');
  const [maxinLoggingOut, setMaxinLoggingOut] = useState(false);
  const maxinTicketRef = useRef<string | null>(null);
  const closeRef = useRef(closeWechatConnectModal);
  closeRef.current = closeWechatConnectModal;
  const tChannelsRef = useRef(tChannels);
  tChannelsRef.current = tChannels;
  const tSettingsRef = useRef(t);
  tSettingsRef.current = t;

  useEffect(() => {
    if (open) {
      setChannel('wechat');
    }
  }, [open]);

  useEffect(() => {
    if (!open || channel !== 'wechat') {
      return;
    }

    setQrCode(null);
    setConnecting(true);

    const onQr = (payload: unknown) => {
      const data = payload as { qr?: string; raw?: string };
      const next = normalizeQrImageSource(data);
      if (!next) return;
      setQrCode(next);
      setConnecting(false);
    };

    const onSuccess = async () => {
      toast.success(
        tChannelsRef.current('toast.qrConnected', { name: CHANNEL_NAMES.wechat }),
      );
      try {
        await useChannelsStore.getState().fetchChannels();
      } catch {
        /* ignore */
      }
      closeRef.current();
    };

    const onError = (payload: unknown) => {
      const err =
        typeof payload === 'string'
          ? payload
          : String((payload as { message?: string } | undefined)?.message || payload);
      toast.error(
        tChannelsRef.current('toast.qrFailed', { name: CHANNEL_NAMES.wechat, error: err }),
      );
      setQrCode(null);
      setConnecting(false);
    };

    const unsubQr = subscribeHostEvent(buildQrChannelEventName('wechat', 'qr'), onQr);
    const unsubOk = subscribeHostEvent(buildQrChannelEventName('wechat', 'success'), onSuccess);
    const unsubErr = subscribeHostEvent(buildQrChannelEventName('wechat', 'error'), onError);

    void hostApiFetch<{ success?: boolean; error?: string }>('/api/channels/wechat/start', {
      method: 'POST',
      body: JSON.stringify({}),
    }).catch((e: Error) => {
      toast.error(String(e?.message ?? e));
      setConnecting(false);
    });

    return () => {
      unsubQr();
      unsubOk();
      unsubErr();
      void hostApiFetch('/api/channels/wechat/cancel', {
        method: 'POST',
        body: JSON.stringify({}),
      }).catch(() => {});
    };
  }, [open, channel]);

  useEffect(() => {
    if (!open || channel !== 'maxin') {
      return;
    }

    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let localExpireTimer: ReturnType<typeof setTimeout> | null = null;
    let polling = false;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const clearLocalExpireTimer = () => {
      if (localExpireTimer) {
        clearTimeout(localExpireTimer);
        localExpireTimer = null;
      }
    };

    const handlePoll = async (ticket: string) => {
      if (polling || disposed) return;
      polling = true;
      try {
        const result = await hostApiFetch<DesktopAuthPollResponse>('/api/desktop-auth/poll', {
          method: 'POST',
          body: JSON.stringify({ ticket }),
        });
        if (disposed) return;

        const status = normalizePollStatus(result.status);
        const prevStatus = maxinStatusRef.current;
        maxinStatusRef.current = status;
        setMaxinStatusHint(status);
        if (status !== 'error') {
          setMaxinErrorHint(null);
        }

        const tr = tSettingsRef.current;
        if (status === 'opened' && prevStatus !== 'opened') {
          toast.info(tr('maxinConnect.openedHint'));
        }
        if (status === 'authorized' && prevStatus !== 'authorized') {
          toast.info(tr('maxinConnect.authorizedHint'));
        }
        if (status === 'cancelled' && prevStatus !== 'cancelled') {
          toast.info(
            tr('maxinConnect.cancelledHint', { defaultValue: '用户已取消授权，请刷新二维码重试' }),
          );
        }
        if (status === 'confirmed') {
          if (!result.token) {
            stopPolling();
            clearLocalExpireTimer();
            setConnecting(false);
            toast.error(tr('maxinConnect.errorHint'));
            return;
          }
          const verifyResult = await hostApiFetch<DesktopAuthVerifySessionResponse>(
            '/api/desktop-auth/session/verify',
            {
              method: 'POST',
              body: JSON.stringify({ token: result.token }),
            },
          );
          if (!verifyResult.success || !verifyResult.loggedIn) {
            stopPolling();
            clearLocalExpireTimer();
            setConnecting(false);
            toast.error(verifyResult.error || tr('maxinConnect.errorHint'));
            return;
          }
          toast.success(tr('maxinConnect.confirmedHint'));
          maxinTicketRef.current = null;
          stopPolling();
          clearLocalExpireTimer();
          closeRef.current();
          return;
        }
        if (status === 'cancelled' || status === 'expired' || status === 'consumed' || status === 'error') {
          maxinTicketRef.current = null;
          stopPolling();
          clearLocalExpireTimer();
          setConnecting(false);
          if (status === 'cancelled') {
            // keep QR visible; user can refresh to re-initiate login
          } else if (status === 'expired') {
            toast.error(tr('maxinConnect.expiredHint'));
          } else if (status === 'consumed') {
            toast.info(tr('maxinConnect.consumedHint'));
          } else {
            setMaxinErrorHint(result.message || tr('maxinConnect.errorHint'));
            toast.error(result.message || tr('maxinConnect.errorHint'));
          }
        }
      } catch (error) {
        if (!disposed) {
          const normalized = normalizeDesktopAuthErrorMessage(error, tSettingsRef.current);
          setConnecting(false);
          stopPolling();
          clearLocalExpireTimer();
          setMaxinStatusHint('error');
          setMaxinErrorHint(normalized);
          toast.error(normalized);
        }
      } finally {
        polling = false;
      }
    };

    const startDesktopAuth = async () => {
      setQrCode(null);
      setConnecting(true);
      maxinStatusRef.current = null;
      setMaxinStatusHint(null);
      setMaxinErrorHint(null);
      clearLocalExpireTimer();
      maxinTicketRef.current = null;
      setMaxinLoggedIn(false);
      setMaxinDisplayName('');
      setMaxinAvatarUrl('');
      try {
        const session = await hostApiFetch<DesktopAuthVerifySessionResponse>(
          '/api/desktop-auth/session/verify',
          {
            method: 'POST',
            body: JSON.stringify({}),
          },
        );
        if (disposed) return;
        if (session.success && session.loggedIn) {
          setMaxinLoggedIn(true);
          setMaxinDisplayName((session.nickName || '').trim());
          setMaxinAvatarUrl((session.avatarUrl || '').trim());
          setConnecting(false);
          setRefreshing(false);
          return;
        }
        const created = await hostApiFetch<DesktopAuthStartResponse>('/api/desktop-auth/create-ticket', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        if (disposed) return;
        if (!created.ticket || !created.qrcodeUrl) {
          throw new Error(created.error || tSettingsRef.current('maxinConnect.errorHint'));
        }
        maxinTicketRef.current = created.ticket;

        setQrCode(created.qrcodeUrl);
        setConnecting(false);
        setRefreshing(false);

        const expiresMs = Math.max(1, Number(created.expiresIn ?? 300)) * 1000;
        clearLocalExpireTimer();
        localExpireTimer = setTimeout(() => {
          if (disposed) return;
          maxinStatusRef.current = 'expired';
          maxinTicketRef.current = null;
          stopPolling();
          setConnecting(false);
          setMaxinErrorHint(null);
          setMaxinStatusHint('expired');
        }, expiresMs);

        void handlePoll(created.ticket);
        pollTimer = setInterval(() => {
          void handlePoll(created.ticket!);
        }, 2000);
      } catch (error) {
        if (!disposed) {
          const message = normalizeDesktopAuthErrorMessage(error, tSettingsRef.current);
          setMaxinStatusHint('error');
          setMaxinErrorHint(message);
          setConnecting(false);
          setRefreshing(false);
          clearLocalExpireTimer();
          toast.error(message);
        }
      }
    };

    void startDesktopAuth();

    return () => {
      disposed = true;
      stopPolling();
      clearLocalExpireTimer();
      const pendingTicket = maxinTicketRef.current;
      maxinTicketRef.current = null;
      if (pendingTicket) {
        void hostApiFetch<DesktopAuthCancelTicketResponse>('/api/desktop-auth/session/cancel-ticket', {
          method: 'POST',
          body: JSON.stringify({ ticket: pendingTicket }),
        }).catch(() => {});
      }
    };
  }, [open, channel, maxinReloadKey]);

  const handleRefreshWechat = useCallback(async () => {
    if (channel !== 'wechat') return;
    setRefreshing(true);
    setQrCode(null);
    setConnecting(true);
    try {
      await hostApiFetch('/api/channels/wechat/cancel', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await hostApiFetch('/api/channels/wechat/start', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (e: unknown) {
      toast.error(String(e instanceof Error ? e.message : e));
      setConnecting(false);
    } finally {
      setRefreshing(false);
    }
  }, [channel]);

  const handleRefreshMaxin = useCallback(async () => {
    if (channel !== 'maxin') return;
    if (maxinLoggedIn) return;
    setRefreshing(true);
    setConnecting(true);
    setQrCode(null);
    setMaxinStatusHint(null);
    setMaxinErrorHint(null);
    setMaxinReloadKey((k) => k + 1);
  }, [channel, maxinLoggedIn]);

  const handleLogoutMaxin = useCallback(async () => {
    if (channel !== 'maxin') return;
    setMaxinLoggingOut(true);
    try {
      const result = await hostApiFetch<DesktopAuthLogoutResponse>('/api/desktop-auth/session/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!result.success) {
        throw new Error(result.error || t('profile.logoutFailed'));
      }
      setMaxinLoggedIn(false);
      setMaxinDisplayName('');
      setMaxinAvatarUrl('');
      setMaxinReloadKey((k) => k + 1);
      toast.success(t('profile.logoutSuccess'));
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error));
    } finally {
      setMaxinLoggingOut(false);
    }
  }, [channel, t]);

  const title = channel === 'wechat' ? t('wechatConnect.title') : t('maxinConnect.title');
  const subtitle = channel === 'wechat' ? t('wechatConnect.subtitle') : t('maxinConnect.subtitle');
  const footer = channel === 'wechat' ? t('wechatConnect.footer') : t('maxinConnect.footer');
  const maxinStatusText =
    maxinStatusHint === 'cancelled'
      ? t('maxinConnect.cancelledHint', {
          defaultValue: '用户已取消授权，请刷新二维码重试',
        })
      : maxinStatusHint === 'expired'
        ? t('maxinConnect.expiredHint')
        : maxinStatusHint === 'consumed'
          ? t('maxinConnect.consumedHint')
          : maxinStatusHint === 'error'
            ? maxinErrorHint || t('maxinConnect.errorHint')
            : null;
  const maxinProgressOverlayText =
    maxinStatusHint === 'opened'
      ? t('maxinConnect.openedQrHint')
      : maxinStatusHint === 'authorized'
        ? t('maxinConnect.authorizedQrHint')
        : null;
  const maxinOverlayTerminal = Boolean(maxinStatusText);
  const shouldShowMaxinOverlay = Boolean(
    !maxinLoggedIn
      && qrCode
      && (maxinOverlayTerminal || maxinProgressOverlayText || connecting || refreshing),
  );
  const canRefreshMaxinFromOverlay = Boolean(
    maxinOverlayTerminal && !connecting && !refreshing,
  );
  const maxinOverlayPrimaryText = maxinOverlayTerminal
    ? maxinStatusHint === 'expired'
      ? t('maxinConnect.qrExpiredTitle', { defaultValue: '二维码已过期' })
      : maxinStatusText
    : maxinProgressOverlayText;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) closeWechatConnectModal();
      }}
    >
      <DialogContent
        data-testid="wechat-connect-modal"
        className={cn(
          'w-[min(100vw-2rem,28rem)] max-w-md gap-0 overflow-hidden rounded-2xl border-0 bg-card p-0',
          'shadow-[0_25px_50px_-12px_rgb(0_0_0/0.18)] dark:shadow-black/40',
        )}
      >
        <button
          type="button"
          className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          onClick={() => closeWechatConnectModal()}
          aria-label={t('modal.close')}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="px-5 pb-3 pt-3 text-center sm:px-6">
          <div className="mx-auto mb-2.5 flex max-w-[272px] rounded-full bg-muted/45 p-0.5 dark:bg-muted/25">
            <button
              type="button"
              data-testid="mobile-connect-tab-wechat"
              onClick={() => setChannel('wechat')}
              className={cn(
                'flex-1 rounded-full px-3 py-2 text-[13px] font-medium transition-all duration-200',
                channel === 'wechat'
                  ? 'bg-card text-foreground shadow-sm dark:bg-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('wechatConnect.tabWechat')}
            </button>
            <button
              type="button"
              data-testid="mobile-connect-tab-maxin"
              onClick={() => setChannel('maxin')}
              className={cn(
                'flex-1 rounded-full px-3 py-2 text-[13px] font-medium transition-all duration-200',
                channel === 'maxin'
                  ? 'bg-card text-foreground shadow-sm dark:bg-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('wechatConnect.tabMaxin')}
            </button>
          </div>

          <DialogTitle className="text-balance text-lg font-semibold tracking-tight text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="mx-auto mt-1 max-w-[19rem] text-pretty text-[13px] leading-snug text-muted-foreground">
            {subtitle}
          </DialogDescription>

          {channel === 'wechat' ? (
            <div className="mx-auto mt-2.5 w-full max-w-[280px] rounded-xl bg-muted/40 p-1 dark:bg-muted/20">
              <div className="flex flex-col items-center rounded-lg bg-white px-1 pb-1.5 pt-0.5 dark:bg-zinc-950">
                {connecting && !qrCode ? (
                  <div className="flex flex-col items-center gap-1.5 py-5 text-muted-foreground">
                    <Loader2 className="h-7 w-7 animate-spin text-primary/80" />
                    <span className="text-[11px]">{tChannels('dialog.generatingQR')}</span>
                  </div>
                ) : qrCode ? (
                  <>
                    {qrCode.startsWith('data:image') ||
                    qrCode.startsWith('http://') ||
                    qrCode.startsWith('https://') ? (
                      <img
                        src={qrCode}
                        alt=""
                        className="w-full rounded-md object-contain"
                      />
                    ) : null}
                    <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1">
                      <p className="text-center text-[11px] leading-tight text-muted-foreground">
                        {tChannels('dialog.scanQR', { name: CHANNEL_NAMES.wechat })}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 shrink-0 rounded-full px-2.5 text-[11px] font-medium"
                        disabled={refreshing || connecting}
                        onClick={() => void handleRefreshWechat()}
                      >
                        <RefreshCw
                          className={cn('mr-1 h-3 w-3', refreshing && 'animate-spin')}
                        />
                        {tChannels('dialog.refreshCode')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-xs text-muted-foreground">
                    {tChannels('dialog.generatingQR')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto mt-2.5 w-full max-w-[280px] rounded-xl bg-muted/40 py-1 dark:bg-muted/20">
              <div className="flex flex-col items-center overflow-hidden rounded-lg bg-white pb-1.5 pt-0.5 dark:bg-zinc-950">
                {connecting && !qrCode ? (
                  <div className="flex w-full flex-col items-center gap-1.5 px-3 py-5 text-muted-foreground">
                    <Loader2 className="h-7 w-7 animate-spin text-primary/80" />
                    <span className="text-[11px]">{tChannels('dialog.generatingQR')}</span>
                  </div>
                ) : maxinLoggedIn ? (
                  <div className="flex w-full flex-col items-center gap-3 px-3 py-4">
                    {maxinAvatarUrl ? (
                      <img
                        src={maxinAvatarUrl}
                        alt=""
                        className="h-16 w-16 rounded-full border border-black/10 object-cover dark:border-white/10"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/60 text-sm text-muted-foreground">
                        {(maxinDisplayName || '?').slice(0, 1)}
                      </div>
                    )}
                    <p className="max-w-full truncate text-sm font-medium text-foreground">
                      {maxinDisplayName || t('profile.notLoggedIn')}
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      {t('maxinConnect.loggedInHint')}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full px-3 text-[11px] font-medium"
                      disabled={maxinLoggingOut}
                      onClick={() => void handleLogoutMaxin()}
                    >
                      {maxinLoggingOut ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : null}
                      {t('profile.logout')}
                    </Button>
                  </div>
                ) : qrCode ? (
                  <>
                    <div className="relative w-full aspect-square max-h-[280px] mx-auto">
                      {qrCode.startsWith('data:image') ||
                      qrCode.startsWith('http://') ||
                      qrCode.startsWith('https://') ? (
                        <img
                          src={qrCode}
                          alt=""
                          className={cn(
                            'h-full w-full rounded-md object-contain',
                            shouldShowMaxinOverlay && 'opacity-[0.2] saturate-50',
                          )}
                        />
                      ) : null}
                      {shouldShowMaxinOverlay ? (
                        <div className={MAXIN_QR_OVERLAY_CLASS}>
                          {maxinOverlayPrimaryText ? (
                            <p className="w-full max-w-full shrink-0 px-5 text-pretty text-[15px] font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
                              {maxinOverlayPrimaryText}
                            </p>
                          ) : null}
                          {connecting || refreshing ? (
                            <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary/80" />
                          ) : null}
                          {canRefreshMaxinFromOverlay ? (
                            <button
                              type="button"
                              className="shrink-0 px-5 text-[14px] font-medium text-primary underline-offset-4 transition-opacity hover:underline disabled:pointer-events-none disabled:opacity-50"
                              disabled={refreshing || connecting}
                              onClick={() => void handleRefreshMaxin()}
                            >
                              {t('maxinConnect.tapToRefresh', { defaultValue: '点击刷新' })}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3">
                      <p className="text-center text-[11px] leading-tight text-muted-foreground">
                        {t('maxinConnect.scanHint')}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="px-3 py-4 text-xs text-muted-foreground">
                    {tChannels('dialog.generatingQR')}
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className={cn(
              'mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/[0.1] px-2.5 py-1.5 text-left text-amber-950',
              'dark:bg-amber-500/[0.12] dark:text-amber-50',
            )}
          >
            <ShieldAlert className="mt-px h-3 w-3 shrink-0 text-amber-700 dark:text-amber-400" />
            <span className="text-[10px] leading-snug text-amber-950/90 dark:text-amber-100/95">
              {footer}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
