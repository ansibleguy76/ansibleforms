import { describe, it, expect, vi, beforeEach } from 'vitest';

// The token refresh (#1062) : when the access token expires, the requests in flight and the
// other tabs all want a new one, with the same single-use refresh token. One refresh runs ; the
// others wait for it, or take the tokens another tab stored, and never throw them away.

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

const axios = (await import('axios')).default;
const TokenStorage = (await import('@/lib/TokenStorage')).default;

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  localStorage.clear();
  axios.post.mockReset();
  TokenStorage.storeToken('access-1');
  TokenStorage.storeRefreshToken('refresh-1');
});

describe('TokenStorage.getNewToken', () => {
  it('refreshes once for requests that fail together, and gives them all the new token', async () => {
    const answer = deferred();
    axios.post.mockReturnValue(answer.promise);
    const calls = [1, 2, 3, 4].map(() => TokenStorage.getNewToken('access-1'));
    answer.resolve({ data: { token: 'access-2', refreshtoken: 'refresh-2' } });
    expect(await Promise.all(calls)).toEqual(['access-2', 'access-2', 'access-2', 'access-2']);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(TokenStorage.getRefreshToken()).toBe('refresh-2');
  });

  it('does not refresh when the failed request was sent with a token already replaced', async () => {
    TokenStorage.storeToken('access-2');
    TokenStorage.storeRefreshToken('refresh-2');
    expect(await TokenStorage.getNewToken('access-1')).toBe('access-2');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('refreshes again for a later expiry', async () => {
    axios.post.mockResolvedValueOnce({ data: { token: 'access-2', refreshtoken: 'refresh-2' } });
    axios.post.mockResolvedValueOnce({ data: { token: 'access-3', refreshtoken: 'refresh-3' } });
    expect(await TokenStorage.getNewToken('access-1')).toBe('access-2');
    expect(await TokenStorage.getNewToken('access-2')).toBe('access-3');
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('on a 409, takes the tokens the concurrent refresh stores', async () => {
    axios.post.mockImplementation(async () => {
      // another tab, outside the lock, rotated it first and stores its tokens shortly after
      setTimeout(() => {
        TokenStorage.storeToken('access-other');
        TokenStorage.storeRefreshToken('refresh-other');
      }, 50);
      throw { response: { status: 409, data: { code: 'refresh_token_replaced' } } };
    });
    expect(await TokenStorage.getNewToken('access-1')).toBe('access-other');
  });

  it('on a refusal, takes tokens stored meanwhile rather than none', async () => {
    axios.post.mockImplementation(async () => {
      TokenStorage.storeToken('access-other');
      TokenStorage.storeRefreshToken('refresh-other');
      throw { response: { status: 401, data: { error: 'Refresh token is unknown' } } };
    });
    expect(await TokenStorage.getNewToken('access-1')).toBe('access-other');
  });

  it('a real refusal : null, and the tokens are left for the caller to clear', async () => {
    axios.post.mockRejectedValue({ response: { status: 401, data: { error: 'Refresh token is unknown' } } });
    expect(await TokenStorage.getNewToken('access-1')).toBeNull();
    expect(TokenStorage.getRefreshToken()).toBe('refresh-1');
  });

  it('marks its request so the 401 interceptor leaves its errors alone', async () => {
    axios.post.mockResolvedValue({ data: { token: 'access-2', refreshtoken: 'refresh-2' } });
    await TokenStorage.getNewToken('access-1');
    expect(axios.post.mock.calls[0][2]).toMatchObject({ __tokenRefresh: true });
  });

  it('without a refresh token : null, no request', async () => {
    TokenStorage.clear();
    expect(await TokenStorage.getNewToken()).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
