/**
 * Chat Message Component
 * Renders user / assistant / system / toolresult messages
 * with markdown, thinking sections, images, and tool cards.
 */
import { useState, useCallback, useEffect, memo } from 'react';
import { Sparkles, AlarmClock, Copy, Check, ChevronDown, ChevronRight, Wrench, FileText, Film, Music, FileArchive, File, X, FolderOpen, ZoomIn, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { invokeIpc } from '@/lib/api-client';
import type { RawMessage, AttachedFileMeta } from '@/stores/chat';
import { extractText, extractThinking, extractImages, extractToolUse, formatTimestamp } from './message-utils';
import { useTranslation } from 'react-i18next';

interface ChatMessageProps {
  message: RawMessage;
  showThinking: boolean;
  /** When true, non-user avatars use the scheduled-task style (cron session). */
  cronSession?: boolean;
  /** Hide avatar when this message is grouped with previous assistant/system row. */
  hideAvatar?: boolean;
  isStreaming?: boolean;
  streamingTools?: Array<{
    id?: string;
    toolCallId?: string;
    name: string;
    status: 'running' | 'completed' | 'error';
    durationMs?: number;
    summary?: string;
  }>;
}

interface ExtractedImage { url?: string; data?: string; mimeType: string; }

/** Resolve an ExtractedImage to a displayable src string, or null if not possible. */
function imageSrc(img: ExtractedImage): string | null {
  if (img.url) return img.url;
  if (img.data) return `data:${img.mimeType};base64,${img.data}`;
  return null;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  showThinking,
  cronSession = false,
  hideAvatar = false,
  isStreaming = false,
  streamingTools = [],
}: ChatMessageProps) {
  const { t } = useTranslation('chat');
  const isUser = message.role === 'user';
  const role = typeof message.role === 'string' ? message.role.toLowerCase() : '';
  const isToolResult = role === 'toolresult' || role === 'tool_result';
  const text = extractText(message);
  const hasText = text.trim().length > 0;
  const thinking = extractThinking(message);
  const images = extractImages(message);
  const tools = extractToolUse(message);
  const visibleThinking = showThinking ? thinking : null;
  const visibleTools = tools;

  const attachedFiles = message._attachedFiles || [];
  const [lightboxImg, setLightboxImg] = useState<{ src: string; fileName: string; filePath?: string; base64?: string; mimeType?: string } | null>(null);

  // Never render tool result messages in chat UI
  if (isToolResult) return null;

  const hasStreamingToolStatus = isStreaming && streamingTools.length > 0;
  if (!hasText && !visibleThinking && images.length === 0 && visibleTools.length === 0 && attachedFiles.length === 0 && !hasStreamingToolStatus) return null;
  const hasProcessContent = Boolean(visibleThinking) || visibleTools.length > 0 || hasStreamingToolStatus;

  const anchorId = message.id || message._rowKey;

  return (
    <div
      data-message-id={anchorId || undefined}
      className={cn(
        'flex gap-3 group',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      {!isUser && (
        hideAvatar ? (
          // Keep assistant content aligned when grouped with previous assistant row.
          <div className="h-8 w-8 shrink-0 mt-1" aria-hidden />
        ) : (
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1 text-foreground',
              cronSession
                ? 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100'
                : 'bg-black/5 dark:bg-white/5',
            )}
            title={cronSession ? t('cronSession.avatarHint') : undefined}
          >
            {cronSession ? <AlarmClock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </div>
        )
      )}

      {/* Content */}
      <div
        className={cn(
          'flex flex-col w-full min-w-0 max-w-[80%] space-y-2',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {hasProcessContent && (
          <ProcessPanel
            thinking={visibleThinking}
            tools={visibleTools}
            streamingTools={streamingTools}
            isStreaming={isStreaming}
          />
        )}

        {/* Images — rendered ABOVE text bubble for user messages */}
        {/* Images from content blocks (Gateway session data / channel push photos) */}
        {isUser && images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => {
              const src = imageSrc(img);
              if (!src) return null;
              return (
                <ImageThumbnail
                  key={`content-${i}`}
                  src={src}
                  fileName="image"
                  base64={img.data}
                  mimeType={img.mimeType}
                  onPreview={() => setLightboxImg({ src, fileName: 'image', base64: img.data, mimeType: img.mimeType })}
                />
              );
            })}
          </div>
        )}

        {/* File attachments — images above text for user, file cards below */}
        {isUser && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, i) => {
              const isImage = file.mimeType.startsWith('image/');
              // Skip image attachments if we already have images from content blocks
              if (isImage && images.length > 0) return null;
              if (isImage) {
                return file.preview ? (
                  <ImageThumbnail
                    key={`local-${i}`}
                    src={file.preview}
                    fileName={file.fileName}
                    filePath={file.filePath}
                    mimeType={file.mimeType}
                    onPreview={() => setLightboxImg({ src: file.preview!, fileName: file.fileName, filePath: file.filePath, mimeType: file.mimeType })}
                  />
                ) : (
                  <div
                    key={`local-${i}`}
                    className="w-36 h-36 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-muted-foreground"
                  >
                    <File className="h-8 w-8" />
                  </div>
                );
              }
              // Non-image files → file card
              return <FileCard key={`local-${i}`} file={file} />;
            })}
          </div>
        )}

        {/* Main text bubble */}
        {hasText && (
          <>
            {cronSession && message.role === 'system' && (
              <div className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100">
                <AlarmClock className="h-3 w-3" />
                {t('cronSession.badge')}
              </div>
            )}
            <MessageBubble
              text={text}
              isUser={isUser}
              isStreaming={isStreaming}
              cronSystem={cronSession && message.role === 'system'}
              errorBubble={Boolean(message.isError && !isUser)}
            />
          </>
        )}

        {/* Images from content blocks — assistant messages (below text) */}
        {!isUser && images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => {
              const src = imageSrc(img);
              if (!src) return null;
              return (
                <ImagePreviewCard
                  key={`content-${i}`}
                  src={src}
                  fileName="image"
                  base64={img.data}
                  mimeType={img.mimeType}
                  onPreview={() => setLightboxImg({ src, fileName: 'image', base64: img.data, mimeType: img.mimeType })}
                />
              );
            })}
          </div>
        )}

        {/* File attachments — assistant messages (below text) */}
        {!isUser && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, i) => {
              const isImage = file.mimeType.startsWith('image/');
              if (isImage && images.length > 0) return null;
              if (isImage && file.preview) {
                return (
                  <ImagePreviewCard
                    key={`local-${i}`}
                    src={file.preview}
                    fileName={file.fileName}
                    filePath={file.filePath}
                    mimeType={file.mimeType}
                    onPreview={() => setLightboxImg({ src: file.preview!, fileName: file.fileName, filePath: file.filePath, mimeType: file.mimeType })}
                  />
                );
              }
              if (isImage && !file.preview) {
                return (
                  <div key={`local-${i}`} className="w-36 h-36 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-muted-foreground">
                    <File className="h-8 w-8" />
                  </div>
                );
              }
              return <FileCard key={`local-${i}`} file={file} />;
            })}
          </div>
        )}

        {/* Hover row for user messages — timestamp only */}
        {isUser && message.timestamp && (
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none">
            {formatTimestamp(message.timestamp)}
          </span>
        )}

        {/* Hover row for assistant messages — only when there is real text content */}
        {!isUser && hasText && (
          <AssistantHoverBar text={text} timestamp={message.timestamp} />
        )}
      </div>

      {/* Image lightbox portal */}
      {lightboxImg && (
        <ImageLightbox
          src={lightboxImg.src}
          fileName={lightboxImg.fileName}
          filePath={lightboxImg.filePath}
          base64={lightboxImg.base64}
          mimeType={lightboxImg.mimeType}
          onClose={() => setLightboxImg(null)}
        />
      )}
    </div>
  );
});

