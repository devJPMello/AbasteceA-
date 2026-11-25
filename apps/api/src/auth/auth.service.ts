import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { LoginInput, RegisterInput } from '@bomba-certa/shared';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(input: RegisterInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    // A duplicate e-mail raises P2002, mapped to 409 by the global filter.
    const user = await this.prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash },
      select: { id: true, email: true, name: true },
    });
    return { user, ...(await this.issueTokens(user.id, user.email, randomUUID())) };
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Same error for unknown e-mail and wrong password: do not leak which accounts exist.
    const valid = user && (await bcrypt.compare(input.password, user.passwordHash));
    if (!user || !valid) throw new UnauthorizedException('Invalid credentials');
    return {
      user: { id: user.id, email: user.email, name: user.name },
      ...(await this.issueTokens(user.id, user.email, randomUUID())),
    };
  }

  /**
   * Refresh token rotation with reuse detection.
   * Each refresh token is single-use. If an already-revoked token shows up again, it was
   * probably stolen, so every token of that family (login session) is revoked.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { select: { email: true } } },
    });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');

    // Conditional update: only one concurrent request can win the rotation.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    return this.issueTokens(stored.userId, stored.user.email, stored.familyId);
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, email: string, familyId: string): Promise<AuthTokens> {
    const expiresIn = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const accessToken = await this.jwt.signAsync({ sub: userId, email }, { expiresIn });

    // Opaque random token; only its hash is stored, so a DB leak does not expose sessions.
    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });
    return { accessToken, refreshToken, expiresIn };
  }
}
