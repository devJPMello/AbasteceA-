import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createAlertSchema, paginationSchema } from '@bomba-certa/shared';
import { createZodDto } from 'nestjs-zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertsService } from './alerts.service';
import { NotificationsService } from './notifications.service';

class CreateAlertDto extends createZodDto(createAlertSchema) {}
class PaginationDto extends createZodDto(paginationSchema) {}

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post('alerts')
  @ApiOperation({
    summary: 'Create a price alert',
    description:
      'Notifies you when any station within radiusMeters of the point reaches the target price or less. ' +
      'Processed asynchronously by a BullMQ worker.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAlertDto) {
    return this.alerts.create(user.id, dto);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'List my alerts' })
  list(@CurrentUser() user: AuthUser) {
    return this.alerts.list(user.id);
  }

  @Delete('alerts/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one of my alerts' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.alerts.remove(user.id, id);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'My notifications (newest first) with the unread count' })
  notificationsList(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.notifications.list(user.id, q.page, q.pageSize);
  }

  @Post('notifications/:id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
