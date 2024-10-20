import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000'); // Connect to the backend

const App = () => {
  const [selectedSeats, setSelectedSeats] = useState([]); // All seats currently selected by any user
  const [mySelectedSeats, setMySelectedSeats] = useState([]); // Seats selected by the current user
  const [viewingUsers, setViewingUsers] = useState(0); // Number of users currently viewing
  const [userId, setUserId] = useState(null); // Store userId after connecting
  const [s,setS]=useState([])
  useEffect(() => {
    const fetchSeats = async () => {
      try {
        const response = await axios.get('http://localhost:5000/fetchseats/67155452e5d7ec0b626199ec');
        // console.log(response.data.seats);
        
        setS(response.data.seats)
      } catch (error) {
        console.error('Error fetching seats:', error);
      }
    };
    fetchSeats();
    // console.log(s);
    
    socket.on('connect', () => {
      setUserId(socket.id); // Set userId as the socket.id
    });

    // Listen for initial data from the server
    socket.on('initialData', (data) => {
      setSelectedSeats(data.selectedSeats); // Set all currently selected seats
      setViewingUsers(data.viewingUsers); // Update viewing users on initial load
    });

    socket.on('viewingUsersUpdate', (data) => {
      setViewingUsers(data.viewingUsers); // Update viewing users in real-time
    });

    // Listen for updates when users select/deselect seats
    socket.on('seatUpdate', (data) => {
      setSelectedSeats(data.selectedSeats); // Update seat selection in real-time
    });

    return () => {
      socket.off('connect');
      socket.off('initialData');
      socket.off('seatUpdate');
      socket.off('viewingUsersUpdate');
    };
  }, []);

  const handleSeatSelect = (seatNumber) => {
    const seat = selectedSeats.find(seat => seat.seatNumber === seatNumber);
    
    if (seat && seat.userId !== userId) {
      // If the seat is selected by another user, prevent action
      return;
    }

    if (mySelectedSeats.includes(seatNumber)) {
      // Deselect the seat if it was selected by this user
      const updatedSeats = mySelectedSeats.filter(seat => seat !== seatNumber);
      setMySelectedSeats(updatedSeats);
      socket.emit('seatDeselected', { seatNumber, userId });
    } else {
      // Select a new seat if it is available
      const updatedSeats = [...mySelectedSeats, seatNumber];
      setMySelectedSeats(updatedSeats);
      socket.emit('seatSelected', { seatNumber, userId });
    }
  };

  const isSeatDisabled = (seatNumber) => {
    // Disable seat if it is selected by someone else
    const seat = selectedSeats.find(seat => seat.seatNumber === seatNumber);
    return seat && seat.userId !== userId;
  };
  // console.log(s);
  const handlebook=()=>{
    const hardcodedUserId = "ra jsj";

  // Map over mySelectedSeats to create seat updates
  const seatUpdates = mySelectedSeats.map((seatNo) => {
    const seat = s.find((s) => s.seatNo === seatNo);
    return {
      seatId: seat ? seat._id : null, // Find the seatId corresponding to the seatNo
      bookedBy: userId, // Replace "John" with dynamic user information if needed
    };
  }).filter(update => update.seatId); // Filter out any null seatId

  // Construct the final object
  const payload = {
    seatUpdates,
    userId: hardcodedUserId,
  };

  console.log(payload);
  axios.post('http://localhost:5000/book', payload)
    .then(response => {
      console.log('Booking response:', response.data);
    })
    .catch(error => {
      console.error('Error during booking:', error);
    });

    
  }
  const hadleDelete=async()=>{
    try {
      const response = await axios.delete('http://localhost:5000/deleteAllSeats');
      console.log(response.data.message);
    } catch (error) {
      console.error('Error deleting all seats:', error);
    }
  }
  const hadleSeed=async()=>{
    const response=await axios.post("http://localhost:5000/seed");
    console.log(response.data.message);
  }
  return (
    <div>
      <h2>Select Your Seat</h2>
      <p>Currently viewing: {viewingUsers} users</p>
      <div className="seat-grid">
        {/* {Array.from({ length: 20 }, (_, i) => i + 1).map((seat) => (
          <button
            key={seat}
            onClick={() => handleSeatSelect(seat)}
            disabled={isSeatDisabled(seat)}
            style={{
              backgroundColor: mySelectedSeats.includes(seat) ? 'green' : isSeatDisabled(seat) ? 'transparent' : 'lightgray',
              color: mySelectedSeats.includes(seat) ? 'white' : 'black',
              padding: '10px',
              margin: '5px',
              border: '1px solid #ccc',
              cursor: isSeatDisabled(seat) ? 'not-allowed' : 'pointer'
            }}
          >
            Seat {seat}
          </button>
        ))} */}


      </div>
      {s.map((seat) => (
          seat.status==='available'?(<button
            key={seat._id}
            onClick={() => handleSeatSelect(seat.seatNo)}
            disabled={isSeatDisabled(seat.seatNo)}
            style={{
              backgroundColor: mySelectedSeats.includes(seat.seatNo) ? 'green' : isSeatDisabled(seat.seatNo) ? 'transparent' : 'lightgray',
              color: mySelectedSeats.includes(seat.seatNo) ? 'white' : 'black',
              padding: '10px',
              margin: '5px',
              border: '1px solid #ccc',
              cursor: isSeatDisabled(seat.seatNo) ? 'not-allowed' : 'pointer'
            }}
          >
            Seat {seat.seatNo}
          </button>):<></>
        ))}
        <button className='seat-button' onClick={handlebook} style={{
          backgroundColor:"skyblue"
        }}>Book</button>
        <button className='seat-button' style={{
          backgroundColor:"red"
        }} onClick={hadleDelete}>Delete All Seats</button>
        <button className='seat-button' style={{
          backgroundColor:"red"
        }} onClick={hadleSeed}> Seed Seats</button>
    </div>
  );
};

export default App;
