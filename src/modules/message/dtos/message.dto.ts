import { ApiProperty } from '@nestjs/swagger';
import { AbstractDto } from 'common/dtos';
import { UserDto } from 'modules/user/dtos';
import { MessageEntity } from 'modules/message/entities';
import { MessageTemplateDto, MessageKeyDto } from 'modules/message/dtos';

export class MessageDto extends AbstractDto {
  @ApiProperty()
  readonly readed: boolean;

  @ApiProperty()
  readonly createdAt: Date;

  @ApiProperty()
  readonly updatedAt?: Date;

  @ApiProperty({ type: () => UserDto })
  readonly sender: UserDto;

  @ApiProperty({ type: () => UserDto })
  readonly recipient: UserDto;

  @ApiProperty({
    type: () => MessageTemplateDto,
    isArray: true,
  })
  readonly templates: MessageTemplateDto[];

  @ApiProperty({ type: () => MessageKeyDto })
  readonly key: MessageKeyDto;

  constructor(message: MessageEntity) {
    super(message);
    this.readed = message.readed;
    this.createdAt = message.createdAt;
    this.updatedAt = message.updatedAt;
    this.sender = message.sender.toDto();
    this.recipient = message.recipient.toDto();
    this.templates = message.templates.toDtos();
    this.key = message.key.toDto();
  }
}
