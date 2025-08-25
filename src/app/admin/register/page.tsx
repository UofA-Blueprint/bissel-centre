"use client";
// Basic template for regsitering IT admins

import React from "react";
import { createAdmin } from "@/app/admin/actions";

const page = () => {
  return (
    <div>
      <h1>Admin Registration</h1>
      <button onClick={createAdmin}>Create Admin</button>
    </div>
  );
};

export default page;
