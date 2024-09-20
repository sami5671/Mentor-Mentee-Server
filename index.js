const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  // origin: ["https://mentor-mentee-9d67b.web.app"],
  origin: ["http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const usersCollection = client.db("MentorMentee").collection("users");
    // const Collection = client.db("MentorMentee").collection("users");
    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("I need a new jwt", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Save or modify user email, status in DB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const isExist = await usersCollection.findOne(query);
      console.log("User found?----->", isExist);
      if (isExist) return res.send(isExist);
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      );
      res.send(result);
    });

    // =================================================================
    // Add endpoint to set the deadline in the database
    app.post("/deadline", async (req, res) => {
      try {
        const now = new Date();
        const deadline = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // Set deadline 15 days from now
        await client
          .db("MentorMentee")
          .collection("deadline")
          .insertOne({ deadline });
        res.send({ success: true });
      } catch (error) {
        console.error("Error setting deadline:", error);
        res.status(500).send({ error: "Error setting deadline" });
      }
    });
    app.get("/deadline", async (req, res) => {
      try {
        const deadlineDoc = await client
          .db("MentorMentee")
          .collection("deadline")
          .findOne();
        if (deadlineDoc) {
          res.send(deadlineDoc.deadline);
        } else {
          res.status(404).send({ error: "Deadline not found" });
        }
      } catch (error) {
        console.error("Error retrieving deadline:", error);
        res.status(500).send({ error: "Error retrieving deadline" });
      }
    });
    // =================================================================

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Mentor Mentee Server..");
});

app.listen(port, () => {
  console.log(`Mentor Mentee is running on port ${port}`);
});
