/**
 * Task handler for managing asynchronous tasks with dependency tracking and status monitoring.
 * This class is used in streaming mode to manage concurrent API requests and ensure proper ordering.
 */

export type TaskStatus =
  | 'not_found'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

interface Task {
  promise: Promise<unknown> | null;
  startTime: number | null;
  parentTaskId: string | null;
  callback: (() => void) | null;
  status: TaskStatus;
  resolver?: ((promise: Promise<unknown>) => void) | null;
}

/**
 * Task handler that manages dependencies and executes tasks asynchronously.
 * In Node.js, we don't need a thread pool since async operations run on the event loop.
 * This class provides dependency management and status tracking similar to Python's ThreadPoolTaskHandler.
 */
export class TaskHandler {
  private _tasks: Map<string, Task> = new Map();
  private _retryCounts: Map<string, number> = new Map();

  /**
   * Handle the completion of a task, triggering any dependent child tasks.
   * @param taskId - The ID of the completed task.
   */
  private _handleTaskCompletion(taskId: string): void {
    // Find all child tasks that depend on this task
    for (const [, task] of this._tasks.entries()) {
      if (task.parentTaskId === taskId && task.callback) {
        // Execute the callback which will submit the child task
        // The callback will also resolve the Promise via the resolver
        task.callback();
      }
    }
  }

  /**
   * Add or update a task in the tracking map.
   * @param taskId - The ID of the task.
   * @param promise - The promise representing the async task.
   * @param startTime - The start time of the task.
   * @param parentTaskId - The ID of the parent task (if dependent).
   * @param callback - The callback to run when the task is completed.
   * @param resolver - The resolver function for dependent tasks (to resolve the returned Promise).
   */
  private _addOrUpdateTask(
    taskId: string,
    promise: Promise<unknown> | null = null,
    startTime: number | null = null,
    parentTaskId: string | null = null,
    callback: (() => void) | null = null,
    resolver: ((promise: Promise<unknown>) => void) | null = null
  ): void {
    const status: TaskStatus = parentTaskId
      ? 'pending'
      : promise
        ? 'running'
        : 'pending';

    this._tasks.set(taskId, {
      promise,
      startTime,
      parentTaskId,
      callback,
      status,
      resolver
    });

    // Initialize retry count if not already set
    if (!this._retryCounts.has(taskId)) {
      this._retryCounts.set(taskId, 0);
    }

    // If promise exists, set up completion handler
    if (promise) {
      promise
        .then(() => {
          const task = this._tasks.get(taskId);
          if (task) {
            task.status = 'completed';
          }
          this._handleTaskCompletion(taskId);
        })
        .catch(() => {
          const task = this._tasks.get(taskId);
          if (task) {
            task.status = 'failed';
          }
          this._handleTaskCompletion(taskId);
        });
    }
  }

  /**
   * Submit a task for execution.
   * @param taskId - The ID of the task.
   * @param asyncFn - The async function to execute.
   * @param dependentOnPrev - Whether the task depends on the previous task completing.
   * @returns A Promise that resolves when the task completes (or rejects if it fails).
   */
  /**
   * Extract the corresponding ingest task ID from an update task ID.
   * e.g., "trace-update-123" → "trace-ingest-123"
   *       "span-update-456" → "span-ingest-456"
   */
  private _getCorrespondingIngestTaskId(taskId: string): string | null {
    // Match pattern: {type}-update-{id}
    const updateMatch = taskId.match(/^(trace|span)-update-(.+)$/);
    if (updateMatch) {
      const [, type, id] = updateMatch;
      return `${type}-ingest-${id}`;
    }
    return null;
  }

