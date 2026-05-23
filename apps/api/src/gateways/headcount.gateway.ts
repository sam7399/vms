import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class HeadcountGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private connectedClients = new Set<string>();

  async handleConnection(client: Socket) {
    this.connectedClients.add(client.id);
    console.log(`✓ Client connected: ${client.id}`);
    
    const headcount = await this.calculateHeadcount();
    client.emit('headcount_update', headcount);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    console.log(`✗ Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('request_headcount')
  async handleHeadcountRequest() {
    const headcount = await this.calculateHeadcount();
    this.server.emit('headcount_update', headcount);
  }

  private async calculateHeadcount() {
    const visits = await prisma.visit.findMany({
      where: { status: 'CHECKED_IN' },
      include: { visitor: true },
    });

    const checkedIn = visits.filter((v: any) => v.actualEntry && !v.actualExit);

    return {
      total: checkedIn.length,
      visitors: checkedIn.filter((v: any) => v.visitor.company).length,
      workers: 0,
      employees: checkedIn.filter((v: any) => !v.visitor.company).length,
      timestamp: new Date().toISOString(),
    };
  }

  async broadcastHeadcountUpdate() {
    const headcount = await this.calculateHeadcount();
    this.server.emit('headcount_update', headcount);
  }
}
