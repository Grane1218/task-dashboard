import type { Priority, Task, TaskStatus } from '../types';

export interface TaskFilters {
  search: string;
  priority: Priority | 'all';
  status: TaskStatus | 'all';
}

export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  priority: 'all',
  status: 'all',
};

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const keyword = filters.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (keyword !== '' && !task.title.toLowerCase().includes(keyword)) return false;
    return true;
  });
}