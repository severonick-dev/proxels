import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { PlansService } from './plans.service.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { UpdatePlanDto } from './dto/update-plan.dto.js';

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  // --- публичные эндпоинты (без auth) ---------------------------------------

  @Get()
  list() {
    return this.plans.listActive();
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.plans.findActiveById(id);
  }
}

@Controller('admin/plans')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.listAll();
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.plans.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.plans.create(dto, { actorId: user.id, ip: req.ip });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.plans.update(id, dto, { actorId: user.id, ip: req.ip });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.plans.deactivate(id, { actorId: user.id, ip: req.ip });
  }
}
