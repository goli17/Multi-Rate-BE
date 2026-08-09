import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { rethrowHttpOrWrap } from '../common/errors';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async create(email: string, password: string): Promise<User> {
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const user = this.usersRepo.create({
        email: email.toLowerCase(),
        passwordHash,
        emailVerified: false,
        otpHash: null,
        otpExpiresAt: null,
      });
      const saved = await this.usersRepo.save(user);
      this.logger.log(`Created user ${saved.email}`);
      return saved;
    } catch (error: unknown) {
      rethrowHttpOrWrap(
        error,
        this.logger,
        'create',
        'Could not create user account.',
      );
    }
  }

  save(user: User): Promise<User> {
    return this.usersRepo.save(user);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async requireByEmail(email: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }
}
