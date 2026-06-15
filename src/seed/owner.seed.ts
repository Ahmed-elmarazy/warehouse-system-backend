import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { OwnerSchema } from '../owner/owner.schema';
import { Role } from '../common/enums/role.enum';

dotenv.config({
  path: `.env.${process.env.NODE_ENV ?? 'development'}`,
});

async function seed() {
  const uri = process.env.MONGO_URI;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!uri) throw new Error('MONGO_URI is not defined');
  if (!email || !password)
    throw new Error('ADMIN_EMAIL or ADMIN_PASSWORD is missing');

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  const OwnerModel = mongoose.model('Owner', OwnerSchema);

  const existing = await OwnerModel.findOne({ systemKey: 'ROOT' });

  if (existing) {
    console.log('⚠️ Owner already exists. Seed aborted.');
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await OwnerModel.create({
    fullName: 'System Owner',
    email: email.toLowerCase(),
    password: hashedPassword,
    role: Role.OWNER,
    isActive: true,
    systemKey: 'ROOT',
  });

  console.log('✅ Owner created successfully');
  console.log(`📧 Email: ${email}`);
  console.log('🔑 Password set from ENV');
  console.log('⚠️ Change password after first login!');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

// npx ts-node src/seed/owner.seed.ts
