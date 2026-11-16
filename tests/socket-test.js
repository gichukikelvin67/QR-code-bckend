
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    accessToken: process.env.ACCESS_TOKEN,
  },
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Connection failed:", error.message);
});

socket.on("preparation:new-order", (data) => {
  console.log("NEW PREPARATION ORDER RECEIVED:");
  console.dir(data, { depth: null });
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});
socket.on("preparation:status-updated", (data) => {
  console.log("PREPARATION STATUS UPDATED:");
  console.dir(data, { depth: null });
});