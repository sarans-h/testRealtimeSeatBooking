const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const Seat = require('./models/Seat');
const Booking = require('./models/Booking');
const { log } = require("console");


app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173',  // Frontend URL
    methods: ['GET', 'POST','DELETE'],          // Allowed methods
    credentials: true                  // Allow credentials (cookies, headers)
  }));
const db = 'mongodb://localhost/seattest1';

mongoose
  .connect(db)
  .then(() => console.log("💻 Mondodb Connected"))
  .catch(err => console.error(err));


  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',  // Frontend URL
      methods: ['GET', 'POST','DELETE'],          // Allowed methods
      credentials: true                  // Allow credentials for WebSockets
    }
  });
  let selectedSeats = [];
let viewingUsers = 0;

io.on('connection', (socket) => {
  viewingUsers++;
  console.log('User connected:', socket.id);

  // Send initial data to the client
  socket.emit('initialData', { selectedSeats, viewingUsers });
  io.emit('viewingUsersUpdate', { viewingUsers });

  // Listen for seat selections
  socket.on('seatSelected', ({ seatNumber, userId }) => {
    selectedSeats.push({ seatNumber, userId });
    io.emit('seatUpdate', { selectedSeats });
  });

  // Listen for seat deselections
  socket.on('seatDeselected', ({ seatNumber, userId }) => {
    selectedSeats = selectedSeats.filter(
      (seat) => !(seat.seatNumber === seatNumber && seat.userId === userId)
    );
    io.emit('seatUpdate', { selectedSeats });
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remove the seats selected by the disconnected user
    selectedSeats = selectedSeats.filter(seat => seat.userId !== socket.id);
    io.emit('seatUpdate', { selectedSeats });

    // Update viewing users
    viewingUsers--;
    io.emit('viewingUsersUpdate', { viewingUsers });
  });
});







  app.get("/", (req, res) => {
  res.send("Server working 🔥");
});

app.post('/book', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const { seatUpdates, userId } = req.body;

      
      if (!Array.isArray(seatUpdates) || seatUpdates.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ msg: 'seatUpdates array is required.' });
      }
  
      // Step 1: Check if all requested seats are available
      const seatIds = seatUpdates.map(su => su.seatId); // Get seatIds from the seatUpdates

  
      // Find seats by seatId and check their availability
      const availableSeats = await Seat.find({
        'seats._id': { $in: seatIds },
        'seats.status': 'available'
      }).session(session);
      
      // Filter out only the seats that match both the seatId and availability
      const matchingSeats = availableSeats.map(seatDoc => {
        return {
          ...seatDoc.toObject(),  // Convert Mongoose document to a plain JS object
          seats: seatDoc.seats.filter(seat => seatIds.includes(seat._id.toString()) && seat.status === 'available') // Filter matching seats
        };
      });
      console.log(matchingSeats);
      
      // Print the filtered available seats
      matchingSeats.forEach(seatDoc => {
        seatDoc.seats.forEach(seat => {
          console.log(`Seat ID: ${seat._id}, Status: ${seat.status}, Booked By: ${seat.bookedBy}`);
        });
      });
      
      // If the number of available seats doesn't match the request, some seats are already booked
      if (matchingSeats[0].seats.length !== seatUpdates.length) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ msg: 'One or more seats are already booked or unavailable.' });
      }
  
      // Step 2: Book all seats, making sure they are still available
      for (const seatUpdate of seatUpdates) {
        const { seatId, bookedBy } = seatUpdate;
      
        // Update the specific seat in the array where the _id matches and the seat is still available
        const seatUpdateResult = await Seat.updateOne(
          { 'seats._id': seatId, 'seats.status': 'available' }, // Match seat by _id and ensure it's available
          { 
            $set: { 
              'seats.$.bookedBy': bookedBy, // Set the bookedBy field
              'seats.$.status': 'booked'    // Change status to booked
            }
          },
          { session }
        );
      
        // If any seat fails to update, abort the transaction
        if (seatUpdateResult.modifiedCount === 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ msg: `Seat with id ${seatId} could not be booked. It might already be booked.` });
        }
      }
      
      // Step 3: Create a booking entry after all seats are successfully booked
      const bookedSeatIds = seatUpdates.map(su => su.seatId);
  
      const newBooking = new Booking({
        userId,
        seats: bookedSeatIds,
        status: 'booked'
      });
  
      await newBooking.save({ session }); // Save the booking in the same transaction
  
      // Step 4: Commit the transaction if everything is successful
      await session.commitTransaction();
      session.endSession();
  
      return res.status(200).json({ msg: 'Seats booked and booking entry created successfully.' });
  
    } catch (err) {
      // Roll back the transaction in case of any error
      await session.abortTransaction();
      session.endSession();
      console.error(err);
      return res.status(500).json({ msg: 'Server Error' });
    }
  });

  app.get('/fetchseats/:bId', async (req, res) => {
    const { bId } = req.params; // Extract busId (bId) from the request params
    
    try {
      // Fetch seats for the given busId
      const seatsData = await Seat.findOne({ _id: bId });
      
      if (!seatsData) {
        return res.status(404).json({ msg: 'No seats found for the provided bus ID.' });
      }
      
      res.status(200).json({ seats: seatsData.seats }); // Send the seats array to the client
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: 'Server Error' });
    }
  });
  app.delete('/deleteAllSeats', async (req, res) => {
    try {
      const result = await Seat.deleteMany({});
      res.status(200).json({
        message: 'All seats have been deleted successfully.',
        deletedCount: result.deletedCount, // This returns the number of deleted documents
      });
    } catch (error) {
      res.status(500).json({
        message: 'An error occurred while deleting seats.',
        error: error.message,
      });
    }
  });
app.post('/seed', async (req, res) => {
  try {
    const dummySeats = {
      seats: [
        { seatNo: 1 },
        { seatNo: 2 },
        { seatNo: 3  },
        { seatNo: 4 }, // Unbooked seat
        { seatNo: 5 },
        { seatNo: 6  },
        { seatNo: 7 }, // Unbooked seat
        { seatNo: 8  },
        { seatNo: 9  },
        { seatNo: 10}
      ]
    };

    // Insert the dummy data into the database
    const newSeats = new Seat(dummySeats);
    await newSeats.save();

    res.status(201).json({ msg: 'Dummy seats added successfully', data: newSeats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Server running on port ${port} 🔥`));