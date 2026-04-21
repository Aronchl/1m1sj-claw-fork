/**
 * Edit agent name / avatar / model (local UI + agent APIs).
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, X, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAgentsStore } from '@/stores/agents';
import { useProviderStore, type ProviderAccount, type ProviderVendorInfo, type ProviderWithKeyInfo } from '@/stores/providers';
import { getAgentUiExtras, setAgentUiExtras } from '@/lib/agent-ui-storage';
import { AGENT_AVATAR_GRADIENT_CLASSES, AGENT_AVATAR_PRESET_COUNT } from '@/lib/agent-avatar-presets';

const NAME_MAX = 10;
const AVATAR_PRESETS = AGENT_AVATAR_PRESET_COUNT;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  initialName: string;
};

interface RuntimeProviderOption {
  runtimeProviderKey: string;
  accountId: string;
  label: string;
  modelIdPlaceholder?: string;
  configuredModelId?: string;
}

function resolveRuntimeProviderKey(account: ProviderAccount): string {
  if (account.authMode === 'oauth_browser') {
    if (account.vendorId === 'google') return 'google-gemini-cli';
    if (account.vendorId === 'openai') return 'openai-codex';
  }
  if (account.vendorId === 'custom' || account.vendorId === 'ollama') {
    const suffix = account.id.replace(/-/g, '').slice(0, 8);
    return `${account.vendorId}-${suffix}`;
  }
  if (account.vendorId === 'minimax-portal-cn') {
    return 'minimax-portal';
  }
  return account.vendorId;
}

function hasConfiguredProviderCredentials(
  account: ProviderAccount,
  statusById: Map<string, ProviderWithKeyInfo>,
): boolean {
  if (account.authMode === 'oauth_device' || account.authMode === 'oauth_browser' || account.authMode === 'local') {
    return true;
  }
  return statusById.get(account.id)?.hasKey ?? false;
}

function splitModelRef(modelRef: string | null | undefined): { providerKey: string; modelId: string } | null {
  const value = (modelRef || '').trim();
  if (!value) return null;
  const separatorIndex = value.indexOf('/');
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) return null;
  return {
    providerKey: value.slice(0, separatorIndex),
    modelId: value.slice(separatorIndex + 1),
  };
}

function EditAgentInfoModalBody({
  agentId,
  initialName,
  open,
  onClose,
}: {
  agentId: string;
  initialName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('chat');
  const { t: tAgents } = useTranslation('agents');
  const { t: tSettings } = useTranslation('settings');
  const updateAgent = useAgentsStore((s) => s.updateAgent);
  const updateAgentModel = useAgentsStore((s) => s.updateAgentModel);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const agents = useAgentsStore((s) => s.agents);
  const defaultModelRef = useAgentsStore((s) => s.defaultModelRef);
  const refreshProviderSnapshot = useProviderStore((s) => s.refreshProviderSnapshot);
  const providerAccounts = useProviderStore((s) => s.accounts);
  const providerStatuses = useProviderStore((s) => s.statuses);
  const providerVendors = useProviderStore((s) => s.vendors);
  const providerDefaultAccountId = useProviderStore((s) => s.defaultAccountId);

  const ex = getAgentUiExtras(agentId);
  const [name, setName] = useState(() => initialName.slice(0, NAME_MAX));
  const [avatarIndex, setAvatarIndex] = useState(() =>
    ex.avatarIndex >= 0 && ex.avatarIndex < AGENT_AVATAR_PRESET_COUNT ? ex.avatarIndex : 0,
  );
  const [selectedRuntimeProviderKey, setSelectedRuntimeProviderKey] = useState('');
  const [modelIdInput, setModelIdInput] = useState('');

  const agent = useMemo(
    () => agents.find((item) => item.id === agentId) ?? null,
    [agentId, agents],
  );

  const runtimeProviderOptions = useMemo<RuntimeProviderOption[]>(() => {
    const vendorMap = new Map<string, ProviderVendorInfo>(providerVendors.map((vendor) => [vendor.id, vendor]));
    const statusById = new Map<string, ProviderWithKeyInfo>(providerStatuses.map((status) => [status.id, status]));
    const entries = providerAccounts
      .filter((account) => account.enabled && hasConfiguredProviderCredentials(account, statusById))
      .sort((left, right) => {
        if (left.id === providerDefaultAccountId) return -1;
        if (right.id === providerDefaultAccountId) return 1;
        return right.updatedAt.localeCompare(left.updatedAt);
      });

    const deduped = new Map<string, RuntimeProviderOption>();
    for (const account of entries) {
      const runtimeProviderKey = resolveRuntimeProviderKey(account);
      if (!runtimeProviderKey || deduped.has(runtimeProviderKey)) continue;
      const vendor = vendorMap.get(account.vendorId);
      const label = `${account.label} (${vendor?.name || account.vendorId})`;
      const configuredModelId = account.model
        ? (account.model.startsWith(`${runtimeProviderKey}/`)
          ? account.model.slice(runtimeProviderKey.length + 1)
          : account.model)
        : undefined;
      deduped.set(runtimeProviderKey, {
        runtimeProviderKey,
        accountId: account.id,
        label,
        modelIdPlaceholder: vendor?.modelIdPlaceholder,
        configuredModelId,
      });
    }

    return [...deduped.values()];
  }, [providerAccounts, providerDefaultAccountId, providerStatuses, providerVendors]);

  useEffect(() => {
    void refreshProviderSnapshot();
  }, [refreshProviderSnapshot]);

  useEffect(() => {
    setName(initialName.slice(0, NAME_MAX));
  }, [initialName]);

  useEffect(() => {
    if (!open) return;
    const ex = getAgentUiExtras(agentId);
    setAvatarIndex(
      ex.avatarIndex >= 0 && ex.avatarIndex < AGENT_AVATAR_PRESET_COUNT ? ex.avatarIndex : 0,
    );
  }, [open, agentId]);

  useEffect(() => {
    const override = splitModelRef(agent?.overrideModelRef);
    if (override) {
      setSelectedRuntimeProviderKey(override.providerKey);
      setModelIdInput(override.modelId);
      return;
    }

    const effective = splitModelRef(agent?.modelRef || defaultModelRef);
    if (effective) {
      setSelectedRuntimeProviderKey(effective.providerKey);
      setModelIdInput(effective.modelId);
      return;
    }

    setSelectedRuntimeProviderKey(runtimeProviderOptions[0]?.runtimeProviderKey || '');
    setModelIdInput('');
  }, [agent?.modelRef, agent?.overrideModelRef, defaultModelRef, runtimeProviderOptions]);

  const selectedProvider = runtimeProviderOptions.find((option) => option.runtimeProviderKey === selectedRuntimeProviderKey) || null;
  const hasSingleRuntimeProviderOption = runtimeProviderOptions.length === 1;
  const singleRuntimeProviderOption = hasSingleRuntimeProviderOption ? runtimeProviderOptions[0] : null;
  const shouldShowReadonlyProvider = Boolean(
    singleRuntimeProviderOption
    && (!selectedRuntimeProviderKey || selectedRuntimeProviderKey === singleRuntimeProviderOption.runtimeProviderKey),
  );
  const trimmedModelId = modelIdInput.trim();
  const nextModelRef = selectedRuntimeProviderKey && trimmedModelId
    ? `${selectedRuntimeProviderKey}/${trimmedModelId}`
    : '';
  const normalizedDefaultModelRef = (defaultModelRef || '').trim();
  const currentOverrideModelRef = (agent?.overrideModelRef || '').trim();
  const desiredOverrideModelRef = nextModelRef && nextModelRef !== normalizedDefaultModelRef
    ? nextModelRef
    : null;
  const modelChanged = (desiredOverrideModelRef || '') !== currentOverrideModelRef;

  const handleProviderChange = (nextProviderKey: string) => {
    setSelectedRuntimeProviderKey(nextProviderKey);
    const option = runtimeProviderOptions.find((candidate) => candidate.runtimeProviderKey === nextProviderKey);
    setModelIdInput(option?.configuredModelId || '');
  };

  const save = async () => {
    const n = name.trim();
    if (!n) {
      toast.error(t('agentEdit.nameRequired'));
      return;
    }
    try {
      if (n !== initialName.trim()) {
        await updateAgent(agentId, n);
      }
      if (modelChanged) {
        if (!selectedRuntimeProviderKey) {
          toast.error(tAgents('toast.agentModelProviderRequired'));
          return;
        }
        if (!trimmedModelId) {
          toast.error(tAgents('toast.agentModelIdRequired'));
          return;
        }
        if (!nextModelRef.includes('/')) {
          toast.error(tAgents('toast.agentModelInvalid'));
          return;
        }
        await updateAgentModel(agentId, desiredOverrideModelRef);
      }
      setAgentUiExtras(agentId, { avatarIndex });
      await fetchAgents();
      toast.success(t('agentEdit.saved'));
      onClose();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
        <DialogTitle className="text-[17px] font-semibold">{t('agentEdit.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('agentEdit.title')}</DialogDescription>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
          onClick={onClose}
          aria-label={tSettings('modal.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 px-5 py-4">
        <div className="space-y-2">
          <Label className="text-[13px] text-foreground">
            {t('agentEdit.nameLabel')}
            <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              data-testid="edit-agent-info-name-input"
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              className="h-11 rounded-xl pr-14"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
              {name.length}/{NAME_MAX}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[13px] text-foreground">{tAgents('settingsDialog.modelLabel')}</Label>
          <div className="space-y-2">
            <Label htmlFor="chat-agent-model-provider" className="text-[12px] text-foreground/70">
              {tAgents('settingsDialog.modelProviderLabel')}
            </Label>
            {shouldShowReadonlyProvider && singleRuntimeProviderOption ? (
              <div className="rounded-xl border border-black/10 bg-background px-3 py-2 dark:border-white/10">
                <p className="text-[13px] text-foreground">{singleRuntimeProviderOption.label}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {singleRuntimeProviderOption.runtimeProviderKey}
                </p>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="chat-agent-model-provider"
                    type="button"
                    variant="outline"
                    className="h-11 w-full cursor-pointer justify-between rounded-xl border-black/10 bg-background px-3 text-left font-mono text-[13px] font-normal text-foreground shadow-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                  >
                    <span className={cn('truncate', !selectedProvider && 'text-muted-foreground')}>
                      {selectedProvider?.label || tAgents('settingsDialog.modelProviderPlaceholder')}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-[18rem]">
                  {runtimeProviderOptions.length === 0 ? (
                    <DropdownMenuItem disabled className="rounded-xl px-3 py-2 text-[12px] text-muted-foreground">
                      {tAgents('settingsDialog.modelProviderEmpty')}
                    </DropdownMenuItem>
                  ) : (
                    runtimeProviderOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.runtimeProviderKey}
                        onSelect={() => handleProviderChange(option.runtimeProviderKey)}
                        className="flex cursor-pointer items-start justify-between gap-3 rounded-xl px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-foreground">{option.label}</p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {option.runtimeProviderKey}
                          </p>
                        </div>
                        {selectedRuntimeProviderKey === option.runtimeProviderKey ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="chat-agent-model-id" className="text-[12px] text-foreground/70">
              {tAgents('settingsDialog.modelIdLabel')}
            </Label>
            <Input
              id="chat-agent-model-id"
              value={modelIdInput}
              onChange={(e) => setModelIdInput(e.target.value)}
              className="h-11 rounded-xl"
              placeholder={
                selectedProvider?.modelIdPlaceholder
                || selectedProvider?.configuredModelId
                || tAgents('settingsDialog.modelIdPlaceholder')
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[13px] text-foreground">
            {t('agentEdit.avatarLabel')}
            <span className="text-destructive">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: AVATAR_PRESETS }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAvatarIndex(i)}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-semibold text-white shadow-sm ring-2 ring-offset-2 ring-offset-background transition',
                    AGENT_AVATAR_GRADIENT_CLASSES[i] ?? 'from-gray-400 to-gray-600',
                  avatarIndex === i ? 'ring-primary' : 'ring-transparent',
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-black/15 text-muted-foreground dark:border-white/20"
              onClick={() => toast.info(t('agentEdit.avatarUploadSoon'))}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            {t('agentEdit.cancel')}
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void save()}>
            {t('agentEdit.save')}
          </Button>
        </div>
      </div>
    </>
  );
}

export function EditAgentInfoModal({ open, onOpenChange, agentId, initialName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="edit-agent-info-modal"
        className="w-[min(100vw-2rem,36rem)] max-w-xl rounded-2xl border-black/10 p-0 dark:border-white/10"
      >
        <EditAgentInfoModalBody
          key={agentId}
          agentId={agentId}
          initialName={initialName}
          open={open}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
