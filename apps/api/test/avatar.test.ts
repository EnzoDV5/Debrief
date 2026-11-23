// Uploading your own profile photo: only real images, only yours, and it wins over the Google photo.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { detectImageType } from '../src/lib/imageType';
import { authRepository } from '../src/modules/auth/auth.repository';
import { closeDatabase, resetDatabase, signUp, testAppDeps, WEB_ORIGIN } from './helpers';

// A real 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase();
  app = createApp(testAppDeps);
});

afterAll(closeDatabase);

const me = (cookie: string) => request(app).get('/api/auth/me').set('Cookie', cookie);

const upload = (cookie: string, file: Buffer, contentType = 'image/png') =>
  request(app)
    .put('/api/auth/me/avatar')
    .set('Origin', WEB_ORIGIN)
    .set('Cookie', cookie)
    .attach('file', file, { filename: 'avatar', contentType });

describe('profile photo upload', () => {
  it('stores the photo, points avatarUrl at it, and serves it back', async () => {
    const cookie = await signUp(app, 'Alice');
    expect((await me(cookie)).body.user).toMatchObject({
      avatarUrl: null,
      hasUploadedAvatar: false,
    });

    const res = await upload(cookie, PNG);
    expect(res.status).toBe(200);
    expect(res.body.user.hasUploadedAvatar).toBe(true);
    expect(res.body.user.avatarUrl).toMatch(/^\/api\/auth\/me\/avatar\?v=\d+$/);

    const photo = await request(app).get(res.body.user.avatarUrl).set('Cookie', cookie);
    expect(photo.status).toBe(200);
    expect(photo.headers['content-type']).toBe('image/png');
    expect(photo.headers['cache-control']).toContain('private');
    expect(Buffer.compare(photo.body as Buffer, PNG)).toBe(0);
  });

  it('uses the file contents, not the claimed type, to decide what it is', async () => {
    const cookie = await signUp(app, 'Alice');
    const fake = await upload(cookie, Buffer.from('<svg onload="alert(1)"></svg>'), 'image/png');
    expect(fake.status).toBe(400);
    expect(fake.body.error.code).toBe('INVALID_IMAGE');

    const real = await upload(cookie, PNG, 'text/plain');
    expect(real.status).toBe(200);
  });

  it('refuses photos over the size cap and requests without a file', async () => {
    const cookie = await signUp(app, 'Alice');
    const big = Buffer.concat([PNG, Buffer.alloc(600 * 1024)]);
    expect((await upload(cookie, big)).status).toBe(413);

    const empty = await request(app)
      .put('/api/auth/me/avatar')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', cookie);
    expect(empty.status).toBe(400);
  });

  it('needs you to be signed in, and only ever serves your own photo', async () => {
    expect((await request(app).get('/api/auth/me/avatar')).status).toBe(401);
    expect(
      (
        await request(app)
          .put('/api/auth/me/avatar')
          .set('Origin', WEB_ORIGIN)
          .attach('file', PNG, 'avatar')
      ).status,
    ).toBe(401);

    const alice = await signUp(app, 'Alice');
    const bob = await signUp(app, 'Bob');
    await upload(alice, PNG);
    expect((await request(app).get('/api/auth/me/avatar').set('Cookie', bob)).status).toBe(404);
  });

  it('wins over the Google photo, and removing it brings the Google photo back', async () => {
    const cookie = await signUp(app, 'Alice');
    const { id } = (await me(cookie)).body.user;
    await authRepository.updateGoogleAvatarUrl(id, 'https://lh3.googleusercontent.com/a/alice');
    expect((await me(cookie)).body.user.avatarUrl).toBe(
      'https://lh3.googleusercontent.com/a/alice',
    );

    await upload(cookie, PNG);
    expect((await me(cookie)).body.user.avatarUrl).toMatch(/^\/api\/auth\/me\/avatar/);

    // A later Google sign-in only refreshes the Google URL; the uploaded photo still wins.
    await authRepository.updateGoogleAvatarUrl(id, 'https://lh3.googleusercontent.com/a/alice-2');
    expect((await me(cookie)).body.user.avatarUrl).toMatch(/^\/api\/auth\/me\/avatar/);

    const removed = await request(app)
      .delete('/api/auth/me/avatar')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.user).toMatchObject({
      avatarUrl: 'https://lh3.googleusercontent.com/a/alice-2',
      hasUploadedAvatar: false,
    });
    expect((await request(app).get('/api/auth/me/avatar').set('Cookie', cookie)).status).toBe(404);
  });

  it('refuses uploads from another site', async () => {
    const cookie = await signUp(app, 'Alice');
    const res = await request(app)
      .put('/api/auth/me/avatar')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .attach('file', PNG, 'avatar');
    expect(res.status).toBe(403);
  });
});

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP by their first bytes, and nothing else', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))).toBe('image/webp');
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.from('<svg/>'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
