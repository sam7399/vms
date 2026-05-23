import {
  Controller,
  Post,
  Body,
  HttpCode,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

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
}
