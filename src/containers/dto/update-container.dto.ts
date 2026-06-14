import { PartialType } from '@nestjs/swagger'; // التغيير هنا لـ @nestjs/swagger
import { CreateContainerDto } from './create-container.dto';

export class UpdateContainerDto extends PartialType(CreateContainerDto) {}
