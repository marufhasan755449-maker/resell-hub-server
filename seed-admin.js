require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const seedAdmin = async () => {
  try {
    await client.connect();
    const db = client.db("resellhub");

    const adminEmail = process.env.ADMIN_EMAIL || "admin@resellhub.com";

    const existing = await db.collection("users").findOne({ email: adminEmail });

    if (existing) {
      // Update role to admin if already exists
      await db.collection("users").updateOne(
        { email: adminEmail },
        { $set: { role: "admin", status: "active", updatedAt: new Date() } }
      );
      console.log(`✅ Existing user "${adminEmail}" updated to admin role.`);
    } else {
      // Create new admin user
      await db.collection("users").insertOne({
        name: "Super Admin",
        email: adminEmail,
        photo: "",
        phone: "",
        location: "Bangladesh",
        role: "admin",
        status: "active",
        createdAt: new Date(),
      });
      console.log(`✅ Admin user created: ${adminEmail}`);
    }

    // Create DB indexes for performance
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("products").createIndex({ status: 1, createdAt: -1 });
    await db.collection("products").createIndex({ "sellerInfo.email": 1 });
    await db.collection("products").createIndex({ category: 1 });
    await db.collection("orders").createIndex({ "buyerInfo.email": 1 });
    await db.collection("orders").createIndex({ "sellerInfo.email": 1 });
    await db.collection("payments").createIndex({ buyerEmail: 1 });
    await db.collection("wishlist").createIndex({ userEmail: 1, productId: 1 });
    await db.collection("reviews").createIndex({ productId: 1 });

    console.log("✅ All MongoDB indexes created successfully!");
    console.log("\n📋 Admin Credentials:");
    console.log(`   Email: ${adminEmail}`);
    console.log("   Password: (set via Firebase Auth)");
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
  } finally {
    await client.close();
    process.exit(0);
  }
};

seedAdmin();
