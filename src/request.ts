import axios, { AxiosResponse, Method } from 'axios';

class HttpHeaders {
  accept = 'accept';
  content_type = 'Content-Type';
  application_json = 'application/json';

  static acceptJson(): Record<string, string> {
    const headers = new HttpHeaders();
    return { [headers.accept]: headers.application_json };
  }

  static json(): Record<string, string> {
    return { ...HttpHeaders.acceptJson(), ...HttpHeaders.contentTypeJson() };
  }

  static contentTypeJson(): Record<string, string> {
    const headers = new HttpHeaders();
    return { [headers.content_type]: headers.application_json };
  }
}

function validateResponse(response: AxiosResponse) {
  if (response.status >= 300) {
    const msg = `Something didn't go quite right. The API returned a non-ok status code ${response.status} with output: ${response.data}`;
    // TODO: Better error handling.
    throw new Error(msg);
  }
}

async function makeRequest<T>(
  requestMethod: Method,
  baseUrl: string,
  endpoint: string,
  body?: object,
  data?: object,
  params?: object,
  headers?: Record<string, string>,
  timeout?: number | null
): Promise<T> {
  const response = await axios<T>(`${baseUrl}${endpoint}`, {
    method: requestMethod,
    headers: {
      ...headers,
      ...HttpHeaders.json()
    },
    data: body || data,
    params,
    timeout: timeout || 60000
  });
  validateResponse(response);
  return response.data;
}

export { HttpHeaders, makeRequest };
