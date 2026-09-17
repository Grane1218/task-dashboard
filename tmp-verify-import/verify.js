const { useTaskStore } = require('./store/useTaskStore.js');
const { useHabitStore } = require('./store/useHabitStore.js');
const { importDataFromText } = require('./utils/backup.js');
const assert = require('assert');

function task(id, title, extra = {}) {
  return { id, title, description: '', priority: 'medium', status: 'todo', startDate: '', dueDate: '', createdAt: 1, updatedAt: 1, ...extra };
}
function tmpl(id, title) {
  return { id, title, createdAt: '2026-01-01T00:00:00.000Z' };
}

// —— 本地初始状态 ——
useTaskStore.setState({
  tasks: [task('local-a', '本地任务A(勿覆盖)'), task('local-b', '本地任务B')],
  reminderSettings: { enabled: true, frequency: 'weekly', time: '10:30', quietStart: '23:00', quietEnd: '07:00' },
  theme: 'dark',
});
useHabitStore.setState({
  templates: [tmpl('local-h1', '本地习惯1(勿覆盖)')],
  completions: { '2026-09-10': ['local-h1'] },
  reminderSettings: { enabled: true, frequency: 'daily', time: '08:00', quietStart: '22:00', quietEnd: '08:00' },
});

// —— 构造备份文件（含：同 id 旧版本、新任务、重复 id、孤儿完成记录、旧设置） ——
const backup = {
  app: 'task-dashboard-backup',
  version: 1,
  exportedAt: '2026-09-17T00:00:00.000Z',
  taskStore: {
    tasks: [
      task('local-a', '导入的旧版本A', { priority: 'low', status: 'done' }), // 应跳过（本地保留）
      task('import-c', '导入任务C'),
      task('import-d', '导入任务D'),
      task('import-c', '重复C副本'), // 备份内部重复 id，去重
    ],
    reminderSettings: { enabled: false, frequency: 'daily', time: '08:00' },
    theme: 'light',
  },
  habitStore: {
    templates: [
      tmpl('local-h1', '导入旧版本习惯'), // 应跳过（本地保留）
      tmpl('import-h2', '导入习惯2'),
    ],
    completions: {
      '2026-09-10': ['local-h1', 'ghost-id'], // 并集 + 孤儿过滤
      '2026-09-12': ['import-h2'], // 新日期追加
    },
    reminderSettings: { enabled: false },
  },
};

