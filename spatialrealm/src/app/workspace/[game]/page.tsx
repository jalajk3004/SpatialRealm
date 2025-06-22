"use client";
import {socket} from "@/lib/socketclient";
import { useEffect, useState } from "react";



export default function workspace() {

    const [room, setRoom] = useState<string>("");
    const [joined, setJoined] = useState<boolean>(false);
    const [messages,setMessages] = useState<{sender:string,messages:string}[]>([]);
    const [username, setUsername] = useState<string>("");

    useEffect(() => {
        socket.on("user_joined", ( message ) => {
            setMessages((prev) => [...prev, message]);
        });

        return () => {
            socket.off("user_joined");
            socket.off("message");
        }
    }, []);
    return (
        <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Welcome to your workspace!</h1>
        <p className="text-gray-600 mb-8">This is where you can manage your game settings and collaborate with others.</p>
        <p className="text-gray-500">Please select a game from the sidebar to get started.</p>
        </div>
    );
    }