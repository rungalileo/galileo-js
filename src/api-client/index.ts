// Export the main client
export { GalileoApiClient, GalileoApiClientParams } from './galileo-client';

// Export service types if needed
export { ProjectService } from './services/project-service';
export { LogStreamService } from './services/logstream-service';
export {
  DatasetService,
  DatasetRow,
  DatasetContent,
  Dataset,
  DatasetFormat,
  ListDatasetResponse
} from './services/dataset-service';
export { TraceService } from './services/trace-service';

// Export any enums or types that might be needed
export { RequestMethod } from './base-client';
