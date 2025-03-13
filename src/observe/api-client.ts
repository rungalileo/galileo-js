import { GalileoLegacyApiClient, RequestMethod } from '../legacy-api-client';
import { ProjectTypes } from '../types/project.types';
import { Routes } from '../types/routes.types';
import { TransactionRecordBatch } from '../types/transaction.types';

/**
 * @deprecated This class is no longer actively maintained. Please use `GalileoApiClient` instead.
 */
export default class GalileoObserveApiClient extends GalileoLegacyApiClient {
  constructor() {
    super();
    this.type = ProjectTypes.observe;
  }

  // TODO: This should have a more accurate return type
  public async getLoggedData(
    start_time: string,
    end_time: string,
    filters: Array<unknown> = [],
    sort_spec: Array<unknown> = [],
    limit?: number,
    offset?: number,
    include_chains?: boolean,
    chain_id?: string
  ): Promise<Record<string, unknown>> {
    return await this.makeRequest(
      RequestMethod.POST,
      Routes.observeRows,
      {
        filters,
        sort_spec
      },
      {
        start_time,
        end_time,
        chain_id,
        limit,
        offset,
        include_chains
      }
    );
  }

  // TODO: This should have a more accurate return type
  public async getMetrics(
    start_time: string,
    end_time: string,
    filters: Array<unknown> = [],
    interval?: number,
    group_by?: string
  ): Promise<Record<string, unknown>> {
    return await this.makeRequest(
      RequestMethod.POST,
      Routes.observeMetrics,
      {
        filters
      },
      {
        start_time,
        end_time,
        interval,
        group_by
      }
    );
  }

  // TODO: This should have a more accurate return type
  public async deleteLoggedData(
    filters: Array<unknown> = []
  ): Promise<Record<string, unknown>> {
    return await this.makeRequest(RequestMethod.POST, Routes.observeDelete, {
      filters
    });
  }

  public async ingestBatch(
    transaction_batch: TransactionRecordBatch
  ): Promise<string> {
    return await this.makeRequest(
      RequestMethod.POST,
      Routes.observeIngest,
      transaction_batch
    );
  }
}
