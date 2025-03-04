import { LogStream } from '../types/log-stream.types';
import { GalileoApiClient } from '../api-client';

/*
 * Gets all log streams.
 */
export const getLogStreams = async (): Promise<LogStream[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init();
  return await apiClient.getLogStreams();
};

/*
 * Creates a new log stream.
 */
export const createLogStream = async (name: string): Promise<LogStream> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init();
  return await apiClient.createLogStream(name);
};

/*
 * Gets a log stream by id or name.
 */
export const getLogStream = async (
  projectId: string,
  id?: string,
  name?: string
): Promise<LogStream> => {
  if (!id && !name) {
    throw new Error('Either id or name must be provided');
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId });
  if (id) {
    return await apiClient.getLogStream(id);
  }

  return await apiClient.getLogStreamByName(name!);
};
