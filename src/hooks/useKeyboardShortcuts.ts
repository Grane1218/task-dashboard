import { useEffect, useRef } from 'react';
import type { View } from '../types';

export interface ShortcutHandlers {
  onNew: () => void;
  onSearch: () => void;
  onSwitchView: (view: View) => void;
  onToggleTheme: () => void;
  onHelp: () => void;
}

/**
 * 全局键盘快捷键（输入框聚焦时不触发，避免干扰打字）：
 * N 新建 / 聚焦搜索 / 1-4 切换视图 / D 切换深浅色 / ? 快捷键帮助
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target?.isContentEditable ?? false);
      if (typing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      switch (event.key) {
        case 'n':
        case 'N':
          event.preventDefault();
          ref.current.onNew();
          break;
        case '/':
          event.preventDefault();
          ref.current.onSearch();
          break;
        case '1':
          ref.current.onSwitchView('board');
          break;
        case '2':
          ref.current.onSwitchView('habits');
          break;
        case '3':
          ref.current.onSwitchView('calendar');
          break;
        case '4':
          ref.current.onSwitchView('stats');
          break;
        case 'd':
        case 'D':
          ref.current.onToggleTheme();
          break;
        case '?':
          event.preventDefault();
          ref.current.onHelp();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
