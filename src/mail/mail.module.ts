import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';

@Global() // Available everywhere without importing
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
