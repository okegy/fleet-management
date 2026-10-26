/**
 * FleetFlow synthetic demo data generator.
 *
 * Generates a coherent 8-month operating history for the demo organization:
 *   - 14 vehicles (trucks, vans, bikes) across every status
 *   - 12 drivers with varied safety scores and licence expiry dates
 *   - ~120 historical trips (completed / cancelled) + live dispatched + drafts
 *   - fuel expenses tied to completed trips
 *   - maintenance logs with a couple of live jobs
 *
 * Dates are explicit (completedAt / date / endDate) so the analytics
 * endpoints (trends, fleet KPIs, driver performance) produce real numbers.
 *
 * Run: node seed-demo-data.js
 * WARNING: replaces this organization's fleet data (not users/organization).
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Organization from './models/Organization.js';
import User from './models/User.js';
import Vehicle from './models/Vehicle.js';
import Driver from './models/Driver.js';
import Trip from './models/Trip.js';
import MaintenanceLog from './models/MaintenanceLog.js';
import FuelExpense from './models/FuelExpense.js';

dotenv.config();

// ---------- deterministic RNG so runs are reproducible ----------
let rngState = 20261025;
const rnd = () => {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
};
const ri = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const rf = (min, max) => +(rnd() * (max - min) + min).toFixed(2);
const pick = (arr) => arr[ri(0, arr.length - 1)];
const chance = (p) => rnd() < p;

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date();

const CITIES = [
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Nashik', lat: 19.9975, lng: 73.7898 },
  { name: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { name: 'Surat', lat: 21.1702, lng: 72.8311 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Indore', lat: 22.7196, lng: 75.8577 },
  { name: 'Bhopal', lat: 23.2599, lng: 77.4126 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Delhi', lat: 28.7041, lng: 77.1025 },
];

const VEHICLE_SPECS = [
  { name: 'Volvo FH16', type: 'truck', model: 'FH16 Globetrotter', cap: 18000, cost: 120000, odo: 145000 },
  { name: 'Tata Ace Gold', type: 'truck', model: 'Ace Gold Plus', cap: 1500, cost: 18000, odo: 62000 },
  { name: 'Mahindra Blazo X', type: 'truck', model: 'Blazo X 28', cap: 25000, cost: 95000, odo: 210000 },
  { name: 'Ford Transit', type: 'van', model: 'Transit 350', cap: 1200, cost: 38000, odo: 45000 },
  { name: 'Maruti Eeco Cargo', type: 'van', model: 'Eeco Cargo', cap: 600, cost: 14000, odo: 39000 },
  { name: 'Ashok Leyland Dost', type: 'van', model: 'Dost Strong', cap: 1250, cost: 22000, odo: 81000 },
  { name: 'Hero Splendor Cargo', type: 'bike', model: 'Splendor+ Cargo', cap: 40, cost: 2500, odo: 12000 },
  { name: 'Bajaj Pulsar Cargo', type: 'bike', model: 'Pulsar 150 Cargo', cap: 50, cost: 3200, odo: 15000 },
  { name: 'Eicher Pro 3015', type: 'truck', model: 'Pro 3015', cap: 16000, cost: 88000, odo: 176000 },
  { name: 'Tata Intra V30', type: 'van', model: 'Intra V30', cap: 1500, cost: 26000, odo: 58000 },
  { name: 'Isuzu D-Max', type: 'van', model: 'D-Max S-Cab', cap: 1800, cost: 42000, odo: 96000 }, // -> in_shop
  { name: 'TVS Apache Cargo', type: 'bike', model: 'Apache 160 Cargo', cap: 45, cost: 2900, odo: 9000 },
  { name: 'Scania R500', type: 'truck', model: 'R500 Heavy', cap: 24000, cost: 135000, odo: 98000 }, // -> retired
  { name: 'Mahindra Jeeto', type: 'van', model: 'Jeeto Plus', cap: 800, cost: 17000, odo: 34000 }, // -> in_shop
];

const RETIRED_INDEX = 12;
const SHOP_INDEXES = [10, 13];
const TRIP_VEHICLE_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11];

const DRIVER_SPECS = [
  { name: 'Rakesh Kumar', cat: 'truck', score: 94 },
  { name: 'Suresh Yadav', cat: 'truck', score: 88 },
  { name: 'Imran Sheikh', cat: 'truck', score: 76 },
  { name: 'Vikram Singh', cat: 'truck', score: 91 },
  { name: 'Anil Deshmukh', cat: 'van', score: 85 },
  { name: 'Prakash Patil', cat: 'van', score: 69 },
  { name: 'Manoj Verma', cat: 'van', score: 97 },
  { name: 'Kiran Rao', cat: 'van', score: 82 },
  { name: 'Deepak Joshi', cat: 'bike', score: 90 },
  { name: 'Amit Sharma', cat: 'bike', score: 64 }, // suspended
  { name: 'Rahul Nair', cat: 'bike', score: 93 },
  { name: 'Sandeep Chauhan', cat: 'van', score: 78 },
];

const SERVICE_TYPES = ['oil_change', 'repair', 'inspection', 'tire_replacement'];
const SERVICE_DESCRIPTIONS = {
  oil_change: 'Scheduled engine oil and filter replacement',
  repair: 'Brake assembly repair and alignment',
  inspection: 'Annual fitness and emissions inspection',
  tire_replacement: 'Front axle tyre replacement',
};

const monthStart = (offset) => new Date(NOW.getFullYear(), NOW.getMonth() - offset, 1);
const dateInMonth = (offset) => {
  const start = monthStart(offset);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const maxDay = offset === 0 ? Math.min(daysInMonth, NOW.getDate()) : daysInMonth;
  return new Date(
    start.getFullYear(),
    start.getMonth(),
    ri(1, maxDay),
    ri(6, 21),
    ri(0, 59)
  );
};

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // A fresh database (e.g. a hosted deployment) has no organization or users
  // yet, so bootstrap them here. Existing data is left untouched.
  let org = await Organization.findOne({ slug: 'fleetflow-demo' });
  if (!org) {
    org = await Organization.create({
      name: 'FleetFlow Demo',
      slug: 'fleetflow-demo',
      email: 'ops@fleetflow.io',
      phone: '+10000000000',
      address: 'Demo HQ',
      active: true,
    });
    console.log(`✅ Demo organization created: ${org.name}`);
  }

  for (const demoUser of [
    { name: 'Demo Fleet Manager', email: 'admin@fleetflow.io', role: 'fleet_manager' },
    { name: 'Demo Dispatcher', email: 'dispatcher@fleetflow.io', role: 'dispatcher' },
  ]) {
    const exists = await User.findOne({ email: demoUser.email });
    if (exists) continue;
    await User.create({
      ...demoUser,
      password: process.env.DEMO_USER_PASSWORD || 'FleetFlow@2026',
      organizationId: org._id,
    });
    console.log(`✅ Demo user created: ${demoUser.email}`);
  }

  const admin = await User.findOne({ email: 'admin@fleetflow.io' });
  if (!admin) throw new Error('Demo admin user could not be created');

  const orgId = org._id;
  const createdBy = admin._id;
  const orgQuery = { organizationId: orgId };

  // ---------- reset this org's fleet data ----------
  const wiped = await Promise.all([
    Vehicle.deleteMany(orgQuery),
    Driver.deleteMany(orgQuery),
    Trip.deleteMany(orgQuery),
    MaintenanceLog.deleteMany(orgQuery),
    FuelExpense.deleteMany(orgQuery),
  ]);
  console.log(
    `🧹 Cleared demo fleet data (vehicles:${wiped[0].deletedCount} drivers:${wiped[1].deletedCount} ` +
      `trips:${wiped[2].deletedCount} maintenance:${wiped[3].deletedCount} fuel:${wiped[4].deletedCount})`
  );

  // ---------- vehicles ----------
  const dispatchedVehicles = new Set([0, 3, 5]);
  const vehicleDocs = VEHICLE_SPECS.map((spec, i) => {
    let status = 'available';
    if (i === RETIRED_INDEX) status = 'retired';
    else if (SHOP_INDEXES.includes(i)) status = 'in_shop';
    else if (dispatchedVehicles.has(i)) status = 'on_trip';

    return {
      organizationId: orgId,
      name: spec.name,
      licenseplate: `MH${12 + (i % 8)}AB${1001 + i}`,
      vehicleType: spec.type,
      model: spec.model,
      maxCapacityKg: spec.cap,
      odometer: spec.odo,
      fuelLevel: ri(30, 95),
      status,
      acquisitionCost: spec.cost,
      maintenanceHistory: [],
      createdBy,
    };
  });

  // working set for historical trips (excludes retired + in_shop)
  const workingIndexes = TRIP_VEHICLE_INDEXES.filter((i) => !dispatchedVehicles.has(i));
  const runningOdo = {};
  workingIndexes.forEach((i) => (runningOdo[i] = vehicleDocs[i].odometer));

  // ---------- drivers ----------
  const driverDocs = DRIVER_SPECS.map((spec, i) => {
    const expiringSoon = i === 1 || i === 7 || i === 11;
    const expired = i === 9;
    let licenceExpiry;
    if (expired) licenceExpiry = new Date(NOW.getTime() - ri(5, 25) * DAY);
    else if (expiringSoon) licenceExpiry = new Date(NOW.getTime() + ri(8, 27) * DAY);
    else licenceExpiry = new Date(NOW.getTime() + ri(400, 1200) * DAY);

    return {
      organizationId: orgId,
      name: spec.name,
      email: `driver.${spec.name.toLowerCase().replace(/[^a-z]/g, '')}@fleetflow.io`,
      licenseNumber: `DL-${2019 + (i % 6)}-${100200 + i}`,
      licenseExpiry: licenceExpiry,
      licenseCategory: spec.cat,
      safetyScore: spec.score,
      status: i === 9 ? 'suspended' : 'off_duty',
      tripCount: 0,
      completedTrips: 0,
      phone: `+9198${String(10000000 + i * 137).slice(0, 8)}`,
      licenseIssuedDate: new Date(NOW.getTime() - ri(2000, 4000) * DAY),
    };
  });

  const insertedVehicles = await Vehicle.insertMany(vehicleDocs, { ordered: true });
  const insertedDrivers = await Driver.insertMany(driverDocs, { ordered: true });
  console.log(`✅ Vehicles created: ${insertedVehicles.length}`);
  console.log(`✅ Drivers created: ${insertedDrivers.length}`);

  const activeDrivers = insertedDrivers.filter((d) => d.status !== 'suspended');

  // ---------- trips ----------
  const tripDocs = [];
  const tripCreatedAt = [];
  const fuelDocs = [];
  let tripSeq = 0;
  const driverStats = new Map(); // driverId -> {total, completed}

  const bumpDriver = (driverId, completed) => {
    const stats = driverStats.get(String(driverId)) || { total: 0, completed: 0 };
    stats.total += 1;
    if (completed) stats.completed += 1;
    driverStats.set(String(driverId), stats);
  };

  const addFuelForTrip = (trip, distance, vehicleSpec) => {
    if (!chance(0.82)) return;
    const efficiencyByType = { truck: rf(3.2, 5.2), van: rf(8, 13), bike: rf(30, 45) };
    const efficiency = efficiencyByType[vehicleSpec.type];
    const liters = +(distance / efficiency).toFixed(2);
    if (liters <= 0) return;
    const pricePerLiter = rf(1.55, 1.98);

    fuelDocs.push({
      organizationId: orgId,
      vehicleId: trip.vehicleId,
      tripId: trip._id,
      liters,
      cost: +(liters * pricePerLiter).toFixed(2),
      pricePerLiter,
      date: new Date(trip.completedAt.getTime() + ri(1, 10) * 60 * 60 * 1000),
      location: `${pick(CITIES).name} Fuel Station`,
      odometerReading: trip.endOdometer,
      status: chance(0.6) ? 'audited' : chance(0.85) ? 'pending' : 'rejected',
      taxDeductible: chance(0.45),
      createdBy,
    });
  };

  // historical months: 8 months back through current month
  const TRIPS_PER_MONTH = [8, 10, 12, 14, 16, 18, 20, 22];
  for (let monthsAgo = TRIPS_PER_MONTH.length - 1; monthsAgo >= 0; monthsAgo--) {
    const count = TRIPS_PER_MONTH[TRIPS_PER_MONTH.length - 1 - monthsAgo];
    for (let t = 0; t < count; t++) {
      const vehIdx = pick(workingIndexes);
      const vehicle = insertedVehicles[vehIdx];
      const spec = VEHICLE_SPECS[vehIdx];
      const driver = pick(activeDrivers);

      const completedAt = dateInMonth(monthsAgo);
      const isCancelled = chance(0.05);
      const distance = {
        truck: ri(70, 430),
        van: ri(35, 260),
        bike: ri(10, 95),
      }[spec.type];
      const startOdometer = runningOdo[vehIdx];
      const endOdometer = startOdometer + distance;
      runningOdo[vehIdx] = endOdometer;

      const origin = pick(CITIES);
      let destination = pick(CITIES);
      while (destination.name === origin.name) destination = pick(CITIES);

      const dispatchedAt = new Date(completedAt.getTime() - ri(3, 24) * 60 * 60 * 1000);
      tripSeq += 1;

      const trip = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgId,
        tripId: `SEED-TRIP-${String(tripSeq).padStart(4, '0')}`,
        vehicleId: vehicle._id,
        driverId: driver._id,
        cargoWeight: Math.round(spec.cap * (chance(0.1) ? 0.95 : rf(0.35, 0.85))),
        originLocation: origin.name,
        destinationLocation: destination.name,
        status: isCancelled ? 'cancelled' : 'completed',
        notes: chance(0.25) ? 'Fragile cargo — handle with care' : undefined,
        assignedAt: new Date(dispatchedAt.getTime() - ri(1, 4) * 60 * 60 * 1000),
        dispatchedAt,
        completedAt: isCancelled ? undefined : completedAt,
        startOdometer,
        endOdometer: isCancelled ? undefined : endOdometer,
        createdBy,
        currentLocation: {
          lat: destination.lat,
          lng: destination.lng,
          timestamp: completedAt,
          address: destination.name,
        },
        trackingHistory: [],
      };

      tripDocs.push(trip);
      tripCreatedAt.push(dispatchedAt);
      bumpDriver(driver._id, !isCancelled);

      if (!isCancelled) addFuelForTrip(trip, distance, spec);
    }
  }

  // live dispatched trips (for the dashboard + tracking map)
  const liveRoutes = [
    { vehIdx: 0, driverIdx: 0, from: 'Mumbai', to: 'Pune' },
    { vehIdx: 3, driverIdx: 4, from: 'Pune', to: 'Nashik' },
    { vehIdx: 5, driverIdx: 5, from: 'Surat', to: 'Ahmedabad' },
  ];
  for (const route of liveRoutes) {
    const vehicle = insertedVehicles[route.vehIdx];
    const driver = insertedDrivers[route.driverIdx];
    const spec = VEHICLE_SPECS[route.vehIdx];
    const from = CITIES.find((c) => c.name === route.from);
    const to = CITIES.find((c) => c.name === route.to);
    const dispatchedAt = new Date(NOW.getTime() - ri(2, 20) * 60 * 60 * 1000);
    const progress = rf(0.35, 0.8);

    const trackingHistory = Array.from({ length: 6 }, (_, step) => {
      const p = (step / 5) * progress;
      const t = new Date(dispatchedAt.getTime() + step * 20 * 60 * 1000);
      return {
        lat: +(from.lat + (to.lat - from.lat) * p).toFixed(5),
        lng: +(from.lng + (to.lng - from.lng) * p).toFixed(5),
        timestamp: t,
        address: `${route.from} → ${route.to} (${Math.round(p * 100)}%)`,
      };
    });
    const current = trackingHistory[trackingHistory.length - 1];
    tripSeq += 1;

    tripDocs.push({
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgId,
      tripId: `SEED-TRIP-${String(tripSeq).padStart(4, '0')}`,
      vehicleId: vehicle._id,
      driverId: driver._id,
      cargoWeight: Math.round(spec.cap * rf(0.4, 0.8)),
      originLocation: route.from,
      destinationLocation: route.to,
      status: 'dispatched',
      notes: 'Live shipment in transit',
      assignedAt: new Date(dispatchedAt.getTime() - 90 * 60 * 1000),
      dispatchedAt,
      startOdometer: vehicle.odometer,
      createdBy,
      currentLocation: { lat: current.lat, lng: current.lng, timestamp: current.timestamp, address: current.address },
      trackingHistory,
    });
    tripCreatedAt.push(dispatchedAt);
    bumpDriver(driver._id, false);
    driver.status = 'on_duty';
  }

  // drafts awaiting dispatch
  for (let i = 0; i < 5; i++) {
    const vehIdx = pick(workingIndexes);
    const vehicle = insertedVehicles[vehIdx];
    const spec = VEHICLE_SPECS[vehIdx];
    const driver = pick(activeDrivers);
    const createdAt = new Date(NOW.getTime() - ri(1, 9) * DAY);
    const origin = pick(CITIES);
    let destination = pick(CITIES);
    while (destination.name === origin.name) destination = pick(CITIES);
    tripSeq += 1;

    tripDocs.push({
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgId,
      tripId: `SEED-TRIP-${String(tripSeq).padStart(4, '0')}`,
      vehicleId: vehicle._id,
      driverId: driver._id,
      cargoWeight: Math.round(spec.cap * rf(0.3, 0.7)),
      originLocation: origin.name,
      destinationLocation: destination.name,
      status: 'draft',
      notes: 'Awaiting dispatch approval',
      assignedAt: createdAt,
      startOdometer: vehicle.odometer,
      createdBy,
      trackingHistory: [],
    });
    tripCreatedAt.push(createdAt);
  }

  const insertedTrips = await Trip.insertMany(tripDocs, { ordered: false });
  console.log(`✅ Trips created: ${insertedTrips.length} (completed/cancelled/dispatched/draft)`);

  // Mongoose timestamps set createdAt=now on insertMany; rewrite it so the
  // period filters (dashboard week/month) reflect the simulated history.
  const createdAtById = new Map(insertedTrips.map((t, i) => [t._id, tripCreatedAt[i]]));
  await Trip.collection.bulkWrite(
    insertedTrips.map((t) => {
      const when = createdAtById.get(t._id);
      return {
        updateOne: { filter: { _id: t._id }, update: { $set: { createdAt: when, updatedAt: when } } },
      };
    })
  );
  console.log('✅ Trip timestamps aligned with simulated history');

  // ---------- fuel expenses ----------
  const insertedFuel = await FuelExpense.insertMany(fuelDocs, { ordered: false });
  console.log(`✅ Fuel expenses created: ${insertedFuel.length}`);

  // ---------- maintenance ----------
  const maintenanceDocs = [];
  const historyByVehicle = new Map();

  const pushMaintenance = (vehIdx, doc) => {
    doc._id = new mongoose.Types.ObjectId();
    doc.organizationId = orgId;
    doc.vehicleId = insertedVehicles[vehIdx]._id;
    doc.createdBy = createdBy;
    maintenanceDocs.push(doc);
    const key = String(doc.vehicleId);
    const list = historyByVehicle.get(key) || [];
    list.push(doc._id);
    historyByVehicle.set(key, list);
  };

  insertedVehicles.forEach((vehicle, idx) => {
    if (idx === RETIRED_INDEX) {
      pushMaintenance(idx, {
        serviceType: 'inspection',
        description: 'Final decommissioning inspection before retirement',
        cost: 120,
        status: 'completed',
        startDate: new Date(NOW.getTime() - ri(40, 70) * DAY),
        endDate: new Date(NOW.getTime() - ri(30, 39) * DAY),
        notes: 'Vehicle retired after service life',
      });
      return;
    }
    if (SHOP_INDEXES.includes(idx)) return; // live jobs added below

    const jobs = ri(2, 5);
    for (let j = 0; j < jobs; j++) {
      const serviceType = pick(SERVICE_TYPES);
      const startDate = new Date(NOW.getTime() - ri(10, 235) * DAY);
      const endDate = new Date(startDate.getTime() + ri(1, 4) * DAY);
      pushMaintenance(idx, {
        serviceType,
        description: SERVICE_DESCRIPTIONS[serviceType],
        cost: rf(45, 320),
        status: 'completed',
        startDate,
        endDate,
        notes: chance(0.3) ? 'Parts sourced from authorised dealer' : undefined,
      });
    }
  });

  // live maintenance jobs -> vehicles currently in_shop
  SHOP_INDEXES.forEach((idx, i) => {
    const startDate = new Date(NOW.getTime() - ri(1, 5) * DAY);
    pushMaintenance(idx, {
      serviceType: i === 0 ? 'repair' : 'tire_replacement',
      description:
        i === 0 ? 'Gearbox overhaul — vehicle off road' : 'Tyre replacement and wheel balancing',
      cost: i === 0 ? 900 : 420,
      status: 'in_progress',
      startDate,
      notes: 'Work order open, expected completion this week',
    });
    // a couple of historical completed jobs too
    for (let j = 0; j < 2; j++) {
      const serviceType = pick(SERVICE_TYPES);
      const s = new Date(NOW.getTime() - ri(60, 220) * DAY);
      pushMaintenance(idx, {
        serviceType,
        description: SERVICE_DESCRIPTIONS[serviceType],
        cost: rf(60, 280),
        status: 'completed',
        startDate: s,
        endDate: new Date(s.getTime() + ri(1, 3) * DAY),
      });
    }
  });

  const insertedMaintenance = await MaintenanceLog.insertMany(maintenanceDocs, { ordered: false });
  console.log(`✅ Maintenance logs created: ${insertedMaintenance.length}`);

  // Align createdAt with the simulated service dates as well, otherwise the
  // "this month" dashboard counters treat every historical log as brand new.
  await MaintenanceLog.collection.bulkWrite(
    insertedMaintenance.map((log) => ({
      updateOne: {
        filter: { _id: log._id },
        update: { $set: { createdAt: log.startDate, updatedAt: log.startDate } },
      },
    }))
  );
  console.log('✅ Maintenance timestamps aligned with service dates');

  // attach maintenance history + real odometers to vehicles
  for (const vehicle of insertedVehicles) {
    const history = historyByVehicle.get(String(vehicle._id)) || [];
    const vehIdx = insertedVehicles.findIndex((v) => String(v._id) === String(vehicle._id));
    const update = { maintenanceHistory: history };
    if (runningOdo[vehIdx] !== undefined) update.odometer = runningOdo[vehIdx];
    await Vehicle.updateOne({ _id: vehicle._id }, { $set: update });
  }
  console.log('✅ Vehicle maintenance history + odometers linked');

  // ---------- driver counters ----------
  for (const [driverId, stats] of driverStats.entries()) {
    await Driver.updateOne(
      { _id: driverId },
      { $set: { tripCount: stats.total, completedTrips: stats.completed } }
    );
  }
  console.log('✅ Driver trip counters updated');

  // ---------- summary ----------
  const summary = {
    vehicles: await Vehicle.countDocuments(orgQuery),
    vehiclesAvailable: await Vehicle.countDocuments({ ...orgQuery, status: 'available' }),
    vehiclesOnTrip: await Vehicle.countDocuments({ ...orgQuery, status: 'on_trip' }),
    vehiclesInShop: await Vehicle.countDocuments({ ...orgQuery, status: 'in_shop' }),
    drivers: await Driver.countDocuments(orgQuery),
    trips: await Trip.countDocuments(orgQuery),
    tripsCompleted: await Trip.countDocuments({ ...orgQuery, status: 'completed' }),
    tripsDispatched: await Trip.countDocuments({ ...orgQuery, status: 'dispatched' }),
    tripsDraft: await Trip.countDocuments({ ...orgQuery, status: 'draft' }),
    tripsCancelled: await Trip.countDocuments({ ...orgQuery, status: 'cancelled' }),
    fuelExpenses: await FuelExpense.countDocuments(orgQuery),
    maintenanceLogs: await MaintenanceLog.countDocuments(orgQuery),
    maintenancePending: await MaintenanceLog.countDocuments({ ...orgQuery, status: 'in_progress' }),
  };
  console.table(summary);

  const revenue = summary.tripsCompleted * 150;
  const fuelCost = insertedFuel.reduce((s, e) => s + e.cost, 0);
  const maintCost = insertedMaintenance.reduce((s, e) => s + e.cost, 0);
  console.log(
    `💰 Synthetic ops: fuel $${fuelCost.toFixed(0)} + maintenance $${maintCost.toFixed(0)} ` +
      `= $${(fuelCost + maintCost).toFixed(0)} vs estimated revenue $${revenue}`
  );

  await mongoose.disconnect();
  console.log('✅ Demo data seed complete');
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
