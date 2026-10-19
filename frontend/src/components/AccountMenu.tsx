import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Moon, Sun, Monitor, Check, LogOut, Stethoscope, Languages, type LucideIcon } from 'lucide-react'
import { isAuthenticated, logout } from '@panwatch/api'
import type { ThemeMode } from '@/hooks/use-theme'
import { useAvatar } from '@/hooks/use-avatar'
import { useTranslation } from 'react-i18next'
import { changeLocale, normalizeLocale, type SupportedLocale } from '@/i18n'
import { useInterfaceLanguage } from '@/i18n/interface-language'
import { UserAvatar } from '@/components/UserAvatar'

export interface AccountNavItem {
  to: string
  icon: LucideIcon
  label: string
}

const THEME_OPTIONS: { value: ThemeMode; icon: LucideIcon; labelKey: 'light' | 'dark' | 'system' }[] = [
  { value: 'light', icon: Sun, labelKey: 'light' },
  { value: 'dark', icon: Moon, labelKey: 'dark' },
  { value: 'system', icon: Monitor, labelKey: 'system' },
]

const LANGUAGE_OPTIONS: { value: SupportedLocale; labelKey: 'simplifiedChinese' | 'english' }[] = [
  { value: 'zh-CN', labelKey: 'simplifiedChinese' },
  { value: 'en-US', labelKey: 'english' },
]

interface AccountMenuProps {
  /** 原“更多”里折叠的导航项(Agent / 历史 / 数据源 / 设置)。 */
  navItems: AccountNavItem[]
  mode: ThemeMode
  onSetMode: (m: ThemeMode) => void
  /** 打开「系统自检」弹窗(状态由上层 App 托管,避免桌面/移动两个实例重复)。 */
  onOpenSelfCheck: () => void
  /** 头像尺寸:桌面 md,移动端 sm。 */
  size?: 'sm' | 'md'
}

/**
 * 右上角头像区域 + 下拉菜单(参考 beecount-cloud):
 * 把原“更多”导航、主题色(亮/暗/跟随系统)、退出登录收进头像下拉
 * (查看日志 / GitHub 仍在外侧)。
 */
export default function AccountMenu({
  navItems,
  mode,
  onSetMode,
  onOpenSelfCheck,
  size = 'md',
}: AccountMenuProps) {
  const { t, i18n: i18nInstance } = useTranslation('settings')
  const currentLocale = normalizeLocale(i18nInstance.resolvedLanguage || i18nInstance.language)
  useInterfaceLanguage()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const avatar = useAvatar()
  // 路由变化时关闭
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const avatarSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7'

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
      <button
        className={`${avatarSize} rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm ring-1 transition-all ${
          open ? 'ring-primary/50' : 'ring-border/40 hover:ring-primary/40'
        }`}
        title={t('account.menuTitle')}
        aria-label={t('account.menuTitle')}
      >
        <UserAvatar src={avatar} alt={t('account.avatarAlt')} />
      </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} collisionPadding={12}
          className="z-[70] w-60 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto scrollbar rounded-xl border border-border/60 bg-card p-1.5 shadow-xl">
          {/* 原“更多”导航 */}
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname.startsWith(to)
            return (
              <DropdownMenu.Item key={to} asChild><NavLink
                to={to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 focus:bg-accent/60 outline-none'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </NavLink></DropdownMenu.Item>
            )
          })}

          <div className="my-1 h-px bg-border/50" />

          {/* 主题色:亮 / 暗 / 跟随系统 */}
          <div className="px-2.5 pt-0.5 pb-1 text-[11px] text-muted-foreground">{t('account.themeTitle')}</div>
          {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => {
            const active = mode === value
            return (
              <DropdownMenu.Item key={value} asChild onSelect={e => e.preventDefault()}><button
                onClick={() => onSetMode(value)}
                className={`flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors ${
                  active
                    ? 'text-foreground bg-accent/40'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 focus:bg-accent/60 outline-none'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`account.theme.${labelKey}`)}
                {active && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
              </button></DropdownMenu.Item>
            )
          })}

          <div className="my-1 h-px bg-border/50" />
          <div className="px-2.5 pt-0.5 pb-1 text-[11px] text-muted-foreground">{t('language.title')}</div>
          {LANGUAGE_OPTIONS.map(({ value, labelKey }) => {
            const active = currentLocale === value
            return (
              <DropdownMenu.Item key={value} asChild onSelect={e => e.preventDefault()}><button
                onClick={() => void changeLocale(value)}
                className={`flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors ${
                  active
                    ? 'text-foreground bg-accent/40'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 focus:bg-accent/60 outline-none'
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                {t(`language.${labelKey}`)}
                {active && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
              </button></DropdownMenu.Item>
            )
          })}

          <div className="my-1 h-px bg-border/50" />
          {/* 系统自检:打开弹窗(逐项检查数据源/AI/通知连通性) */}
          <DropdownMenu.Item asChild><button
            onClick={() => {
              setOpen(false)
              onOpenSelfCheck()
            }}
            className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent/60 focus:bg-accent/60 outline-none transition-colors"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            {t('account.selfCheck')}
          </button></DropdownMenu.Item>

          {isAuthenticated() && (
            <>
              <div className="my-1 h-px bg-border/50" />
              <DropdownMenu.Item asChild><button
                onClick={logout}
                className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t('account.signOut')}
              </button></DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
