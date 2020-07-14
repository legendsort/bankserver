import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RoleType } from 'common/constants';
import {
  CreateFailedException,
  PinCodeGenerationIncorrectException,
} from 'exceptions';
import { UserAuthEntity, UserEntity } from 'modules/user/entities';
import { UserAuthRepository, UserRepository } from 'modules/user/repositories';
import { UserService } from 'modules/user/services';
import { UtilsService } from 'utils/services';
import { UpdateResult } from 'typeorm';
import { Transactional } from 'typeorm-transactional-cls-hooked';
import { UserConfigService } from './user-config.service';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly _userAuthRepository: UserAuthRepository,
    private readonly _userRepostiory: UserRepository,
    @Inject(forwardRef(() => UserService))
    private readonly _userService: UserService,
    private readonly _userConfigService: UserConfigService,
  ) {}

  @Transactional()
  public async updateLastLoggedDate(
    user: UserEntity,
    isSuccessiveLogged: boolean,
  ): Promise<UserEntity> {
    const {
      userAuth,
      userConfig,
      userAuth: { lastSuccessfulLoggedDate },
      userConfig: { lastPresentLoggedDate },
    } = user;

    if (!isSuccessiveLogged) {
      await this._updateLastFailedLoggedDate(userAuth);
    } else if (isSuccessiveLogged && !lastSuccessfulLoggedDate) {
      await Promise.all([
        this._updateLastSuccessfulLoggedDate(userAuth),
        this._userConfigService.updateLastPresentLoggedDate(userConfig),
      ]);
    } else {
      await Promise.all([
        this._updateLastSuccessfulLoggedDate(userAuth, lastPresentLoggedDate),
        this._userConfigService.updateLastPresentLoggedDate(userConfig),
      ]);
    }

    return this._userService.getUser({ uuid: user.uuid });
  }

  public async updateLastLogoutDate(
    userAuth: UserAuthEntity,
  ): Promise<UpdateResult> {
    const queryBuilder = this._userAuthRepository.createQueryBuilder(
      'userAuth',
    );

    return queryBuilder
      .update()
      .set({ lastLogoutDate: new Date() })
      .where('id = :id', { id: userAuth.id })
      .execute();
  }

  public async updateRole(
    userAuth: UserAuthEntity,
    role: RoleType,
  ): Promise<UpdateResult> {
    const queryBuilder = this._userAuthRepository.createQueryBuilder(
      'userAuth',
    );

    return queryBuilder
      .update()
      .set({ role })
      .where('id = :id', { id: userAuth.id })
      .execute();
  }

  public async updatePassword(
    userAuth: UserAuthEntity,
    password: string,
  ): Promise<UpdateResult> {
    const queryBuilder = this._userAuthRepository.createQueryBuilder(
      'userAuth',
    );

    return queryBuilder
      .update()
      .set({ password })
      .where('id = :id', { id: userAuth.id })
      .execute();
  }

  public async findUserAuth(
    options: Partial<{ pinCode: number; role: RoleType }>,
  ): Promise<UserEntity | undefined> {
    const queryBuilder = this._userRepostiory.createQueryBuilder('user');

    queryBuilder
      .leftJoinAndSelect('user.userAuth', 'userAuth')
      .leftJoinAndSelect('user.userConfig', 'userConfig')
      .leftJoinAndSelect('userConfig.currency', 'currency');

    if (options.pinCode) {
      queryBuilder.orWhere('userAuth.pinCode = :pinCode', {
        pinCode: options.pinCode,
      });
    }

    if (options.role) {
      queryBuilder.orWhere('userAuth.role = :role', { role: options.role });
    }

    return queryBuilder.getOne();
  }

  public async createUserAuth(createdUser): Promise<UserAuthEntity[]> {
    const pinCode = await this._createPinCode();
    const auth = this._userAuthRepository.create({ ...createdUser, pinCode });

    try {
      return this._userAuthRepository.save(auth);
    } catch (error) {
      throw new CreateFailedException(error);
    }
  }

  private async _createPinCode(): Promise<number> {
    const pinCode = this._generatePinCode();
    const user = await this.findUserAuth({ pinCode });

    try {
      return user ? await this._createPinCode() : pinCode;
    } catch (error) {
      throw new PinCodeGenerationIncorrectException(error);
    }
  }

  private _generatePinCode(): number {
    return UtilsService.generateRandomInteger(1, 10e5 - 1);
  }

  private async _updateLastFailedLoggedDate(
    userAuth: UserAuthEntity,
  ): Promise<UpdateResult> {
    const queryBuilder = this._userAuthRepository.createQueryBuilder(
      'userAuth',
    );

    return queryBuilder
      .update()
      .set({ lastFailedLoggedDate: new Date() })
      .where('id = :id', { id: userAuth.id })
      .execute();
  }

  private async _updateLastSuccessfulLoggedDate(
    userAuth: UserAuthEntity,
    lastPresentLoggedDate?: Date,
  ): Promise<UpdateResult> {
    const queryBuilder = this._userAuthRepository.createQueryBuilder(
      'userAuth',
    );

    return queryBuilder
      .update()
      .set({ lastSuccessfulLoggedDate: lastPresentLoggedDate ?? new Date() })
      .where('id = :id', { id: userAuth.id })
      .execute();
  }
}
