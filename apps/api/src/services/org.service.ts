import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import type { InviteMemberInput } from '@pulseboard/shared';

const INVITE_EXPIRY_HOURS = 24;

export class OrgService {
  async getOrg(organizationId: string) {
    return db('organizations')
      .where({ id: organizationId, deleted_at: null })
      .first('id', 'name', 'slug', 'plan', 'created_at');
  }

  async updateOrg(organizationId: string, name: string, _actorId: string) {
    const [updated] = await db('organizations')
      .where({ id: organizationId, deleted_at: null })
      .update({ name, updated_at: db.fn.now() })
      .returning(['id', 'name', 'slug', 'plan']);
    return updated ?? null;
  }

  async listMembers(organizationId: string) {
    return db('organization_members as om')
      .join('users as u', 'u.id', 'om.user_id')
      .where({ 'om.organization_id': organizationId, 'om.deleted_at': null, 'u.deleted_at': null })
      .select(
        'om.id',
        'u.id as userId',
        'u.name',
        'u.email',
        'u.avatar_url as avatarUrl',
        'om.role',
        'om.created_at as joinedAt'
      );
  }

  async removeMember(organizationId: string, targetUserId: string, actorId: string) {
    if (targetUserId === actorId) {
      throw Object.assign(new Error('Cannot remove yourself'), { statusCode: 400 });
    }
    const affected = await db('organization_members')
      .where({ organization_id: organizationId, user_id: targetUserId, deleted_at: null })
      .update({ deleted_at: db.fn.now() });
    if (!affected) {
      throw Object.assign(new Error('Member not found'), { statusCode: 404 });
    }
  }

  async inviteMember(organizationId: string, input: InviteMemberInput, actorId: string) {
    const existing = await db('users as u')
      .join('organization_members as om', function () {
        this.on('om.user_id', 'u.id')
          .andOn('om.organization_id', db.raw('?', [organizationId]))
          .andOnNull('om.deleted_at');
      })
      .where({ 'u.email': input.email, 'u.deleted_at': null })
      .first('u.id');

    if (existing) {
      throw Object.assign(new Error('User is already a member'), { statusCode: 409 });
    }

    // Invalidate any pending invite for this email+org
    await db('invite_tokens')
      .where({ organization_id: organizationId, email: input.email })
      .whereNull('accepted_at')
      .update({ accepted_at: db.fn.now() });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    await db('invite_tokens').insert({
      id: uuidv4(),
      organization_id: organizationId,
      email: input.email,
      role: input.role,
      token,
      expires_at: expiresAt,
      created_by: actorId,
    });

    return { token, expiresAt };
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await db('invite_tokens')
      .where({ token })
      .whereNull('accepted_at')
      .where('expires_at', '>', db.fn.now())
      .first('id', 'organization_id', 'email', 'role');

    if (!invite) {
      throw Object.assign(new Error('Invite token is invalid or expired'), { statusCode: 400 });
    }

    const user = await db('users').where({ id: userId, deleted_at: null }).first('email');
    if (!user || user.email !== invite.email) {
      throw Object.assign(new Error('This invite was sent to a different email address'), { statusCode: 403 });
    }

    await db.transaction(async (trx) => {
      await trx('organization_members').insert({
        id: uuidv4(),
        organization_id: invite.organization_id,
        user_id: userId,
        role: invite.role,
        invited_by: null,
      });
      await trx('invite_tokens')
        .where({ id: invite.id })
        .update({ accepted_at: trx.fn.now() });
    });

    return { organizationId: invite.organization_id };
  }
}
