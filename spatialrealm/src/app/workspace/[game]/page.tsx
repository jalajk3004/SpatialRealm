"use client";
import {socket} from "@/lib/socketclient";
import { useEffect, useState } from "react";
import { Chat } from "./_components/chat";
import { Participants } from "./_components/participants";



export default function workspace() {

    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-100  ">
            <Chat/>
            <Participants/>
        </div>
    );
    }