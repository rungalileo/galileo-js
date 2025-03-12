import { LogStream } from '../types/log-stream.types';
import { GalileoApiClient } from '../api-client';

/*
 * Gets all log streams.
 */
export const getLogStreams = async (
  projectName: string
): Promise<LogStream[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.getLogStreams();
};

/*
 * Creates a new log stream.
 */
export const createLogStream = async (
  name: string,
  projectName: string
): Promise<LogStream> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.createLogStream(name);
};

/*
 * Gets a log stream by id or name.
 */
export const getLogStream = async ({
  id,
  name,
  projectName
}: {
  id?: string;
  name?: string;
  projectName: string;
}): Promise<LogStream> => {
  if (!id && !name) {
    throw new Error(
      'To fetch a log stream with `getLogStream`, either id or name must be provided'
    );
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  if (id) {
    return await apiClient.getLogStream(id);
  }

  return await apiClient.getLogStreamByName(name!);
};
