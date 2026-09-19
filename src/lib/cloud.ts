import Cloudbase from '@cloudbase/js-sdk';
import type { ReminderSettings, Task, TaskStatus, Theme } from '../types';
import type { CompletionMap, HabitReminderSettings, TaskTemplate } from '../types/habit';

/**
 * 云开发接入层（第一步：数据云端化）
 *
 * 设计约束：
 * - envId 通过 .env 的 VITE_CLOUDBASE_ENV 配置；未配置时应用保持纯本地模式，零影响。
 * - 匿名登录（需在云开发控制台开启「匿名登录」）；每条文档带 owner 字段。
 * - 所有写操作幂等：doc(id).set() 天然 upsert，_id = 业务 id。
 * - 初始化失败降级为本地模式，并允许下次操作重试。
 */

const ENV_ID: string | undefined = import.meta.env.VITE_CLOUDBASE_ENV as string | undefined;

export type CloudStatus = 'unconfigured' | 'ready' | 'failed';

/** 云数据库最小类型面（对齐 @cloudbase/js-sdk 的 ICollection/IQuery/IDocument 常用链） */
interface CloudDoc {
  set(data: unknown): Promise<unknown>;
  remove(): Promise<unknown>;
  get(): Promise<{ data: unknown[] }>;
}
/** where 之后的查询链：SDK 禁止再次 where，且无 doc 方法 */
interface CloudQuery {
  skip(n: number): CloudQuery;
  limit(n: number): CloudQuery;
  get(): Promise<{ data: unknown[] }>;
}
interface CloudCollection {
  doc(id: string): CloudDoc;
  where(query: unknown): CloudQuery;
  skip(n: number): CloudQuery;
  limit(n: number): CloudQuery;
  get(): Promise<{ data: unknown[] }>;
}
interface CloudDb {
  collection(name: string): CloudCollection;
}
let db: CloudDb | null = null;
let owner = 'anonymous';
let status: CloudStatus = 'unconfigured';
let initPromise: Promise<boolean> | null = null;

type StatusListener = (s: CloudStatus) => void;
const listeners = new Set<StatusListener>();

export function isCloudConfigured(): boolean {
  return typeof ENV_ID === 'string' && ENV_ID.trim() !== '';
}

export function getCloudStatus(): CloudStatus {
  return status;
}

export function onCloudStatusChange(fn: StatusListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function setStatus(s: CloudStatus): void {
  if (status === s) return;
  status = s;
  for (const fn of listeners) fn(s);
}

/**
 * 确保云已初始化并完成匿名登录。
 * - 未配置 envId：返回 false（纯本地模式）
 * - 初始化/登录失败：返回 false 并标记 failed（下次调用会重试）
 * - 成功：返回 true，之后 status 恒为 ready
 */
export async function ensureCloud(): Promise<boolean> {
  if (!isCloudConfigured()) return false;
  if (status === 'ready') return true;
  if (initPromise !== null) return initPromise;

  initPromise = (async () => {
    try {
      const instance = Cloudbase.init({ env: ENV_ID });
      const auth = instance.auth({ persistence: 'local' });
      const { data, error } = await auth.signInAnonymously();
      if (error) throw new Error(error.message);
      owner = data?.user?.id ?? 'anonymous';
      db = instance.database();
      setStatus('ready');
      return true;
    } catch (e) {
      console.error('[cloud] 初始化失败，降级为本地模式:', e);
      setStatus('failed');
      return false;
    } finally {
      initPromise = null;
    }
  })();
  return initPromise;
}

/**
 * 写穿透封装：云可用时执行 op（失败返回 false），云不可用（未配置/降级）时视为成功，
 * 让应用在纯本地模式下行为与改造前完全一致。
 */
export async function writeThrough(op: () => Promise<boolean>): Promise<boolean> {
  if (!(await ensureCloud())) return true;
  return op();
}

async function upsertDoc(collection: string, id: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    await db!.collection(collection).doc(id).set({ ...data, owner });
    return true;
  } catch (e) {
    console.error('[cloud] upsert 失败:', collection, id, e);
    return false;
  }
}

