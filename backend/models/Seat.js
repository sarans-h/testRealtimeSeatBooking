const mongoose = require('mongoose');


const SeatsSchema = new mongoose.Schema({
    seats: [{
      seatNo: {
        type: Number,
        required: true
      },
      status:{
        type: String,
        enum: ['available', 'booked'],
        default: 'available'
      },
      bookedBy: {
        type: String,
        default: null // Set default to null if not booked
      }
    }]
  });
  

module.exports =mongoose.model('Seat', SeatsSchema);