function ProcessPanel({
  thinking,
  tools,
  streamingTools,
  isStreaming,
}: {
  thinking: string | null;
  tools: Array<{ id?: string; name: string; input?: unknown }>;
  streamingTools: Array<{
    id?: string;
    toolCallId?: string;
    name: string;
    status: 'running' | 'completed' | 'error';
    durationMs?: number;
    summary?: string;
  }>;
  isStreaming: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const toolCount = Math.max(tools.length, streamingTools.length);
  const title = isStreaming ? '思考中' : '已完成思考';
  const subtitle = `执行了 ${toolCount} 个步骤`;
  const hasThinking = Boolean(thinking && thinking.trim().length > 0);
  const staticTools = tools.map((tool) => ({
    key: tool.id || tool.name,
    name: tool.name,
    input: tool.input,
    status: 'completed' as const,
    summary: '',
  }));
  const liveTools = streamingTools.map((tool) => ({
    key: tool.toolCallId || tool.id || tool.name,
    name: tool.name,
    input: undefined,
    status: tool.status,
    summary: tool.summary || '',
  }));
  const mergedSteps = isStreaming ? liveTools : staticTools;

  return (
    <div className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#f1eee6] dark:bg-white/[0.04]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors rounded-2xl"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground/85">{title}</p>
          <p className="text-[12px] text-[#4d6a92] dark:text-muted-foreground">{subtitle}</p>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {mergedSteps.length > 0 && (
            <div className="relative pl-4">
              <div className="absolute left-[8px] top-1 bottom-1 w-px bg-black/10 dark:bg-white/10" />
              <div className="space-y-2">
                {mergedSteps.map((step) => (
                  <ProcessStepCard
                    key={step.key}
                    name={step.name}
                    input={step.input}
                    status={step.status}
                    summary={step.summary}
                  />
                ))}
              </div>
            </div>
          )}
          {hasThinking && <ThinkingBlock content={thinking!} />}
        </div>
      )}
    </div>
  );
}

