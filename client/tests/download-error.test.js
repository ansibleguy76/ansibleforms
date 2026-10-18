// A download is read as bytes (lib/Helpers.js downloadFile), so the server's JSON error arrived
// as an ArrayBuffer and parseAxiosResponseError found no message in it : every failed download
// showed "Request failed with status code 403". The body is decoded before the error goes on.
import { test, expect } from 'vitest';
import Helpers from '@/lib/Helpers';

const bytes = (text) => new TextEncoder().encode(text).buffer;
const axiosError = (data) => ({ message: 'Request failed with status code 403', response: { status: 403, data } });

test('a JSON error body is read back, so its reason can be shown', () => {
  const err = Helpers.decodeArrayBufferError(axiosError(bytes('{"error":"No access to this job"}')));
  expect(err.response.data).toEqual({ error: 'No access to this job' });
  expect(Helpers.parseAxiosResponseError(err, 'fallback')).toBe('No access to this job');
});

test('an html error page gives no reason : the translated fallback is shown', () => {
  const err = Helpers.decodeArrayBufferError(axiosError(bytes('<html><body>Bad gateway</body></html>')));
  expect(Helpers.parseAxiosResponseError(err, 'fallback')).toBe('fallback');
});

test('an empty body gives the fallback too', () => {
  const err = Helpers.decodeArrayBufferError(axiosError(new ArrayBuffer(0)));
  expect(Helpers.parseAxiosResponseError(err, 'fallback')).toBe('fallback');
});

test('an error that was not read as bytes is left as it is', () => {
  const err = axiosError({ error: 'as sent' });
  expect(Helpers.decodeArrayBufferError(err).response.data).toEqual({ error: 'as sent' });
});
