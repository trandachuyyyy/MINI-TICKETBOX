import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { TicketType, TicketTypeSchema } from './schemas/ticket-type.schema';
import { Reservation, ReservationSchema } from './schemas/reservation.schema';
import { EventsGateway } from '../events/events.gateway';
import { MailService } from '../common/services/mail.service';

/**
 * This test simulates the exact scenario the assignment cares about most:
 * far more concurrent requests than tickets available, all racing to hold
 * the same pool at once. We assert that the pool NEVER goes negative and
 * that exactly `totalQuantity` holds succeed — no overselling, no lost
 * updates — proving the atomic findOneAndUpdate guard actually works
 * instead of just looking correct on paper.
 */
describe('TicketsService - concurrency', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let service: TicketsService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    connection = await mongoose.createConnection(uri).asPromise();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: EventsGateway, useValue: { broadcastInventory: jest.fn() } },
        { provide: MailService, useValue: { sendPaymentSuccessEmail: jest.fn() } },
        { provide: getModelToken(TicketType.name), useValue: connection.model(TicketType.name, TicketTypeSchema) },
        { provide: getModelToken(Reservation.name), useValue: connection.model(Reservation.name, ReservationSchema) },
      ],
    }).compile();

    service = moduleRef.get(TicketsService);
  }, 60000);

  afterAll(async () => {
    await connection?.close();
    await mongod?.stop();
  });

  it('never oversells when 200 concurrent holds race for 50 tickets', async () => {
    const TicketTypeModel = connection.model(TicketType.name, TicketTypeSchema);
    const ticket = await TicketTypeModel.create({
      name: 'VIP',
      price: 100,
      totalQuantity: 50,
      availableQuantity: 50,
      heldQuantity: 0,
      soldQuantity: 0,
    });

    const CONCURRENT_USERS = 200;
    const requests = Array.from({ length: CONCURRENT_USERS }, (_, i) =>
      service
        .holdTicket(String(ticket._id), 1, `client-${i}`)
        .then(() => 'OK')
        .catch(() => 'REJECTED'),
    );

    const results = await Promise.all(requests);
    const succeeded = results.filter((r) => r === 'OK').length;
    const rejected = results.filter((r) => r === 'REJECTED').length;

    expect(succeeded).toBe(50); // exactly the stock, never more
    expect(rejected).toBe(150);

    const final = await TicketTypeModel.findById(ticket._id).lean();
    expect(final!.availableQuantity).toBe(0);
    expect(final!.heldQuantity).toBe(50);
    expect(final!.availableQuantity).toBeGreaterThanOrEqual(0); // never negative
  }, 30000);

  it('reuses an existing active hold when the same client requests again', async () => {
    const TicketTypeModel = connection.model(TicketType.name, TicketTypeSchema);
    const ticket = await TicketTypeModel.create({
      name: 'Standard',
      price: 50,
      totalQuantity: 2,
      availableQuantity: 2,
      heldQuantity: 0,
      soldQuantity: 0,
    });

    const first = await service.holdTicket(String(ticket._id), 1, 'client-a');
    const second = await service.holdTicket(String(ticket._id), 1, 'client-a');

    expect(second._id.toString()).toBe(first._id.toString());

    const reservations = await connection.model(Reservation.name, ReservationSchema).find({ clientId: 'client-a' }).lean();
    expect(reservations).toHaveLength(1);
  });

  it('releases a hold back to the pool and lets someone else take it', async () => {
    const TicketTypeModel = connection.model(TicketType.name, TicketTypeSchema);
    const ticket = await TicketTypeModel.create({
      name: 'Standard',
      price: 50,
      totalQuantity: 1,
      availableQuantity: 1,
      heldQuantity: 0,
      soldQuantity: 0,
    });

    const reservation = await service.holdTicket(String(ticket._id), 1, 'client-a');
    await expect(service.holdTicket(String(ticket._id), 1, 'client-b')).rejects.toThrow();

    await service.cancelReservation(String(reservation._id), 'client-a');

    const released = await service.holdTicket(String(ticket._id), 1, 'client-b');
    expect(released).toBeDefined();
  });

  it('rejects confirming a payment after the hold has expired', async () => {
    const TicketTypeModel = connection.model(TicketType.name, TicketTypeSchema);
    const ReservationModel = connection.model(Reservation.name, ReservationSchema);
    const ticket = await TicketTypeModel.create({
      name: 'Economy',
      price: 10,
      totalQuantity: 1,
      availableQuantity: 1,
      heldQuantity: 0,
      soldQuantity: 0,
    });

    const reservation = await service.holdTicket(String(ticket._id), 1, 'client-x');
    // force-expire it, simulating the 5 minute window passing
    await ReservationModel.updateOne(
      { _id: reservation._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    await expect(
      service.confirmPayment(String(reservation._id), 'client-x', {
        customerName: 'A',
        customerEmail: 'a@test.com',
        customerPhone: '0900000000',
      }),
    ).rejects.toThrow();
  });
});