  async submitTask<T>(
    taskId: string,
    asyncFn: () => Promise<T>,
    dependentOnPrev: boolean = false
  ): Promise<T> {
    const _submit = (): Promise<T> => {
      const promise = asyncFn();
      // Get existing resolver if task was queued as dependent
      const existingTask = this._tasks.get(taskId);
      const resolver = existingTask?.resolver || null;
      this._addOrUpdateTask(taskId, promise, Date.now(), null, null, resolver);

      // If resolver exists, call it to resolve the Promise returned to caller
      if (resolver) {
        resolver(promise);
      }

      return promise;
    };

    if (dependentOnPrev) {
      // For update tasks, find the corresponding ingest task
      const dependentTaskId = this._getCorrespondingIngestTaskId(taskId);

      if (!dependentTaskId) {
        // Not an update task pattern - this shouldn't happen with dependentOnPrev=true
        // but submit immediately as a safety fallback
        return _submit();
      }

      // Check if the specific ingest task exists
      const dependentTask = this._tasks.get(dependentTaskId);

      if (!dependentTask) {
        // No corresponding ingest task found - might be updating an existing trace/span
        // or the ingest task hasn't been submitted yet. Submit immediately.
        return _submit();
      }

      if (this.getStatus(dependentTaskId) === 'completed') {
        // Corresponding ingest completed, submit immediately
        return _submit();
      } else {
        // Wait for the specific ingest task to complete
        return new Promise<T>((resolve, reject) => {
          const resolver = (promise: Promise<unknown>): void => {
            (promise as Promise<T>).then(resolve).catch(reject);
          };
          const callback = (): void => {
            _submit();
          };
          this._addOrUpdateTask(
            taskId,
            null,
            null,
            dependentTaskId,
            callback,
            resolver
          );
        });
      }
    } else {
      // No dependency, submit immediately
      return _submit();
    }
  }

  /**
   * Get the children of a parent task.
   * @param parentTaskId - The ID of the parent task.
   * @returns Array of child task information.
   */
  getChildren(parentTaskId: string): Array<{ taskId: string; task: Task }> {
    const children: Array<{ taskId: string; task: Task }> = [];
    for (const [taskId, task] of this._tasks.entries()) {
      if (task.parentTaskId === parentTaskId) {
        children.push({ taskId, task });
      }
    }
    return children;
  }

  /**
   * Increment the retry count for a task.
   * @param taskId - The ID of the task.
   */
  incrementRetry(taskId: string): void {
    const currentCount = this._retryCounts.get(taskId) || 0;
    this._retryCounts.set(taskId, currentCount + 1);
  }

  /**
   * Get the status of a task.
   * @param taskId - The ID of the task.
   * @returns The status of the task.
   */
  getStatus(taskId: string): TaskStatus {
    const task = this._tasks.get(taskId);
    if (!task) {
      return 'not_found';
    }

    // If task has a parent and hasn't been submitted yet, it's pending
    if (task.parentTaskId && !task.promise) {
      return 'pending';
    }

    // If no promise exists, task hasn't started
    if (!task.promise) {
      return 'not_found';
    }

    // Return the current status (updated by promise handlers)
    return task.status;
  }

  /**
   * Get the result of a completed task.
   * @param taskId - The ID of the task.
   * @returns The result of the task.
   * @throws Error if task not found or not completed.
   */
  async getResult(taskId: string): Promise<unknown> {
    const task = this._tasks.get(taskId);
    if (!task || !task.promise) {
      throw new Error(`Task ${taskId} not found`);
    }
    return task.promise;
  }

  /**
   * Get the retry count for a task.
   * @param taskId - The ID of the task.
   * @returns The retry count.
   */
  getRetryCount(taskId: string): number {
    return this._retryCounts.get(taskId) || 0;
  }

  /**
   * Check if all tasks are completed.
   * @returns True if all tasks are completed or failed, False otherwise.
   */
  allTasksCompleted(): boolean {
    for (const taskId of this._tasks.keys()) {
      const status = this.getStatus(taskId);
      if (status === 'running' || status === 'pending') {
        return false;
      }
    }
    return true;
  }

  /**
   * Terminate the task handler and clean up resources.
   * In Node.js, this is mainly for cleanup and doesn't need to stop a thread pool.
   */
  terminate(): void {
    // Clear all tasks and retry counts
    this._tasks.clear();
    this._retryCounts.clear();
  }
}
