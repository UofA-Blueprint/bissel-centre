"use client";
import React, { useState } from "react";
import RegisterRecipientModal from "@/app/components/register_recipient/RegisterRecipientModal";

const DummyPage: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-bold">Dummy Page</h1>
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Open Register Modal
        </button>
      </div>

      <RegisterRecipientModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

export default DummyPage;
