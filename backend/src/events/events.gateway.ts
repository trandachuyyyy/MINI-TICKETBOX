import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('EventsGateway');
  private readonly inventoryRoom = 'inventory:room';
  private readonly adminRoom = 'admin:room';

  handleConnection(client: Socket) {
    void client.join(this.inventoryRoom);

    const role = client.handshake.query?.role;
    if (role === 'admin') {
      void client.join(this.adminRoom);
    }

    this.logger.debug(`client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:inventory')
  handleJoinInventory(@ConnectedSocket() client: Socket) {
    void client.join(this.inventoryRoom);
    return { ok: true };
  }

  @SubscribeMessage('join:admin')
  handleJoinAdmin(@ConnectedSocket() client: Socket) {
    void client.join(this.adminRoom);
    return { ok: true };
  }

  /** Broadcast the latest inventory snapshot to connected browsers. */
  broadcastInventory(payload: unknown, adminPayload?: unknown) {
    if (!this.server) return;

    this.server.to(this.inventoryRoom).emit('inventory:update', payload);
    if (adminPayload !== undefined) {
      this.server.to(this.adminRoom).emit('admin:update', adminPayload);
    }
  }
}
