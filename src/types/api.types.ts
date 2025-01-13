/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

export interface paths {
  '/healthcheck': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Healthcheck */
    get: operations['healthcheck_healthcheck_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Login Email */
    post: operations['login_email_login_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/login/api_key': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Login Api Key */
    post: operations['login_api_key_login_api_key_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/projects/{project_id}/prompt_datasets': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Prompt Datasets
     * @deprecated
     */
    get: operations['list_prompt_datasets_projects__project_id__prompt_datasets_get'];
    put?: never;
    /**
     * Upload Prompt Evaluation Dataset
     * @deprecated
     */
    post: operations['upload_prompt_evaluation_dataset_projects__project_id__prompt_datasets_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/datasets': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List Datasets */
    get: operations['list_datasets_datasets_get'];
    put?: never;
    /** Upload Dataset */
    post: operations['upload_dataset_datasets_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/datasets/{dataset_id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get Dataset */
    get: operations['get_dataset_datasets__dataset_id__get'];
    put?: never;
    post?: never;
    /** Delete Dataset */
    delete: operations['delete_dataset_datasets__dataset_id__delete'];
    options?: never;
    head?: never;
    /** Update Dataset */
    patch: operations['update_dataset_datasets__dataset_id__patch'];
    trace?: never;
  };
  '/datasets/query': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Query Datasets */
    post: operations['query_datasets_datasets_query_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/projects/{project_id}/prompt_datasets/{dataset_id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Download Prompt Dataset
     * @deprecated
     */
    get: operations['download_prompt_dataset_projects__project_id__prompt_datasets__dataset_id__get'];
    /**
     * Update Prompt Dataset
     * @deprecated
     */
    put: operations['update_prompt_dataset_projects__project_id__prompt_datasets__dataset_id__put'];
    post?: never;
    /**
     * Delete Prompt Dataset
     * @deprecated
     */
    delete: operations['delete_prompt_dataset_projects__project_id__prompt_datasets__dataset_id__delete'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/datasets/{dataset_id}/content': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get Dataset Content */
    get: operations['get_dataset_content_datasets__dataset_id__content_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /**
     * Update Dataset Content
     * @description Update the content of a dataset.
     *
     *     The `index` and `column_name` fields are treated as keys tied to a specific version of the dataset.
     *     As such, these values are considered immutable identifiers for the dataset's structure.
     *
     *     For example, if an edit operation changes the name of a column, subsequent edit operations in
     *     the same request should reference the column using its original name.
     *
     *     The `If-Match` header is used to ensure that updates are only applied if the client's version of the dataset
     *     matches the server's version. This prevents conflicts from simultaneous updates. The `ETag` header in the response
     *     provides the new version identifier after a successful update.
     */
    patch: operations['update_dataset_content_datasets__dataset_id__content_patch'];
    trace?: never;
  };
  '/datasets/{dataset_id}/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Download Dataset */
    get: operations['download_dataset_datasets__dataset_id__download_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/datasets/{dataset_id}/users': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List User Dataset Collaborators
     * @description List the users with which the dataset has been shared.
     */
    get: operations['list_user_dataset_collaborators_datasets__dataset_id__users_get'];
    put?: never;
    /** Create User Dataset Collaborators */
    post: operations['create_user_dataset_collaborators_datasets__dataset_id__users_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/datasets/{dataset_id}/users/{user_id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /**
     * Delete User Dataset Collaborator
     * @description Remove a user's access to a dataset.
     */
    delete: operations['delete_user_dataset_collaborator_datasets__dataset_id__users__user_id__delete'];
    options?: never;
    head?: never;
    /**
     * Update User Dataset Collaborator
     * @description Update the sharing permissions of a user on a dataset.
     */
    patch: operations['update_user_dataset_collaborator_datasets__dataset_id__users__user_id__patch'];
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    /**
     * ApiKeyAction
     * @enum {string}
     */
    ApiKeyAction: 'update' | 'delete';
    /** ApiKeyLoginRequest */
    ApiKeyLoginRequest: {
      /** Api Key */
      api_key: string;
    };
    /** Body_login_email_login_post */
    Body_login_email_login_post: {
      /** Grant Type */
      grant_type?: string | null;
      /** Username */
      username: string;
      /** Password */
      password: string;
      /**
       * Scope
       * @default
       */
      scope?: string;
      /** Client Id */
      client_id?: string | null;
      /** Client Secret */
      client_secret?: string | null;
    };
    /** Body_update_prompt_dataset_projects__project_id__prompt_datasets__dataset_id__put */
    Body_update_prompt_dataset_projects__project_id__prompt_datasets__dataset_id__put: {
      /** File */
      file?: string | null;
      /** Column Names */
      column_names?: string[] | null;
    };
    /** Body_upload_dataset_datasets_post */
    Body_upload_dataset_datasets_post: {
      /**
       * File
       * Format: binary
       */
      file: string;
    };
    /** Body_upload_prompt_evaluation_dataset_projects__project_id__prompt_datasets_post */
    Body_upload_prompt_evaluation_dataset_projects__project_id__prompt_datasets_post: {
      /**
       * File
       * Format: binary
       */
      file: string;
    };
    /**
     * CollaboratorRole
     * @enum {string}
     */
    CollaboratorRole: 'owner' | 'editor' | 'annotator' | 'viewer';
    /** CollaboratorUpdate */
    CollaboratorUpdate: {
      role: components['schemas']['CollaboratorRole'];
    };
    /**
     * DatasetAction
     * @enum {string}
     */
    DatasetAction: 'update' | 'delete' | 'share' | 'export' | 'rename';
    /** DatasetAddColumn */
    DatasetAddColumn: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      edit_type: 'add_column';
      /** New Column Name */
      new_column_name: string;
      /** Column Values */
      column_values: (string | number | null)[];
    };
    /** DatasetAppendRow */
    DatasetAppendRow: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      edit_type: 'append_row';
      /** Values */
      values: {
        [key: string]: string | number | null;
      };
    };
    /** DatasetContent */
    DatasetContent: {
      /**
       * Starting Token
       * @default 0
       */
      starting_token?: number;
      /**
       * Limit
       * @default 100
       */
      limit?: number;
      /**
       * Paginated
       * @default false
       */
      paginated?: boolean;
      /** Next Starting Token */
      next_starting_token?: number | null;
      /** Column Names */
      column_names?: string[];
      /** Rows */
      rows?: components['schemas']['DatasetRow'][];
    };
    /** DatasetCreatedAtSort */
    DatasetCreatedAtSort: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      name: 'created_at';
      /**
       * Ascending
       * @default true
       */
      ascending?: boolean;
      /**
       * Sort Type
       * @default column
       * @constant
       */
      sort_type?: 'column';
    };
    /** DatasetDB */
    DatasetDB: {
      /**
       * Id
       * Format: uuid4
       */
      id: string;
      /**
       * Permissions
       * @default []
       */
      permissions?: components['schemas']['Permission'][];
      /** Name */
      name: string;
      /**
       * Created At
       * Format: date-time
       */
      created_at: string;
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string;
      /** Project Count */
      project_count: number;
      /** Num Rows */
      num_rows: number | null;
      /** Column Names */
      column_names: string[] | null;
      created_by_user: components['schemas']['UserInfo'] | null;
    };
    /** DatasetDeleteColumn */
    DatasetDeleteColumn: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      edit_type: 'delete_column';
      /** Column Name */
      column_name: string;
    };
    /** DatasetDeleteRow */
    DatasetDeleteRow: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      edit_type: 'delete_row';
      /** Index */
      index: number;
    };
    /**
     * DatasetFormat
     * @enum {string}
     */
    DatasetFormat: 'csv' | 'feather' | 'jsonl';
    /** DatasetNameFilter */
    DatasetNameFilter: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      name: 'name';
      /** Value */
      value: string;
      /**
       * Operator
       * @enum {string}
       */
      operator: 'eq' | 'ne' | 'contains';
    };
    /** DatasetNameSort */
    DatasetNameSort: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      name: 'name';
      /**
       * Ascending
       * @default true
       */
      ascending?: boolean;
      /**
       * Sort Type
       * @default column
       * @constant
       */
      sort_type?: 'column';
    };
    /** DatasetProjectLastUsedAtSort */
    DatasetProjectLastUsedAtSort: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      name: 'project_last_used_at';
      /**
       * Ascending
       * @default true
       */
      ascending?: boolean;
      /**
       * Sort Type
       * @default custom_uuid
       * @constant
       */
      sort_type?: 'custom_uuid';
      /**
       * Value
       * Format: uuid4
       */
      value: string;
    };
    /** DatasetProjectsSort */
    DatasetProjectsSort: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      name: 'project_count';
      /**
       * Ascending
       * @default true
       */
      ascending?: boolean;
      /**
       * Sort Type
       * @default custom
       * @constant
       */
      sort_type?: 'custom';
    };
    /** DatasetRenameColumn */
    DatasetRenameColumn: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      edit_type: 'rename_column';
      /** Column Name */
      column_name: string;
      /** New Column Name */
      new_column_name: string;
    };
    /** DatasetRow */
    DatasetRow: {
      /** Index */
      index: number;
      /** Values */
      values: (string | number | null)[];
    };
    /** DatasetRowsSort */
    DatasetRowsSort: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      name: 'num_rows';
      /**
       * Ascending
       * @default true
       */
      ascending?: boolean;
      /**
       * Sort Type
       * @default column
       * @constant
       */
      sort_type?: 'column';
    };
    /** DatasetUpdateRow */
    DatasetUpdateRow: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      edit_type: 'update_row';
      /** Index */
      index: number;
      /** Values */
      values: {
        [key: string]: string | number | null;
      };
    };
    /** DatasetUpdatedAtSort */
    DatasetUpdatedAtSort: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      name: 'updated_at';
      /**
       * Ascending
       * @default true
       */
      ascending?: boolean;
      /**
       * Sort Type
       * @default column
       * @constant
       */
      sort_type?: 'column';
    };
    /** DatasetUsedInProjectFilter */
    DatasetUsedInProjectFilter: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      name: 'used_in_project';
      /**
       * Value
       * Format: uuid4
       */
      value: string;
    };
    /**
     * GeneratedScorerAction
     * @enum {string}
     */
    GeneratedScorerAction: 'update' | 'delete';
    /**
     * GroupAction
     * @enum {string}
     */
    GroupAction: 'update' | 'list_members' | 'join' | 'request_to_join';
    /**
     * GroupMemberAction
     * @enum {string}
     */
    GroupMemberAction: 'update_role' | 'delete';
    /** HTTPValidationError */
    HTTPValidationError: {
      /** Detail */
      detail?: components['schemas']['ValidationError'][];
    };
    /** HealthcheckResponse */
    HealthcheckResponse: {
      /** Api Version */
      api_version: string;
      /** Message */
      message: string;
      /** Version */
      version: string;
    };
    /** ListDatasetParams */
    ListDatasetParams: {
      /** Filters */
      filters?: (
        | components['schemas']['DatasetNameFilter']
        | components['schemas']['DatasetUsedInProjectFilter']
      )[];
      /**
       * Sort
       * @default {
       *       "name": "created_at",
       *       "ascending": false,
       *       "sort_type": "column"
       *     }
       */
      sort?:
        | (
            | components['schemas']['DatasetNameSort']
            | components['schemas']['DatasetCreatedAtSort']
            | components['schemas']['DatasetUpdatedAtSort']
            | components['schemas']['DatasetProjectLastUsedAtSort']
            | components['schemas']['DatasetProjectsSort']
            | components['schemas']['DatasetRowsSort']
          )
        | null;
    };
    /** ListDatasetResponse */
    ListDatasetResponse: {
      /**
       * Starting Token
       * @default 0
       */
      starting_token?: number;
      /**
       * Limit
       * @default 100
       */
      limit?: number;
      /**
       * Paginated
       * @default false
       */
      paginated?: boolean;
      /** Next Starting Token */
      next_starting_token?: number | null;
      /** Datasets */
      datasets?: components['schemas']['DatasetDB'][];
    };
    /** ListPromptDatasetResponse */
    ListPromptDatasetResponse: {
      /**
       * Starting Token
       * @default 0
       */
      starting_token?: number;
      /**
       * Limit
       * @default 100
       */
      limit?: number;
      /**
       * Paginated
       * @default false
       */
      paginated?: boolean;
      /** Next Starting Token */
      next_starting_token?: number | null;
      /** Datasets */
      datasets?: components['schemas']['PromptDatasetDB'][];
    };
    /** ListUserCollaboratorsResponse */
    ListUserCollaboratorsResponse: {
      /**
       * Starting Token
       * @default 0
       */
      starting_token?: number;
      /**
       * Limit
       * @default 100
       */
      limit?: number;
      /**
       * Paginated
       * @default false
       */
      paginated?: boolean;
      /** Next Starting Token */
      next_starting_token?: number | null;
      /** Collaborators */
      collaborators: components['schemas']['UserCollaborator'][];
    };
    /** Permission */
    Permission: {
      /** Action */
      action:
        | components['schemas']['UserAction']
        | components['schemas']['GroupAction']
        | components['schemas']['GroupMemberAction']
        | components['schemas']['ProjectAction']
        | components['schemas']['RegisteredScorerAction']
        | components['schemas']['ApiKeyAction']
        | components['schemas']['GeneratedScorerAction']
        | components['schemas']['DatasetAction'];
      /** Allowed */
      allowed: boolean;
      /** Message */
      message?: string | null;
    };
    /**
     * ProjectAction
     * @enum {string}
     */
    ProjectAction:
      | 'update'
      | 'delete'
      | 'rename'
      | 'share'
      | 'create_run'
      | 'delete_run'
      | 'rename_run'
      | 'move_run'
      | 'export_data'
      | 'configure_human_feedback'
      | 'record_human_feedback'
      | 'log_data'
      | 'toggle_metric'
      | 'edit_alert'
      | 'create_stage'
      | 'edit_stage'
      | 'configure_crown_logic'
      | 'delete_data'
      | 'set_metric'
      | 'edit_run_tags'
      | 'dismiss_alert'
      | 'edit_slice'
      | 'edit_edit';
    /** PromptDatasetDB */
    PromptDatasetDB: {
      /**
       * Id
       * Format: uuid4
       */
      id: string;
      /**
       * Dataset Id
       * Format: uuid4
       */
      dataset_id: string;
      /** File Name */
      file_name?: string | null;
      /** Message */
      message?: string | null;
      /** Num Rows */
      num_rows?: number | null;
      /** Rows */
      rows?: number | null;
    };
    /**
     * RegisteredScorerAction
     * @enum {string}
     */
    RegisteredScorerAction: 'update' | 'delete';
    /** Token */
    Token: {
      /** Access Token */
      access_token: string;
      /**
       * Token Type
       * @default bearer
       */
      token_type?: string;
    };
    /** UpdateDatasetContentRequest */
    UpdateDatasetContentRequest: {
      /** Edits */
      edits: (
        | components['schemas']['DatasetAppendRow']
        | components['schemas']['DatasetUpdateRow']
        | components['schemas']['DatasetDeleteRow']
        | components['schemas']['DatasetDeleteColumn']
        | components['schemas']['DatasetRenameColumn']
        | components['schemas']['DatasetAddColumn']
      )[];
    };
    /** UpdateDatasetRequest */
    UpdateDatasetRequest: {
      /** Name */
      name?: string | null;
    };
    /**
     * UserAction
     * @enum {string}
     */
    UserAction: 'update' | 'delete' | 'read_api_keys';
    /** UserCollaborator */
    UserCollaborator: {
      /**
       * Id
       * Format: uuid4
       */
      id: string;
      /**
       * Permissions
       * @default []
       */
      permissions?: components['schemas']['Permission'][];
      role: components['schemas']['CollaboratorRole'];
      /**
       * Created At
       * Format: date-time
       */
      created_at: string;
      /**
       * User Id
       * Format: uuid4
       */
      user_id: string;
      /** First Name */
      first_name: string | null;
      /** Last Name */
      last_name: string | null;
      /** Email */
      email: string;
    };
    /** UserCollaboratorCreate */
    UserCollaboratorCreate: {
      /** @default viewer */
      role?: components['schemas']['CollaboratorRole'];
      /**
       * User Id
       * Format: uuid4
       */
      user_id: string;
    };
    /**
     * UserInfo
     * @description A user's basic information, used for display purposes.
     */
    UserInfo: {
      /**
       * Id
       * Format: uuid4
       */
      id: string;
      /**
       * Email
       * Format: email
       */
      email: string;
      /** First Name */
      first_name?: string | null;
      /** Last Name */
      last_name?: string | null;
    };
    /** ValidationError */
    ValidationError: {
      /** Location */
      loc: (string | number)[];
      /** Message */
      msg: string;
      /** Error Type */
      type: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  healthcheck_healthcheck_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HealthcheckResponse'];
        };
      };
    };
  };
  login_email_login_post: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/x-www-form-urlencoded': components['schemas']['Body_login_email_login_post'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Token'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  login_api_key_login_api_key_post: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ApiKeyLoginRequest'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Token'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_prompt_datasets_projects__project_id__prompt_datasets_get: {
    parameters: {
      query?: {
        starting_token?: number;
        limit?: number;
      };
      header?: never;
      path: {
        project_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ListPromptDatasetResponse'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  upload_prompt_evaluation_dataset_projects__project_id__prompt_datasets_post: {
    parameters: {
      query?: {
        format?: components['schemas']['DatasetFormat'];
      };
      header?: never;
      path: {
        project_id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': components['schemas']['Body_upload_prompt_evaluation_dataset_projects__project_id__prompt_datasets_post'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PromptDatasetDB'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_datasets_datasets_get: {
    parameters: {
      query?: {
        starting_token?: number;
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ListDatasetResponse'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  upload_dataset_datasets_post: {
    parameters: {
      query?: {
        format?: components['schemas']['DatasetFormat'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': components['schemas']['Body_upload_dataset_datasets_post'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DatasetDB'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_dataset_datasets__dataset_id__get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DatasetDB'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  delete_dataset_datasets__dataset_id__delete: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_dataset_datasets__dataset_id__patch: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateDatasetRequest'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DatasetDB'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  query_datasets_datasets_query_post: {
    parameters: {
      query?: {
        starting_token?: number;
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: {
      content: {
        'application/json': components['schemas']['ListDatasetParams'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ListDatasetResponse'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  download_prompt_dataset_projects__project_id__prompt_datasets__dataset_id__get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        project_id: string;
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_prompt_dataset_projects__project_id__prompt_datasets__dataset_id__put: {
    parameters: {
      query?: {
        file_name?: string | null;
        num_rows?: number | null;
        format?: components['schemas']['DatasetFormat'];
      };
      header?: never;
      path: {
        project_id: string;
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        'multipart/form-data': components['schemas']['Body_update_prompt_dataset_projects__project_id__prompt_datasets__dataset_id__put'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PromptDatasetDB'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  delete_prompt_dataset_projects__project_id__prompt_datasets__dataset_id__delete: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        project_id: string;
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_dataset_content_datasets__dataset_id__content_get: {
    parameters: {
      query?: {
        starting_token?: number;
        limit?: number;
      };
      header?: never;
      path: {
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DatasetContent'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_dataset_content_datasets__dataset_id__content_patch: {
    parameters: {
      query?: never;
      header?: {
        /**
         * @description ETag of the dataset as a version identifier.
         * @example d89cce33-549d-4b6d-b220-afb641d859c8
         */
        'If-Match'?: string | null;
      };
      path: {
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateDatasetContentRequest'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  download_dataset_datasets__dataset_id__download_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_user_dataset_collaborators_datasets__dataset_id__users_get: {
    parameters: {
      query?: {
        starting_token?: number;
        limit?: number;
      };
      header?: never;
      path: {
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ListUserCollaboratorsResponse'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  create_user_dataset_collaborators_datasets__dataset_id__users_post: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        dataset_id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['UserCollaboratorCreate'][];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['UserCollaborator'][];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  delete_user_dataset_collaborator_datasets__dataset_id__users__user_id__delete: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        dataset_id: string;
        user_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_user_dataset_collaborator_datasets__dataset_id__users__user_id__patch: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        dataset_id: string;
        user_id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CollaboratorUpdate'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['UserCollaborator'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
}
