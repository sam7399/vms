import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaClient, VisitStatus } from '@prisma/client';

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
    const [activeVisits, activeWorkers] = await Promise.all([
      prisma.visit.findMany({
        where: { status: VisitStatus.CHECKED_IN, actualExit: null },
        select: { id: true, visitor: { select: { company: true } } },
      }),
      prisma.attendance.count({ where: { checkOut: null } }),
    ]);

    const visitors = activeVisits.filter((v) => v.visitor.company).length;
    const employees = activeVisits.filter((v) => !v.visitor.company).length;

    return {
      total: visitors + employees + activeWorkers,
      visitors,
      workers: activeWorkers,
      employees,
      timestamp: new Date().toISOString(),
    };
  }

  async broadcastHeadcountUpdate() {
    const headcount = await this.calculateHeadcount();
    this.server.emit('headcount_update', headcount);
  }

  /** Push a one-off notification to all connected dashboards. */
  broadcastNotification(payload: {
    kind: 'walk-in' | 'approval' | 'check-in' | 'check-out';
    title: string;
    body?: string;
    visitId?: string;
  }) {
    this.server.emit('notification', { ...payload, ts: new Date().toISOString() });
  }

  /** Persistent emergency alert visible until cleared on every dashboard. */
  broadcastSos(payload: {
    actorEmail: string;
    actorName: string;
    branchName?: string;
    message?: string;
  }) {
    this.server.emit('sos', { ...payload, ts: new Date().toISOString() });
  }

  /** Clear the active SOS banner. */
  broadcastSosClear() {
    this.server.emit('sos_clear', { ts: new Date().toISOString() });
  }
}
