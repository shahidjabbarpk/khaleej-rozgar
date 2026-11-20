/**
 * Background detector. Imported at module scope from the root layout so the task is defined
 * before Android wakes the JS runtime headlessly (about every 30 minutes).
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { BACKGROUND_INTERVAL_MIN, BACKGROUND_TASK } from './config';
import { reportedByMe } from './detect';
import { refreshJobs } from './feed';
import { notifyNewJobs } from './notify';
import { useApp, waitForHydration } from './store';

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    await waitForHydration();
    // feed jobs reach everyone as FCM topic pushes; a local alert only for jobs this phone alone
    // found and could not hand to the Worker (no Worker / offline Worker)
    const { fresh, phoneOnly } = await refreshJobs();
    // no topics (Firebase not set up / Play services missing): this phone alerts itself for everything
    if (!useApp.getState().subscribedTopics.length) await notifyNewJobs(fresh);
    else await notifyNewJobs(phoneOnly, reportedByMe);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundDetector(): Promise<void> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)) return;
  await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: BACKGROUND_INTERVAL_MIN });
}
