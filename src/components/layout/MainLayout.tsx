/**
 * Main Layout Component
 * TitleBar at top, then sidebar + content below.
 */
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { ChatTitleBarToolbar } from '@/pages/Chat/ChatToolbar';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { FeedbackModal } from '@/components/shell/FeedbackModal';
import { WeChatConnectModal } from '@/components/shell/WeChatConnectModal';

export function MainLayout() {
  const location = useLocation();
  const titleBarTrailing = location.pathname === '/' ? <ChatTitleBarToolbar /> : undefined;

  return (
    <div data-testid="main-layout" className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Title bar: same row as window controls; chat page adds toolbar here */}
      <TitleBar trailing={titleBarTrailing} />

      {/* Below the title bar: sidebar + content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main data-testid="main-content" className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <SettingsModal />
      <FeedbackModal />
      <WeChatConnectModal />
    </div>
  );
}
