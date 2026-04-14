import { expect, test } from './fixtures/electron';

test.describe('Agents list overflow menu', () => {
  test('non-default agent row shows more menu and delete opens confirm dialog', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();

    await page.getByTestId('sidebar-nav-settings').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await page.getByTestId('settings-modal-nav-agents').click();

    const unique = `e2e-menu-${Date.now()}`;
    await page.getByTestId('agents-add-agent').click();
    await page.getByTestId('agents-create-name-input').fill(unique);
    await page.getByTestId('agents-create-submit').click();

    await expect(page.getByText(unique, { exact: true })).toBeVisible({ timeout: 30_000 });

    const newCard = page.locator(`[data-testid="agent-card"]:has-text("${unique}")`);
    await newCard.hover();
    await newCard.getByTestId('agent-card-more-menu').click();
    await page.getByTestId('agent-card-delete-menu-item').click();

    await expect(page.getByTestId('agents-delete-confirm-dialog')).toBeVisible();
    await page.getByTestId('agents-delete-confirm-dialog').getByRole('button').first().click();
    await expect(page.getByTestId('agents-delete-confirm-dialog')).not.toBeVisible();
    await expect(page.getByText(unique, { exact: true })).toBeVisible();
  });

  test('sidebar agent row shows more menu and delete opens same confirm flow', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();

    await page.getByTestId('sidebar-nav-settings').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await page.getByTestId('settings-modal-nav-agents').click();

    const unique = `e2e-sidebar-${Date.now()}`;
    await page.getByTestId('agents-add-agent').click();
    await page.getByTestId('agents-create-name-input').fill(unique);
    await page.getByTestId('agents-create-submit').click();

    await expect(page.getByText(unique, { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('settings-modal-close').click();
    await expect(page.getByTestId('settings-modal')).not.toBeVisible();

    const sidebarGroup = page
      .getByTestId('sidebar-agent-group')
      .filter({ has: page.getByText(unique, { exact: true }) });
    await expect(sidebarGroup).toBeVisible();
    await sidebarGroup.hover();
    await sidebarGroup.locator('[data-testid^="sidebar-agent-more-menu-"]').click();
    await page.locator('[data-testid^="sidebar-agent-delete-menu-item-"]').click();

    await expect(page.getByTestId('sidebar-agent-delete-confirm-dialog')).toBeVisible();
    await page.getByTestId('sidebar-agent-delete-confirm-dialog').getByRole('button').first().click();
    await expect(page.getByTestId('sidebar-agent-delete-confirm-dialog')).not.toBeVisible();
    await expect(sidebarGroup).toBeVisible();
  });

  test('bundled preinstalled agent has no delete overflow menu on Agents page', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();

    await page.getByTestId('sidebar-nav-settings').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await page.getByTestId('settings-modal-nav-agents').click();

    const presetCard = page.locator('[data-testid="agent-card"][data-agent-id="clawx-preset"]');
    await expect(presetCard).toBeVisible({ timeout: 30_000 });
    await presetCard.hover();
    await expect(presetCard.getByTestId('agent-card-more-menu')).toHaveCount(0);
  });
});
