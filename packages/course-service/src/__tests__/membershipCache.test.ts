import { jest } from '@jest/globals';
import { createMembershipClient } from '@lms/shared';

// Two replicas: an enrollment made through one must be visible to the other at once.
describe('membership client cache', () => {
  afterEach(() => jest.restoreAllMocks());

  it('re-checks a cached "not a member" but serves cached members', async () => {
    let enrolled = false;
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ data: enrolled ? [{ userId: 'u1', role: 'trainee' }] : [] }),
            { status: 200 }
          )
      );
    const client = createMembershipClient({ userServiceUrl: 'http://users', service: 'test' });

    expect(await client.memberOf('c1', 'u1')).toBeNull();
    enrolled = true; // enrolled through another replica
    expect(await client.memberOf('c1', 'u1')).toMatchObject({ role: 'trainee' });

    const calls = fetchMock.mock.calls.length;
    await client.memberOf('c1', 'u1');
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