(async () => {
  const r = importDataFromText(JSON.stringify(backup));

  // 1. 返回统计
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.stats, {
    tasksAdded: 2,
    tasksSkipped: 1,
    habitsAdded: 1,
    habitsSkipped: 1,
    completionsMerged: 1,
  }, 'stats 统计错误');

  // 2. 任务合并：本地在前 + 追加新任务 + 本地版本未被覆盖
  const tasks = useTaskStore.getState().tasks;
  assert.strictEqual(tasks.length, 4, '任务数应为 4（2 本地 + 2 新增）');
  assert.deepStrictEqual(tasks.map((t) => t.id), ['local-a', 'local-b', 'import-c', 'import-d'], '任务顺序/去重错误');
  const localA = tasks.find((t) => t.id === 'local-a');
  assert.strictEqual(localA.title, '本地任务A(勿覆盖)', '本地任务被导入覆盖');
  assert.strictEqual(localA.status, 'todo', '本地任务状态被导入覆盖');

  // 3. 习惯模板合并
  const templates = useHabitStore.getState().templates;
  assert.strictEqual(templates.length, 2, '习惯数应为 2（1 本地 + 1 新增）');
  assert.deepStrictEqual(templates.map((t) => t.id), ['local-h1', 'import-h2'], '习惯模板错误');
  assert.strictEqual(templates[0].title, '本地习惯1(勿覆盖)', '本地习惯被导入覆盖');

  // 4. 完成记录：并集 + 孤儿过滤
  const completions = useHabitStore.getState().completions;
  assert.deepStrictEqual(completions['2026-09-10'], ['local-h1'], '09-10 并集/孤儿过滤错误');
  assert.deepStrictEqual(completions['2026-09-12'], ['import-h2'], '09-12 新记录未合并');

  // 5. 提醒设置与主题保留本地
  const taskStore = useTaskStore.getState();
  assert.strictEqual(taskStore.reminderSettings.enabled, true, '任务提醒设置被导入覆盖');
  assert.strictEqual(taskStore.reminderSettings.frequency, 'weekly', '任务提醒频率被导入覆盖');
  assert.strictEqual(taskStore.theme, 'dark', '主题被导入覆盖');
  const habitStore = useHabitStore.getState();
  assert.strictEqual(habitStore.reminderSettings.enabled, true, '习惯提醒设置被导入覆盖');

  // 6. 错误路径仍正常
  assert.strictEqual(importDataFromText('not json').ok, false, '非法 JSON 未报错');
  assert.strictEqual(importDataFromText(JSON.stringify({ app: 'other' })).ok, false, '非法 schema 未报错');

  console.log('PASS 6/6: 合并导入逻辑全部通过');

  // —— 7. 覆盖模式：整体替换 ——
  useTaskStore.setState({
    tasks: [task('local-a', '本地任务A(勿覆盖)'), task('local-b', '本地任务B')],
    reminderSettings: { enabled: true, frequency: 'weekly', time: '10:30', quietStart: '23:00', quietEnd: '07:00' },
    theme: 'dark',
  });
  useHabitStore.setState({
    templates: [tmpl('local-h1', '本地习惯1')],
    completions: { '2026-09-10': ['local-h1'] },
    reminderSettings: { enabled: true },
  });

  const overwriteBackup = {
    app: 'task-dashboard-backup',
    version: 1,
    exportedAt: '2026-09-17T00:00:00.000Z',
    taskStore: {
      tasks: [task('ow-a', '覆盖任务A'), task('ow-b', '覆盖任务B', { priority: 'high' })],
      reminderSettings: { enabled: false, frequency: 'daily', time: '07:45' },
      theme: 'light',
    },
    habitStore: {
      templates: [tmpl('ow-h1', '覆盖习惯1')],
      completions: { '2026-09-01': ['ow-h1', 'ghost'], '2026-09-02': ['ow-h1'] },
      reminderSettings: { enabled: false, frequency: 'weekly', time: '20:00' },
    },
  };

  const ro = importDataFromText(JSON.stringify(overwriteBackup), 'overwrite');
  assert.strictEqual(ro.ok, true);
  assert.strictEqual(ro.mode, 'overwrite');
  assert.deepStrictEqual(ro.stats, { tasksAdded: 2, tasksSkipped: 0, habitsAdded: 1, habitsSkipped: 0, completionsMerged: 2 }, '覆盖模式统计错误');

  const tasksOw = useTaskStore.getState().tasks;
  assert.deepStrictEqual(tasksOw.map((t) => t.id), ['ow-a', 'ow-b'], '覆盖后任务未整体替换');
  assert.strictEqual(useTaskStore.getState().theme, 'light', '覆盖后主题未随备份改变');
  assert.strictEqual(useTaskStore.getState().reminderSettings.enabled, false, '覆盖后任务提醒设置未替换');
  assert.strictEqual(useTaskStore.getState().reminderSettings.time, '07:45', '覆盖后任务提醒时间未替换');
  assert.deepStrictEqual(useHabitStore.getState().templates.map((t) => t.id), ['ow-h1'], '覆盖后习惯未整体替换');
  assert.deepStrictEqual(useHabitStore.getState().completions['2026-09-01'], ['ow-h1'], '覆盖后完成记录未替换/孤儿未过滤');
  assert.deepStrictEqual(useHabitStore.getState().completions['2026-09-02'], ['ow-h1'], '覆盖后完成记录缺失');
  assert.strictEqual(useHabitStore.getState().reminderSettings.enabled, false, '覆盖后习惯提醒设置未替换');

  // 8. 默认模式为 merge
  useTaskStore.setState({ tasks: [task('m-local', 'M本地')], theme: 'dark' });
  useHabitStore.setState({ templates: [], completions: {} });
  const rm = importDataFromText(JSON.stringify(overwriteBackup));
  assert.strictEqual(rm.mode, 'merge', '默认模式应为 merge');
  assert.deepStrictEqual(useTaskStore.getState().tasks.map((t) => t.id), ['m-local', 'ow-a', 'ow-b'], '默认 merge 行为错误');

  console.log('PASS 8/8: 覆盖模式 + 默认 merge 全部通过');
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
