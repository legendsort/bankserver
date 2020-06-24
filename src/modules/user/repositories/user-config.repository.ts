import { UserConfigEntity } from '../entities';
import { Repository } from 'typeorm';
import { EntityRepository } from 'typeorm/decorator/EntityRepository';

@EntityRepository(UserConfigEntity)
export class UserConfigRepository extends Repository<UserConfigEntity> {}
