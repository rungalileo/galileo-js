import { ApiClient } from "@rungalileo/observe";

const apiClient = new ApiClient();
await apiClient.init("fortune500_summaries");

const filters = [
    { "col_name": "created_at", "operator": "gte", "value": "2024-07-19"},
]

const sort_spec = [
    { "col_name": "created_at", "sort_dir": "asc" }
]

// const data = await apiClient.getLoggedData(
//     "2024-03-02T17:48:02.296Z",
//     "2024-04-01T17:48:02.296Z",
//     filters,
//     sort_spec,
//     undefined,
//     undefined,
//     false
// );
// console.log(data["rows"]);


// const metrics = await apiClient.getMetrics(
//     "2024-03-02T17:48:02.296Z",
//     "2024-04-01T17:48:02.296Z",
//     filters,
//     864
// );
// console.log(metrics);

const result = await apiClient.deleteLoggedData(filters);
console.log(result);