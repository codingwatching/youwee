import { invoke } from '@tauri-apps/api/core';
import { Monitor } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { SettingsRow, SettingsSection } from '../SettingsSection';

const isMacOS = navigator.platform.includes('Mac');

interface SystemSectionProps {
  highlightId?: string | null;
}

export function SystemSection({ highlightId }: SystemSectionProps) {
  const { t } = useTranslation('settings');

  const [hideDockOnClose, setHideDockOnClose] = useState(() => {
    return localStorage.getItem('youwee_hide_dock_on_close') === 'true';
  });

  // Sync preference to backend on mount
  useEffect(() => {
    if (isMacOS) {
      invoke('set_hide_dock_on_close', { hide: hideDockOnClose }).catch(() => {});
    }
  }, [hideDockOnClose]);

  const handleToggleHideDock = useCallback((checked: boolean) => {
    setHideDockOnClose(checked);
    localStorage.setItem('youwee_hide_dock_on_close', String(checked));
    invoke('set_hide_dock_on_close', { hide: checked }).catch(() => {});
  }, []);

  if (!isMacOS) {
    return (
      <div className="space-y-8">
        <SettingsSection
          title={t('system.title')}
          description={t('system.titleDesc')}
          icon={<Monitor className="w-5 h-5 text-white" />}
          iconClassName="bg-gradient-to-br from-slate-500 to-gray-600 shadow-slate-500/20"
        >
          <p className="text-sm text-muted-foreground px-1">{t('system.noSettingsForPlatform')}</p>
        </SettingsSection>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SettingsSection
        title={t('system.title')}
        description={t('system.titleDesc')}
        icon={<Monitor className="w-5 h-5 text-white" />}
        iconClassName="bg-gradient-to-br from-slate-500 to-gray-600 shadow-slate-500/20"
      >
        <SettingsRow
          id="hide-dock"
          label={t('system.hideDockOnClose')}
          description={t('system.hideDockOnCloseDesc')}
          highlight={highlightId === 'hide-dock'}
        >
          <Switch checked={hideDockOnClose} onCheckedChange={handleToggleHideDock} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
