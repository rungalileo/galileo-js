import { http, HttpResponse } from 'msw';
export const TEST_HOST = 'http://localhost:8088';

export const commonHandlers = [
  http.get(`${TEST_HOST}/healthcheck`, () =>
    HttpResponse.json({ status: 'ok' })
  ),

  http.post(`${TEST_HOST}/login/api_key`, () =>
    HttpResponse.json({
      access_token: 'placeholder'
    })
  )
];
