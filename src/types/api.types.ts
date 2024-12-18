export interface PaginatedResponse {
  starting_token: number;
  limit: number;
  paginated: boolean;
  next_starting_token: number | null;
}
