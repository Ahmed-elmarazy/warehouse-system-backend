// 📄 src/notifications/gateways/notifications.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' }, // ظبطها في الـ Production على نطاق فرونتد محدد
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // قراءة الـ Role والـ Room من الـ Handshake Query
    const role = client.handshake.query.role as string;
    const userId = client.handshake.query.userId as string;

    if (role) {
      client.join(`role:${role}`); // الانضمام لغرفة الـ Role (مثل role:OWNER)
    }
    if (userId) {
      client.join(`user:${userId}`); // غرفة خاصة بالمستخدم نفسه
    }
    console.log(`⚡ Client connected: ${client.id} - Joined as: ${role}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
  }

  // ميثود داخلية لبث الإشعارات لحظياً
  emitNotification(notification: any) {
    // 1. إرسال لجميع الـ Owners دائماً لأنهم يراقبون كل شيء
    this.server.to('role:OWNER').emit('notification.created', notification);

    // 2. إرسال للـ Employees إذا كان التنبيه يخص نطاق عملهم أو موجه لهم
    if (notification.type === 'INVENTORY' || notification.type === 'SYSTEM') {
      this.server
        .to('role:EMPLOYEE')
        .emit('notification.created', notification);
    }
  }
}
