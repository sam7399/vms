import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  HttpCode,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }) {
    if (!body?.email || !body?.password) {
      throw new BadRequestException('email and password are required');
    }
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(
    @Body() body: { email: string; password: string; fullName: string; branchId: string },
  ) {
    if (!body?.email || !body?.password || !body?.fullName || !body?.branchId) {
      throw new BadRequestException(
        'email, password, fullName and branchId are required',
      );
    }
    if (body.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    try {
      return await this.authService.register(
        body.email,
        body.password,
        body.fullName,
        body.branchId,
      );
    } catch (e: any) {
      // Prisma unique constraint
      if (e?.code === 'P2002') {
        throw new BadRequestException('Email already registered');
      }
      throw e;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    const me = await this.authService.me(user.userId);
    if (!me) throw new UnauthorizedException('User no longer exists');
    return me;
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    if (!body?.currentPassword || !body?.newPassword) {
      throw new BadRequestException('currentPassword and newPassword are required');
    }
    if (body.newPassword.length < 6) {
      throw new BadRequestException('newPassword must be at least 6 characters');
    }
    try {
      return await this.authService.changePassword(
        user.userId,
        body.currentPassword,
        body.newPassword,
      );
    } catch (e: any) {
      if (e?.message === 'Current password is incorrect') {
        throw new UnauthorizedException(e.message);
      }
      throw new BadRequestException(e?.message ?? 'Could not change password');
    }
  }
}
