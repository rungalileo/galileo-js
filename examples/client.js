import { ApiClient } from "@rungalileo/observe";

const apiClient = new ApiClient();
await apiClient.init("llm_monitor_test_1");

const filters = [
    { "col_name": "model", "operator": "eq", "value": "gpt-3.5-turbo" },
]

const sort_spec = [
    { "col_name": "created_at", "sort_dir": "asc" }
]

const rows = await apiClient.getLoggedData(
    "2024-03-11T16:15:28.294Z",
    "2024-03-12T16:15:28.294Z",
    filters,
    sort_spec
);
console.log(rows);

const metrics = await apiClient.getMetrics(
    "2024-03-11T16:15:28.294Z",
    "2024-03-12T16:15:28.294Z",
    filters
);
console.log(metrics);
