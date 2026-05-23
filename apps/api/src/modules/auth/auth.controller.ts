import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(
    @Body() body: { email: string; password: string; fullName: string; branchId: string }
  ) {
    return this.authService.register(body.email, body.password, body.fullName, body.branchId);
  }
}
