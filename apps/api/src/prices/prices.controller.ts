import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createPriceReportSchema } from '@bomba-certa/shared';
import { createZodDto } from 'nestjs-zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PricesService } from './prices.service';

class CreatePriceReportDto extends createZodDto(createPriceReportSchema) {}

@ApiTags('prices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prices/reports')
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Post()
  @ApiOperation({
    summary: 'Report a fuel price at a station',
    description:
      'Limited to one report per user, station and fuel every 6 hours (429). ' +
      'Prices far from the city median are stored as PENDING until confirmed by other users.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePriceReportDto) {
    return this.prices.createReport(user.id, dto);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: "Confirm another user's report" })
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.prices.confirmReport(user.id, id);
  }
}
