import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { registerDeviceSchema } from '@bomba-certa/shared';
import { createZodDto } from 'nestjs-zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class RegisterDeviceDto extends createZodDto(registerDeviceSchema) {}

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Register this device for push notifications',
    description: 'Idempotent. If the token belonged to another account it moves to this one.',
  })
  async register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { token: dto.token, platform: dto.platform, userId: user.id },
      update: { userId: user.id, platform: dto.platform },
    });
  }

  @Delete(':token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Stop receiving push notifications on this device (e.g. on logout)' })
  async unregister(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    // Scoped to the caller: nobody can unregister someone else's device.
    await this.prisma.deviceToken.deleteMany({ where: { token, userId: user.id } });
  }
}
