import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import type { Redis } from 'ioredis';
import db from '../db/index.js';
import type { RegisterInput, LoginInput } from '@pulseboard/shared';

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const SALT_ROUNDS = 12;

export class AuthService {
  constructor(private redis: Redis) {}

  async register(input: RegisterInput) {
    const existing = await db('users').where({ email: input.email }).first('id');
    if (existing) {
      throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
    }

    const slugTaken = await db('organizations').where({ slug: input.organizationSlug }).first('id');
    if (slugTaken) {
      throw Object.assign(new Error('Organization slug already in use'), { statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const userId = uuidv4();
    const orgId = uuidv4();

    await db.transaction(async (trx) => {
      await trx('users').insert({
        id: userId,
        email: input.email,
        name: input.name,
        password_hash: passwordHash,
      });
      await trx('organizations').insert({
        id: orgId,
        name: input.organizationName,
        slug: input.organizationSlug,
        plan: 'FREE',
      });
      await trx('organization_members').insert({
        id: uuidv4(),
        organization_id: orgId,
        user_id: userId,
        role: 'ORG_ADMIN',
      });
    });

    return { userId, orgId };
  }

  async login(input: LoginInput) {
    const user = await db('users')
      .where({ email: input.email, deleted_at: null })
      .first('id', 'email', 'name', 'password_hash');

    if (!user || !user.password_hash) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    const valid = await bcrypt.compare(input.password, user.password_hash);
    if (!valid) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    const membership = await db('organization_members')
      .where({ user_id: user.id, deleted_at: null })
      .orderBy('created_at', 'asc')
      .first('organization_id', 'role');

    if (!membership) {
      throw Object.assign(new Error('User has no organization'), { statusCode: 403 });
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organization_id,
      orgRole: membership.role as 'ORG_ADMIN' | 'ORG_MEMBER',
    };
  }

  // A user's JWT is always scoped to a single organisation (login() picks the oldest
  // membership). Without this, a user invited into a second org after registering
  // could never obtain a token scoped to it — their own org from registration is
  // always older. listOrganizations()/switchOrganization() let the frontend show a
  // picker and reissue a token for whichever membership the user selects.
  async listOrganizations(userId: string) {
    return db('organization_members as om')
      .join('organizations as o', 'o.id', 'om.organization_id')
      .where({ 'om.user_id': userId, 'om.deleted_at': null, 'o.deleted_at': null })
      .orderBy('om.created_at', 'asc')
      .select('o.id as organizationId', 'o.name', 'om.role as orgRole');
  }

  async switchOrganization(userId: string, organizationId: string) {
    const user = await db('users').where({ id: userId, deleted_at: null }).first('id', 'email', 'name');
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 401 });
    }

    const membership = await db('organization_members')
      .where({ user_id: userId, organization_id: organizationId, deleted_at: null })
      .first('organization_id', 'role');

    if (!membership) {
      throw Object.assign(new Error('You are not a member of that organisation'), { statusCode: 403 });
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organization_id,
      orgRole: membership.role as 'ORG_ADMIN' | 'ORG_MEMBER',
    };
  }

  async createRefreshJti(userId: string): Promise<string> {
    const jti = randomBytes(32).toString('hex');
    // jti lives in Redis only — there is no refresh_tokens table. A Redis flush
    // (e.g. during incident response) terminates all active sessions immediately.
    await this.redis.setex(`refresh:${userId}:${jti}`, REFRESH_TTL_SECONDS, '1');
    return jti;
  }

  async validateRefreshJti(userId: string, jti: string): Promise<boolean> {
    const val = await this.redis.get(`refresh:${userId}:${jti}`);
    return val === '1';
  }

  async rotateRefreshJti(userId: string, oldJti: string): Promise<string> {
    // Atomic pipeline: revoke old jti and issue new one in a single round-trip.
    // Without atomicity a race between two concurrent refresh calls could leave
    // both tokens valid briefly.
    const pipeline = this.redis.pipeline();
    pipeline.del(`refresh:${userId}:${oldJti}`);
    const newJti = randomBytes(32).toString('hex');
    pipeline.setex(`refresh:${userId}:${newJti}`, REFRESH_TTL_SECONDS, '1');
    await pipeline.exec();
    return newJti;
  }

  async revokeRefreshJti(userId: string, jti: string): Promise<void> {
    await this.redis.del(`refresh:${userId}:${jti}`);
  }

  async getUserForToken(userId: string) {
    const user = await db('users').where({ id: userId, deleted_at: null }).first('id', 'email', 'name');
    if (!user) return null;
    const membership = await db('organization_members')
      .where({ user_id: userId, deleted_at: null })
      .orderBy('created_at', 'asc')
      .first('organization_id', 'role');
    if (!membership) return null;
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organization_id,
      orgRole: membership.role as 'ORG_ADMIN' | 'ORG_MEMBER',
    };
  }
}
