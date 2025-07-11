import { components } from './api.types';

export type Job = components['schemas']['JobDB'];

export enum JobStatus {
  pending = 'pending',
  processing = 'processing',
  completed = 'completed',
  failed = 'failed',
  cancelled = 'cancelled'
}

export const isJobIncomplete = (status: JobStatus): boolean => {
  return [JobStatus.pending, JobStatus.processing].includes(status);
};

export const isJobFailed = (status: JobStatus): boolean => {
  return [JobStatus.failed, JobStatus.cancelled].includes(status);
};

export interface RequestData {
  prompt_scorer_settings?: {
    scorer_name?: string;
  };
}