import { expect, test } from './fixtures/electron';

test.describe('ClawX Electron smoke flows', () => {
  test('shows the setup wizard on a fresh profile', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await expect(page.getByTestId('setup-welcome-step')).toBeVisible();
    await expect(page.getByTestId('setup-skip-button')).toBeVisible();
  });

  test('chat composer shows model pill and opens model preset dialog', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();
    await page.getByTestId('chat-composer-model-pill').click();
    await expect(page.getByTestId('chat-model-preset-dialog')).toBeVisible({ timeout: 10_000 });
  });

  test('chat toolbar opens agent details sheet', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();
    await page.getByTestId('chat-toolbar-agent-details').click();
    await expect(page.getByTestId('agent-details-sheet')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('agent-details-identity-section')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('agent-details-edit-profile').click();
    await expect(page.getByTestId('edit-agent-info-modal')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('edit-agent-info-name-input')).toBeVisible();
    await expect(page.locator('[data-testid="edit-agent-tagline-input"]')).toHaveCount(0);
  });

  test('sidebar help opens feedback modal and mobile opens wechat modal', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();
    await page.getByTestId('sidebar-rail-help').click();
    await expect(page.getByTestId('feedback-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('feedback-modal')).not.toBeVisible();
    await page.getByTestId('sidebar-rail-mobile').click();
    await expect(page.getByTestId('wechat-connect-modal')).toBeVisible();
    await page.getByTestId('mobile-connect-tab-maxin').click();
    await expect(page.getByTestId('mobile-connect-tab-maxin')).toBeVisible();
  });

  test('sidebar chat search opens search modal', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();
    await page.getByTestId('sidebar-chat-search-open').click();
    await expect(page.getByTestId('chat-search-modal')).toBeVisible({ timeout: 10_000 });
  });

  test('chat sidebar lists agents with per-agent new chat control', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();
    await expect(page.getByTestId('sidebar-agent-group').first()).toBeVisible();
    await expect(page.getByTestId('sidebar-new-chat-main')).toBeVisible();
    await expect(page.getByTestId('sidebar-agent-unread-badge')).toHaveCount(0);
  });

  test('sidebar rail navigates to inspiration, growth, and tasks', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();

    await page.getByTestId('sidebar-rail-inspiration').click();
    await expect(page.getByTestId('inspiration-page')).toBeVisible();

    await page.getByTestId('sidebar-rail-growth').click();
    await expect(page.getByTestId('growth-page')).toBeVisible();

    await page.getByTestId('sidebar-rail-tasks').click();
    await expect(page.getByTestId('cron-page')).toBeVisible();
    await expect(page.getByTestId('cron-card-open-in-chat')).toHaveCount(0);
  });

  test('can skip setup and open models from settings', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();

    await expect(page.getByTestId('main-layout')).toBeVisible();
    await page.getByTestId('sidebar-nav-settings').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await page.getByTestId('settings-modal-nav-models').click();

    await expect(page.getByTestId('models-page')).toBeVisible();
    await expect(page.getByTestId('providers-settings')).toBeVisible();
  });

  test('settings modal opens About section', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();
    await page.getByTestId('sidebar-nav-settings').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await page.getByTestId('settings-modal-nav-about').click();
    await expect(page.getByTestId('about-settings-panel')).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar session list can open history sheet via 查看更多', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();
    await expect(page.getByTestId('sidebar-chat-panel')).toBeVisible();
    const viewMore = page.getByTestId('sidebar-agent-view-more');
    if ((await viewMore.count()) > 0) {
      await viewMore.first().click();
      await expect(page.getByTestId('agent-sessions-history-sheet')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('persists skipped setup across relaunch for the same isolated profile', async ({ electronApp, launchElectronApp }) => {
    const firstWindow = await electronApp.firstWindow();
    await firstWindow.waitForLoadState('domcontentloaded');
    await firstWindow.getByTestId('setup-skip-button').click();
    await expect(firstWindow.getByTestId('main-layout')).toBeVisible();

    await electronApp.close();

    const relaunchedApp = await launchElectronApp();
    try {
      const relaunchedWindow = await relaunchedApp.firstWindow();
      await relaunchedWindow.waitForLoadState('domcontentloaded');

      await expect(relaunchedWindow.getByTestId('main-layout')).toBeVisible();
      await expect(relaunchedWindow.getByTestId('setup-page')).toHaveCount(0);
    } finally {
      await relaunchedApp.close();
    }
  });
});
