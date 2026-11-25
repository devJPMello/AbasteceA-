import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createStationSchema,
  nearbyQuerySchema,
  priceHistoryQuerySchema,
} from '@bomba-certa/shared';
import { createZodDto } from 'nestjs-zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StationsService } from './stations.service';

class CreateStationDto extends createZodDto(createStationSchema) {}
class NearbyQueryDto extends createZodDto(nearbyQuerySchema) {}
class PriceHistoryQueryDto extends createZodDto(priceHistoryQuerySchema) {}

@ApiTags('stations')
@Controller('stations')
export class StationsController {
  constructor(private readonly stations: StationsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register a station' })
  create(@Body() dto: CreateStationDto) {
    return this.stations.create(dto);
  }

  // Declared before ':id' so "nearby" is not parsed as an id.
  @Get('nearby')
  @ApiOperation({
    summary: 'Stations within a radius, sorted by price or distance',
    description: 'Uses PostGIS ST_DWithin on a geography(Point,4326) column with a GIST index.',
  })
  nearby(@Query() query: NearbyQueryDto) {
    return this.stations.findNearby(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Station details with current prices' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.stations.findOne(id);
  }

  @Get(':id/price-history')
  @ApiOperation({ summary: 'Active price reports over time for one fuel (for charts)' })
  history(@Param('id', ParseUUIDPipe) id: string, @Query() query: PriceHistoryQueryDto) {
    return this.stations.history(id, query);
  }

  @Get(':id/pending-reports')
  @ApiOperation({ summary: 'Reports awaiting confirmation at this station' })
  pending(@Param('id', ParseUUIDPipe) id: string) {
    return this.stations.pendingReports(id);
  }
}