function ProcessStepCard({
  name,
  input,
  status,
  summary,
}: {
  name: string;
  input: unknown;
  status: 'running' | 'completed' | 'error';
  summary?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="relative rounded-lg">
      <span className={cn(
        'absolute -left-[10px] top-3 h-2.5 w-2.5 rounded-full border border-white/70 dark:border-black/30',
        status === 'running' && 'bg-blue-500',
        status === 'completed' && 'bg-green-500',
        status === 'error' && 'bg-red-500',
      )} />
      <button
        type="button"
        className="flex w-full items-center justify-between px-2 py-1.5 text-left rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex min-w-0 items-center gap-2">
          {status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
          {status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
          {status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
          <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[13px] font-medium text-foreground/80">{name}</span>
          {summary ? <span className="truncate text-[11px] text-muted-foreground">{summary}</span> : null}
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {expanded && input !== undefined && input !== null && (
        <pre className="ml-2 mr-2 mb-2 rounded-md bg-white/60 dark:bg-black/20 p-2 text-xs text-[#4d6484] dark:text-muted-foreground overflow-x-auto">
          {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Assistant hover bar (timestamp + copy, shown on group hover) ─

function AssistantHoverBar({ text, timestamp }: { text: string; timestamp?: number }) {
  const [copied, setCopied] = useState(false);

  const copyContent = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <div className="flex items-center justify-between w-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none px-1">
      <span className="text-xs text-muted-foreground">
        {timestamp ? formatTimestamp(timestamp) : ''}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={copyContent}
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────

function MessageBubble({
  text,
  isUser,
  isStreaming,
  cronSystem = false,
  errorBubble = false,
}: {
  text: string;
  isUser: boolean;
  isStreaming: boolean;
  cronSystem?: boolean;
  errorBubble?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative rounded-2xl px-4 py-3',
        !isUser && 'w-full',
        isUser
          ? 'bg-[#0a84ff] text-white shadow-sm'
          : errorBubble
            ? 'border border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive'
            : cronSystem
              ? 'border border-amber-500/20 bg-amber-500/[0.08] text-foreground dark:border-amber-500/30 dark:bg-amber-500/10'
              : 'bg-black/5 dark:bg-white/5 text-foreground',
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words break-all text-sm">{text}</p>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none break-words break-all">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match && !className;
                if (isInline) {
                  return (
                    <code className="bg-background/50 px-1.5 py-0.5 rounded text-sm font-mono break-words break-all" {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <pre className="bg-background/50 rounded-lg p-4 overflow-x-auto">
                    <code className={cn('text-sm font-mono', className)} {...props}>
                      {children}
                    </code>
                  </pre>
                );
              },
              a({ href, children }) {
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-words break-all">
                    {children}
                  </a>
                );
              },
            }}
          >
            {text}
          </ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
          )}
        </div>
      )}

    </div>
  );
}

// ── Thinking Block ──────────────────────────────────────────────

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-[14px]">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="font-medium">Thinking</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-muted-foreground">
          <div className="prose prose-sm dark:prose-invert max-w-none opacity-75">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ── File Card (for user-uploaded non-image files) ───────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('video/')) return <Film className={className} />;
  if (mimeType.startsWith('audio/')) return <Music className={className} />;
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') return <FileText className={className} />;
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z')) return <FileArchive className={className} />;
  if (mimeType === 'application/pdf') return <FileText className={className} />;
  return <File className={className} />;
}

function FileCard({ file }: { file: AttachedFileMeta }) {
  const handleOpen = useCallback(() => {
    if (file.filePath) {
      invokeIpc('shell:openPath', file.filePath);
    }
  }, [file.filePath]);

  return (
    <div 
      className={cn(
        "flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2.5 bg-black/5 dark:bg-white/5 max-w-[220px]",
        file.filePath && "cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      )}
      onClick={handleOpen}
      title={file.filePath ? "Open file" : undefined}
    >
      <FileIcon mimeType={file.mimeType} className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 overflow-hidden">
        <p className="text-xs font-medium truncate">{file.fileName}</p>
        <p className="text-[10px] text-muted-foreground">
          {file.fileSize > 0 ? formatFileSize(file.fileSize) : 'File'}
        </p>
      </div>
    </div>
  );
}

// ── Image Thumbnail (user bubble — square crop with zoom hint) ──

function ImageThumbnail({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onPreview,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onPreview: () => void;
}) {
  void filePath; void base64; void mimeType;
  return (
    <div
      className="relative w-36 h-36 rounded-xl border overflow-hidden border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 group/img cursor-zoom-in"
      onClick={onPreview}
    >
      <img src={src} alt={fileName} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-center justify-center">
        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
      </div>
    </div>
  );
}

// ── Image Preview Card (assistant bubble — natural size with overlay actions) ──

function ImagePreviewCard({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onPreview,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onPreview: () => void;
}) {
  void filePath; void base64; void mimeType;
  return (
    <div
      className="relative max-w-xs rounded-xl border overflow-hidden border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 group/img cursor-zoom-in"
      onClick={onPreview}
    >
      <img src={src} alt={fileName} className="block w-full" />
      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
      </div>
    </div>
  );
}

// ── Image Lightbox ───────────────────────────────────────────────

function ImageLightbox({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onClose,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onClose: () => void;
}) {
  void src; void base64; void mimeType; void fileName;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleShowInFolder = useCallback(() => {
    if (filePath) {
      invokeIpc('shell:showItemInFolder', filePath);
    }
  }, [filePath]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Image + buttons stacked */}
      <div
        className="flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={fileName}
          className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl object-contain"
        />

        {/* Action buttons below image */}
        <div className="flex items-center gap-2">
          {filePath && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
              onClick={handleShowInFolder}
              title="在文件夹中显示"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
            onClick={onClose}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Tool Card ───────────────────────────────────────────────────

