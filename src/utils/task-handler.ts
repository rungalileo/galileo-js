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
  private tasks: Map<string, Task> = new Map();
  private retryCounts: Map<string, number> = new Map();

  /**
   * Handle the completion of a task, triggering any dependent child tasks.
   * @param taskId - The ID of the completed task.
   */
  private handleTaskCompletion(taskId: string): void {
    // Find all child tasks that depend on this task
    for (const [, task] of this.tasks.entries()) {
      if (task.parentTaskId === taskId && task.callback) {
        // Execute the callback which will submit the child task
        // The callback will also resolve the Promise via the resolver
        task.callback();
      }
    }
  }

  /**
   * Handle parent task failure by rejecting dependent child tasks.
   * @param parentTaskId - The ID of the failed parent task.
   */
  private handleTaskFailure(parentTaskId: string, parentError: Error): void {
    const parentTask = this.tasks.get(parentTaskId);
    if (!parentTask) return;

    // Find all child tasks that depend on this failed parent
    const childTasks: Array<{ taskId: string; task: Task }> = [];
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.parentTaskId === parentTaskId) {
        childTasks.push({ taskId, task });
      }
    }

    if (childTasks.length === 0) return;

    // Reject all child task promises and update their status
    for (const { taskId: childTaskId, task } of childTasks) {
      this.failingTask(
        task,
        `Skipping child task ${childTaskId} because parent task ${parentTaskId} failed.`
      );
    }

    console.error(
      `Parent task ${parentTaskId} failed: ${parentError.message}. ${childTasks.length} dependent task(s) skipped.`
    );
  }

  private failingTask<T>(task: Task, errorMessage: string): Promise<T> {
    task.status = 'failed';

    // Reject the promise if resolver exists
    if (task.resolver) {
      // Create a rejected promise for the child
      const rejectedPromise = Promise.reject(new Error(errorMessage));
      task.resolver(rejectedPromise);
    }

    console.warn(errorMessage);
    return Promise.reject(new Error(errorMessage));
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
  private addOrUpdateTask(
    taskId: string,
    promise: Promise<unknown> | null = null,
    startTime: number | null = null,
    parentTaskId: string | null = null,
    callback: (() => void) | null = null,
    resolver: ((promise: Promise<unknown>) => void) | null = null
  ): Task {
    const status: TaskStatus = parentTaskId
      ? 'pending'
      : promise
        ? 'running'
        : 'pending';

    const newTask: Task = {
      promise,
      startTime,
      parentTaskId,
      callback,
      status,
      resolver
    };

    this.tasks.set(taskId, newTask);

    // Initialize retry count if not already set
    if (!this.retryCounts.has(taskId)) {
      this.retryCounts.set(taskId, 0);
    }

    // If promise exists, set up completion handler
    if (promise) {
      promise
        .then(() => {
          const task = this.tasks.get(taskId);
          if (task) {
            task.status = 'completed';
          }
          this.handleTaskCompletion(taskId);
          // Clean up completed tasks that are no longer needed
          this.cleanupTaskRetryMaps();
        })
        .catch((error) => {
          const task = this.tasks.get(taskId);
          if (task) {
            task.status = 'failed';
          }

          const parentError =
            error instanceof Error ? error : new Error(String(error));
          this.handleTaskFailure(taskId, parentError);
          // Clean up failed tasks that are no longer needed
          this.cleanupTaskRetryMaps();
        });
    }

    return newTask;
  }

  async submitTask<T>(
    taskId: string,
    asyncFn: () => Promise<T>,
    parentTaskId?: string
  ): Promise<T> {
    const _submit = (): Promise<T> => {
      const promise = asyncFn();
      // Get existing resolver if task was queued as dependent
      const existingTask = this.tasks.get(taskId);
      const resolver = existingTask?.resolver || null;
      this.addOrUpdateTask(taskId, promise, Date.now(), null, null, resolver);

      // If resolver exists, call it to resolve the Promise returned to caller
      if (resolver) {
        resolver(promise);
      }

      return promise;
    };

    if (parentTaskId) {
      const parentTaskStatus = this.getStatus(parentTaskId);
      if (
        parentTaskStatus === 'completed' ||
        parentTaskStatus === 'not_found'
      ) {
        // Parent task not found, or already completed.
        return _submit();
      } else if (parentTaskStatus === 'failed') {
        const newTask = this.addOrUpdateTask(
          taskId,
          null,
          Date.now(),
          parentTaskId,
          null,
          null
        );

        return this.failingTask(
          newTask,
          `Skipping task ${taskId} because parent task ${parentTaskId} failed.`
        );
      } else {
        // Wait for the specific ingest task to complete
        return new Promise<T>((resolve, reject) => {
          const resolver = (promise: Promise<unknown>): void => {
            promise.then(
              (value) => resolve(value as T),
              (error) => reject(error)
            );
          };
          const callback = (): void => {
            _submit();
          };
          this.addOrUpdateTask(
            taskId,
            null,
            null,
            parentTaskId,
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
    for (const [taskId, task] of this.tasks.entries()) {
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
    const currentCount = this.retryCounts.get(taskId) || 0;
    this.retryCounts.set(taskId, currentCount + 1);
  }

  /**
   * Get the status of a task.
   * @param taskId - The ID of the task.
   * @returns The status of the task.
   */
  getStatus(taskId: string): TaskStatus {
    const task = this.tasks.get(taskId);
    return task ? task.status : 'not_found';
  }

  /**
   * Get the result of a completed task.
   * @param taskId - The ID of the task.
   * @returns The result of the task.
   * @throws Error if task not found or not completed.
   */
  async getResult(taskId: string): Promise<unknown> {
    const task = this.tasks.get(taskId);
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
    return this.retryCounts.get(taskId) || 0;
  }

  /**
   * Check if all tasks are completed.
   * @returns True if all tasks are completed or failed, False otherwise.
   */
  allTasksCompleted(): boolean {
    for (const taskId of this.tasks.keys()) {
      const status = this.getStatus(taskId);
      if (status === 'running' || status === 'pending') {
        return false;
      }
    }
    return true;
  }

  /**
   * Clean up completed and failed tasks that are no longer needed.
   * Removes tasks that:
   * - Are completed or failed
   * - Have no dependent children
   */
  private cleanupTaskRetryMaps(): void {
    const tasksToRemove: string[] = [];

    // Build children map
    const childrenMap = new Map<string, number>();
    for (const task of this.tasks.values()) {
      if (task.parentTaskId) {
        childrenMap.set(
          task.parentTaskId,
          (childrenMap.get(task.parentTaskId) || 0) + 1
        );
      }
    }

    // Check tasks
    for (const [taskId, task] of this.tasks.entries()) {
      if (
        (task.status === 'completed' || task.status === 'failed') &&
        !childrenMap.has(taskId)
      ) {
        tasksToRemove.push(taskId);
      }
    }

    // Remove tasks
    for (const taskId of tasksToRemove) {
      this.tasks.delete(taskId);
      this.retryCounts.delete(taskId);
    }

    if (tasksToRemove.length > 0) {
      console.debug(
        `TaskHandler: Cleaned up ${tasksToRemove.length} completed/failed task(s)`
      );
    }
  }

  /**
   * Terminate the task handler and clean up resources.
   * In Node.js, this is mainly for cleanup and doesn't need to stop a thread pool.
   */
  terminate(): void {
    // Clear all tasks and retry counts
    this.tasks.clear();
    this.retryCounts.clear();
  }
}
