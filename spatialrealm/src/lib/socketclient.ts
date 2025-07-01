"use client"

import { getSession } from "next-auth/react";
import {io} from "socket.io-client";

const session = await getSession();
export const socket = io("http://localhost:9000", {
  transports: ["websocket"],
  autoConnect: true,
  auth: {
    userId: session?.user?.email,
  },
});