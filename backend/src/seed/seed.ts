import mongoose from 'mongoose';
import { TicketTypeSchema } from '../tickets/schemas/ticket-type.schema';

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ticketbox';
  await mongoose.connect(uri);
  const TicketType = mongoose.model('TicketType', TicketTypeSchema);

  await TicketType.deleteMany({});

  const types = [
    { name: 'VIP', description: 'Khu vực sát sân khấu, có ghế ngồi', price: 3000000, totalQuantity: 50 },
    { name: 'Standard', description: 'Khu vực đứng, gần sân khấu', price: 1500000, totalQuantity: 200 },
    { name: 'Economy', description: 'Khu vực xa sân khấu', price: 800000, totalQuantity: 250 },
  ];

  for (const t of types) {
    await TicketType.create({
      ...t,
      availableQuantity: t.totalQuantity,
      heldQuantity: 0,
      soldQuantity: 0,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${types.length} ticket types (total ${types.reduce((s, t) => s + t.totalQuantity, 0)} vé)`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
