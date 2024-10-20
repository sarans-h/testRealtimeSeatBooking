const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  userId: {
    type: String, // User name for now (can later be a reference to a User model)
    required: true
  },
  seats: [{
    type: mongoose.Schema.Types.ObjectId, // Array of seat IDs
    ref: 'Seat',
    required: true
  }],
  bookingTime: {
    type: Date,
    default: Date.now, // Automatically records booking time
    required: true
  },
  status: {
    type: String,
    enum: ['booked', 'canceled', 'completed'], // Status of the booking
    default: 'booked'
  }
}, { timestamps: true });

const Booking = mongoose.model('Booking', BookingSchema);
module.exports = Booking;