async function removeDoc(collection: string, id: string): Promise<boolean> {
  try {
    await db!.collection(collection).doc(id).remove();
    return true;
  } catch (e) {
    console.error('[cloud] remove 失败:', collection, id, e);
    return false;
  }
}

async function queryAll(collection: string): Promise<Record<string, unknown>[]> {
  // 共享模式：集合权限已设为「所有用户可读写」，任何匿名身份读写同一份数据。
  // 不能按 owner 过滤——匿名登录的 uid 每台设备独立，过滤会导致换设备读不到已有数据。
  // 微信云数据库单次 get 上限 20 条，需分页拉全量。
  const pageSize = 20;
  const result: Record<string, unknown>[] = [];
  let skip = 0;
  for (;;) {
    const res = await db!.collection(collection).skip(skip).limit(pageSize).get();
    const batch = (res.data ?? []) as Record<string, unknown>[];
    result.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return result;
}

// ---------- 任务 ----------

export async function upsertTask(task: Task): Promise<boolean> {
  return upsertDoc('tasks', task.id, { ...task });
}

export async function removeTask(id: string): Promise<boolean> {
  return removeDoc('tasks', id);
}

/** 把本地任务数组的顺序/状态结构同步到云端 task-order 集合（单文档，一次写） */
export async function syncTaskOrder(tasks: Task[]): Promise<boolean> {
  const order: Record<TaskStatus, string[]> = { todo: [], 'in-progress': [], done: [] };
  for (const t of tasks) {
    if (t.archived) continue;
    (order[t.status] ?? order.todo).push(t.id);
  }
  return upsertDoc('task-order', 'default', { order });
}

// ---------- 习惯 ----------

export async function upsertTemplate(t: TaskTemplate): Promise<boolean> {
  return upsertDoc('habits', t.id, { ...t });
}

export async function removeTemplate(id: string): Promise<boolean> {
  return removeDoc('habits', id);
}

/** 打卡记录按日期聚合：{ _id: date, date, templateIds }；空数组时删除该日文档 */
export async function upsertCompletion(date: string, templateIds: string[]): Promise<boolean> {
  if (templateIds.length === 0) return removeDoc('completions', date);
  return upsertDoc('completions', date, { date, templateIds });
}

// ---------- 设置（弱一致：失败忽略，下次成功时覆盖） ----------

export interface CloudSettings {
  taskReminder: ReminderSettings;
  habitReminder: HabitReminderSettings;
  theme: Theme;
}

export async function upsertSettings(s: CloudSettings): Promise<boolean> {
  return upsertDoc('settings', 'default', { ...s });
}

/** 设置类变更走弱一致：尽力推云，失败静默（偏好数据可重建） */
export function pushSettings(s: CloudSettings): void {
  if (!isCloudConfigured()) return;
  void upsertSettings(s);
}

// ---------- 全量拉取 / 全量上传 ----------

export interface CloudSnapshot {
  tasks: Task[];
  templates: TaskTemplate[];
  completions: CompletionMap;
  /** 云端设置可能部分缺失（旧数据/未写入过），字段缺失由调用方按缺省处理 */
  settings: Partial<CloudSettings> | null;
}

function sanitizeTask(raw: unknown): Task | null {
  const t = (raw ?? {}) as Record<string, unknown>;
  if (typeof t.id !== 'string' || t.id === '') return null;
  return {
    id: t.id,
    title: typeof t.title === 'string' ? t.title : '未命名任务',
    description: typeof t.description === 'string' ? t.description : '',
    priority: t.priority === 'high' || t.priority === 'medium' || t.priority === 'low' ? t.priority : 'medium',
    status: t.status === 'todo' || t.status === 'in-progress' || t.status === 'done' ? t.status : 'todo',
    startDate: typeof t.startDate === 'string' ? t.startDate : '',
    dueDate: typeof t.dueDate === 'string' ? t.dueDate : '',
    createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
    updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : Date.now(),
    repeat: t.repeat === 'daily' || t.repeat === 'weekly' || t.repeat === 'monthly' ? t.repeat : undefined,
    archived: t.archived === true,
  };
}

function sanitizeTemplate(raw: unknown): TaskTemplate | null {
  const t = (raw ?? {}) as Record<string, unknown>;
  if (typeof t.id !== 'string' || t.id === '') return null;
  return {
    id: t.id,
    title: typeof t.title === 'string' ? t.title : '未命名习惯',
    emoji: typeof t.emoji === 'string' && t.emoji.trim() !== '' ? t.emoji : undefined,
    category: typeof t.category === 'string' && t.category.trim() !== '' ? t.category : undefined,
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    archived: t.archived === true,
  };
}

export async function hydrateFromCloud(): Promise<CloudSnapshot | null> {
  if (!(await ensureCloud())) return null;
  try {
    const [taskDocs, templateDocs, completionDocs, settingsDocs, orderDocs] = await Promise.all([
      queryAll('tasks'),
      queryAll('habits'),
      queryAll('completions'),
      queryAll('settings'),
      queryAll('task-order'),
    ]);

    const tasks = taskDocs.map(sanitizeTask).filter((t): t is Task => t !== null);
    const templates = templateDocs.map(sanitizeTemplate).filter((t): t is TaskTemplate => t !== null);

    // 顺序重建：活跃任务按云端 order 排序（跨列后仍按实际 status 归类），不在 order 的追加列尾，归档任务放尾部
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const orderDoc = orderDocs[0] as { order?: Record<TaskStatus, string[]> } | undefined;
    const order = orderDoc?.order ?? null;
    const ordered: Task[] = [];
    const placed = new Set<string>();
    if (order !== null) {
      for (const status of ['todo', 'in-progress', 'done'] as TaskStatus[]) {
        for (const id of order[status] ?? []) {
          const t = byId.get(id);
          if (t !== undefined && !t.archived && !placed.has(id)) {
            placed.add(id);
            ordered.push(t);
          }
        }
      }
    }
    for (const t of tasks) {
      if (!t.archived && !placed.has(t.id)) {
        placed.add(t.id);
        ordered.push(t);
      }
    }
    for (const t of tasks) {
      if (t.archived) ordered.push(t);
    }

    const completions: CompletionMap = {};
    const templateIds = new Set(templates.map((t) => t.id));
    for (const d of completionDocs) {
      const c = d as { date?: unknown; templateIds?: unknown };
      if (typeof c.date === 'string' && Array.isArray(c.templateIds)) {
        // 仅保留仍存在的习惯模板 id（删除习惯后云端残留在此收敛）
        const ids = c.templateIds.filter((x): x is string => typeof x === 'string' && templateIds.has(x));
        if (ids.length > 0) completions[c.date] = ids;
      }
    }

    let settings: Partial<CloudSettings> | null = null;
    const s = settingsDocs[0] as Partial<CloudSettings> | undefined;
    if (s !== undefined && s !== null) {
      settings = {
        ...(s.taskReminder ? { taskReminder: s.taskReminder } : {}),
        ...(s.habitReminder ? { habitReminder: s.habitReminder } : {}),
        ...(s.theme === 'light' || s.theme === 'dark' ? { theme: s.theme } : {}),
      };
    }

    return { tasks: ordered, templates, completions, settings };
  } catch (e) {
    console.error('[cloud] hydrate 失败:', e);
    return null;
  }
}

export interface CloudUploadInput {
  tasks: Task[];
  templates: TaskTemplate[];
  completions: CompletionMap;
  settings: CloudSettings;
}

/** 全量上传（首迁/导入后同步）：幂等，可重复执行 */
export async function uploadLocalToCloud(input: CloudUploadInput): Promise<{ ok: boolean; written: number }> {
  if (!(await ensureCloud())) return { ok: false, written: 0 };
  let written = 0;
  try {
    for (const t of input.tasks) {
      if (await upsertTask(t)) written += 1;
    }
    if (await syncTaskOrder(input.tasks)) written += 1;
    for (const t of input.templates) {
      if (await upsertTemplate(t)) written += 1;
    }
    for (const [date, ids] of Object.entries(input.completions)) {
      if (ids.length > 0 && (await upsertCompletion(date, ids))) written += 1;
    }
    if (await upsertSettings(input.settings)) written += 1;
    return { ok: true, written };
  } catch (e) {
    console.error('[cloud] 全量上传失败:', e);
    return { ok: false, written };
  }
}
